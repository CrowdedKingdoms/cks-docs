# GraphQL Server Registration

This document describes how the `web-api` (NestJS) instance registers itself
in the database on startup, advertises its liveness via a periodic heartbeat,
and exposes its registry over GraphQL. It also covers the closely related
`server_status` table that the Rust game servers populate and that the API
consults when picking a target host for a client.

> Source of truth: `schema/schema.sql` and `web-api/src/server-status/`.
> Update this document whenever those change.

## Database schema

Two tables live in the `SERVERS` section of `schema/schema.sql` and share a
single enum.

### `server_state` enum

```sql
create type server_state as enum (
    'Starting',
    'ReadyForClients',
    'Stopping',
    'Offline'
);
```

### `graphql_servers` (this NestJS process)

```sql
create table graphql_servers (
    graphql_server_id bigserial primary key,
    ip4 inet,
    ip6 inet,
    status server_state not null,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

Both `ip4` and `ip6` are nullable: a host that does not have an address in a
particular family simply registers `null` for that column.

### `server_status` (Rust game servers)

```sql
create table server_status (
    server_id   bigserial primary key,
    ip4         inet not null,
    ip6         inet not null,
    client_port int  not null,
    peer_port   int  not null,
    unique (ip4, peer_port, client_port),
    unique (ip6, peer_port, client_port),
    status      server_state not null,
    peers       int not null default 0,
    clients     int not null default 0,
    cpu_peak_pct                          double precision,
    client_recv_msgs_per_sec              double precision,
    client_recv_bytes_per_sec             double precision,
    client_send_msgs_per_sec              double precision,
    client_send_bytes_per_sec             double precision,
    peer_recv_msgs_per_sec                double precision,
    peer_recv_bytes_per_sec               double precision,
    peer_send_msgs_per_sec                double precision,
    peer_send_bytes_per_sec               double precision,
    client_send_individual_msgs_per_sec   double precision,
    updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
```

Every `UPDATE` on `server_status` is mirrored into `server_status_history`
by the `record_server_status_history()` trigger, giving a complete audit
trail of stats and state transitions per server.

A partial index speeds up the load-balancing query:

```sql
CREATE INDEX idx_server_status_active_updated
    ON server_status (updated_at DESC)
    WHERE status = 'ReadyForClients';
```

## Lifecycle (`ServerStatusService`)

Located at `src/server-status/server-status.service.ts`. The service
implements `OnModuleInit` / `OnModuleDestroy` and uses `@nestjs/schedule`
for the recurring jobs.

| When                       | Action                                                                                                   |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| `onModuleInit`             | Run `cleanupStaleServers()` then `registerServer()`                                                       |
| `registerServer`           | Insert a row in `graphql_servers` with the host's IPv4/IPv6, status `Starting`, then bump to `ReadyForClients` |
| `@Cron(EVERY_10_SECONDS)`  | `updateServerStatus(ReadyForClients)` — heartbeat that bumps `updated_at` for this process               |
| `@Cron(EVERY_MINUTE)`      | `cleanupStaleServers()` — flips any `graphql_servers` row that has not heartbeated in >1 min to `Offline` |
| `@Cron(EVERY_MINUTE)`      | `cleanupStaleServerStatus()` — deletes `server_status` rows that have not heartbeated in >1 min          |
| `onModuleDestroy`          | `unregisterServer()` — sets this row to `Stopping`, then `Offline`                                       |

The 10-second heartbeat is what keeps a healthy process out of the stale
sweep. Note that the staleness threshold changed from the original 5
minutes to 1 minute to support faster failover.

## GraphQL API

All queries are auto-derived by `@nestjs/graphql` from
`src/server-status/server-status.resolver.ts`.

### `graphqlServers: [GraphQLServer!]!`

Returns every row in `graphql_servers`, ordered by `updated_at DESC`. No
authentication guard — used by infra dashboards.

```graphql
query {
  graphqlServers {
    graphqlServerId
    ip4
    ip6
    status
    createdAt
    updatedAt
  }
}
```

### `activeGraphQLServers: [GraphQLServer!]!`

Same shape as above, filtered to `status = ReadyForClients`.

```graphql
query {
  activeGraphQLServers {
    graphqlServerId
    ip4
    ip6
    status
    createdAt
    updatedAt
  }
}
```

### `versionInfo: ServerVersionInfo!`

Surfaces the current API build version and the minimum supported client
version (computed by `VersionInfoService`). Useful for clients that need to
gate features or prompt for upgrades.

```graphql
query {
  versionInfo {
    serverVersion
    minimumClientVersion
    # …additional fields exposed by ServerVersionInfo entity
  }
}
```

### `serverWithLeastClients: ServerStatus!`  *(authenticated)*

This is the **game server** picker, not a `graphql_servers` query. It is
included here because it lives in the same resolver and uses the shared
`server_state` enum.

Behavior:

1. Selects every `server_status` row where `status = 'ReadyForClients'`
   and `updated_at > now() - interval '11 seconds'` (i.e. the row has
   heartbeated within the last cycle).
2. Sorts ascending by `clients`, then descending by `updated_at`.
3. Takes the lowest-20%-by-client-count slice (always at least one row).
4. Picks one entry uniformly at random from that slice — this avoids the
   thundering-herd problem of always returning the absolute minimum.
5. If a `GameToken` is attached to the request, builds an HMAC-signed
   `P2P_TOKEN_AUTHORIZATION` (UDP message type 13) and sends it to the
   chosen server's IPv6 + `peer_port`. The HMAC secret comes from the
   `P2P_SECRET` config value; if it is missing, the server is still
   returned but no UDP notification is sent.
6. Throws `NotFoundException('No available servers found')` if step 1
   yields no rows.

Guarded by `TokenAuthGuard`. Requires a valid auth token, and behaves
differently depending on whether a `GameToken` is also present.

```graphql
query {
  serverWithLeastClients {
    serverId
    ip4
    ip6
    clientPort
    status
    clients
    peers
  }
}
```

## Implementation map

| Concern                          | File                                                              |
| -------------------------------- | ----------------------------------------------------------------- |
| `server_status` entity & enum    | `src/server-status/server-status.entity.ts`                       |
| `graphql_servers` entity         | `src/server-status/entities/graphql-server.entity.ts`             |
| Version info entity              | `src/server-status/entities/version-info.entity.ts`               |
| Lifecycle, cron jobs, queries    | `src/server-status/server-status.service.ts`                      |
| GraphQL resolver                 | `src/server-status/server-status.resolver.ts`                     |
| Network address detection        | `src/server-status/utils/network.utils.ts`                        |
| Version info service             | `src/server-status/services/version-info.service.ts`              |

## Graceful shutdown

`src/main.ts` traps `SIGTERM` / `SIGINT` (and uncaught exceptions /
unhandled rejections) and calls `app.close()` with a 5-second hard
timeout. `app.close()` triggers `OnModuleDestroy` on every module, so
`ServerStatusService.unregisterServer()` runs and the row is set to
`Offline` before the process exits.

## Operational notes

- **Heartbeat interval**: 10 seconds. Anything above ~30 seconds risks the
  cleanup job marking a healthy node `Offline` (cleanup threshold = 1 min).
- **History**: `server_status_history` grows unbounded and may need a
  retention policy in production.
- **Failure isolation**: every DB call inside the service is wrapped in
  `try/catch` and only logged. A registration failure must never prevent
  the API from coming up.
- **Multiple replicas**: each replica writes its own row. The `inet`
  detection picks the first non-loopback address per family, so behind a
  load balancer the registered IPs reflect the pod/container, not the
  externally routable address.
