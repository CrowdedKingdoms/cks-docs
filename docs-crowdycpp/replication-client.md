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
2. Call **`serverWithLeastClients`** on the Application API. This has a side
   effect: it **installs your UDP session server-side** on the assigned
   replication server.
3. Wait for **session-ready**. Session install is asynchronous on the server,
   so the client waits (default **1.5 s**, `Config::sessionReadyWaitMs`)
   before the state flips from `Connecting` to `Connected`. Traffic sent
   before the session is installed is silently dropped — this wait is not
   optional politeness.
4. Exchange signed UDP traffic with the returned host and client port
   (IPv4 by default; `Config::preferIpv6` opts into the IPv6 address). From 0.95.0 the
   connection also reaches a server that has an `ip6` alone: it opens its socket to
   `replication::connectAddress(server, preferIpv6)`.

Connection state (`Idle` → `Connecting` → `Connected`, with `Reconnecting` /
`Failed` / `Closed`) surfaces through a status callback and `state()`.

**A refused assignment says why** (0.95.0). `connect()` still answers one `Errc`.
`Connection::lastAssignmentFailure()` then holds an `ApiFailure`: the Application API's
refusal `code`, its `retryAfterMs`, and its `message`. When `failure.platformBusy()` is true,
wait `retryAfterMs` and connect again. `ReplicationClient::ConnectResult::failure` and
`GameSession::failure` hold the same, and `crowdy::startGameSession` waits that long between
its attempts when it is longer than `connectRetryDelayMs`. A session provider of your own
reports the reason through `ISessionProvider::assignServerOrSayWhy`.

## Sends

All sends are **HMAC-SHA256 signed** per the [HMAC guide](/replication-api/hmac),
thread-safe, and never throw — they return a `crowdy::Result` carrying the
message's **sequence number**:

