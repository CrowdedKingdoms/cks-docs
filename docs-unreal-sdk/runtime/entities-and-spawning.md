---
slug: entities-and-spawning
sidebar_position: 2
title: Entities and Spawning
description: Spawn an entity at runtime so every client sees the same actor, destroy it everywhere, and understand how a remote client rebuilds an entity it has never met.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Entities and Spawning

An entity is an actor with a `UCrowdyEntityComponent`. A level-placed one needs no spawn call: every client loads it and derives the same NetID. This page is about the other kind, an actor created during play, which one client spawns and every other client rebuilds from a spawn event. For identity policies, NetIDs, and the owner and proxy roles, read [Entities, Identity, and Ownership](../concepts/entities-identity-ownership.md) first.

## When to spawn through the SDK

Whenever an actor created at runtime must exist on other clients: a dropped item, a thrown object, a summoned creature. The plain engine `SpawnActor` creates a local actor and tells nobody; the SDK's spawn call creates the same actor and announces it.

## Spawning

`UCrowdyEntitySubsystem::SpawnEntity(EntityClass, SpawnTransform, InitialState)` spawns the class locally with a deferred spawn, injects the entity's identity into its component before `BeginPlay`, and broadcasts a spawn event so every client in range spawns the same class as a proxy. The client that called it is the owner; `Role` is `Owner` there and `RemoteProxy` everywhere else. `UCrowdyUtilities::SpawnCrowdyEntity(WorldContextObject, EntityActorClass, SpawnTransform, InitialState)` is the same operation as a static call with a world context pin, which is the form a Blueprint uses.

`InitialState` is an `FInstancedStruct` of your own type. It travels with the spawn and lands in the component's `OnCrowdySpawned` event on every client; pass an empty struct when there is nothing to send.

The lantern world's runtime spawn is the player arriving with a lantern. `ALanternPlayer` is the player character: a pawn carrying a `UCrowdyEntityComponent` that sends its movement, with PlayerDerived identity, Owned By Player, declared in full on [Continuous state](./continuous-state.md). Once the character knows it is locally owned, `ALanternPlayer::DropLantern` spawns an `ALantern` a short way in front of it, and the new lantern appears there on every client in range. The moment is `OnCrowdyOwnershipAssigned`, not `BeginPlay`: a player pawn spawned during play (`RestartPlayer`) is possessed after its `BeginPlay`, and its Player Derived identity resolves inside that first possession, so `IsLocallyOwned()` is still false at `BeginPlay`. The `AddDynamic` in the block sits in `ALanternPlayer::BeginPlay`, after `Super::BeginPlay()`; the handler fires on the tick after the entity registers, on the first-frame pawn and the runtime-spawned one alike.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="spawn-entity" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Any Actor Blueprint can spawn; nothing on the spawner needs a component. In the player pawn's Blueprint, at **Event BeginPlay**, **Get Crowdy Entity Component** feeds **Bind Event to On Crowdy Ownership Assigned**, whose `Event` pin is wired to a custom event, `OnOwnershipAssigned`, that receives the owner id, the role, and the `Is Locally Owned` flag; the pawn registers inside its first possession, after `BeginPlay`, so this is where the answer arrives. The event's `Is Locally Owned` pin feeds a **Branch** (the owner gate: only the owner spawns), and on the true side **Get Actor Transform** feeds the `Spawn Transform` pin of **Spawn Crowdy Entity**, which takes the entity class and an optional Initial State struct and returns the spawned actor. The class pin in the figure names the sample lantern; pick your own entity class there. A spawner that is not a Player Derived pawn can run the same Branch straight from **Event BeginPlay** with the pure **Is Crowdy Entity Locally Owned** as the condition; only a Player Derived pawn learns its identity after `BeginPlay`.

<Blueprint src="spawn-entity" title="Event BeginPlay, Get Crowdy Entity Component, Bind Event to On Crowdy Ownership Assigned, OnOwnershipAssigned, Branch, Get Actor Transform, Spawn Crowdy Entity" />

</TabItem>
</Tabs>

:::warning[A runtime-spawned entity never consults its Identity Policy or its Owned By.]
`SpawnEntity` injects a fresh NetID, `Role = Owner`, and the spawning client's player id before `BeginPlay`, so the component's `IdentityPolicy` and `OwnedBy` settings are not read. Setting Stable on a class you spawn does not give it a stable id, and setting World does not make it the world's; a level-placed `ALanternPost` is how you get both, and [Ownership transfer](./ownership-transfer.md) is how a spawned entity changes hands afterwards.
:::

