---
sidebar_position: 4
title: World and platform data
---

# World and platform data

A hub or spoke reads and writes the platform's own data through the **node API**. This covers
the world's chunks and voxels, who is standing where, grids and their permissions, players' access
to the app, and players' tier features, group permissions and app state. Every operation works
inside the instance's own app.

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
| `world.read` | Chunks, the voxels written into them (with who wrote each), and the actors in or near a chunk. |
| `world.write` | Writing voxels and a chunk's state. |
| `grids.read` | Grids by id or by the chunk they cover, their owner and open keys, the app's wilderness setting, and whether a player holds a grid permission. |
| `grids.write` | Creating and deleting grids, giving a group keys on one, and opening one to every player (ck-exec 0.15). |
| `permissions.write` | Granting and revoking grid permissions. |
| `access.read` | A player's access to the app: status, tier, expiry and suspension (ck-exec 0.15). |
| `access.write` | Granting, revoking and suspending a player's access to the app (ck-exec 0.15). |

`grids.write` and `access.write` give your code what an app admin can do in Studio over grids and
players' access, for your app only; declare them only on types that need them. Players'
[mods](mods) never get them.

A type that declares no scopes can use none of them. A deploy naming any other scope is
refused. Scope changes take effect as instances start again.

## From Rust

The `ckx-sdk` crate wraps each operation:

```rust
use ckx_sdk::prelude::*;

fn plant(ctx: &Ctx, at: ChunkPos, player: u64) -> Result<()> {
    // Only where the player may build: the most specific grid over the chunk decides.
    let grid = ctx.grids().at(at, GridPick::Smallest)?.ok_or_else(|| Error::new("no grid here"))?;
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
| `ctx.world().voxels(at)` | `world.read` | Voxels written into the chunk, up to 2,048, each with its time (`updated_at`) and author (`created_by`: a player's id, or `"0"` for your app's own code). |
| `ctx.world().set_voxels(&writes)` | `world.write` | Up to 16 voxels in one transaction, written as the app and shown to nearby players. Positions and types are yours to define: each `voxel` axis and each `voxel_type` is any signed 16-bit value (`i16`), and the platform checks no narrower range. Each voxel's state is at most 1 KiB; a batch with anything else is refused whole. Your app's own writes are not held to the [wilderness setting](/game-api/grids-and-permissions); a mod's are, as its owner's. |
| `ctx.world().set_chunk_state(at, state)` | `world.write` | Sets a chunk's opaque state blob (at most 64 KiB; `None` clears it), the same one `updateChunkState` writes. It costs one write per 4 KiB. |
| `ctx.world().actors(at)` | `world.read` | Actors in a chunk, from live presence (up to 200). |
| `ctx.world().actors_near(at, xz, y)` | `world.read` | Actors within `xz` chunks across (at most 3) and `y` up and down (at most 1), up to 500. |
| `ctx.grids().get(id)` | `grids.read` | One of the app's grids, with its low and high chunk, its owner (`owner`: a kind and a reference, or `None`) and the keys it grants every player (`open_permissions`); `Grid::contains(at)` tests a chunk. |
| `ctx.grids().settings()` | `grids.read` | The app's settings for grids: `wilderness_writes_open`, whether players may build where only the world grid covers. |
| `ctx.grids().create(low, high)` | `grids.write` | Creates a grid over the chunks from `low` to `high`, under the rules a grid made in Studio follows. Your code may hold up to 10,000 grids it created. |
| `ctx.grids().delete(grid)` | `grids.write` | Deletes a grid your code created; a grid made in Studio or claimed by a player is refused. |
| `ctx.grids().assign_group(grid, group, &keys)` / `unassign_group(grid, group)` | `grids.write` | Gives one of the app's groups (a team, a channel) keys on a grid, capped by the grid's limits, or takes them all back. |
| `ctx.grids().set_open_permissions(grid, &keys)` | `grids.write` | Grants keys on a grid to every player with access, as `setGridOpenPermissions` does: never a player-code key or the world grid, at most 32 open grids per app; an empty list closes it. |
| `ctx.grids().at(at, pick)` | `grids.read` | The grid covering a chunk. Where grids nest, `Smallest` is the most specific one (the smallest box; of equal boxes, the lowest id), the grid that decides voxel writes there; `First` is the lowest id and `Largest` the biggest box. |
| `ctx.grids().check_permission(grid, player, key)` | `grids.read` | Whether the player holds the key on the grid, directly or through a group, unexpired. |
| `ctx.players().get(player)` | `players.read` | Gamertag and disambiguation (`Option`: most players have none), for players in the app now. |
| `ctx.players().features(player)` | `players.read` | The feature keys the player's access tier grants. |
| `ctx.players().check_permission(player, group, key)` | `players.read` | Membership of one of the app's groups (teams, channels), or a permission within it. |
| `ctx.players().state(player)` / `set_state(player, bytes)` | `players.read` / `players.write` | The player's app state, the same blob game clients read with CrowdyJS `client.state` (up to 256 KiB). |
| `ctx.players().avatar_state(avatar)` | `players.read` | An avatar's app state. |
| `ctx.permissions().grant(grid, player, &keys, ttl)` | `permissions.write` | Grants runtime permission keys on one of the app's grids to a player with access to the app, until revoked or for `ttl` seconds. |
| `ctx.permissions().revoke(grid, player, keys)` | `permissions.write` | Revokes the named keys, or all of them. |
| `ctx.access().get(player)` | `access.read` | The player's access to the app (`status`, `tier`, `expires_at`, `suspended_until`), or `None`. |
| `ctx.access().grant(player, tier)` | `access.write` | Grants access, on one of the app's tiers when named. |
| `ctx.access().revoke(player)` | `access.write` | Revokes access, as `revokeAppAccess` does: the player's sessions end at once. |
| `ctx.access().suspend(player, seconds)` / `unsuspend(player)` | `access.write` | A ban that lifts by itself, 1 second to 365 days: the player's sessions end at once, and signing in is refused with `ACCESS_SUSPENDED` until then. Returns when it ends. |

Grid and access changes reach every Game API server within a moment. The realtime layer holds a
grid decision for up to 15 seconds; suspensions and revocations end the player's sessions there at
once.

Permission keys come from the platform's runtime permission catalog, such as
`update_voxel_data`, `teleport` or `access`.

## Errors and limits

A refused operation returns a `CallError` whose `status` says why:

| Status | Why |
|---|---|
| `Denied` | The type did not declare the scope. |
| `NotFound` | No such player in the app (or none with access, for writes and grants), or no such grid, group or tier in the app. |
| `AppError` | Bad input: too many writes, a state over its cap, an unknown permission key, a grid your code did not create, a suspension in the past or over a year. The message says which. |
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

Next: [realtime events](realtime-events).
