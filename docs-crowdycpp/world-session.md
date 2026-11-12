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
  That keyframe is when an idle actor first appears. Updates after that arrive at the
  send rate, including for a player on another server.
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
the realtime stream. Since CrowdyCPP 0.82.0 nothing in it blocks the game
thread: the durable store's calls run on a thread the store owns
(`Options::ioThread`; turn it off and call `runIo()` from a worker of yours), and
every callback runs on the thread that calls `tick()`.

- **Loads**: `ensureAroundAsync(center, distance)` asks for the stored chunks in
  range that the store does not hold, as boxes (a step along one axis at range 8
  asks for the 289 it uncovers), and returns at once; `tick()` applies what
  arrived within `Options::adoptBudgetUs` (2 ms). The Game API's source reads each
  box in pages of the size the server applied (Game API v2.67.0); a chunk two
  pages return is applied once (`duplicatePageChunks()`). `ensureAround()` does the
  same and waits. Each chunk's `voxelStates` go over its stored grid: since ck-api
  v2.33.0 they carry every voxel edit recorded for the chunk (a hub's or mod's
  `world.set_voxels`, `updateVoxel`, realtime voxel updates), which its stored
  `voxels` never hold. A stored copy **replaces** a chunk's states and overlay (a
  `world.set_chunk` drops the older edits), and this client's unanswered edits are
  put back over it; a chunk holding a seeded grid not yet written back is never
  overwritten. `voxelStatesTruncated` and the stored row's `updatedAt`
  (`storedAtMs`) reach `ChunkData`. An `IChunkSource` of your own reports
  `voxelStates`, and answers `chunksInBox` (the default reads the bounding cube
  with `chunksAround`).
- **Realtime merge**: inbound voxel notifications are applied to the cache
  automatically. A `chunkChanged` (a hub's or mod's `world.set_chunk`) reads the
  chunk again; after the connection comes back, `catchUp()` reads the last area's
  edits and rewritten chunks from 30 s before it dropped.
- **Edits**: `setVoxel` applies locally and replicates over UDP, **paced**: at most
  `Options::maxEditsInFlight` (128) unanswered and `maxEditsPerSecond` (250) sent,
  the rest waiting in order, already shown. It returns an edit id and takes an
  optional callback with the `EditOutcome`: `Echoed`, `Refused` (the server's
  `errorCode`; `Unauthorized` for a voxel the player may not edit), `NotSent`, or
  `TimedOut` (`editTimeoutMs`, 10 s). An edit that does not end `Echoed` is undone
  (`restored`) and reported to `onEditRefused` too. `sequenceOf(editId)` gives the
  sequence number while it waits. Realtime edits are recorded by the server and
  are not written back. `setVoxel(..., optimistic = false)` changes nothing: the
  edit is applied when the server's echo of it arrives.
- **Worldgen write-back**: chunks the server has never stored can be generated
  client-side (`seed` / `insertGenerated`) and persisted so the world stays
  identical for everyone; write-back is throttled (default one chunk per 700 ms).
  `flush()` queues every dirty chunk at once; `flushAndWait()` waits for the
  outcomes (for shutdown).
- **Refused write-backs**: the write-back is `updateChunk` as the player, so it
  persists only chunks the player may build in (see
  [Writing whole chunks](/game-api/grids-and-permissions#writing-whole-chunks)).
  A refusal the server will not change (`FORBIDDEN`, `SCOPE_MISSING`, a
  validation error, `NOT_FOUND`, `extensions.retryable: false`, HTTP 400, 403,
  404, 413 or 422) is sent once and dropped. Any other failure (`PLATFORM_BUSY`,
  `UNAUTHENTICATED`, network, a timeout, a 5xx) is tried again after 0.7, 1.4,
  2.8 and 5.6 s, then dropped. A dropped chunk keeps its local voxels and is no
  longer dirty, and neither kind holds up any other chunk. `onWriteBackFailed`
  reports each drop as a `ChunkWriteBackFailure`. `pruneBeyond` keeps a dirty
  chunk until its write-back ends; a later prune evicts it.
- **Storage and change reports**: a chunk whose voxels have one type keeps the
  type alone (`uniform()`); voxel states and overlay voxels share one buffer per
  chunk. Read with `grid()` (no copy), `typeAt`, `stateAt`, `forEachState`,
  `overlayAt` and `forEachOverlay`. `onChanges` reports, once per tick, every
  chunk that changed with `ChunkChangeFlag` bits (loaded, voxels, states,
  unloaded) and flags the face neighbours of a border edit
  (`kChunkNeighborEdge` with the face), so a mesher rebuilds each chunk once a
  frame. `onChunkChanged` still fires on every change.
- **A 16×16×16 helper that keeps wide edits**. Voxel positions and types are your
  app's signed 16-bit values; the dense grid holds one byte per voxel of a
  16×16×16 chunk. An edit it cannot hold (a type outside 0-255, a position
  outside 0-15) goes to the chunk's overlay, and `voxelTypeAt` returns it.

Measured on our builder: 125 chunks with 256 edits each (64-byte states) parse in
about 26 ms on the store's thread, and the longest tick applying them takes about
1.1 ms; range 8 (4,913 chunks, most of them air) holds about 2.8 MB.
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
