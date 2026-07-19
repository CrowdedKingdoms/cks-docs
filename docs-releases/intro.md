---
slug: intro
sidebar_position: 1
title: Changelog
---

# API changelog

Notable, consumer-facing changes to the public Crowded Kingdoms APIs (Management API,
Game API, Replication API) and SDKs. Newest first. Breaking changes always ship with a
deprecation window — deprecated fields keep working and are marked `@deprecated` in the
schema (visible in the [reference](/management-api/reference/graphql-overview) and the
downloadable SDL) until the stated removal date.

## 2026-07-19 (latest)

**Compute hardening complete -- measured limits, calibrated billing, failure containment, and the Model-vs-Compute guide**

The deferred Phase 10 production-confidence pass is complete:

- Load harness + matrix: up to 50 modules, 5 Hz, six host-call mixes and
  invoke storms. A 50-module db-heavy fleet sustained 2,500 db-ops/s at
  full cadence (~80% of one reference game-api process); invokes held
  99 rps at p99 4 ms with zero errors.
- Compute billing's deterministic equivalent is now **22M fuel per unit**
  (measured ~21.8M fuel/ms) instead of the Phase 4 placeholder 28M. The
  free allowance and rate were validated against the 27-engine kit fleet
  and live Blocks with Friends usage.
- Failure drills proved compile rollback, fuel/watchdog/OOM/panic
  containment, circuit reset, 256 KB state rejection, lease-holder death,
  deploy mid-tick, event cascade depth, spend-cap pausing, and
  environment-wide rollback/resume.
- Runtime fixes: trigger upserts no longer stack duplicate rows; tick-rate
  edits reload a live module; failed compiles restore the prior succeeded
  version.
- New [Model API vs Compute](/game-api/model-vs-compute) decision guide,
  measured engine policy-footprint table, and calibrated billing/limits
  prose.

## 2026-07-19

**Realtime + live-ops engines and the template registry -- the game-kit catalog complete (CrowdyJS 8.9.0, CrowdyCPP v0.6.0)**

Wave 3 closes out the 30-abstraction game-kit catalog with the realtime/
competitive set (all additive):

- **New GraphQL surface**: `computeTemplates` +
  **`computeDeployTemplate`** — the platform's engine-template registry.
  Deploy any canonical engine by NAME (source-hash-deduped, triggers bound,
  enabled in one call); `moduleName` runs parameterizations side by side.
  SDK sugar: `client.compute.deployTemplate(...)` and
  `kit.deploy(blueprints, { engines: [...] })`.
- **Kit crates**: `kit-play` gains `abilities` (cast books, sub-stepped
  projectiles, AoE falloff) and `timing` (checkpoints/laps/ghost tracks);
  `kit-sim::zones` gains shrinking circles (BR schedules with
  warning/shrink/settle events).
- **Engine templates**: `abilities-engine` (AbilityDef-driven casts,
  type-94 events), `movement-warden` (observe/flag envelopes, type-95),
  `territory` (capture/decay/siege/income, type-96), `racing` (server-timed
  laps, auto-boarded results, ghost replays, type-97) + `possession` (the
  authoritative ball), `liveops-scheduler` (window modifiers on the compute
  bus) — plus the `arena-blitz` (G6) and `zone-rush` (G14 BR-lite)
  acceptance examples.
- **CrowdyJS 8.9.0 / CrowdyCPP v0.6.0**: new `kit.abilities` / `movement` /
  `territory` / `racing` / `liveops` / `moderation` / `telemetry` surfaces,
  the `kit.loot` engine path (pity rolls), liveops/moderation/telemetry
  blueprints, and event types 94–98 with parsers in both SDKs. Everything
  capability-detected; the movement warden observes and flags only — it
  never corrects (client prediction is untouched).

## 2026-07-19

**Session-genre engines -- kit-play completion, kit-econ, six new engine templates, and SDK surfaces (CrowdyJS 8.8.0, CrowdyCPP v0.5.0)**

Wave 2 of the game-kit program brings the session genres to the paved road
(all additive):

- **Kit crates**: `crowdy-game-kit-play` completes with `turns` (initiative,
  timeouts, simultaneous reveal), `score` (authoritative win conditions),
  and `cards` (server-held hidden hands, seeded shuffles);
  `crowdy-game-kit-ai` adds flow fields, a path cache, and budgeted
  turn-game movers; new **`crowdy-game-kit-econ`** ships order-book markets,
  server-computed standings, production chains with offline catch-up, and
  pity-timer loot. All allowlisted + vendored.
- **Engine templates**: `match-engine` (server-driven lifecycle over
  MatchMeta), `deck-engine` (true hidden information), `instance-engine`
  (private world slices, seeded runs), `director` (wave schedules, boss
  phases, party scaling), `matchmaking` (rating buckets, party blocks,
  compute-event handoff to matches), `market-engine` + `board-engine`
  (escrowed order books; tie-aware server rankings with season snapshots),
  and the `minigame` invoke-loop scaffold — plus playable examples per
  genre: `card-duel`, `dungeon-run`, `tower-defense`, `gacha-shrine`,
  `idle-factory`. The Tactical Model Simulator's enemy phase + outcome
  authority moved into a `tms-battle` compute referee (kit-ai).
