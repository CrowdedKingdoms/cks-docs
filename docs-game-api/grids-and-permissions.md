---
sidebar_position: 15
title: Grids and permissions
---

# Grids and permissions

Crowded Kingdoms separates **app access** (does a player have access to your game,
and what does their tier allow?) from **grid permissions** (what may a player do
in a specific 3D region of the world?).

## Two layers

| Layer | API | What it answers |
| ----- | --- | ---------------- |
| Tier / app access | [Management API](/management-api/intro) | Does this player have access to the app? Does their tier allow `update_voxel_data`? |
| Grid permissions | **Game API** (this service) | In this 3D region, what is this player allowed to do? |

Grids do **not** replace tiers — they add a **spatial gate** on top of tier
access. Both gates are **always enforced**: to act in a chunk a player needs the
key from their tier **and** a grid (covering that chunk) where they hold the key.

You don't have to build this from scratch. A new app starts **open by default**:
it gets a **default grid spanning the whole world**, and every player you grant
app access is auto-granted the four legacy gameplay keys on it (see
[Permissions overview → Open by default](permissions#open-by-default)). The grids
and grants below are how you **layer restrictions or finer ownership** on top of
that open baseline — e.g. carve out a safe zone, or hand one player their own
plot. The four code keys are never auto-granted.

## Permission keys

Grid permissions reuse the runtime permission keys:

| Key | Gates |
| --- | ----- |
| `access` | Entering / moving / sending events in the region |
| `update_voxel_data` | Editing voxels (building) in the region |
| `use_voice_chat` | Voice audio in the region |
| `use_video_chat` | Webcam video in the region (opt-in; the sender's tier must also carry it) |
| `write_server_code` | Authoring/deploying server Rust on a grid the player owns |
| `run_server_code` | Activating admitted server code in an owned grid |
| `write_client_code` | Authoring browser-target Rust |
| `run_client_code` | Running admitted browser artifacts |

Query the Management API **`runtimePermissions`** for the catalog when building a
key picker in your studio UI.

## Grids

A **grid** is an axis-aligned box of chunks inside one of your app's world
bounds. A grid can be as large as a region or as small as a **single chunk** —
so you can give one player control of exactly one chunk.

### First-class ownership

Permission grants answer "what may this user do here?" Ownership answers
"whose grid is this, and whose identity does its code run as?"
They are separate. `gridOwnership` reads current title;
`assignGridOwnership` is the P1 studio/bootstrap assignment path; and
`transferGridOwnership` transfers title and removes the old direct grants. The
grid's [mods](/exec/mods#when-the-grid-changes-hands) stop and become the new
owner's, switched off, without the state the old owner's runs kept.

Owning a grid grants no permissions by itself. A player still needs the
appropriate tier + grid keys. See [mods](/exec/mods) for the code a grid owner
runs there.

```graphql
mutation {
  createGrid(input: {
    appId: "1",
    corner1: { x: "0", y: "0", z: "0" },
    corner2: { x: "0", y: "0", z: "0" }   # single-chunk grid
  }) { grid { gridId } error }
}
```

### Where you can place a grid

`createGrid` returns a **hybrid result** — always inspect `error` first. On
`NO_ERROR` the `grid` is populated; otherwise `grid` is `null` and `error` tells
you why:

| `error` | Meaning |
| ------- | ------- |
| `NO_ERROR` | Grid created. |
| `NO_MATCHING_GRID_ASSIGNMENT` | The box isn't inside any of the app's buildable regions. An open-by-default app's world region covers everything, so you normally only see this on a brand-new app before it has been initialized (it clears once the app is in use — e.g. after the first player connects). |
| `GRID_OUTSIDE_ASSIGNMENT` | The box extends past the region it sits in. |
| `GRID_OVERLAPS_EXISTING` | The box **partially** overlaps another grid at the same level. |
| `GRID_ALREADY_EXISTS` | A grid with those exact bounds already exists. |

Two placement rules:

1. **Inside a buildable region.** A grid must fit within one of your app's
   buildable regions (grid assignments). The open-by-default **world grid** spans
   the whole world, so in a normal app you can place a grid anywhere.
2. **Nest, don't straddle.** A grid **may be nested inside a broader grid** — this
   is exactly how you carve a smaller, more-restricted area out of the world grid
   (e.g. a safe zone or one player's plot). It may **not** *partially* overlap a
   peer grid: give peers disjoint boxes, or nest one fully inside the other.

### Deleting a grid

If you create a grid with the wrong bounds, `createGrid` may keep returning
`GRID_OVERLAPS_EXISTING` for every follow-up attempt in that area. Use
`deleteGrid` to remove the mistaken **peer** grid so you can recreate it with
correct corners.

```graphql
mutation {
  deleteGrid(input: {
    appId: "1",
    gridId: "10"
  }) { gridId error }
}
```

Like `createGrid`, `deleteGrid` returns a **hybrid result** — inspect `error`
first:

| `error` | Meaning |
| ------- | ------- |
| `NO_ERROR` | Grid deleted; `gridId` is the removed id. |
| `GRID_NOT_FOUND` | No grid with that id in the app (wrong app or already deleted). |
| `CANNOT_DELETE_DEFAULT_WORLD_GRID` | The open-by-default world grid cannot be removed. |
| `GRID_HAS_NESTED_CHILDREN` | A smaller grid is still nested inside this one — delete the child grids first. |
| `UNKNOWN_ERROR` | Unexpected failure; retry or contact support. |

**Safety guards.** The mutation requires `manage_apps` on the app's organization
(same as other grid admin operations). It rejects the default world grid and any
grid that still contains nested child grids. It only removes the grid definition
and its permission rows (direct grants, group grants, limits, and the
materialized effective ACL entries that cascade from them). It does **not**
delete world content — chunks, voxels, and actors in that region are
untouched.

**Overlap unblock workflow.** When `createGrid` returns `GRID_OVERLAPS_EXISTING`,
identify the overlapping peer grid (for example via your studio map or by listing
grids for the app), call `deleteGrid` on the mistaken peer, then run
`createGrid` again with the intended bounds.

## Granting permissions on a grid

There are two ways to give players permissions on a grid. Both contribute to a
player's **effective** permissions, and both take effect immediately.

:::tip[Grants driven by game logic]
Your app's [ck-exec](/exec/intro) code can also grant or revoke direct grid
permissions itself — buying land, earning access, banishment — with
`ctx.permissions()` and the `permissions.write` scope (see
[world and platform data](/exec/world-and-platform-data)). Those grants land
in the same direct-grant layer as `grantGridPermissions`.
:::

### Direct grants (per player)

```graphql
mutation {
  grantGridPermissions(input: {
    appId: "1", gridId: "10", userId: "42",
    permissionKeys: ["access", "update_voxel_data"]
  }) { permissionKeys }
}
```

Use `revokeGridPermissions` to remove keys (omit `permissionKeys` to remove all),
and `gridUserPermissions(appId, gridId, userId)` to read a player's effective
keys on a grid. `grantGridPermissions` requires the target player to have active
app access.

### Group grants (per team or group)

Assign a [team or group](teams) to a grid so that **every member** (or every
member holding a particular role) gets the keys. This is the easiest way to grant
a whole guild build rights in their territory.

```graphql
mutation {
  assignGroupToGrid(input: {
    appId: "1", gridId: "10", groupId: "7",
    # groupRoleId is optional: omit to grant to all members,
    # or set it to grant only to members with that role (e.g. "builder").
    permissionKeys: ["access", "update_voxel_data"]
  }) { groupId groupRoleId permissionKey }
}
```

Use `revokeGroupFromGrid` to remove a group's grant (optionally a subset of keys
or a single role), and `gridGroupGrants(appId, gridId, groupId)` to list them.

When a player joins or leaves the group, or gains/loses the relevant role, their
grid permissions update automatically.

## Limiting what a grid allows

`setGridPermissionLimits` caps which keys can ever take effect on a grid,
regardless of grants. This is how you build a **safe zone** (e.g. movement only,
no building):

```graphql
mutation {
  setGridPermissionLimits(input: {
    appId: "1", gridId: "10",
    permissionKeys: ["access", "use_voice_chat"]   # building disallowed here
  }) { permissionKeys }
}
```

A grant of `update_voxel_data` on a limited grid simply won't take effect until
`update_voxel_data` is added to the limits. Pass an empty array to remove all
limits (every key becomes allowed again).

## Wilderness

The **wilderness** is every chunk that no grid covers except your app's default
world grid, i.e. land nobody has claimed and you have not zoned. By default it is
**open**: a player whose tier and world-grid grant carry `update_voxel_data` may
build there.

An org admin (`manage_apps` on the app) can close it with `updateApp`:

```graphql
mutation {
  updateApp(appId: "1", input: { wildernessWritesOpen: false }) {
    wildernessWritesOpen
  }
}
```

While it is closed, the Game API refuses **every** voxel and chunk write to a
wilderness chunk, whoever makes it: `updateVoxel`, `sendVoxelUpdate`,
`updateChunk` (org admins included) and your server code's
`ctx.world().set_voxels`. Each is answered `FORBIDDEN` ("This app has closed its
wilderness…"). A chunk that any other grid covers (a claimed plot, a zone you
created) is unaffected, and its grants decide as before. `App.wildernessWritesOpen`
reports the setting; each Game API instance applies a change within 15 seconds.

## Writing whole chunks

`updateChunk` replaces a chunk's dense voxel grid. It takes an app token for the
app and **either** `manage_apps` on the app (your studio tooling and seed scripts,
like `updateChunkState` and `updateChunkLods`) **or** the same permission a single
voxel edit needs in that chunk: app access, `update_voxel_data` from the tier, and
`update_voxel_data` on a grid covering the chunk. The `ChunkStore` write-back in
CrowdyJS and CrowdyCPP runs as the player, so a player's client persists only
chunks that player may build in; the store sends a refused write-back once, drops
it and reports it (`onWriteBackFailed`).

## Effective permissions

A player's effective permissions on a grid are:

> (direct grants ∪ group/role grants) ∩ grid limits

Use `gridUserPermissions` for one grid, or `nearbyGridPermissions` to fetch every
grid overlapping a chunk box together with the player's keys — handy for a studio
map overlay.

## Who can manage grids

All grid operations (`createGrid`, `deleteGrid`, `grantGridPermissions`,
`revokeGridPermissions`, `assignGroupToGrid`, `revokeGroupFromGrid`,
`setGridPermissionLimits`) require the `manage_apps` permission on the app's
organization.

## Reference

See the [Game API GraphQL reference](/game-api/reference/graphql/graphql-overview)
for the exact inputs and return types of each operation.
