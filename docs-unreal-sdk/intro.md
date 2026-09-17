---
slug: intro
sidebar_position: 1
title: Crowdy Unreal SDK
description: What the Crowdy Unreal SDK is, the two planes of state it is built on, and how to read the rest of this guide.
---

# Crowdy Unreal SDK

The Crowdy Unreal SDK is an Unreal Engine plugin that connects your game to the Crowded Kingdoms platform. It gives you a small surface you can drive from C++ or Blueprint: real-time networking for large numbers of players, server-owned gameplay state, voice chat, teams, channels, and avatars.

This guide describes **SDK 2.14**. Open `Plugins/CrowdySDK/CrowdySDK.uplugin` and check `VersionName` before you rely on a feature described here.

:::note[This guide is written for Unreal Engine 5.8 and a C++ project.]
Gameplay can be driven entirely from Blueprint, but the plugin itself compiles as C++, so your project needs a C++ target. See [Installation](./installation.md).
:::

## The two planes

Everything the SDK replicates lives on one of two planes, and the whole guide leans on the split.

1. **The view plane (CrowdyState).** Fast, client-owned state such as movement, animation, and transient effects. The client that owns an entity writes its state and everyone else sees it. Nothing here is checked by a server.
2. **The elected host is a convention.** One client is elected host to coordinate the view plane. It is a helper for shared logic, not a rule enforcer.
3. **The truth plane (Game Models).** Server-owned gameplay state such as hit points, stats, and inventory. Clients ask the server for it and ask the server to change it; the server decides. This is the only place a rule is enforced.
4. **The planes touch in one way.** When the server changes truth, a small notification rides the view plane saying "re-read me". No gameplay value ever flows from the view plane into the truth plane as trusted input.

Read [The Two Planes](./concepts/two-planes.md) before you decide where a new piece of state belongs.

:::caution[The host is a convention the SDK helps you follow, not a server that enforces rules.]
:::

## Entities

Almost everything on the view plane is an **entity**: an actor with a `UCrowdyEntityComponent` that has a shared identity (`NetID`) on every client, one owner, and a remote proxy everywhere else. Events (RPC calls) are aimed at entities, and replicated properties belong to them. [Entities, Identity, and Ownership](./concepts/entities-identity-ownership.md) covers the details.

## How to read this guide

Work through it in order the first time.

1. **Start**: [Installation](./installation.md) and the [Quickstart](./quickstart.md).
2. **Concepts**: [The Two Planes](./concepts/two-planes.md), [Entities, Identity, and Ownership](./concepts/entities-identity-ownership.md), [Sessions and Presence](./concepts/sessions-and-presence.md), [The Host Is a Convention](./concepts/host-is-a-convention.md).
3. **Crowdy Studio**: [sign in and connect your app](./studio/overview.md) from inside the editor.
4. **Runtime (view plane)**: [map profiles](./runtime/map-profile.md), entities, RPC events, Crowdy State.
5. **Game Models (truth plane)**: [server-owned state, effects, and policies](./game-models/overview.md).
6. **Services**: [voice chat](./services/voice-chat.md), [teams](./services/teams.md), [avatars](./services/avatars.md).
7. **Guides** and **Reference**: [best practices](./guides/best-practices.md), the [sample project](./guides/sample-project.md), [packaging](./guides/packaging.md), and lookup tables such as [console variables](./reference/console-cvars.md).

:::tip[Do Crowdy Studio first]
Nothing on the network works until your project knows which app it belongs to. Sign in and run [Config Sync](./studio/config-sync.md) before anything else.
:::

## What is next

Add the plugin with [Installation](./installation.md), connect your app in [Crowdy Studio](./studio/overview.md), then follow the [Quickstart](./quickstart.md) to put one entity, one event, one replicated property, and one server-owned value on screen.
