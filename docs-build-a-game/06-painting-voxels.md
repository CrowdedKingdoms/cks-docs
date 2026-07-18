---
sidebar_position: 7
title: "06 — Painting voxels"
slug: 06-painting-voxels
---

# Painting voxels

## Goal

Click to color a ground cell; paint persists and syncs to other clients.

## Send paint

On click, convert world position to chunk/voxel coords (chapter 4) and call:

> The `client.udp.*` and `client.voxels.*` calls in this chapter use the **app-scoped token** from chapters [2](/build-a-game/02-auto-guest-auth)–[3](/build-a-game/03-connect-and-bootstrap); the identity session token is rejected for gameplay.

```ts
await client.udp.sendVoxelUpdate({
  appId: '1',
  chunk: { x: String(chunkX), y: String(chunkY), z: '0' },
  uuid: actorUuid,
  voxel: { x: voxelX, y: voxelY, z: 0 },
  voxelType: paletteIndex,
  voxelState: base64Rgba,
  sequenceNumber: seq,
});
```

Color encoding: [Voxel color format](/build-a-game/reference-voxel-color-format).

## Receive

On `VoxelUpdateNotification`, update local canvas immediately.

## Hydrate on join

Load existing paint with `client.voxels.listByDistance`:

```ts
await client.voxels.listByDistance({
  appId: '1',
  centerCoordinate: { x: '0', y: '0', z: '0' },
  maxDistance: 3,
});
```

## Exit criteria

- Click paints a cell
- Reload shows prior paint
- Second client sees strokes live

Next: [Viewport edge scroll](/build-a-game/07-viewport-edge-scroll)
