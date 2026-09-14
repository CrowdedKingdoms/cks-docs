---
sidebar_position: 5
title: Replication server assignment
---

# Replication server assignment

Native UDP clients ask the Game API for a **Buddy** replication server, then
send spatial traffic to the host and port it returns. Browser clients use the
[GraphQL UDP proxy](/game-api/graphql-udp-proxy-api) instead and never call
this assignment path.

See the [GraphQL schema reference](/game-api/reference/graphql-overview) for
`ServerStatus`, `ServerVersionInfo`, and `GameClientBootstrap`.

## `serverWithLeastClients` (authenticated)

This is the Buddy picker. It is **not** a listing of Game API hosts.

1. The API chooses a ready replication server for your app's datacenter.
2. It **registers your UDP session** on that server. You still wait about
   **1.5 seconds** before the first UDP send — see
   [Authenticate and assign](/replication-api/authenticate-and-assign).
3. If no server is eligible, the call fails; retry after a short delay.

Requires a valid **app-scoped** token as the Bearer. An identity session
token is rejected and no session is registered.

```graphql
query {
  serverWithLeastClients {
    serverId
    ip4
    ip6
    clientPort
    status
    clients
  }
}
```

Use the returned address and `clientPort` for UDP. Sign packets with the
same app-scoped token — [HMAC](/replication-api/hmac). If the server asks
you to move (`COMMAND_RECONNECT`), call `serverWithLeastClients` again —
[Operations](/replication-api/operations#server-reassignment).

If the call lands on a datacenter that does not hold your app, handle
`WRONG_DATACENTER` by reconnecting to `extensions.gameApiUrl`. See
[Datacenters and endpoint routing](/game-api/datacenter-routing).

## Version and client bootstrap

`versionInfo` reports the API build and the minimum client version. Use it
to gate features or prompt for an upgrade.

```graphql
query {
  versionInfo {
    serverVersion
    minimumClientVersion
  }
}
```

`gameClientBootstrap(appId)` is the usual first Game API read after you
mint an app token. It returns spatial limits, realtime protocol details,
`versionInfo`, and the **`gameApiUrl` / `gameApiWsUrl` / `discoveryUrl`**
for this app. Call it against those URLs for later gameplay. Copy-paste
example: [Example operations](/game-api/examples#1-per-app-bootstrap).
