---
slug: teams-and-channels
sidebar_position: 3
title: Authoring Teams and Channels
---

# Authoring Teams and Channels

This page covers authoring teams and channels in Crowdy Studio, the editor management plane.

Authoring means you define the teams and channels that exist in your app. You:

- Create them.
- Set their members and roles.
- Pick a policy.

Crowdy Studio is one way to do this. The same create, update, delete, role, and policy operations are also available at runtime from game code, through `UCrowdyTeams` and `UCrowdyChannels`.

- Use Studio when you want to set things up ahead of time or do admin work in the editor.
- Use the runtime APIs when your game creates teams or channels on the fly. The runtime side is covered on the [Teams](/unreal-sdk/services/teams) and [Channels](/unreal-sdk/runtime/channels) pages.

The Studio pages themselves are editor-only native UI, not Blueprint nodes. What you author here is the same data the runtime reads and writes.

:::note
Authoring teams and channels is game-plane work, so it needs a full sign-in. Sign in with your account (email + password, magic link, or social). Token sign-in gives management-only access and cannot author teams or channels.
:::

## Open Crowdy Studio

Open Crowdy Studio from one of these:

- Tools, Crowdy SDK, Crowdy Studio
- The Crowded Kingdoms toolbar button

Crowdy Studio opens as a dockable editor tab. Sign in, then pick the Teams or Channels page from the navigation.

## Authoring teams

Open the Teams page. It lists the teams that already exist in the selected app and lets you create new ones.


![Crowdy Studio Teams page showing the team list and a detail panel](/img/unreal-sdk/studio-teams-page.png)

### Create a team

1. On the Teams page, start a new team.
2. Give the team a name.
3. Set its policy. The policy controls how players are allowed to enter the team at runtime.
4. Save. The new team appears in the list.

### Open a team detail view

Select a team in the list to open its detail view.

The detail view is where you manage everything about a single team: its members, their roles, and its policy.

### Manage members and roles

In a team's detail view you can:

- Add a member to the team.
- Remove a member from the team.
- Set a member's role. Roles carry the permissions that the runtime checks. At game time your code reads those permissions through `HasPermissionInTeam`.

:::note
Roles and permissions you set here are the same ones the runtime cache reports. When gameplay code calls `IsPlayerInTeam` or `HasPermissionInTeam`, it is reading the membership and roles you authored on this page.
:::

### Set the team policy

Set the policy from the team detail view.

The policy is part of the team's definition, so saving it here is what makes it apply to runtime joins. Runtime join attempts go through `UCrowdyTeams::JoinTeam`, and the server applies the policy you set.

## Authoring channels

Open the Channels page. It lists the channels in the selected app and lets you create new ones.

{/* TODO: replace with real screenshot */}
![Crowdy Studio Channels page showing the channel list and member management](/img/unreal-sdk/studio-channels-page.png)

### Create a channel

1. On the Channels page, start a new channel.
2. Name the channel. This name is what your code references later.
3. Set its policy.
4. Save. The channel appears in the list.

:::caution
A channel name authored here is the same name you put in the `CrowdyChannel` meta on a Multicast `CrowdyEvent`, and the same name a raw channel publish targets. Keep the names stable once gameplay code references them.
:::

### Open a channel detail view

Select a channel in the list to open its detail view. From there you manage members, roles, and the channel policy, the same way you do for a team.

### Manage members and roles

In a channel's detail view you can:

- Add or remove members.
- Set member roles.
- Set the channel policy.

### One-click session channel

The SDK joins a default session channel at runtime, named `__crowdy_session_<appId>`. You do not have to create it by hand.

The Channels page offers a one-click action to create the session channel for the selected app, so you can author its membership and policy like any other channel.

:::tip
Create the session channel once per app from the Channels page. After that it behaves like any other channel you author here, and the runtime joins it automatically on UDP connect.
:::

## Studio versus runtime

The Studio pages give you an editor UI for teams and channels. The UI itself does not run during play, so joining, querying membership, and sending messages happen in your game module.

Runtime creation and management live there too:

- Teams: `UCrowdyTeams`, on the [Teams](/unreal-sdk/services/teams) page.
- Channels: Multicast `CrowdyEvent` over a named channel, raw `UCrowdyChannels` publishes, and channel management, on the [Channels](/unreal-sdk/runtime/channels) page.

You can author a team or channel in Studio ahead of time, or create it at runtime from game code. Either way the definition is the same, and both sides read and write it.

## Related pages

- Runtime [Teams](/unreal-sdk/services/teams): join, query, and read membership from the cache.
- [Channels](/unreal-sdk/runtime/channels): send channel messages and receive them at game time.
