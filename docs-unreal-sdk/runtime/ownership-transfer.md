---
slug: ownership-transfer
sidebar_position: 12
title: Ownership Transfer
description: "Move an entity's owner at runtime with a request and a grant: the three static nodes, the two subsystem events, what happens to in-flight state, and why ignoring a request is the rejection."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Ownership Transfer

An entity spawned at runtime belongs to its spawner. Ownership transfer moves it: a client asks, the entity's owner grants or ignores, and the grant lands on every client. `UCrowdyOwnershipTransfer` is a static Blueprint library with the three verbs.

## When to use it

A player takes over a lantern post another player built, a vehicle changes driver. Anything where "who simulates this" should change hands without destroying and respawning.

A level-placed entity Owned By World has no writer, so nobody answers a request for it.

An entity [Owned By Leader](./leader.md#an-npc-the-leader-simulates) follows the Leader instead, so requests and grants for it are refused with a warning. A player's avatar never changes hands: a grant for one is ignored.

:::warning[Ownership is a coordination convention on the view plane, not enforcement, and a transfer is transient.]
No server checks who may request or grant. And a client that first observes the entity after a grant sees the spawn-time owner, or re-baselines from proxy defaults, not necessarily the transferred one. Cheat-sensitive ownership belongs on the [truth plane](../concepts/two-planes.md), in your server code.
:::

## The flow

1. A client that does not own the entity calls **Request Ownership Transfer**. The request travels as a Multicast `CrowdyEvent` on the session channel (`UCrowdyEntityComponent::RequestOwnership_Implementation`), so every client sees it, and only the entity's owner reacts.
2. On the owner, either `bAutoApproveOwnershipRequests` on the component is on and the grant happens at once, or `UCrowdyEntitySubsystem::OnOwnershipRequested` fires for game code to decide.
3. Game code approves by calling one of the two grant nodes, or ignores the request. There is no deny node; silence is the rejection.
4. The grant travels the same way (`GrantOwnership_Implementation`), every client re-points the entity's record through `UCrowdyEntitySubsystem::ReassignOwnership`, and `OnEntityOwnershipChanged` fires everywhere once ownership has actually moved.

<a id="the-four-nodes"></a>

## The three nodes

| Node | C++ | Who calls it |
|---|---|---|
| **Request Ownership Transfer** | `RequestOwnershipTransfer(WorldContextObject, TargetEntity)` | Any client that does not own the entity. A no-op when the target is not a registered entity or this client already writes it. |
| **Grant Ownership Transfer** | `GrantOwnershipTransfer(WorldContextObject, TargetEntity, NewOwner)` | The current owner. `NewOwner` is any entity the new owner's player owns, typically their avatar. |
| **Grant Ownership Transfer To Player** | `GrantOwnershipTransferToPlayer(WorldContextObject, TargetEntity, NewOwnerPlayerID)` | The current owner, with the requester's id straight from `OnOwnershipRequested`; no local actor of theirs is needed. |

Every node resolves the target's entity component and subsystem and is a safe no-op, never a crash, on a null or unregistered target. Both grants funnel through the component's C++ `GrantOwnershipTo(NewOwnerID)`, which is also a no-op with a warning unless this client is the current owner. The deprecated **Grant Ownership To Host** is under [Deprecated](#deprecated).

:::caution[Grant Ownership Transfer refuses a NewOwner that is not client-owned.]
Passing an actor no client owns (a World entity, `HostOwned`) or an unregistered actor logs a warning and does nothing.
:::

The lantern world's transfer is a player claiming a lantern post another player spawned. A post spawned during play belongs to its spawner; the second player asks for it, and the owner approves.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The request: the post's overlap, when this client does not own the post, calls `TryClaim`:

<CppSnippet id="own-request" />

The grant, on the owner: `HandleOwnershipRequested`, bound to `OnOwnershipRequested` in `BeginPlay`, ignores requests for other entities and grants the post to the requester:

<CppSnippet id="own-grant" />

</TabItem>
<TabItem value="bp" label="Blueprint">

From **Event ActorBeginOverlap**, **Request Ownership Transfer** with `Target Entity` wired to a Self reference; the "not already mine" check the C++ makes is a no-op inside the node anyway, since a request for an entity you already own does nothing:

<Blueprint src="own-request" title="Event ActorBeginOverlap, Request Ownership Transfer" />

The grant: at **Event BeginPlay**, a **Crowdy Entity Subsystem** getter feeds **Bind Event to On Ownership Requested**, whose custom event `OnClaimRequested` compares its `Target Entity` with a Self reference (**==** into a **Branch**, because the event fires for every entity this client owns) and, when they match, passes its `Requester ID` to **Grant Ownership Transfer To Player** with `Target Entity` wired to self. Eight nodes; the compare is the guard the C++ has:

<Blueprint src="own-grant" title="Event BeginPlay, Crowdy Entity Subsystem, Bind Event to On Ownership Requested, OnClaimRequested, ==, Branch, Grant Ownership Transfer To Player" />

</TabItem>
</Tabs>

**Success signal.** `OnEntityOwnershipChanged` fires on both clients with the new owner's id, the post's `IsLocallyOwned()` turns true on the requester and false on the old owner, and `OnCrowdyOwnershipAssigned` on the post's component fires with `bIsLocallyOwned` matching.

## The two events

On `UCrowdyEntitySubsystem`, both Blueprint-assignable, both on the game thread:

| Event | Parameters | Fires |
|---|---|---|
| `OnOwnershipRequested` (`FOnCrowdyOwnershipRequested`) | `TargetEntity`, `RequesterActor`, `RequesterID` | On the entity's owner only, when another client requests it. `RequesterActor` is the requester's avatar when this client holds it, else null; `RequesterID` is always valid. |
| `OnEntityOwnershipChanged` (`FOnCrowdyEntityOwnershipChanged`) | `TargetEntity`, `NetID`, `NewOwnerID`, `PreviousOwnerID` | On every client once ownership has actually changed. `NewOwnerID` is invalid when the entity went back to the world. |

`bAutoApproveOwnershipRequests` is authored config on the component, read on the owner when a request arrives. Changing it at runtime on one client affects only the requests that client receives while it owns the entity.

## What happens to in-flight state

The entity record is the single source of truth for both planes, so re-pointing its owner is the whole transfer: RPC routing and Crowdy State tracking follow. The old owner stops sending the moment it relinquishes; the new owner builds a fresh shadow of the entity's properties and starts diffing; bystanders are untouched. The actor's NetID never changes, so every address stays valid.

On the wire, each owner of an entity that replicates movement sends under an actor id of its own, made from the NetID and the owner, because the server keeps an id for the first session that sends it. Every client reads that id back to the same NetID, keeps one body, and drops anything the old owner still sends. An **Owning Client** event finds the current owner the same way. You never see these ids in game code. They do mean every client has to run the same SDK version: an older one reads the new id as another entity and draws a second body.

:::caution[There is a brief window with no writer.]
Between the old owner relinquishing and the reliable grant landing on the new owner, nobody diffs the entity. There is never a double writer, but for that short window there is no writer at all, by design. The continuous channel of an entity that replicates movement moves with the owner the same way: the new owner joins it and the old one leaves.
:::

A grant carries the previous owner's id, and `ReassignOwnership` compares and swaps on it, so a stale or duplicate grant is dropped rather than applied twice. A client that joined after the entity spawned may not know its owner, and takes the grant anyway.

## Deprecated

:::warning[Deprecated in 2.25. Everything in this section still works and is removed in a later release.]
[Deprecated in 2.25](../guides/deprecated.md) lists each item and what replaces it.
:::

### Grant Ownership To Host

Nothing replaces handing an entity back at runtime: keep state that must change hands in a [Server Object](../concepts/two-planes.md), or set Owned By to [Leader](./leader.md#an-npc-the-leader-simulates) on the class for an entity one client should simulate. The current grants are under [The three nodes](#the-three-nodes).

| Node | C++ | Who calls it |
|---|---|---|
| **Grant Ownership To Host** | `GrantOwnershipToHost(WorldContextObject, TargetEntity)` | The current owner, to give the entity back to the world. Under Server Object that leaves it with no writer until a client owns it again. It funnels through `GrantOwnershipTo(NewOwnerID)` like the other grants. |

**Grant Ownership Transfer** never falls back to the host; giving an entity to the host is this node's job alone.

### Under Elected Host

The [Leader](./leader.md) replaces the elected host. On a project whose **Leader Source** is still **Elected Host (Deprecated)**, the host writes an entity Owned By World and answers requests for it; everywhere this page says owner, read host for such an entity. [Host Election](../services/host-election.md#the-server-validated-check) has the server-validated check to run before such a grant.

## Gotchas

- Silence is the rejection. If you want the requester to know, send them an `OwningClient` event yourself.
- The request short-circuits on the component's `IsLocallyOwned()`, so the client that already writes an entity cannot request it by accident.
- Granting to a player id with no local presence orphans the entity until it is granted again. Check the requester is still in the session before you grant.
- A new owner that never observed the entity re-baselines from proxy defaults. The durable truth lives in your server code, not on the view plane.
- Two Multicast events on the component carry all of this. Never give them a `CrowdyChannel`; see [Entity component](./entity-component.md).

## Related

- [The Leader](./leader.md): who writes what, and why a World entity has no writer.
- [Entity component](./entity-component.md): `bAutoApproveOwnershipRequests`, `OnCrowdyOwnershipAssigned`, and the two receivers.
- [Crowdy State](./crowdy-state.md): the shadow and the diff the transfer restarts.
- [Entities, Identity, and Ownership](../concepts/entities-identity-ownership.md).
