---
slug: debugging-and-logging
sidebar_position: 13
title: Debugging and Logging
---

# Debugging and Logging

When replication looks wrong, the fastest path to an answer is a simple loop:

1. Turn on the trace that matches the area you are debugging.
2. Reproduce the problem.
3. Read the log.

This page covers the trace console variables, the loopback variable for single-client RPC testing, and how to raise log verbosity per module.

## The trace console variables

Each SDK module exposes a `crowdy.<area>.trace` console variable.

- Set it to `1` to print informational traces for that area.
- Set it to `0` to turn them off.

Warnings and errors are always printed regardless of the trace setting. The trace flag only gates the extra informational lines.

Open the console in Play in Editor or in a packaged build, then set the flag for the area you care about.

```text
crowdy.rpc.trace 1
```

Common trace flags:

- `crowdy.net.trace` covers the UDP transport: connect, message send and receive, and the worker pool. GraphQL queries are `crowdy.query.trace`, and payload serialization is `crowdy.serialize.trace`.
- `crowdy.entity.trace` covers the entity subsystem: registry changes, event routing and dispatch, and actor tracking. Actor pool and rendering backend churn is `crowdy.pool.trace`.
- `crowdy.rpc.trace` covers RPC event send, receive, routing, and ownership decisions.
- `crowdy.state.trace` covers Crowdy State property replication: per-delta send and receive lines with entity, changed-property count, byte size, and whether the delta went out as spatial, owner-only, or a keyframe.
- `crowdy.services.trace` covers the high-level subsystems such as teams, channels, avatars, host, and persistence.

For the complete table of trace variables and every other console variable the SDK ships, see the [console variables reference](/unreal-sdk/reference/console-cvars).

:::note
Trace output never includes bearer tokens or other secret material. It is safe to share a trace log when reporting an issue.
:::

## Single-client RPC testing with loopback

RPC events normally need at least two clients: an owner that sends and a remote proxy that receives. To exercise an RPC path with a single Play in Editor client, turn on loopback.

```text
crowdy.rpc.loopback 1
```

With loopback on, an event you send is also delivered back to your own client. This lets you verify, all without a second client, that:

- The send site fires.
- The call serializes.
- The receiver `Name_Implementation` runs.

Turn it off again before you test real two-client routing.

```text
crowdy.rpc.loopback 0
```

:::warning
Loopback is for single-client testing only. Turn it off before testing real two-client routing, or the extra self-delivery will mask routing problems.
:::

:::note
Crowdy State has its own single-client switch, `crowdy.state.loopback`. It mirrors each owned entity locally so property deltas and their `CrowdyOnRep` notifies fire with a single client. See the [console variables reference](/unreal-sdk/reference/console-cvars) and [Crowdy State](/unreal-sdk/runtime/crowdy-state).
:::

## Allowing object loads during RPC receive

An RPC parameter can carry an object or class reference. When a received reference points to an asset that is not yet loaded, the SDK does not load it by default.

To allow a synchronous load on receive, set:

```text
crowdy.rpc.allowObjectLoad 1
```

:::caution
Leave this off unless you have a specific reason to enable it. A synchronous load on the receive path can stall the game thread, so prefer references to assets that are already loaded.
:::

## Per-module log categories

Every SDK module logs under its own category. You can raise the verbosity of a single category without touching the rest of the engine log.

Use the `Log` console command with a category name and a verbosity level.

```text
Log LogCrowdyReplication Verbose
```

Categories follow the module names:

- `LogCrowdyNet`
- `LogCrowdyReplication`
- `LogCrowdyRPC`
- `LogCrowdyServices`

For the full set of log categories, see the [console variables reference](/unreal-sdk/reference/console-cvars).

Verbosity levels run from `Log` (the default) up through `Verbose` to `VeryVerbose`. Set a category back to its default when you are done.

```text
Log LogCrowdyReplication Log
```

You can also pin a category's verbosity at startup by adding it to `DefaultEngine.ini` under the log settings. This is useful when the problem happens before you can open the console.

```ini
[Core.Log]
LogCrowdyReplication=Verbose
```

:::tip
Verbose logging and the `crowdy.<area>.trace` flags are complementary. The trace flags add SDK-specific informational lines, while raising the log category verbosity surfaces the lower-level engine-style logging the SDK emits. Turn on both when you need the full picture for one area.
:::

## A short debugging workflow

Match the symptom to a trace, then follow the loop:

1. Decide which area the problem belongs to:
   - Replication that looks dead is usually `crowdy.entity.trace`, or `crowdy.state.trace` for property replication.
   - An RPC that does not arrive is `crowdy.rpc.trace`.
   - A team or channel call that returns nothing is `crowdy.services.trace`.
2. Turn on the matching trace, and raise the matching log category to `Verbose` if you need more detail.
3. Reproduce the problem with the trace running.
4. Read the log from the moment of the action. The trace lines show what the SDK decided and where it stopped.

:::caution
If replication appears completely inactive on a map and no traces fire, the most common cause is a missing map profile, not a logging problem. A map with no profile leaves the entity subsystem, the auto replicator, and the actor manager silent, with only a warning. Confirm the map has a profile before you dig deeper into traces. See [the map profile setup](/unreal-sdk/runtime/map-profile).
:::

Turn the trace and verbosity back down once you have your answer. Leaving traces on adds log volume and a small per-frame cost.
