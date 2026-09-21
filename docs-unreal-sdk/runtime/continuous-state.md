---
slug: continuous-state
sidebar_position: 10
title: Continuous State
description: "Dynamic entity mode: the transform snapshot the owner sends every replication interval with nothing to write, when that default is enough, and the custom executor path for a snapshot that carries more."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Continuous State

Continuous state is how a moving entity moves on every other client. Set the entity component to Dynamic mode and, every replication interval, the owner sends a snapshot of the actor's location and rotation; each other client in range applies it to a proxy through the [rendering backend](./rendering-backends.md). There is nothing to write for that: the SDK's default executor takes the snapshot for you.

:::note[What is coming]
A later SDK release simplifies this further: continuous state will happen by itself, with location and rotation, and need no executor at all, and it adds an extension point for sending your own data alongside them. The aim is to take this setup out of your hands. Everything this page teaches keeps working.
:::

## When to use it

Almost always the default is enough: a pawn, a player, an AI that moves. Write a custom snapshot only when more fields must travel with the transform at the movement cadence, a pose, say. For many small independent values that change at different times, prefer [Crowdy State](./crowdy-state.md) properties: they diff per property and ship only what changed. The two are independent channels, not alternatives; an entity can use both.

:::warning[Dynamic mode is unrelated to ownership and to Crowdy State property replication.]
`Mode` on the entity component chooses whether the continuous channel runs. It does not decide where your replicated properties go, and Static mode does not disable them; both work in either mode. Set Dynamic for a moving entity and nothing else changes.
:::

## The default: no executor at all

Set `Mode` to `ECrowdyEntityMode::Dynamic` and leave `StateExecutor` unset. The SDK's `UCrowdyDefaultActorUpdateExecutor` snapshots the actor's transform into `FCrowdyActorState`, a `Location` and a `Rotation` and deliberately nothing else. With `bAutoRegister` on (the default) the component joins the channel at `BeginPlay`; off, you call `StartReplication` yourself, and `StopReplication` leaves the channel.

The lantern world's mover is `ALanternPlayer`, the player character from the [Quickstart](../quickstart.md): a `UCrowdyEntityComponent` in Dynamic mode with PlayerDerived identity and LocalClient ownership, and a `Torch` point light, so a moving light is what every other client sees.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="executor-basic" />

</TabItem>
<TabItem value="bp" label="Blueprint">

On the Crowdy Entity Component set **Mode** to **Dynamic** in the Details panel and leave **State Executor** empty. There is no graph to build: **Auto Register** joins the channel at BeginPlay.

</TabItem>
</Tabs>

Start the pawn only once the SDK reports the connection up (`OnUDPConnectionSuccess`, or `GetUDPConnectionState()` at `Connected`); the Quickstart spawns it from that event, and the Gotchas say why.

**Success signal.** On a second client the player's torch moves with the owner. `crowdy.entity.trace 1` logs the registration; if nothing moves, check [the backend config](./map-profile.md) before the executor.

:::caution[A host-owned Dynamic entity leaves BeginPlay sending nothing.]
`bAutoRegister` starts the channel only for an entity this client owns outright. A level-placed Dynamic entity with `Ownership = Host` has no owner at `BeginPlay`, so nothing is sent until the host is known; the component logs this once. A moving world entity is driven by the host through `StartReplication` once it knows it is the host, or by an owner after an [ownership transfer](./ownership-transfer.md).
:::

## A custom executor

Subclass `UActorUpdateExecutor` when the snapshot needs more than a transform. Two functions: `GetActorState(UpdateComponent)` returns the `FInstancedStruct` snapshot (`UpdateComponent` is the entity component; `GetOwner()` on it is the actor), and `GetStateStruct()` returns the `UScriptStruct` it is made of, which registers the type for the wire; the struct needs no annotation.

:::danger[Override the `_Implementation` functions, with `const`, never the bare event names.]
Both are `BlueprintNativeEvent`s, so the bare names are not virtual in the generated C++. A native subclass declares `GetActorState_Implementation(const UActorComponent*) const override` and `GetStateStruct_Implementation() const override`; `UCrowdyDefaultActorUpdateExecutor` is the shipped example of the correct shape. Marking `GetActorState` itself `override` does not compile, because there is nothing virtual to override.
:::

