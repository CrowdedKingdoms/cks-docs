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
| `ReplicateMovement` (`ECrowdyReplicateMovement`) | Auto | Auto is on for a pawn with a movement component (a Character, for one) and off for anything else. On streams the `StateExecutor` snapshot every replication interval, so a plain actor that should move must set it. Off sends no movement. Unrelated to ownership, events and Crowdy State, which work either way. The deprecated `Mode` it replaces is under [Deprecated](#deprecated). |
| `IdentityPolicy` (`ECrowdyIdentityPolicy`) | Stable | Stable, PlayerDerived, or Random. Read only when the actor resolves its own identity; a runtime spawn ignores it. |
| `OwnedBy` (`ECrowdyOwnedBy`) | Auto | Who writes the entity. Player: this client owns it (`Role = Owner`). World: no client writes it (`Role = HostOwned`); it applies to an actor placed in the level, and one spawned during play belongs to its spawner. Leader: whichever client [leads](./leader.md#an-npc-the-leader-simulates), placed or spawned. Auto: World when placed, Player when spawned. Read back in Blueprint as **Get Owned By**. |
| `StateHeartbeat` (`ECrowdyStateHeartbeat`) | Inherit | Inherit follows the map profile's keyframe; Off never emits a keyframe for this entity. On-change replication is unaffected. |
| `bAutoApproveOwnershipRequests` | off | The current authority grants any transfer request at once instead of raising `OnOwnershipRequested`. |
| `StateExecutor` (`UActorUpdateExecutor`) | none | Only when movement is replicated. Builds the snapshot; unset means the SDK's transform-only default. |
| `bAutoRegister` | on | Only when movement is replicated. Join the continuous channel at `BeginPlay`; off means you call `StartReplication` yourself. |
| `DestroyDelay` (float) | 0 | Seconds between `OnCrowdyDestroyed` and the actor being destroyed. |

## Callables

Category **Crowdy SDK, Entity Component** in the Blueprint palette.

| Function | One line |
|---|---|
| `GetNetID()` | The entity's shared id, as an `FGuid`. |
| `GetOwnerID()` | The owning player's id; invalid for a World (`HostOwned`) entity. |
| `GetRole()` | `ECrowdyRole`: `Owner`, `RemoteProxy`, `HostOwned`, or `None` before registration. |
| `IsLocallyOwned()` | True when this client writes the entity, which means it owns it. False on every client for a World entity. The question to ask before owner work. **Is Crowdy Entity Locally Owned** asks the same of any actor or replicated subsystem without fetching the component. |
| `ReplicatesMovement()` | Blueprint node **Replicates Movement**. True when this entity sends its movement, with Auto resolved. `ReplicatesMovementFor(ActorClass)` asks the same of a class's component template, which has no owner. |
| `GetStateHeartbeat()` | The setting above, read back. There is no getter for `IdentityPolicy`. |
| `StartReplication()`, `StopReplication()` | Join or leave the continuous channel. Meaningful for an entity that replicates movement and this client owns; `bAutoRegister` calls the first one for you. |
| `MarkStateDirty(PropertyName)`, `MarkAllStateDirty()` | Schedule one, or every, `CrowdyManualDirty` property to ship on the next replication tick. See [Crowdy State: marking state from outside the actor](./crowdy-state.md#marking-state-from-outside-the-actor). |
| `DestroyEntity()` | Broadcast the destroy event and destroy the owner after `DestroyDelay`. The same path as the subsystem's `DestroyEntity(Actor)` and `UCrowdyUtilities::DestroyCrowdyEntity`. |

`IsLocallyOwned()` here takes no argument and answers for the client that writes the entity; `UCrowdyEntitySubsystem::IsLocallyOwned(NetID)` answers a narrower question about the record's owner id. Do not treat them as interchangeable. The deprecated callables (`GetMode`, `GetOwnership`, `GetHostOverridePolicy`, `SendEvent`) are under [Deprecated](#deprecated).

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

The [Quickstart](../quickstart.md) and the identity page both branch on `IsLocallyOwned()`. The accessor family answers finer questions: `GetRole()` distinguishes the owner from a World entity (`HostOwned`, which no client writes by default) from a proxy, which the boolean cannot. The example grades the post's light by role.

Four more `UCrowdyUtilities` nodes ask role questions without fetching the component: `CrowdyIsRemoteProxy(Entity)` (**Crowdy Is Remote Proxy**) is true when the entity's role is `RemoteProxy`, and `IsCrowdyEntityPlayerControlled(TargetActor)` (**Is Crowdy Entity Player Controlled**) is true for an actor with an entity component that replicates movement or a registered remote-proxy record; `SwitchCrowdyIsRemoteProxy` and `SwitchIsCrowdyEntityPlayerControlled` are the same two answers as exec pins.

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
They ride the app's session channel, which the SDK always joins, so a request or a grant reaches every client. Re-declared on a channel of their own they would reach that channel's members instead of the entity's audience. Ownership on this plane is a convention in any case; the enforced kind lives in your server code, on the [truth plane](../concepts/two-planes.md).
:::

## Advanced: the static identity helpers

C++ only, pure, and the same functions the SDK's own identity resolution calls. Useful when writing custom identity code; not needed otherwise.

| Static | What it answers |
|---|---|
| `ResolveOwnedBy(OwnedBy, Ownership, bIsLevelPlaced)` | The owner identity resolution applies: Player, World or Leader, never Auto. A runtime spawn is always its spawner's. |
| `DeriveOwner(ResolvedOwnedBy, LocalPlayerID, OutRole, OutOwnerID)` | The role and owner id a resolved owner produces. |
| `ResolveActorInstanceGuid(Actor)` | The engine's per-placement guid, the Stable identity seed. |
| `ShouldUsePlacementGuid(bIsLevelPlaced, bHasInstanceGuid)`, `SelectPlacementGuid(AtRegister, Live)` | When that guid may be used, and why the snapshot taken at `OnRegister` wins over a live read in a cooked build. |
| `ComputeStableNetID(bOutUsedPathFallback)` | The Stable NetID for this actor, and whether it fell back to hashing the path. |
| `DoesOwnershipMatch(OwnerRole, OwnerNetID, TargetRole, TargetOwnerID, HostID)` | The ownership test behind `UCrowdyUtilities::DoesCrowdyEntityOwn`; fails closed when a host-owned side has no host id. |
| `ClassifyPlayerDerivedIdentity(Facts)`, `DescribePlayerDerivedIdentity(Verdict)` | Which condition made PlayerDerived fall back to Random, and the sentence the warning uses. |
| `ShouldReportHostOwnedAutoRegister(bInReplicatesMovement, bInAutoRegister, Role)` | The authoring diagnostic for a World (`HostOwned`) entity that replicates movement and so ends `BeginPlay` sending nothing. |
| `GetClassID()` | The class hash carried on spawn events. |

`InitIdentity`, `AssignPooledIdentity`, `ClearIdentity`, `MarkPooledDormant`, and `IsPooledDormant` are the injection points the entity subsystem and the actor pool use; game code has no reason to call them.

## Deprecated

:::warning[Deprecated in 2.25. Everything in this section still works and is removed in a later release.]
[Deprecated in 2.25](../guides/deprecated.md) lists each item and what replaces it.
:::

### Deprecated settings

`ReplicateMovement` replaces `Mode` and `OwnedBy` replaces `Ownership`, both under [Settings](#settings); `HostOverride` has no replacement, and state that must be protected belongs in a [Server Object](../concepts/two-planes.md). The Details panel shows `Mode` and `Ownership` read-only, so a C++ constructor is the only place still setting them.

| Setting | Default | One line |
|---|---|---|
| `Mode` (`ECrowdyEntityMode`) | Static | Dynamic is `ReplicateMovement` On, Static is Off. Consulted only while `ReplicateMovement` is Auto, so a constructor that still sets it keeps its meaning. Shown only then, and only when it is Dynamic. |
| `Ownership` (`ECrowdyOwnership`) | Host | Local Client is `OwnedBy` Player, Host is Auto. Consulted only while `OwnedBy` is Auto, and only for an actor placed in the level. Shown only while `OwnedBy` is Auto, and only when it is Local Client. |
| `HostOverride` (`ECrowdyHostOverride`) | Allow | Host corrections end with the elected host. For a Player entity: may the host correct its Crowdy State as a super-user (Allow), or never (OwnerOnly). Shown only when Owned By is Player. An honest client sends a host correction only under Elected Host, and under Server Object an owner drops every host-sourced update, so the setting has nothing to refuse. |

### Deprecated callables

Each one names its replacement; the current callables are under [Callables](#callables).

| Function | One line |
|---|---|
| `GetMode()` | Use `ReplicatesMovement()`. It still works and reads the setting; true gives `Dynamic`. |
| `GetOwnership()` | Reads the deprecated `Ownership`. Read `OwnedBy` (**Get Owned By**) instead: Local Client is Player, Host is Auto. |
| `GetHostOverridePolicy()` | Reads the deprecated `HostOverride`. No replacement. |
| `SendEvent(Payload, Scope)` | Use **Send Crowdy Event** (`UCrowdyUtilities::SendCrowdyEvent`), which takes a Recipient: Everyone is Spatial Multicast, OwnerOnly is Owning Client. See [Recipients and routing](./recipients-and-routing.md). |

### Deprecated identity helpers

`ResolveOwnedBy` and `DeriveOwner`, under [Advanced: the static identity helpers](#advanced-the-static-identity-helpers), replace these. The `Ownership` argument of `ResolveOwnedBy` is the deprecated setting that Auto falls back to when a C++ constructor still sets it.

| Static | What it answers |
|---|---|
| `DeriveAuthority(Ownership, LocalPlayerID, OutRole, OutOwnerID)`, `ResolveEffectiveOwnership(AuthoredOwnership, bIsLevelPlaced)` | The role, owner id and applied ownership for the deprecated `Ownership`. |
| `DescribeHostElectionState(bHostKnown, bLocalClientIsHost)` | The authoring diagnostic that says, under Elected Host, what this client currently knows about the host. |

### Under Elected Host

The [Leader](./leader.md) replaces the elected host. On a project whose **Leader Source** is still **Elected Host (Deprecated)**, the elected host writes an entity Owned By World, so `IsLocallyOwned()` is also true on the host for such an entity; `UCrowdyEntitySubsystem::IsLocallyOwned(NetID)` does not count the host. The rest is on [Host Election](../services/host-election.md).

## Gotchas

- `OnCrowdyOwnershipAssigned` is announced on the tick after registration, deliberately, so a bind in the actor's own `BeginPlay` is not too late.
- A placed entity that replicates movement, Owned By World (or Auto), with `bAutoRegister` on leaves `BeginPlay` sending nothing: auto-register only starts the channel for an entity this client owns outright. The log says so once per component.
- `DestroyEntity()` exists in three places with three signatures and one behaviour. Use whichever you already hold a reference for.
- The enum getters return the setting, not a live derivation. `GetRole()` is the live answer.

## Related

- [Entities, Identity, and Ownership](../concepts/entities-identity-ownership.md): what the settings mean.
- [Entities and spawning](./entities-and-spawning.md): the subsystem's spawn, destroy, and lookup calls.
- [Ownership transfer](./ownership-transfer.md): the static nodes that replace calling the two receivers.
- [Crowdy State](./crowdy-state.md): the properties `MarkStateDirty` serves.
- [Continuous state](./continuous-state.md): `ReplicateMovement`, `StateExecutor`, and `bAutoRegister`.
