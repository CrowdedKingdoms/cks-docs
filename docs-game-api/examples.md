---
sidebar_position: 6
title: Example operations
---

# Example operations

Copy-paste examples for the most common Game API flows, each with variables and a
representative response. Field shapes are authoritative in the
[GraphQL reference](/game-api/reference/graphql-overview) and the
[Game API SDL](pathname:///schema/game-api.graphql). For the higher-level browser path see
[GraphQL UDP-proxy API](/game-api/graphql-udp-proxy-api); for the agent overview see
[For AI agents](/overview/for-ai-agents).

> Responses below are representative. The Game API accepts an **app-scoped token**
> (mint one for the app with `mintAppToken` from your identity session token — see
> **[Authentication](/game-api/authentication)**), not the session token `login`
> returns. Send it as `Authorization: Bearer <token>` on HTTP requests, and in the
> `graphql-transport-ws` `connection_init` payload for the subscription.

## 1. Per-app bootstrap

```graphql
query Bootstrap($appId: BigInt!) {
  gameClientBootstrap(appId: $appId) {
    appId
    realtimeProtocol
    subscriptionName
    maxReplicationDistance
    maxDecayRate
    sequenceNumberModulo
    udpProxyConnectionStatus { connected }
    versionInfo { minimumClientVersion }
  }
}
```

```json
{ "appId": "1" }
```

```json
{
  "data": {
    "gameClientBootstrap": {
      "appId": "1",
      "realtimeProtocol": "graphql-transport-ws",
      "subscriptionName": "udpNotifications",
      "maxReplicationDistance": 8,
      "maxDecayRate": 5,
      "sequenceNumberModulo": 256,
      "udpProxyConnectionStatus": { "connected": false },
      "versionInfo": { "minimumClientVersion": "1.0.0" }
    }
  }
}
```

## 2. Open the proxy and subscribe

`connectUdpProxy` is idempotent and takes no arguments. Subscribe with the same `appId`
you bootstrapped.

```graphql
mutation Connect { connectUdpProxy }

subscription Realtime {
  udpNotifications {
    __typename
    ... on ActorUpdateNotification {
      appId chunkX chunkY chunkZ uuid state distance decayRate sequenceNumber epochMillis
    }
    ... on GenericErrorResponse { sequenceNumber errorCode }
    ... on RealtimeConnectionEvent { status code message retryable }
  }
}
```

A nearby actor update arrives as:

```json
{
  "data": {
    "udpNotifications": {
      "__typename": "ActorUpdateNotification",
      "appId": "1",
      "chunkX": "0", "chunkY": "0", "chunkZ": "0",
      "uuid": "0123456789abcdef0123456789abcdef",
      "state": "AQID",
      "distance": 8, "decayRate": 1,
      "sequenceNumber": 7,
      "epochMillis": "1765600000000"
    }
  }
}
```

## 3. Send a spatial update

```graphql
mutation SendActorUpdate($input: ActorUpdateRequestInput!) {
  sendActorUpdate(input: $input)
}
```

```json
{
  "input": {
    "appId": "1",
    "chunk": { "x": "0", "y": "0", "z": "0" },
    "uuid": "0123456789abcdef0123456789abcdef",
    "state": "AQID",
    "distance": 8,
    "decayRate": 1,
    "sequenceNumber": 7
  }
}
```

```json
{ "data": { "sendActorUpdate": true } }
```

`true` means the datagram was accepted for sending — **not** that the world applied it.
The applied result fans out to nearby clients on `udpNotifications`; a failure arrives as
a `GenericErrorResponse` with the same `sequenceNumber` (here `7`). See
[Error codes](/overview/error-codes). `state` is base64-encoded app-defined bytes.

## 4. Read world data

`getChunksByDistance` loads chunks around a center within a chunk radius (`maxDistance`
1–8, Chebyshev):

```graphql
query Chunks($input: GetChunksByDistanceInput!) {
  getChunksByDistance(input: $input) {
    # See the SDL for the full response shape (chunks + the echoed limit/skip window).
    __typename
  }
}
```

```json
{
  "input": {
    "appId": "1",
    "centerCoordinate": { "x": "0", "y": "0", "z": "0" },
    "maxDistance": 2,
    "limit": 100,
    "skip": 0
  }
}
```

End the session with `mutation { disconnectUdpProxy }` when leaving the world.
Unsubscribing alone stops delivery but does not close the server-side session.
