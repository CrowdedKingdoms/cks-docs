---
slug: rendering-backends
sidebar_position: 14
title: Rendering Backends
description: "How a remote entity's continuous state becomes something on screen: the actor-pool backend the SDK ships, the policy class you subclass to apply your own state struct, the pool policy, and how to write a backend of your own."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Rendering Backends

A rendering backend turns the [continuous state](./continuous-state.md) a remote entity's owner sends into something on screen for everyone else. The SDK ships one, the actor pool; a project customises it through two policy classes, or replaces it by implementing four methods.

## When you touch this

When a Dynamic entity moves on its owner and not on anyone else, when you want your own state struct applied to a proxy, or when pooled actors of the entity's class are the wrong way to draw a crowd. A Static entity never comes through here: its proxy is spawned by the spawn event and driven by Crowdy State and events.

## The default: the actor pool

`FCrowdyActorManagementConfigStruct::BackendClass` on the map profile defaults to `UCrowdyActorPoolBackend`, so a profile that never chose a backend gets this one. It uses `UCrowdyActorPoolSubsystem` to keep a pool of pre-spawned actors per entity class, checks one out when a remote entity appears, registers it in the entity registry so entity-targeted events reach it like any actor, and hands every update to a `UCrowdyRepApplicationPolicy`: the shipped `UCrowdyTransformRepPolicy` unless you provide one.

![The Actor Management category of a map profile: Backend Class and Backend Config](/img/unreal-sdk/map-profile-backend-select.png)

The screenshot is the SDK's shipped default profile, and its **Backend Config** reads None: the backend runs on a built-in config in that case.

:::note[No Backend Config means the built-in one: the actor pool with the transform policy.]
When `BackendConfig` is empty, `UCrowdyActorPoolBackend::InitializeBackend` creates a transient **Actor Pool Backend Config** and, since it names no policy, instantiates `UCrowdyTransformRepPolicy`: it reads the default executor's `FCrowdyActorState` and sets the pooled actor's location and rotation, interpolated across a ring of recent samples with bounded extrapolation. A `BackendConfig` of another backend's class is refused: the backend logs `Backend Config is a <class>, but this backend needs a CrowdyActorPoolBackendConfig` and returns false, the actor manager logs `could not initialize, so no remote entity will be drawn on this map`, and remote entities arriving as continuous-state updates are tracked with nothing on screen. Spawn-event proxies and Crowdy State are unaffected either way. See [Map profiles](./map-profile.md).

