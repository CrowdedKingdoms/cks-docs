---
slug: intro
sidebar_position: 1
title: Crowdy Unreal SDK
---

# Crowdy Unreal SDK

The Crowdy Unreal SDK is an Unreal Engine plugin that connects your game to the Crowded Kingdoms platform. It gives you a small surface you can drive from C++ or Blueprint, with:

- Real-time networking for large numbers of players
- Voice chat
- Teams
- Avatars
- Saved progress

:::note
This guide is written for Unreal Engine 5.8 and a C++/BP project.

You can get the SDK Plugin from our GitHub repository [here](https://github.com/CrowdedKingdoms/CrowdySDK-Unreal/tree/v2_0).
:::

## How to read this guide

Work through it in order the first time:

1. [Crowdy Studio](/unreal-sdk/studio/overview): sign in and sync your app to your project.
2. [Runtime SDK](/unreal-sdk/runtime/map-profile): set up a map, spawn entities, send RPC events, and check host authority.
3. [Player Services](/unreal-sdk/services/voice-chat): voice chat, teams, avatars, and persistence.
4. [Guides](/unreal-sdk/guides/sample-project) and [Reference](/unreal-sdk/reference/subsystems): a tour of the sample project, a packaging checklist, and lookup tables.

:::tip[Do Crowdy Studio first]
Nothing on the network works until your project knows which app it belongs to. Sign in and sync your app before anything else.
:::

## Entities: the core idea

Almost everything the SDK replicates is an **entity**. An entity is any actor you want other players to see and react to: a character, a vehicle, a thrown rock, a spawned pickup.

You turn an actor into an entity by adding a `UCrowdyEntityComponent` to it.

A few ideas carry through the whole guide, so it helps to meet them once here.

### NetID: a shared name for one thing

Every entity has a `NetID`, an `FGuid` that names that one entity on every client.

When a player throws a rock, the rock has the same `NetID` on the thrower's machine and on everyone else's. That shared name is how an event aimed at "this rock" finds the right rock on each client.

How an entity gets its `NetID` is the **identity policy**:

- **Stable**: the `NetID` is hashed from the actor's place in the level. Every client computes the same value for the same level-placed actor, with no spawn message and no hand-typed seeds. Use this for things that already exist when the map loads.
- **PlayerDerived**: the `NetID` comes from the signed-in user id. Use this only for the local player's own pawn.
- **Random**: a fresh `NetID` each time. Use this for things you spawn at runtime, like a pickup or a projectile. The spawn travels to every client carrying the `NetID`, so the copies still line up.

### Owner and proxy: who is in charge

For each entity, exactly one client is the **owner**. The owner simulates the entity and sends its state and events.

On every other client the same entity exists as a **remote proxy** that receives that state and plays it back. The owner does not get a second proxy of itself; it already has the real thing.

You can ask an entity which side you are on with `IsLocallyOwned()`. Owner driven code (input, physics, decisions) runs only when you own the entity; proxies just display what arrives.

### Dynamic and static: how state moves

An entity replicates in one of two ways:

- **Dynamic**: the SDK streams a state snapshot every replication interval, around ten times a second. This is for things that change constantly, like position and animation. You provide the snapshot with a small executor object.
- **Static**: nothing streams. The entity changes only when you send it an event. This is for things that change in steps, like a door opening or an object being moved once.

Individual properties can also replicate on their own, with no executor and no snapshot struct: mark a `UPROPERTY` and the owning client sends just that value when it changes. This is [Crowdy State](/unreal-sdk/runtime/crowdy-state), and it works on either kind of entity.

### RPC events: calling a function across the network

You make things happen on other clients by sending a **CrowdyEvent**, an RPC. You mark a function, call it like a normal function, and the SDK runs the matching function on the other clients.

An event is aimed at an entity by its `NetID`, and you choose who receives it:

- Everyone nearby
- Everyone on a channel
- Just the entity's owner
- Just the host

### The host is a convention

One client is elected as the **host**. The host is the natural place to run shared, world level logic, like spawning world objects that belong to nobody in particular.

You check whether you are the host with a single call before doing host work.

:::caution
The host is a convention the SDK helps you follow, not a server that enforces rules.
:::

## What is next

Start with [Crowdy Studio](/unreal-sdk/studio/overview) to connect your app, then move on to [Installation](/unreal-sdk/installation) if you have not added the plugin yet.

The [sample project](/unreal-sdk/guides/sample-project) puts all of this together as small, interaction-driven examples you can read alongside the guide.
