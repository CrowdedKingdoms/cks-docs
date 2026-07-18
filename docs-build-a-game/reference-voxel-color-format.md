---
sidebar_position: 11
title: "Reference — Voxel color format"
---

# Voxel color format

This tutorial uses the following encoding for painted ground cells on `chunkZ=0`, `voxelZ=0`.

## Fields

| Field | Type | Purpose |
| --- | --- | --- |
| `voxelType` | int | Palette index (1–255). 0 = empty/unpainted |
| `voxelState` | base64 string | 4 bytes: `[R, G, B, A]` |

## Encode (TypeScript)

```ts
function rgbaToVoxelState(r: number, g: number, b: number, a: number): string {
  const bytes = new Uint8Array([r, g, b, a]);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}
```

## Decode

```ts
function voxelStateToRgba(voxelState: string): { r: number; g: number; b: number; a: number } {
  const binary = atob(voxelState);
  return {
    r: binary.charCodeAt(0),
    g: binary.charCodeAt(1),
    b: binary.charCodeAt(2),
    a: binary.charCodeAt(3),
  };
}
```

## Default palette

| voxelType | Color |
| --- | --- |
| 1 | Red `#e74c3c` |
| 2 | Blue `#3498db` |
| 3 | Green `#2ecc71` |
| 4 | Yellow `#f1c40f` |
| 5 | Purple `#9b59b6` |

See [VoxelUpdateRequestInput](/game-api/reference/graphql/types/inputs/voxel-update-request-input) and [sendVoxelUpdate](/game-api/reference/graphql/operations/mutations/send-voxel-update).
