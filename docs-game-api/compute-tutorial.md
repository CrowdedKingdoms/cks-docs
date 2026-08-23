---
sidebar_position: 26
title: "Compute tutorial: zero to a live module"
---

# Compute tutorial: zero to a live module

This is the fastest path from nothing to a **Rust compute module running on
your game's servers** — budget 30 minutes end to end, most of it reading. It
uses the `crowdy-compute` CLI from the
[compute-examples repository folder](https://github.com/CrowdedKingdoms)
(`cks-project-root/compute-examples/`), which wraps the
[Compute Modules](/game-api/compute-modules) GraphQL surface.

This tutorial assumes compute is the right tier. For the decision criteria
and the recommended hybrid pattern, see
[Model API vs Compute](/game-api/model-vs-compute).

## 0. Prerequisites (~5 min)

- **Node 20+** and the examples folder: `cd compute-examples && npm install`.
- **An app** you administer (your user needs the org `manage_compute`
  permission) on an environment with compute enabled.
- Environment for the CLI:

```bash
# Both variables name the SAME origin. There is one GraphQL origin per
# environment: management and game are two surfaces of it, not two servers.
# `CROWDY_GAME_URL` carries the `/graphql` path and `CROWDY_MANAGEMENT_URL`
# does not — that is the only difference between them.
#
# Take the origin from `serverStatus.gameClientBootstrap(appId)` (it returns
# `gameApiUrl` for your app's datacenter) or from your environment's dashboard.
# Do not copy an origin out of a tutorial: this line named
# `game.dev.crowdedkingdoms.com` until 2026-08-22, a host from a retired naming
# generation that has been NXDOMAIN since long before that, so the two exports
# below disagreed with each other while looking equally plausible.
export CROWDY_MANAGEMENT_URL=https://<your environment's origin>
export CROWDY_GAME_URL=https://<your environment's origin>/graphql
export APP_ID=<your app id>
export ADMIN_EMAIL=<your email>        # dev environments (or ADMIN_TOKEN=<app token>)
```

- **Optional** (for local builds before deploying): a Rust toolchain with
  `rustup target add wasm32-wasip1`. Without it, `check` still validates all
  the deploy rules and the platform compiles for you on deploy.

## 1. Scaffold (~1 min)

```bash
npm run crowdy-compute -- new my-module
```

You get a ready-to-deploy crate:

- `my-module/Cargo.toml` — pinned to `crowdy-compute-sdk` and the
  `crowdy-game-kit-core` utility crate (both platform-vendored).
- `my-module/src/lib.rs` — a ticking module with durable state
  (`kit::state::Persisted`), a 10-second heartbeat log (`kit::clock::Every`),
  and a `status` invoke export (`kit::invoke::Router`).
- `my-module/deploy.json` — the deployment manifest: module name, triggers
  (a 2 Hz tick + the `status` export), and optional policy overrides.

## 2. Check (~1 min)

```bash
npm run crowdy-compute -- check my-module
```

This mirrors the platform's deploy validation locally — file layout, size
caps, the dependency allowlist, no build scripts — and, when you have the
toolchain, runs a real `cargo build --target wasm32-wasip1` so compile errors
surface before you deploy.

## 3. Deploy (~2 min)

```bash
npm run crowdy-compute -- deploy my-module
```

Behind the scenes: `computeUpsertModule` → `computeDeployVersion` (the source
uploads; a game server compiles it — first compiles take a few seconds,
unchanged redeploys are skipped via the source hash) → triggers from
`deploy.json` (created only if missing) → `computeSetModuleEnabled`. Failures
print the compiler log.

## 4. Watch and invoke (~2 min)

```bash
npm run crowdy-compute -- watch
# [22:14:05] runs=3 failed=0 fuel=1220  my-module:3r/0f/closed
#    ... [my-module] 1: my-module alive: 42 ticks

npm run crowdy-compute -- invoke my-module status
# {"success":true,"ticks":57}
```

`watch` polls the monitoring queries (`computeModuleStats`,
`computeModuleLogs`); `invoke` is the synchronous RPC path. That's the whole
loop: edit `src/lib.rs`, `deploy`, `watch`. You have server-side Rust running
against your world.

## 5. Tour the examples (~15 min of reading)

Each example in `compute-examples/examples/` teaches one capability and
deploys the same way (`npm run crowdy-compute -- deploy examples/<name>`):

### `tick-counter` — the hello world
Durable state that survives redeploys and re-leases, tick cadence, invoke
routing. The scaffold template is this module.

### `scoreboard` — reacting to your game
An **event trigger** (`onEvent: function_invoked`) delivers every model
function invocation to the module's `on_event` entry point; it tallies scores
per player and serves `get_top`. This is the pattern for "when players do X,
the server computes Y".

### `npc-pathfinder` — what automations never could
A\* pathfinding over an obstacle grid, walked at 4 Hz with smooth
server-driven actor updates (`kit::wire`). Call `layout` to see the grid,
the current path, and the NPC's position — the server's "thoughts" as JSON.
Loops, real algorithms, live movement: this is the compute layer's reason to
exist.

### `world-weather` — a living world
An `always_on` module (runs with zero players connected) stepping a weather
state machine; changes broadcast to nearby clients as type-90 server events
and to **other modules** via `emit_compute_event("weather_changed")` — the
module-to-module signalling pattern.

### `mini-game` — invoke-driven gameplay
Rock-paper-scissors as a synchronous RPC: the platform binds `callerUserId`
server-side (unspoofable), the house move comes from server-held RNG the
client can never observe, and per-player records persist in module state.

## Where to go next

- [Compute engines](/game-api/compute-engines) — skip the from-scratch
  simulation: `crowdy-compute new my-mobs --engine mob` scaffolds a
  data-driven NPC/mob/world engine you parameterize with containers.
- [Compute Modules](/game-api/compute-modules) — concepts, lifecycle, limits,
  billing.
- [Compute host API](/game-api/compute-host-api) — everything a module can
  call.
- The `crowdy-game-kit` crate family (used by every example): `kit-core`
  (durable state, wire codecs, chunk math, presence, cadence, invoke
  routing, RNG), `kit-ai` (pathfinding/steering/behavior trees), `kit-sim`
  (day cycle/weather/nodes/growth), `kit-play` (the combat referee) — so
  your module logic stays about your game.
