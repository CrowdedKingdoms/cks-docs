---
sidebar_position: 24
title: Compute Modules
---

# Compute Modules

[Game Models](/game-api/game-models) and [Autonomous Processes](/game-api/autonomous-processes)
put your rules and NPCs on the server with a deliberately **loop-free** expression
language — great for declarative rules, but you cannot write a pathfinder, a
market simulation, or a full world tick in it. **Compute Modules** are the
next level: you write **Rust**, deploy the source through the Game API, and the
platform compiles it to WebAssembly and runs it **server-side**, sandboxed, with:

- **Real computation** — loops, pathfinding, flocking, simulation. Anything Rust
  can express, bounded only by your compute budget.
- **Full access to your app's data** — a typed host API over your game-model
  containers, user/avatar/grid state, chunks, voxels, and actors. Always scoped
  to your own app; a module can never see another tenant.
- **Replication egress** — modules push spatial and channel notifications to
  connected players through the same realtime path as
  [model-driven notifications](/game-api/model-driven-notifications). Clients
  need **no new subscription**: module traffic arrives as ordinary
  `udpNotifications` events.

If you are deciding whether a rule belongs in a model function/automation
or in WASM, start with [Model API vs Compute](/game-api/model-vs-compute).

Runaway code is impossible by construction: every call runs under a
deterministic **fuel budget** (an instruction-count meter compiled into your
module) plus a wall-clock watchdog, layered circuit breakers, and per-app
policy ceilings. Compute time and module-driven replication traffic are metered
and billed to your app (see [Billing](#billing)).

All operations live on the **Game API** GraphQL endpoint. Authoring requires
the org **`manage_compute`** permission; monitoring requires
**`view_compute_diagnostics`** (see [Permissions](#permissions)).

## When to use which

| | Game Models + Automations | Compute Modules |
|---|---|---|
| Language | Loop-free expression DSL | Rust → WebAssembly |
| Best for | Declarative rules, invoke policies, simple NPC turns | Pathfinding, world simulation, server-authoritative AI, heavy logic |
| Data access | Model containers/properties | Broader typed host API (model data + world + app state) |
| Replication egress | Declared `notifications` effects | Imperative `emit_spatial` / `emit_channel` calls |
| Billing metric | `automation_compute_units` | `wasm_compute_units` (+ egress metrics) |

They coexist: models remain the right tool for declarative rules and
player-invoked functions, and modules can **react to model events**
(`function_invoked`, `property_changed`, `container_created`), so a hybrid
design — durable rules in the model, live simulation in a module — is normal.

## Writing a module

Modules are ordinary Rust `cdylib` crates built on the **`crowdy-compute-sdk`**
crate, which hides the WebAssembly ABI behind safe Rust. A complete minimal
module — this is also the starter template the management UI offers:

```toml
# Cargo.toml
[package]
name = "my-module"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
crowdy-compute-sdk = "0.1.0"
```

```rust
// src/lib.rs
use std::sync::atomic::{AtomicU64, Ordering};
static TICKS: AtomicU64 = AtomicU64::new(0);

fn on_init() {
    crowdy_compute_sdk::log(1, "module init");
}

fn on_tick(_dt_ms: u32) {
    let n = TICKS.fetch_add(1, Ordering::Relaxed) + 1;
    crowdy_compute_sdk::state_set(&n.to_le_bytes());
}

fn on_invoke(input: &[u8]) -> Vec<u8> {
    input.to_vec()
}

crowdy_compute_sdk::register_module!(init: on_init, tick: on_tick, invoke: on_invoke);
```

`register_module!` wires your functions to the entry points the platform calls:

| Entry point | Called when |
|---|---|
| `init()` | The module is loaded on a server (fresh instance). |
| `tick(dt_ms)` | On every tick of a `tick` trigger; `dt_ms` is the time since the previous tick. |
| `handle_invoke(input) -> Vec<u8>` | A client or tool calls `computeInvoke`. Input/output are raw bytes (JSON by convention). |
| `on_event(input)` | (Optional — 4-arg `register_module!` form with `event:`.) A subscribed model or compute event fires. |

Inside any entry point you can call the **host API** — data reads/writes,
replication emits, durable state, logging — documented in
[Compute host API](/game-api/compute-host-api).

### State: what survives and what doesn't

- **In-memory Rust state** (statics, heap) persists between ticks **only while
  the module instance stays loaded on the server currently running it**. A
  redeploy, an idle unload, a failure, or the ticks moving to another server
  starts a fresh instance (`init` runs again).
- **Durable state** must go through the platform: the module's own state blob
  (`state_get` / `state_set`, up to 256 KiB) or the host data API (containers,
  properties, app state).

Treat in-memory state as a cache. The starter module above is correct because
it persists its counter to the state blob every tick.

:::warning State blob writes on multi-server fleets
`computeInvoke` calls and event deliveries may run on a server that does
**not** hold your module's tick lease, on a separate short-lived instance
whose memory starts from the last persisted snapshot. State-blob writes are
revision-guarded: the tick-lease holder always wins, and a non-lease
instance's `state_set` is **dropped** (with a warning in
`computeModuleLogs`) if the lease holder persisted first. Consequence: never
keep referee-critical records (grants, receipts, scores) only in the state
blob — commit them to Model containers (`model_invoke`), which are
transactional and fleet-wide. The state blob is for rebuildable simulation
caches.
:::

### Source rules (validated at deploy time)

> **Deploying a ready-made engine?** Skip the source upload entirely:
> `computeDeployTemplate(appId, templateName)` deploys any engine from the
> [template registry](/game-api/compute-engines#deploying-engines-by-name-the-template-registry)
> by name (list them with `computeTemplates`).

`computeDeployVersion` validates the upload before anything compiles:

- **Files** — a JSON map of relative paths to contents. `Cargo.toml` and
  `src/lib.rs` are required; only `.rs` files under `src/` (plus `Cargo.toml`)
  are allowed. At most 32 files, 256 KiB per file, 1 MiB total.
- **Dependencies** — only the platform allowlist: `crowdy-compute-sdk`,
  `serde`, `serde_json`, `rand`. Compiles run **offline** against a vendored
  registry; arbitrary crates.io dependencies are rejected at deploy time, not
  at compile time.
- **No build-time code** — `build.rs`, a `[package] build = ...` key,
  `[build-dependencies]`, and path/git dependencies are all rejected. Only
  `[package]`, `[lib]`, and `[dependencies]` sections are allowed. Do not
  upload a `Cargo.lock`.
- **Versions** — `sdkVersion` and `abiVersion` must be platform-supported
  (currently SDK `0.1.0` – `0.1.5`, ABI `0`; `0.1.1` adds `voxels_list`,
  `0.1.2` adds batched/radius reads, `0.1.4` adds atomic world+model
  commits via `model_invoke_with_world`, `0.1.5` adds filtered/paged
  container lists via `containers_list_where`, and `0.1.3` adds transactional
  `model_invoke` + explicitly owned container creation). The SDK pins the
  ABI for you.
- **Module names** are crate-shaped: lowercase letter first, then lowercase
  letters, digits, `-`, `_` (max 128 chars).

There is no network, filesystem, or environment access from a module. Clocks
(`now_ms`) and randomness (`random_bytes`) come from the host.

## Deploying and enabling

The full authoring flow (also available point-and-click in the management UI's
**Compute** tab on your app dashboard):

**1. Create the module** (starts disabled):

```graphql
mutation {
  computeUpsertModule(input: {
    appId: "1",
    name: "world-sim",
    description: "Crop growth + weather"
  }) { moduleId name enabled }
}
```

**2. Upload a source version:**

```graphql
mutation {
  computeDeployVersion(input: {
    appId: "1",
    moduleName: "world-sim",
    sourceFilesJson: "{\"Cargo.toml\":\"...\",\"src/lib.rs\":\"...\"}",
    sdkVersion: "0.1.0",
    abiVersion: 0
  }) { versionId versionNo compileStatus }
}
```

The version parks as `compileStatus: "pending"`, then a game server compiles it
(`compiling` → `succeeded` or `failed`). Poll:

```graphql
query {
  computeModuleVersions(appId: "1", moduleName: "world-sim", limit: 1) {
    versionNo compileStatus compileLog compiledSizeBytes
  }
}
```

On failure, `compileLog` carries the Rust compiler output — fix and deploy a new
version (versions are immutable; each deploy is a new `versionNo`).

**3. Bind a trigger** (see [Triggers](#triggers)):

```graphql
mutation {
  computeUpsertTrigger(input: {
    appId: "1", moduleName: "world-sim",
    triggerType: "tick", tickHz: 2
  }) { triggerId triggerType tickHz }
}
```

**4. Enable it:**

```graphql
mutation {
  computeSetModuleEnabled(appId: "1", name: "world-sim", enabled: true) {
    name enabled circuitState
  }
}
```

Enabling requires a successfully compiled deployed version and resets the
failure circuit.

## Triggers

A module runs only when a trigger fires. Bind any mix with
`computeUpsertTrigger` (`triggerType`: `tick` | `event` | `invoke`):

### `tick` — a fixed-rate loop

`tickHz` sets the rate (must be within your policy's `maxTickHz`, default 10).
Exactly **one** server runs a module's ticks at a time, even with multiple API
replicas — your `tick` never overlaps or double-fires.

### `event` — react to model or compute activity

`onEvent` is one of:

- `function_invoked` — a model function ran (filter with `functionName`),
- `property_changed` — a direct property write (filter with
  `containerTypeName` / `propertyKey`); the delivered payload carries the
  `oldValue`/`newValue` delta so your module doesn't spend a data op
  re-reading the container it was just told about,
- `container_created` — (filter with `containerTypeName`),
- `compute_event` — another module (or this one) called `emit_event` (filter
  with `eventName`).

`debounceMs` coalesces bursts. Event chains are bounded: a cascade of modules
triggering each other via `emit_event` is cut off at a platform depth limit.

Automations can also drive modules directly: a
[`compute_invoke` automation](autonomous-processes#authoring-an-automation-the-npc-table)
binds a schedule/event/manual automation to one of your module's invoke
exports on the trusted server path — the natural home for cron-shaped
compute work.

### `invoke` — a callable export

An invoke trigger publishes one of your module's functions to `computeInvoke`:

```graphql
mutation {
  computeUpsertTrigger(input: {
    appId: "1", moduleName: "world-sim",
    triggerType: "invoke", exportName: "get_forecast",
    invokePolicyJson: "{\"type\":\"anyone\"}"
  }) { triggerId exportName }
}
```

`invokePolicyJson` is the same JSON authority tree used by
[game-model invoke policies](/game-api/game-models#authority-deciding-who-may-invoke-a-function).

An invoke trigger may also declare a **typed contract** (`contractJson`):

```json
{
  "description": "Spend gold and place the block atomically",
  "params": {
    "amount":   { "type": "int", "required": true },
    "targetId": { "type": "string" }
  },
  "result": { "placed": { "type": "bool" } }
}
```

Types are `int | float | string | bool | object | array`. Declared params are
validated on `computeInvoke` **before the sandbox runs** — a shape mistake is
a structured `BAD_REQUEST` naming the violation, not a runtime guest error.
Undeclared params pass through untouched; `result` is documentation/codegen
only. Contracts surface on `computeModuleTriggers`, and the
`crowdy-compute types` CLI command generates TypeScript param/result
interfaces plus typed invoke wrappers from them.
When it is **null, only `manage_compute` holders may invoke** (the safe
default). Leaves that need a model container context (e.g. `owner_of_self`)
fail closed here — prefer caller-based leaves (`anyone`, `user_in_list`,
parameter checks).

Callers then get a **synchronous RPC**:

```graphql
mutation {
  computeInvoke(appId: "1", moduleName: "world-sim",
                exportName: "get_forecast", paramsJson: "{\"day\":3}") {
    resultJson resultBase64 fuelUsed durationUs
  }
}
```

The module's `handle_invoke` receives
`{"export": "...", "params": {...}, "callerUserId": "..."}` as JSON bytes and
returns bytes; `resultJson` is populated when they parse as JSON. Unlike
fire-and-forget spatial sends, an invoke failure (trap, fuel exhaustion,
policy denial) is returned to the caller as a GraphQL error.

## Limits and circuit breakers

Modules are bounded by layered budgets so a bug degrades gracefully:

1. **Fuel** — a deterministic compute meter compiled into your module. Every
   entry call gets a budget (`fuelPerTick` / `fuelPerInvoke`); exhaustion stops
   the call immediately. An infinite loop cannot run away — it traps.
2. **Watchdog** — a wall-clock deadline per call (`maxRunMs`). Breach
   terminates the module instance and fails the run.
3. **Per-call caps** — guest memory (`maxMemoryMb`), host data operations per
   call (`maxDbOpsPerTick`), replication payloads ≤ 1024 bytes.
4. **Egress budget** — `maxEgressMsgsPerMin` / `maxEgressBytesPerMin` per
   module. Over-budget emits fail with a structured `egress_budget` error the
   module can handle; they are never silently dropped.
5. **Failure circuit** — `failureThreshold` consecutive failures **open** the
   module's circuit for `cooldownMs` (then a half-open probe; one successful
   run closes it). Re-enable manually with `computeSetModuleEnabled`.
6. **Budget gate** — if your app is over its spend cap or denied, all modules
   pause automatically, exactly like automations.

Per-app ceilings live in the compute **policy** (`computeModulePolicy` /
`computeSetPolicy`) and are clamped to platform maxima:

| Policy field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | App-wide kill switch |
| `maxModules` | 10 | Modules the app may define |
| `maxTickHz` | 10 | Highest tick rate any module may request |
| `fuelPerTick` | 200,000,000 | Fuel budget per tick call |
| `fuelPerInvoke` | 1,000,000,000 | Fuel budget per invoke/event call |
| `maxMemoryMb` | 64 | Guest memory cap |
| `maxRunMs` | 200 | Watchdog per entry call |
| `maxDbOpsPerTick` | 50 | Host data ops per entry call |
| `maxEgressMsgsPerMin` | 600 | Replication messages per module per minute |
| `maxEgressBytesPerMin` | 1,000,000 | Replication bytes per module per minute |
| `failureThreshold` | 5 | Consecutive failures that open the circuit |
| `cooldownMs` | 60,000 | Open-circuit cooldown |

Phase 10 validated these defaults. On the reference builder, a host db-op
cost ~1.4 ms, a radius scan ~0.4 ms, and a spatial emit ~0.5 ms; 50
db-heavy modules at 5 Hz (2,500 db-ops/s) held full cadence but used ~80% of
one game-api process. Treat ceilings as emergency guardrails — design
normal engines far below them.

## Activation: when your module actually runs

Modules load **lazily**: they run while your app has active realtime sessions
and unload after an idle window (about 5 minutes) with no players. World
simulation that must run around the clock can set `alwaysOn: true` on the
module (`computeUpsertModule`) — it then runs regardless of player presence
(and bills accordingly).

## Billing

Module execution never rides a player request, so it is metered explicitly,
per minute, and billed hourly against your app on shared environments (see
[Shared environment](/management-api/shared-environment)):

| Metric | Measures |
|---|---|
| `wasm_compute_units` | Compute consumed, derived from CPU time and fuel — 1 unit ≈ 1 ms of reference CPU |
| `wasm_egress_msgs` | Replication messages emitted by modules |
| `wasm_egress_bytes` | Replication bytes emitted by modules |

Each metric has a free hourly allowance; sustained usage beyond it draws down
the org wallet at the published rates. The Phase 10 sweep calibrated the
fuel equivalent to 22M fuel/unit and validated the free allowance + rate
against the full kit-engine fleet and live BWF usage.
Module-driven replication is kept separate from player-driven
`udp_notifications` so your bill itemizes compute-driven traffic. If a spend
cap or balance is hit, the budget gate pauses your modules until resolved.

## Permissions

Compute uses two dedicated org permission keys (grantable per role, like
`manage_apps`):

| Key | Grants |
|---|---|
| `manage_compute` | Author, deploy, enable/disable, delete, triggers, policy — all 7 compute mutations |
| `view_compute_diagnostics` | All 9 monitoring queries (modules, versions, triggers, policy, runs, stats, logs, diagnostics) |

`computeInvoke` is gated per-export by its trigger's `invokePolicyJson`
(default: `manage_compute` holders only). Org owners hold both keys by
default.

## Monitoring

```graphql
# Live config + circuit state
query { computeModules(appId: "1") { name enabled circuitState consecutiveFailures lastError } }

# Run history (newest first; filter by module / outcome)
query { computeModuleRuns(appId: "1", moduleName: "world-sim", success: false) {
  startedAt triggerSource entry durationUs fuelUsed dbReads dbWrites
  egressMsgs egressBytes errorMessage circuitAction flowId
} }
# Run rows record module loads (init), every failure, and circuit probes.
# Healthy high-frequency ticks are aggregated into per-minute usage (the
# billing metrics) instead of one row per tick, so a quiet runs list plus
# growing usage is a healthy module.
#
# flowId stitches cross-engine flows: the same id appears on the
# gameModelEvents rows and gameModelAutomationRuns caused by one entry call
# (a computeInvoke, an automation run, or a player invoke), across
# model_invoke, event triggers and emit_event cascades.

# Aggregate activity over a window
query { computeModuleStats(appId: "1", windowMinutes: 60) {
  totalRuns failedRuns failureRatePct totalFuelUsed totalEgressMsgs avgDurationUs
  byModule { moduleName runs failures fuelUsed circuitState }
} }

# Module log lines (from the guest log() calls)
query { computeModuleLogs(appId: "1", moduleName: "world-sim", limit: 50) {
  ts level message triggerSource
} }

# App-wide compute footprint
query { computeAppDiagnostics(appId: "1") {
  moduleCount enabledModuleCount versionCount triggerCount
  runs24h failedRuns24h fuelUsed24h
  topModules { moduleName runs failures }
} }
```

## Worked example: zero to a ticking module

Everything below uses plain GraphQL against the Game API endpoint with a
bearer token whose user holds `manage_compute` on the app's org.

1. **Create** — `computeUpsertModule(input: {appId: "1", name: "counter",
   alwaysOn: true})`. `alwaysOn` matters for this walkthrough: without it the
   module only loads while your app has connected players (see
   [Activation](#activation-when-your-module-actually-runs)), and a fresh test
   app has none.
2. **Deploy** — `computeDeployVersion` with the starter `Cargo.toml` +
   `src/lib.rs` shown [above](#writing-a-module), `sdkVersion: "0.1.0"`,
   `abiVersion: 0`.
3. **Wait for the compile** — poll `computeModuleVersions` until
   `compileStatus` is `succeeded` (a cold compile takes a few seconds; repeat
   deploys of the same source hit the artifact cache and return almost
   immediately).
4. **Trigger** — `computeUpsertTrigger` with `triggerType: "tick"`,
   `tickHz: 2`.
5. **Enable** — `computeSetModuleEnabled(appId: "1", name: "counter",
   enabled: true)`.
6. **Observe** — within about half a minute the module loads:
   `computeModuleRuns(appId: "1")` shows the `triggerSource: "init"` run,
   `computeModuleLogs` shows the `module init` line, and `computeModuleStats`
   / `computeAppDiagnostics` count it. The ticks themselves are aggregated
   into your per-minute usage (the `wasm_compute_units` billing metric — at 2
   Hz expect ~120 ticks per minute), and the module persists its tick count
   durably via `state_set`, so it survives reloads. Any tick failure would
   surface as a `success: false` run row with the error message.

From here, add host API calls — read a container, move an NPC, emit a spatial
event — using the [Compute host API](/game-api/compute-host-api) reference.

## Related

- [Compute tutorial](/game-api/compute-tutorial) — zero to a live module in
  under 30 minutes with the `crowdy-compute` CLI, plus five runnable examples.
- [Compute engines](/game-api/compute-engines) — ready-made, data-driven
  engine templates (NPCs/pets, mobs with refereed combat, weather/farming)
  built on the `crowdy-game-kit` crates. Start here before writing a
  simulation from scratch.
- [Compute host API](/game-api/compute-host-api) — every function a module can
  call, with limits.
- [Game models](/game-api/game-models) ·
  [Autonomous processes](/game-api/autonomous-processes) ·
  [Model-driven notifications](/game-api/model-driven-notifications)
- [GraphQL reference](/game-api/reference/graphql-overview) — full signatures
  for every `compute*` operation.
