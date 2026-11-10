---
slug: entities-identity-ownership
sidebar_position: 2
title: Entities, Identity, and Ownership
description: How every networked actor gets a NetID that every client agrees on, who is allowed to write its view state, and the difference between an owner and a proxy.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Entities, Identity, and Ownership

An entity is an actor that other players can see and react to. It carries one `UCrowdyEntityComponent`, which gives it a shared identity, a role on each client, and a place in the entity registry. RPC events and Crowdy State are both built on top of that.

## What an entity is

Add a `UCrowdyEntityComponent` to an actor and it becomes an entity. On every client the entity has:

- a **NetID**, the name every client uses for this one thing;
- a **role**: `Owner` on the client that simulates it, `RemoteProxy` everywhere else, or `HostOwned` for a world entity, which no client drives;
- an entry in the entity registry, which is how an event aimed at "this rock" finds the right rock on each machine.

## The NetID

The SDK hands you the NetID as an `FGuid` (`GetNetID()`), which is convenient to compare and store. On the wire it is 32 opaque bytes; the `FGuid` is a derived form. Treat it as an opaque handle: compare it, pass it along, never build one by hand.

:::warning[Never construct a NetID yourself.]
The wire identity is not an RFC 4122 UUID, and a hand-made `FGuid` does not name anything. Let the identity policy below, or a spawn call, mint it.
:::

### `FCrowdyActorId`, the wire type

`FGuid` is the convenient face; `FCrowdyActorId` is what actually travels the wire, 32 raw octets rather
than an RFC 4122 UUID. Build one only through its named constructors: `FromGuid` converts an `FGuid`,
`FromOctets` and the fallible `TryFromOctets` build from an existing 32-byte view (the fallible one returns
`bool` instead of asserting), `FromStringOrUnset` and `TryFromString` parse a hex string, and
`FromAnsiLiteral` builds a compile-time one from a string literal for tests and defaults.

Once you have one, `IsSet()` says whether it names anything, `AsOctets()` gives a read-only view of the 32
bytes, `AppendTo` and `WriteTo` copy them into a buffer you already own, `ToString()` renders the hex form
back, and `Reset()` clears it to unset.

## Identity policies

`IdentityPolicy` on the component decides how the NetID is chosen.

- **Stable** (the default). Derived from the actor's placement in the level, so every client computes the same NetID for the same level-placed actor with no spawn message and no hand-typed seed. Use it for anything that already exists when the map loads: props, spawners, doors.
- **PlayerDerived**. Derived from the signed-in user id. Valid only on the locally controlled player pawn.
- **Random**. A fresh id each time, with no cross-client agreement. Use it for a purely local actor nobody else needs to address.

An actor you spawn during play through the SDK's spawn call is told its identity by the spawner, so its policy does not matter; the spawn travels to every client carrying the NetID.

