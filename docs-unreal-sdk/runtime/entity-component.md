---
slug: entity-component
sidebar_position: 3
title: Entity Component
description: Every callable, event, and setting on UCrowdyEntityComponent, one line each, with the two examples that show the accessor family and the lifecycle events.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Entity Component

`UCrowdyEntityComponent` is the one component the SDK tracks an actor by. It registers the actor in the entity registry, hands out its identity, optionally feeds the continuous state channel, and raises the lifecycle events. This page is the reference; the concepts are on [Entities, Identity, and Ownership](../concepts/entities-identity-ownership.md).

## Getting the component

In C++ the actor usually holds the pointer it created in its constructor. From anywhere else, `UCrowdyUtilities::GetCrowdyEntityComponent(Actor)` (Blueprint: **Get Crowdy Entity Component**, `Actor` defaults to self) resolves it GAS-style: if the actor implements `ICrowdyEntityComponentProvider` its answer is used, otherwise `FindComponentByClass`. Implement the interface when the component lives on a child actor or is chosen at runtime; it is deliberately not a node you call directly.

![The entity component's Details panel](/img/unreal-sdk/entity-component-details.png)

## Settings

All `EditAnywhere`, so a constructor, a Blueprint's Class Defaults, or a placed instance can set them.

| Setting | Default | One line |
|---|---|---|
| `Mode` (`ECrowdyEntityMode`) | Static | Static is event-only. Dynamic also streams the `StateExecutor` snapshot every replication interval. Unrelated to ownership and to Crowdy State, which work in either mode. |
| `IdentityPolicy` (`ECrowdyIdentityPolicy`) | Stable | Stable, PlayerDerived, or Random. Read only when the actor resolves its own identity; a runtime spawn ignores it. |
| `Ownership` (`ECrowdyOwnership`) | Host | Host: the elected host owns it (`Role = HostOwned`). LocalClient: this client owns it (`Role = Owner`). Level-placed actors only. |
| `HostOverride` (`ECrowdyHostOverride`) | Allow | For a LocalClient entity: may the host correct its Crowdy State as a super-user (Allow), or never (OwnerOnly). Hidden when Ownership is Host. |
| `StateHeartbeat` (`ECrowdyStateHeartbeat`) | Inherit | Inherit follows the map profile's keyframe; Off never emits a keyframe for this entity. On-change replication is unaffected. |
| `bAutoApproveOwnershipRequests` | off | The current authority grants any transfer request at once instead of raising `OnOwnershipRequested`. |
| `StateExecutor` (`UActorUpdateExecutor`) | none | Dynamic only. Builds the snapshot; unset means the SDK's transform-only default. |
| `bAutoRegister` | on | Dynamic only. Join the continuous channel at `BeginPlay`; off means you call `StartReplication` yourself. |
| `DestroyDelay` (float) | 0 | Seconds between `OnCrowdyDestroyed` and the actor being destroyed. |

## Callables

Category **Crowdy SDK, Entity Component** in the Blueprint palette.

| Function | One line |
|---|---|
| `GetNetID()` | The entity's shared id, as an `FGuid`. |
| `GetOwnerID()` | The owning player's id; invalid for a host-owned entity. |
| `GetRole()` | `ECrowdyRole`: `Owner`, `RemoteProxy`, `HostOwned`, or `None` before registration. |
| `IsLocallyOwned()` | True when this client is the authority: it owns the entity, or the entity is host-owned and this client is the host. The question to ask before owner work. |
| `GetMode()`, `GetOwnership()`, `GetHostOverridePolicy()`, `GetStateHeartbeat()` | The settings above, read back. There is no getter for `IdentityPolicy`. |
| `StartReplication()`, `StopReplication()` | Join or leave the continuous channel. Meaningful for a Dynamic entity this client owns; `bAutoRegister` calls the first one for you. |
| `SendEvent(Payload, Scope)` | Sends a struct payload addressed at this entity. `ECrowdyEventScope::Everyone` runs the entity's handlers on every client, `OwnerOnly` only on the owner. The lower-level sibling of a `CrowdyEvent`; see [Recipients and routing](./recipients-and-routing.md). |
| `MarkStateDirty(PropertyName)`, `MarkAllStateDirty()` | Schedule one, or every, `CrowdyManualDirty` property to ship on the next replication tick. See [Crowdy State: static entry points](./crowdy-state-static.md). |
| `DestroyEntity()` | Broadcast the destroy event and destroy the owner after `DestroyDelay`. The same path as the subsystem's `DestroyEntity(Actor)` and `UCrowdyUtilities::DestroyCrowdyEntity`. |

`IsLocallyOwned()` here takes no argument and answers for the authority; `UCrowdyEntitySubsystem::IsLocallyOwned(NetID)` answers a narrower question about the record's owner id and does not count the host of a host-owned entity. Do not treat them as interchangeable.

## Events

| Event | Signature | When |
|---|---|---|
| `OnCrowdySpawned` (`FOnCrowdyEntitySpawned`) | `InitialState`, `bIsLocallyOwned` | Runtime-spawned entities only: fired by `SpawnEntity` on the spawner and by the spawn event on every proxy, with the spawn payload. A level-placed entity never receives it; bind `OnCrowdyOwnershipAssigned` there instead. |
| `OnCrowdyDestroyed` (`FOnCrowdyEntityDestroyed`) | `bIsLocallyOwned` | On every client when the entity is torn down, before the delay. |
| `OnCrowdyOwnershipAssigned` (`FOnCrowdyOwnershipAssigned`) | `NewOwnerID`, `NewRole`, `bIsLocallyOwned` | Once the entity knows its owner, on the tick after registration (so a bind in `BeginPlay` still gets it), and again on every reassignment. `NewOwnerID` is invalid for a host-owned entity. |

The example binds all three in `ALantern::BeginPlay`, after `Super::BeginPlay()`; the three `AddDynamic` lines in the block go there. A lantern the player drops at runtime is the kind of entity that receives all three: the spawn path announces `OnCrowdySpawned` right after `BeginPlay`, on the owner and on every proxy, so a bind made there is in place in time. A level-placed post never gets the spawn event; on it only the destroy and ownership handlers ever run. The light shows on spawn, hides on destroy, and brightens or dims as the answer to "do I own this" arrives.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="ec-events" />

</TabItem>
<TabItem value="bp" label="Blueprint">

In the spawned lantern's Blueprint, at **Event BeginPlay**, **Get Crowdy Entity Component** feeds **Bind Event to On Crowdy Spawned**, whose `Event` pin is wired to a custom event, `OnLanternSpawned`, that receives the spawn payload and the ownership flag; its body calls **Set Visibility** on `Light`. The other two events bind the same way from the same getter.

<Blueprint src="ec-on-spawned" title="Event BeginPlay, Get Crowdy Entity Component, Bind Event to On Crowdy Spawned, OnLanternSpawned, Get Light, Set Visibility" />

</TabItem>
</Tabs>

## Asking a different question than IsLocallyOwned

The [Quickstart](../quickstart.md) and the identity page both branch on `IsLocallyOwned()`. The accessor family answers finer questions: `GetRole()` distinguishes the owner from the host of a host-owned entity from a proxy, which the boolean cannot. The example grades the post's light by role.

Four more `UCrowdyUtilities` nodes ask role questions without fetching the component: `CrowdyIsRemoteProxy(Entity)` (**Crowdy Is Remote Proxy**) is true when the entity's role is `RemoteProxy`, and `IsCrowdyEntityPlayerControlled(TargetActor)` (**Is Crowdy Entity Player Controlled**) is true for an actor with a Dynamic entity component or a registered remote-proxy record; `SwitchCrowdyIsRemoteProxy` and `SwitchIsCrowdyEntityPlayerControlled` are the same two answers as exec pins.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="ec-is-owned" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The generated graphs branch on booleans, so the three-way role grading of the C++ half is shown as its two-way half: **Get Crowdy Entity Component**, **Is Locally Owned**, a **Branch**, and **Set Intensity** to 8000 on `Light` for the owner. For the full grading in Blueprint, replace the Branch with a **Switch on ECrowdyRole** fed by **Get Role**.

<Blueprint src="ec-is-owned" title="Event BeginPlay, Get Crowdy Entity Component, Is Locally Owned, Branch, Get Light, Set Intensity" />

</TabItem>
</Tabs>

## The two RPC receivers on the component

`RequestOwnership_Implementation(RequesterID)` and `GrantOwnership_Implementation(NewOwnerID, PreviousOwnerID)` are `CrowdyEvent` functions with `CrowdyRecipient = "Multicast"` that carry [ownership transfer](./ownership-transfer.md) over the session channel. Call the static `UCrowdyOwnershipTransfer` nodes instead of these; `GrantOwnershipTo(NewOwnerID)` is the C++ entry the static nodes funnel through.

:::caution[These two events are Multicast with no CrowdyChannel on purpose. Do not re-declare them with a channel.]
They ride the app's session channel, which the SDK always joins, so a request or a grant reaches every client. Re-declared on a channel of their own they would reach that channel's members instead of the entity's audience. Ownership on this plane is a convention in any case; the enforced kind lives on a [Game Model](../game-models/overview.md).
:::

## Advanced: the static identity helpers

C++ only, pure, and the same functions the SDK's own identity resolution calls. Useful when writing custom identity code; not needed otherwise.

| Static | What it answers |
|---|---|
| `DeriveAuthority(Ownership, LocalPlayerID, OutRole, OutOwnerID)` | The role and owner id an `Ownership` value produces. |
| `ResolveEffectiveOwnership(AuthoredOwnership, bIsLevelPlaced)` | Why a runtime spawn is always owned by its spawner. |
| `ResolveActorInstanceGuid(Actor)` | The engine's per-placement guid, the Stable identity seed. |
| `ShouldUsePlacementGuid(bIsLevelPlaced, bHasInstanceGuid)`, `SelectPlacementGuid(AtRegister, Live)` | When that guid may be used, and why the snapshot taken at `OnRegister` wins over a live read in a cooked build. |
| `ComputeStableNetID(bOutUsedPathFallback)` | The Stable NetID for this actor, and whether it fell back to hashing the path. |
| `DoesOwnershipMatch(OwnerRole, OwnerNetID, TargetRole, TargetOwnerID, HostID)` | The ownership test behind `UCrowdyUtilities::DoesCrowdyEntityOwn`; fails closed when a host-owned side has no host id. |
| `ClassifyPlayerDerivedIdentity(Facts)`, `DescribePlayerDerivedIdentity(Verdict)` | Which condition made PlayerDerived fall back to Random, and the sentence the warning uses. |
| `ShouldReportHostOwnedAutoRegister(Mode, bAutoRegister, Role)`, `DescribeHostElectionState(bHostKnown, bLocalClientIsHost)` | The two authoring diagnostics: a Dynamic host-owned entity ends `BeginPlay` sending nothing, and what this client currently knows about the host. |
| `GetClassID()` | The class hash carried on spawn events. |

`InitIdentity`, `AssignPooledIdentity`, `ClearIdentity`, `MarkPooledDormant`, and `IsPooledDormant` are the injection points the entity subsystem and the actor pool use; game code has no reason to call them.

## Gotchas

- `OnCrowdyOwnershipAssigned` is announced on the tick after registration, deliberately, so a bind in the actor's own `BeginPlay` is not too late.
- A Dynamic entity with `Ownership = Host` and `bAutoRegister` on leaves `BeginPlay` sending nothing: auto-register only starts the channel for an entity this client owns outright. The log says so once per component.
- `DestroyEntity()` exists in three places with three signatures and one behaviour. Use whichever you already hold a reference for.
- The enum getters return the setting, not a live derivation. `GetRole()` is the live answer.

## Related

- [Entities, Identity, and Ownership](../concepts/entities-identity-ownership.md): what the settings mean.
- [Entities and spawning](./entities-and-spawning.md): the subsystem's spawn, destroy, and lookup calls.
- [Ownership transfer](./ownership-transfer.md): the static nodes that replace calling the two receivers.
- [Crowdy State](./crowdy-state.md): the properties `MarkStateDirty` serves.
- [Continuous state](./continuous-state.md): `Mode`, `StateExecutor`, and `bAutoRegister`.
