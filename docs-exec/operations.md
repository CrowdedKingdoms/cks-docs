---
sidebar_position: 6
title: Operations
---

# Operations

:::caution Dev-tier preview
Available on the **dev** environment only; see the [overview](intro).
:::

Everything you need to run an app's ck-exec code: its logs, what is running and where, its
versions and a rollback, a kill switch, what it costs, and a developer connection for tools
and admin endpoints.

Reads need the org's `view_compute_diagnostics` permission. Changes and developer connections
need `manage_compute`. None of them take an app token: use your own session.

## Logs

A hub or spoke logs with `ctx.log`:

```rust
ctx.log(Level::Warn, &format!("wave {} took {} ms", self.wave, took));
```

`execLogs` returns the app's lines, newest first:

```graphql
query {
  execLogs(appId: "…", nodeType: "arena", maxLevel: 1, limit: 50) {
    id
    nodeType
    key
    level
    host
    at
    text
  }
}
```

| Argument | Meaning |
|---|---|
| `nodeType`, `key` | Only one type, or one instance. |
| `maxLevel` | The least severe level included: 0 errors only, 1 warnings too, 2 info, 3 everything (the default). |
| `before` | A line `id`: only older lines. Pass the oldest `id` you have to page back. |
| `limit` | At most this many lines, default 100 and at most 500. |

Lines are kept for 24 hours, within these limits:

- **Per call:** a handler call logs at most 32 lines, and each line is cut to 1 KiB.
- **Per host:** each execution host keeps 50 lines a second per app, in bursts of up to 200.
- **Per app:** at most 200 lines a second and 100,000 a day, across hosts.

When a host drops lines over its rate, the log gets one warning line saying how many.

## Instances and versions

`execInstances(appId)` lists what the platform has placed for the app:

| Field | Meaning |
|---|---|
| `nodeType`, `key` | Which instance it is. |
| `kind` | `hub` or `spoke`. |
| `phase` | `idle`, `starting`, `running` or `stopping`. |
| `host` | The host it runs on. |
| `epoch` | Rises each time it's placed. |
| `sinceMs` | How long it has been in this phase. |
| `heldBack` | Why it isn't being placed right now, when it isn't. Either it crashed five times within a minute, and is placed again as those crashes age out, or its last start failed, and it's retried after 5 seconds. |

`execVersions(appId)` lists every deploy, newest first, and marks the active one.
`execActivateVersion(appId, version)` makes an earlier one active again, which is a rollback.
Running instances pick it up when they next start, just as they do after a deploy. A hub stops
when it has been idle for its eviction window or the app has been empty that long, and one whose
timer is pending doesn't go idle while players are in. To move such a hub now, switch its type
off and on with the kill switch below: it persists, stops, and its next call starts it on the
active version from its snapshot.

## The kill switch

```graphql
mutation {
  execSetEnabled(appId: "…", nodeType: "mobs", enabled: false) {
    activeVersion
    disabled
    disabledTypes
    budgetPaused
  }
}
```

Without `nodeType`, the whole app is switched off. While a type is off:

- nothing of it is placed;
- running instances are persisted and stopped;
- calls to it are refused with `Denied`.

With the whole app off, players aren't given a host at all. Switch it on again and instances
start as they're called. `execAppStatus(appId)` shows the switches.

## Usage and budgets

ck-exec code is metered per minute and billed in compute units, like the WASM engines it
replaces: the greater of the CPU time and the fuel a minute used. Realtime events count as
replication egress.

An app's code is **paused** (`budgetPaused`) in two cases:

- its last settled minute was over an enforced per-minute compute budget (`setAppComputeBudget`
  with `enforce: true`);
- the app's runtime status is not active, for example because the account ran out of funds.

A paused app is switched off entirely, as above. It resumes by itself the minute after both
conditions clear.

## Developer connections

`execConnectAsDeveloper` returns a gateway and a connect token for **you**, not a player:

```graphql
mutation {
  execConnectAsDeveloper(appId: "…", nodeType: "arena", key: "m1") {
    gatewayUrl
    token
    host
    expiresAt
  }
}
```

Calls on that connection arrive as `Caller::Developer(your user id)`. They may reach any node
type, not only `client` ones, so a tool can call admin endpoints, run a job by hand, or inspect
a hub. They can never reach the platform's `$` methods, and subscribing doesn't count as a
player session. Guard an admin endpoint with `call.developer()`:

```rust
"reset_wave" => {
    let by = call.developer()?; // refuses players and other instances
    ctx.log(Level::Info, &format!("wave reset by developer {by}"));
    self.wave = 0;
    encode(&true)
}
```

A module built with an older `ckx-sdk` (guest ABI 3 or earlier) refuses developer calls. Rebuild
it with the current SDK first.

## From an SDK

| CrowdyJS `client.exec` | CrowdyCPP `client.exec()` |
|---|---|
| `logs(appId, { nodeType, key, maxLevel, before, limit })` | `logs(appId, ExecLogsQuery)` |
| `instances(appId)`, `versions(appId)`, `status(appId)` | the same, each with an `…Async` twin |
| `activateVersion(appId, version)` | `activateVersion(appId, version)` |
| `setEnabled(appId, enabled, nodeType?)` | `setEnabled(appId, enabled, nodeType)` |
| `connectAsDeveloper(appId, { nodeType, key })` | `connectAsDeveloper(appId, ExecConnectOptions)` |

These need CrowdyJS `17.10.0-dev` or CrowdyCPP `0.45.0` on dev.

## Coming from the legacy APIs

| Legacy | ck-exec |
|---|---|
| `computeModuleLogs`, `playerComputeLogs` | `execLogs` |
| `computeModuleRuns`, `computeModuleStats`, `computeAppDiagnostics`, `gameModelAppDiagnostics`, automation runs and stats | `execInstances` for what runs where, and `execLogs` for what it said |
| `computeModuleVersions`, `computeDeployVersion` | `execVersions`, and `execDeploy` then `execActivateVersion` to go back |
| `computeSetModuleEnabled`, `playerComputeSetEnabled` | `execSetEnabled` |
| `computeResetBreaker` | Nothing to reset: a crash-looping instance is held back (`heldBack`) until its crashes are a minute old, then placed again |
| `computeInvoke`, `gameModelInvoke` (manual runs) | `execConnectAsDeveloper`, then call the endpoint |
| `appComputeBudget`, `setAppComputeBudget` | The same budget; an enforced one pauses ck-exec code too |

Next: [builds and starter packs](builds).
