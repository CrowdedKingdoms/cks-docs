---
slug: continuous-state
sidebar_position: 10
title: Continuous State
description: "Dynamic entity mode: the executor snapshot the owner sends every replication interval, the shipped default that needs no code, the correct override signature, and when Crowdy State properties are the better fit."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Continuous State

A Dynamic entity streams a snapshot: at the map's replication cadence the owner asks its `UActorUpdateExecutor` for a struct, `UCrowdyAutoReplicator` sends it, and every other client applies it through the [rendering backend](./rendering-backends.md). It is the channel for several fields that move together at high frequency, a transform first of all.

## When to use it

For movement and anything else that is one coherent snapshot: a position plus a rotation, a pose. For many small independent values that change at different times, prefer [Crowdy State](./crowdy-state.md) properties: they diff per property, ship only what changed, and need no struct or executor at all. The two are independent channels, not alternatives; an entity can use both.

:::warning[Dynamic mode is unrelated to ownership and to Crowdy State property replication.]
`Mode` on the entity component chooses whether the continuous channel runs. It does not decide where your replicated properties go, and Static mode does not disable them; both work in either mode. Set Dynamic for a moving entity and nothing else changes.
:::

## The default: no executor at all

Set `Mode` to `ECrowdyEntityMode::Dynamic` and leave `StateExecutor` unset. The SDK's `UCrowdyDefaultActorUpdateExecutor` snapshots the actor's transform into `FCrowdyActorState`, a `Location` and a `Rotation` and deliberately nothing else. With `bAutoRegister` on (the default) the component joins the channel at `BeginPlay`; off, you call `StartReplication` yourself, and `StopReplication` leaves the channel.

The lantern world's mover is `ALanternPlayer`, the player character. It carries a `UCrowdyEntityComponent` in Dynamic mode with PlayerDerived identity and LocalClient ownership, and a `Torch` point light, so a moving light is what every other client sees.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="executor-basic" />

</TabItem>
<TabItem value="bp" label="Blueprint">

On the Crowdy Entity Component set **Mode** to **Dynamic** in the Details panel and leave **State Executor** empty. There is no graph to build: **Auto Register** joins the channel at BeginPlay.

</TabItem>
</Tabs>

**Success signal.** On a second client the player's torch moves with the owner. `crowdy.entity.trace 1` logs the registration; the actor manager's proxy comes from the map profile's backend, so if nothing moves, check [the backend config](./map-profile.md) before the executor.

:::caution[A host-owned Dynamic entity leaves BeginPlay sending nothing.]
`bAutoRegister` starts the channel only for an entity this client owns outright. A level-placed Dynamic entity with `Ownership = Host` has no owner at `BeginPlay`, so nothing is sent until the host is known; the component logs this once. A moving world entity is driven by the host through `StartReplication` once it knows it is the host, or by an owner after an [ownership transfer](./ownership-transfer.md).
:::

## A custom executor

Subclass `UActorUpdateExecutor` when the snapshot needs more than a transform. Two `BlueprintNativeEvent`s:

- `GetActorState(UpdateComponent)` returns the `FInstancedStruct` snapshot. `UpdateComponent` is the entity component driving replication; `GetOwner()` on it is the actor. Runs on the owner only, at the cadence.
- `GetStateStruct()` returns the `UScriptStruct` the snapshot is made of. Declaring it here is what registers the type for wire serialization; no struct annotation is needed.

:::danger[Override the `_Implementation` functions, with `const`, never the bare event names.]
Both are `BlueprintNativeEvent`s, so the bare names are not virtual in the generated C++. A native subclass declares `GetActorState_Implementation(const UActorComponent*) const override` and `GetStateStruct_Implementation() const override`; `UCrowdyDefaultActorUpdateExecutor` is the shipped example of the correct shape. Marking `GetActorState` itself `override` does not compile, because there is nothing virtual to override.
:::

