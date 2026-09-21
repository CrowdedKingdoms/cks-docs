---
slug: ownership-transfer
sidebar_position: 12
title: Ownership Transfer
description: "Move an entity's owner at runtime with a request and a grant: the four static nodes, the two subsystem events, what happens to in-flight state, and why ignoring a request is the rejection."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Ownership Transfer

An entity spawned at runtime belongs to its spawner and a level-placed one to whoever its `Ownership` says. Ownership transfer moves it: a client asks, the entity's current authority grants or ignores, and the grant lands on every client. `UCrowdyOwnershipTransfer` is a static Blueprint library with the four verbs.

## When to use it

A player picks up a lantern post that belonged to the level, a vehicle changes driver, a world creature becomes a player's pet. Anything where "who simulates this" should change hands without destroying and respawning.

:::warning[Ownership is a coordination convention on the view plane, not enforcement, and a transfer is transient.]
No server checks who may request or grant. And a client that first observes the entity after a grant sees the spawn-time owner, or re-baselines from proxy defaults, not necessarily the transferred one. Cheat-sensitive ownership belongs in a [Game Model](../game-models/overview.md).
:::

## The flow

1. A client that does not own the entity calls **Request Ownership Transfer**. The request travels as a Multicast `CrowdyEvent` on the session channel (`UCrowdyEntityComponent::RequestOwnership_Implementation`), so every client sees it, and only the entity's current authority reacts: the owning client, or the host for a host-owned world entity.
2. On the authority, either `bAutoApproveOwnershipRequests` on the component is on and the grant happens at once, or `UCrowdyEntitySubsystem::OnOwnershipRequested` fires for game code to decide.
3. Game code approves by calling one of the three grant nodes, or ignores the request. There is no deny node; silence is the rejection.
4. The grant travels the same way (`GrantOwnership_Implementation`), every client re-points the entity's record through `UCrowdyEntitySubsystem::ReassignOwnership`, and `OnEntityOwnershipChanged` fires everywhere once ownership has actually moved.

## The four nodes

| Node | C++ | Who calls it |
|---|---|---|
| **Request Ownership Transfer** | `RequestOwnershipTransfer(WorldContextObject, TargetEntity)` | Any client that does not own the entity. A no-op when the target is not a registered entity or this client is already its authority. |
| **Grant Ownership Transfer** | `GrantOwnershipTransfer(WorldContextObject, TargetEntity, NewOwner)` | The current authority. `NewOwner` is any entity the new owner's player owns, typically their avatar. |
| **Grant Ownership Transfer To Player** | `GrantOwnershipTransferToPlayer(WorldContextObject, TargetEntity, NewOwnerPlayerID)` | The current authority, with the requester's id straight from `OnOwnershipRequested`; no local actor of theirs is needed. |
| **Grant Ownership To Host** | `GrantOwnershipToHost(WorldContextObject, TargetEntity)` | The current authority, to make the entity host-owned again. The one verb an actor reference cannot express, because the host is not an actor. |

Every node resolves the target's entity component and subsystem and is a safe no-op, never a crash, on a null or unregistered target. All three grants funnel through the component's C++ `GrantOwnershipTo(NewOwnerID)`, which is also a no-op with a warning unless this client is the current authority.

:::caution[Grant Ownership Transfer refuses a NewOwner that is not client-owned. It does not fall back to the host.]
Passing a host-owned or unregistered actor logs a warning and does nothing, and the log tells you to use **Grant Ownership To Host** instead. The choice between a player and the host is explicit.
:::

The lantern world's transfer is a player claiming a lantern post. The post is level-placed and host-owned; the player asks for it, and the host approves.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The request: the post's overlap, when this client does not own the post, calls `TryClaim`:

<CppSnippet id="own-request" />

The grant, on whichever client is the authority: `HandleOwnershipRequested`, bound to `OnOwnershipRequested` in `BeginPlay`, ignores requests for other entities and hands the requester's id to `VerifyThenGrant`, which grants behind the server-validated host check on [Host authority](./host-authority.md#the-server-validated-check):

<CppSnippet id="own-grant" />

</TabItem>
<TabItem value="bp" label="Blueprint">