The fallback arrived in 2.15.0. On 2.14.0 and earlier an empty Backend Config, or one with no Replication Policy Class, tracks remote entities and draws nothing, and the fix there is an **Actor Pool Backend Config** naming `UCrowdyTransformRepPolicy`. See [What's Changed](../guides/whats-changed.md#2026-09-22-sdk-v2150).
:::

### Configure it

`UCrowdyActorPoolBackendConfig`, set as the profile's `BackendConfig`:

| Field | Default | Effect |
|---|---|---|
| `ReplicationPolicyClass` | none | Your `UCrowdyRepApplicationPolicy` subclass. Unset means `UCrowdyTransformRepPolicy`, which moves the proxy from `FCrowdyActorState`; set it when your executor sends more than the transform, and move the proxy yourself in it. |
| `PoolPolicyClass` | none, optional | A `UCrowdyActorPoolPolicy` subclass. Unset means the concrete base, which already hides pooled actors, shows them on activation, and strips proxy movement. |
| `DefaultPoolSizePerClass` | 8 | Pools are created lazily per entity class at this size. |
| `PerClassPoolOverrides` | empty | A per-class pool size; a class listed here is also pre-warmed at map load. |

:::caution[A custom executor needs a matching policy. The default policy reads FCrowdyActorState and refuses anything else.]
`UCrowdyTransformRepPolicy` skips an update whose struct is not `FCrowdyActorState`, so a Dynamic entity whose executor sends its own struct stands still until its profile names a policy that reads it. `UCrowdyRepApplicationPolicy` has two pure virtuals and requires a subclass; `UCrowdyActorPoolPolicy` ships full bodies and is meant to be instantiated as is.
:::

### The replication application policy

The policy is what moves a remote player's proxy. Continuous state is how pawns, players, and AI move, so a policy's first job is to take the location and rotation out of each update and put the proxy where the owner was at `RenderTimeMs`. The shipped `UCrowdyTransformRepPolicy` does exactly that for `FCrowdyActorState`, and for a pawn that only moves it is all you need. You write your own only when your executor sends more than the transform, and then you apply the transform yourself first and your extra fields after, because a custom policy replaces the shipped one rather than adding to it: `UCrowdyActorPoolBackend::ResolvePolicyClass` instantiates the config's class instead of `UCrowdyTransformRepPolicy`, so a policy that never sets location and rotation leaves every proxy under it standing still.

`UCrowdyRepApplicationPolicy` reads a state struct out of each update and applies it to the pooled actor each frame:

| Override | Called | What you do |
|---|---|---|
| `ExtractFields(State, ServerTimestampMs, SlotId)` | Per update, per slot | Read your struct out of `State` into your own per-slot buffers. Return false when the struct type is wrong and the update is skipped. |
| `ApplyToActor(Actor, SlotId, RenderTimeMs)` | Per frame, per active slot | Apply the buffered state, interpolated to `RenderTimeMs`, to the actor. |
| `OnInstanceActivated(Actor, InitialState)` | Once, when a slot activates | A `BlueprintNativeEvent`: set initial state on the actor. |
| `OnInstanceDeactivated(SlotId)` | When the entity leaves | Clean up per-slot state. |
| `GetExpectedSlotCount()` | At startup | How many slots to pre-allocate; 64 by default. Match your expected player count. |

#### The sample ring

Both the shipped policy and the example below keep their per-slot history in `TInterpolatedField<T, Capacity>`, a small ring buffer the SDK ships in `Data/TInterpolatedField.h`, 32 samples deep by default. `TInterpolatedField::Push(Value, TimestampMs)` stores one sample with the server timestamp the update carried. `TInterpolatedField::Sample(RenderTimeMs, LerpFn)` finds the two samples that bracket the render time by binary search and blends between them with the function you pass (`FMath::Lerp` for a location; a quaternion slerp for a rotation). When the render time runs past the newest sample, `Sample` extrapolates from the last two by calling the same function with an alpha above 1, for at most 0.2 seconds beyond the newest; after that it holds the value extrapolated to 0.2 seconds. A render time older than the oldest sample takes the same path backwards from the newest pair, with no cap; a slot is in that state only briefly after activation, until the render time, which runs one interpolation delay behind, catches up with the samples already held. A location follows that extrapolation in full; the rotation slerp clamps its alpha to 1.2, so a rotation extrapolates by at most a fifth of a step. With one sample it returns that sample; with none, the default you pass. `PhysicalIndex` is the ring's own index arithmetic, nothing you call.

The reason a proxy built on it does not jitter is the render time itself: the actor manager renders at the estimated server time minus the interpolation delay (100 ms), so the proxy is always drawn a little behind the newest sample, between two samples it already holds, and never snaps to the latest one as it lands. Extrapolation only runs when an update is late, and its cap keeps a lost stream from sliding a proxy across the map.

#### The example: the same shape, with your own field added

`ULanternRepPolicy` is what the shipped policy does, plus one field. `FLanternPlayerState`, the struct the [continuous state](./continuous-state.md) page's executor sends for `ALanternPlayer`, carries `Location`, `Rotation`, and `bTorchLit`. The policy keeps one `TInterpolatedField<FVector>` and one `TInterpolatedField<FRotator>` per slot: `ExtractFields` refuses any other struct type and pushes the location and rotation with the update's server timestamp; `ApplyToActor` samples both at `RenderTimeMs`, calls `SetActorLocationAndRotation` on the proxy, and only then applies the torch flag to the proxy's `Torch` light. The flag is applied as the latest value: a boolean is not something to blend. `OnInstanceDeactivated` resets the slot so a reused slot never starts from a departed player's history. The policy header includes `LanternPlayer.h` for the struct, so this snippet depends on the [`executor-override` block](./continuous-state.md#a-custom-executor) being in your project first.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="backend-policy" />

<CppSnippet id="backend-policy-apply" />

</TabItem>
<TabItem value="bp" label="Blueprint">

`ExtractFields` and `ApplyToActor` are C++ only, so the policy class is C++. Set it as **Replication Policy Class** on the Actor Pool Backend Config in the map profile's Details panel. `OnInstanceActivated` is the one hook a Blueprint subclass of the policy may implement.

</TabItem>
</Tabs>

### The pool policy

`UCrowdyActorPoolPolicy` decides what a pooled actor does at three moments, each a `BlueprintNativeEvent` a Blueprint subclass can implement without C++: `OnActorPooled(Actor)` once per actor right after it is spawned into the pool, `OnActorActivated(Actor, InitialState)` when it is checked out (its `InitialState` is empty in the shipped pool, and the identity lands on the component right after it returns), and `OnActorDeactivated(Actor)` when it goes back. The base hides and shows the actor and disables proxy movement; subclass only to add per-actor behaviour at those moments.

Pooled actors are genuinely spawned (`SpawnActorDeferred` and `FinishSpawning`), so their constructors and Blueprint-added components run. Before `BeginPlay` the pool marks any entity component on them dormant, so a pre-warmed actor registers no entity and no listener, Game Model containers included, acts on an actor that stands for nothing. `UCrowdyActorPoolSubsystem::RegisterPool(FCrowdyPoolConfig)` (`ActorClass`, `PoolPolicyClass`, `PoolSize`) is what the backend calls to create a pool, a no-op for a class that already has one; `AcquireActor` and `ReleaseActor` check actors out and in. `crowdy.pool.trace 1` logs spawn, release, and reuse.

## What a pooled proxy does and does not do

:::warning[A pooled Dynamic proxy never sees the spawn event's InitialState.]
The spawn event creates a proxy actor and broadcasts `OnCrowdySpawned` with the payload; the actor pool then treats that actor as an orphan, destroys it, and swaps in a pre-warmed pooled actor that never received it. Anything a proxy needs to look right must be a class default or a field of the replicated state struct, never a one-time spawn value.
:::

:::warning[The owner of a client-spawned Dynamic entity sees two visuals.]
The pool is fed only by inbound network state, so the owner ends up with the local actor it drives directly and the pooled proxy the server echoes back, interpolation-delayed. There is no per-entity flag to choose. Hide one side yourself, in the entity's own code: `SetActorHiddenInGame` on the local actor when `IsLocallyOwned()` if the round-tripped proxy is the one that should show. With **Enable Owner Tracking** on (the default) the local player's own avatar is echoed and drawn the same way; turning it off suppresses that one echo and no other owned entity's.
:::

- A proxy's `GetNetID()` and `GetRole()` work: the backend assigns the identity to the pooled actor's component when it checks it out. `RemoteProxy` is the role it reports.

## Swapping at runtime

`UCrowdyActorManager::SetBackend(NewBackend)` (Blueprint: **Set Backend**) swaps the active backend: the previous one is deinitialized, slot state is preserved, and the new one receives `ApplyInterpolation` from the next tick. The new backend must already be initialized, and `InitializeBackend` is C++ only, so this is a C++ operation in practice. `GetActiveBackend()` is the live backend, null when none initialized; a backend that refused to initialize is absent here and present in the profile, which is how to tell the two apart from code.

## Writing a backend

Subclass `UCrowdyRenderingBackend` and pair it with a `UCrowdyRenderingBackendConfig` subclass carrying whatever your backend needs (an instanced mesh, a pool size). Four overrides are required and two optional:

| Override | Required | Contract |
|---|---|---|
| `ActivateInstance(SlotId, UUID, EntityClass, InitialState)` | yes | A remote instance became visible. Acquire the rendering resource for `SlotId`. `EntityClass` is never null. |
| `DeactivateInstance(SlotId, UUID)` | yes | It left. Release the resource and the per-slot state. |
| `ExtractUpdate(State, ServerTimestampMs, SlotId)` | yes | An update arrived. Parse the struct into your interpolation buffers. |
| `ApplyInterpolation(SlotId, RenderTimeMs)` | yes | Apply the interpolated state; `RenderTimeMs` is already offset by the interpolation delay. |
| `InitializeBackend(World, Config)` | no | Acquire subsystems, read the config. Return false, after logging the reason and the remedy, when you cannot draw with what you were given; the manager refuses you rather than installing you. |
| `DeinitializeBackend()` | no | Release what you held. |

`DrawsEntitiesAsCrowdRows()` is one more, for a backend that represents entities without spawning an actor of the entity's class; the editor reads it off the class default object to decide whether to show authoring surfaces that only make sense on that representation. The default is false. A Mass Entity based backend exists as a separate, opt-in plugin and is the only current override; it is not part of the core SDK and is out of scope for this guide.

`SlotId` is a stable index the actor manager assigns for the instance's lifetime; keep your per-instance state in arrays indexed by it.

:::danger[A custom backend must never subscribe to the actor tracker itself.]
The actor manager is already the single caller of `ActivateInstance` and `DeactivateInstance`. A backend that also subscribes to `UCrowdyActorTracker` activates every entity twice and spawns everything double. The four overrides are your only entry points.
:::

## Gotchas

- `BackendClass` alone draws the default executor's movement through `UCrowdyTransformRepPolicy`. A custom state struct needs `BackendConfig` with a `ReplicationPolicyClass` that reads it, and that policy replaces the shipped one: apply `Location` and `Rotation` yourself before anything else, or every proxy stands still.
- A policy built on `TInterpolatedField` is the smooth choice for anything that moves. Sample it at `RenderTimeMs`, never at the newest sample: the delay is what hides the network.
- `bUseCrowdyActorTracker` off on the profile means no tracker, no manager, and no backend at all.
- A pooled proxy's spawn-time look comes from class defaults or the state struct, never the spawn payload.
- Pool exhaustion is a warning per entity, `Pool exhausted for <class>`, and the entity is not drawn until a slot frees. Raise `DefaultPoolSizePerClass` or add a `PerClassPoolOverrides` row.
- A class that arrives over the wire before it is loaded cannot be drawn; see Preloaded Entity Classes on [Entities and spawning](./entities-and-spawning.md).

## Related

- [Map profiles](./map-profile.md): where `BackendClass` and `BackendConfig` live.
- [Continuous state](./continuous-state.md): the executor that produces what the policy consumes.
- [Entities and spawning](./entities-and-spawning.md): the actor tracker and the spawn event.
- [Entity component](./entity-component.md): the identity a pooled actor is given.
