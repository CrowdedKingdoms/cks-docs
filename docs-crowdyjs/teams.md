---
sidebar_position: 4
title: Teams
---

# Teams

The SDK exposes player **teams** via `client.teams`. A team is an app-scoped
group with members, roles, and per-role permissions you use to delegate
management (and, via grids, to give a team ownership of a region of the world).
Unlike channels, teams have **no realtime messaging path** — it's pure GraphQL
CRUD. See the Game API [Teams](/game-api/teams) guide for the full permission
model.

## Manage teams

Teams are a **Game API** surface, so they need an **app-scoped token**: log in on
an identity client, mint a token for the app, and drive teams from a per-game
client (see [Portals & app-scoped tokens](/management-api/portals-and-app-tokens)).

```ts
import {
  BrowserLocalStorageTokenStore,
  createCrowdyClient,
} from '@crowdedkingdoms/crowdyjs';

const identity = createCrowdyClient({
  httpUrl: 'https://ck.dev.crowdedkingdoms.com/graphql',
  tokenStore: new BrowserLocalStorageTokenStore('crowdyjs:session'),
});
await identity.auth.login({ email: 'player@example.com', password }); // see /crowdyjs/readme#sign-in-with-clientauth

const appToken = await identity.portal.mintAppToken('1');
const game = createCrowdyClient({
  httpUrl: appToken.gameApiUrl ?? 'https://ck.dev.crowdedkingdoms.com/graphql',
  wsUrl: appToken.gameApiWsUrl ?? 'wss://ck.dev.crowdedkingdoms.com/graphql',
  tokenStore: new BrowserLocalStorageTokenStore('crowdyjs:app:1'),
});
game.setToken(appToken.token);

// Create a team (the creator becomes owner with the system `leader` role).
const team = await game.teams.create({
  appId: '1',
  name: 'Red Dragons',
  membershipPolicy: 'request',
});

await game.teams.join(team.groupId);
const mine = await game.teams.mine('1');        // teams I belong to
const members = await game.teams.members(team.groupId);
```

## Delegate with roles

```ts
// An "officer" role that can manage members but not delete the team.
const role = await game.teams.createRole({
  groupId: team.groupId,
  roleName: 'officer',
  permissions: ['manage_members', 'invite_members'],
});

await game.teams.setMemberRoles({
  groupId: team.groupId,
  userId: '42',
  roleIds: [role.groupRoleId],
});
```

The full method set mirrors the GraphQL surface:

- **Read:** `mine(appId)`, `list(appId)`, `get(groupId)`, `members(groupId)`,
  `roles(groupId)`, `policy(appId)`.
- **Team lifecycle:** `create`, `update`, `remove`, `setPolicy`.
- **Membership:** `join`, `requestToJoin`, `leave`, `addMember`, `removeMember`,
  `setMemberRoles`.
- **Roles:** `createRole`, `updateRole`, `deleteRole`.

Setting the per-app team policy (`setPolicy`) requires the `manage_apps`
permission; membership and role management are gated by the team's own role
permissions. To give a team build rights in the world, assign it to a grid — see
[Grids and permissions](/game-api/grids-and-permissions).
