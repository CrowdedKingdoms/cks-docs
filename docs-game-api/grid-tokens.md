---
sidebar_position: 26
title: Grid-scoped tokens
---

# Grid-scoped tokens

A **grid-scoped token** is an app token narrowed to one grid. Mint one when
you hand the SDK to code that should act inside a grid and nowhere else: a
player's JS grid program, a mod's host adapter, an agent working on a plot.

```graphql
mutation {
  mintGridToken(input: { appId: "…", gridId: "…", ttlSeconds: 900 }) {
    token
    lowChunk { x y z }
    highChunk { x y z }
    expiresAt
  }
}
```

- Minted **from an app token** you already hold (not a session token, not
  another grid token). The caller must own the grid or hold its
  `run_client_code` permission.
- Lives 60–3,600 s (default 900) and never outlives the app token it came from.
- It is an ordinary app token everywhere else, so every realtime and GraphQL
  path accepts it, and then the grid policy narrows it.

## What it can call

**Deny by default.** Only these root fields answer a grid token, and each is
confined as shown. Anything else returns `SCOPE_MISSING`.

| Confinement | Fields |
|---|---|
| Identity and transport | `me`, `versionInfo`, `gameClientBootstrap`, `serverWithLeastClients`, `connectUdpProxy`, `disconnectUdpProxy`, `udpProxyConnectionStatus`, `udpNotifications`, `actorHeartbeat` |
| Chunk inside the grid | `getChunk`, `getVoxelList`, `listVoxels`, `updateVoxel` |
| **Origin** chunk inside the grid (reach follows `distance`) | `sendActorUpdate`, `sendVoxelUpdate`, `sendTextPacket`, `sendClientEvent`, `sendAudioPacket`, `sendVideoPacket`, `sendSingleActorMessage` |
| The grid's own channels | `gridChannels`, `joinChannel`, `leaveChannel`, `sendChannelMessage` |
| Sessions hosted in the grid | `gameModelSessions` (must pass `gridId`), `gameModelCreateSession` (must pass `gridId`), `gameModelSession`, `gameModelSessionSnapshot`, `gameModelSessionChanged`, `gameModelJoinSession`, `gameModelLeaveSession` |
| The grid named | `playerModelContainers`, `playerModelContainer`, `playerModelCreateContainer`, `playerModelSetProperty`, `playerModelDeleteContainer`, `playerComputeInvoke`, `gridClientMods` |

`refreshAppToken`, `logout`, `mintGridToken` and `mintAppToken` are refused,
so a grid token can neither widen into nor tear down its parent.

## Realtime

The binary relay (`crowdy-relay-v1`) refuses a grid token; CrowdyJS falls
back to the GraphQL realtime path, where every send above is checked. Clients
that speak native UDP should not be handed grid tokens: a token lifted out of
a page can reach Buddy directly with the player's own app authority for the
rest of its life.

## From CrowdyJS

`client.grid(appId, gridId).mintToken()`, or let
[`hostGridProgram`](/crowdyjs/grid-programs) mint and refresh them for a
sandboxed program.
