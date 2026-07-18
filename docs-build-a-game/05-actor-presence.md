---
sidebar_position: 6
title: "05 — Actor presence"
slug: 05-actor-presence
---

# Actor presence

## Goal

Move a dot with the mouse and see other players' dots in realtime.

## Send loop

Send `sendActorUpdate` at ~10 Hz with your world X/Y encoded in actor `state` (see [Actor state layout](/build-a-game/reference-actor-state-layout)).

```ts
await client.udp.sendActorUpdate({
  appId: '1',
  chunk: { x: '0', y: '0', z: '0' },
  uuid: actorUuid,       // 32 UTF-8 bytes
  state: encodeActorState({ worldX, worldY, pushFlags: 0 }),
  sequenceNumber: seq,   // 0–255, wraps
});
```

> `client.udp.*` runs on the **app-scoped token** from chapters [2](/build-a-game/02-auto-guest-auth)–[3](/build-a-game/03-connect-and-bootstrap); the identity session token is rejected for gameplay.

## Receive

On `ActorUpdateNotification`, decode `state` and render a dot for each remote UUID (skip your own).

## Multiplayer test

Open two browser tabs. Each tab should show the other's dot within ~200 ms on the dev tier.

## Exit criteria

- Local dot follows mouse
- Remote dots visible in second window

Next: [Painting voxels](/build-a-game/06-painting-voxels)
