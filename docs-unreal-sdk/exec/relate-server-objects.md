---
slug: relate-server-objects
sidebar_position: 4
title: Relate Server Objects to each other
description: "How to model relations with Server Objects: one to one (a player, an actor or a team and its own object), one to many (a registry that lists other objects by Instance Id), many to one (many players on one shared object, many objects reporting to one), many to many (players and lobbies, teams and their objects), and good practice for ids, ownership, calls between types, limits and Readable By."
---

# Relate Server Objects to each other

:::note
Server Objects run on [ck-exec](/exec/intro). The tagged v2.17.0 plugin does not have them; see [What's Changed](../guides/whats-changed.md#unreleased-after-v2170).
:::

A game rarely has one Server Object on its own. A player has a stash, a guild has a hall, a hall sits in a registry, a match reports to a leaderboard. This page shows how to model those relations with the settings you already have: the Instance Id, **Readable By**, **Members From**, **Only One Instance** and **Can Call**. Nothing here is a separate feature.

The rule under all of it: **an object refers to another by its Instance Id.** A Server Object's type and Instance Id are all it takes to reach it, from Blueprint, from C++ or from another type's server code.

## One to one

One thing in your game has exactly one Server Object of its own.

| Relation | Settings | Instance Id |
|---|---|---|
| A player and their own object, such as a locker or a stash | **Readable By**: **Owner Only** | The player's user id |
| An actor placed in the level and its object | The component's **Instance Mode**: **This Actor** | None to type: the actor's placement |
| A team and its object | **Members From**: **Crowdy Team** | The team's id |

An **Owner Only** object belongs to one player: only that player reads it or calls it. In Blueprint, the component's **Signed-In Player** mode, or **Find By Asset** with **Signed-In Player**, finds it with no id to type. See [Owner Only types](./from-cpp/get-a-server-object.md#owner-only-types).

**This Actor** gives each placed actor its own object, the same on every player's machine; the [shared boss](./examples/shared-boss.md#the-actor) uses it. An actor spawned at run time needs an id of its own instead, set with **Instance Id**.

A **Crowdy Team** object is the team's: the platform's teams decide who belongs, and the component's **Player's Team** mode finds it. See [Crowdy Team](./access-members-and-timers.md#crowdy-team).

## One to many

One object keeps a list of others, such as a registry of the village's guild halls. The registry holds each hall's Instance Id, never the hall's values.

| Part | Settings |
|---|---|
| The registry | **Only One Instance** when there is truly one per app, or one Instance Id per region; a String, Array or Map variable of Instance Ids; **Can Call** with the listed type, if it seats players or changes them |
| Each listed object | Its own type and Instance Id, such as `hall-1`, with its own **Readable By** and members |

To reach a listed object, take its Instance Id from the registry:

- give the component **From Server Value**, pointing **Source Variable** at a variable that holds one Instance Id, and it follows the id as it changes;
- or pass the id to **Find By Asset**'s **Instance Id** pin, or to **Get Server Object**.

In [Guild halls](./examples/guild-halls-and-arenas.md#guild-halls), `hall_registry` seats each player in a hall with room, writes the hall's id into the player's own `player_team` object, and the hall's actor follows that id with **From Server Value**.

## Many to one

Many players, or many objects, share one Server Object.

| Relation | Settings |
|---|---|
| Many players on one shared object, such as a boss | **Readable By**: **Every Player**; a **Cooldown** and a **Value Range** on the functions players call |
| Many objects reporting to one, such as matches to a leaderboard | **Can Call** on the reporting type, listing the shared one; the shared function's **Callable By** on **Server Only** |

The [shared boss](./examples/shared-boss.md) is the first: every player hits one boss, and the **Cooldown** and **Value Range** keep each player to a fair rate and a fair hit, enforced on the server before your code runs. **Every Player** sends each change to every watcher; with **Members** or **Owner Only**, every watcher reads again after every change. See [Large groups](./access-members-and-timers.md#large-groups).

For the second, an arena match calls the leaderboard's function from its own server code, as `calls::<type>::<function>`. A call from server code is not stopped by **Callable By**, so a **Server Only** function on the leaderboard takes reports from matches and refuses players. See [Call other Server Objects](./access-members-and-timers.md#call-other-server-objects).

## Many to many

Players belong to several groups, and each group has several players.

| Relation | Settings |
|---|---|
| Players and lobbies | **Members From**: **This Object** on the lobby type, with **Max Members**; one Instance Id per lobby |
| Teams and their objects | **Members From**: **Crowdy Team** on each type a team has, all keyed by the team's id |

Each lobby keeps its own members, so a player can be a member of several lobbies at once, and each lobby takes up to its **Max Members**. Players **Join** and **Leave**, and **Is Member** and **Get Members** answer per lobby. See [This Object](./access-members-and-timers.md#this-object) and [The arena lobby](./examples/guild-halls-and-arenas.md#the-arena-lobby).

With **Crowdy Team**, the platform keeps the relation: a team can have a hall, a banner and a stash, each a type with **Members From** set to **Crowdy Team** and the team's id as its Instance Id. A player in several teams picks one with **Team Id**. See [Crowdy Team](./access-members-and-timers.md#crowdy-team).

## Good practice

**Refer by Instance Id; never copy another object's values.** A copy goes stale the moment its owner changes. The registry keeps `hall-1`, not the hall's gold; the game reads the gold from the hall.

**Give each fact one owner.** One type changes a value, and the others read it or call that type's function. Only `guild_hall` changes its `Gold` and its members; the registry seats a player by calling the hall's **Add Member**, and the hall does the seating.

**Keep calls between types few, and plan for a timeout.** Each call from server code is one more thing that can fail. The first call to an instance that is just starting can run out of time and fail with "call deadline passed", although the callee may still finish it. So call again only a function that is safe to run twice, such as **Add Member**, or make yours safe, as `Assign` is when it gives a seated player back the same hall. What the callee already changed stays changed even if your function then fails. From the game, a **Timeout** outcome means the call may or may not have taken effect; watch the values before you call again. See [Outcomes](./troubleshooting.md#outcomes).

**Keep a registry within the limits.** An Unreal client refuses a list, set or map of more than 4,096 entries, more than 65,536 entries in all the lists of one message, and a message over 1 MiB, and a change that would put one into a variable players see is not kept. See [What the generated code does for you](./write-server-logic.md#what-the-generated-code-does-for-you). A list that can grow without bound needs splitting: one registry per region or per day, each its own Instance Id, or the detail kept in the members' own objects, as each player's `player_team` holds their hall.

**Choose Readable By per object, not per relation.** Related objects need not share it. A registry readable by every player can list lobbies whose values only their members read.

**Use Only One Instance only for what is truly one per app.** It cannot be combined with **Owner Only** or **Crowdy Team**, and ticking or clearing it later changes which object players reach without moving the saved data. A registry that may one day be per region is better off with an Instance Id from the start. See [Only One Instance](./access-members-and-timers.md#only-one-instance).

## Related

- [Access, members and timers](./access-members-and-timers.md): every setting used here
- [Guild halls and arena lobbies](./examples/guild-halls-and-arenas.md): a registry, team objects and a lobby, built step by step
- [Shared boss fight](./examples/shared-boss.md): many players on one object
- [Get a Server Object, from Blueprint](./from-blueprint/get-a-server-object.md#add-the-component): the component's instance modes
- [Get a Server Object, from C++](./from-cpp/get-a-server-object.md): acquiring an object by its Instance Id
