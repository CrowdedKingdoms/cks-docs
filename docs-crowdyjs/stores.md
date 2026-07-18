---
sidebar_position: 18
title: World Stores
---

# World Stores

The core CrowdyJS client is a deliberately thin transport: it sends packets,
delivers notifications, and stores almost nothing. Every game on top of it
therefore rebuilds the same client-side bookkeeping — an actor registry, a
pose codec and send loop, a chunk cache, a chat ring, a host poller. The
reference MMO (Blocks with Friends) carries roughly **1,600–2,000 lines** of
exactly that.

**World Stores** (CrowdyJS 8.4+) moves those data structures into the SDK as
an opt-in layer: typed, queryable, source-of-truth stores fed by ONE shared
`udpNotifications` subscription, with the developer supplying only their
custom types and encoders/decoders.

```ts
import {
  createWorldSession, structCodec, f32, u8, jsonCodec, workerTicker,
} from '@crowdedkingdoms/crowdyjs/stores';

// 1. Describe your replication state ONCE (binary layout, declaratively).
const poseCodec = structCodec({
  x: f32(), y: f32(), z: f32(), yaw: f32(),
  flags: u8(), held: u8(),
});

// 2. Configure the stores you want. Only these are constructed — and only
//    these exist on the session's TYPE.
const session = createWorldSession(game, appId, {
  ticker: workerTicker(), // keep 5 Hz sends alive in backgrounded tabs
  self:   { codec: poseCodec, initialState: { x: 0, y: 0, z: 0, yaw: 0, flags: 0, held: 0 } },
  actors: { codec: poseCodec },
  errors: true,
  chunks: { voxelStateCodec: jsonCodec<CropMeta>() },
});

// 3. Play. The SDK owns the bookkeeping.
await session.self.join({ x: '0', y: '0', z: '0' });
session.self.patchState({ x: 12.5 });                 // replicated next tick
for (const other of session.actors.list()) { /* render typed poses */ }
session.dispose();
```

## Design contract

- **Stores are the source of truth; events are notifications.** Every store
  is synchronously queryable (`get`/`list`/snapshots, cheap `revision`
  counters) and emits change callbacks. Render from the store — no shadow
  maps.
- **Render-loop and background-tab friendly.** Nothing runs on
  `requestAnimationFrame`. Writes happen in WebSocket message handlers,
  which browsers do **not** throttle in hidden tabs, so inbound state keeps
  flowing while your tab is hidden; the paused render loop simply catches up
  on resume. Timer-driven work (send loop, reaping, write-back, heartbeats)
  rides an injectable **Ticker**: `intervalTicker()` (default) or
  `workerTicker()` — a dedicated Web Worker, exempt from background-tab
  timer throttling. Staleness is *also* computed at read time, so a
  throttled timer can never serve stale actors.
- **Compile-time toggles.** The layer lives behind the
  `@crowdedkingdoms/crowdyjs/stores` subpath and the package declares
  `"sideEffects": false`: the core client never bundles it, and unimported
  stores tree-shake away. On top of that the session's TypeScript type is
  conditional on your config — `session.host` without `host: ...` is a
  compile error, not an undefined-at-midnight surprise.
- **One subscription, one scheduler, one dispose.** `createWorldSession`
  opens at most one `udpNotifications` subscription (lazily, on the first
  store that needs it), shares one ticker, and `dispose()` tears everything
  down.

## Codecs: your types on the wire

Every opaque base64 blob on the platform is app-defined. A `StateCodec<T>`
names that definition once:

```ts
interface StateCodec<T> {
  encode(value: T): string; // typed value → base64
  decode(data: string): T;  // base64 → typed value
}
```

Built-ins:

| Codec | Use for |
| --- | --- |
| `structCodec({...})` | High-rate replication state: a declarative fixed-layout binary DSL (`f32`, `f64`, `u8`, `u16`, `u32`, `i8`, `i16`, `i32`, `bool8`, `bytes(n)`, `reserved(n)`), little-endian, exposes `byteLength` |
| `jsonCodec<T>()` | Low-rate structured state (saves, profiles, channel payloads) |
| `textCodec` | Plain UTF-8 strings (chat) |
| `rawCodec` | You already have your own pipeline; the value IS the base64 string |

