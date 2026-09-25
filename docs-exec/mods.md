---
sidebar_position: 8
title: Mods (players' code)
---

# Mods: players' code on their grids

:::caution Dev-tier preview
Available on the **dev** environment only; see the [overview](intro).
:::

A mod is a player's code on a grid they own. It runs as a hub like any other, addressed by the
node type `mod:<name>` and keyed by the grid's id, so each grid has one instance of each of its
mods. Players standing in the grid call it by name. Mods replace server-side player code
(`playerComputeDeploy`) and player automations: a mod's timers do what automations did.

A mod runs in its owner's own sandbox, never beside the app's code or another player's mods.
It can read and change only its own grid, and nothing at all once its owner no longer owns
that grid.

## Who may do what

These are the same checks as for server-side player code:

| To | You need |
|---|---|
| Build a mod (`execModBuild`) | `write_server_code` in the app (your access tier) |
| Deploy, install, publish or delete a mod | to own the grid, and `write_server_code` on both your access tier and the grid |
| Switch a mod on or off | to own the grid, and `run_server_code` on both your access tier and the grid |

Switching a mod on also needs the app's code admission: under an allow list, the developers
must admit the mod, its marketplace listing or its owner. Neither the default access tier nor
the open-by-default world grid grants the code permissions; the app's developers grant them.

## Build, deploy and switch on

Start from the mod starter, a `ckx-sdk` crate that greets visitors and follows what happens
in its grid:

```graphql
query { execModStarter(appId: "…") { crate files { path content } } }

mutation { execModBuild(appId: "…", crate: { name: "greeter", files: [ … ] }) { buildId status } }
query { execModBuildStatus(appId: "…", buildId: "…") { status log } }

mutation { execModDeploy(appId: "…", gridId: "…", name: "greeter", buildId: "…") { version enabled } }
mutation { execModSetEnabled(appId: "…", gridId: "…", name: "greeter", enabled: true) { enabled blocked } }
```

A build is the same sandboxed build as `execBuild`, with one crate; you have one build at a
time, and only you can read it. A new mod starts switched off. Deploying a new version of a
running mod restarts it on that version. A mod's name is 1 to 48 lowercase letters, digits,
`-` or `_`; a grid holds at most 8 mods and a player at most 64.

From CrowdyJS, `client.exec` has the same calls (`modStarter`, `modBuild`, `waitForModBuild`,
`modDeploy`, `modSetEnabled`, and the rest below). In Crowdy Studio, the embed's
`serverEngine: 'ck-exec'` runs a project's SERVER target as a mod on the grid.

## Call a mod from your game

```ts
const exec = await client.exec.connect(appId);
const hello = await exec.call(execModType('greeter'), gridId, 'visit');
```

A mod runs as its owner. It answers `Denied` while it is off or switched off, and `NotFound`
once it is deleted.

## What a mod can do

A mod is a hub with the platform's mod limits: 32 MiB of memory, 20 million fuel and 2 seconds
a call, 20 calls a second, and a module of at most 4 MiB.

- **Its grid, through the node API**: `world.chunk`, `world.voxels`, `world.actors` and
  `world.actors_radius` inside the grid's bounds; `world.set_voxels` inside them while its
  owner holds `update_voxel_data` on the grid; and `grids.get` and `grids.check_permission`
  for its own grid. It has no player data and no permission grants.
- **What happens in its grid**: `Hub::on_world` receives the grid's world events in batches:
  actors moving into or out of a chunk (`actors`) and voxel changes (`voxels`), each with its
  chunk. An actor arriving starts a mod that is switched on but not running. Events can be lost.
- **Nothing else**: a mod calls no other node, subscribes to no topic, and sends no realtime
  events. Only players call it.

## When the grid changes hands

The grid's mods stop and become the new owner's, switched off, without the state the old
owner's runs kept. They run, as the new owner, once the new owner switches them on. The old
owner can no longer deploy there.

## The marketplace (no payments)

An owner publishes a mod, at its current version, for other grid owners in the app to install:

```graphql
mutation { execModPublish(appId: "…", gridId: "…", name: "greeter", title: "Greeter") { listingId } }
query { execModListings(appId: "…") { listingId title installs } }
mutation { execModInstall(appId: "…", gridId: "…", name: "greeter", listingId: "…") { enabled } }
```

An install becomes the installer's own mod, switched off, with the same checks as a deploy.
`execModUnpublish` stops new installs; the installed copies keep running.

## For the app's developers

- `execAppMods(appId, gridId, ownerId)` lists the app's mods; `execLogs` takes a mod's node
  type (`mod:<name>`) and grid id as `key`. Both need `view_compute_diagnostics`. A mod's owner
  reads its own logs with `execModLogs`.
- `execModSetSwitch` is the kill ladder (`manage_compute`): switch off one mod (its mod id), a
  player's mods (their user id), a grid's (its id), a listing's installs (its id), or every mod
  in the app (`ALL`). Off stops what runs at once and refuses calls, with your reason;
  `execModSwitches` lists what is off. The app's own switch (`execSetEnabled`) stops mods too.

Mods' usage is recorded but not billed during the preview.
