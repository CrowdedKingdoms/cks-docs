---
slug: overview
sidebar_position: 1
title: Crowdy Studio Overview
description: What Crowdy Studio is, when to use it, and the pages in its nav rail.
---

# Crowdy Studio Overview

Crowdy Studio is the management console for your app, and it runs inside the Unreal Editor as a dockable tab. You use it to point your project at an app, and to author the server-side pieces your runtime reads: teams, channels, grids, and the Game Model schema.

Use it when you:

- Start a project: sign in, pick the app, and write its ids and endpoints into the project with Config Sync.
- Author server-side data ahead of play: teams, channels, grids, the Game Model schema.
- Debug: watch a running Play in Editor session in the Inspector, or check the baked registry.

:::tip[Start here before you write any runtime code.]
Most setup mistakes come from a project pointed at the wrong app, or one that never ran Config Sync. Both are fixed on the Project page.
:::

## Open Crowdy Studio

Two ways:

- The Tools menu: **Tools, Crowdy SDK, Crowdy Studio**.
- The **Crowded Kingdoms** wordmark button on the level editor toolbar, next to Play.

The tab is called **Crowdy Studio**. Dock it anywhere, or float it on a second monitor, and it reopens from your saved layout.

![The Home page of Crowdy Studio: account, organization, active app, and project sync status cards](/img/unreal-sdk/studio-home.png)

## Editor-only, one-way

Crowdy Studio is an editor module and never ships in a packaged build. It writes settings and server data; the runtime reads those on its own and never talks to Studio.

:::info[Studio is editor-only and has no runtime API.]
Studio writes three things into your project: the connection settings in `DefaultGame.ini` (Config Sync and the Connection tab), the baked registry asset under `Content/CrowdySDK` (the Registry page), and a per-user session file under `Saved/`. Your game reads the settings and the registry at startup. Everything else Studio authors lives on the server.
:::

## Native pages and the Web Console

Studio has two surfaces.

**Native pages** are Slate UI built into the editor. They cover the work you do while building: choosing an app, syncing config, authoring teams, channels, grids and models, and reading live state.

**The Web Console** is an embedded browser for account and organization administration: members, billing, tokens, secrets. It signs you in with the session you already have in Studio. The nav rail's bottom button opens it on your organization's overview.

## The nav rail

The rail on the left lists the pages. A toggle at the top folds it to icons (hover an icon for its label) and remembers your choice.

| Page | Group | Needs sign-in | What it is for |
|---|---|---|---|
| **Setup Wizard** | | No | The guided first run: sign in, pick an app, sync. Studio lands here after you sign in. |
| **Home** | | Yes | Status cards: account, organization, active app, project sync. |
| **Project** | CONFIGURE | Yes | Pick the app, create one, and run [Config Sync](./config-sync.md). See [Projects and Apps](./projects-and-apps.md). |
| **Teams** | AUTHORING | Yes | Author teams, members, roles, and the team policy. See [Teams and Channels](./teams-and-channels.md). |
| **Channels** | AUTHORING | Yes | Author named channels and the session channel. |
| **Grid** | AUTHORING | Yes | Author spatial permission regions. See [Grids](./grids.md). |
| **Game Model** | AUTHORING | Yes | Browse, sync, and clean up the server-owned schema. See [Game Models authoring](./game-models-authoring.md). |
| **Inspector** | DEBUG | No | A read-only view of a running Play in Editor session. See [Inspector and Registry](./inspector-and-registry.md). |
| **Registry** | DEBUG | No | The baked metadata that ships in packaged builds, and the button that rebuilds it. |
| **Web Console** | | Yes | Pinned at the bottom: opens the browser console for admin surfaces. |

The Effect Graph is not a Studio page. It is an asset editor that opens when you double-click a Crowdy Effect asset in the Content Browser. See [Effect Graph](./effect-graph.md).

## Signing in

Sign in with your account: email and password, a sign-in link sent by email, or a social provider. That gives you full authoring. An organization token gives management-only access: it can browse apps and run Config Sync, but not author teams, channels, grids or models. See [Signing In](./sign-in.md).

:::caution[If an authoring page looks read-only, check which credential you signed in with.]
Token sign-in is the usual cause.
:::

## Where to go next

- New project: [sign in](./sign-in.md), then [pick your app](./projects-and-apps.md) and run [Config Sync](./config-sync.md).
- Building gameplay: [Entities and Spawning](../runtime/entities-and-spawning.md).
- Shipping a build: [Packaging](../guides/packaging.md), and rebuild the [registry](./inspector-and-registry.md) first.
