---
sidebar_position: 5
title: Grids
---

# Grids (world ownership)

`client.gameApps` wraps the Game API **grid** administration surface — the
spatial permission layer that decides *what a player may do in a given 3D region*
of your world. It is a **studio-admin** surface that runs on the Game API, so
every call needs an **app-scoped token** for the target app (mint one with
`identity.portal.mintAppToken(appId)`; there is still no separate "admin token"
type — it is the same app/gameplay token) **and** a logged-in user who holds the
`manage_apps` permission on the app's organization. A studio admin can
`mintAppToken` for their own app even without player entitlement. Drive it from a
trusted admin context — a studio backend **or** your own admin-only /
authenticated web tool (a browser is fine) — and just keep that privileged token
out of the untrusted game client you ship to end users. It is also reachable as
`client.admin.grids`. See [Portals & app-scoped tokens](/management-api/portals-and-app-tokens);
the examples below assume `client` holds that app's app-scoped token.

For the underlying concepts (how grids layer on top of app access, the
open-by-default world grid, nesting vs. straddling, and effective-permission
math) see **[Game API → Grids and permissions](/game-api/grids-and-permissions)**.

## Create and delete grids

A grid is an axis-aligned box of chunks. `createGrid` and `deleteGrid` both
return a **hybrid result** — inspect `error` first (it is a UDP-style error code;
`NO_ERROR` means success), rather than relying on a thrown exception.

```ts
const created = await client.gameApps.createGrid({
  appId: '1',
  corner1: { x: '0', y: '0', z: '0' },
  corner2: { x: '15', y: '7', z: '15' },
});
if (created.error === 'NO_ERROR') {
  console.log('grid', created.grid?.grid_id);
}
```

```ts
// Remove a studio-created peer grid (e.g. to unblock GRID_OVERLAPS_EXISTING).
const removed = await client.gameApps.deleteGrid({ appId: '1', gridId: '10' });
if (removed.error !== 'NO_ERROR') {
  // GRID_NOT_FOUND | CANNOT_DELETE_DEFAULT_WORLD_GRID | GRID_HAS_NESTED_CHILDREN | UNKNOWN_ERROR
  console.warn('delete failed:', removed.error);
}
```

`deleteGrid` refuses to remove the open-by-default world grid or a grid that still
has nested child grids (delete the children first). It removes only the grid
definition and its permission rows — chunks, voxels, actors, and game-model data
in that region are untouched. Requires `cks-game-api >= v0.12.3` (release
`v0.1.33+`).

## Grant and limit permissions

```ts
// Per player:
await client.gameApps.grantPermissions({
  appId: '1', gridId: '10', userId: '42',
  permissionKeys: ['access', 'update_voxel_data'],
});

// Per team/group (every member, or only members holding groupRoleId):
await client.gameApps.assignGroup({
  appId: '1', gridId: '10', groupId: '7',
  permissionKeys: ['access', 'update_voxel_data'],
});

// Cap what the grid can ever allow (build a safe zone — movement, no building):
await client.gameApps.setPermissionLimits({
  appId: '1', gridId: '10',
  permissionKeys: ['access', 'use_voice_chat'],
});
```

Use `revokePermissions` / `revokeGroup` to remove grants (omit `permissionKeys`
to remove all), and the read helpers to inspect the effective ACL:

```ts
await client.gameApps.userPermissions('1', '10', '42'); // one player's keys on a grid
await client.gameApps.permissionLimits('1', '10');       // the grid's whitelist
await client.gameApps.groupGrants('1', '10', '7');       // a group's grants
await client.gameApps.nearbyPermissions({                // grids overlapping a box + a user's keys
  appId: '1', userId: '42',
  corner1: { x: '0', y: '0', z: '0' },
  corner2: { x: '63', y: '15', z: '63' },
});
```

## Methods

| Method | Game API field |
| ------ | -------------- |
| `createGrid(input)` | `createGrid` |
| `deleteGrid(input)` | `deleteGrid` |
| `grantPermissions(input)` / `revokePermissions(input)` | `grantGridPermissions` / `revokeGridPermissions` |
| `assignGroup(input)` / `revokeGroup(input)` | `assignGroupToGrid` / `revokeGroupFromGrid` |
| `setPermissionLimits(input)` | `setGridPermissionLimits` |
| `userPermissions(appId, gridId, userId)` | `gridUserPermissions` |
| `nearbyPermissions(input)` | `nearbyGridPermissions` |
| `permissionLimits(appId, gridId)` | `gridGroupGrants`-adjacent `gridPermissionLimits` |
| `groupGrants(appId, gridId, groupId)` | `gridGroupGrants` |

All take/return the generated GraphQL input/output types. A grant or revoke takes
effect immediately for connected players.
