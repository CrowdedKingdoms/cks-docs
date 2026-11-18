---
slug: leader
sidebar_position: 9
title: The Leader
description: Who writes shared view state, the Leader that writes replicated subsystems and NPCs, the deploy it needs, how to check and follow who leads, and what happens when the Leader leaves.
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
UnrealEditor-Cmd.exe MyGame.uproject -run=CrowdyServerCompute -op=deploy -yes
UnrealEditor-Cmd.exe MyGame.uproject -run=CrowdyServerCompute -op=restart -yes
```

A running root type keeps the code it started with, and the Leader asks the root whether a player is still in the world, so the restart is not optional.

Until the code is deployed there is no Leader. Each signed-in client tries again every 10 seconds and logs one warning. Server code deployed with an SDK older than this one has no **Enter** on the Leader type. Then each client logs one warning per sign-in that the server code must be deployed again and its running instances restarted, and tries again quietly every 60 seconds. Nothing writes Leader-owned entities or replicated subsystems until you deploy.

**Success signal.** With two clients signed in and each with a Player Derived pawn, `Get Leader User ID` returns the same id on both, and `Is Local Leader` is true on exactly one.

## Checking who writes an entity

`UCrowdyUtilities::IsCrowdyEntityLocallyOwned(Entity)` returns true when this client writes `Entity`: it owns the entity, or `Entity` is a replicated subsystem and this client is the Leader. It is a pure node, **Is Crowdy Entity Locally Owned**, in Blueprint; **Switch Is Crowdy Entity Locally Owned** (`SwitchIsCrowdyEntityLocallyOwned`) is the same answer as two exec pins. `Entity` is an entity actor or a replicated subsystem, and defaults to Self. Ask this before you write something, and pass the thing you are about to write.

For a World entity the answer is false on every client, because no client writes it. When something needs a writer and has none, such as marking a World entity's state dirty, the SDK logs a warning.

In C++, `UCrowdyEntitySubsystem::GetAppWriterID()` returns the actor id the Leader type publishes for the Leader (empty while there is none, see [When the Leader leaves](#when-the-leader-leaves)), and `GetWriterID(Record)` returns the client that writes a record with no owner: the Leader for a replicated subsystem, nobody for a World entity. Every ownership check follows one rule, `FCrowdyEntityRecord::IsWrittenBy`, which `UCrowdyEntitySubsystem::IsRecordLocallyOwned(Record)` applies with this client's ids.

Two more helpers on `UCrowdyUtilities` answer ownership questions without a round trip. `DoesCrowdyEntityOwn(OwnerActor, TargetActor)` is true when the first actor's session writes the second. It asks about sessions, so a second session of the same account does not own what the first writes; for the account, compare **Get Crowdy Entity Owner User ID** or use **Is Crowdy Entity Owned By Local User**. A World entity owns nothing and is owned by no one, the Leader included. `CrowdyIsConnectedToServer` says whether there is a connection at all.

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

Only a player in the realtime world with an actor id can lead. A client joins once its realtime connection is up and it holds an actor id (a Player Derived pawn, a Crowdy Spectator component or a chat message mints it), and leaves when the SDK reports that the connection failed. A client with no actor id stays out, so it cannot lead while writing nothing. A project where nothing mints an actor id has no Leader, and the SDK warns once per sign-in if a client still has none a second after it could have joined. The new Leader starts writing from the values it last received, so a subsystem carries on where the old Leader stopped, minus anything that had not reached it yet.

A player's actor id is random, so no client can work out the Leader's from its user id. Each client joins the Leader type with its own actor id (its **Enter** function). The type publishes the Leader's id in the same change that moves the lead, so every client goes straight from the old Leader's id to the new one's. Each client takes Leader-owned writes only under the id of the player who leads now. A client enters again when a sign-in gives it a new id. Of two sessions of one user, only the last to enter leads. A client that becomes the Leader before its id is published hears **On Leader Changed** once it can write.

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

## Gotchas

- `Get Leader User ID` is 0 until the client has joined. `Is Local Leader` is false until then, which does not mean someone else leads.
- For a moment around a hand-off, two clients can both believe they lead. Keep what a Leader writes safe to write twice.
- A new Leader sends the values it holds. If it joined late and missed one, its value replaces the one other clients had. Anything that must survive a hand-off belongs in a Server Object.
- A World entity's plain property does nothing when you assign it, and marking it dirty logs a warning: no client writes it.
- **Is Crowdy Entity Player Controlled** is false for an entity Owned By Leader, on every client.
- A client that walks out of a Leader entity's range holds its spawned body for 20 seconds too, so count that when you size **Max Pool Size Per Class**.
- The Leader's user id is a user id, not the actor id entities are written under. Compare it with your own user id, or use `IsLocalLeader()`. To ask whether an actor is the Leader's, run **Resolve Actor Owner** on its id and compare the user with **Get Leader User ID**, after checking that is not 0.

## Related

- [A Coordinator Is a Convention](../concepts/host-is-a-convention.md): why a client chosen to coordinate is not a referee.
- [Replicated subsystems](./replicated-subsystems.md): what the Leader writes.
- [Server Objects](../exec/overview.md): where World entities keep their truth.
- [Entity component](./entity-component.md): `OwnedBy` and `IsLocallyOwned`.
