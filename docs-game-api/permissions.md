---
sidebar_position: 14
title: Permissions overview
---

# Permissions overview

This page is the starting point for setting up permissions in your game. It shows
the layers that decide what a player can do, the permission keys you work with,
and a checklist for configuring them.

All permission configuration is done by **app admins** (members with the
`manage_apps` permission on the app's organization). `manage_apps` is a per-user
permission checked on the normal bearer token, so admins can configure
permissions from any trusted context — including a browser admin tool such as the
management UI, not only a backend service. The standing advice is simply to keep a
privileged admin token out of the untrusted client you ship to end users.

## The three layers

A player's effective abilities come from three layers that stack:

| Layer | Where you set it | Scope | Answers |
| ----- | ---------------- | ----- | ------- |
| **App access + tier** | [Management API](/management-api/intro) | Whole app | Can this player play, and what does their tier allow everywhere? |
| **Grid permissions** | Game API — [Grids and permissions](grids-and-permissions) | A 3D region | What may this player do in this specific area? |
| **Team roles** | Game API — [Teams](teams) | A team | Who may manage this team, and what does the team grant in the world? |
| **Channel roles** | Game API — [Channels](channels) | A channel | Who may manage this channel, and who may publish to it (`send_messages`)? |

Tiers set the baseline for the whole app. Grids add **spatial** rules on top —
either expanding control in an area (e.g. a player owns their plot) or
restricting it (e.g. a safe zone). Teams let you grant and delegate at the group
level instead of player-by-player.

## Open by default

Permissions are **always enforced** on the realtime path — every spatial action a
player takes is checked against their app access, tier, and grid permissions.
There is no "permissions off" mode.

To keep the common case effortless, a **new app is open by default**:

- Creating an app provisions a **default tier** that grants the explicit legacy
  gameplay allowlist (`access`, `teleport`, `update_voxel_data`,
  `use_voice_chat`).
- The app gets a **default grid that spans the whole world**, and any player you
  grant app access is automatically granted those same legacy keys on that
  grid.

Player-code permissions are deliberately excluded. Adding new runtime keys
does not widen the default tier/grid automatically; server/client code remains
opt-in.

:::caution[Editing a tier does not reach players who already joined]
The automatic grid grant above happens **once, when the player is first given app
access**. It is a snapshot of the tier at that moment, not a live link to it.

So adding a key to a tier later — `run_server_code`, say, to switch on automations —
reaches every *new* player and **none of the existing ones**. They keep the keys they
were granted on the way in. Nothing errors: enforcement needs the key at both the app
and grid layers, so the tier now allows the action and the grid still refuses it.

To bring existing players up, grant the key on the grid as well:

```graphql
mutation {
  grantGridPermissions(input: {
    appId: "APP_ID", gridId: "GRID_ID", userId: "USER_ID",
    permissionKeys: ["run_server_code"]
  }) { __typename }
}
```

Check who has what with `gridUserPermissions` before and after — a tier that reads
correctly while a grid row lags behind is the shape this failure takes.
:::

So a fresh app behaves like an open sandbox: any entitled player can move, build,
and use voice anywhere — no manual grid or grant setup required. You only do the
work below when you want to **restrict** something (a non-building safe zone,
plot ownership, members-only areas, etc.). Restriction is opt-in; openness is the
default.

## Permission keys

Grid and tier permissions use these runtime keys:

| Key | Allows |
| --- | ------ |
| `access` | Entering / moving / sending events in an area |
| `teleport` | Teleporting within the app (wire enforcement may depend on the client path) |
| `update_voxel_data` | Editing voxels (building) |
| `use_voice_chat` | Voice audio |
| `write_server_code` | Authoring/deploying server code in owned grids |
| `run_server_code` | Running admitted server code in owned grids |
| `write_client_code` | Authoring browser-target code |
| `run_client_code` | Running admitted browser-target code |
| `use_studio_agent` | Entering the Agentic Crowdy Studio protocol. Separately grantable and app-only; it does not imply project, runtime, grid, Play-lease, trust, or commerce authority. |

Query the Management API **`runtimePermissions`** for the live catalog when
building a permission picker in your studio tools.

`use_studio_agent` currently occupies replica permission bit index **8**, but
clients and tier configuration should use the stable key instead of hard-coding
the bit. It has `appliesToApp=true` and `appliesToGrid=false`; do not require or
infer a grid ACL row for this key. Agentic Build still checks the four
target-specific code keys above, and Play still checks a human-granted lease
plus the ordinary game permissions. See
[Agentic Crowdy Studio](agentic-crowdy-studio).

Teams use a separate set of **team-management** keys (`manage_group`,
`manage_members`, `manage_roles`, `invite_members`) — see [Teams](teams).

## Set up permissions for your game

1. **Define tiers and what each grants.** In the Management API, create your
   access tiers and choose which permission keys each tier grants app-wide (for
   example, a free tier with `access` only, and a builder tier that adds
   `update_voxel_data`). This is the baseline every player gets.

2. **Decide which regions need finer control.** Create [grids](grids-and-permissions)
   for those regions. A grid can be a whole zone or a **single chunk**, so you
   can hand one player control of exactly one chunk.

3. **Cap what a region allows (optional).** Use `setGridPermissionLimits` to make
   safe zones — e.g. allow `access` and `use_voice_chat` but never building,
   regardless of other grants.

4. **Grant permissions in the region.** Either:
   - **Per player** with `grantGridPermissions` (e.g. give a plot owner
     `update_voxel_data` on their chunk), or
   - **Per team/role** with `assignGroupToGrid` — grant a whole [team](teams)
     (or just members holding a specific role) permissions across a region.

5. **Let players run their own teams (optional).** Use `setTeamPolicy` to choose
   who can create teams (`admin` / `member` / `anyone`) and the default join
   policy. Team leaders can then manage their own members and roles.

## How it's enforced

The realtime layer (the Buddy replication servers) checks permissions on **every**
spatial message — this is always on. A message is accepted only if the sender has
active app access whose tier holds the needed key **and** the target chunk is
inside a grid where the sender holds that key. A player without `access` to a
region can't act there, building requires `update_voxel_data`, and voice requires
`use_voice_chat`; anything else is rejected with `UNAUTHORIZED`. With the
open-by-default setup above this is transparent — the default grid grants every
entitled player every key everywhere — until you add narrower grids/limits. A
player's effective keys on a grid are:

> (their tier baseline) plus (direct grants ∪ team/role grants) on that grid,
> within the grid's limits.

Use `gridUserPermissions` (one grid) or `nearbyGridPermissions` (all grids around
a chunk) to see exactly what a player has where.

## Related guides

- [Grids and permissions](grids-and-permissions) — grids, limits, direct and
  group grants.
- [Teams](teams) — teams, roles, delegation, and assigning teams to grids.
- [Channels](channels) — app-wide message channels, the `send_messages` role,
  and publishing/receiving channel messages over the realtime UDP path.
- [Player code and owned grids](player-code) — first-class grid title, the
  four player-code keys, source privacy, and strict code admission.
- [Avatar state](avatar-state) and [Actor state](actor-state) — owner-exclusive
  write / public read for character data.
