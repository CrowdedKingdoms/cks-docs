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
- a **role**: `Owner` on the client that simulates it, `RemoteProxy` everywhere else, or `HostOwned` for a world entity the elected host drives;
- an entry in the entity registry, which is how an event aimed at "this rock" finds the right rock on each machine.

## The NetID

The SDK hands you the NetID as an `FGuid` (`GetNetID()`), which is convenient to compare and store. On the wire it is 32 opaque bytes; the `FGuid` is a derived form. Treat it as an opaque handle: compare it, pass it along, never build one by hand.

:::warning[Never construct a NetID yourself.]
The wire identity is not an RFC 4122 UUID, and a hand-made `FGuid` does not name anything. Let the identity policy below, or a spawn call, mint it.
:::

## Identity policies

`IdentityPolicy` on the component decides how the NetID is chosen.

- **Stable** (the default). Derived from the actor's placement in the level, so every client computes the same NetID for the same level-placed actor with no spawn message and no hand-typed seed. Use it for anything that already exists when the map loads: props, spawners, doors.
- **PlayerDerived**. Derived from the signed-in user id. Valid only on the locally controlled player pawn.
- **Random**. A fresh id each time, with no cross-client agreement. Use it for a purely local actor nobody else needs to address.

An actor you spawn during play through the SDK's spawn call is told its identity by the spawner, so its policy does not matter; the spawn travels to every client carrying the NetID.

:::note[PlayerDerived on anything but the local player's pawn falls back to Random.]
The SDK logs one warning and the actor gets an id no other client shares. Keep PlayerDerived for the pawn.
:::

![The entity component's Details panel: Mode, Identity Policy, and Ownership](/img/unreal-sdk/entity-mode-identity.png)

### Stable identity in a packaged build

Stable identity prefers the engine's per-placement instance guid, which is saved in the level and is identical on every client. In a cooked build the engine releases that guid before `BeginPlay`, so the SDK snapshots it when the component registers and uses the snapshot. You do not have to do anything, but if you write your own identity code, read placement data at `OnRegister`, never at `BeginPlay`.

:::danger[In a cooked build, read the placement guid at OnRegister, never at BeginPlay.]
Editor and Play in Editor keep the guid alive and hide the bug; only a packaged build shows it.
:::

## Owner and proxy

For each entity exactly one client is the authority, and only the authority writes the entity's view state.

`Ownership` on the component chooses the authority for a level-placed actor:

- **Host** (the default): whichever client is currently the elected host owns it (`Role = HostOwned`). Every client shares one authority, which is what a world or AI entity wants.
- **LocalClient**: this client owns and simulates it (`Role = Owner`).

An entity spawned at runtime is always owned by the client that spawned it, whatever the component says. `Ownership` only applies to level-placed actors that resolve their own identity.

Ask `IsLocallyOwned()` before doing owner work. It is true when this client is the entity's owner, or when the entity is host-owned and this client is the host. A remote proxy never sends state; it receives and plays back.

A player's own avatar has `NetID == OwnerID == the local player id`, and every entity that player spawns carries that id as its `OwnerID`. This is Crowdy ownership and has nothing to do with `AActor::GetOwner()`.

## Example

A lantern post is a lantern that belongs to the level rather than to a player: the [Quickstart](../quickstart.md) lantern with the three settings a level-placed world entity wants. It is event-only, every client derives the same NetID for it, and the elected host is its one authority.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

All three settings are `EditAnywhere`, so a constructor (or the Details panel, or Class Defaults) is where they are set. `ALanternPost` inherits everything else from `ALantern`, so a post flickers and lights like any lantern, and its `IsLocallyOwned()` checks are true on the host alone:

<CppSnippet id="identity-policies" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Set Mode, Identity Policy, and Ownership on the component in the Details panel (see the screenshot above). At runtime, `Is Locally Owned` is the question to ask before owner work; on a host-owned post it is true on the elected host and false everywhere else. This graph, in an Actor Blueprint with a **Point Light** named `Light` whose **Visible** box is unticked, lights the post on exactly one client, the host:

<Blueprint src="identity-policies" title="BeginPlay, Is Locally Owned, Branch, Set Visibility on Light" />

Pan the graph with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

`Get Mode`, `Get Ownership`, `Get Role`, and `Get Net ID` are the component's pure getters for the resolved identity. There is no getter for Identity Policy; it is a design-time setting only.

</TabItem>
</Tabs>

## Gotchas

- `IsLocallyOwned()` is the question to ask. Do not compare ids by hand to decide who is in charge.
- A remote proxy exists on every client except the owner; the owner has the real thing and no proxy of itself.
- Stable identity depends on level placement. An actor you create in code with Stable set does not agree across clients; spawn it through the SDK instead.
- Identity Policy has no Blueprint getter. If a graph needs it, it is probably asking the wrong question; ask `Get Role` instead.

## Related

- [The Two Planes](./two-planes.md): which state an owner is allowed to write.
- [The Host Is a Convention](./host-is-a-convention.md): what host-owned means.
- [Entities and spawning](../runtime/entities-and-spawning.md): spawning at runtime and receiving spawns.