From **Event ActorBeginOverlap**, **Request Ownership Transfer** with `Target Entity` wired to a Self reference; the "not already mine" check the C++ makes is a no-op inside the node anyway, since a request for an entity you already own does nothing:

<Blueprint src="own-request" title="Event ActorBeginOverlap, Request Ownership Transfer" />

The grant: at **Event BeginPlay**, a **Crowdy Entity Subsystem** getter feeds **Bind Event to On Ownership Requested**, whose custom event `OnClaimRequested` compares its `Target Entity` with a Self reference (**==** into a **Branch**, because the event fires for every entity this client is the authority of) and, when they match, passes its `Requester ID` to **Grant Ownership Transfer To Player** with `Target Entity` wired to self. Eight nodes; the compare is the guard the C++ has. The [server-checked version](./host-authority.md#the-server-validated-check) puts the host check between the event and the grant:

<Blueprint src="own-grant" title="Event BeginPlay, Crowdy Entity Subsystem, Bind Event to On Ownership Requested, OnClaimRequested, ==, Branch, Grant Ownership Transfer To Player" />

</TabItem>
</Tabs>

**Success signal.** `OnEntityOwnershipChanged` fires on both clients with the new owner's id, the post's `IsLocallyOwned()` turns true on the requester and false on the host, and `OnCrowdyOwnershipAssigned` on the post's component fires with `bIsLocallyOwned` matching.

## The two events

On `UCrowdyEntitySubsystem`, both Blueprint-assignable, both on the game thread:

| Event | Parameters | Fires |
|---|---|---|
| `OnOwnershipRequested` (`FOnCrowdyOwnershipRequested`) | `TargetEntity`, `RequesterActor`, `RequesterID` | On the entity's current authority only, when another client requests it. `RequesterActor` is the requester's avatar when this client holds it, else null; `RequesterID` is always valid. |
| `OnEntityOwnershipChanged` (`FOnCrowdyEntityOwnershipChanged`) | `TargetEntity`, `NetID`, `NewOwnerID`, `PreviousOwnerID` | On every client once ownership has actually changed. `NewOwnerID` is invalid when the result is host-owned. |

`bAutoApproveOwnershipRequests` is authored config on the component, read on whichever client is the authority when a request arrives. Changing it at runtime on one client affects only the requests that client receives while it holds authority.

## What happens to in-flight state

The entity record is the single source of truth for both planes, so re-pointing its owner is the whole transfer: RPC routing and Crowdy State tracking follow. The old owner stops sending the moment it relinquishes; the new owner builds a fresh shadow of the entity's properties and starts diffing; bystanders are untouched. The actor's NetID never changes, so every address stays valid.

:::caution[There is a brief window with no writer.]
Between the old owner relinquishing and the reliable grant landing on the new owner, nobody diffs the entity. There is never a double writer, but for that short window there is no writer at all, by design. A Dynamic entity's continuous channel moves with the authority the same way: the new owner joins it and the old one leaves.
:::

A grant carries the previous owner's id, and `ReassignOwnership` compares and swaps on it, so a stale or duplicate grant is dropped rather than applied twice.

## Gotchas

- Silence is the rejection. If you want the requester to know, send them an `OwningClient` event yourself.
- The request short-circuits on the component's `IsLocallyOwned()`, so the host of a host-owned entity cannot accidentally request its own world entity into personal ownership.
- Granting to a player id with no local presence orphans the entity until it is granted again. Check the requester is still in the session before you grant.
- A new owner that never observed the entity re-baselines from proxy defaults. The durable truth is a Game Model, not the view plane.
- Two Multicast events on the component carry all of this. Never give them a `CrowdyChannel`; see [Entity component](./entity-component.md).

## Related

- [Host authority](./host-authority.md): the host as the authority for a world entity, and the server-validated check before a grant.
- [Entity component](./entity-component.md): `bAutoApproveOwnershipRequests`, `OnCrowdyOwnershipAssigned`, and the two receivers.
- [Crowdy State](./crowdy-state.md): the shadow and the diff the transfer restarts.
- [Entities, Identity, and Ownership](../concepts/entities-identity-ownership.md).
