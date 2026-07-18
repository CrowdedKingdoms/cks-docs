---
slug: grids
sidebar_position: 4
title: Grids
---

# Grids

Grids divide your world into named regions. You author them in Crowdy Studio, on the Grid page.

A grid carries a permission whitelist and group grants that decide who is allowed to act inside that region.

This page covers how to:

- Define a grid
- View nearby grids
- Edit its permissions

## Admin-plane only

Grids are part of the management plane, not the game plane.

- Every grid operation requires the `manage_apps` permission.
- There is no player-scoped grid query: game code cannot list or read grids at runtime.
- Runtime permission is server-enforced. When a client tries to act inside a region, the server checks the grid's whitelist and group grants, then either allows or rejects the action.
- The client never receives the grid definition itself.

:::warning
Do not try to drive grid operations from gameplay code.

If you sign in to Crowdy Studio with an organization token, you can manage grids, but token sign-in cannot do game-plane authoring such as teams and channels. Use passwordless account sign-in (magic link or social) for full authoring.
:::

## Open the Grid page

Open Crowdy Studio from Tools, Crowdy SDK, Crowdy Studio, or the Crowded Kingdoms toolbar button.

Sign in, select your app on the Project page, then open the Grid page.

{/* TODO: replace with real screenshot */}
![Crowdy Studio Grid page showing a grid definition and its permission list](/img/unreal-sdk/studio-grids-page.png)

## Define a grid

You can define a grid two ways.

- **By corner coordinates:** enter the corner coordinates of the region directly. Use this when you know the exact bounds you want, for example a region that lines up with a named area in your level.
- **From the editor selection:** select an actor or a volume in the level viewport, then create the grid from that selection. Studio reads the bounds of the selection and fills in the corner coordinates for you. Use this when it is easier to place a marker in the world than to type numbers.

After you set the bounds, give the grid a name and save it.

## View nearby grids

The Grid page lists the grids that already exist for the app. Use this view to:

- Check the bounds of an existing region before you add a new one.
- Avoid overlapping regions that you did not intend.

## Edit the permission whitelist

Each grid has a permission whitelist. The whitelist controls who is allowed to act inside the region.

Open a grid from the list, edit its whitelist, then save.

## Edit group grants

A grid can also grant permission to a group rather than to individuals. Group grants tie a region's permissions to team membership, so a player who belongs to the granted group is allowed to act inside the region without being listed individually.

Edit group grants on the same grid panel as the whitelist, then save.

:::note
Teams themselves are authored on the Teams page. See [Teams](/unreal-sdk/studio/teams-and-channels).
:::

## Related pages

- [Crowdy Studio overview](/unreal-sdk/studio/overview)
- [Teams](/unreal-sdk/studio/teams-and-channels)
- [Channels](/unreal-sdk/studio/teams-and-channels)
