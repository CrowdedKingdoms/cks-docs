---
sidebar_position: 26
title: Marketplace
---

# Marketplace

Players share their code through the app's **mod marketplace**: an owner
publishes a [mod](/exec/mods) at its current version, and other grid owners in
the app install it, free (see
[the marketplace](/exec/mods#the-marketplace-no-payments)). Paid listing
prices, wallet checkout for store sales, refunds, seller payouts, and grid
purchases are **not on the public API**.

This page covers the grid side of it: how a player comes to own a grid, and
the tools a studio has to curate the code that runs there.

## Identity model (what everything hangs on)

The **author** is provenance. The author has **no residual access** to any
installer's world; a mod is a program, not a service.

- An installed mod becomes **the installer's own mod**, switched off, and
  runs **as its owner**, in their grid.
- A **client** mod runs **as the player running it**, in their browser
  sandbox.

## Claim a player-owned chunk grid

Apps with the `self_claim` grid policy can let an ordinary player claim an
unclaimed chunk without giving the game client the studio-only `manage_apps`
permission:

```graphql
mutation ClaimChunk($appId: BigInt!, $chunk: ChunkCoordinatesInput!) {
  claimGridChunk(appId: $appId, chunk: $chunk) {
    gridId
    lowChunk { x y z }
    highChunk { x y z }
    policy
    ownership { ownerKind ownerRef acquiredVia }
    moddable
    effectivePermissionKeys
  }
}
```

The mutation is atomic: it checks the app policy and spatial overlap, creates
the one-chunk grid, assigns the caller as its current owner, and materializes
the caller's build plus tier-entitled code keys. A competing claim
returns a conflict and leaves no grid, ownership, or ACL rows behind.

Release only grids created by this self-claim path:

```graphql
mutation {
  releaseClaimedGrid(appId: "2", gridId: "42") { released }
}
```

Only the current owner can release the claim. Studio grids and another
player's claim fail closed. A successful release removes the self-claimed
grid and makes that chunk claimable again; it does not delete chunks or
voxels in the region.

## Admission

Under an allow list, a mod is switched on only once the app admits it. Studio
tooling on the Management API: `admitAppCode` / `revokeAppCodeAdmission`
admit (or revoke) a mod, its marketplace listing, or its owner. An app in the
implicit mode (`implicit_allow`) admits every mod.

## Switching installs off

`execModSetSwitch` (Game API, `manage_compute`) is the kill ladder: switch off
one mod, a player's mods, a grid's, **every install of a listing** (its id),
or every mod in the app. Off stops what runs at once and refuses calls, with
your reason; `execModSwitches` lists what is off. See
[for the app's developers](/exec/mods#for-the-apps-developers).

## Grid claim policies (how claims confer ownership)

Each app chooses how a player claim confers `grid_ownership`
(`setAppGridClaimPolicy`, Management API):

| Policy | Semantics |
|---|---|
| `SELF_CLAIM` | The claim alone assigns ownership (server-authorized; the default) |
| `APPROVAL` | Claims create requests; designated approvers (or staff with `manage_compute`) accept via `decideGridClaim` |
| `INVITE` | Ownership only against a standing `issueGridClaimInvite` invite |

`setAppGridClaimPolicy` refuses `MARKETPLACE_ONLY` while paid grid sales
are off the public API.

`claimGridOwnership(appId, gridId)` executes the policy. On success the
claimer also receives grid grants for whichever code keys their tier
already carries — mod rights ride tier keys, and studio
`grid_permission_limits` still cap the result.

## Ownership transfer and delisting

- **Grid transfer:** the grid's mods stop and become the new owner's,
  switched off, without the state the old owner's runs kept. They run, as the
  new owner, once the new owner switches them on.
- **Delisting** (`execModUnpublish`) stops new installs; the installed copies
  keep running.