:::note[PlayerDerived on anything but the local player's pawn falls back to Random.]
The SDK logs one warning and the actor gets an id no other client shares. Keep PlayerDerived for the pawn. The identity is read once: at the component's `BeginPlay` when the pawn already has a controller, otherwise inside its first possession, after the pawn's own **Possessed** and **Controller Changed** events, since a pawn spawned during play (`RestartPlayer`, a respawn) is possessed only after `BeginPlay`. The first controller of any kind completes it; an AI controller gets the fallback. A respawn that leaves the earlier pawn alive moves the account id to the new pawn and clears the old one, which stops replicating. Read the id from the component's **On Crowdy Ownership Assigned** or the entity subsystem's `OnEntityRegistered`, never from `BeginPlay` or **Possessed**; **Is Locally Owned** on the pawn is false until the registration.
:::

![The entity component's Details panel: Replicate Movement, Identity Policy, and Owned By](/img/unreal-sdk/entity-mode-identity.png)

### Stable identity in a packaged build

Stable identity prefers the engine's per-placement instance guid, which is saved in the level and is identical on every client. In a cooked build the engine releases that guid before `BeginPlay`, so the SDK snapshots it when the component registers and uses the snapshot. You do not have to do anything, but if you write your own identity code, read placement data at `OnRegister`, never at `BeginPlay`.

:::danger[In a cooked build, read the placement guid at OnRegister, never at BeginPlay.]
Editor and Play in Editor keep the guid alive and hide the bug; only a packaged build shows it.
:::

## Owner and proxy

For each entity exactly one client writes the entity's view state: its owning client.

**Owned By** on the component chooses it:

- **Auto** (the default): World for an actor placed in the level, Player for one spawned during play.
- **World**: no client writes it (`Role = HostOwned`), and every client ignores Crowdy State sent for it. Keep what changes about it, such as whether a chest is open, in a Server Object. Its events still work: any client can send one.
- **Player**: this client owns and simulates it (`Role = Owner`).

An entity spawned at runtime is always owned by the client that spawned it, whatever the component says: World only applies to level-placed actors that resolve their own identity.

Ask `IsLocallyOwned()` before doing owner work, or **Is Crowdy Entity Locally Owned** from any actor or replicated subsystem. It is true when this client owns the entity. For an entity Owned By World it is false on every client. A remote proxy never sends state; it receives and plays back.

A player's own avatar has `NetID == OwnerID == the local player id`, and every entity that player spawns carries that id as its `OwnerID`. This is Crowdy ownership and has nothing to do with `AActor::GetOwner()`.

## Example

A lantern post is a lantern that belongs to the level rather than to a player: the [Quickstart](../quickstart.md) lantern with the three settings a level-placed world entity wants. It is event-only, every client derives the same NetID for it, and it is Owned By World, so no client writes it.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

All three settings are `EditAnywhere`, so a constructor (or the Details panel, or Class Defaults) is where they are set. `ALanternPost` inherits everything else from `ALantern`, but its `IsLocallyOwned()` checks are false on every client, so the lantern's owner-only code never runs on a post placed in the level:

<CppSnippet id="identity-policies" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Set Replicate Movement, Identity Policy, and Owned By on the component in the Details panel (see the screenshot above). At runtime, `Is Locally Owned` is the question to ask before owner work; on a post Owned By World it is false on every client. This graph, in an Actor Blueprint with a **Point Light** named `Light` whose **Visible** box is unticked, lights the post only on a client that writes it, so a World post stays dark and a post a player spawns lights on that player's client:

<Blueprint src="identity-policies" title="BeginPlay, Is Locally Owned, Branch, Set Visibility on Light" />

Pan the graph with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

`Replicates Movement`, `Get Owned By`, `Get Role`, and `Get Net ID` are the component's pure getters; `Get Role` is the resolved answer. There is no getter for Identity Policy; it is a design-time setting only.

</TabItem>
</Tabs>

## Deprecated

:::warning[Deprecated in 2.25. Everything in this section still works and is removed in a later release.]
[Deprecated in 2.25](../guides/deprecated.md) lists each item and what replaces it.
:::

### A World entity under Elected Host

A Server Object replaces the elected host as the keeper of what changes about a World entity, as [Who writes what](../runtime/leader.md#who-writes-what) explains; [Host Election (Deprecated)](../services/host-election.md#what-the-host-writes) has the rest.

When [Leader Source](../runtime/leader.md#leader-source-with-or-without-a-host) is **Elected Host (Deprecated)**, the elected host drives and writes an entity Owned By World instead, and `IsLocallyOwned()` is true for it on that client alone.

## Gotchas

- `IsLocallyOwned()` is the question to ask. Do not compare ids by hand to decide who is in charge.
- A proxy of an entity that sends no movement never exists on its owner; the owner has the real thing, and an event it sends never comes back to it. The owner of an entity that replicates movement may see its own echoed proxy as well; see [Rendering backends](../runtime/rendering-backends.md).
- Stable identity depends on level placement. An actor you create in code with Stable set does not agree across clients; spawn it through the SDK instead.
- Identity Policy has no Blueprint getter. If a graph needs it, it is probably asking the wrong question; ask `Get Role` instead.

## Related

- [The Two Planes](./two-planes.md): which state an owner is allowed to write.
- [A Coordinator Is a Convention](./host-is-a-convention.md): why a client chosen to coordinate is not a referee.
- [The Leader](../runtime/leader.md): who writes what.
- [Entities and spawning](../runtime/entities-and-spawning.md): spawning at runtime and receiving spawns.