- **CrowdyJS 8.8.0 / CrowdyCPP v0.5.0**: engine paths on
  `kit.matches`/`kit.decks`/`kit.leaderboards`, new
  `kit.instances`/`kit.director`/`kit.matchmaking`/`kit.minigames`,
  `kit.economy.orderBook`, quests FTUE tutorial sequencing, and reserved
  event types 91 (turn) / 92 (score) / 93 (proposal) with parsers in both
  SDKs. Everything capability-detected — model-only deployments keep their
  behavior.

## 2026-07-19

**Compute Engines -- the game-kit crate family, engine templates, and SDK engine surfaces (CrowdyJS 8.7.0, CrowdyCPP v0.4.0)**

Server-side game engines become a paved road (all additive):

- **Three new platform-vendored kit crates** join `crowdy-game-kit-core` on
  the module dependency allowlist: **`crowdy-game-kit-ai`** (budget-capped
  A* over a `CostProvider`, steering behaviors, FSM + JSON behavior-tree
  interpreter), **`crowdy-game-kit-sim`** (deterministic day cycle, weather
  fronts, resource nodes, timestamp growth/farming, wave schedules, rule
  zones), and **`crowdy-game-kit-play`** (the combat referee: presence-based
  hit validation, damage pipeline, kill credit, contact damage).
- **Engine templates** — deployable, data-driven reference engines in
  `compute-examples/engines/`: `npc-engine` (behavior-tree agents + pets),
  `mob-engine` (pooled spawns, aggro/leash/packs, refereed `attack_mob`),
  `world-engine` (weather + nodes + farming). The CLI scaffolds a copy with
  `crowdy-compute new <name> --engine <npc|mob|world>`; a `pets` example
  ships alongside the original five. New docs page:
  [Compute engines](/game-api/compute-engines).
- **CrowdyJS 8.7.0** — engine kit surfaces: the `kit/wire` pose/lane
  registry (`engineLanes()`, `enginePoseCodec`, type-77/90 event parsers),
  `kit.mobs`, `kit.pets`, `kit.combat.attackRouted`, `kit.worldsim.forecast`,
  `kit.npcs.overlayLivePoses`, and per-session engine capability detection
  (`kit.engines`) so the same client code runs on model-only deployments.
- **CrowdyCPP v0.4.0** — the same surfaces in C++ (`crowdy/kit/wire.hpp`,
  `kit.mobs()`, `kit.pets()`, `attackRouted`, `forecast`), parity-tracked
  against CrowdyJS.

## 2026-07-18

**Compute Modules -- developer tooling: crowdy-compute CLI, game-kit utility crate, examples + tutorial**

The compute developer experience grows a paved road (all additive):

- **`crowdy-compute` CLI** (in the `compute-examples` repository folder):
  `new` scaffolds a module crate, `check` mirrors the deploy validation
  locally (plus a real `wasm32-wasip1` build when a toolchain is present),
  `deploy` runs the full upsert → compile-wait → triggers → enable flow
  idempotently, `watch`/`invoke`/`status` cover the observe loop.
- **`crowdy-game-kit-core`** — a platform-vendored Rust utility crate for
  module authors: durable-state harness, actor-pose wire codecs, chunk math,
  player presence, cadence helpers, event framing, invoke routing, seeded
  RNG. Add `crowdy-game-kit-core = "0.1.0"` to your module's dependencies.
- **SDK `0.1.2`** adds two host functions: `container_get_batch` (up to 32
  containers + properties in one data-op) and `actors_list_radius` (a chunk
  box of actors in one call), plus a native test-host shim so module crates
  can `cargo test` off-platform.
- **Five runnable examples** (tick-counter, scoreboard, npc-pathfinder,
  world-weather, mini-game) and a new
  [Compute tutorial](/game-api/compute-tutorial) — zero to a live module in
  under 30 minutes.

**Game API -- Compute Modules: server-side Rust/WebAssembly logic (additive)**

The Game API gains **[Compute Modules](/game-api/compute-modules)** — studios
write Rust, deploy the source through GraphQL, and the platform compiles it to
WebAssembly and runs it server-side, sandboxed and fuel-metered:

- **New GraphQL surface (additive):** mutations `computeUpsertModule`,
  `computeDeployVersion`, `computeSetModuleEnabled`, `computeDeleteModule`,
  `computeUpsertTrigger`, `computeDeleteTrigger`, `computeSetPolicy`,
  `computeInvoke`; queries `computeModules`, `computeModule`,
  `computeModuleVersions`, `computeModuleTriggers`, `computeModulePolicy`,
  `computeModuleRuns`, `computeModuleStats`, `computeModuleLogs`,
  `computeAppDiagnostics`. Full signatures in the
  [GraphQL reference](/game-api/reference/graphql-overview).
