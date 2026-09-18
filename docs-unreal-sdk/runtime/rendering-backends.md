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

`FCrowdyActorManagementConfigStruct::BackendClass` on the map profile defaults to `UCrowdyActorPoolBackend`, so a profile that never chose a backend gets this one. It uses `UCrowdyActorPoolSubsystem` to keep a pool of pre-spawned actors per entity class, checks one out when a remote entity appears, registers it in the entity registry so entity-targeted events reach it like any actor, and hands every update to a `UCrowdyRepApplicationPolicy` you provide.

![The Actor Management category of a map profile: Backend Class and Backend Config](/img/unreal-sdk/map-profile-backend-select.png)

The screenshot is the SDK's shipped default profile, and its **Backend Config** reads None. That is the whole warning below.

:::warning[Naming a backend is not configuring it. The shipped default profile sets no Backend Config, so the actor pool refuses to start on it.]
`UCrowdyActorPoolBackend::InitializeBackend` needs `BackendConfig` to be an **Actor Pool Backend Config** with a `ReplicationPolicyClass`. Without one it logs `Backend Config is not set, but this backend needs a CrowdyActorPoolBackendConfig to know what to spawn` and returns false; the actor manager then logs `could not initialize, so no remote entity will be drawn on this map` and installs nothing. Remote entities that arrive as continuous-state updates are tracked, slotted, and updated with nothing on screen. Spawn-event proxies and Crowdy State are unaffected. See [Map profiles](./map-profile.md).
:::

### Configure it

`UCrowdyActorPoolBackendConfig`, set as the profile's `BackendConfig`:

| Field | Default | Effect |
|---|---|---|
| `ReplicationPolicyClass` | none, required | Your `UCrowdyRepApplicationPolicy` subclass. Unset or invalid and the backend refuses to initialize. |
| `PoolPolicyClass` | none, optional | A `UCrowdyActorPoolPolicy` subclass. Unset means the concrete base, which already hides pooled actors, shows them on activation, and strips proxy movement. |
| `DefaultPoolSizePerClass` | 8 | Pools are created lazily per entity class at this size. |
| `PerClassPoolOverrides` | empty | A per-class pool size; a class listed here is also pre-warmed at map load. |

:::caution[ReplicationPolicyClass is abstract and must be set. PoolPolicyClass is concrete and may be left empty.]
`UCrowdyRepApplicationPolicy` has two pure virtuals and requires your subclass. `UCrowdyActorPoolPolicy` ships full bodies and is meant to be instantiated as is. Do not confuse the two.
:::

### The replication application policy

`UCrowdyRepApplicationPolicy` is the piece most projects write: it reads your state struct out of each update and applies it to the pooled actor each frame.

| Override | Called | What you do |
|---|---|---|
| `ExtractFields(State, ServerTimestampMs, SlotId)` | Per update, per slot | Read your struct out of `State` into your own per-slot buffers. Return false when the struct type is wrong and the update is skipped. |
| `ApplyToActor(Actor, SlotId, RenderTimeMs)` | Per frame, per active slot | Apply the buffered state, interpolated to `RenderTimeMs`, to the actor. |
| `OnInstanceActivated(Actor, InitialState)` | Once, when a slot activates | A `BlueprintNativeEvent`: set initial state on the actor. |
| `OnInstanceDeactivated(SlotId)` | When the entity leaves | Clean up per-slot state. |
| `GetExpectedSlotCount()` | At startup | How many slots to pre-allocate; 64 by default. Match your expected player count. |

`ULanternRepPolicy` applies the `bTorchLit` flag the [continuous state](./continuous-state.md) page added to `ALanternPlayer`'s `FLanternPlayerState`: `ExtractFields` stores it per slot and returns false for any other struct type, `ApplyToActor` sets the proxy torch's visibility from it. A flag is a discrete value, not something to interpolate over `RenderTimeMs`, so the policy applies the latest. The policy header includes `LanternPlayer.h` for the struct, so this snippet depends on the [`executor-override` block](./continuous-state.md#a-custom-executor) being in your project first.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="backend-policy" />

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
The pool is fed only by inbound network state, so the owner ends up with the local actor it drives directly and the pooled proxy the server echoes back, interpolation-delayed. There is no per-entity flag to choose. Hide one side yourself, in the entity's own code: `SetActorHiddenInGame` on the local actor when `IsLocallyOwned()` if the round-tripped proxy is the one that should show. The tracker's owner-tracking gate suppresses only the local player's own avatar echo, never another owned entity's.
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

- `BackendClass` alone draws nothing. Set `BackendConfig`, and inside it `ReplicationPolicyClass`.
- `bUseCrowdyActorTracker` off on the profile means no tracker, no manager, and no backend at all.
- A pooled proxy's spawn-time look comes from class defaults or the state struct, never the spawn payload.
- Pool exhaustion is a warning per entity, `Pool exhausted for <class>`, and the entity is not drawn until a slot frees. Raise `DefaultPoolSizePerClass` or add a `PerClassPoolOverrides` row.
- A class that arrives over the wire before it is loaded cannot be drawn; see Preloaded Entity Classes on [Entities and spawning](./entities-and-spawning.md).

## Related

- [Map profiles](./map-profile.md): where `BackendClass` and `BackendConfig` live.
- [Continuous state](./continuous-state.md): the executor that produces what the policy consumes.
- [Entities and spawning](./entities-and-spawning.md): the actor tracker and the spawn event.
- [Entity component](./entity-component.md): the identity a pooled actor is given.
