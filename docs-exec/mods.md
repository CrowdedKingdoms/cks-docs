---
sidebar_position: 8
title: Mods (players' code)
---

# Mods: players' code on their grids

A mod is a player's code on a grid they own. It runs as a hub like any other, addressed by the
node type `mod:<name>` and keyed by the grid's id, so each grid has one instance of each of its
mods. Players standing in the grid call it by name. Mods replace server-side player code
(`playerComputeDeploy`) and player automations: a mod's timers do what automations did. A mod
can also carry a [CLIENT half](#client-halves), code that runs in its visitors' browsers, which
replaces legacy CLIENT modules.

A mod runs in its owner's own sandbox, never beside the app's code or another player's mods.
It can read and change only its own grid, and nothing at all once its owner no longer owns
that grid.

## Who may do what

These are the same checks as for server-side player code:

| To | You need |
|---|---|
| Build a mod (`execModBuild`) | `write_server_code` in the app (your access tier) |
| Deploy, install, publish or delete a mod (`execModDelete`) | to own the grid, and `write_server_code` on both your access tier and the grid |
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

On your machine, the open [dev kit](develop-locally) starts from the same crate
(`npx @crowdedkingdoms/ckx-kit new mod greeter`). Its `cargo test` runs the mod against a fake of
its grid (`TestHub::mod_on(FakeGrid)`), which answers the mod as the node API does and applies
the platform's rules for mods, and `ckx-kit build --mod` builds it as `execModBuild` does, with
the mod limits.

A build is the same sandboxed build as `execBuild`, with one crate; you have one build at a
time, and only you can read it. A new mod starts switched off. Deploying a new version of a
running mod restarts it on that version. A mod's name is 1 to 48 lowercase letters, digits,
`-` or `_`; a grid holds at most 8 mods and a player at most 64.

`execMods(appId, gridId)` lists a grid's mods to anyone with access to the app, and
`execMyMods(appId)` lists yours on every grid. `execModDelete(appId, gridId, name)` stops a mod
and removes it, with its state and its versions.

From CrowdyJS, `client.exec` has the same calls (`modStarter`, `modBuild`, `waitForModBuild`,
`modDeploy`, `modSetEnabled`, `mods`, `myMods`, `modDelete`, and the rest below). In [Crowdy
Studio](/crowdyjs/player-client-mods), a project's SERVER target runs as a mod on the grid, and
from CrowdyJS 17.14.0 its CLIENT target as that mod's [CLIENT
half](client-halves#crowdy-studios-client-target).

## Call a mod from your game

```ts
const exec = await client.exec.connect(appId);
const hello = await exec.call(execModType('greeter'), gridId, 'visit');
```

A mod runs as its owner. It answers `Denied` while it is off or switched off, and `NotFound`
once it is deleted (`execModDelete`).

## What a mod can do

A mod is a hub with the platform's mod limits: 32 MiB of memory, 20 million fuel and 2 seconds
a call, 20 calls a second, and a module of at most 4 MiB.

- **Its grid, through the node API**: `world.chunk`, `world.voxels`, `world.actors` and
  `world.actors_radius` inside the grid's bounds; `world.set_voxels` inside them, in each
  chunk while its owner holds `update_voxel_data` on the most specific grid covering that
  chunk (the mod's grid, or a smaller grid nested in it, which decides its own chunks); and `grids.get` and `grids.check_permission`
  for its own grid. It has no player data and no permission grants.
- **What happens in its grid**: `Hub::on_world` receives the grid's world events in batches:
  actors moving into or out of a chunk (`actors`) and voxel changes (`voxels`), each with its
  chunk. An actor arriving starts a mod that is switched on but not running. Events can be lost.
  `voxels` reports the writes the Game API makes: `updateVoxel`, `updateChunk`, a rollback, and
  `world.set_voxels` from the app's hubs and from mods, the mod's own included (so a mod that
  writes on every `voxels` event never stops). A player's realtime voxel edit
  (`sendVoxelUpdate`) produces no event yet; read the chunk's edits with `world.voxels` when
  your mod needs them.
- **Nothing else**: a mod calls no other node, subscribes to no topic, and sends no realtime
  events. Only players call it.

## CLIENT halves

A mod can carry one **CLIENT half**: WebAssembly built on the platform from a
`crowdy-client-sdk` crate, which runs in the browser of each player who visits the mod's grid
and agrees to it. It draws a HUD or an overlay, reads the world around the player, and acts in
the grid as that player, never as its author. [CLIENT halves](client-halves) covers the crate,
building and attaching, running CLIENT halves in a game, Crowdy Studio, errors and limits.

| To | You need |
|---|---|
| Build a CLIENT half (`execModClientBuild`) | `write_client_code` in the app (your access tier) |
| Attach or detach it (`execModClientDeploy`, `execModClientDelete`) | to own the grid, `write_client_code` on both your access tier and the grid, and the mod running as you |
| Run one in your browser (`execModClientArtifact`) | `run_client_code` in the app, to stand in the grid, and your consent to it or trust in its author |

Its author is the mod's owner, who owns the grid. A CLIENT half rides its mod, so the mod has to
be deployed and switched on, with the permissions above, before visitors can run it. A CLIENT
build takes your one build at a time, as a mod build does.

### What a visitor is asked

`execGridClientMods` lists the CLIENT halves a grid serves, each with its **capability
summary**: what the module can do, derived from the module itself and never declared by its
author (its imports, the host calls it can reach, their groups, its HUD and overlay hooks, its
exports). A visitor agrees in one of two ways:

- **Consent** to one CLIENT half at its capability hash (`execConsentClientMod`). The consent
  holds while the hash does: a version that changes what the module can do carries a new hash,
  and the visitor is asked again.
- **Trust its author** on this grid (`execTrustAuthor`), at the hash of the union of that
  author's CLIENT halves there. Trusting needs you in the grid and consents to each current
  CLIENT half. It then covers the author's CLIENT halves there while their union asks for nothing
  new (no new import, host call, capability group or hook); one that does is asked about again.
- **Take it back** at any time, from anywhere: `execRevokeClientModConsent` drops the consent to
  one CLIENT half (a trusted author's halves are still served), and `execRevokeAuthorTrust`
  stops trusting an author on a grid, with every consent to their CLIENT halves there.

A game should ask once per author and show the union, and offer both ways back beside each
CLIENT half it runs; CrowdyJS's `ExecClientHalves` does the first and has `revoke` and
`forgetAuthor` for the second.

### When it is served

A grid serves a CLIENT half only while all of these hold, checked on every listing and fetch:

- the mod is switched on;
- no rung of the kill ladder, and not the app's own switch, has stopped it;
- the mod's owner, the grid's current owner and the CLIENT half's author are the same player;
- the app's code admission admits it at its CLIENT version (an admission naming the mod, its
  listing or its owner).

The module goes only to a visitor with `run_client_code` who stands in the grid now and has
consented to it or trusts its author. Every other fetch answers `NOT_FOUND`, whatever the
reason, and one player may fetch one mod's module 12 times a minute on each API instance.

### Its life

- **Attach** a CLIENT build to your mod with `execModClientDeploy`, replacing the CLIENT half it
  had. Its `clientVersion` rises by one each time, and the app's code admission must admit the
  new version. Consents carry over only while the capability hash is unchanged.
- **Switching the mod off**, or the kill ladder, stops serving it. Switched on again, it is
  served again, with the consents it had.
- **Detach** it with `execModClientDelete`: it goes, with every consent to it, and the mod keeps
  running. Deleting the mod deletes its CLIENT half too.
- **When the grid changes hands**, it goes (below).
- **Publishing** the mod records its CLIENT half on the listing, and installing the listing
  attaches that CLIENT half to the installer's mod ([the marketplace](#the-marketplace-no-payments)).

## When the grid changes hands

The grid's mods stop and become the new owner's, switched off, without the state the old
owner's runs kept. They run, as the new owner, once the new owner switches them on. The old
owner can no longer deploy there. Their CLIENT halves are removed, with every consent to them
and every visitor's trust in anyone but the new owner on that grid; the new owner attaches their
own.

## The marketplace (no payments)

An owner publishes a mod, at its current version, for other grid owners in the app to install:

```graphql
mutation { execModPublish(appId: "…", gridId: "…", name: "greeter", title: "Greeter") { listingId } }
query { execModListings(appId: "…") { listingId title installs } }
mutation { execModInstall(appId: "…", gridId: "…", name: "greeter", listingId: "…") { enabled } }
```

An install becomes the installer's own mod, switched off, with the same checks as a deploy.
`execModUnpublish` stops new installs; the installed copies keep running.

A listing also records the mod's CLIENT half as it was when published (`clientDigest`,
`clientCapabilitySummaryJson`, `clientCapabilityHash`, `clientTickIntervalMs`; null without one),
so an installer can review it first. An install gives the installed mod that CLIENT half, or
none, attached as the installer. No consent carries over: every visitor, the installer too,
agrees to it afresh.

## For the app's developers

- `execAppMods(appId, gridId, ownerId)` lists the app's mods; `execLogs` takes a mod's node
  type (`mod:<name>`) and grid id as `key`. Both need `view_compute_diagnostics`. A mod's owner
  reads its own logs with `execModLogs`.
- `execModSetSwitch` is the kill ladder (`manage_compute`): switch off one mod (its mod id), a
  player's mods (their user id), a grid's (its id), a listing's installs (its id), or every mod
  in the app (`ALL`). Off stops what runs at once and refuses calls, with your reason, and the
  mods' CLIENT halves are no longer served; `execModSwitches` lists what is off. The app's own
  switch (`execSetEnabled`) stops mods and their CLIENT halves too.

## Who pays for a mod

A mod bills its **owner**, not the app. Its compute is metered per owner and charged to the
owner's [player wallet](/management-api/player-billing) at the player rate card, once the
owner's monthly trial is used (250,000 compute units in each app). What its realtime streams
send counts as the owner's player egress. The app's
organization pays nothing for the mods its players run, and they don't count against the
app's budget. A CLIENT half runs on the visitor's own hardware.

When the owner's wallet is empty, or they reach a spend cap they set, billing switches that
owner's mods off in that app. It uses the kill ladder: `execModSwitches` shows a `PLAYER`
switch with `createdBy: billing` and the reason, `PLAYER_WALLET_EMPTY` or `PLAYER_SPEND_CAP`.
`execMyMods` shows the owner's mods blocked, and a call to one is refused with that reason.
Other players' mods keep running. A top-up, or the cap resetting or being raised, switches
them back on within a few minutes. Billing lifts only its own switch, so a switch the app's
developers set stays.
