---
slug: move-from-game-models
sidebar_position: 11
title: Move from Game Models
description: What the Game Model deprecation does to a project (C++ warnings, one Blueprint warning per asset, calls that fail at once, Crowdy Studio and CrowdyMass), which Server Object feature replaces each Game Model one, the steps to move a system, and why Server Objects are not marked on a class.
---

# Move from Game Models

:::note
Server Objects run on [ck-exec](/exec/intro). The tagged v2.17.0 plugin does not have them or the deprecation below; see [What's Changed](../guides/whats-changed.md#unreleased-after-v2170).
:::

The SDK's Game Model API is deprecated and does nothing, and a later release removes it. It was built on a game API engine that ck-exec replaced, so it has no server to talk to. This page says what you will see in your project, what takes the place of each part, and how to move a system across. The replacement is [Server Objects](./overview.md), from Blueprint or C++.

## What happens to your project

The deprecation covers Game Model containers and attributes (the `CrowdyModel` and `CrowdyContainer` markers and container tags), model functions and Invoke Model Function, Crowdy Effects and the Apply Effect nodes, invoke policies, sessions and turns, collections, container manifests and pre-seeding, the Game Kits, automations and signals, **Listen for Model Changes**, `UCrowdyGameModelSubsystem`, and the libraries `UCrowdyModel`, `UCrowdyGameModel`, `UCrowdyModelValue` and `UCrowdyEffects`.

- **Every call fails at once, once.** An async node fires its **Failed** pin immediately with "Game Models are deprecated and no longer available; use Server Compute." (code `GAME_MODEL_DEPRECATED`); **Listen for Model Changes** never fires. Nothing is sent to a server, waited for or retried. Reads return their defaults (**Get Local User Id** still answers). The SDK logs the deprecation once per run.
- **C++ warns at each use.** The classes and functions are marked deprecated, so the compiler warns (C4996 on MSVC) wherever your code names one. They are warnings only; nothing fails the build unless your project treats warnings as errors.
- **Blueprint warns per Blueprint.** The Game Model library functions and the subsystem's events show the engine's deprecation warning. On top of that, each Blueprint that uses Game Models gets one compiler warning that lists its uses (the first 12, then how many more): `[CrowdySDK] This Blueprint uses Game Models, which are deprecated and no longer available; move it to a Server Object (Server Compute). Uses: ...`. It appears when the Blueprint compiles, loads or cooks. Assets still load, save and cook, so you can open each one and see what it used.
- **A Failed pin wired back into the same node used to retry once a frame.** The failure is now immediate, so with no **Delay** that loop calls itself straight away, with no frame in between, and can hang or crash the game. Add a **Delay** or remove the loop.
- **Deprecated functions leave the context menu.** The deprecated library functions are no longer offered when you search a graph, and the editor silently drops a deprecated call node when you paste or duplicate it. To copy old nodes, turn on **Expose Deprecated Functions** in Editor Preferences (search the window for it). The async Game Model nodes and the Apply Effect nodes are still listed; the per-Blueprint warning is what flags them.
- **Get Local User Id**: use **Get User ID** on the Crowdy Game Session instead.
- **Crowdy Studio.** The Game Model page shows a deprecation banner and no longer loads its lists. Schema sync, pre-seeding, purge and Game Kit deploy refuse with the same message as above. The tier-features panel on that page keeps working. In a Crowdy Effect asset's editor, the sync status in the toolbar reads "Deprecated".
- **CrowdyMass.** Game Model values no longer land on crowd entities: **Get Crowdy Mass Model Value** answers "no fragment" and **Bind Entity Model Containers** binds nothing and returns 0. Landing Server Object values on crowd entities is planned for a later release.
- **A subsystem tagged as a Game Model container** is no longer registered as an entity participant by the Game Model system.

## What takes the place of each part

| Game Models | Server Objects |
|---|---|
| A container type | A Server Object definition asset: [Create a Server Object type](./create-a-type.md) |
| Container attributes (`CrowdyModel`) | The state struct's variables. What players may read is the values that are **Visible to Players**, the ones they watch: [Create a Server Object type](./create-a-type.md#the-details-tab) |
| Model functions and Effects | Server Functions, written in the type's `logic.rs`: [Write its server logic](./write-server-logic.md) |
| Invoke policies | **Callable By** and **Readable By** on the asset, and checks in the logic: [Access, members and timers](./access-members-and-timers.md#access) |
| A match session | One Server Object per match, with the match id as its Instance Id: [Relate Server Objects to each other](./relate-server-objects.md) |
| Change pings, **Listen for Model Changes**, OnRep on model attributes | Following the watched variables, from [Blueprint](./from-blueprint/read-and-follow-variables.md) or [C++](./from-cpp/read-and-follow-variables.md) |
| Automations: interval schedules | The type's timers: [Timers and events](./access-members-and-timers.md#timers-and-events) |
| Automations: cron schedules | No setting on the asset for now; the platform's [Cron schedules](/exec/timers-and-presence#cron-schedules) |
| `player_joined`, `player_left`, `player_count_changed` triggers | **On Player Joined** and **On Player Left** on the type, and presence on the server: [Presence](/exec/timers-and-presence#presence) |
| Authority rules (tier features, group and grid permissions) | Checks in the logic against the player and the world: [World and platform data](/exec/world-and-platform-data) |

In Oakford, had the beacon that a villager feeds with oil been a Game Model container, it would have had an `Oil` attribute and a `FeedBeacon` model function, guarded by an invoke policy. As a Server Object it is the `AVillageBeacon` type from [What a Server Object is](./overview.md): `Oil` is a variable players watch, and `FeedBeacon` is a Server Function that adds the oil or refuses.

## The steps

1. **Take this release and read the warnings.** Together, the C++ warnings, the engine's deprecation warnings and the one per Blueprint name the uses of Game Models in your project.
2. **Author each system as a Server Object type**: make the [definition asset](./create-a-type.md), set [who may read and call it](./access-members-and-timers.md), [write its logic](./write-server-logic.md) and [deploy it with Server Compute](./deploy-with-server-compute.md).
3. **Switch the call sites.** Read and follow values and call functions [from Blueprint](./from-blueprint/get-a-server-object.md) or [from C++](./from-cpp/get-a-server-object.md), and remove the Game Model nodes and calls as you go.
4. **Seed any data that must persist.** Nothing moves automatically. A one-off script writes the starting values into the new type, for example by calling a [Server Only](./create-a-type.md#callable-by) Server Function, which developer tools can call and players cannot.

Server Objects need ck-exec on your app's environment, so a project can finish moving once its environment has it.

## Why Server Objects are not marked on the class

Game Models were declared by markers on your own classes. Server Objects are declared in one asset, on purpose:

- **The truth is the server code.** A property on an actor that looks writable is only a request to the server. Keeping the state in the server code makes that plain.
- **A Server Object is not an actor.** It is picked by an Instance Id, exists before any actor does and outlives them, and many actors can share one.
- **One versioned contract.** The asset is the single place the type is described, so compiling a Blueprint can never silently change what the server expects.
- **Marker metadata is stripped when a game is cooked,** so a property marker is not something a packaged game can read back.
- **A call answers or refuses plainly,** with an outcome and a reason, which an OnRep on an attribute cannot.

## Related

- [What a Server Object is](./overview.md)
- [From the legacy engines](/exec/from-the-legacy-engines): the platform's full mapping from game models and automations to ck-exec
- [Port a compute module](/exec/port-a-compute-module): a worked port to a hub
- [Unreal and ck-exec names](./unreal-and-ck-exec-names.md): the SDK's words next to the platform's
- [Troubleshooting](./troubleshooting.md): outcomes and refusals
