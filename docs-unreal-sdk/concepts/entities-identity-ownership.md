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
- a **role**: `Owner` on the client that simulates it, `RemoteProxy` everywhere else, or `WorldOwned` for a world entity, which no client drives;
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
- **PlayerDerived**. A random id that belongs to one sign-in, valid only on the locally controlled player pawn. The game session mints it the first time something needs one (in C++, `UCrowdyGameSession::EnsureActorID()` returns it, minting one if none is held). A respawn and a later possession reuse it, and sign-out drops it. Every sign-in, the same user's included, gives the session a fresh one before the realtime connection opens; only an id minted while nobody was signed in is kept, since nothing could send under it. A Crowdy Spectator component and a chat message mint it too, while the session holds a user id, so all three send under one id. When the id changes, the live pawn re-registers under the new id and the player's other entities are re-pointed to it, so other players see the pawn leave and arrive again. Key anything you keep on the user id, not the actor id. The id is not computed from the user id, so no other client can work it out: **Resolve Actor Owner** ([Player safety](../services/player-safety.md#find-out-who-a-player-is)) answers which user is behind an actor id.
- **Random**. A fresh id each time, with no cross-client agreement. Use it for a purely local actor nobody else needs to address.

An actor you spawn during play through the SDK's spawn call is told its identity by the spawner, so its policy does not matter; the spawn travels to every client carrying the NetID.

:::note[PlayerDerived on anything but the local player's pawn falls back to Random.]
The SDK logs one warning and the actor gets an id no other client shares. Keep PlayerDerived for the pawn. The identity is read once: at the component's `BeginPlay` when the pawn already has a controller, otherwise inside its first possession, after the pawn's own **Possessed** and **Controller Changed** events, since a pawn spawned during play (`RestartPlayer`, a respawn) is possessed only after `BeginPlay`. The first controller of any kind completes it; an AI controller gets the fallback. A respawn that leaves the earlier pawn alive moves the player's id to the new pawn and clears the old one, which stops replicating. Read the id from the component's **On Crowdy Ownership Assigned** or the entity subsystem's `OnEntityRegistered`, never from `BeginPlay` or **Possessed**; **Is Locally Owned** on the pawn is false until the registration.
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
- **World**: no client writes it (`Role = WorldOwned`), and every client ignores Crowdy State sent for it. Keep what changes about it, such as whether a chest is open, in a Server Object. Its events still work: any client can send one.
- **Player**: this client owns and simulates it (`Role = Owner`).
- **Leader**: whichever client leads writes it, and the next Leader takes it over. See [An NPC the Leader simulates](../runtime/leader.md#an-npc-the-leader-simulates).

An entity spawned at runtime is always owned by the client that spawned it, whatever the component says: World only applies to level-placed actors that resolve their own identity.

Ask `IsLocallyOwned()` before doing owner work, or **Is Crowdy Entity Locally Owned** from any actor or replicated subsystem. It is true when this client owns the entity. For an entity Owned By World it is false on every client. A remote proxy never sends state; it receives and plays back.

Ownership names two things:

- The **writer id** (`GetWriterID()`, **Get Crowdy Entity Writer ID**) is the actor id of the one session that writes the entity. A player's own avatar has `NetID == WriterID ==` the local player id, and every entity that player spawns carries that id as its writer.
- The **owner user id** (**Get Owner User ID**, **Get Crowdy Entity Owner User ID**) is the user that session is signed in as. It is a label to show or compare, never a write check, because it is a client's claim. For another client's entity, this client learns it from the spawn event or a grant, and reads 0 until then. A spawn event never replaces a user it already knows.

Another client takes an entity for a player's avatar only when no spawn event announced it, its class's Crowdy Entity Component uses PlayerDerived, and it was heard under its bare id. An entity a game spawns, or a PlayerDerived pawn that fell back to Random, sends under a tagged id from the start, so it is never mistaken for an avatar. A remote avatar's owner user reads 0 and no grant teaches it: ask **Resolve Actor Owner** for its user.

A second session of the same account is a viewer of the first session's entities: **Is Owned By Local User** is true there and `IsLocallyOwned()` is false. This is Crowdy ownership and has nothing to do with `AActor::GetOwner()`.

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
