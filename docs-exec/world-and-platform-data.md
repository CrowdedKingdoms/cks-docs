---
sidebar_position: 4
title: World and platform data
---

# World and platform data

:::caution Dev-tier preview
Available on the **dev** environment only; see the [overview](intro).
:::

A hub or spoke reads and writes the platform's own data through the **node API**. This covers
the world's chunks and voxels, who is standing where, grids and their permissions, and players'
tier features, group permissions and app state. Every operation works inside the instance's own
app.

## Scopes

A node type asks for what it needs in the manifest. Its instances can use only those scopes.

```json
"arena": {
  "kind": "hub",
  "parent": "lobby",
  "digest": "…",
  "scopes": ["world.read", "world.write", "grids.read"]
}
```

| Scope | What it allows |
|---|---|
| `players.read` | A player's identity (players in the app now), tier features, group membership and permissions, and app state; an avatar's app state. |
| `players.write` | Replacing a player's app state (players with access to the app). |
| `world.read` | Chunks, the voxels written into them, and the actors in or near a chunk. |
| `world.write` | Writing voxels. |
| `grids.read` | Grids by id or by the chunk they cover, and whether a player holds a grid permission. |
| `permissions.write` | Granting and revoking grid permissions. |

A type that declares no scopes can use none of them. A deploy naming any other scope is
refused. Scope changes take effect as instances start again.

## From Rust

The `ckx-sdk` crate wraps each operation:

```rust
use ckx_sdk::prelude::*;

fn plant(ctx: &Ctx, at: ChunkPos, player: u64) -> Result<()> {
    // Only where the player may build.
    let grid = ctx.grids().at(at, GridPick::First)?.ok_or_else(|| Error::new("no grid here"))?;
    if !ctx.grids().check_permission(grid.id, player, "update_voxel_data")? {
        return Err(Error::new("not your land"));
    }
    ctx.world().set_voxels(&[VoxelWrite { chunk: at, voxel: (3, 12, 7), voxel_type: 54, state: None }])?;
    Ok(())
}
```

| Call | Scope | Returns |
|---|---|---|
| `ctx.world().chunk(at)` | `world.read` | The chunk's dense voxel grid and metadata blob, or `None`. |
| `ctx.world().voxels(at)` | `world.read` | Voxels written into the chunk, up to 2,048. |
| `ctx.world().set_voxels(&writes)` | `world.write` | Up to 16 voxels in one transaction, written as the app and shown to nearby players; each voxel's state is at most 1 KiB. |
| `ctx.world().actors(at)` | `world.read` | Actors in a chunk, from live presence (up to 200). |
| `ctx.world().actors_near(at, xz, y)` | `world.read` | Actors within `xz` chunks across (at most 3) and `y` up and down (at most 1), up to 500. |
| `ctx.grids().get(id)` | `grids.read` | One of the app's grids, with its low and high chunk; `Grid::contains(at)` tests a chunk. |
| `ctx.grids().at(at, pick)` | `grids.read` | The grid covering a chunk. Where grids overlap, `First` is the lowest id (what the realtime tier enforces); `Smallest` and `Largest` rank by size. |
| `ctx.grids().check_permission(grid, player, key)` | `grids.read` | Whether the player holds the key on the grid, directly or through a group, unexpired. |
| `ctx.players().get(player)` | `players.read` | Gamertag and disambiguation, for players in the app now. |
| `ctx.players().features(player)` | `players.read` | The feature keys the player's access tier grants. |
| `ctx.players().check_permission(player, group, key)` | `players.read` | Membership of one of the app's groups (teams, channels), or a permission within it. |
| `ctx.players().state(player)` / `set_state(player, bytes)` | `players.read` / `players.write` | The player's app state, the same blob game clients read with CrowdyJS `client.state` (up to 256 KiB). |
| `ctx.players().avatar_state(avatar)` | `players.read` | An avatar's app state. |
| `ctx.permissions().grant(grid, player, &keys, ttl)` | `permissions.write` | Grants runtime permission keys on one of the app's grids to a player with access to the app, until revoked or for `ttl` seconds. |
| `ctx.permissions().revoke(grid, player, keys)` | `permissions.write` | Revokes the named keys, or all of them. |

Permission keys come from the platform's runtime permission catalog, such as
`update_voxel_data`, `teleport` or `access`.

## Errors and limits

A refused operation returns a `CallError` whose `status` says why:

| Status | Why |
|---|---|
| `Denied` | The type did not declare the scope. |
| `NotFound` | No such player in the app (or none with access, for writes and grants), or no such grid in the app. |
| `AppError` | Bad input: an out-of-range coordinate or voxel type, too many writes, an unknown permission key. The message says which. |
| `RateLimited` | The app sent more than the platform allows. Reads and writes are counted separately, and each voxel in a batch counts as one write. Retry with backoff. |

`ctx.node(op, json)` sends an operation with a JSON body directly, for anything the typed calls
do not cover.

## Coming from the legacy APIs

| Legacy | ck-exec |
|---|---|
| Compute `chunk_get`, `voxels_list`, `voxel_set`, `actors_list`, `actors_list_radius` | `ctx.world()` |
| `grid_permission_check`, and the expression builtins `grid_at`, `grid_contains`, `grid_min`, `grid_max`, `has_grid_permission`, `has_chunk_permission` | `ctx.grids()` |
| Authority rules `tier_feature` and `group_permission` | `ctx.players().features` and `check_permission`, checked in handler code |
| Permission effects (grant and revoke as a function side effect) | `ctx.permissions()` |
| `user_state_get` / `user_state_set`, `avatar_state_get` | `ctx.players().state`, `set_state` and `avatar_state` |
| `grid_state_get` / `grid_state_set` | A hub keyed by the grid holds that state |
