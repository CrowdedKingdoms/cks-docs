---
sidebar_position: 6
title: Send and receive
---

# Send and receive

Prerequisites: **[Authenticate and assign](/replication-api/authenticate-and-assign)**
completed and **~1.5 s** elapsed since `serverWithLeastClients`. The "game token"
used below for every HMAC is your **app-scoped token** (from `mintAppToken` /
`exchangePortalCode`) — refresh it before `expiresAt` or Buddy drops the session
with `TOKEN_EXPIRED`.

## Send your first spatial message

Target Buddy **`clientPort`** (from assignment, typically `9091`).

Send **`ACTOR_UPDATE_REQUEST_2`** (type `128`) with:

- `containsAuth = 1`
- Valid chunk coordinates and **app ID** (int64 in the spatial header — see [Wire formats](/replication-api/wire-formats))
- 32-byte client UUID
- HMAC tail per **[HMAC](/replication-api/hmac)**

This registers your chunk position and validates your token.

## Ongoing client traffic

- Prefer authenticated messages until your session is stable.
- Re-send actor updates about every **4 s** — actors not updated for **~5 s** may be evicted.
- When the actor is **idle** (not moving), keep it alive cheaply with a `CLIENT_ACTOR_HEARTBEAT` (type `26`) instead of a full actor update — it refreshes only your own actor's presence (no fan-out). See **[Actor presence and heartbeats](/replication-api/wire-formats#actor-presence-and-heartbeats)**. Cross-server visibility is maintained by the server automatically; you only ever talk to your own server.
- Any client traffic at least every **60 s** — silence beyond **~120 s** may evict the session.

Beyond broadcast spatial traffic you can also send **direct actor-to-actor
messages** (`SINGLE_ACTOR_MESSAGE`, type `142`) and **channel messages**
(`CHANNEL_MESSAGE_REQUEST`, type `17` — app-wide, not chunk-routed). Both are
detailed in **[Wire formats](/replication-api/wire-formats)**.

## Receive notifications

Buddy fans out on the **same UDP socket** you send from.

1. Request types become notification types (128→130, 131→133, …).
2. Notifications are **signed**: `containsAuth = 1` with a 32-byte HMAC-SHA256 keyed
   on your game token. **Verify it** and drop any long-spatial notification whose HMAC
   doesn't match — see **[HMAC](/replication-api/hmac)**.
3. The 8-byte tail holds **epoch millis** instead of `gameTokenId` (not part of the HMAC).
4. Sequence byte is preserved from the sender.

Parse **`MESSAGE_BUNDLE`** (type `2`) when the first byte is `2` — see
**[Wire formats](/replication-api/wire-formats)**.

## Errors on the same socket

`GENERIC_ERROR_MESSAGE` (type `3`) includes your sequence number for correlation.
See **[Operations](/replication-api/operations)** for common codes and timing.

## Reconnect commands on the same socket

If the first byte is **`22`** (`COMMAND_RECONNECT`), the server is shedding load
and wants you to move. The datagram is `[1B type=22][32B HMAC]`, where the HMAC is
HMAC-SHA256 over the type byte keyed on your game token — **verify it** (it proves
the command is from the server), then re-query `serverWithLeastClients` and
reconnect with the same game token to the new host. You have a short grace period
(≈5 s) before the losing server drops your session. See
**[Operations → Load shedding](/replication-api/operations)**. (Browser clients on
the UDP proxy are migrated automatically and never receive this.)