- **Triggers:** fixed-rate ticks, model/compute event subscriptions, and
  client-callable invoke exports (synchronous RPC via `computeInvoke`, gated by
  the same authority-policy trees as model functions).
- **Host API:** typed, app-scoped access to game-model data, app state blobs,
  chunks/voxels/actors, and replication emits that arrive on the existing
  `udpNotifications` stream — see the
  [Compute host API reference](/game-api/compute-host-api). Clients need no
  changes.
- **Permissions:** two new org permission keys — `manage_compute` (authoring)
  and `view_compute_diagnostics` (monitoring). Org owners hold both by
  default; existing `manage_apps` grants are unaffected.
- **Billing:** three new shared-environment usage metrics with free hourly
  allowances — `wasm_compute_units`, `wasm_egress_msgs`, `wasm_egress_bytes`
  (see [Shared environment](/management-api/shared-environment)). Rates are
  placeholders pending load-test calibration.
- The management UI app dashboard gains a **Compute** tab (author, deploy,
  watch compiles, monitor runs) driven by the same public API.

No existing schema fields, wire messages, or behaviors changed.

**Game API v0.13.13 -- invoke policy denials return results; `userAppState` round-trip fix**

Two consumer-facing behavior fixes in `gameModelInvoke` and the per-user app
state store (no schema shape or wire change):

- **Invoke policy denials are results, not errors.** A `gameModelInvoke`
  rejected by the function's invoke policy (`owner_of_self`, `condition`,
  `is_host`, ...) now resolves with `success: false` and an `errorMessage`,
  and writes a failure event visible in `gameModelEvents` — matching the
  documented kit contract ("authority denials are not exceptions — check
  `success`"). Scope violations (an `invokeScope: "server"` function called
  without app-admin rights) still throw `FORBIDDEN`. If your client caught
  `FORBIDDEN` to detect gameplay denials, check `success` instead;
  `@crowdedkingdoms/crowdyjs@8.4.6` and CrowdyCPP handle both server
  generations transparently in their kit helpers.
- **`updateUserAppState` stores what you send.** The mutation now decodes its
  base64 `state` input before storage, so `userAppState` / `userAppStates`
  return exactly the base64 that was written. Previously reads returned a
  double-encoded value; rows written through older servers return the correct
  encoding after their next write.

**CrowdyJS 8.4.5 / 8.4.6 (npm)** — `kitInvoke` maps `FORBIDDEN` policy
denials from older Game API builds onto the documented
`{ success: false, errorMessage }` result (8.4.6 republishes 8.4.5 with the
runtime `VERSION` constant synced).

**CrowdyCPP v0.1.0 -- initial public release of the native C++ SDK**

