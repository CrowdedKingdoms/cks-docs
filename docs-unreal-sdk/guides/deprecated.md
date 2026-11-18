---
slug: deprecated
sidebar_position: 7
title: Removed after 2.25
description: "Every node, setting, property, recipient and asset the Unreal SDK deprecated in 2.25 or earlier and has now removed, and what replaces each: the elected host and its nodes, Host Override, the Host recipient, Ownership and Mode on the entity component, the ownership-taking subsystem registration, the component's Send Event, the Crowdy Actor Management Config asset, seven Crowdy SDK subsystem calls, Get Chunk Coordinates At World Location and the actor tracker's Configure node."
---

# Removed after 2.25

Everything the SDK had deprecated, in 2.25 or earlier, is now removed. Nothing is deprecated any more, and every page in these docs teaches only the current way. On the tagged v2.25.0 plugin these items still exist.

To find what your project uses, run the searches in the plugin's `MIGRATION.md` (section "Blueprint assets") over your
`Content` and `Plugins` folders, and build your C++ with the new version: each removed symbol fails to compile, and
`MIGRATION.md` names its replacement.

## What replaces each

These were deprecated and are gone. A project that still uses one fails to compile in C++ and shows a broken node in a Blueprint. [What's Changed](./whats-changed.md) has the steps.

| Removed | Use instead | Documented |
|---|---|---|
| **Get Host User ID**, **Is Host Set**, **Crowdy Get Host ID**, `UCrowdyHostSubsystem::GetHostID` | **Get Leader User ID** on **Get Crowdy Leader Subsystem** (0 means no Leader) | [The Leader](../runtime/leader.md) |
| **Is Host** | **Is Local Leader** | [The Leader](../runtime/leader.md) |
| **On Host Elected** | **On Leader Changed**, which gives user ids, not entity ids | [The Leader](../runtime/leader.md#follow-the-leader) |
| **Is Crowdy Entity Host**, **Is Crowdy Entity Host (Server)**, `CheckEntityIsHost` | **Is Local Leader**; anything that must be enforced belongs in a Server Object | [The Leader](../runtime/leader.md) |
| **Crowdy Has Authority**, **Switch Crowdy Has Authority** | **Is Local Leader**; for a gate on a write to an entity or subsystem you own, **Switch Is Crowdy Entity Locally Owned** on that entity | [The Leader](../runtime/leader.md#checking-who-writes-an-entity) |
| **Is Crowdy Entity Locally Controlled** | **Is Crowdy Entity Locally Owned** | [The Leader](../runtime/leader.md#checking-who-writes-an-entity) |
| `UCrowdyHostSubsystem` (**Crowdy Host Subsystem**) and the setting `HostPollIntervalSeconds` | The Leader subsystem. Nothing polls for a host, so the setting has nothing to set. | [The Leader](../runtime/leader.md) |
| The **Leader Source** project setting, its `ECrowdyLeaderSource` enum and `UsesElectedHost()` | Nothing: a Server Object always chooses the Leader. A `LeaderSource=ElectedHost` ini line is ignored. | [The Leader](../runtime/leader.md) |
| **Get Host ID** on the game session and `UCrowdyEntitySubsystem::GetHostID` | **Get Leader User ID** on **Get Crowdy Leader Subsystem** (0 means no Leader). In C++, `GetAppWriterID()` returns the Leader. | [The Leader](../runtime/leader.md#checking-who-writes-an-entity) |
| `GetWorldOwnerID()` on the entity subsystem | Nothing: no client writes a World entity | [The Leader](../runtime/leader.md#who-writes-what) |
| `Ownership` and `Mode` on the entity component, **Get Ownership**, **Get Mode** and `ECrowdyEntityMode` | **Owned By** (Local Client is Player, Host is World) and **Replicate Movement** (Dynamic is On; Static is Off, except on a pawn with a movement component, where it is On or Auto). Read **Replicates Movement** for **Get Mode**, and **Get Owned By** for **Get Ownership**: Local Client is Player, and Host is any other value, so never compare with World. Auto now resolves by class and placement only, so set them explicitly, not Auto, where a template, Blueprint or constructor relied on a non-default `Ownership` or `Mode`. A value saved under the old names is no longer mapped on load: re-save in 2.25.x first, or set the two settings on each instance. `ECrowdyOwnership` stays for `RegisterParticipant`. | [Entity component](../runtime/entity-component.md#settings) |
| C++ `ResolveOwnedBy(OwnedBy, Ownership, bIsLevelPlaced)`, `ResolveReplicatesMovement(ReplicateMovement, Mode, bIsPawnWithMovement)`, `MapLegacySettings` | `ResolveOwnedBy(OwnedBy, bIsLevelPlaced)` and `ResolveReplicatesMovement(ReplicateMovement, bIsPawnWithMovement)`; `MapLegacySettings` is deleted | [Entity component](../runtime/entity-component.md#advanced-the-static-identity-helpers) |
| The **Crowdy Actor Management Config** data asset (`UCrowdyActorManagementConfig`) | Delete any asset of it (one that still exists loads with a missing class) and set the same values on a map profile's Remote Entities, which is unchanged. Copy the values onto the profile in 2.25.x first if you want to keep them. | [Map profiles](../runtime/map-profile.md) |
| **Reload Endpoints From Settings**, **Trigger UDP Heartbeat**, **Deregister All Reception Layers**, **Set Expected Actor Update State Size** on the Crowdy SDK subsystem | Nothing: each did nothing. Remove the call; the API client re-reads the endpoints on its own, the connection tracks its own liveness, and delivery stops when a subscription handle is destroyed with its owner. | [Connection and reconnect](../runtime/connection-and-reconnect.md) |
| **Set Query Endpoint** on the Crowdy SDK subsystem | **Set Game Api Url** for the gameplay endpoint, or **Set Discovery Url** for the shared origin | [Project settings](../reference/project-settings.md) |
| **Start UDP Timeout Monitoring**, **Stop UDP Timeout Monitoring** on the Crowdy SDK subsystem | Remove the call. The round-trip ping starts when the connection comes up, and the connection uses **UDP Timeout (seconds)** in Project Settings; nothing replaces Stop. | [Connection and reconnect](../runtime/connection-and-reconnect.md) |
| **Get Chunk Coordinates At World Location** | **Get Chunk Coordinate At Location** (World Context, World Location), which uses the session's chunk size | [Recipients and routing](../runtime/recipients-and-routing.md) |
| The **Configure** node on the Crowdy Actor Tracker | Set the limits on the map's Crowdy Map Profile, under Remote Entities. C++ `UCrowdyActorTracker::Configure` is unchanged. | [Entities and spawning](../runtime/entities-and-spawning.md) |
| The role **Host Owned** (`ECrowdyRole::HostOwned`) | **World Owned** (`ECrowdyRole::WorldOwned`), the same value. C++ renames it; a saved Blueprint pin or value loads as World Owned. | [Entity component](../runtime/entity-component.md#callables) |
| **On Host ID Updated** as a Blueprint event (it stays a native C++ delegate) | **On Leader Changed**, which gives user ids, not entity ids | [The Leader](../runtime/leader.md#follow-the-leader) |
| The **Host** recipient (`CrowdyRecipient="Host"`, `ECrowdyEventRecipient::Host`) | **Owning Client**, which reaches the client that writes the entity, or a Server Function. A saved `Host` reads as Owning Client and warns. | [Recipients and Routing](../runtime/recipients-and-routing.md) |
| **Host Override** on the entity component, `ECrowdyHostOverride`, **Get Host Override Policy** | Nothing: an entity a player owns drops every other client's update. State that must be protected belongs in a Server Object. | [Entity component](../runtime/entity-component.md) |
| **Send Event** on the component, `ECrowdyEventScope` | **Send Crowdy Event** with a Recipient: Everyone is Spatial Multicast, Owner Only is Owning Client | [Recipients and Routing](../runtime/recipients-and-routing.md) |
| `DescribeHostElectionState` on the component | Nothing: no host is elected | [Entity component](../runtime/entity-component.md) |
| **Grant Ownership To Host** | No direct replacement: keep the state in a Server Object, or make the entity **Owned By** **Leader**, which refuses grants | [Ownership transfer](../runtime/ownership-transfer.md) |
| **Register Replicated Subsystem** with its Ownership pin, `RegisterReplicatedSubsystemInto` with three arguments, an override of `GetReplicatedOwnership()` | **Register Crowdy Replicated Subsystem**, or the one-argument C++ form; a replicated subsystem is always written by its Leader | [Replicated subsystems](../runtime/replicated-subsystems.md) |
| Marking Crowdy State dirty on an entity you do not own (the host push) | Write state on the client that owns the entity, or keep it in a Server Object | [Crowdy State](../runtime/crowdy-state.md) |

## Related

- [What's Changed](./whats-changed.md): what changed in each release and what to do about it.
- [The Leader](../runtime/leader.md): who writes shared state now.