Replication and durable state take **independent** codecs — a 48-byte pose
and a JSON save blob are different types, and each store binds its own.

Spatial packets have a ~1.1 KB budget: use `structCodec` for anything sent
per tick. The Blocks-with-Friends 48-byte pose, declaratively:

```ts
const poseCodec = structCodec({
  x: f32(), y: f32(), z: f32(),
  yaw: f32(), pitch: f32(),
  vx: f32(), vy: f32(), vz: f32(),
  flags: u8(), heldBlockId: u8(), _r0: reserved(2),
  updatedAt: f64(), _r1: reserved(4),
}); // byteLength === 48
```

## The stores

### `self` — your actor (LocalActorStore)

Identity, typed state, and the send loop — the boilerplate every multiplayer
client starts with:

- **Identity**: a 32-char uuid is minted and persisted through a pluggable
  `UuidStore` (`localStorageUuidStore()` keeps it stable across reloads;
  explicit `uuid` wins).
- **Send loop**: defaults to **5 Hz** (`sendIntervalMs: 200`); set `false`
  to drive `sendNow()` yourself. With `sendOnChange` (default) unchanged
  encodes are deduped, and a keyframe still goes out every `keyframeEveryMs`
  (default 3000) so presence never starves.
- **Queryable records**: `lastSent` (typed state + encoded form + sequence
  number + timestamp), `lastAck` (your server-applied self-echo, decoded),
  `lastError`, and `status: 'idle' | 'pending' | 'acked' | 'error'`.
- **Presence maintenance**: `join(chunk)` / `moveTo(chunk)` send
  immediately; `refresh()` re-registers (dropped first-join, reconnects);
  a built-in `visibilitychange` hook re-registers when the tab returns.

### `actors` — everyone else (RemoteActorStore)

The remote registry, decode-once:

- `Map`-backed records with **stable object identity**: `{ uuid, state,
  chunk, distance, epochMillis, receivedAt, samples }`. `samples` keeps the
  last `historySize` (default 2) timestamped states — what an interpolating
  renderer needs without keeping its own buffers (the lerp math itself stays
  in your renderer).
- **Self-echo filtered** automatically (wired from `self`).
- **Staleness** both ways: reads filter by `receivedAt` age
  (`staleAfterMs`, default 12 s) so results are always live, and a reap
  timer physically deletes quiet records and fires `onLeave`.
- **Lanes** route one decoded stream to several consumers — the
  players-vs-mobs split every MMO hits:

```ts
actors: {
  codec: poseCodec,
  lanes: {
    mobs:    (s) => (s.flags & FLAG_MOB) !== 0,
    players: () => true, // first match wins
  },
}
// session.actors.lane('mobs').onJoin(spawnMobVisual);
```

### `errors` — attributed send errors (ErrorStore)

The server reports UDP failures asynchronously as `GenericErrorResponse
{ sequenceNumber, errorCode }`. The session tracks every store-made send in
a 256-slot sequence table, so each error is **attributed** to the send that
caused it (kind, actor uuid, detail) and kept in a ring buffer:
`errors.recent(n)`, `errors.lastFor(uuid)`, `errors.onError(cb)`. Attribution
is best-effort by design — sequence numbers are uint8 correlation ids.

### `chunks` — terrain (ChunkStore)

The client-side source of truth for chunks and voxels:

- `ensureAround(center, radius)` bulk-loads via `getChunksByDistance`
  (in-flight deduped), then **hydrates sparse `voxelStates` per chunk** —
  the bulk query omits them, a platform trap the store encapsulates.
- Realtime `voxelUpdate` notifications merge into the cache automatically:
  dense grid write, typed state decode, revision bump, `onChunkChanged`.
- `setVoxel(...)` applies locally first (optimistic) and replicates over the
  UDP path with your typed voxel state.
