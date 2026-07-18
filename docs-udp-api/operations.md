---
sidebar_position: 7
title: Operations
---

# Operations

## Recommended waits

| Event | Minimum | Recommended |
|-------|---------|-------------|
| After `serverWithLeastClients` | 1.0 s | 1.5 s |
| After first actor registration | 0.2 s | 0.5 s |
| Actor heartbeat | — | every 4 s |
| Any client traffic | — | every 60 s |

## Common error codes

Delivered as `GENERIC_ERROR_MESSAGE` (type `3`) with echoed sequence. Names below
match the current wire enum; the `MAP_*` forms are legacy aliases.

| Code | Name | Typical cause |
|------|------|----------------|
| 5 | `INVALID_TOKEN` | Malformed token material, or not a valid app-scoped token |
| 6 | `APP_NOT_FOUND` | Unknown app (formerly `MAP_NOT_FOUND`) |
| 7 | `UNAUTHORIZED` | Permission denied — no active app access / tier permission, or no grid permission for the target chunk (see Permissions below) |
| 13 | `GAME_TOKEN_WRONG_SIZE` | Malformed token material |
| 15 | `INVALID_REQUEST` | Wire layout or field error |
| 18 | `INVALID_APP_ID` | Not authorized for this app — unknown app **or the token is scoped to a different app** (app-scope mismatch) |
| 20 | `USER_NOT_AUTHENTICATED` | Session not ready (or not an app-scoped token) — `mintAppToken`, call `serverWithLeastClients`, wait ~1.5 s, retry |
| 32 | `TOKEN_EXPIRED` | The app-scoped token passed its `expiresAt` — Buddy evicted the session. Mint a fresh token (`refreshAppToken` for the same app) and re-assign |

## Permissions (always enforced)

Every spatial message is authorized on the server. The sender must have **active
app access** whose tier includes the relevant permission key (`access` to
move/send events, `update_voxel_data` to edit voxels, `use_voice_chat` for audio)
**and** the target chunk must be inside a **grid** where the sender holds that
key. A message failing either check is dropped and answered with
`GENERIC_ERROR_MESSAGE` / `UNAUTHORIZED` (code 7).

New apps are **open by default** — they ship with a default tier granting all
permissions and a world-spanning default grid, and granting a player app access
automatically grants them all grid permissions — so out of the box any entitled
player can act anywhere. App owners opt into restrictions (safe zones, plot
ownership) via the Game API. See
**[Game API → Permissions overview](/game-api/permissions)** and
**[Grids and permissions](/game-api/grids-and-permissions)**.

> The first message to a brand-new chunk region may briefly return `UNAUTHORIZED`
> while the server loads that region's grid permissions; retry and it succeeds.

## App suspended or over budget

If an app is **runtime-denied** — suspended, out of wallet funds, or over a spend
cap on the shared environment — the server refuses to authorize its game tokens,
so session setup fails and spatial sends come back `UNAUTHORIZED` /
`USER_NOT_AUTHENTICATED`. This is a billing/runtime state, not a client bug:
resolve it on the management API (fund the wallet, raise the cap, or renew). See
**[Shared environment & billing](/management-api/shared-environment)**.

## Server reassignment

If Buddy restarts, evicts your session, or you need a different host:

1. Call `serverWithLeastClients` on the Game API again (`refreshAppToken` first if
   the app token is near `expiresAt`).
2. Wait **~1.5 s** for the session to be ready.
3. Resume UDP with the same app-scoped token on the new host and `clientPort`.

## Load shedding — `COMMAND_RECONNECT` (type 22)

A server protects itself when it runs hot. If a CPU core or system memory stays
high for several seconds, the server reports `NearCapacity` (so the Game API
stops sending it **new** clients) and, if pressure continues, `Full` — at which
point it sheds some existing clients to recover. A shed client receives a small
server→client datagram:

```
[1B type=22][32B HMAC]
```

The 32-byte HMAC is **HMAC-SHA256 keyed on your 64-octet app-scoped token** (the
same token you use to sign your spatial messages) over the single type byte. Because
only you and the server hold that token, a matching HMAC proves the command came
from the server — **verify it and ignore the datagram if it does not match.** When
you receive a valid `COMMAND_RECONNECT`, follow the **Server reassignment** steps
above: re-query `serverWithLeastClients` (it will not return the overloaded
server) and move your session to the returned host. The losing server keeps
serving you for a short grace period (≈5 s) and then deletes your session and
ignores further packets, so reconnect promptly. There is no reply to send, no
sequence number to echo, and no reason field; it is a one-shot directive.

> Native (direct-UDP) clients should verify the HMAC and handle type `22`.
> **[Browser clients](#browser-clients)** using the GraphQL UDP proxy are moved
> automatically by the proxy (which verifies the HMAC) and never see this message.

## Browser clients

Use the **[GraphQL UDP proxy](/game-api/graphql-udp-proxy-api)** instead of raw UDP.
