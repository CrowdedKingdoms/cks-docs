---
sidebar_position: 22
title: Autonomous Processes (NPCs)
---

# Autonomous Processes (NPCs)

[Game Models](game-models) let you put your game's rules and state on the server,
but the server only ever does something when a **client tells it to** — each
function runs because a player invoked it. **Automations** add the missing
half: server-driven processes that invoke your model functions **on their own**,
on a schedule or in reaction to model activity. They are the way to build NPCs,
world simulation (resource regen, weather, day/night), spawners, decay/cleanup,
turn timeouts, economy drift, and reaction logic — any behaviour that should run
without a human driving it. For end-to-end NPC recipes (wanderers, guards,
traders, spawners), see
[Modeling game concepts](modeling-game-concepts#npc-concepts).

An automation is a small row you author. It binds:

- an **entry point** — one of your `autonomous_invocable` functions plus the
  container(s) to run it against,
- a **trigger** — a schedule (interval or cron) or a model **event**,
- an optional **run-as identity**, and
- a **safety budget** (fan-out, gas, timeout, failure threshold).

All processing happens **in the API server** (the same sandboxed, transactional
engine that runs `gameModelInvoke`), never in the database. Every run is metered
and billed to your app, recorded for monitoring, and bounded by layered circuit
breakers so a runaway loop can't take your game (or your bill) down.

All operations live on the **Game API** GraphQL endpoint and require app-admin
(`manage_apps`), except where noted.

:::tip[Need loops or heavy logic?]
Automations run the loop-free model expression language, which is the point —
they are cheap, declarative, and safe. When your server logic needs real
computation (pathfinding, flocking, full world simulation), write a
**[Compute Module](/game-api/compute-modules)** in Rust instead; it can react
to the same model events and coexists with your automations.
:::

Expression syntax refresher (the full language lives on
[Game Models](game-models)): property reads are **accessors, not function
calls** — `self.hp` on the acting container, `ref($id).hp` through a
container reference, `$param` for invoke params. There is no `prop(...)`;
function calls are reserved for builtins (`clamp`, `coalesce`, `grid_at`,
…) and user functions via `fn:<name>(...)`.

## Opting a function in

A function can only be driven by an automation if you explicitly mark it
`autonomousInvocable`. Player-facing functions are **never** server-driven
unless you opt them in — this is the core safety guarantee.

```graphql
mutation {
  gameModelUpsertFunction(input: {
    appId: "1",
    name: "npc_take_turn",
    containerTypeName: "Unit",
    parameters: [
      { name: "target_id", valueType: "container_ref", required: true },
      { name: "step_x", valueType: "int", required: true },
      { name: "step_y", valueType: "int", required: true }
    ],
    mutations: [
      { target: "self", property: "x", expression: "$step_x" },
      { target: "self", property: "y", expression: "$step_y" },
      { target: "ref($target_id)", property: "hp",
        expression: "if((abs(self.x - ref($target_id).x) + abs(self.y - ref($target_id).y)) <= self.attack_range && ref($target_id).alive == true, max(0, ref($target_id).hp - self.str), ref($target_id).hp)" }
    ],
    invokePolicyJson: "{\"type\":\"is_automation\"}",
    autonomousInvocable: true
  }) { name autonomousInvocable }
}
```

The new [`is_automation`](game-models#authority-deciding-who-may-invoke-a-function)
authority leaf passes only for automation-driven calls, so you can gate a
function to automations only (as above) or branch logic on caller kind.

## Authoring an automation (the "NPC table")

```graphql
mutation {
  gameModelUpsertAutomation(input: {
    appId: "1",
    name: "enemy_ai",
    functionName: "npc_take_turn",
    targetMode: "type",            # run once per matching container instance
    targetTypeName: "Unit",
    triggerType: "event",          # fire on model activity (see Triggers)
    maxTargets: 16,
    failureThreshold: 5,
    selectorJson: "{ ... see Selectors ... }"
  }) { automationId name circuitState }
}
```

Key fields:

- **`actionKind`** — what the automation does when it fires:
  - `model_function` (default) — invoke the `functionName` Model function
    (everything below applies).
  - `compute_invoke` — invoke a [compute module](compute-modules)'s invoke
    export directly: set `computeModuleName` + `computeExport` (the export
    must be bound as an invoke trigger on the module). The call runs on the
    trusted server path — no invoke-policy evaluation; your automation
    config is the authorization. `targetMode` is forced to `global`,
    selectors/fan-out don't apply, and `paramsJson` is passed to the export
    verbatim. The module's execution bills as WASM compute; the automation
    run records dispatch overhead only. This is the first-class home for
    cron-shaped compute work ("at 03:00 run the settlement export") —
    no marker function needed.
- **`functionName`** — the `autonomous_invocable` entry point
  (`model_function` actions).
- **`targetMode`** — how to pick the `self` container(s):
  - `container` — one specific `selfContainerId`.
  - `type` — fan out over every instance of `targetTypeName` (in `sessionId`
    when set), capped by `maxTargets` and the app's `maxFanout`.
  - `global` — a single run against `selfContainerId` (e.g. a "World" container).
- **`runAsUserId`** — the identity the automation acts as. When set, the
  function's invoke policy is enforced as that user (so `owner_of_self` /
  `is_current_turn` / `$caller_user_id` resolve). When omitted, the automation
  is a **trusted server caller** and the policy is bypassed — allowed only
  because the function opted in.
- **`paramsJson`** — static params merged into every call.
- **safety budget** — `maxTargets`, `maxFnDepth`, `gasLimit`, `runTimeoutMs`,
  `maxRunsPerMinute`, `failureThreshold`, `cooldownMs` (all clamped to platform
  ceilings).

## Triggers

### Schedule

```graphql
gameModelUpsertAutomation(input: {
  appId: "1", name: "regen", functionName: "world_regen",
  targetMode: "global", selfContainerId: "<world-uuid>",
  triggerType: "schedule", scheduleKind: "interval", intervalMs: 5000
}) { name nextRunAt }
```

`scheduleKind` is `interval` (every `intervalMs`, floored by the app's
`minIntervalMs`) or `cron` (a standard cron expression in `cronExpr`). The
server dispatcher claims due automations and runs them; multiple API replicas
share the load without double-firing.

### Event (model or app activity)

Fire an automation in reaction to a function invocation, a direct property
write, a container creation, or an observed app player-count change. Model
activity is matched after commit; player-count activity is matched after
observation:

```graphql
mutation {
  gameModelUpsertAutomationTrigger(input: {
    appId: "1",
    automationName: "enemy_ai",
    onEvent: "function_invoked",
    functionName: "begin_enemy_phase"   # optional filter
  }) { triggerId }
}
```

`onEvent` is `function_invoked` (filter by `functionName`), `property_changed`
(filter by `containerTypeName` / `propertyKey`, fired by direct
`gameModelSetProperty` writes), or `container_created` (filter by
`containerTypeName`). It can also be `player_count_changed`, described below.
`debounceMs` coalesces bursts.

`property_changed` deliveries to **compute modules** additionally carry the
`oldValue`/`newValue` delta, so a module reacting to a write doesn't spend a
data op re-reading the container it was just told about (see
[Compute Modules — events](compute-modules)).

#### Player-count changes

`onEvent: "player_count_changed"` runs an ordinary event automation when the
app's active-player gauge changes. That gauge counts active **app-scoped
gameplay sessions**, not distinct users, actor rows, game-model sessions, or
load on one server. See
[Active player count](game-models#active-player-count-app-scoped-sessions) for
its expiry, freshness, and recovery semantics.

Each run receives four dynamic params:

- `previous_player_count`
- `current_player_count`
- `player_count_delta`
- `player_count_revision`

Event values override same-named static values in the automation's
`paramsJson`. For this event, `debounceMs` is trailing-edge coalescing: one run
keeps the first previous count and the latest current count and revision in the
window, with the delta for that coalesced transition. Do not set
`functionName`, `containerTypeName`, or `propertyKey`; those filters are invalid
for `player_count_changed`.

This is still a normal automation. Its entry point must be
`autonomousInvocable`, and the same invoke guard, gas/depth/time budgets,
fan-out limits, cascade controls, failure circuit, spend gate, run history, and
metering apply.

The following end-to-end configuration assumes `<world-container-id>` is an
existing app-global (`sessionId: null`) `World` container whose type defines the
four integer properties written by the function:

```graphql
mutation ConfigurePlayerCountAutomation {
  upsertFunction: gameModelUpsertFunction(input: {
    appId: "1"
    name: "record_player_count"
    containerTypeName: "World"
    parameters: [
      { name: "previous_player_count", valueType: "int", required: true }
      { name: "current_player_count", valueType: "int", required: true }
      { name: "player_count_delta", valueType: "int", required: true }
      { name: "player_count_revision", valueType: "int", required: true }
    ]
    mutations: [
      { target: "self", property: "previous_player_count",
        expression: "$previous_player_count" }
      { target: "self", property: "current_player_count",
        expression: "$current_player_count" }
      { target: "self", property: "player_count_delta",
        expression: "$player_count_delta" }
      { target: "self", property: "player_count_revision",
        expression: "$player_count_revision" }
    ]
    invokeScope: "server"
    invokePolicyJson: "{\"type\":\"is_automation\"}"
    autonomousInvocable: true
  }) {
    name
    autonomousInvocable
  }

  upsertAutomation: gameModelUpsertAutomation(input: {
    appId: "1"
    name: "record_player_count"
    functionName: "record_player_count"
    targetMode: "global"
    selfContainerId: "<world-container-id>"
    triggerType: "event"
    failureThreshold: 5
  }) {
    name
    circuitState
  }

  upsertTrigger: gameModelUpsertAutomationTrigger(input: {
    appId: "1"
    automationName: "record_player_count"
    onEvent: "player_count_changed"
    debounceMs: 1000
  }) {
    triggerId
  }
}
```

## Selectors: choosing targets from model data

The expression language is intentionally loop-free, so "find the nearest living
enemy" can't be a pure function. A **selector** does that bounded selection in
the API server over your model data (never voxels / geometry) and binds the
result into the entry point's params:

```json
{
  "selfWhere": [{ "key": "team", "op": "==", "value": "enemy" },
                { "key": "alive", "op": "==", "value": true }],
  "pick": "nearest",
  "ofType": "Unit",
  "where": [{ "key": "alive", "op": "==", "value": true },
            { "key": "team", "op": "!=", "value": "self.team" }],
  "by": "manhattan",
  "bindAs": { "ref": "target_id", "approachX": "step_x", "approachY": "step_y", "approachStop": 1 }
}
```

- `selfWhere` filters which fan-out targets actually act (e.g. only living
  enemies).
- `pick` is `nearest` | `lowest` | `highest` | `random`, ranked `by` Manhattan
  distance (`manhattan`) or a numeric `{ "property": "hp" }` (e.g. lowest-hp ally
  for a healer).
- `bindAs` binds the chosen container's ref + coordinates, plus an `approach`
  step toward it bounded by the actor's `move` (stopping `approachStop` cells
  short, so a melee unit ends in attack range), into the named params.

Predicate values may reference the acting unit with `"self.<key>"`.

### Permission predicates

Selectors can also filter by the **runtime grid permissions** of the user
behind each container — `selfPermissionWhere` gates which fan-out targets act,
`candidatePermissionWhere` gates which candidates qualify. This is how a guard
NPC targets intruders ("players standing in my plot who *lack* `access` on
it") declaratively:

```json
{
  "selfWhere": [{ "key": "role", "op": "==", "value": "guard" }],
  "pick": "nearest",
  "ofType": "PlayerAvatar",
  "candidatePermissionWhere": [
    { "userFrom": { "property": "owner_user_id" }, "op": "lacks",
      "key": "access", "grid": { "property": "grid_id" } }
  ],
  "by": "manhattan",
  "bindAs": { "ref": "target_id" }
}
```

Each predicate names:

- **`userFrom`** — where the container's user id comes from: `"owner"` (the
  container's `ownerUserId`) or `{ "property": "<key>" }` (a user id stored as
  a property).
- **`op`** — `"has"` or `"lacks"`.
- **`key`** — a runtime permission key (validated against the
  `runtime_permissions` catalog at `gameModelUpsertAutomation` time).
- **`grid`** — a literal grid id, `{ "property": "<key>" }`, or omitted to
  mean "on **any** grid".

Multiple predicates AND together; each runs as one batched ACL query per run,
never per-container. A container whose user id can't be resolved fails `has`
and passes `lacks` (an unowned container can't hold a permission). For
permission checks inside the entry function's *logic*, use the
[expression builtins](game-models#reading-permissions-from-expressions)
instead.

## Safety: loops and circuit breakers

Autonomous processes are bounded by **layered** circuit breakers, so a buggy
automation degrades gracefully instead of taking down your game:

1. **Engine** — every invocation runs under a gas budget, a `fn:` call-depth
   limit, **cycle detection**, and a wall-clock deadline. An infinite `fn:`
   chain fails the run instead of crashing.
2. **Run** — `maxTargets` caps fan-out; `runTimeoutMs` bounds the whole run; an
   automation never overlaps itself.
3. **Cascade** — event-triggered runs carry a depth; exceeding the app's
   `maxCascadeDepth` is dropped. A per-app runs/minute token bucket sheds excess.
4. **Failure circuit** — `failureThreshold` consecutive failures **open** the
   circuit and pause the automation for `cooldownMs` (then a half-open probe);
   one success closes it. Re-enable (and reset) with
   `gameModelSetAutomationEnabled(enabled: true)`.
5. **Budget** — if your app is denied/over its spend cap, all automations pause
   automatically (the runtime gate).
6. **Platform** — per-app ceilings (`maxAutomations`, `minIntervalMs`,
   `maxFanout`, `maxCascadeDepth`, `globalRunsPerMinute`), set with
   `gameModelSetAutomationPolicy`.

## Billing

Automation runs never go through a player request, so they are metered
explicitly. Each run records `computeUnits` (wall-clock + per-invocation /
per-mutation weighting); the game-api ships per-app/minute totals to the
management plane, where they bill against your app under the
`automation_compute_units` metric (with a free hourly allowance). On a shared
environment, sustained automation load draws down the org wallet and, if a spend
cap or balance is hit, the budget circuit breaker pauses your automations.

## Monitoring

```graphql
# Live config + circuit state
query { gameModelAutomations(appId: "1") { name enabled circuitState consecutiveFailures nextRunAt } }

# Run history (newest first; filter by automation / outcome)
query { gameModelAutomationRuns(appId: "1", automationName: "enemy_ai", success: false) {
  startedAt triggerSource targets invocations mutations durationUs computeUnits errorMessage circuitAction
} }

# Aggregate "what are my NPCs doing"
query { gameModelAutomationStats(appId: "1", windowMinutes: 60) {
  totalRuns failedRuns failureRatePct runsPerMinute totalComputeUnits
  byAutomation { automationName runs failures circuitState }
} }

# Database footprint + recent activity
query { gameModelAppDiagnostics(appId: "1") {
  containerCount propertyCount automationCount events24h automationEvents24h
  topFunctions { functionName invocations failures }
} }
```

Automation-driven invocations are tagged in the event log: `gameModelEvents`
returns `callerKind` (`player` | `automation` | `system`) and `automationId`, so
you can tell NPC actions from player actions.

## Worked example: a self-playing enemy team

The [`tactical-model-simulator`](https://github.com/CrowdedKingdoms) (a Final
Fantasy Tactics-style battle) makes the **enemy team play itself** with one
automation. Enemy `Unit`s are `team: "enemy"`; players are `team: "player"`.
The `enemy_ai` automation (`targetMode: "type"`, `targetTypeName: "Unit"`) is
event-triggered on `begin_enemy_phase`. Its selector picks, for each living
enemy, the nearest living player and an approach step; the `npc_take_turn`
function moves there and attacks if in range — all from model data (`x`/`y`/`hp`
/stats), never the voxel terrain. The host calls `begin_enemy_phase`, the server
plays team B, and the client renders the result from the event log. See the
simulator's `npm run test:npc` for an end-to-end proof against the database.
