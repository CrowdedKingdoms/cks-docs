---
slug: world-session
sidebar_position: 5
title: World session
---

# World session

`crowdy::session::WorldSession` is the SDK-managed game-state layer — the C++
analog of CrowdyJS's [World Stores](/crowdyjs/stores). It moves the
client-side bookkeeping every game otherwise hand-writes (actor registries,
send loops, chunk caches, chat rings, host polling) into the SDK as typed,
queryable stores driven by **one replication connection and one tick**.

```cpp
session::WorldSessionConfig sc;
sc.appId = appId;
session::WorldSession world(conn, &game, sc);
world.join({0, 0, 0}, initialStateBytes);

// Game loop:
world.tick();  // polls the connection, drives the send loop, reaps, writes back
```

Everything is **single-threaded by design**: `tick()` polls the connection
(dispatching notifications into the stores) on the calling thread — the same
thread that reads them — so reads are plain snapshots with no locking.

## Your actor: `self()`

`LocalActorStore` drives your actor's presence:

- **Send-on-change at a fixed rate** (default 5 Hz): `setState(bytes)` only
  marks the state dirty; unchanged states are deduped.
- **Periodic keyframes** (default every 3 s): a full send goes out even when
  nothing changed, keeping presence fresh and repairing lost packets.
- **Idle heartbeats** (default every 2 s): while unchanged, a cheap
  `sendHeartbeat` replaces the full update so presence never lapses. Since
  replication v0.37.0 two idle players on different servers see each other at the
  first keyframe after joining (3 s with these defaults); no faster cadence is needed.
- **Chunk moves send immediately**: `moveTo(chunk)` does not wait for the
  next send slot — crossing a chunk boundary should never lag.
- **Acks**: your own updates echo back from the server; `lastAck()` exposes
  the last applied echo (sequence, server time, state) for reconciliation.

State payloads are opaque bytes, and **the session stores keep at most 256 bytes of
one** (`crowdy::session::kMaxStateBytes`): a longer state, yours through `setState` or
another actor's from the wire, is cut to its first 256 bytes without an error. Keep poses
well under it, and carry anything larger in an event, a channel message or app state (a
spatial datagram is at most 1,232 bytes in all). For typed states, `PodCodec<T>` maps a
trivially-copyable packed struct to the wire payload (the struct layout *is*
the wire layout), and `UnrealPose` ships as a ready-made 88-byte layout
interoperable with the Unreal SDK's pose format.

## Everyone else: `actors()` and lanes

`RemoteActorStore` is the registry of everyone you can see, fed from actor
notifications with your own echoes filtered out:

- **Sample history** per actor (newest-first, configurable depth) with server
  epoch and receive time — exactly what interpolation needs.
- **Server-announced leaves** (CrowdyCPP 0.30, Buddy v0.25): an
  `ACTOR_LEFT_NOTIFICATION_2` (145) removes the actor from every lane and fires
  `onLeave` at once — about five seconds after its last update, or immediately
  when its session ended. `WorldSessionConfig::onActorLeft(uuid, reason)` also
  receives it (`reason` 0 = stale, 1 = session released; treat others as
  stale) for anything you key by uuid outside the store: audio playback,
  video textures.
- **Staleness reaping** stays as the fallback: actors unseen for `staleAfterMs`
  (default 12 s) are reaped on tick, firing `onLeave`, for a leave whose
  datagram was lost. `onJoin` / `onUpdate` fire as actors appear and move;
  `onLeave` then `onJoin` for the same uuid is a reconnect, not an error.
- **Lanes**: named, filtered sub-registries so different actor kinds (players
  vs mobs, discriminated by a payload tag byte, for example) are decoded once
  and read separately.

## The world: `chunks()`

`ChunkStore` is a chunk/voxel cache combining the durable GraphQL store with
the realtime stream:

- **Hydrate**: `ensureAround(center, distance)` bulk-loads every stored chunk
  in range in one GraphQL round trip; `pruneBeyond` evicts far chunks
  (persisting dirty ones first). The load selects each chunk's `voxelStates`
  and puts every entry over the stored grid: its type at its voxel, and its
  state. Since ck-api v2.33.0 those entries carry every voxel edit recorded
  for the chunk (a hub's or mod's `world.set_voxels`, `updateVoxel`, realtime
  voxel updates), which its stored `voxels` never hold, so a block a hub
  placed is there after a reload (CrowdyCPP 0.56.0; earlier releases lost
  it). An `IChunkSource` of your own reports them in
  `StoredChunk::voxelStates`. A chunk the server has never stored comes back
  with none, even when edits were recorded for it.
- **Realtime merge**: inbound voxel notifications are applied to the cache
  automatically.
- **Optimistic edits**: `setVoxel` applies locally, replicates over UDP, and
  marks the chunk for durable write-back.
- **Worldgen write-back**: chunks the server has never stored can be
  generated client-side (`seed` / `insertGenerated`) and persisted so the
  world stays identical for everyone — write-back is throttled (default one
  chunk per 700 ms) and `flush()` forces it.
