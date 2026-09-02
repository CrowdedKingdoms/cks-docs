---
sidebar_position: 15
title: Automations (NPCs)
---

# Automations (autonomous processes / NPCs)

[Game models](game-model) let you put your rules and state on the server, but a
model function only runs when a client invokes it. **Automations** are
server-driven processes that invoke your model functions *on their own* — on a
schedule or in reaction to model activity — so you can build NPCs, spawners,
ticking world systems, and economy jobs that advance **between** your players'
requests rather than only in response to them.

:::warning Scheduled work needs a player in the app
Since 2026-09-01 **nothing runs for an app with no player in it.** A `schedule`
trigger that comes due while the app is empty is **skipped** and rescheduled from
the moment a player returns, and the missed runs are **never made up**. Timers
[wait and fire late](/game-api/autonomous-processes#timers) rather than firing
into an empty world. `event` and `manual` triggers are unaffected, because
something already asked.

Write the entry point to be **idempotent in elapsed time**: advance the world by
`now - lastRun` rather than by one step per run, and store expiries as timestamps
rather than remaining-tick counters. An automation that assumes a fixed cadence
will silently fall behind whenever nobody is playing.
:::

`client.gameModel` wraps the full automation surface. It is a **studio-admin**
surface that runs on the Game API: every call needs an **[app-scoped
token](/management-api/portals-and-app-tokens)** for the target app (mint one with
`identity.portal.mintAppToken(appId)`) **and** a logged-in user who holds the
`manage_apps` permission on the app's organization — a studio admin can
`mintAppToken` for their own app even without player entitlement. Drive it from a
trusted admin context — a studio backend **or** an admin-only / authenticated web
tool (a browser is fine) — and just keep that privileged token out of the
untrusted game client you ship to end users. The examples below assume `client`
holds that app's app-scoped token. For the full conceptual model
(triggers, selectors, the safety budget, and circuit breakers) see
**[Game API → Autonomous processes (NPCs)](/game-api/autonomous-processes)**.

## 1. Mark the entry-point function autonomous

An automation runs a normal model function "as the server". The function must opt
in with `autonomousInvocable: true`:

```ts
await client.gameModel.upsertFunction({
  appId: '1',
  name: 'wanderNpc',
  invokeScope: 'server',
  autonomousInvocable: true,
  mutations: [
    { target: 'self', property: 'x', expression: 'self.x + randInt(-1, 1)' },
  ],
});
```

## 2. Create the automation

```ts
await client.gameModel.upsertAutomation({
  appId: '1',
  name: 'npc-wander',
  functionName: 'wanderNpc',
  targetMode: 'type',          // run against every container of a type
  targetTypeName: 'Npc',
  triggerType: 'schedule',
  scheduleKind: 'interval',
  intervalMs: 1000,
  // safety budget (bounds the work each tick may do):
  maxTargets: 50,
  gasLimit: 100000,
  runTimeoutMs: 2000,
  maxRunsPerMinute: 120,
});
```

Automations are idempotent on `(appId, name)`, so calling `upsertAutomation`
again updates the existing one.

### Event-triggered automations

Instead of (or in addition to) a schedule, fire an automation in reaction to
model activity:

```ts
await client.gameModel.upsertAutomationTrigger({
  appId: '1',
  automationName: 'npc-react',
  onEvent: 'property_changed',
  containerTypeName: 'Player',
  propertyKey: 'health',
  debounceMs: 250,
});
```

## 3. Enable, run, and tune

```ts
await client.gameModel.setAutomationEnabled({ appId: '1', name: 'npc-wander', enabled: true });
await client.gameModel.runAutomation({ appId: '1', name: 'npc-wander' });   // run once now (testing)
await client.gameModel.setAutomationPolicy({ appId: '1', killSwitch: false, maxAutomations: 100 });
```

Re-enabling a tripped automation also resets its circuit breaker.

## 4. Monitor

```ts
const stats = await client.gameModel.automationStats({ appId: '1', windowMinutes: 60 });
const runs  = await client.gameModel.automationRuns({ appId: '1', automationName: 'npc-wander', limit: 50 });
const diag  = await client.gameModel.appDiagnostics({ appId: '1' });
```

`automationStats` is the "what are my NPCs doing" dashboard (throughput, failure
rate, compute, per-automation breakdown); `automationRuns` is the per-run audit
trail; `appDiagnostics` is a snapshot of your app's whole game-model footprint.

## Method summary

| Area | Methods |
| ---- | ------- |
| Author | `upsertAutomation`, `deleteAutomation`, `setAutomationEnabled`, `upsertAutomationTrigger`, `deleteAutomationTrigger`, `setAutomationPolicy` |
| Run | `runAutomation` (manual one-shot) |
| Read / monitor | `automations`, `automation`, `automationTriggers`, `automationPolicy`, `automationRuns`, `automationStats`, `appDiagnostics` |

## Automations that notify players

An automation tick is just a function invocation, so a function with
[notification effects](model-notifications) will push realtime notifications to
clients on every tick — that is how an NPC's movement or a world event reaches
players. See **[Model-driven notifications](model-notifications)**.

For ready-made NPC archetypes (behavior functions + automations deployed
together, plus spawn/read helpers), see the [Game Kit](/crowdyjs/game-kit).
Selectors can also filter targets by **runtime grid permissions**
(`selfPermissionWhere` / `candidatePermissionWhere`, game-api v0.13.12+) —
see [Autonomous processes → Permission predicates](/game-api/autonomous-processes#permission-predicates)
and the typed `KitSelectorSpec` in the Game Kit.
