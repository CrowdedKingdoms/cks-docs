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
turn timeouts, economy drift, and reaction logic — any behaviour that should
advance **between** your players' requests rather than only in response to them.
Read [Presence](#presence) before relying on a schedule: automations run while
somebody is in the app, not while it is empty. For end-to-end NPC recipes (wanderers, guards,
traders, spawners), see
[Modeling game concepts](modeling-game-concepts#npc-concepts).

An automation is a small row you author. It binds:

- an **entry point** — one of your `autonomous_invocable` functions plus the
  container(s) to run it against,
- a **trigger** — a schedule (interval or cron), a model **event**, or a
  one-shot [timer](#timers),
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
    cron-shaped compute work ("at 03:00 run the settlement export" — which fires at
03:00 only if somebody is in the app then; see [Presence](#presence)) —
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

## Presence

**Nothing runs for an app with no player in it.** Since 2026-09-01 a compute
module ticks, and a `schedule` automation fires, only while the app has at least
one player connected somewhere in the fleet.

What that means per trigger:

| Trigger | While the app is empty |
|---|---|
| `schedule` (interval or cron) | **Skipped.** Rescheduled from the moment a player returns; the missed runs are **never made up**. |
| [Timers](#timers) | **Wait.** The deadline passing does not fire them; they fire when somebody returns — late, not lost. |
| `event` | Unaffected. An event means something happened, which means somebody was there. |
| `manual` (`gameModelRunAutomation`) | Unaffected. Something already asked. |
| Synchronous compute `invoke` | Unaffected. It is a request, not a tick. |

**Write for it, do not work around it.** Make scheduled work **idempotent in
elapsed time** rather than assuming a cadence:

```
// Fragile: stalls while nobody plays, and resumes as if no time passed.
crop.growth = crop.growth + 1

// Correct: right whenever anybody next looks at it.
crop.growth = crop.growth + (now - crop.last_tick) / MS_PER_STEP
crop.last_tick = now
```

Store expiries as **timestamps**, not remaining-tick counters, so a status effect
that should have lapsed while the world was empty is treated as lapsed instead of
resuming with time left on it. A world that must appear to have advanced while
empty should compute the elapsed time on its first run after a player returns —
cheaper than ticking an empty world, and the same answer.

`nextRunAt` still advances while an app is empty. It is when the automation is
next **due**, which is not a promise that it ran.

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
share the load without double-firing. A run that comes due while the app has no
players is [skipped](#presence) rather than queued.

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

Each `onEvent` matches on its own set of filters. A filter that does not apply
to the event is **rejected** at authoring time, because such a trigger could
never match:

| `onEvent` | Filters | Fired by |
| --------- | ------- | -------- |
| `function_invoked` | `functionName`, `containerTypeName` | any successful invoke that committed — player, automation, or timer |
| `property_changed` | `containerTypeName`, `propertyKey`, `writeSource` | a property write (see [write sources](#write-sources)) |
| `container_created` | `containerTypeName` | `gameModelCreateContainer` / `gameModelEnsureContainer` |
| `player_count_changed` | none | a complete app player-count transition (below) |

For `function_invoked`, `containerTypeName` is the type of the invocation's
**`self` container** — so `{ functionName: "OnBossWave", containerTypeName: "BP_Boss" }`
reads as "when `OnBossWave` runs on a boss". Omit a filter to match every value.

`debounceMs` coalesces bursts: the first fire in the window wins and the rest
are dropped (`player_count_changed` coalesces on the trailing edge instead).

### Write sources

A property can change two ways, and a `property_changed` trigger chooses which
it observes with `writeSource`:

| `writeSource` | Observes |
| ------------- | -------- |
| `any` (default) | both of the below |
| `direct` | a `gameModelSetProperty` call — a write made *outside* a function |
| `function` | a mutation applied *inside* a `gameModelInvoke`, automation run, or timer fire |

This matters more than it sounds. Most game logic writes properties from inside
functions, so a trigger watching `waveIndex` on a boss will only see the change
if `writeSource` includes `function`. New triggers default to `any` and see
everything; triggers authored before `writeSource` existed remain `direct`-only
until you update them.

A function-sourced `property_changed` inherits the invoking call's cascade
depth, so `invoke → property_changed → automation → invoke` chains are bounded
by `maxCascadeDepth` rather than restarting the count.

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

## Timers

Schedules repeat and events react. A **timer** is the third shape: *"do this
once, N milliseconds from now."* Use it for a countdown, a wind-up before an
attack, a delayed cleanup, or a wave that advances a few seconds after the last
one died.

A timer is durable — it is stored in the database, not in a server's memory, so
it survives an API restart — and exactly one replica claims it, so it fires once.

It fires once, but not necessarily *on time*: a timer whose deadline passes while
the app has no players [waits](#presence) and fires when somebody returns. Read
the clock in the handler rather than assuming the delay you asked for is the delay
that elapsed.

### Arming a timer from your game logic

The usual way is a `timers` effect on a function, which arms the timer **in the
same transaction** as that function's mutations. If the invocation rolls back,
nothing was scheduled; if it commits, the delayed work is guaranteed:

```graphql
mutation {
  gameModelUpsertFunction(input: {
    appId: "1"
    name: "startBossWave"
    containerTypeName: "BP_Boss"
    autonomousInvocable: true
    mutations: [
      { target: "self", property: "waveIndex", expression: "self.waveIndex + 1" }
    ]
    timers: [
      {
        functionName: "startBossWave"        # re-arm itself: a repeating wave
        target: "self"                       # defaults to self
        delayMsExpression: "self.waveDelayMs"
        dedupeKey: "boss_wave"               # optional; see below
        params: [{ name: "wave", expression: "self.waveIndex" }]
      }
    ]
  }) { name timers { functionName delayMsExpression } }
}
```

Expressions are evaluated **when the timer is armed**, on post-mutation state —
so `self.waveIndex` above is the value this invocation just wrote, and the fired
invocation receives it as a parameter.

| Field | Meaning |
| ----- | ------- |
| `functionName` | The function to invoke. Must be `autonomousInvocable`. |
| `target` | Container reference for the delayed invocation's `self`. Defaults to `self`. |
| `delayMsExpression` | Delay in ms. Floored by the app's `minTimerDelayMs`, capped at 30 days. |
| `dedupeKeyExpression` | Optional app-scoped key. Re-arming the same key **replaces** the pending timer. |
| `params` | `{ name, expression }` values bound into the delayed invocation. |

A function may declare up to 4 timers.

`dedupeKey` is what makes "reset the countdown" a single call instead of a
cancel-then-arm race, and it is also a safety valve: a hot function that re-arms
the same key cannot flood the timer queue.

### Arming a timer directly

`gameModelScheduleInvoke` arms one from outside a function — useful for tooling
and tests. It requires app-admin (`manage_apps`), because a timer fires headless
with system authority rather than a player's; player-driven delays belong in a
`timers` effect, where your authored logic decides:

```graphql
mutation {
  gameModelScheduleInvoke(input: {
    appId: "1"
    functionName: "startBossWave"
    selfContainerId: "<boss-uuid>"
    delayMs: 5000
    paramsJson: "{\"wave\":3}"
    dedupeKey: "boss_wave"
  }) { timerId fireAt }
}
```

Inspect and cancel pending timers with `gameModelTimers` and
`gameModelCancelTimer` (by `timerId` or `dedupeKey`). A timer disappears from
`gameModelTimers` the instant it is claimed, so an empty list means nothing is
*scheduled* — not that nothing ran. Look at `gameModelAutomationRuns` for fires
that already happened; they appear with `triggerSource: "timer"` and a null
`automationId`.

### What bounds a timer

A fired timer runs the same guard chain as an automation run: the app kill
switch, the spend/budget gate, the per-app runs/minute bucket, and the cascade
ceiling. It also bills as the same `automation_compute_units` metric.

Crucially, a fire runs **one cascade level deeper** than whatever armed it. A
function that re-arms itself therefore terminates at `maxCascadeDepth` instead of
looping forever — so a self-rescheduling wave is a *bounded* chain, not a
substitute for an interval schedule. If you want an unbounded repeat, use
`triggerType: "schedule"`.

Because timers fire headlessly, the target must be `autonomousInvocable`.
`gameModelUpsertFunction` warns at authoring time if a timer's target is missing
or not opted in, rather than letting it fail minutes later when it fires.

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
3. **Cascade** — event-triggered runs and timer fires carry a depth; exceeding
   the app's `maxCascadeDepth` is dropped. This is what terminates a
   function-writes-property-fires-automation chain, and a function that re-arms
   its own timer. A per-app runs/minute token bucket sheds excess.
4. **Failure circuit** — `failureThreshold` consecutive failures **open** the
   circuit and pause the automation for `cooldownMs` (then a half-open probe);
   one success closes it. Re-enable (and reset) with
   `gameModelSetAutomationEnabled(enabled: true)`.
5. **Budget** — if your app is denied/over its spend cap, all automations pause
   automatically (the runtime gate).
6. **Platform** — per-app ceilings (`maxAutomations`, `minIntervalMs`,
   `maxFanout`, `maxCascadeDepth`, `globalRunsPerMinute`, `minTimerDelayMs`,
   `maxPendingTimers`), set with `gameModelSetAutomationPolicy`.

## Billing

Automation runs and timer fires never go through a player request, so they are
metered explicitly. Each run records `computeUnits` (wall-clock + per-invocation /
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

### Why isn't my event trigger firing?

Start with the trigger itself. `gameModelAutomationTriggers` reports whether each
trigger has ever matched, and flags configuration that cannot work:

```graphql
query { gameModelAutomationTriggers(appId: "1") {
  onEvent functionName containerTypeName propertyKey writeSource
  lastMatchedAt matchCount24h warnings
} }
```

- **`warnings` is non-empty** — the trigger has a filter its event does not match
  on, so it can never fire. Recreate it without that filter. (New triggers are
  rejected at creation for this; warnings surface older rows.)
- **`lastMatchedAt` is null while the event is definitely happening** — the
  filters are too narrow. Remove them one at a time: `functionName` must match
  exactly, and `containerTypeName` on `function_invoked` must be the type of the
  invocation's `self` container.
- **A `property_changed` trigger never fires, but the property is changing** —
  the write is coming from inside a function and the trigger's `writeSource` is
  `direct`. See [write sources](#write-sources).
- **`lastMatchedAt` is recent but nothing happened** — the fire reached a run
  that a guard dropped. Check `gameModelAutomationRuns` for `circuitAction`
  (`cascade_dropped`, `rate_limited`, `budget_paused`, `app_disabled`).
- **Nothing anywhere, and the invoke failed** — a `function_invoked` event is
  only emitted after a *successful* commit. A rolled-back invoke emits nothing;
  look for `success: false` rows in `gameModelEvents`.
- **Manual runs work but the trigger doesn't** — `gameModelRunAutomation`
  bypasses trigger matching entirely, so a working manual run tells you the
  automation is fine and isolates the problem to the trigger.

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