[CrowdyCPP](https://github.com/CrowdedKingdoms/CrowdyCPP) is the official
portable C++ SDK (C++20, CMake, Linux/Windows/macOS), now documented in the
new [CrowdyCPP](/crowdycpp/intro) docs tab:

- **Native UDP replication.** Unlike browser-first CrowdyJS, replication goes
  directly to the replication servers over the
  [Replication API wire protocol](/replication-api/wire-formats) — zero-copy
  framing, HMAC-signed sends, verified receives, automatic token refresh and
  reconnect. See [Replication client](/crowdycpp/replication-client).
- **Full GraphQL surface parity with CrowdyJS** (same domains, two-token
  model, and error codes), a [WorldSession](/crowdycpp/world-session) layer
  mirroring World Stores, and the full 15-layer
  [Game Kit](/crowdycpp/game-kit) with blueprint equivalence — worlds
  deployed from either SDK are playable from both.
- **Engine-wrappable by design**: pluggable HTTP/crypto/clock/log interfaces
  and a thread-free manual-pump mode for engine plugins. See
  [Engine integration](/crowdycpp/engine-integration).

SDK-only: no schema or wire change; servers need no changes.

## 2026-07-18

**Game API v0.13.12.2 + CrowdyJS 8.4.1 -- schema hygiene + plot owner-mirror kinds (additive)**

A description-only hygiene pass on the Game API schema (no wire, DDL, or
behavior change) plus a small CrowdyJS Game Kit patch:

- **`ActorUpdateResponse` / `VoxelUpdateResponse` are formally marked
  legacy.** These `UdpNotification` union members are never emitted — the
  game server retired their dedicated opcodes; an applied update arrives as
  your own `*Notification` self-echo and failures arrive as
  `GenericErrorResponse`. Their type descriptions, the union description,
  and the [UDP proxy guide](/game-api/graphql-udp-proxy-api) now say so
  explicitly, and the guide's example subscription no longer selects them.
  They remain in the union for backward compatibility and will be removed in
  a future major version.
- **Deprecation reasons now carry removal dates** (per the agent-readiness
  checklist): the offset-pagination `limit`/`offset` args on
  `voxelUpdateHistory`/`gameModelEvents` (and their `*Connection` variants,
  where they are ignored) state removal no earlier than 2027-01-01.
- **CrowdyJS 8.4.1**: `plotBlueprint` gains `ownerIdKind: 'int' | 'string'`
  — string owner mirrors (the Blocks-with-Friends convention) now work with
  kit plots: guards compare via `to_string($caller_user_id)`, buying writes
  the owner as a string, and `""` is the for-sale sentinel. The bundled
  schema/reference pick up the hygiene descriptions.

Published SDL + GraphQL reference regenerated. Requires nothing — additive
documentation; clients need no changes.

## 2026-07-18

**CrowdyJS 8.4.0 -- World Stores: SDK-managed game state (additive)**

A new opt-in layer, `@crowdedkingdoms/crowdyjs/stores`, moves the client-side
bookkeeping every game hand-writes (actor registries, pose codecs, chunk
caches, chat rings, host polling — ~1,600+ LOC in the reference MMO) into the
SDK as typed, queryable, source-of-truth stores fed by ONE shared
`udpNotifications` subscription:

- **Codecs**: `StateCodec<T>` with `jsonCodec` / `textCodec` / `rawCodec` and
  `structCodec` — a declarative fixed-layout binary DSL for replication
  state (the 48-byte pose in ~10 lines). Developers register their custom
  types + encoders/decoders once; stores speak typed values everywhere.
- **`session.self`** (LocalActorStore): minted + persisted actor uuid, typed
  state, a **5 Hz send loop** with send-on-change dedup + periodic
  keyframes, and queryable `lastSent` / `lastAck` (the applied self-echo) /
  `lastError` / `status`.
- **`session.actors`** (RemoteActorStore): decode-once registry with
  self-echo filtering, timestamped sample history for interpolation,
  read-time staleness + reaping, join/update/leave events, and **lanes**
  (players vs mobs from one stream).
- **`session.errors`**: `GenericErrorResponse`s attributed to the tracked
  sends that caused them (per-actor lookup, ring buffer).
- **`session.chunks`** (ChunkStore): deduped `getChunksByDistance` loading
  with automatic sparse-voxel-state hydration, realtime `voxelUpdate` merge,
  typed voxel/chunk-state codecs, optimistic `setVoxel`, and the
  deterministic-worldgen write-back pattern (`onMissing` + throttled queue).
- **Messaging**: `channelInbox` (per-channel typed history — inbound channel
  fan-out at last), `actorInbox` (typed direct messages), `events`
  (per-eventType codecs for client/server events + `lastEvent`).
- **Durable**: `host` (heartbeat tracker), `save` (typed app save blob with
  debounced autosave), `avatar` (typed public/private/app state), `model`
  (ContainerMirror — typed game-model snapshots with notify-to-pull channel
  binding).

Ergonomics: **compile-time toggles** — the core client never imports the
layer (`"sideEffects": false`; unimported stores tree-shake away) and the
session's TypeScript type is conditional on the config, so unconfigured
stores don't exist. **Background-tab safe** — writes ride unthrottled
WebSocket events; timer-driven work runs on an injectable `Ticker` with a
`workerTicker()` (dedicated Web Worker, exempt from background-tab timer
throttling). SDK-only: no schema or wire change. See
[CrowdyJS → World Stores](/crowdyjs/stores).

## 2026-07-18

**CrowdyJS 8.3.0 -- Game Kit genre layers (additive)**

The Game Kit grows from four building blocks to a genre-covering catalog —
eleven new layers, each a blueprint builder + typed runtime helper, all pure
composition over the existing GraphQL surface (no schema change):

- **Economy** (`economyBlueprint` / `kit.economy`): multi-currency wallets,
  atomic shop buys, `$self_owner_id`-pinned escrow trades and player market,
  optional restock automation. Trusted mints default to server scope.
- **Progression** (`kit.progression`): xp/levels via the `fn:` curve-helper
  pattern, skill prerequisite chains, threshold achievements, host-gated
  rating for match results.
- **Loot** (`kit.loot`): weighted tables unrolled into seed-driven expression
  chains at build time, atomic single-claim grants, event-triggered pooled
  drops.
- **Quests** (`kit.quests`): event-automation progress, atomic
  claim-into-stack+wallet, cron daily resets.
- **Combat** (`kit.combat`): server-side damage/death, status-effect ticks
  via the selector-join pattern, `turnBased` / `hostSynced` / `reviveGroup`
  options.
- **Matches** (`kit.matches`): session-backed lobbies/rounds/turns/scores
  with a per-match notification channel (notify-to-pull; `onMatchChanged`)
  and counter-based turn ticks.
- **Decks** (`kit.decks`): hidden hands via owner-visibility properties (the
  two-property reveal trick) and shuffle-by-position automations.
- **World simulation** (`kit.worldsim`): day/night clock with a spatial
  notification, regenerating nodes, crops, host-read wave counters.
- **Social** (`kit.social` + `guildBlueprint`): parties/guilds/chat over
  teams + channels, grid territory grants, and a composite guild-hall + bank
  blueprint.
- **Leaderboards** (`kit.leaderboards`): trusted keep-best submits,
  client-side ranking, cron season rolls.
- **Monetization** (`kit.features` + `featureGate`): feature keys, tier
  grants, and `*policyExtra` gating options on the plot/lock builders.

Cross-cutting: `blueprints.ts` split into per-concept modules (import paths
unchanged), shared `KitTrustedAuthority` / `ownerIdKind` conventions, and a
new pattern guide (simulation tiers, notify-to-pull, timers without a clock,
hidden information, anti-cheat checklist). See
[CrowdyJS → Game Kit](/crowdyjs/game-kit) and the expanded
[genre map](/game-api/modeling-game-concepts#genre-map). Requires
`cks-game-api` v0.13.12.1+.

## 2026-07-18

**Game API -- permission-read builtins + selector permission predicates (additive)**

Game-model logic can now **read** the runtime grid ACL and grid layout,
completing the read+write loop that permission effects opened:

- **Six new expression builtins**, usable in mutations, return expressions,
  notification args, permission-effect expressions, and policy `condition`
  rules: `has_grid_permission(user, key[, grid])`,
  `grid_at(cx, cy, cz[, mode])` (overlap modes `first` | `smallest` |
  `largest`), `has_chunk_permission(user, key, cx, cy, cz[, mode])`,
  `grid_contains`, `grid_min`, `grid_max`. Reads are app-scoped, cached per
  invocation, charged 25 gas per uncached lookup, and observe grants applied
  by the same invocation's permission effects (read-your-writes).
- **Automation selector permission predicates**: `selfPermissionWhere` /
  `candidatePermissionWhere` filter automation targets by whether the user
  behind a container has/lacks a grid permission (owner- or property-derived
  user id; literal, property-derived, or any-grid scope) — one batched ACL
  query per predicate. Validated at `gameModelUpsertAutomation` time.
- Upload static analysis warns on wrong builtin arity, invalid `mode`/axis
  literals, and unknown permission keys.

Read-only feature: no schema migration and no wire change. See
[Game Models → Reading permissions from expressions](/game-api/game-models#reading-permissions-from-expressions)
and [Autonomous processes → Permission predicates](/game-api/autonomous-processes#permission-predicates).
CrowdyJS 8.2.0 ships the matching Game Kit surface (`plotBlueprint`,
chunk-permission lock authority, typed selector predicates). Requires
`cks-game-api` v0.13.12+.

## 2026-07-17

**Game API -- model permission effects (additive)**

Game-model functions can now **write runtime grid permissions** as declared,
transactional effects. A new `permissionEffects` array on
`gameModelUpsertFunction` / `gameModelSeed` functions declares grants/revokes
(`{ action, permissionKeys, userExpression, gridIdExpression,
ttlSecondsExpression? }`) that apply **in the same transaction** as the
function's property mutations — "pay gold AND get plot access" is one atomic
invoke, immediately enforced by the replication layer on movement/voxel writes.
Details:

- Expressions are compiled server-side and evaluated in the invocation context;
  the system params `$caller_user_id`, `$current_turn_user_id`,
  `$self_owner_id`, and `$session_id` are now injected into **function-body**
  evaluation as well (previously policy `condition` expressions only) and
  cannot be spoofed by same-named caller params.
- Effects are capped at 4 per function, gas-charged, validated against the
  `runtime_permissions` catalog, and require the grantee to hold app access; a
  failing effect rolls back the whole invocation (`success: false`).
- New audit field `GmEvent.permissionEffectsAppliedJson` records every applied
  effect (player- and automation-driven alike).
- New types: `FunctionPermissionEffectInput`, `GmFunctionPermissionEffect`
  (returned on `GmFunction.permissionEffects`).

See [Game Models → Permission effects](/game-api/game-models#permission-effects-functions-that-write-grid-permissions)
and the worked land-purchase example in
[Modeling game concepts](/game-api/modeling-game-concepts#custom-permissions-on-game-objects).
Requires `cks-game-api` with the `2026-07-17-model-permission-effects` migration.

## 2026-07-10

**Unreal SDK 2.1.0 -- Crowdy State, replicated subsystems, and host authority**

A large, mostly additive release on the 2.0 architecture: a client-authoritative view plane for
per-property replication, non-actor subsystem participants, and an explicit host-authority and
ownership surface. New capabilities:

- **Crowdy State property replication.** Mark a `UPROPERTY` or a Blueprint variable with
  `meta=(CrowdyState)` and the owning client diffs and replicates just that value to peers on
  the client-authoritative view plane, with no snapshot struct or executor. Bare per-property
  markers tune it: `CrowdyOnRep` (a parameterless RepNotify), `CrowdyOwnerOnly` (deliver only
  to the entity's owner), `CrowdyManualDirty` (send on an explicit `MarkStateDirty` rather than
  every tick), and `CrowdyHeartbeat` (opt into the periodic keyframe re-send for late joiners).
  See [Crowdy State](/unreal-sdk/runtime/crowdy-state) and the
  [metadata keys reference](/unreal-sdk/reference/state-meta-keys).
- **Replicated subsystems.** A host-owned UE Subsystem can take part in both view planes
  (Crowdy State properties and CrowdyEvents) without becoming an actor, via a function library
  or two abstract base classes. See
  [Replicated subsystems](/unreal-sdk/runtime/replicated-subsystems).
- **Host authority and explicit ownership transfer.** New `Ownership`, `HostOverride`, and
  `StateHeartbeat` fields on `UCrowdyEntityComponent` for level-placed world entities and host
  super-user writes; a request/grant ownership-transfer flow (`UCrowdyOwnershipTransfer`); a
  server-validated host check (the **Is Crowdy Entity Host (Server)** node); and client-side
  ownership helpers (`DoesCrowdyEntityOwn`, `IsCrowdyEntityHost`, `GetCrowdyEntityComponent`).
  See [Host authority](/unreal-sdk/runtime/host-authority) and
  [Entities and spawning](/unreal-sdk/runtime/entities-and-spawning#ownership-and-authority).

**Breaking changes**

These are the only changes that touch an existing 2.0 project; everything above is additive.

- **`CrowdyHasAuthority` renamed.** The Blueprint-pure "am I the host" check on
  `UCrowdyUtilities` is now **`GetCrowdyHasAuthority`** (Blueprint DisplayName still "Crowdy Has
  Authority"). The old `CrowdyHasAuthority` name is now the exec/branch variant (Blueprint
  "Switch Crowdy Has Authority"). Update C++ callers from `CrowdyHasAuthority(this)` to
  `GetCrowdyHasAuthority(this)`; Blueprint nodes re-resolve on recompile. See
  [Host authority](/unreal-sdk/runtime/host-authority#checking-authority).
- **`ECrowdyDecayRate` corrected.** Removed the non-functional **`Linear_100`** value (the
  `CrowdyDecay` option on a `SpatialMulticast` CrowdyEvent). It shared an underlying value with
  `Linear_50`, so the two were indistinguishable on the wire. The ladder is now `No_Decay` (0),
  `Exponential_Decay` (1), `Linear_50` (2), `Linear_25` (3), `Linear_10` (4), `Linear_5` (5). A
  Blueprint that had selected "Linear 100 Decay" should re-select a rate; it behaved exactly
  like "Linear 50 Decay" before. See
  [Recipients and routing](/unreal-sdk/runtime/recipients-and-routing).
- **RPC container parameters hardened.** A CrowdyEvent parameter that buries a container
  (`TArray`/`TSet`/`TMap`) inside a struct is now rejected at registration, because a malformed
  packet could drive an unbounded allocation from its element count; pass the container as a
  top-level parameter instead. Direct `TArray`/`TSet`/`TMap` of supported element types still
  work. The set/map parameter wire format also changed (internal blob version 2), so every peer
  must run a build from this line -- a mixed 2.0/2.1 session drops set/map RPCs at the version
  gate. See [RPC parameter types](/unreal-sdk/reference/rpc-types).

## 2026-07-01

**Social and magic-link sign-in (Unreal SDK, additive)**

- Three new Blueprint Async Action latent nodes round out the sign-in surface: **Dev
  Login**, **Magic Link Sign In**, and **Social Sign In**, joining the existing
  Login / Register / Restore Session nodes on `UCrowdyAuthentication`. Each has
  Success/Error exec pins, so a Blueprint-only project no longer needs to wire the
  underlying delegates by hand. See
  [Blueprint nodes](/unreal-sdk/runtime/authentication#blueprint-nodes).
- **Crowdy Studio's** sign-in page now offers a federated social provider or an
  emailed magic link, alongside the existing email + password, dev sign-in, and
  organization token options. All four session-scoped methods (password, social,
  magic link, dev) grant full authoring access — teams, channels, grids, game
  models, Config Sync, and the Web Console; only the organization token remains
  management-only. See
  [Crowdy Studio: Signing in](/unreal-sdk/studio/overview#signing-in).

No breaking changes — email + password sign-in (`Login`/`Register`) remains fully
supported side by side with the new methods.

## 2026-06-28

**Dedicated environments available to all studios (Management API)**

- You can now create **multi-VM dedicated environments** (`environmentClass: "dedicated"`,
  the default) directly — an isolated Game API fleet, database, and Buddy replication stack
  for your studio. Previously only the single-VM **developer sandbox**
  (`environmentClass: "dev_single"`) was available and dedicated returned a "coming soon"
  error. `createEnvironment` / `environmentQuote` take the four per-component flavors
  (`databaseFlavor`, `gameApiFlavor`, `udpBuddyFlavor`, `caddyFlavor`) plus scaling bounds;
  creation still gates on the org wallet (`environmentQuote.canCreate`) and requires
  `manage_environments`. See [Dedicated environments](/management-api/dedicated-environments).
- `CksEnvironment` gains an additive **`isShared`** boolean (true only for the platform's
  shared environment; always false for your environments). No breaking changes. Clients
  still discover an app's runtime via `app.gameApiUrl` / `platformConfig.sharedGameApiUrl` —
  the shared Game API endpoint is resolved dynamically, so never hard-code it.

## 2026-06-26

**CrowdyJS package — npm org move, v6 version line restored**

- The SDK is published as **`@crowdedkingdoms/crowdyjs`** (moved from the former
  `@crowdedkingdomstudios` org). The version line **continues the v6 series**: the
  current release is **`6.1.1`** (npm `latest`), the direct successor to the old org's
  `6.1.0` — **same code, new package name**. Two interim `1.0.x` publishes during the
  org move reset the version by mistake; they remain installable but are superseded by
  `6.1.1`. Install is unpinned, so `npm install @crowdedkingdoms/crowdyjs` resolves to
  `6.1.1`. See the [CrowdyJS SDK guide](/crowdyjs/readme).

## 2026-06-26

**Game model automations / NPCs (Game API, additive)**

- **Server-driven automations** invoke your [game model functions](/game-api/game-models)
  on their own — on a schedule or in reaction to model activity — so you can build NPCs,
  spawners, and ticking world systems that run with no client connected. New GraphQL:
  `gameModelUpsertAutomation`, `gameModelUpsertAutomationTrigger`, `gameModelRunAutomation`,
  `gameModelSetAutomationEnabled`/`Policy`, and the monitoring queries
  `gameModelAutomations`, `gameModelAutomationRuns`, `gameModelAutomationStats`, and
  `gameModelAppDiagnostics`. The entry-point function opts in with `autonomousInvocable`.
  All require `manage_apps`. See [Autonomous processes (NPCs)](/game-api/autonomous-processes).

**Model-driven realtime notifications (Game API, additive)**

- A model function can now **push a realtime notification** to clients as part of its
  invocation, via a `notifications` array on `gameModelUpsertFunction` (and `gameModelSeed`).
  Each effect has a `kind` (`spatial` | `channel` | `actor`) and arguments built from model
  expressions; the notification arrives on the existing `udpNotifications` stream as a
  `ServerEventNotification`, `ChannelMessageNotification`, or `SingleActorMessageNotification`.
  Player-invoked and automation-driven changes notify players identically.
  See [Model-driven notifications](/game-api/model-driven-notifications).

**`deleteGrid` (Game API, additive)**

- New `deleteGrid(input: { appId, gridId })` mutation removes a studio-created peer grid
  (e.g. to unblock `GRID_OVERLAPS_EXISTING`). Hybrid result like `createGrid`; refuses the
  default world grid and grids with nested children; requires `manage_apps`. See
  [Grids and permissions](/game-api/grids-and-permissions#deleting-a-grid).

**Management API additions (additive)**

- `environmentQuote` and `orgEnvironment(s)` now return `environmentClass` and
  `singleBoxFlavor`; `appUsageSummary` now returns automation activity totals
  (`automationRuns`, `automationInvocations`, `automationComputeUnits`); new
  `buddyBillingTiers` / `graphqlBillingTiers` / `postgresBillingTiers` catalogs with
  `updateEnvironmentBillingTiers`; and a `playerPulse` live-concurrency query.

**CrowdyJS v6.1 (SDK, additive)**

- The SDK now wraps the **full** public surface — every non-deprecated root field has a
  typed method, including the above. New highlights: `client.gameApps.deleteGrid`, the
  game-model automation + `notifications` wrappers, the game-model studio reads, and Relay
  `*Connection` cursor-pagination variants alongside the offset lists. `deleteGrid` requires
  a server on release `v0.1.33+`. See the CrowdyJS guides:
  [Automations](/crowdyjs/automations), [Model-driven notifications](/crowdyjs/model-notifications),
  and [Grids](/crowdyjs/grids).

## 2026-06-13

**Signed server→client notifications (Replication API)**

- Buddy now **signs server→client long-spatial notifications** (actor / voxel / audio /
  text / generic-spatial / single-actor) with a per-recipient **HMAC-SHA256** keyed on
  your 64-octet game token — the same scheme you already use to sign client→server
  messages. Signed notifications arrive with `containsAuth = 1` and a 32-byte HMAC in the
  spatial tail (the 8-byte slot after it carries server epoch-millis, not part of the HMAC).
- **Native (direct-UDP) clients:** verify the HMAC and drop any `containsAuth = 1`
  long-spatial notification whose tag doesn't match. See [HMAC](/replication-api/hmac)
  for the algorithm, key handling, and per-language libraries (OpenSSL/C++, .NET, Node,
  Python, Go, Rust), plus [Send and receive](/replication-api/send-and-receive).
- **Browser clients on the GraphQL UDP proxy are unaffected** — the proxy handles the
  signed format transparently.

Additive to the wire layout (the HMAC slot already existed); no fields removed.

## 2026-06-13 (load shedding)

**Resource-aware load shedding (additive)**

- **New `ServerState` values `NearCapacity` and `Full`.** Game servers now report a
  resource-overload state. `serverWithLeastClients` already returns only
  `ReadyForClients` servers, so an overloaded server is automatically skipped for new
  connections — no client change needed for host selection.
- **New Replication API opcode `COMMAND_RECONNECT` (22).** A server under hard overload
  asks a client to move: `[22][32B HMAC]`, where the HMAC (HMAC-SHA256 keyed on your
  64-octet game token over the type byte) authenticates the command as server-originated.
  Native (direct-UDP) clients should verify it, then re-query `serverWithLeastClients` and
  reconnect within the grace period; see [Operations → Load shedding](/replication-api/operations) and
  [Wire formats](/replication-api/wire-formats). **Browser clients on the GraphQL UDP
  proxy are migrated automatically** and never see this message.

No fields were removed; both changes are additive.

## 2026-06-13 (later)

**Agent-readiness design changes (additive)**

- **Idempotency keys.** Economy-sensitive and destructive mutations now accept an optional
  `idempotencyKey` (on the `input` object or as a top-level argument). Replaying with the
  same key + identical parameters returns the first result instead of re-applying; a
  different payload under the same key returns the new `IDEMPOTENCY_CONFLICT` error code.
  Covers Management API checkout/billing/grant/quota/app/environment/org mutations and Game
  API `rollbackVoxelUpdates`, `revokeGridPermissions`, team and actor/avatar deletes.
- **Relay cursor pagination.** New `*Connection` queries (`first`/`after`, `edges`/`pageInfo`)
  for the largest lists (e.g. `usersConnection`, `appsConnection`, `checkoutsConnection`,
  `paymentEventsConnection`, `walletTransactionsConnection`, `appUserAccessConnection`,
  `voxelUpdateHistoryConnection`, `actorsConnection`, `gameModelEventsConnection`). The
  offset queries remain; their `limit`/`offset` args are now `@deprecated`. See
  [Pagination](/overview/pagination).
- **Machine-readable permissions.** Guarded fields now carry a `@requiresPermission(scope:,
  permission:, scopeArg:)` directive in the SDL/introspection.
- **Structured errors.** New error codes (`SCOPE_MISSING`, `CONFLICT`, `IDEMPOTENCY_CONFLICT`,
  `RATE_LIMITED`, plus corrected `UNAUTHENTICATED`/`NOT_FOUND`) and `extensions.remediation` /
  `extensions.requiredPermission`. See [Error codes](/overview/error-codes).
- **Security fix.** `effectiveQuota` now requires `view_usage` on the most-specific scope
  (tier/app/org) instead of being readable by any authenticated user; metric-only lookups
  (free-tier defaults) remain open. This is a deliberate behavior change for cross-tenant
  callers.

No fields were removed. The ID/UUID scheme and the UDP wire-protocol versioning are
unchanged by design.

## 2026-06-13

**Documentation & schema self-description**

- Every public GraphQL query, mutation, subscription, argument, field, and enum value now
  carries a description across the Management API and Game API — including the required
  permission and side effects on each operation. These flow into the
  [GraphQL reference](/game-api/reference/graphql-overview) and the downloadable SDL.
- Published downloadable SDL at stable URLs:
  [`/schema/management-api.graphql`](pathname:///schema/management-api.graphql),
  [`/schema/game-api.graphql`](pathname:///schema/game-api.graphql),
  [`/schema/crowdyjs.graphql`](pathname:///schema/crowdyjs.graphql).
- Added an [`/llms.txt`](pathname:///llms.txt) index and a
  [For AI agents](/overview/for-ai-agents) quickstart, plus consolidated
  [Error codes](/overview/error-codes), [Pagination](/overview/pagination), and
  [Rate limits](/overview/rate-limits) references.
- Replication API: published a consolidated opcode/byte-layout reference, documented the
  NAK-vs-silent-drop failure model and the best-effort reliability contract, and added a
  [worked example packet](/replication-api/example-packet).

**Deprecations (Management API)**

- `CheckoutPurpose.DONATION` and `CheckoutPurpose.PROPERTY_TOKENS` are deprecated — these
  products are no longer purchasable. Use `ORG_WALLET_TOPUP` or `APP_ACCESS_PURCHASE`.
  Existing historical checkouts are unaffected.
- The `myDonationData` and `myPropertyTokens` queries are deprecated (legacy read paths
  retained for historical records only).

No fields were removed in this release. Deprecated fields continue to function.

## Earlier

Prior releases predate this public changelog. For SDK breaking-change notes, see the
CrowdyJS migration guide in the [CrowdyJS](/crowdyjs/readme) docs.
