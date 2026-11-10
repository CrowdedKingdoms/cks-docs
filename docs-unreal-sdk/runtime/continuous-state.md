---
slug: continuous-state
sidebar_position: 10
title: Continuous State
description: "Replicate Movement: the transform and aim snapshot the owner sends every replication interval with nothing to write, how a remote character animates, when that default is enough, and the custom executor path for a snapshot that carries more."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Continuous State

Continuous state is how a moving entity moves on every other client. When the entity component replicates movement, every replication interval the owner sends a snapshot of the actor's location, rotation and aim pitch; each other client in range applies it to a proxy through the [rendering backend](./rendering-backends.md). There is nothing to write for that: the SDK's default executor takes the snapshot for you.

## When to use it

Almost always the default is enough: a pawn, a player, an AI that moves. To send a value of your own with the movement, a lean, a stance, how far a character is leaning into a turn, mark the property [continuous](#send-your-own-values-with-the-movement). Write a custom snapshot only when you need to replace what the snapshot holds. For many small independent values that change at different times, prefer plain [Crowdy State](./crowdy-state.md) properties: they diff per property and ship only what changed. The two are independent channels, not alternatives; an entity can use both.

:::warning[Replicate Movement is unrelated to ownership and to Crowdy State property replication.]
`ReplicateMovement` on the entity component chooses whether the continuous channel runs. It does not decide where your replicated properties go, and Off does not disable them or events; all of them work either way. Turn movement on for a moving entity and nothing else changes.
:::

## The default: no executor at all

`ReplicateMovement` is `Auto` by default: on for a pawn with a movement component (a Character, for one), off for anything else. So a character sends its movement with no setup, and a plain actor that should move must set `ECrowdyReplicateMovement::On`. `Off` sends no movement. `ReplicatesMovement()`, Blueprint node **Replicates Movement**, reads the answer.

Leave `StateExecutor` unset. The SDK's `UCrowdyDefaultActorUpdateExecutor` snapshots the actor into `FCrowdyActorState`: a `Location`, a `Rotation`, and an `AimPitch` and deliberately nothing else. `AimPitch` is a float in degrees, filled from where a pawn is looking. With `bAutoRegister` on (the default) the component joins the channel at `BeginPlay`; off, you call `StartReplication` yourself, and `StopReplication` leaves the channel.

The lantern world's mover is `ALanternPlayer`, the player character from the [Quickstart](../quickstart.md): a `UCrowdyEntityComponent` that sends its movement, with PlayerDerived identity, Owned By Player, and a `Torch` point light, so a moving light is what every other client sees.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="executor-basic" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A Character sends its movement by default, so leave **Replicate Movement** at **Auto** and **State Executor** empty. On a plain actor that should move, set **Replicate Movement** to **On**. There is no graph to build: **Auto Register** joins the channel at BeginPlay.

</TabItem>
</Tabs>

## Animating a remote character

A remote character on the actor pool animates with no custom code. The policy gives a proxy's stopped movement component a velocity and an acceleration from the snapshots, and sets its remote view pitch from `AimPitch`. An Animation Blueprint that reads velocity and **Get Base Aim Rotation** works unchanged.

Two limits:

- A proxy plays no jump or fall animation, because its movement mode is None.
- **Get Base Aim Rotation** reads 0 to 360 on a proxy, so looking down at -40 degrees reads 320. An aim offset must run the pitch through **Normalize Axis** first.

Mass rows ignore aim pitch.

Start the pawn only once the SDK reports the connection up (`OnUDPConnectionSuccess`, or `GetUDPConnectionState()` at `Connected`); the Quickstart spawns it from that event, and the Gotchas say why.

**Success signal.** On a second client the player's torch moves with the owner. `crowdy.entity.trace 1` logs the registration; if nothing moves, check [the backend config](./map-profile.md) before the executor.

:::caution[A World-owned entity that replicates movement leaves BeginPlay sending nothing.]
`bAutoRegister` starts the channel only for an entity this client owns outright. A level-placed entity that replicates movement, Owned By World (or Auto) has no owner at `BeginPlay`, so nothing is sent; the component logs this once. By default no client writes a World entity, so it stays still for everyone. The rest of this caution applies under Elected Host, see [Leader Source](./leader.md#leader-source-with-or-without-a-host): nothing is sent until the host is known, and the host drives a moving world entity through `StartReplication` once it knows it is the host. Otherwise an owner drives it after an [ownership transfer](./ownership-transfer.md).
:::

## Send your own values with the movement

Mark a [Crowdy State](./crowdy-state.md) property continuous and it travels on the entity's movement updates instead of as a delta of its own. You write no executor, no state struct and no rendering policy. Use it for a value that changes as often as the movement does, so that a delta per change would cost more than the update it can ride.

`ALanternPlayer`'s torch sways with every step:

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="continuous-custom" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Select the variable, and in the Details panel set **Crowdy Replication** to **Replicated (Continuous)**. The **RepNotify** row works as it does for **Replicated**. **Advanced** is hidden, because none of its options apply. Recompile.

</TabItem>
</Tabs>

What you get:

- **Every client in range.** The value goes when it changes and on every keyframe, so a client that joins later gets it within `ActorKeyframeIntervalSeconds`. A steady value costs nothing between keyframes. A change lost on the way is repaired by the next change or keyframe.
- **Applied on arrival.** The value lands as the update arrives, about one interpolation delay ahead of the drawn position. Its `CrowdyOnRep` runs on every client that took a new value and on the owner.
- **On Mass rows too.** An entity drawn as a crowd row receives the value through a [state fragment field](../mass/add-your-own-crowd-data.md), as it does any Crowdy State property. A row has no notify.

:::warning[A continuous value is for a class that replicates movement.]
On a class that does not, the property warns once and replicates as ordinary Crowdy State, so nothing is lost. The same happens with `CrowdyOwnerOnly` or `CrowdyManualDirty` on the property: a movement update reaches everyone near and has its own clock. On an entity whose updates are stopped, with `StopReplication` or before `StartReplication`, the property goes as a delta and on every keyframe until they start.
:::

Continuous values are for properties on the actor class, not on its components, and together they share one datagram with the movement: about 1,000 bytes, less your snapshot. Past that they are left off and the log says so. Keep long strings in plain Crowdy State.

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

The owner evaluates `GetActorState` every interval (`ReplicationIntervalHz`, 10 by default, 1 to 10 Hz, one clock shared with Crowdy State; `bUseAutoReplicator` off means no polling at all). With `bSendActorStateOnlyOnChange` on, the default, an unchanged snapshot does not repeat: a full keyframe goes out every `ActorKeyframeIntervalSeconds` (3 s), which is what other players receive from an idle entity and so what keeps it on their screens, and a heartbeat every `ActorHeartbeatIntervalSeconds` (1 s), which only keeps its presence on the server from going stale; off, the snapshot goes out every interval whether it changed or not. The [map profile](./map-profile.md) page lists each field. A field lives on exactly one channel: a `CrowdyState` property whose name and canonical type also match a field of the executor struct is dropped from the Crowdy State layout at discovery, with an error mentioning `also lives in its executor state struct`.

## Gotchas

- `ReplicateMovement` is orthogonal to `OwnedBy` and to Crowdy State. Do not set it On hoping to make properties replicate; they already do.
- `_Implementation`, `const`, `override`. The shipped default is the template.
- Nothing is held until the connection is up. `OnUDPConnectionSuccess` already includes the server's readiness wait after assignment, so you never time anything; but an actor update sent before it is neither held nor replayed, so it is lost, mostly silently, until the next interval's update or keyframe repairs it. An entity you own that replicates movement and begins play early heals that way; spawn a player pawn from the event instead, as the Quickstart does.
- An unchanged actor is not silent. Set both intervals to 0 and an idle entity sends nothing after its first snapshot, and its observers time it out after the tracker's `ActorTimeoutThreshold`.
- The policy is what moves the proxy. With no Backend Config the shipped `UCrowdyTransformRepPolicy` applies `FCrowdyActorState`, interpolating across a ring of recent samples with bounded extrapolation; a custom struct like `FLanternPlayerState` is skipped until the profile names a policy that reads it, and that policy must apply the transform itself, or the proxy stands still while the owner moves.
- Class identity travels on every update, so several entity classes may share one state struct; the receiver never derives the class from the struct. This is what lets the default executor serve every entity in a project.
- `RegisterStateClass` on `UCrowdyActorManager` is filled for you at `BeginPlay`; you never call it.

## Related

- [Quickstart](../quickstart.md): the player pawn as an entity that replicates movement, spawned once connected, and your own reflection as the first thing you see.
- [Entity component](./entity-component.md): `ReplicateMovement`, `StateExecutor`, `bAutoRegister`, `StartReplication`.
- [Rendering backends](./rendering-backends.md): the policy that moves a proxy from the snapshot.
- [Map profiles](./map-profile.md): the cadence and the keyframe and heartbeat intervals.
- [Connection and reconnect](./connection-and-reconnect.md): what `OnUDPConnectionSuccess` and `Connected` mean.
- [Crowdy State](./crowdy-state.md): the per-property alternative.
