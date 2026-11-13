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

The Studio agent is not a GraphQL operation at all: it runs in the player's
browser and spends tokens through the REST `POST /v1/model/chat/completions`
endpoint with the player's app token. Browser games mount it with CrowdyJS's
`dsh` option rather than exposing GraphQL to a model. See
[Agentic Crowdy Studio and the model endpoint](agentic-crowdy-studio).

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
1–8, Chebyshev), or in a box between two corner chunks (`lowChunk`, `highChunk`, inclusive,
at most 4,913 chunks; Game API v2.67.0):

```graphql
query Chunks($input: GetChunksByDistanceInput!) {
  getChunksByDistance(input: $input) {
    chunks {
      coordinates { x y z }
      updatedAt
      voxelsUpdatedAt
      voxels
      voxelStates { voxelCoord { x y z } voxelType state updatedAt }
    }
    limit
    skip
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

Pages are stable: a cube's chunks come back nearest the center first and a box's in coordinate
order, ties broken by coordinates, and the response echoes the `limit` and
`skip` it applied (`limit` defaults to 1,000), so read the next page with `skip + limit` until a
page comes back shorter than `limit`. When a player steps one chunk along an axis, read only
the slab the step uncovers as a box: at range 8 that is 289 chunks, not 4,913. Add `since` to
read only chunks written since then (their grid, state or LODs; a single voxel edit does not move
a chunk's `updatedAt`), and read the voxel edits since then with `listVoxelUpdatesByDistance`,
which takes the same cube or box and `since`. It also returns the edits recorded for a chunk the
server never stored as a grid, which neither chunk read returns: a player's edit in a fresh chunk
is recorded, and needs no whole-chunk write to survive a reload. `listVoxels` pages one chunk's
edits by position (`limit` up to 65,536, `skip`). The edit log keeps one row per voxel position,
its latest write, so a chunk's answer is bounded by the positions ever edited in it, not by its
history.

**A whole-chunk write wins** (Game API v2.70.0). `updateChunk`, and a mod's `world.set_chunk`,
replace the chunk as a whole: every voxel edit recorded for it at or before the write is
superseded and removed, so the chunk reads back exactly as written. `voxelsUpdatedAt` says when
that was. A chunk-state or LOD write moves only `updatedAt` (which `since` reads), not
`voxelsUpdatedAt`. A chunk not written whole since v2.70.0 has a null `voxelsUpdatedAt`, and an
edit recorded at any time still shows over its grid there, as before. Because a whole-chunk
write overwrites, a client that saves a grid it read earlier erases the edits other players made
since that read: read the chunk again, or merge, before writing it back.

Each voxel state's `updatedAt` (Game API v2.69.0) is when the server recorded that value: the
edit's time for a recorded edit, and for a state stored with the chunk, its `voxelsUpdatedAt`
(the chunk's last write when that is null). An edit's `createdAt` in
`listVoxelUpdatesByDistance` is the same time. A client that keeps a cache can merge by it: apply
a change only when it is at least as new as the value held, and treat a voxel with no entry as
written at `voxelsUpdatedAt`. Since replication server v0.46.0 a realtime edit is recorded with
the moment the replication server accepted it, so a voxel notification's `epochMillis` and the
recorded time of the same edit come from one clock (the notification's is a moment later). The
SDKs' chunk stores merge this way (CrowdyJS 18.31.0, CrowdyCPP 0.84.0, CrowdyPy 0.32.0; dated by
`voxelsUpdatedAt` since CrowdyJS 18.32.0, CrowdyCPP 0.85.0 and CrowdyPy 0.33.0).

End the session with `mutation { disconnectUdpProxy }` when leaving the world.
Unsubscribing alone stops delivery but does not close the server-side session.
