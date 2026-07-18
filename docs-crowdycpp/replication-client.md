---
slug: replication-client
sidebar_position: 4
title: Replication client
---

# Replication client

`client.replication()` is CrowdyCPP's native implementation of the public
[Replication API](/replication-api/intro). It owns the socket, the signing,
the verification, and the connection lifecycle; your game sees typed sends
and typed notification callbacks. This page describes behavior — for the
byte-level layouts, use the canonical references:
[Wire formats](/replication-api/wire-formats) and
[HMAC](/replication-api/hmac).

## Connect and server assignment

`connect()` performs the flow from
[Authenticate and assign](/replication-api/authenticate-and-assign):

1. Hold an **app-scoped token** (the 64-octet token doubles as the HMAC key).
2. Call **`serverWithLeastClients`** on the Game API. This has a side
   effect: it **installs your UDP session server-side** on the assigned
   replication server.
3. Wait for **session-ready**. Session install is asynchronous on the server,
   so the client waits (default **1.5 s**, `Config::sessionReadyWaitMs`)
   before the state flips from `Connecting` to `Connected`. Traffic sent
   before the session is installed is silently dropped — this wait is not
   optional politeness.
4. Exchange signed UDP traffic with the returned host and client port
   (IPv4 by default; `Config::preferIpv6` opts into the IPv6 address).

Connection state (`Idle` → `Connecting` → `Connected`, with `Reconnecting` /
`Failed` / `Closed`) surfaces through a status callback and `state()`.

## Sends

All sends are **HMAC-SHA256 signed** per the [HMAC guide](/replication-api/hmac),
thread-safe, and never throw — they return a `crowdy::Result` carrying the
message's **sequence number**:

- `sendActorUpdate` — spatial actor state
- `sendVoxelUpdate` — voxel edits
- `sendAudio` / `sendText` — spatial audio and text packets
- `sendClientEvent` — typed client events (`eventType` + state bytes)
- `sendGenericSpatial` — generic spatial payloads
- `sendSingleActorMessage` — direct message to one actor (fire-and-forget,
  no echo; embed sender identity in the payload if the recipient needs it)
- `sendChannelMessage` — publish to a channel (membership + `send_messages`
  enforced server-side)
- `sendHeartbeat` — idle keep-alive for your own actor (send every ~2 s while
  idle so presence never lapses)

Payload bytes are copied into a pooled send buffer during the call, so they
need not outlive it.

## Receive path

Inbound datagrams are processed on the network side and dispatched on your
game thread:

- **Bundle unpacking** — a single datagram can carry multiple notifications;
  the client unpacks them.
- **Per-notification HMAC verification** — server-signed notifications are
  verified in constant time and mismatches are dropped (counted in
  `stats().hmacFailures`; `Config::verifyNotifications` disables this for
  benchmarking only).
- **Typed dispatch** — a `Handlers` struct with one callback per notification
  kind (actor update, voxel update, audio, text, client/server event, generic
  spatial, single-actor message, channel message, generic error, status).
- **Error frames** — server-reported failures arrive as generic-error
  notifications **correlated by sequence number** to the send that caused
  them.

Notification payloads are **spans into the receive buffer** — valid only
during the callback. Copy anything you keep.

## Threading modes

- **Owned net thread** (default). The SDK runs one receive/send thread and
  hands you parsed notifications through a lock-free ring; you drain it with
  `poll()` from your game thread. Callbacks always fire on the thread that
  calls `poll()` — never on the network thread.
- **Manual pump** (`Config::manualPump`). The SDK spawns **no threads**. You
  call `pump()` from your own network thread (or your tick) to do the socket
  work, and `poll()` from the game thread to dispatch callbacks. This is the
  mode [engine wrappers](/crowdycpp/engine-integration) use.

## Lifecycle: refresh, reconnect, watchdog

The connection manages its own health so gameplay code doesn't have to:

- **Proactive token refresh.** The app-scoped token expires; the client
  refreshes it through the session provider ahead of expiry
  (`Config::refreshLeadMs`, default 5 minutes) and rotates the HMAC key.
- **Verified `COMMAND_RECONNECT`.** A server under load can ask the client to
  move. The command's HMAC is verified as server-originated, then the client
  re-assigns via `serverWithLeastClients` within the grace period. See
  [Operations](/replication-api/operations).
- **Silent-drop watchdog** (opt-in, `Config::watchdogSilenceMs`). The
  protocol's documented failure mode is that auth failures are often
  **silent drops** — sends flow out, nothing comes back. If enabled and
  traffic has been received before, prolonged one-way traffic triggers
  reassignment. It is off by default because a lone player in an empty area
  legitimately receives nothing. See
  [Troubleshooting](/replication-api/troubleshooting).

Reconnects and drop counters are visible in `stats()` (datagrams sent and
received, HMAC failures, malformed frames, ring drops, reconnects).

## AndWait correlation

UDP is best-effort and sequence numbers are correlation, not idempotency. For
request/confirm flows CrowdyCPP offers the same convenience CrowdyJS's
`*AndWait` methods provide:

- `sendActorUpdateAndWait` / `sendVoxelUpdateAndWait` — wait (pumping and
  polling internally; other handlers still fire) until the send's **self-echo
  notification** arrives, a correlated error frame arrives, or the timeout
  elapses.
- `sendTextAndWait` — text (like audio and client events) has **no echo**;
  only errors correlate. A clean timeout therefore means *accepted*.
- `waitForSequence` — the low-level primitive: wait on any sequence + uuid.

The outcome reports `acknowledged`, the correlated error code if any, and the
server epoch-millis from the echo.

## Errors

The replication layer **never throws on the hot path**: sends return
`Result` codes, server failures arrive as correlated error notifications, and
connection changes surface through the status callback. GraphQL-layer
operations (assignment, token mint/refresh) throw the structured exception
types shared with the rest of the SDK — branch on `error.code()` rather than
parsing messages.

## Next

Most games should not drive `Connection` by hand — the
[World session](/crowdycpp/world-session) layer packages the send loop,
registries, and caches on top of it.
