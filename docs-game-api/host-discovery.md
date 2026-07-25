---
sidebar_position: 23
title: Host discovery
---

# Host discovery

The Game API elects a single **host user** per app (game). Every connected client that asks with the same `appId` gets the same answer at the same moment, so clients can agree on which user is currently the "host."

Two read paths exist:

| API | Returns | Use when |
| --- | --- | --- |
| **`gameHost`** | The elected host (`hostUserId`, …), or `null` | You need the host's user id (or actor-count metadata). |
| **`amIGameHost`** | `Boolean!` — whether **the authenticated caller** is that host | You only need a yes/no for the current client (UI convenience). |

CrowdyJS wraps both as `client.host.get(appId)` and `client.host.amIHost(appId)`.

:::note[Actor count is not active player count]
`gameHost.actorCount` counts actors owned by the elected host. It is not app
concurrency. For the app-wide gauge of active app-scoped gameplay sessions,
use
[`gameModelActivePlayerCount`](game-models#active-player-count-app-scoped-sessions);
that gauge is neither a distinct-user count nor a host/actor count.
:::

:::important[UI convenience vs authoritative gating]
`gameHost` / `amIGameHost` (and CrowdyJS `client.host.*`) are **informational**. The Game API does not gate other operations on host status from these queries, and Buddy does not validate UDP messages against the host UUID.

For **authoritative** host-only game logic, use a `gameModelInvoke` function with an **`is_host`** invoke policy — the server enforces that. See **[Game models → Authority](game-models#authority-deciding-who-may-invoke-a-function)**.
:::

## When to use it

Use host discovery whenever you need every connected client to independently arrive at the same answer to "which one of us is the host right now?" — for example so exactly one client runs a piece of UI logic, or so every client knows who to direct a request to.

Prefer **`amIGameHost` / `client.host.amIHost`** when the only question is "am *I* the host?" Prefer **`gameHost` / `client.host.get`** when you need the host's `userId` (or to compare against another user).

## CrowdyJS: `client.host`

With an **app-scoped token** on the per-game client:

```ts
import { Client } from '@crowdedkingdoms/crowdyjs';

// Who is the host? (null when nobody is participating)
const host = await client.host.get(appId); // GameHost | null
console.log(host?.hostUserId, host?.actorCount);

// Am I the host? (false when you are not, or when no host is elected)
const iAmHost = await client.host.amIHost(appId); // boolean

// Keep yourself host-eligible and get the current host in one round-trip
const afterBeat = await client.host.heartbeat(appId); // GameHost | null
```

`amIHost` is the same election as `get` — it compares the bearer token's user to `hostUserId` on the server. You do not need to load `me` or compare ids yourself for the current caller.

## The queries

### `gameHost`

```graphql
query GameHost($appId: BigInt!) {
  gameHost(appId: $appId) {
    hostUserId
    actorCount
    earliestActorJoinedAt
  }
}
```

Variables:

```json
{ "appId": "42" }
```

Send `Authorization: Bearer <app-token>` on the request — the **app-scoped token** for this app (from `mintAppToken` / the portal flow), not the identity session token that sign-in returns. See **[Authentication](/game-api/authentication)**.

A typical response:

```json
{
  "data": {
    "gameHost": {
      "hostUserId": "1735",
      "actorCount": 2,
      "earliestActorJoinedAt": "2026-05-26T22:01:14.738Z"
    }
  }
}
```

`gameHost` returns **`null`** when no clients are currently participating in the app — for example, an empty world, or every player has been idle (not sending actor updates) for more than ~5 seconds.

### Response fields

| Field | Type | Meaning |
| --- | --- | --- |
| `hostUserId` | `BigInt!` | The `user_id` of the elected host. Stable while this user remains an active participant in the app. |
| `actorCount` | `Int!` | How many actors the host user currently owns in this app. Always `>= 1` when `gameHost` is non-null. |
| `earliestActorJoinedAt` | `DateTime!` | When the host's longest-running actor first began participating in this app. |

### `amIGameHost`

```graphql
query AmIGameHost($appId: BigInt!) {
  amIGameHost(appId: $appId)
}
```

```json
{ "data": { "amIGameHost": true } }
```

Returns **`true`** only when the authenticated caller is the currently elected host for that app. Returns **`false`** when someone else is host, or when no host is elected (`gameHost` would be `null`). Same auth and app-scope rules as `gameHost`.

Full type definitions: see `GameHost`, `gameHost`, and `amIGameHost` in the **[GraphQL schema reference](/game-api/reference/graphql-overview)**.

## Actor UUID vs user id

Host election is at the **user** level (`hostUserId`), not per actor wire-id.

- If you already know the local **user id** (from sign-in / `me`), compare it to `gameHost.hostUserId`, or call `amIGameHost` / `client.host.amIHost` for the current caller.
- If you only have an **actor UUID** (replication / UDP wire-id), resolve the owner first — e.g. `actor(uuid) { userId }` — then compare that `userId` to `hostUserId`. There is no `isGameHost(uuid)` boolean; actor identity and host identity are different layers. See **[Actor state](actor-state)**.

## How the host is elected

The host is **the user whose longest-running actor in the app has been participating the longest**. If two users tie on that, the tiebreaker is fully deterministic — every caller gets the same answer.

The election is a pure function of who is currently participating in the app, so **every Game API server returns the same answer** for the same `appId` at the same moment. You do not need to pin clients to a particular server or worry about cache divergence between replicas.

Reassignment is automatic: as soon as the current host stops participating (their last actor goes idle), the next call to `gameHost` / `amIGameHost` reflects the next-oldest user as the new host. There is no manual transfer step.

## Staying host-eligible: `actorHeartbeat`

A client stays a host candidate only while its actors are **fresh**. Freshness is refreshed by the **`actorHeartbeat`** mutation — call it on a short interval (every few seconds) for each app you are participating in:

```graphql
mutation ActorHeartbeat($appId: BigInt!) {
  actorHeartbeat(appId: $appId) {
    hostUserId
    actorCount
    earliestActorJoinedAt
  }
}
```

CrowdyJS: `client.host.heartbeat(appId)`.

`actorHeartbeat` returns the **same `GameHost` shape** as the `gameHost` query — the freshly-elected host *after* recording your heartbeat — so you can fold your poll and your heartbeat into a single round-trip and drop the separate `gameHost` query entirely.

Why this exists: the underlying actor record is created by the replication layer when you first move into the world and is normally removed a few seconds after you go idle. If a server drops a client ungracefully that record can be left behind and would otherwise keep winning the election forever. Heartbeating makes liveness explicit — a host that stops heartbeating (crash, network loss, app quit) ages out automatically and the next-oldest fresh user takes over.

- **You can't heartbeat your way into being host.** `actorHeartbeat` only refreshes records that already exist; the record itself is created by sending actor updates (native `ACTOR_UPDATE_REQUEST_2` or the GraphQL UDP proxy `sendActorUpdate`). Until you have done that, `actorHeartbeat` is a no-op and simply reports whoever the current host is.
- **Beat faster than the server's freshness window.** Every ~3 s is a good default. The window is operator-configured (`HOST_ACTOR_FRESHNESS_SECONDS`); beating several times within it means brief packet loss won't cost you host status.

## Important behaviors and limits

- **Up to ~5 s lag on disconnect.** A client that drops without warning continues to count as the host for up to about 5 seconds after their last actor update. Plan your client logic to tolerate the previous host appearing to linger briefly before the new host shows up.
- **"Participating" means "has sent at least one actor update".** Just authenticating does not make a client a host candidate — the client must have sent at least one `sendActorUpdate` mutation (GraphQL UDP proxy) or `ACTOR_UPDATE_REQUEST_2` packet (native UDP) since connecting. See **[GraphQL UDP Proxy API](/game-api/graphql-udp-proxy-api)** or the **[Replication API](/replication-api/intro)**.
- **No push notifications in v1.** There is no `hostChanged` subscription. Clients poll `gameHost` / `amIGameHost` on whatever cadence makes sense for the game (typically every few seconds when host-aware logic is active).
- **Granularity is per `app_id`.** Exactly one host per app, period. There is no sub-app key (room, match, lobby, etc.) in the Game API today; if your game needs finer-grained host election than one-per-app, you have to layer that on top yourself.
- **Token scope is enforced.** Gameplay tokens are always app-scoped: a token for one app cannot query `gameHost` / `amIGameHost` (or any Game API field) for a different app — the call returns `APP_SCOPE_MISMATCH` / `INVALID_APP_ID`. The identity session token is rejected entirely on the Game API.

## Common patterns

### Check whether the local client is the host (recommended)

```ts
import { Client } from '@crowdedkingdoms/crowdyjs';

const iAmHost = await client.host.amIHost(appId);
```

Raw GraphQL equivalent:

```ts
const result = await client.graphql.query({
  query: /* graphql */ `
    query AmIGameHost($appId: BigInt!) {
      amIGameHost(appId: $appId)
    }
  `,
  variables: { appId: appId.toString() },
});
const iAmHost = result.amIGameHost === true;
```

### Compare against a known user id

When you need the host's id (or to compare against someone other than the caller):

```ts
const host = await client.host.get(appId);
const isHost = host !== null && host.hostUserId === localUserId;
```

### Resolve actor UUID → user, then compare

```ts
const actor = await client.actors.get(actorUuid); // or GraphQL actor(uuid)
const host = await client.host.get(appId);
const actorOwnerIsHost =
  host !== null && actor?.userId != null && host.hostUserId === actor.userId;
```

For the **current** caller, prefer `amIHost` instead of resolving your own actor.

### Poll for host changes

There is no host subscription in v1. A simple poll loop is enough — the answer only changes when players connect, disconnect, or go idle, which happens on human timescales.

```ts
async function watchAmIHost(
  client: Client,
  appId: string,
  onChange: (iAmHost: boolean) => void,
) {
  let last: boolean | null = null;
  while (active) {
    const iAmHost = await client.host.amIHost(appId);
    if (iAmHost !== last) {
      onChange(iAmHost);
      last = iAmHost;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}
```

If you need the host user id on each change, poll `client.host.get` instead.

### Poll and heartbeat in one call

If the local client is itself a participant, prefer `client.host.heartbeat` (or the `actorHeartbeat` mutation) over a bare `gameHost` query: it refreshes your liveness and returns the current host in the same round-trip.

```ts
async function heartbeatAndGetHost(
  client: Client,
  appId: string,
): Promise<string | null> {
  const host = await client.host.heartbeat(appId);
  return host?.hostUserId ?? null;
}

// Call this on a short interval (e.g. every ~3 s) while participating.
```

### Reassignment when the host disconnects

You do not need to implement reassignment yourself. When the current host stops sending actor updates (deliberately or due to network loss), the next call to `gameHost` / `amIGameHost` (after up to ~5 s) reflects a new host. A host that drops *ungracefully* — leaving a stale actor record behind — also ages out automatically once it stops heartbeating (governed by the server's `HOST_ACTOR_FRESHNESS_SECONDS` window). During the brief gap, `gameHost` may still return the old host or may return `null` — treat that as a transient state and retry on the next poll.

## See also

- **[GraphQL schema reference](/game-api/reference/graphql-overview)** — auto-generated reference for every Game API operation, including `gameHost`, `amIGameHost`, and the `GameHost` type.
- **[Game models](game-models)** — authoritative `is_host` invoke policy on `gameModelInvoke`.
- **[Actor state](actor-state)** — `actor(uuid)` / ownership (`userId`) when you start from a wire-id.
- **[GraphQL UDP Proxy API](/game-api/graphql-udp-proxy-api)** — how a browser/JS client registers an actor so it becomes a host candidate.
- **[Replication API](/replication-api/intro)** — the native UDP path; sending `ACTOR_UPDATE_REQUEST_2` is what registers a client as participating in the world, making them a host candidate.
- **[Authentication](/game-api/authentication)** — bearer token requirements and token scope.
