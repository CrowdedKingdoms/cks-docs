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
  `sendHeartbeat` replaces the full update so presence never lapses.
- **Chunk moves send immediately**: `moveTo(chunk)` does not wait for the
  next send slot — crossing a chunk boundary should never lag.
- **Acks**: your own updates echo back from the server; `lastAck()` exposes
  the last applied echo (sequence, server time, state) for reconciliation.

State payloads are opaque bytes. For typed states, `PodCodec<T>` maps a
trivially-copyable packed struct to the wire payload (the struct layout *is*
the wire layout), and `UnrealPose` ships as a ready-made 88-byte layout
interoperable with the Unreal SDK's pose format.

## Everyone else: `actors()` and lanes

`RemoteActorStore` is the registry of everyone you can see, fed from actor
notifications with your own echoes filtered out:

- **Sample history** per actor (newest-first, configurable depth) with server
  epoch and receive time — exactly what interpolation needs.
- **Staleness reaping**: actors unseen for `staleAfterMs` (default 12 s) are
  reaped on tick, firing `onLeave`. `onJoin` / `onUpdate` fire as actors
  appear and move.
- **Lanes**: named, filtered sub-registries so different actor kinds (players
  vs mobs, discriminated by a payload tag byte, for example) are decoded once
  and read separately.

## The world: `chunks()`

`ChunkStore` is a chunk/voxel cache combining the durable GraphQL store with
the realtime stream:

- **Hydrate**: `ensureAround(center, distance)` bulk-loads every stored chunk
  in range in one GraphQL round trip; `pruneBeyond` evicts far chunks
  (persisting dirty ones first).
- **Realtime merge**: inbound voxel notifications are applied to the cache
  automatically.
- **Optimistic edits**: `setVoxel` applies locally, replicates over UDP, and
  marks the chunk for durable write-back.
- **Worldgen write-back**: chunks the server has never stored can be
  generated client-side (`seed` / `insertGenerated`) and persisted so the
  world stays identical for everyone — write-back is throttled (default one
  chunk per 700 ms) and `flush()` forces it.
- `onChunkChanged` observes both realtime and local changes.

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

## Game-model state: `ContainerMirror`

Game-model changes are **pull-based** on this platform (there is no model
subscription); functions declare notify effects and clients re-read. This is
the **notify-to-pull** pattern (see
[Model-driven notifications](/game-api/model-driven-notifications)).
`ContainerMirror` is the client half: watch the containers you care about,
bind the mirror to a notification channel, and every watched container
re-pulls its snapshot when that channel pings — you render straight from the
cache. `onChange` fires with the container id, revision, and parsed
properties whenever a snapshot actually changed.
