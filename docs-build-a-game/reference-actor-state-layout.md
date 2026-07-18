---
sidebar_position: 12
title: "Reference — Actor state layout"
---

# Actor state layout

Actor `state` is a base64-encoded binary blob (up to 96 bytes). This tutorial uses the first 17 bytes.

## Byte layout

| Bytes | Type | Field |
| --- | --- | --- |
| 0–7 | float64 LE | `worldX` (pixels) |
| 8–15 | float64 LE | `worldY` (pixels) |
| 16 | uint8 | Push bitfield (see below) |
| 17–95 | — | Reserved / unused |

## Push bitfield (byte 16)

| Bit | Value | Meaning |
| --- | --- | --- |
| 0 | 1 | Pushing north (dot at top edge) |
| 1 | 2 | Pushing south |
| 2 | 4 | Pushing east |
| 3 | 8 | Pushing west |

Multiple bits may be set (corner push).

## Encode example

```ts
const buf = new ArrayBuffer(96);
const view = new DataView(buf);
view.setFloat64(0, worldX, true);
view.setFloat64(8, worldY, true);
view.setUint8(16, pushFlags);
return btoa(String.fromCharCode(...new Uint8Array(buf)));
```

See [ActorUpdateRequestInput](/game-api/reference/graphql/types/inputs/actor-update-request-input) and [sendActorUpdate](/game-api/reference/graphql/operations/mutations/send-actor-update).