:::danger[Do not spawn an entity with the engine's SpawnActor.]
A plain `SpawnActor` never broadcasts the spawn event. The component still registers locally, so the actor looks like an entity on the spawning client and exists nowhere else.
:::

:::caution[The spawn event of an entity that replicates movement is a one-shot spatial send, so a client that joins later never receives its `InitialState`.]
It reaches the clients within eight chunks of the spawn point at that moment and is never replayed. A client that joins afterwards, or comes into range later, still draws an entity that replicates movement from its position updates, but with no spawn event `OnCrowdySpawned` does not fire there. An entity that sends no movement is different: its owner repeats the spawn event every 4 seconds (below), so a late joiner gets the actor, its owner, and `OnCrowdySpawned` with the `InitialState`. Anything a late joiner must see on such an entity belongs in class defaults or in replicated state, and anything that must exist for everyone from the start is level-placed.
:::

**Success signal.** On a second client the proxy appears and its `OnCrowdySpawned` fires with `bIsLocallyOwned` false. A single client can only confirm the send: `crowdy.entity.trace 1` logs the registration and the spawn event; `crowdy.rpc.loopback` replays RPC calls, not spawn events, so no proxy appears.

## Destroying

Three calls converge on the same path: broadcast a destroy event, then destroy the actor after the component's `DestroyDelay` (0 by default, so immediately).

| Call | Where |
|---|---|
| `UCrowdyEntitySubsystem::DestroyEntity(TargetEntity)` | The subsystem, given the actor. |
| `UCrowdyUtilities::DestroyCrowdyEntity(WorldContextObject, TargetEntity)` | The static form with a world context pin; the Blueprint node. `TargetEntity` defaults to self. |
| `UCrowdyEntityComponent::DestroyEntity()` | The component, on itself. See [Entity component](./entity-component.md). |

On every client `OnCrowdyDestroyed` fires first, with `bIsLocallyOwned` true on the client that called the destroy and false everywhere else; nothing stops a non-owner from destroying an entity. The actor goes after the delay. A `DestroyDelay` above zero is for a dissolve or a fade the actor plays out before it disappears. The entity stops sending updates when the destroy is called, not when the actor goes, and other clients do not draw updates that arrive in the half second after the destroy event, so an update already on its way does not bring the entity back.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="despawn" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The player picks up a lantern of their own that has gone out: in C++ the character's overlap checks the lantern is unlit and locally owned, then `PickUpLantern` destroys it. The graph is the call alone: from **Event ActorBeginOverlap**, **Destroy Crowdy Entity** takes `Other Actor` on its `Target Entity` pin; the "unlit and yours" check is yours to add in front of it. The removal is visible on every client without any further node.

<Blueprint src="despawn" title="Event ActorBeginOverlap, Destroy Crowdy Entity" />

</TabItem>
</Tabs>

## Receiving a spawn on a remote client

A remote client that receives the spawn event spawns the named class, injects the identity as `RemoteProxy`, finishes spawning, and broadcasts `OnCrowdySpawned` with the `InitialState` from the event. The event carries the class path, so a class that is not loaded yet is streamed in and spawned when it arrives; a destroy event that lands during the load cancels the spawn. If the class ships without a `UCrowdyEntityComponent`, the SDK adds one so the lifecycle callbacks have a home.

That actor is the one players see: the actor pool draws it rather than a pooled copy, so whatever your `OnCrowdySpawned` handler set on it stays. When the entity's first update arrives before its spawn event, the pool draws it at once and the spawn event then hands that actor its `InitialState` and its owner instead of spawning a second one. Either way `OnCrowdySpawned` fires once per entity on each client.

On a map drawn with the Crowdy Mass Rendering Backend, Mass is the only body of an entity that replicates movement: its crowd row, and the near-tier shell when it is close to the camera. Its spawn event spawns no actor of its own, so `OnCrowdySpawned` does not fire for it there. Its `InitialState` lands in the row instead, through the same Crowdy State fragment fields its replicated properties use: each property of your `InitialState` struct that a field registered with `RegisterStateFragmentField` names, declared as the type that field reads, reaches that field's ingestor (see [Add your own crowd data](../mass/add-your-own-crowd-data.md#land-spawn-data-on-the-row)). Other properties are dropped. An entity that sends no movement sends no updates, so Mass never draws it and it keeps the actor its spawn event makes, with `OnCrowdySpawned`, on every map.

:::note[The spawn and destroy payloads are wire format, not something you build.]
`FCrowdyEntitySpawnEvent`, `FCrowdyEntityDestroyEvent`, and the registry's `FCrowdyEntityRecord` are Blueprint-visible types because they cross a delegate, but you never construct one. `InitialState` is the only payload you author.
:::

<a id="a-dynamic-entity-can-appear-with-no-spawn-event-at-all"></a>

### A moving entity can appear with no spawn event at all

An entity that replicates movement (see [Continuous state](./continuous-state.md)) streams position updates, and each update carries the class id and the state struct type. The `UCrowdyActorManager` resolves the class from that (`RegisterStateClass` is filled in for you by each entity component's `BeginPlay`) and asks the rendering backend to draw a proxy, so a moving entity shows up on a client that joined late without any spawn round trip.

An entity that sends no movement, spawned with `SpawnEntity`, sends no updates, so its owner repeats the spawn event instead: every 4 seconds while a client owns it, that client sends the spawn event again, from where the entity is now, naming its owner and carrying its `InitialState`. A client that joins later builds the entity from a repeat exactly as if it had seen the spawn, and its `OnCrowdySpawned` fires there. A client that already has the entity ignores repeats, and `OnCrowdySpawned` never fires twice. A repeat costs about 280 bytes plus your `InitialState`: about 70 bytes per second of upload per entity on its owner, and the same in download for each client within eight chunks. A spawn event for an entity destroyed less than 10 seconds earlier is ignored, so a repeat already on its way cannot bring it back; an owner that never received the destroy keeps repeating, and the entity reappears after those 10 seconds. An entity that sends no movement, placed in the level or registered with `RegisterStaticEntity`, sends nothing.

:::warning[Preloaded Entity Classes is empty by default, and an observer on this path needs it.]
This path resolves the class by id against loaded classes; a spawn event carries the class path and loads it for you, this does not. The startup scan walks loaded classes, and a Blueprint entity class that nobody on this client has spawned yet is not loaded, so an observer that meets it first over the network cannot name it. The actor manager warns `cannot resolve to a loaded class ... Preload the entity class or give it a ClassIDOverride` and the entity stays undrawn. List every Blueprint entity class a client can be shown before it spawns one itself under **Project Settings, Plugins, Crowdy SDK, Replication, Preloaded Entity Classes** (`PreloadedEntityClasses` on `UCrowdySDKDeveloperSettings`). Classes already loaded for another reason need no entry, and a duplicate costs nothing.
:::

## The actor tracker

Inbound actor updates arrive at `UCrowdyActorTracker`, a world subsystem the actor manager listens to. Its settings live on the `ActorManagement` struct of the [map profile](./map-profile.md) (`FCrowdyActorManagementConfigStruct`), shown as the profile's **Remote Entities** group. Everything but the switch, the backend and the interpolation delay sits under its **Advanced** row:

![The map profile with Actor Management expanded and an Actor Pool Backend Config assigned: the tracker settings and the backend selection](/img/unreal-sdk/actor-config.png)

The shipped default profile leaves **Backend Config** at None and runs on the built-in one; the [map profile page](./map-profile.md#create-the-asset) shows that state and when to assign your own.

| Field | Default | Effect |
|---|---|---|
| `bUseCrowdyActorTracker` (**Draw Remote Entities**) | on | Off means no tracker, no actor manager, and no backend on this map. |
| `bDispatchUpdatesOnGameThread` | off | Also broadcast each update batch to `OnUpdatesGameThread` for a Blueprint listener. |
| `bEnableOwnerTracking` | on | Track the local player's own actor echo as well: the reflection the [Quickstart](../quickstart.md#2-see-yourself) uses as proof that the server is receiving you. |
| `ActorTimeoutThreshold` (**Actor Timeout**) | 12 s | Seconds of silence before an entity is dropped on a guess. The server announces a real departure about five seconds after the last update, so this is the fallback. |
| `MaxTrackedActors` | 4096 | How many network-received actors may be tracked at once. A bound on forged ids, not a performance setting; set it above the largest crowd you intend to show. |
| `MaxUpdatesPerBatch`, `MaxBatchWaitTime` | 100, 5 ms | How updates for not-yet-seen entities are batched off the game thread. |
| `InterpolationDelayMs` | 100 ms | How far behind the server's clock the actor pool draws remote entities. Longer hides late updates but shows everyone further in the past; below one send interval (100 ms at the default 10 Hz) entities overshoot and snap back. Mass-drawn rows ignore it. See [Rendering backends](./rendering-backends.md). |

The tracker's events, all on the game thread: `OnRemoteEntityAppeared` (an id seen for the first time, with its `InitialState`), `OnRemoteEntityTimedOut` (this client heard nothing for `ActorTimeoutThreshold`), `OnRemoteEntityLeft` (the server said it is gone, with an `FCrowdyActorLeft` carrying the `ECrowdyActorLeftReason`: `Stale`, or `SessionReleased` when the server ended that actor's session), and `OnRemoteEntityLeftAnnounced` (every departure, including one for an actor this client never held, for code keeping its own per-sender state). Whichever of timed-out and left reaches an actor first is the only one that reports it. The delegate types are `FOnActorSpawnRequested`, `FOnActorTimeoutRequested`, `FOnActorLeftReported` (used by both departure events), and `FOnActorUpdateGameThreadBatch`. `ToggleOwnerTracking` and `ToggleBroadcastUpdatesToGameThread` change those two settings at runtime. `Configure` does not: it applies only before the tracker starts, which is before any Blueprint can call it, so on a running tracker it logs a Warning and changes nothing, and its Blueprint node is deprecated. Set the limits in the [map profile](./map-profile.md) or in the Crowdy SDK developer settings instead. `FCrowdyActorUpdate` is the batch element, carrying `PayloadTypeID`, the payload type id the sender's state blob led with, kept even when no struct is registered for it on this client. `crowdy.replication.tracker.maxgatheredupdates` caps the backlog of gathered updates for actors already on screen. You do not normally touch any of this: the actor manager and the [rendering backend](./rendering-backends.md) consume it for you.

## Looking entities up

`UCrowdyEntitySubsystem` is the registry. `FindEntity(NetID)` returns the actor or null; `FindEntityID(Actor)` is the reverse lookup; `IsLocallyOwned(NetID)` is true when this client writes the entity: the record names the local player and its role says this client simulates it (a record that contradicts itself reads as not mine), or it is a World entity and this client is the World owner (nobody by default, the host under Elected Host), the same answer as the component's `IsLocallyOwned` (see [Leader Source](./leader.md#leader-source-with-or-without-a-host)); `GetLocalPlayerID` and `GetHostID` read the two ids everything else is compared against; `SetLocalPlayerID` exists for a game that manages the player id itself, which the session normally seeds for you. `OnEntityRegistered` and `OnEntityUnregistered` (`FOnCrowdyEntityRegistered`, `FOnCrowdyEntityUnregistered`) fire with the NetID as records come and go. The Blueprint-friendly statics on `UCrowdyUtilities` wrap the same registry: `GetCrowdyEntityID`, `GetCrowdyEntity`, `GetCrowdyEntityOwnerID`, `GetCrowdyEntityRole` (an `ECrowdyRole`), `GetAllCrowdyEntitiesByOwner`, `CrowdyIsEntityRegistered`, and `GetLocalPlayerEntityID`.

## Gotchas

- `IsLocallyOwned` means two different things: on the subsystem it takes a NetID and asks the record; on the component it takes nothing and asks whether this client is the entity's authority, a World entity's host included under Elected Host. See [Entity component](./entity-component.md).
- A spawned entity is owned by its spawner, full stop. To hand it over, use [Ownership transfer](./ownership-transfer.md).
- `InitialState` reaches `OnCrowdySpawned` once on each client that receives the spawn event, on the actor that client draws. A late joiner receives it for an entity that sends no movement (from a repeat) but not for one that replicates movement. On a Mass map the latter has no actor there, and its `InitialState` reaches the row's registered Crowdy State fields instead.
- Two unrelated participants can derive the same NetID (a NetID has 32 bits of real entropy). The incumbent keeps it and the newcomer is refused with a log line; a system that binds state to an id should register through `TryRegisterEntity` and give up its claim when the `ECrowdyEntityRegistration` it returns is `RefusedIdHeldByLiveParticipant` (or `RefusedInvalidNetID` for a record with no usable id) rather than `Registered`.
- `UHelperFunctions` has the id helpers a custom identity scheme would reach for: `GetDeterministicID(Seed)` turns a seed into the same `FGuid` on every client, with those same 32 bits of entropy, and `GetNewID` and `GetNewUUID` mint random ones. Prefer the component's identity policies; these exist for code that already has a seed.

## Related

- [Entities, Identity, and Ownership](../concepts/entities-identity-ownership.md): NetIDs, policies, owner and proxy.
- [Entity component](./entity-component.md): every callable and event on the component.
- [Ownership transfer](./ownership-transfer.md): moving an entity to another player.
- [Rendering backends](./rendering-backends.md): how a proxy is drawn, and the pooled-proxy gotchas.
- [Continuous state](./continuous-state.md): Replicate Movement and the executor.
