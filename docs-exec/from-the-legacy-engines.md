---
sidebar_position: 10
title: From the legacy engines
---

# From the legacy engines to ck-exec

:::caution Dev-tier preview
Available on the **dev** environment only; see the [overview](intro).
:::

ck-exec replaces four legacy engines of the game API: **game models** (containers, typed
properties and functions in an expression language), **automations** (schedules, triggers and
timers over the same functions), **compute modules** (studio WASM run inside the game API) and
**player code** (grid-scoped player modules, player models and automations). This page maps each
thing you did with them to what you do on ck-exec, and links the page that explains it. For a
worked example, see [port a compute module](port-a-compute-module).

## Running your logic

| Legacy | ck-exec | Page |
|---|---|---|
| Game-model functions (mutations, `returnExpression`) | Hub handlers in Rust with `ckx-sdk`; a hub runs one handler at a time | [Overview](intro) |
| Container types with typed properties, `visibility`, edges | The hub's own types, or `ckx_sdk::model` for typed containers, edges and per-property visibility | [Builds](builds#typed-state) |
| Authority rules on the caller (`owner_of_self`, `is_host`, `is_current_turn`, …) | Checks in your handler against the caller (`call.player()`, `call.developer()`) | [Overview](intro) |
| Authority rules on platform data (`tier_feature`, `group_permission`, `grid_permission`) | `players.features`, `players.check_permission`, `grids.check_permission` | [World and platform data](world-and-platform-data) |
| Compute modules (`compute*`) | Hubs (stateful) and spokes (stateless, scaled out) | [Overview](intro) |
| Compute templates, engines and Game Kit blueprints | Starter packs: `world-tick`, `matchmaker`, `session`, `npc-mobs`, `grid-mod` | [Builds](builds#starter-packs) |
| Sessions (`gameModelCreateSession`, turns, host transfer) | A hub per session (the `session` starter), its state on a topic | [Builds](builds#starter-packs) |
| `emit_event`, `model_invoke`, automation actions, cascades | Calls between instances (`ctx.call`, `ctx.send`) and topics (`ctx.publish`, `ctx.subscribe`) | [Timers, subscriptions and presence](timers-and-presence#subscriptions-between-hubs) |
| Expression lint and quarantine, circuit breakers | The Rust compiler and the manifest checks; a crash-looping instance is held back and placed again | [Operations](operations#instances-and-versions) |

## Calling it from clients

| Legacy | ck-exec | Page |
|---|---|---|
| `gameModelInvoke`, `computeInvoke`, `playerComputeInvoke` | `execConnect`, then calls over the host's WebSocket gateway | [Connect from a game](connect-from-a-game) |
| CrowdyJS `gameModel`, `compute`, `playerCompute`; their CrowdyCPP twins | CrowdyJS `client.exec`, CrowdyCPP `client.exec()` | [Connect from a game](connect-from-a-game) |
| State reads (`gameModelContainerState`, `gameModelTraverse`, session reads, events) | Endpoints that return state | [Connect from a game](connect-from-a-game) |
| `gameModelContainerChanged`, `gameModelSessionChanged` | Topics a client subscribes to | [Connect from a game](connect-from-a-game) |
| `gameModelActivePlayerCount` | The root hub hears presence and publishes the count on a topic | [Timers, subscriptions and presence](timers-and-presence#presence) |
| The invoke limit (120 calls per 10 s per player and app) | The same numbers at the gateway, per host, refused `Busy` ("rate limited") | [Operations](operations#call-limits) |

## State

| Legacy | ck-exec | Page |
|---|---|---|
| Containers and properties, committed on every invoke | Hub memory, snapshotted every 5 to 60 seconds and when it stops | [Overview](intro) |
| Data that needed every write kept | `ctx.persist_now()` | [Timers, subscriptions and presence](timers-and-presence#saving-now) |
| A module's state blob (`state_get` / `state_set`) | Hub memory, snapshots up to 8 MiB | [Overview](intro) |
| `user_state`, `avatar_state` | `players.state`, `players.set_state`, `players.avatar_state` | [World and platform data](world-and-platform-data) |
| `grid_state` | A hub keyed by the grid | [World and platform data](world-and-platform-data) |
| `gameModelSeed` | The type's spawn seed in the manifest | [Overview](intro) |
| Redeploys that change the shape of state | `load(snapshot, from_version)` migrates | [Overview](intro) |

## Timers and triggers

| Legacy | ck-exec | Page |
|---|---|---|
| Compute ticks (`tickHz`) | `ctx.timer_every` | [Timers](timers-and-presence#timers) |
| Automation schedules: `interval` | `ctx.timer_every` | [Timers](timers-and-presence#timers) |
| Automation schedules: `cron` | `ctx.timer_cron` with `ckx_sdk::cron`, the same syntax | [Cron schedules](timers-and-presence#cron-schedules) |
| One-shot timers (`gameModelScheduleInvoke`, a function's `timers`, `dedupeKey`) | `ctx.timer_after`; the timer's name is its dedupe key | [Timers](timers-and-presence#timers) |
| `player_joined`, `player_left`, `player_count_changed` | `on_presence` on the root hub | [Presence](timers-and-presence#presence) |
| A player joining or leaving what they play | `on_session` | [Sessions](timers-and-presence#sessions) |
| `function_invoked`, `property_changed`, `container_created` | The hub knows when it changes; others subscribe to its topics | [Subscriptions between hubs](timers-and-presence#subscriptions-between-hubs) |
| `grid_actor_changed`, `grid_voxel_changed` | A grid's world events, delivered to its mods (`on_world`) | [Mods](mods) |
| Manual runs (`gameModelRunAutomation`) and admin calls | `execConnectAsDeveloper`, then call the endpoint as a developer | [Operations](operations#developer-connections) |

## World and platform data

| Legacy host call | ck-exec | Page |
|---|---|---|
| `chunk_get`, `voxels_list`, `voxel_set` | `world.chunk`, `world.voxels`, `world.set_voxels` | [World and platform data](world-and-platform-data) |
| `actors_list`, `actors_list_radius` | `world.actors`, `world.actors_radius` | [World and platform data](world-and-platform-data) |
| `grid_permission_check`, `grid_at`, `grid_contains`, … | `grids.get`, `grids.check_permission` | [World and platform data](world-and-platform-data) |
| Permission effects | `permissions.grant`, `permissions.revoke` | [World and platform data](world-and-platform-data) |
| Wallets and the ledger | Not offered on ck-exec for now | |

## Realtime

| Legacy | ck-exec | Page |
|---|---|---|
| Function `notifications`, `emit_spatial`, `emit_channel` | `ctx.emit_spatial`, `ctx.emit_channel` | [Realtime events](realtime-events) |
| Server-driven actors (NPC and mob poses) | `ctx.emit_actor`, on the same wire | [Realtime events](realtime-events) |
| `client_event` from a module | Not offered: send what a client needs on a topic or as an event | [Realtime events](realtime-events) |

## Build and deploy

| Legacy | ck-exec | Page |
|---|---|---|
| `computeDeployVersion` (compile on the server) | `execBuild`, then `execDeploy` with the build | [Builds](builds#building) |
| Uploading built modules | `execDeploy` with the WASM | [Builds](builds#deploying-a-build) |
| Module versions and rollback | `execVersions`, `execActivateVersion` | [Operations](operations#instances-and-versions) |
| `computeSetModuleEnabled`, automation `enabled`, the policy kill switch | `execSetEnabled` for the app or one node type | [Operations](operations#the-kill-switch) |
| The `crowdy-compute` CLI | `ckx` | [Connect from a game](connect-from-a-game#deploying-from-a-script) |

## Operations

| Legacy | ck-exec | Page |
|---|---|---|
| `computeModuleLogs`, `playerComputeLogs` | `execLogs` | [Logs](operations#logs) |
| Runs, stats and diagnostics | `execInstances`, `execEndpointStats`, `execLogs` | [Operations](operations) |
| `gameModelFlow` | `execLogs(flow:)`: every line one call chain logged | [Following one call](operations#following-one-call) |
| Policy and ceilings (fuel, memory, run time, tick rate) | Manifest limits, within the platform's bounds | [Overview](intro) |
| Metering and `appComputeBudget` | Per-minute usage in compute units; an enforced budget pauses the app | [Usage and budgets](operations#usage-and-budgets) |

## Player code

| Legacy | ck-exec | Page |
|---|---|---|
| Player server modules (`playerComputeDeploy`, run as the grid owner) | Mods: `execModBuild`, `execModDeploy`, in the owner's own sandbox, confined to the grid | [Mods](mods) |
| Player client modules (browser WASM) | Unchanged; they can call hubs through the gateway. On dev, a new CLIENT-target deploy is refused with `ENGINE_SWITCHED_OFF` until client builds move to the ck-exec builder; client modules already built keep loading | [Mods](mods) |
| Player models and player automations | A mod's own state and timers, and its grid's world events | [Mods](mods) |
| `publishPlayerCode`, `acquirePlayerCode`, `installPlayerCode` | `execModPublish`, `execModListings`, `execModInstall` (no payments yet) | [Mods](mods) |
| Crowdy Studio deploying a SERVER target | The SERVER target as a mod (`serverEngine: 'ck-exec'`) | [Mods](mods) |

## Tools

| Legacy | ck-exec |
|---|---|
| CK Studio's Compute and Automations tabs | CK Studio's ck-exec tab on the app page: status, node types, versions and rollback, instances, logs |
| The Unreal SDK's game-model authoring | Not ported yet; the Unreal SDK moves to ck-exec in a later release |