`ULanternPlayerExecutor` snapshots `FLanternPlayerState`: the transform the default carries plus one field of the player's own, `bTorchLit`, so a proxy's torch can follow its owner's. The struct is declared next to the executor, and the executor is assigned to `StateExecutor` in the character's constructor. On the other clients the snapshot is applied by the backend's [replication application policy](./rendering-backends.md#the-replication-application-policy), which is what moves a remote player's proxy: the shipped one applies `Location` and `Rotation`, and a policy of your own replaces it, so write one only when your executor sends more than the transform, and then apply the transform yourself first.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="executor-override" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Create a Blueprint with **Actor Update Executor** as its parent class. In **My Blueprint**, under Functions, press **Override** and pick the two functions:

![Get Actor State and Get State Struct in the override list of an Actor Update Executor Blueprint](/img/unreal-sdk/bp-executor-overrides.png)

**Get State Struct** returns the struct type; **Get Actor State** builds the snapshot with **Make InstancedStruct** from the owning actor's transform. Then set the character's **State Executor** to the new class in the Details panel. An override on an executor subclass is not an actor event graph, so the screenshot above is the reference.

</TabItem>
</Tabs>

:::caution[Only the owner runs GetActorState. Keep it a read-only snapshot.]
A remote proxy is fed from the network and never calls it, so a side effect inside the override happens on one client only; a value the proxy needs comes from the backend's policy. Read the actor, fill the struct, return it.
:::

The owner evaluates `GetActorState` every interval (`ReplicationIntervalHz`, 10 by default, 1 to 10 Hz, one clock shared with Crowdy State; `bUseAutoReplicator` off means no polling at all). With `bSendActorStateOnlyOnChange` on, the default, an unchanged snapshot does not repeat: a full keyframe goes out every `ActorKeyframeIntervalSeconds` (3 s) so a late or lossy observer converges, and a heartbeat every `ActorHeartbeatIntervalSeconds` (1 s) so an idle entity is not reaped; off, the snapshot goes out every interval whether it changed or not. The [map profile](./map-profile.md) page lists each field. A field lives on exactly one channel: a `CrowdyState` property whose name and canonical type also match a field of the executor struct is dropped from the Crowdy State layout at discovery, with an error mentioning `also lives in its executor state struct`.

## Gotchas

- `Mode` is orthogonal to `Ownership` and to Crowdy State. Do not set Dynamic hoping to make properties replicate; they already do.
- `_Implementation`, `const`, `override`. The shipped default is the template.
- Nothing is held until the connection is up. `OnUDPConnectionSuccess` already includes the server's readiness wait after assignment, so you never time anything; but an actor update sent before it is neither held nor replayed, so it is lost, mostly silently, until the next interval's update or keyframe repairs it. A Dynamic entity you own that begins play early heals that way; spawn a player pawn from the event instead, as the Quickstart does.
- An unchanged actor is not silent. Set both intervals to 0 and an idle entity sends nothing after its first snapshot, and its observers time it out after the tracker's `ActorTimeoutThreshold`.
- The policy is what moves the proxy. With no Backend Config the shipped `UCrowdyTransformRepPolicy` applies `FCrowdyActorState`, interpolating across a ring of recent samples with bounded extrapolation; a custom struct like `FLanternPlayerState` is skipped until the profile names a policy that reads it, and that policy must apply the transform itself, or the proxy stands still while the owner moves.
- Class identity travels on every update, so several entity classes may share one state struct; the receiver never derives the class from the struct. This is what lets the default executor serve every entity in a project.
- `RegisterStateClass` on `UCrowdyActorManager` is filled for you at `BeginPlay`; you never call it.

## Related

- [Quickstart](../quickstart.md): the player pawn as a Dynamic entity, spawned once connected, and your own reflection as the first thing you see.
- [Entity component](./entity-component.md): `Mode`, `StateExecutor`, `bAutoRegister`, `StartReplication`.
- [Rendering backends](./rendering-backends.md): the policy that moves a proxy from the snapshot.
- [Map profiles](./map-profile.md): the cadence and the keyframe and heartbeat intervals.
- [Connection and reconnect](./connection-and-reconnect.md): what `OnUDPConnectionSuccess` and `Connected` mean.
- [Crowdy State](./crowdy-state.md): the per-property alternative.