- `sendActorUpdate` — spatial actor state
- `sendVoxelUpdate` — voxel edits
- `sendAudio` / `sendText` — spatial audio and text packets. A `SpatialSend` that leaves `distance` unset reaches 1 chunk for audio and video and 8 for everything else (0.88.0; before, 8 for every send)
- `sendVideoFrame` — one encoded webcam frame, cut into up to 16 fragments and sent as `CLIENT_VIDEO_PACKET_2` (143) each; `sendVideo` sends a single pre-built fragment. Needs `use_video_chat`; see [Webcam video](#webcam-video)
- `sendClientEvent` — typed client events (`eventType` + state bytes)
- `sendGenericSpatial` — generic spatial payloads
- `sendSingleActorMessage` — direct message to one actor (fire-and-forget,
  no echo; embed sender identity in the payload if the recipient needs it)
- `sendChannelMessage` — publish to a channel (membership + `send_messages`
  enforced server-side)
- `sendRangedChannelMessage(channelId, uuid, payload, origin, maxDistance)`
  (0.58.0+) — publish to a channel, delivered only to members with a live actor
  within `maxDistance` chunks of `origin` by straight-line distance, boundary
  included (`CHANNEL_MESSAGE_RANGED_REQUEST`, 32; see
  [the channels guide](/application-api/channels#limit-delivery-by-distance)). The origin's
  app is `Config::appId`; `maxDistance` is 0 to `wire::channel_ranged::kMaxDistance`
  (2147483647). Members receive an ordinary channel message
- `sendChannelAudio(channelId, uuid, payload)` (0.60.0+) — send audio to a channel
  (`CHANNEL_AUDIO_REQUEST`, 35; replication v0.37.0): every other member receives it in
  `Handlers::channelAudio` (or `WorldSessionConfig::onChannelAudio`), wherever they are.
  Needs the channel's `send_voice` and `use_voice_chat`; the payload is at most 1,024
  bytes, in any format (the `crowdy::media` voice helpers are optional)
- `sendHeartbeat`: idle keep-alive for your own actor (send every ~2 s while
  idle so presence never lapses). Since replication v0.37.0 idle players on different
  servers see each other from the first full update after joining, whatever the heartbeats.
  From replication v0.51.0 a keepalive is refused where the player has no `access`:
  see [A refused keepalive is reported once](#a-refused-keepalive-is-reported-once)

Payload bytes are copied into a pooled send buffer during the call, so they
need not outlive it.

### Bundled sends (0.37.0+)

By default the connection packs the messages you send within a short window into
one `MESSAGE_BUNDLE` datagram — the framing the server has always used for its
notifications, accepted on the uplink by replication server v0.27.0+
([wire formats](/replication-api/wire-formats#message-bundle-per-datagram)). Every
member is still a complete, individually signed message; only the datagram boundary
moves.

- `Config::bundleSends` (default `true`). `false` sends every message as its own
  datagram, synchronously from the calling thread — the pre-0.37 behaviour, and
  what to use against a server older than v0.27.0.
- `Config::bundleWindowMs` (default `1`). How long a pending bundle waits for more
  messages. The net thread (or `pump()`) flushes on expiry; the sending thread also
  flushes an expired bundle before appending to it. `0` flushes on the very next
  pass with no deliberate wait.
- The bundle also leaves when the next message would not fit (1232 bytes / 32
  members), on `Connection::flushSends()`, at the end of `WorldSession::tick()`,
  before any `*AndWait` starts waiting, and on `disconnect()` or reassignment. A
  lone message is sent unwrapped; a message too large for any bundle goes alone.
- With `Config::manualPump` nothing else flushes between your `pump()` calls, so
  call `flushSends()` at the end of your frame if you pump less often than you want
  datagrams out.
- `stats().bundlesSent` counts the datagrams that were wrappers (two or more
  members); `datagramsSent` can now be less than `messagesSent`.

## Receive path

Inbound datagrams are processed on the network side and dispatched on your
game thread:

- **Bundle unpacking** — a single datagram can carry multiple notifications;
  the client unpacks them.
- **Only what the realtime server signed for your app is delivered** (0.95.0). A
  long-spatial notification (actor and voxel updates, voice, video, text, events,
  single-actor messages, actor left, and chunk changed) reaches a handler when its own HMAC
  verifies with the player's token, or when it is a member of a signed bundle that verifies.
  Three kinds are dropped and counted:

  | A notification | Counted in |
  |---|---|
  | whose HMAC does not verify | `stats().hmacFailures` |
  | that nothing signed | `stats().unsignedNotifications` |
  | that names another app than `Config::appId`, however it was signed | `stats().wrongApp` |

  A dropped notification reaches no handler, counts as no received message, and answers no
  `*AndWait`. The realtime servers sign every long-spatial notification they send a session,
  and send a session only its own app's, so the last two counts stay 0. If one moves, tell
  Crowded Kingdoms: the SDK's log line names the app, the message type, and the chunk.
- **What still arrives without a signature of its own.** Channel messages, channel audio, and
  error frames have no room for an HMAC, so they are delivered as before, alone or in a
  bundle.
- **`Config::verifyNotifications = false`** delivers a notification that nothing signed, and
  one with a wrong HMAC. Set it only for a server of your own that sends the connection
  notifications it does not sign. A connection whose `Config::appId` is 0 compares no app.
- **One receive pass reads 1,024 datagrams at most** (`kReceivePassDatagrams`, 0.95.0). A
  pass used to end only when the socket was empty, so `pump()` did not return while datagrams
  arrived faster than the connection verified them. `pump()` returns the number it processed:
  to read everything that is waiting, call it until it returns less than 1,024.
- **Typed dispatch** — a `Handlers` struct with one callback per notification
  kind (actor update, voxel update, audio, **video**, text, client/server
  event, generic spatial, single-actor message, channel message,
  **actorLeft** with its `reason` byte, generic error, status).
- **Error frames.** Server-reported failures arrive as generic-error
  notifications **correlated by sequence number** to the send that caused
  them. `GenericError::verified` (0.95.0) is true only for a frame inside a signed bundle
  that verified. The realtime servers send a player's session each error frame alone, as 3
  bytes with no HMAC, so it is false there. `GenericError::keepalive` is true for a frame
  that answers a keepalive.

Notification payloads are **spans into the receive buffer** — valid only
during the callback. Copy anything you keep.

**Receive speed.** The checks of 0.95.0 cost a player's connection under 4% against 0.93.0.
`benchmarks/bench_receive.cpp` in the repository measures one connection that reads, verifies,
and dispatches loopback bundles of 6 signed actor updates of 64 bytes, on one pinned core of
our build machine, in a Release build (the fastest of 300 rounds of 1,000 datagrams, over 5
runs). It read 2.07 to 2.16 million notifications a second in 0.93.0, 1.72 to 1.82 million in
0.94.1, and 2.02 to 2.07 million in 0.95.0. Your machine and your notifications will give
other numbers: run the benchmark to see yours.

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
- **`TOKEN_EXPIRED` reassigns only when it is verified** (0.95.0). Through 0.94.1 any
  `TOKEN_EXPIRED` frame reassigned the connection, and that frame is 3 unsigned bytes on a
  player's session. Now only one inside a signed bundle that verifies reassigns. For an
  unverified one, the connection asks its session provider for a fresh token
  (`refreshToken`), at most once every 30 seconds (`kTokenCheckIntervalMs`), and reassigns
  only if the answer says the current server does not know the new token.
  `stats().unverifiedTokenExpired` counts them. Either kind still reaches
  `Handlers::genericError` and settles the `*AndWait` whose sequence number it names. With
  `Config::refreshLeadMs = 0` the connection asks nothing: call
  `connection.requestReassignment()` from `Handlers::genericError` when the code is
  `TokenExpired`, after your own token refresh.
- **`disconnect()` returns whatever is arriving** (0.95.0). The network thread stops at the
  16 datagrams it has in hand (`kReceiveBatchDatagrams`), so `disconnect()` returns within 100
  milliseconds unless the session provider is in the middle of a call.
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

Reconnects and drop counters are visible in `stats()` (datagrams and messages
sent and received, bundles sent, HMAC failures, malformed frames, ring drops,
reconnects, and from 0.95.0 `unsignedNotifications`, `wrongApp`,
`unverifiedTokenExpired`, `keepalivesRefused`, and `notPresentReports`).

## A refused keepalive is reported once

From replication server v0.51.0, a keepalive (`sendHeartbeat`, `CLIENT_ACTOR_HEARTBEAT`) is
accepted only where the player's actor update would be
([the rule](/replication-api/wire-formats#a-keepalive-is-accepted-only-where-the-actors-update-would-be)). Where the player has no `access`, the server answers every keepalive
`UNAUTHORIZED`, and the actor is not present there. An older server never refuses a
keepalive, so with one the report is never made and nothing else differs.

CrowdyCPP 0.95.0 makes one report for the actor and the place, an `ActorNotPresent` (`uuid`,
`chunk`, `sequence`, `verified`):

| Call | When |
|---|---|
| `Handlers::notPresent` | Once, at the first refused keepalive. `Connection::notPresent(uuid)` returns the report while it stands |
| `Handlers::notPresentEnded`, `NotPresentEnd::Accepted` | A keepalive there had no refusal for 3 seconds, or the actor's own update came back from the server |
| `Handlers::notPresentEnded`, `NotPresentEnd::Moved` | The actor's next keepalive or update named another chunk |
| `Handlers::notPresentEnded`, `NotPresentEnd::Stopped` | No keepalive was sent for the actor there for 30 seconds |

- **`Handlers::genericError` still receives every refusal**, with `GenericError::keepalive`
  true. `stats().keepalivesRefused` counts them, and `stats().notPresentReports` counts
  reports.
- **Nothing else changes on such a refusal.** The connection's state, its server, and its
  token stay as they are. A player's session is sent the refusal unsigned, so the report is
  all that a forged one can cause.
- **Keep sending keepalives at the rate you send them now**: never faster, and never stop.
  Once access is granted, the next keepalive is accepted within about 6 seconds, with no new
  sign-in. `LocalActorStore` keeps its rate whatever the server answers.
- **Do not treat the player as present** in that place while the report stands.

## AndWait correlation

UDP is best-effort and sequence numbers are correlation, not idempotency. For
request/confirm flows CrowdyCPP offers the same convenience CrowdyJS's
`*AndWait` methods provide:

- `sendActorUpdateAndWait` / `sendVoxelUpdateAndWait` — wait (pumping and
  polling internally; other handlers still fire) until the send's **self-echo
  notification** arrives, a correlated error frame arrives, or the timeout
  elapses. An accepted voxel edit always echoes to its sender (replication
  v0.37.0); an actor update echoes while your actor is in range of its chunk.
- `sendTextAndWait` — text (like audio, video and client events) comes back to
  you only when your actor is near the target chunk, so its echo is not an
  acknowledgment; only errors correlate. A clean timeout therefore means *accepted*.
- `waitForSequence` — the low-level primitive: wait on any sequence + uuid.
- The first awaited send of a session (the first connect and each reassignment;
  `Connection::sessionEpoch()` counts them) is retried once with a fresh
  sequence when it is refused `Unauthorized` or, for actor and voxel updates,
  when its echo times out: how a replication server older than v0.42.0 answers
  a session's first message. A text send's clean timeout is its success and is
  never retried (CrowdyCPP 0.72.0). From v0.42.0 the server holds that first
  message until the session is ready, so the retry does not fire.
- An actor or voxel update still waiting for its echo when the connection is
  reassigned is resent once, with a fresh sequence, as soon as the new session
  is connected, rather than at its timeout: its echo went to the session the
  connection left. That is the send's one retry; text is never resent
  (CrowdyCPP 0.73.0). `WaitOutcome::sessionChanged` is set when the wait ended
  that way and the resend could not be sent.

`sendVideoFrame` returns the number of fragments sent; like audio, its echo
reaches you only when your actor is near the chunk, so only a correlated
`Unauthorized` error frame (no `use_video_chat`) tells you it was refused.

The outcome reports `acknowledged`, the correlated error code if any, and the
server epoch-millis from the echo.

## Errors

The replication layer **never throws on the hot path**: sends return
`Result` codes, server failures arrive as correlated error notifications, and
connection changes surface through the status callback. `wire::ErrorCode::AppPaused`
(33, replication v0.37.0) means the app is paused (no funds, a spend cap, a lapsed
subscription): keep the session, tell the player, and read the reason from the token
mint's `runtimeGate` (`domains::isAppPaused`). Voxel edits take any signed 16-bit
position and type; a state over 1,024 bytes (`wire::voxel::kMaxStateSize`) is refused
before it is sent, and your own accepted edit always comes back once as a notification. GraphQL-layer
operations (assignment, token mint/refresh) throw the structured exception
types shared with the rest of the SDK — branch on `error.code()` rather than
parsing messages.

## Next

Most games should not drive `Connection` by hand — the
[World session](/crowdycpp/world-session) layer packages the send loop,
registries, and caches on top of it.

An organization's own game server uses `crowdy::replication::FleetSession` in
place of `Connection`: one session that carries all of the server's players.
See [Run your own game servers with a fleet session](/management-api/fleet-sessions#crowdycpp).
`FleetSession` has made the signature and app checks of the receive path since 0.94.0, under
the same counter names, and reports a carried player's refused keepalive through
`FleetHandlers::notPresent`.

## Webcam video

`crowdy/media/video_frames.hpp` is the header-only fragmenter and reassembler
that the JS SDK mirrors byte for byte (the fragment header is specified in
[Wire formats → Video payload](/replication-api/wire-formats#video-payload-client_video_packet_2-client_video_notification_2)):

```cpp
#include <crowdy/media/video_frames.hpp>

// Sending: one call per encoded frame (JPEG or WebP bytes), ≤ 8 KB is the target.
std::uint16_t frameId = 0;
auto sent = connection.sendVideoFrame(chunk, myUuid, jpegBytes, frameId++,
                                      crowdy::media::VideoCodec::Jpeg);
// sent.value() is the fragment count; a frame over 16 fragments is refused, not partially sent.

// Receiving: one assembler per connection, fed from Handlers::video (or WorldSessionConfig::onVideo).
crowdy::media::VideoFrameAssembler assembler;
handlers.video = [&](const crowdy::replication::SpatialNotification& n) {
  if (auto frame = assembler.ingest(n.uuid, n.payload, nowMs())) {
    decodeAndDraw(frame->uuid, frame->codec, frame->bytes);   // delivered once per frame
  }
};
// On Handlers::actorLeft (or the store's onLeave): assembler.forget(uuid) and drop the texture.
```

Every receiver within `distance` pays the bytes: keep `distance` at 0–1, the
rate ≤ 10 fps and frames small, and expose a toggle. `use_video_chat` is opt-in
on a tier for the same reason.
