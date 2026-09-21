---
slug: automations
sidebar_position: 10
title: Automations
description: "Make a Game Model function run on its own, on a schedule, when a property changes, or when another function is invoked, and arm delayed timers from an effect, all authored on the effect asset with no runtime call."
---

# Automations

An automation is a server-driven process: a function that runs on a schedule or in reaction to model activity, with no client calling it. A timer is one delayed invocation an effect arms when it commits. Both are authored on the Crowdy Effect asset, in its **Automation** section and its **Timers** list; Unreal code never creates one, it only reacts to what one writes.

## When you touch this

The village night: fuel burns down on a schedule while the village has anyone in it, a donation to one lantern relights its neighbours, a spawner fills a camp. Anything that should happen without a player's input belongs here, not in a client tick.

## Automations react; they are not called

There is no Blueprint node and no C++ function to start an automation. Tick **Run Automatically** (`bRunAutomatically`) on the effect and pick a trigger; the schema sync marks the function autonomous-invocable and creates the automation with it. The client-visible result is the same as any other function commit: the container changes, peers re-pull, `CrowdyOnRep` fires. [Change pings and pull](./change-pings-and-pull.md) is how the change arrives; this page is how it is caused.

The trigger and target fields, all hidden until Run Automatically is on:

| Field (Details name) | Member | Meaning |
|---|---|---|
| Enabled | `bEnabled` | Author it but keep it paused when off. |
| Automation Trigger | `AutomationTrigger` | `EveryInterval` (Every N milliseconds), `Cron` (Cron schedule), `OnPropertyChange` (On property change), `OnFunctionInvoked` (On function invoked), `OnPlayerLeft` (On player left), `OnPlayerCountChanged` (On player count changed). `ECrowdyEffectAutomationTrigger`. |
| Interval (ms) | `AutomationIntervalMs` | Every N milliseconds only. Default 1000. |
| Cron Expression | `AutomationCronExpr` | Cron only. |
| On Property Key | `AutomationChangePropertyKey` | On property change only: the server key that fires it. |
| Observe Writes From | `AutomationWriteSource` | On property change only: `Any` (default), `Direct`, or `Function`. `ECrowdyEffectPropertyWriteSource`. |
| Watch Function Name | `AutomationWatchFunctionName` | On function invoked only: the function being watched, not this effect's own. |
| On Container Type (optional) | `AutomationChangeContainerType` | The watched type. Empty means this effect's own type for a property change, and any type for a function invoke. |
| Debounce (ms) | `AutomationDebounceMs` | Event triggers: the first fire in the window wins, the rest are dropped. 0 fires on every event. |
| Automation Target Mode | `AutomationTargetMode` | `Type` (default: every container of the effect's type), `Container`, or `Global`. `ECrowdyEffectAutomationTargetMode`. |
| Target Type Override (optional) | `AutomationTargetTypeOverride` | Type mode: fan out over another type. |
| Target Container Id | `AutomationTargetContainerId` | Container and Global modes: the one container it runs on. An id, so it does not survive being copied to another app. |
| Automation Name (optional) | `AutomationName` | Unique per app; empty means the function name. |

The wire semantics of every field, and of timers, are on [EffectScript: timers and automations](./effect-script.md#timers-and-automations). The safety budget, under **Automation, Safety**: Max Targets (`AutomationMaxTargets`, 50), Gas Limit (`AutomationGasLimit`, 20000, clamped by the server to a platform ceiling), Run Timeout (ms) (`AutomationRunTimeoutMs`, 200), Max Runs Per Minute (`AutomationMaxRunsPerMinute`, 120), Failure Threshold (`AutomationFailureThreshold`, 5), Cooldown (ms) (`AutomationCooldownMs`, 30000). What each bound does on the server is on [Safety: loops and circuit breakers](/game-api/autonomous-processes#safety-loops-and-circuit-breakers). Selectors, the server's way of choosing targets from model data, are not authored from the Unreal asset.

## A schedule: the village night

`burn_fuel` is a function on `LanternFuel`, authored on an effect asset with **Run Automatically** on, **Automation Trigger** Every N milliseconds, **Interval (ms)** 30000, and the default Type target mode, so it runs over every `LanternFuel` container in the app. It has no `require` line: an automation runs as the server, and the whole body is one line:

```text
self.fuel -= 5
```

Nothing in Unreal calls it. Every thirty seconds, while at least one player is connected to the app, each lantern's fuel drops, each bound client re-pulls, and the `OnRep_Fuel` the [Quickstart](../quickstart.md) wrote dims the light. That is the whole client side of an automation: the notify you already have.

:::warning[A schedule runs only while at least one player is connected to the app.]
Nothing runs for an empty app. A schedule's missed runs are never made up; a timer waits and fires late when somebody returns; an event trigger is unaffected. A lantern that stops burning while nobody is in the village is fine. A value that must keep moving through an empty night is not: write that work so it is right whenever it next runs, storing a timestamp and computing the elapsed time with `now()` instead of assuming a cadence. The shape, and the per-trigger table, are on [Presence](/game-api/autonomous-processes#presence).
:::

```text
# Right whenever it next runs: an Int attribute last_burn holds the previous tick.
self.fuel -= (now() - self.last_burn) / 6000
self.last_burn = now()
```

The Studio Game Model page's **Advanced** tab shows what the server holds for an automation-driven function; the screenshot is another such function, not `burn_fuel`, and its Player scope is what that function was authored with, not the Server scope an automation entry point should declare (see [EffectScript](./effect-script.md#timers-and-automations)).

![The Advanced tab's Functions editor showing an interval-driven function with its invoke scope and mutation](/img/unreal-sdk/studio-automation.png)

## A reaction: one donation relights the neighbours

An automation can watch another function. `donate_fuel` is a player-callable function on `LanternFuel` with one tuning parameter, `amount` (Float, default 10), whose body is `self.fuel += $amount`: a player pours fuel into any lantern. A second effect on the same container, `relight_neighbors`, has **Run Automatically** on with **Automation Trigger** On function invoked, **Watch Function Name** `donate_fuel`, **On Container Type** left empty, **Debounce (ms)** 500, and the Type target mode; its body is `self.fuel += 1`. When any lantern's `donate_fuel` commits, `relight_neighbors` runs over every lantern and each one's `OnRep_Fuel` fires again.

:::warning[On Container Type is the watched function's type, never this effect's own.]
For On function invoked, empty matches every type; naming your own type here authors "fires when the watched function runs on my own type" and silently never matches the common case where one type reacts to another. For On property change the same field defaults to this effect's own type instead, because an effect normally watches its own state. Read the field's meaning off the trigger you picked.
:::

Naming this effect's own function in Watch Function Name is legal: it re-triggers itself, and the server bounds the cascade by depth rather than looping forever, but it still spends the run budget.

:::warning[Narrowing Observe Writes From to Direct is usually the bug, not the fix.]
Most game logic writes properties from inside functions. `Any`, the default, sees both a direct write and a write a function makes while it runs; `Direct` sees only the first, so an automation watching a property that only effects ever write never fires. Narrow it only when a function's own writes should deliberately not re-trigger the automation.
:::

## Two triggers that watch presence, not player action

`OnPlayerLeft` (`onEvent "player_left"`) fires once per actor the platform stops seeing, the last player's included, so it is the one trigger that still runs for an app that has just emptied. `OnPlayerCountChanged` (`onEvent "player_count_changed"`) fires on a transition of the app's active-player gauge, coalesced on the trailing edge, and never at zero. Neither takes a filter: On Property Key, Observe Writes From, Watch Function Name, and On Container Type are all inapplicable to them and stay hidden in the Details panel. The function reads what happened through its own parameters instead, for example `user_id` and `remaining_player_count` on `OnPlayerLeft`; the server documents each event's full parameter list.

:::warning[A presence trigger answers whether the platform still sees someone. It does not know, and cannot tell you, whether whatever they were doing is actually over.]
Treat a run on `OnPlayerLeft` or `OnPlayerCountChanged` as one input, not a verdict. Use it to update your own bookkeeping, such as a counter or a last-known value, and keep the decision to end something in an explicit function a caller invokes, or in a check the automation makes against your own state before it writes. Do not let a `player_left` run clear truth another part of your model holds by itself: a shared map-load hitch can make the platform briefly stop seeing every actor at once, and a client that leaves and returns inside the platform's presence window looks identical to one that never left.
:::

## Timers

A timer is one delayed call an effect arms when it commits, transactionally with the effect's writes: if the effect fails nothing is scheduled. The `Timers` array holds up to four `FCrowdyEffectTimer` entries:

| Field | Meaning |
|---|---|
| `FunctionName` | The function to run when it fires. It must be autonomous-invocable. |
| `DelayMs` | Delay (ms), default 1000. |
| `DedupeKey` | Re-arming the same key replaces the pending timer. Quoted for you. |
| `Target` | Target (optional): the container to run on; empty means self. |
| `DelayExpression`, `DedupeKeyExpression` | The advanced forms: a model expression instead of the literal. Sent verbatim, not quoted. |
| `Params` | Timer Parameters (`FCrowdyEffectTimerParam`, `Name` and `Expression`): values bound as `$<name>` when the timer fires, evaluated when it is armed. |

:::warning[A timer's target function must have Run Automatically ticked.]
A timer fires headlessly, so its target must be autonomous-invocable: tick **Run Automatically** on the target effect. The sync warns at authoring time when the target is missing or not opted in, and an arm against a target that is not opted in fails the invoke rather than failing minutes later when it fires. [What bounds a timer](/game-api/autonomous-processes#what-bounds-a-timer).
:::

:::warning[The two advanced fields are not quoted for you.]
`DelayMs` and `DedupeKey` are safe by construction. A bare word in `DelayExpression` or `DedupeKeyExpression` reaches the server as an unresolved identifier and is refused. Write a model expression there, or use the plain field.
:::

A timer fires exactly once. A timer that re-arms itself is bounded one cascade level deeper than whatever armed it, so for an unbounded repeat use Every N milliseconds or Cron. Delay and dedupe-key expressions evaluate when the timer is armed, so the delayed call sees the value captured then, not the container's state when it fires. A game cannot cancel a timer: the server's cancel needs an admin permission a shipped client never holds, so the in-game way to cancel is re-arming with the same `DedupeKey`. An effect with an empty `Timers` array sends nothing about timers on the wire, so a re-sync leaves a function's timers untouched.

## Gotchas

- Every field above is asset data. Changing one is a schema change: Sync to Server from [Game Models authoring](../studio/game-models-authoring.md).
- An effect that is Other effects only and also runs automatically infers `is_automation` as its gate when it has no `require` line. [Invoke policies](./invoke-policies.md).
- Debounce drops events; it is not the summing merge on [Coalescing](./coalescing.md).
- A kit's ticks (the Combat status-effect tick, Living World's day and crop ticks) are automations the kit deploys for you. [Kits](./kits.md).
- Gas Limit above the platform ceiling is authored and then silently not used.
- `OnPlayerLeft` and `OnPlayerCountChanged` accept no filter fields; Debounce and Automation Target Mode still apply to both.

## Related

- [Applying an effect from C++](./effects-cpp.md): the asset these fields live on.
- [Functions and return values](./functions-and-return-values.md): the function an automation runs.
- [Change pings and pull](./change-pings-and-pull.md): how a client learns the automation's write happened.
- [Autonomous Processes on the Game API](/game-api/autonomous-processes): triggers, timers, and the circuit breakers at the wire level.
