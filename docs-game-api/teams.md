---
sidebar_position: 16
title: Teams
---

# Teams

Teams are player groups inside one of your games (apps). A team has **members**,
**roles** (a `leader` role is created automatically), and per-role
**permissions** that let you delegate management. Teams can also be granted
permissions over [grids](grids-and-permissions#group-grants-per-team-or-group),
so a team can own and build in a region of the world.

All team operations run on the Game API and require an **app-scoped token** for
the app (send `Authorization: Bearer <token>`; mint one with `mintAppToken` — see
**[Authentication](/game-api/authentication)**), not the identity session token.

## Deciding who can create and join teams

Each app has a **team policy** with two settings:

- **creation policy** — who may create teams: `admin` (only app admins),
  `member` (any player with app access), or `anyone`.
- **default membership policy** — how new teams accept members by default:
  `open` (join instantly), `request` (join request awaits approval),
  `invite` (managers add members), or `admin` (app admins only).

App admins set the policy with `setTeamPolicy` (requires `manage_apps`):

```graphql
mutation {
  setTeamPolicy(input: {
    appId: "1",
    creationPolicy: "member",
    defaultMembershipPolicy: "request",
    maxMembers: 50,          # optional cap on members per team
    maxGroupsPerUser: 5      # optional cap on teams a user may create/join
  }) { creationPolicy defaultMembershipPolicy maxMembers maxGroupsPerUser }
}
```

`maxMembers` and `maxGroupsPerUser` are optional limits — omit them (or pass
`null`) for no cap. Read the current policy with `teamPolicy(appId)`.

## Creating a team

```graphql
mutation {
  createTeam(input: {
    appId: "1",
    name: "Red Dragons",
    membershipPolicy: "request"   # optional; defaults to the app policy
  }) { groupId name membershipPolicy }
}
```

The creator becomes the **owner** and is given the system `leader` role, which
holds every team permission.

## Joining and leaving

```graphql
mutation { joinTeam(groupId: "7") { status } }      # open -> active, request -> pending
mutation { requestToJoinTeam(groupId: "7") { status } }
mutation { leaveTeam(groupId: "7") }
```

- `joinTeam` honors the team's membership policy: `open` joins instantly,
  `request` creates a pending request, and `invite`/`admin` teams reject
  self-joins.
- `myTeams(appId)` lists the teams you belong to, with your roles and your
  effective team permissions. `teams(appId)` lists all teams in an app, and
  `team(groupId)` fetches one.

## Managing members (delegation)

Managers — members whose role grants `manage_members` (plus app admins) — can add
and remove members. Adding a member also approves a pending request.

```graphql
mutation { addTeamMember(groupId: "7", userId: "42") { userId status } }
mutation { removeTeamMember(groupId: "7", userId: "42") }
```

Players can always remove themselves.

## Roles and permissions

A team's roles carry these permission keys:

| Key | Allows |
| --- | ------ |
| `manage_group` | Rename/delete the team and edit its settings |
| `manage_members` | Add and remove members |
| `manage_roles` | Create/edit/delete roles and assign them |
| `invite_members` | Invite players to the team |

Create and assign roles to **delegate** management — for example, an "officer"
role that can manage members but not delete the team:

```graphql
mutation {
  createTeamRole(input: {
    groupId: "7", roleName: "officer",
    permissions: ["manage_members", "invite_members"]
  }) { groupRoleId roleName permissions }
}

mutation {
  setTeamMemberRoles(input: {
    groupId: "7", userId: "42", roleIds: ["55"]
  }) { userId roles { roleName } }
}
```

Use `updateTeamRole` / `deleteTeamRole` to change roles (the system `leader` role
can't be deleted), and `teamRoles(groupId)` / `teamMembers(groupId)` to list a
team's roles and members. Holders of `manage_group` (and app admins) rename or
disband the team itself with `updateTeam(input)` and `deleteTeam(groupId)`.

## Giving a team permissions in the world

To let a team build in a region, create a grid and assign the team to it — see
[Grids and permissions](grids-and-permissions#group-grants-per-team-or-group).
You can grant to the whole team or just to members holding a specific role
(e.g. only `officer`s can build).

## Reference

See the [Game API GraphQL reference](/game-api/reference/graphql/graphql-overview)
for the exact inputs and return types.