- **Refused write-backs**: the write-back is `updateChunk` as the player, so
  it persists only chunks the player may build in (see
  [Writing whole chunks](/game-api/grids-and-permissions#writing-whole-chunks)).
  A refusal the server will not change (`FORBIDDEN`, `SCOPE_MISSING`, a
  validation error, `NOT_FOUND`, `extensions.retryable: false`, HTTP 400, 403,
  404, 413 or 422) is sent once and dropped. Any other failure (`PLATFORM_BUSY`,
  `UNAUTHENTICATED`, network, a timeout, a 5xx) is tried again after 0.7, 1.4,
  2.8 and 5.6 s, then dropped. A dropped chunk keeps its local voxels and is no
  longer dirty, and neither kind holds up any other chunk. `onWriteBackFailed`
  reports each drop as a `ChunkWriteBackFailure` (`coord`, `reason` `Refused` or
  `Exhausted`, `attempts`, and the last attempt's `GraphQLOutcome` as `error`);
  undo or flag the edit there. `flush()` returns a `ChunkFlushResult`:
  `persisted`, and the write-backs it `dropped`. `pruneBeyond` evicts a refused
  chunk and keeps one whose failure can still clear. (CrowdyCPP 0.53.0.)
- `onChunkChanged` observes both realtime and local changes.
- **A 16×16×16 helper that keeps wide edits** (CrowdyCPP 0.60.0). Voxel
  positions and types are your app's signed 16-bit values; the dense grid holds
  one byte per voxel of a 16×16×16 chunk. An edit it cannot hold (a type
  outside 0-255, a position outside 0-15) goes to `ChunkData::overlay`, keyed
  by `voxelKey(x, y, z)`, and `voxelTypeAt` (now `std::int16_t`) returns it.
  `setVoxel` with such a position keeps it in the overlay and sends it, where
  it used to return `InvalidArgument`. Before 0.60.0 a realtime update with a
  large position could be written past the end of the 4,096-byte grid; it no
  longer can.
- **`WorldSessionConfig::onVoxel(notification, voxel)`** is called for every
  inbound voxel update after `chunks()` has merged it, with the sender and the
  edit's state blob, for a game that keeps its own world or uses other
  addressing. Your own accepted edits come back too (replication v0.37.0
  echoes every accepted edit to its sender).

## Voice and video

`WorldSession` owns the one subscription, so media reaches you through its
config rather than through `Connection` handlers: `WorldSessionConfig::onAudio`
receives each `CLIENT_AUDIO_NOTIFICATION` and `onVideo` each
`CLIENT_VIDEO_NOTIFICATION_2` (one fragment; feed `payload` to a
`crowdy::media::VideoFrameAssembler` keyed by sender to get whole frames — see
[Replication client → Webcam video](replication-client#webcam-video)). A
session installed without them receives neither, so wire both if your game
has either. Sending goes through the connection: `sendAudio`, and
`sendVideoFrame(chunk, uuid, frame, frameId, codec)`, which needs
`use_video_chat` on the sender's tier and the grid under the chunk.

Audio payloads are yours to define. `crowdy::media` (`voice_frames.hpp`,
CrowdyCPP 0.60.0) offers an optional convention shared with CrowdyJS: a
10-byte voice header inside the payload (`encodeVoicePacket`,
`decodeVoicePacket`), a `VoicePacketizer` that numbers frames, and a
`VoiceJitterBuffer` keyed by sender that reorders, delays playout by 60 ms and
reports missing frames as gaps. The layout and behaviour are on the
[CrowdyJS voice page](/crowdyjs/voice-chat#voice-payload-helpers). Configure
with `-DCROWDY_WITH_OPUS=ON` to get `OpusVoiceEncoder` / `OpusVoiceDecoder`
(`opus.hpp`) over a libopus you provide; the default build needs no codec.

`WorldSessionConfig::onGenericSpatial` receives `GENERIC_SPATIAL_1` (opcode
140), the long spatial message whose payload your game defines.

## Events, messages, errors

- **`events()`** (`EventRouter`) routes client/server event notifications to
  per-`eventType` handlers and retains the last event per type. Send typed
  events with `events().send(...)`.
- **`channelInbox()` / `directInbox()`** (`Inbox`) retain channel messages
  and single-actor direct messages: drain oldest-first, peek without
  consuming, filter by channel, or observe with `onMessage`. Sending goes
  through the same objects (channel publish; fire-and-forget direct message).
- **`errors()`** (`ErrorStore`) correlates server error frames with **what
  you sent**: the sequence-numbered error is attributed to the send kind
  (actor update, voxel update, text, …) that used that sequence, with
  `recent()`, `lastFor(kind)`, and an `onError` callback.

## Host tracking

The session heartbeats host eligibility over GraphQL on an interval (default
3 s) and caches the election result: `amIHost()`, `hostUserId()`, and
`onHostChanged` fire from tick when the elected host changes. The heartbeat
is a blocking HTTP call on the tick thread — disable it
(`hostHeartbeatIntervalMs = 0`) and run your own if that is unacceptable.

## Durable stores

Alongside the realtime session, thin caches wrap the durable GraphQL
surfaces (durable and realtime payloads rarely share a layout, so these carry
their own bytes):

- **`SaveStateStore`** — the per-user, per-app save blob: explicit
  `load()` / `save()` with the bytes held locally between round trips, plus a
  byte-range `patch`.
- **`AvatarStateStore`** — one avatar's identity-level and per-app state
  blobs, loaded and saved explicitly.
- **Actor-UUID persistence** — your actor uuid should survive restarts so
  other players' registries treat you as the same actor. `FileUuidStore`
  persists it to a file (the native analog of CrowdyJS's
  localStorage-backed store); implement `IUuidStore` for your own storage.

Server-owned game state lives in your app's [ck-exec](/exec/intro) hubs. A
client reads it by calling a hub and follows it by subscribing to the hub's
topics through `client.exec()`; see
[connect from a game](/exec/connect-from-a-game#crowdycpp).
