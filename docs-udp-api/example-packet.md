---
sidebar_position: 9
title: Worked example packet
---

# Worked example packet

A byte-for-byte `ACTOR_UPDATE_REQUEST` (opcode `128`) you can reproduce, plus the
equivalent over the GraphQL UDP-proxy. This uses the
[long-spatial layout](/replication-api/wire-formats#long-form-spatial-message); all
integers are little-endian.

## Field values

| Field | Value | Notes |
|-------|-------|-------|
| messageType | `128` | `ACTOR_UPDATE_REQUEST`. |
| appId | `1` | int64. |
| chunkX / chunkY / chunkZ | `0` / `0` / `0` | int64 each. |
| distance | `8` | Chebyshev fan-out radius (0–8). |
| decayRate | `1` | `EXPONENTIAL`. |
| containsAuth | `0` | No HMAC in this example (see below to add one). |
| uuid | `0123456789abcdef0123456789abcdef` | 32 ASCII octets, no null terminator. |
| payload | *(empty)* | Actor registration with no state bytes. |
| gameTokenId | `42` | int64; the server overwrites this slot with `epochMillis` on outbound copies. |
| sequenceNumber | `1` | uint8; correlation only. |

Total length: **77 octets** (68-byte prefix + 0 payload + 9-byte tail; no HMAC).

## Hex dump

```
offset  0  1  2  3  4  5  6  7  8  9  a  b  c  d  e  f
0x00    80 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0x10    00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00
0x20    00 08 01 00 30 31 32 33 34 35 36 37 38 39 61 62
0x30    63 64 65 66 30 31 32 33 34 35 36 37 38 39 61 62
0x40    63 64 65 66 2a 00 00 00 00 00 00 00 01
```

Reading it back against the layout:

- `0x00` = `80` → messageType 128.
- `0x01..0x08` = `01 00 00 00 00 00 00 00` → appId 1.
- `0x09..0x20` = all `00` → chunkX/Y/Z all 0 (each int64 spans into the next row).
- `0x21` = `08` → distance 8; `0x22` = `01` → decayRate 1; `0x23` = `00` → containsAuth 0.
- `0x24..0x43` = `30 31 32 33 ...` → the 32 ASCII bytes of the uuid (`"0123...cdef"`).
- payload is empty (containsAuth 0, so no HMAC follows).
- `0x44..0x4b` = `2a 00 00 00 00 00 00 00` → gameTokenId 42.
- `0x4c` = `01` → sequenceNumber 1.

## Adding the HMAC (production)

Auth-gated messages set `containsAuth = 1` and insert a 32-byte HMAC-SHA256 immediately
**after the payload** (before the gameTokenId/seq tail), making the minimum length
**109 octets**. The HMAC key is your 64-octet **app-scoped token** (from `mintAppToken` / `exchangePortalCode`, not the session token); the signed input is every byte
from offset 0 through the end of the payload, concatenated with the 64 token octets. See
[HMAC](/replication-api/hmac). A message with a missing or wrong HMAC may be **dropped
with no reply** — see [Error codes](/overview/error-codes#native-udp-silent-drops).

## The same thing over the GraphQL proxy

Browser/JS and most server integrations send the equivalent through the Game API
UDP-proxy instead of building bytes — `state` is base64 and no HMAC is needed:

```graphql
mutation { sendActorUpdate(input: {
  appId: "1",
  chunk: { x: "0", y: "0", z: "0" },
  uuid: "0123456789abcdef0123456789abcdef",
  distance: 8, decayRate: 1, sequenceNumber: 1
}) }
```

See [Send and receive](/replication-api/send-and-receive) for the native flow and
[GraphQL UDP-proxy API](/game-api/graphql-udp-proxy-api) for the proxy flow.
