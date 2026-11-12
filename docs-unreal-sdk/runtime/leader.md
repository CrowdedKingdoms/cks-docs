---
slug: leader
sidebar_position: 9
title: The Leader
description: Who writes shared view state, the Leader that writes replicated subsystems and NPCs, the deploy it needs, how to check and follow who leads, what happens when the Leader leaves, and the Leader Source setting.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# The Leader

Some view-plane state belongs to no player: a village clock, a weather phase. One client has to write it, and that client is the **Leader**. A Server Object the SDK deploys for you picks it: the first player to join leads, and when that player goes, the longest-standing member takes over. There is one Leader per app.

Choosing the Leader on the server keeps the choice in one place. It does not make what the Leader writes trustworthy: that is still [view plane](../concepts/two-planes.md) state, which a modified client can lie about.

## Who writes what

| What | Who writes it |
|---|---|
| An entity Owned By **Player** | Its owner: the player who spawned it, or the player it was [transferred](./ownership-transfer.md) to. |
| An entity Owned By **World** (an actor placed in the level, by default) | No client. Keep what changes about it on the [truth plane](../concepts/two-planes.md), in a Server Object. Its events still work: any client can send one. |
| An entity Owned By **Leader** | The Leader, whoever that is now. See [An NPC the Leader simulates](#an-npc-the-leader-simulates). |
| A [replicated subsystem](./replicated-subsystems.md) | The Leader. |

## Deploy the server code once

The Leader lives in a Server Object type the SDK adds to every deploy (`crowdy_leader`, shown in [Server Compute](../exec/deploy-with-server-compute.md) as the SDK's own). There is nothing to create. Deploy your app's server code once, then restart what still runs older code, from Server Compute or with:

```
UnrealEditor-Cmd.exe MyGame.uproject -run=CrowdyServerCompute -op=restart -yes
```

A running root type keeps the code it started with, and the Leader asks the root whether a player is still in the world, so the restart is not optional.

Until the code is deployed there is no Leader. Each signed-in client tries again every 10 seconds and logs one warning.

**Success signal.** With two clients signed in and each with a Player Derived pawn, `Get Leader User ID` returns the same id on both, and `Is Local Leader` is true on exactly one.

## Checking who writes an entity

`UCrowdyUtilities::IsCrowdyEntityLocallyOwned(Entity)` returns true when this client writes `Entity`: it owns the entity, or `Entity` is a replicated subsystem and this client is the Leader. It is a pure node, **Is Crowdy Entity Locally Owned**, in Blueprint; **Switch Is Crowdy Entity Locally Owned** (`SwitchIsCrowdyEntityLocallyOwned`) is the same answer as two exec pins. `Entity` is an entity actor or a replicated subsystem, and defaults to Self. Ask this before you write something, and pass the thing you are about to write.

For a World entity the answer is false on every client, because no client writes it.

Two more helpers on `UCrowdyUtilities` answer ownership questions without a round trip. `DoesCrowdyEntityOwn(OwnerActor, TargetActor)` is true when the first actor's player owns the second. `CrowdyIsConnectedToServer` says whether there is a connection at all.

**Switch Crowdy Has Authority** and **Crowdy Has Authority** are gone. They asked whether this client is the host, with no entity to ask about: use **Is Local Leader** for the same question, true on one client only. Use **Switch Is Crowdy Entity Locally Owned** only to gate a write to an entity or subsystem you own, and put logic that must be enforced in a Server Object.

## Follow the Leader

`UCrowdyLeaderSubsystem` is a game-instance subsystem in the `CrowdyExec` module, so a C++ caller adds `CrowdyExec` to its `Build.cs` and includes `CrowdyLeaderSubsystem.h`. `GetLeaderUserID()` is the Leader's user id, 0 while there is none or it is not known yet. `IsLocalLeader()` says whether this client leads. `OnLeaderChanged` (`FOnCrowdyLeaderChanged`, `NewLeaderUserID`, `PreviousLeaderUserID`, on the game thread) fires when the lead moves, and a user id of 0 means there is no Leader.

Bind the event rather than reading the answer once at `BeginPlay`: the Leader is not known that early on a fresh sign-in, and it changes when the Leader leaves. A map loaded after the Leader is known hears no change, so also read the answer once.

The lantern world shows the lead on its posts: an `ALanternPost` burns bright on the client that leads and dim everywhere else, and the bright post moves when the lead does.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="leader-gate" />

</TabItem>
<TabItem value="bp" label="Blueprint">

At **Event BeginPlay**, a **Crowdy Leader Subsystem** getter feeds **Bind Event to On Leader Changed**, whose custom event `OnLeadMoved` calls **Set Intensity** on `Light`. **Is Local Leader**, off a second getter, picks the value through a **Select Float** with `A` at 5000 and `B` at 1000. To cover a post that loads after the Leader is known, also call `OnLeadMoved` after the bind.

<Blueprint src="leader-gate" title="Event BeginPlay, Crowdy Leader Subsystem, Bind Event to On Leader Changed, OnLeadMoved, Is Local Leader, Select Float, Get Light, Set Intensity" />

</TabItem>
</Tabs>

:::danger[The Leader is a convention, not enforcement. Never gate cheat-sensitive state on it.]
Nothing on the wire is rejected for not coming from the Leader, and a modified client can act as if it leads. Use the Leader to pick who writes shared cosmetic state; anything a player could gain by leading is decided by your server code, on the [truth plane](../concepts/two-planes.md).
:::

**Success signal.** With two clients, the post is bright on exactly one of them. Close that client and the post brightens on the other. The effect is local by design: a value the whole village must see is a [Crowdy State](./crowdy-state.md) property on a replicated subsystem.

## When the Leader leaves

The longest-standing member takes over, and `OnLeaderChanged` fires on every client. How long that takes depends on how the Leader went.

| The Leader's client | The new Leader takes over |
|---|---|
| Leaves or signs out | At once. |
| Crashes | About half a second later, when its connection closes. |
| Loses only its realtime connection | About 10 seconds later, when the server hears it left the realtime world. A client that sees its own connection fail leaves by itself, which is sooner. |
| Freezes with its connection open | About 10 seconds later, for the same reason. |

Only a player in the realtime world with an avatar can lead: a client joins once its realtime connection is up and a Player Derived pawn has given it a player id for this sign-in, and leaves when the SDK reports that the connection failed. A client that has not spawned one yet stays out, so it cannot lead while writing nothing. A project with no Player Derived pawn has no Leader. The new Leader starts writing from the values it last received, so a subsystem carries on where the old Leader stopped, minus anything that had not reached it yet.

## An NPC the Leader simulates

Some entities need one client to simulate them for everyone: an NPC that walks the navmesh or falls under physics. Set **Owned By** to **Leader** on its [entity component](./entity-component.md), with **Replicate Movement** **On** (an NPC that is not a pawn with a movement component needs it), and simulate only on the client that writes it. The lamplighter walks the lane on whichever client leads, and every other client draws it.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="leader-npc" />

</TabItem>
<TabItem value="bp" label="Blueprint">

On the component, set **Owned By** to **Leader**. In the graph, **Event Tick** runs a **Branch** on **Is Crowdy Entity Locally Owned**, and its **True** pin runs **Add Actor World Offset**.

<Blueprint src="leader-npc" title="Event Tick, Is Crowdy Entity Locally Owned, Branch, Add Actor World Offset" />

</TabItem>
</Tabs>

**Success signal.** With two clients, the lamplighter moves on both and `Is Crowdy Entity Locally Owned` is true on exactly one. Close that client: the lamplighter stops on the other, then moves on from there once that client leads.

- **Ask each tick, not once.** Who writes the entity changes when the lead moves, so a check at `BeginPlay` goes stale.
- **Only the Leader spawns or destroys one.** On any other client **Spawn Crowdy Entity** returns null and logs a warning, so check **Is Local Leader** first. **Destroy Entity** is refused the same way.
- **Its owner follows the lead.** [Ownership requests and grants](./ownership-transfer.md) on it are refused with a warning.
- **Through a hand-off the body stays put.** Other clients keep it where it stopped until the next Leader sends. A new Leader's pawn movement is switched back on when it takes over, and with **Auto Register** off it waits for your `StartReplication` call.

:::caution[One Leader, for players who share a map.]
There is one Leader per app, and it writes only what it has a body for: the entities it spawned, and the ones it already drew when it took over. A Leader takes no entity it never had, because a spawn event or an update can be forged. So when the lead moves to a player on another map, or to one who was never near the entity, nobody writes it: other clients hold a spawned body for 20 seconds and then release it, and a body placed in the level stays where it stopped.

For NPCs across maps or a large open world, use [hub NPCs](../exec/use-game-kit-starters.md), which run on the server and need no Leader. Leader entities need an actor pool map: on a [crowd-row map](./rendering-backends.md) the SDK warns once per class, because a row has no actor for a new Leader to take over.
:::

<a id="leader-source-with-or-without-a-host"></a>

## Leader Source

**Project Settings, Plugins, Crowdy SDK, Replication, Leader Source** (`LeaderSource` on `UCrowdySDKDeveloperSettings`, an `ECrowdyLeaderSource`) decides who writes shared state. Its default, **Server Object**, is everything on this page: a World entity has no writer on any client, and every client ignores Crowdy State sent for a World entity. The other value, **Elected Host (Deprecated)**, is described under [Deprecated](#deprecated).

When something needs a writer and has none, the SDK says so in a warning that names this setting: marking a World entity's state dirty, or registering a replicated subsystem.

In C++, `UCrowdyEntitySubsystem::GetWriterID(Record)` returns the client that writes a record with no owner: the Leader for a replicated subsystem, and for a World entity what `GetWorldOwnerID()` returns, which is nobody. Every ownership check follows one rule, `FCrowdyEntityRecord::IsWrittenBy`, which `UCrowdyEntitySubsystem::IsRecordLocallyOwned(Record)` applies with this client's ids.

## Deprecated

:::warning[Deprecated in 2.25. The Elected Host setting still exists, elects nobody, and is removed in a later release.]
[Deprecated in 2.25](../guides/deprecated.md) lists each item and what replaces it.
:::

### Elected Host

The default Leader Source, **Server Object**, and the Leader this page teaches replace the elected host. The SDK no longer polls for a host, so under **Elected Host (Deprecated)** nobody is elected either. The setting goes in a later release.

With **Leader Source** set to **Elected Host (Deprecated)**, no client writes a World entity or a replicated subsystem, a Host event on an actor goes nowhere, and the Leader subsystem does not start (it logs a warning that names this setting), so `GetLeaderUserID()` stays 0 and `IsLocalLeader()` is false. Under Server Object, sending a Host event with no writer logs a warning that names this setting. Move what the host used to do to a Server Object, or to the Leader under Server Object.

In C++, `UCrowdySDKDeveloperSettings::UsesElectedHost()` reads the setting.

## Gotchas

- `Get Leader User ID` is 0 until the client has joined. `Is Local Leader` is false until then, which does not mean someone else leads.
- For a moment around a hand-off, two clients can both believe they lead. Keep what a Leader writes safe to write twice.
- A new Leader sends the values it holds. If it joined late and missed one, its value replaces the one other clients had. Anything that must survive a hand-off belongs in a Server Object.
- A World entity's plain property does nothing when you assign it, and marking it dirty logs a warning: no client writes it.
- **Is Crowdy Entity Player Controlled** is false for an entity Owned By Leader, on every client.
- A client that walks out of a Leader entity's range holds its spawned body for 20 seconds too, so count that when you size **Max Pool Size Per Class**.
- The Leader's user id is a raw user id, not the id entities are owned under. Compare it with your own user id, or use `IsLocalLeader()`.

## Related

- [A Coordinator Is a Convention](../concepts/host-is-a-convention.md): why a client chosen to coordinate is not a referee.
- [Replicated subsystems](./replicated-subsystems.md): what the Leader writes.
- [Server Objects](../exec/overview.md): where World entities keep their truth.
- [Entity component](./entity-component.md): `OwnedBy` and `IsLocallyOwned`.
