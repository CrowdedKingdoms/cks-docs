# GraphQL Server Registration

This document describes how a **Game API** host registers itself on startup,
advertises liveness via a periodic heartbeat, and exposes registry queries over GraphQL.
It also covers **Buddy** replication server discovery via `serverWithLeastClients`.

:::info[Schema reference]

See the [GraphQL schema reference](/game-api/reference/graphql-overview) for `GraphQLServer`, `ServerStatus`, `ServerVersionInfo`, and related types.

:::

## Server states

Both GraphQL game API hosts and Buddy replication servers use the
`ServerState` enum exposed in the schema:

`Starting`, `ReadyForClients`, `Stopping`, `Offline`.

`GraphQLServer` rows may have nullable `ip4` / `ip6` when a host has no address
in that family. `ServerStatus` rows always include IPv4/IPv6, the client port,
load counters, and throughput stats used for load balancing.

## Lifecycle

The game API runs background jobs for registration, heartbeat, and cleanup.

| When              | Action                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| Startup           | Run stale cleanup, then register this process (`Starting` → `ReadyForClients`)                            |
| Every 10 seconds  | Heartbeat — keeps this host marked `ReadyForClients`                                                      |
| Every minute      | Mark game API hosts that missed heartbeats as `Offline`; drop stale Buddy registry rows                   |
| Shutdown          | `Stopping` → `Offline` so clients and load balancers stop routing new work here                           |

The 10-second heartbeat is what keeps a healthy process out of the stale
sweep. Note that the staleness threshold changed from the original 5
minutes to 1 minute to support faster failover.

## GraphQL API

The following queries are exposed on the game API schema.

### `graphqlServers: [GraphQLServer!]!`

Returns every registered game API host, ordered by `updatedAt` descending. No
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
version. Useful for clients that need to gate features or prompt for upgrades.

```graphql
query {
  versionInfo {
    serverVersion
    minimumClientVersion
    # …additional fields exposed by ServerVersionInfo
  }
}
```

### `serverWithLeastClients: ServerStatus!`  *(authenticated)*

This is the **Buddy server** picker (Replication API), not a game API host listing.

Behavior:

1. Considers Buddy servers in `ReadyForClients` with a fresh heartbeat.
2. Prefers less-loaded servers, with randomization among the least-loaded
   candidates so concurrent callers spread out instead of piling onto one host.
3. As a side effect, **registers the caller's UDP session** on the chosen
   server — see
   [Authenticate and assign](/replication-api/authenticate-and-assign) for the
   client-side contract (app-scoped token required, ~1.5 s settle before the
   first UDP send).
4. Errors with `No available servers found` when no server is currently
   eligible; retry after a short delay.

Requires a valid **app-scoped** token as the Bearer (an identity session token
is rejected and no session is registered).

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

## Graceful shutdown

On `SIGTERM` / `SIGINT` the process shuts down cleanly: the game API marks itself
`Offline` before exit so load balancers and clients stop routing new work to it.

## Operational notes

- **Heartbeat interval**: 10 seconds. Anything above ~30 seconds risks the
  cleanup job marking a healthy node `Offline` (cleanup threshold = 1 min).
- **History**: Buddy status history may grow unbounded in production; plan retention with your operator.
- **Failure isolation**: registration failures are logged but must never
  prevent the API from coming up.
- **Multiple replicas**: each replica writes its own row. Address detection
  picks the first non-loopback address per family, so behind a load balancer
  the registered IPs reflect the pod/container, not the externally routable
  address.
