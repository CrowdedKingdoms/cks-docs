---
sidebar_position: 5
title: "04 — Canvas coordinates"
slug: 04-canvas-coordinates
---

# Canvas coordinates

## Goal

Map canvas/world pixels to server chunk and voxel coordinates.

## Conventions

| Concept | Value |
| --- | --- |
| World unit | 1 pixel |
| Paint cell | 8×8 pixels (`TILE_SIZE`) |
| Server chunk | 16×16×16 voxels |
| Ground plane | `chunkZ=0`, `voxelZ=0` |

## Mapping

```
cellX = floor(worldX / TILE_SIZE)
cellY = floor(worldY / TILE_SIZE)
chunkX = floor(cellX / 16)
chunkY = floor(cellY / 16)
voxelX = cellX mod 16   (use positive modulo for negatives)
voxelY = cellY mod 16
```

## Example

World pixel (128, 64) → cell (16, 8) → chunk (1, 0), voxel (0, 8, 0).

Implement this as pure functions before adding network calls. Hover the canvas to verify the mapping interactively.

## Exit criteria

- Hover shows correct chunk and voxel for any position

Next: [Actor presence](/build-a-game/05-actor-presence)