- **Deterministic worldgen write-back**: chunks the server has never stored
  are handed to your `onMissing(coord)` hook; returned grids are seeded
  locally and persisted through a throttled write-back queue (one chunk per
  `writeBackIntervalMs`, default 700 ms) — the proven shared-worldgen
  pattern.
- Typed reads everywhere: `voxelTypeAt`, `voxelStateAt`, `get(coord)` with
  `voxels` (4096-byte dense grid), `voxelStates: Map<index, T>`, typed
  `chunkState`, `loadState`, `revision`.

### `channelInbox`, `actorInbox`, `events` — messaging

- **ChannelInbox**: every `channelMessage` decoded into a per-channel
  chronological history (capped, default 100) with `onMessage(cb,
  channelId?)` and typed `send` — the inbound channel fan-out most games
  never write.
- **ActorInbox**: typed `singleActorMessage` history + `send(targetUuid,
  payload, targetChunk)`. The payload is opaque to the server; embed sender
  identity in your payload type (the platform convention).
- **EventRouter**: register `{ eventType → codec + handler }` for
  app-defined client **and** server events (uint16 ids); the latest decoded
  event per type stays queryable via `lastEvent(eventType)`; `send` emits
  typed events.

### `host`, `save`, `avatar` — election and durable state

- **HostTracker**: heartbeats on the session ticker (default 3 s — also
  keeps you host-eligible), caches `hostUserId`/`isHost`, fires
  `onHostChanged`. Election is informational — keep `is_host` invoke
  policies on authoritative model functions.
- **SaveStateStore**: a typed cache over the per-user app save blob
  (`client.state`): `load()`, `set()`/`patch()`, `save()`, and debounced
  autosave (`autosaveMs`).
- **AvatarStateStore**: typed, cached public / private / per-app avatar
  state, each with its own codec.

### `model` — game-model mirror (ContainerMirror)

The client half of the [notify-to-pull pattern](/crowdyjs/game-kit#notify-to-pull):
`watch(containerId, parse)` keeps a typed snapshot of a game-model
container; `bindToChannel(channelId)` re-pulls every watched container
(coalesced) whenever the channel pings — pair it with model functions that
declare channel notifications, e.g. the Game Kit's `match_changed` pings.
`onChange` fires only when a refresh actually changed the visible state.

## Adopting it in an existing game

The layer replaces, one for one, the bookkeeping the reference MMO
hand-writes:

| Hand-written today (BWF) | LOC | World Store |
| --- | --- | --- |
| Pose codec (48-byte buffer code) | 61 | `structCodec` (~10 declarative lines) |
| Actor send loop + uuid persistence | ~95 | `self` |
| Remote registry + stale reap + session wiring | ~175 | `actors` |
| UDP fan-out singleton (`NetworkManager` handler sets) | 327 | the session itself |
| Chunk cache + streamer + voxel codecs | ~860 | `chunks` (+ your `onMissing` worldgen) |
| Host heartbeat poller | 50 | `host` |
| Chat ring buffer | 64 | `channelInbox` |
| Save-state encode/decode | 121 | `save` |
| Error handling | `console.warn` | `errors` (attributed) |

Custom store? Build on the same wiring: `session.context` exposes the
notification bus, the shared ticker, and send tracking, and every store's
`attach*` factory is exported individually.

## Relationship to other layers

- The [Game Kit](/crowdyjs/game-kit) is the **server-side rules** layer
  (blueprints + gated model functions); World Stores is the **client-side
  state** layer. They meet in `model` (notify-to-pull) and compose freely.
- The Unreal SDK's [Crowdy State](/unreal-sdk/runtime/crowdy-state) solves an
  adjacent problem — diff-based *property replication* between clients on
  the view plane. World Stores manages what arrives over the platform's
  standard replication surfaces in a browser/TypeScript client; the concepts
  align (typed state, host authority, heartbeat keyframes) but the wire
  mechanics differ.
- For the underlying transport semantics see the
  [GraphQL UDP proxy](/game-api/graphql-udp-proxy-api) guide.