`ULanternPlayerExecutor` snapshots `FLanternPlayerState`: the transform the default carries plus one field of the player's own, `bTorchLit`, so a proxy's torch can follow its owner's. The struct is declared next to the executor, and the executor is assigned to `StateExecutor` in the character's constructor.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="executor-override" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Create a Blueprint with **Actor Update Executor** as its parent class. In **My Blueprint**, under Functions, press **Override** and pick the two functions:

![Get Actor State and Get State Struct in the override list of an Actor Update Executor Blueprint](/img/unreal-sdk/bp-executor-overrides.png)

**Get State Struct** returns the struct type; **Get Actor State** builds the snapshot with **Make InstancedStruct** from the owning actor's transform. Then set the character's **State Executor** to the new class in the Details panel. There is no generated graph for this one: an override on an executor subclass is not an actor event graph, so the screenshot above is the reference.

</TabItem>
</Tabs>

:::caution[Only the owner runs GetActorState. Keep it a read-only snapshot.]
A remote proxy is fed from the network and never calls it, so a side effect inside the override happens on one client only. Read the actor, fill the struct, return it.
:::

Class identity travels on every update alongside the snapshot, so several entity classes may share one state struct; the receiver never derives the class from the struct type. This is also what lets the default executor be shared by every entity in a project.

## Cadence: what a tick sends

The owner evaluates `GetActorState` every interval; whether anything goes out is the map profile's decision (`UCrowdyAutoReplicator` runs one pure rule for it, with three answers: nothing, a full snapshot, or a heartbeat):

| Map profile field | Default | Effect |
|---|---|---|
| `bUseAutoReplicator` | on | Off means no polling at all. A map with no profile is the same. |
| `ReplicationIntervalHz` | 10 | The cadence, 1 to 10 Hz. Shared with Crowdy State, which sends separately. |
| `bSendActorStateOnlyOnChange` | on | An unchanged snapshot does not repeat. Off restores an unconditional send every interval. |
| `ActorKeyframeIntervalSeconds` | 3.0 | A full re-send of an unchanged snapshot, so a late or lossy observer converges. 0 disables. |
| `ActorHeartbeatIntervalSeconds` | 1.0 | A spatial header with no state, so an idle entity is not reaped by its observers. 0 disables. |

:::note[An unchanged actor is not silent.]
With both intervals at their defaults an idle entity sends a heartbeat every second and a keyframe every three. Set both to 0 and an idle entity sends nothing after its first snapshot, and its observers will time it out after the tracker's `ActorTimeoutThreshold`.
:::

## How a field ends up on exactly one channel

A `CrowdyState` property whose name and canonical type also match a field of the actor's executor struct is dropped from the Crowdy State layout at discovery, with an error mentioning `also lives in its executor state struct`. Put a field in the snapshot or in a property, not both.

## Gotchas

- `Mode` is orthogonal to `Ownership` and to Crowdy State. Do not set Dynamic hoping to make properties replicate; they already do.
- `_Implementation`, `const`, `override`. The shipped default is the template.
- The snapshot is applied through the backend's policy. With no Backend Config the shipped `UCrowdyTransformRepPolicy` applies `FCrowdyActorState`; a custom struct like `FLanternPlayerState` is skipped until the profile names a policy that reads it, so the proxy stands still while the owner moves.
- `GetActorState` is the owner's function. A proxy that needs a value from the snapshot gets it from the backend's policy, not by calling the executor.
- `RegisterStateClass` on `UCrowdyActorManager` is filled for you at `BeginPlay`; you never call it.

## Related

- [Entity component](./entity-component.md): `Mode`, `StateExecutor`, `bAutoRegister`, `StartReplication`.
- [Rendering backends](./rendering-backends.md): the policy that consumes the snapshot on a proxy.
- [Map profiles](./map-profile.md): the cadence and the keyframe and heartbeat intervals.
- [Crowdy State](./crowdy-state.md): the per-property alternative.
