---
slug: move-from-game-models
sidebar_position: 11
title: Move from Game Models
description: What the removal of the Game Model API takes out of a project, the steps to take before you upgrade (compile first, search for CrowdyModel, clean cook), the C++ API that is gone, which Server Object feature replaces each Game Model one, and why Server Objects are not marked on a class.
---

# Move from Game Models

:::note
Server Objects run on [ck-exec](/exec/intro). v2.18.0 added them and deprecated the Game Model API; [v2.19.0 removes it](../guides/whats-changed.md#2026-10-12-sdk-v2190).
:::

The SDK's Game Model API is removed in v2.19.0, the release after the one that adds Server Objects. It was built on a game API engine that ck-exec replaced, so it had no server to talk to. This page says what went, what to do in your project before you upgrade, what takes the place of each part, and how to move a system across. The replacement is [Server Objects](./overview.md), from Blueprint or C++.

## What was removed

- **The Game Model API.** Containers and attributes (the `CrowdyModel` and `CrowdyContainer` metadata), model functions, Crowdy Effects (the assets, the effect graph editor and the Apply Effect nodes), sessions on the Game Model subsystem, automations, signals, pre-seeding, the Game Kit, container manifests, and `UCrowdyGameModelSubsystem`. **Get Local User Id** goes with it: use **Get User ID** on the Crowdy Game Session.
- **Its settings and logging.** The `crowdy.gamemodel.*` console variables, the `LogCrowdyGameModel` log category and the `DefaultModelNotificationCarrier` setting.
- **Server Owned in the Replication dropdown.** A Blueprint variable's **Crowdy Replication** dropdown now offers only **None** and **Replicated**.
- **CrowdyMass's Game Model values.** `GetModelValue`, `GetModelTargetState`, `GetEffectTarget` and the model fields are gone. Crowd rows read Server Object values instead, from a record per entity; see [Crowd rows](./keep-a-record-per-entity.md#crowd-rows).
- **Crowdy Studio's Game Model page.** The **Features** and **Tier-feature grants** cards that were on it are on the new **Access** page, under **Project** in the Configure group.

## Upgrade steps

Do these in order.

1. **Compile and open the project on the release that adds Server Objects first.** That release still has the Game Model API, and every use of it is listed: each C++ use gets a compiler warning (C4996 on MSVC), and each Blueprint that uses Game Models gets one compiler warning listing its uses when it compiles, loads or cooks. Write the list down, and [move each system](#move-a-system) off Game Models while the nodes are still there to read.
2. **Search your C++ for `CrowdyModel`, and for `CrowdyContainer`.** A property or Blueprint variable that still carries either marker compiles and does nothing, and nothing warns you. Remove the marker, or the property if it was only a Game Model attribute.3. **Know what the upgrade drops without a message.** A Blueprint that still has **Apply Effect** nodes loses those nodes when it loads, with no error, so step 1 is the only place they are listed. Crowdy Effect, container manifest and Game Kit assets no longer load; note what they described and delete them. An old saved `DefaultModelNotificationCarrier` is ignored and can be deleted from your config.
4. **Fix the C++ that no longer compiles** (see [the removed C++ API](#the-removed-c-api)).
5. **Do a clean cook.** Do not cook iteratively over the upgrade: the baked registry's layout changed, so rebuild it and cook from scratch. See [Packaging](../guides/packaging.md).
6. **Check your channel code.** The SDK no longer drops channel payloads that begin `cmc:`, `csg:` or `gms|`, so a payload that starts that way now reaches your handler. See [Channels](../runtime/channels.md).

## The removed C++ API

- `ICrowdyEntitySubscriber::ApplyModelChanges` is gone. A class that implements the interface and marks it `override` stops compiling; delete the function.
- `UCrowdyEntitySubsystem::RegisterSubParticipant`, `RegisterSubParticipantAs` and `DeriveSubParticipantID` are gone.
- `FCrowdyModelIdentity` is gone. `FCrowdyEntityIdentity` has `StableNetIDFromActorPath` and `NetIDFromBindingKey` for the same jobs.
- `FCrowdyEntityRecord::AnchorNetID` is gone.
- `ICrowdyBindingKeyProvider` stays. Its header now lives under `Replication/Components/`, so fix an include that names the old path.

The CrowdyState layout's message for a container property now reads "use a CrowdyEvent RPC or a Server Object" where it used to name a Game Model container; see [Crowdy State](../runtime/crowdy-state.md).

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
| Authority rules (tier features, group and grid permissions) | A tier feature: [Required Feature](./access-members-and-timers.md#required-feature) on the function. Group and grid permissions: checks in the logic against the player and the world, [World and platform data](/exec/world-and-platform-data) |

In Oakford, had the beacon that a villager feeds with oil been a Game Model container, it would have had an `Oil` attribute and a `FeedBeacon` model function, guarded by an invoke policy. As a Server Object it is the `AVillageBeacon` type from [What a Server Object is](./overview.md): `Oil` is a variable players watch, and `FeedBeacon` is a Server Function that adds the oil or refuses.

## Move a system

Do this for each system on your list, while the project is still on the release that has both Game Models and Server Objects.

1. **Author each system as a Server Object type**: make the [definition asset](./create-a-type.md), set [who may read and call it](./access-members-and-timers.md), [write its logic](./write-server-logic.md) and [deploy it with Server Compute](./deploy-with-server-compute.md).
2. **Switch the call sites.** Read and follow values and call functions [from Blueprint](./from-blueprint/get-a-server-object.md) or [from C++](./from-cpp/get-a-server-object.md), and remove the Game Model nodes and calls as you go.
3. **Seed any data that must persist.** Nothing moves automatically. A one-off script writes the starting values into the new type, for example by calling a [Server Only](./create-a-type.md#callable-by) Server Function, which developer tools can call and players cannot.

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
