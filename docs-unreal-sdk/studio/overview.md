---
slug: overview
sidebar_position: 1
title: Crowdy Studio Overview
---

# Crowdy Studio Overview

Crowdy Studio is the management plane for the Crowded Kingdoms SDK. It runs inside the Unreal Editor as a dockable tab.

Use it to:

- Pick the app your project talks to.
- Write the backend URLs into your project settings.
- Author the game-plane data your runtime reads (teams, channels, grids, game models).
- Inspect live state during Play in Editor.

:::tip
Start here before you write any runtime code. Most setup mistakes come from a project pointed at the wrong app, or one that never ran Config Sync. Both are fixed in this tab.
:::

## Open Crowdy Studio

You can open the tab three ways:

- The Tools menu: Tools, Crowdy SDK, Crowdy Studio.
- The Crowded Kingdoms toolbar button.
- Dock the tab anywhere in the editor and reopen it from your saved layout.

It is a normal editor tab, so you can dock it next to the World Outliner or float it on a second monitor.

{/* TODO: replace with real screenshot */}
![Crowdy Studio tab docked in the Unreal Editor](/img/unreal-sdk/studio-tab-docked.png)

## Native pages and the Web Console

Crowdy Studio has two surfaces.

**Native pages** are built into the editor. They cover the work you do while building the project: selecting an app, syncing config, authoring teams and channels, and reading live state. These pages talk to the game API directly.

**The Web Console** is an embedded browser. Click the Web Console button and Crowdy Studio opens an authenticated browser view for admin surfaces: members, billing, tokens, and secrets.

It uses single sign-on from your editor session, so you do not sign in again. Use it for account and organization administration that does not belong in the editor itself.

## Signing in

You sign in with one of two credential types, and they grant different access.

- **A session sign-in** -- email + password, a social provider, a magic link, or (dev servers only) the
  dev bypass -- gives you full authoring: teams, channels, grids, game models, Config Sync, and the Web
  Console. All four converge on the same result: an identity session token capable of minting the
  app-scoped tokens authoring needs.
- **An organization token** gives you management-only access. Token sign-in cannot author game-plane data such as teams and channels. Use it when you only need to browse apps, sync config, or reach admin surfaces.

:::caution
If a game-plane authoring page looks read-only, check which credential you signed in with. Token sign-in is the usual cause.
:::

### The sign-in page

The sign-in page's layout reflects the order it recommends:

- **Federated provider buttons** ("Continue with Google", etc.) at the top, shown only when the backend
  has at least one provider enabled.
- An **"or continue with email"** divider.
- **Email + password** -- the standard "Log In" button.
- **"Email me a sign-in link"** -- magic-link sign-in, reusing the email field above.
- A muted **"Dev sign-in (dev servers only)"** button, for servers running `DEV_AUTH_BYPASS`.
- The **organization token** field, tucked behind a "Use an organization token instead" toggle at the
  bottom, since it is the management-only option.

Two things that trip people up the first time:

- **"Continue with Mock"** is a server-exposed test-only OAuth provider, present only when the backend
  runs with `DEV_AUTH_BYPASS`. It lets you exercise the full browser sign-in flow (system browser,
  redirect, consent) without a real account or provider credentials. It never appears on a production
  backend.
- **"Email me a sign-in link" can sign you in instantly with no email sent** -- but only against a dev
  backend. There, the server returns a token that skips the email round-trip entirely. Against a
  production backend it behaves as expected: it emails a one-time link and waits for you to click it.

:::note
Grids are admin-plane only. Every grid operation requires the `manage_apps` permission, and there is no player-scoped grid query. Grid authoring lives in Crowdy Studio, not in game code.
:::

## The pages

The native side is a set of pages, and each one has its own doc.

- **Setup Wizard.** First-run walkthrough that points your project at an app and runs the initial Config Sync.
- **Home.** Landing page with your current app and environment at a glance.
- **Project.** App selection, the backend selector for Dev, Production, or Custom, and Config Sync.
- **Teams.** Author teams and permissions that your runtime joins and queries. See [Teams](/unreal-sdk/services/teams).
- **Channels.** Author named channels for `Multicast` events and raw channel messages. See [Channels](/unreal-sdk/runtime/channels).
- **Grid.** Admin-plane grid authoring. Requires `manage_apps`.
- **Game Model.** Author the server-authoritative model schema your runtime reads.
- **Inspector.** Read-only live state during Play in Editor.
- **Registry.** View baked metadata and rebuild it with the Rebuild button. See [Packaging](/unreal-sdk/guides/packaging).

## Config Sync

Config Sync is the page you return to most. It writes the selected app's AppID, OrgId, and game API URLs into your project settings.

Before it writes, it shows a before-and-after diff so you can see exactly what changes. Press Sync to Project to apply.

:::tip
The change applies to a running Play in Editor session without a restart, so you can switch apps and test against the new backend immediately.
:::

{/* TODO: replace with real screenshot */}
![Config Sync diff with the Sync to Project button](/img/unreal-sdk/studio-config-sync-diff.png)

:::warning
Every playable map still needs a `UCrowdyMapProfile`. Config Sync points the project at an app, but with no map profile the entity subsystem, auto replicator, and actor manager do nothing on that map, and replication looks dead. See [Map Profiles](/unreal-sdk/runtime/map-profile).
:::

## Where to go next

- New project: run the Setup Wizard, then Config Sync.
- Building gameplay: read [Entities and Spawning](/unreal-sdk/runtime/entities-and-spawning).
- Shipping a build: read [Packaging](/unreal-sdk/guides/packaging) and rebuild the registry first.
