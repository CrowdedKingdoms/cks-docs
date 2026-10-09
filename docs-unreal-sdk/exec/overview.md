---
slug: overview
sidebar_position: 1
title: What a Server Object is
description: What a Server Object is, what it gives a game (server-owned values every player sees change, and functions only the server can carry out), how its parts fit, and what you need before you use one.
---

# What a Server Object is

:::note
Server Objects run on [ck-exec](/exec/intro). You can use them from Blueprint or from C++; see [From Blueprint](./from-blueprint/get-a-server-object.md) and [From C++](./from-cpp/get-a-server-object.md).
:::

A Server Object is a piece of game state that lives on the server and that every player sees the same way. The server keeps its values, saves them, and is the only thing that changes them. Your game reads the values it is allowed to see, is told each time they change, and asks for a change by calling one of its **Server Functions**. The server decides, and every player watching sees the result.

That makes a Server Object the place for state a player could gain by lying about: a boss's health, a shared stockpile, a match's score, a player's inventory. It is the SDK's door into the [truth plane](../concepts/two-planes.md). Fast view state (movement, animation, a light flickering) stays on the view plane, in [Crowdy State](../runtime/crowdy-state.md).

## In the example world

The village square has a beacon every villager feeds with oil. How much oil it holds is the kind of value a client must not decide for itself, so it is a Server Object: one per village. When a player walks into the beacon, the game calls the beacon's `FeedBeacon` Server Function; the server adds the oil (or refuses), and every player in the village sees the beacon's light change with the new amount. The pages in this section build that beacon, `AVillageBeacon`, one piece at a time.

## How the parts fit

- **A definition asset** (`UCrowdyServerObjectDefinition`) describes one type of Server Object: the variables the server keeps, which of them players may see, and the functions they may call. You make one asset per type, in an editor laid out like the Blueprint editor. See [Create a Server Object type](./create-a-type.md).
- **Access, members and timers** are settings on the asset that the server enforces before your code runs: who may read and call, how often, members and a leader, timers, and calling other types. See [Access, members and timers](./access-members-and-timers.md), and [Relate Server Objects to each other](./relate-server-objects.md) for which to use when one object belongs to a player, lists others or is shared by many.
- **The server code** is a Rust crate the editor generates from the definition asset; you fill in what each Server Function does. See [Write its server logic](./write-server-logic.md), then [Deploy it with Server Compute](./deploy-with-server-compute.md).
- **An Instance Id** picks one Server Object of that type. The beacon uses the village's name, so each village has its own.
- **From Blueprint**, the **Crowdy Server Object** component and the typed nodes get the object, read and follow its variables and call its functions. See [Get a Server Object](./from-blueprint/get-a-server-object.md), [Read and follow its variables](./from-blueprint/read-and-follow-variables.md), [Call its functions](./from-blueprint/call-functions.md) and [Pins for every type](./from-blueprint/pins-for-every-type.md).
- **From C++**, `UCrowdyServerObjectSubsystem`, a game instance subsystem, hands out Server Objects. Every actor or object that acquires the same definition and Instance Id shares one `UCrowdyServerObject`, and the subsystem gives it back a short while after the last of them is gone. The variables players can see arrive in a copy of the state struct and raise one change event per server change, and Server Functions are called with a params struct and answer with a reply struct or an outcome that says what went wrong. See [Get a Server Object](./from-cpp/get-a-server-object.md), [Read and follow its variables](./from-cpp/read-and-follow-variables.md) and [Call its functions](./from-cpp/call-functions.md).

The platform has its own words for all of this (hubs, keys, methods, topics). You do not need them to use the SDK, but the platform's pages and logs use them; [Unreal and ck-exec names](./unreal-and-ck-exec-names.md) maps one to the other.

## What you need

1. **Your app on the Dev backend.** Server Objects connect with the signed-in player's app token, like the rest of the runtime. See [Player sign-in](../runtime/player-sign-in.md).
2. **The module dependency, for C++.** Blueprint needs none. Add `CrowdyExec` to your game module's `Build.cs`, next to the modules from [Installation](../installation.md#step-4-add-the-module-dependencies):

   ```csharp
   PrivateDependencyModuleNames.Add("CrowdyExec");
   ```

3. **A definition asset per type**, described on [Create a Server Object type](./create-a-type.md).
4. **The type's server code, deployed to your app on ck-exec.** The editor generates it from the definition asset, so the server and your game agree on every name and field, and you write only what each Server Function does. The Server Compute page in Crowdy Studio sends it to your app. See [Deploy it with Server Compute](./deploy-with-server-compute.md).

## What is next

Describe the beacon's state and functions in [Create a Server Object type](./create-a-type.md), set who may do what in [Access, members and timers](./access-members-and-timers.md), see how types relate in [Relate Server Objects to each other](./relate-server-objects.md), write what its functions do in [Write its server logic](./write-server-logic.md), and [deploy it](./deploy-with-server-compute.md). Then use it [from Blueprint](./from-blueprint/get-a-server-object.md) or [from C++](./from-cpp/get-a-server-object.md). When something does not behave, [Troubleshooting](./troubleshooting.md) has the checks, and [Unreal and ck-exec names](./unreal-and-ck-exec-names.md) maps the SDK's words to the platform's.

If your project uses the SDK's Game Models, which are deprecated, [Move from Game Models](./move-from-game-models.md) says what you will see and what to use instead.

The worked examples, a tip jar, guild halls and an arena, and a boss every player hits, are together under [Examples](./examples/tip-jar.md).
