---
slug: teams
sidebar_position: 2
title: Teams
description: "Persistent, server-owned player groups with membership, roles, and permissions: the cache for instant UI, the per-call and async-action surfaces, and why runtime code and Crowdy Studio edit the same rows."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Teams

A team is a persistent, named group of players, scoped to your app, with membership, roles, and
permissions the app controls. A game creates, joins, and manages teams live from `UCrowdyTeams`; Crowdy
Studio's Teams pane edits the same rows ahead of time.

## When you touch this

Any time players need a group that outlives one session, a guild, a faction, a village, with roles you
can grant and revoke. In the example world a village is a team: joining one is how a player shows they
belong to a place.

## Runtime and Studio, one dataset

Creating, updating, and deleting teams is not a Studio-only workflow. The same create, update, delete,
role, and policy operations run from game code through `UCrowdyTeams`, subject to your app's team
creation policy, and Crowdy Studio's Teams pane reads and writes the identical server rows. There is one
store, not two.

Membership, roles, and permissions are server-authoritative truth, pulled through `UCrowdyTeams` rather
than trusted from the client, the same split every server-owned system in the SDK follows: see
[Game Models](../game-models/overview.md) for the general two-plane story. Teams are not themselves a
Game Model in this version: there is no `CrowdyContainer` here, just the Team API `UCrowdyTeams` wraps
one call at a time. If you came looking for a container, see
[Change pings and pull](../game-models/change-pings-and-pull.md) instead.

The server owns team, role, and permission storage and every authorization check; a disallowed call comes
back through the error delegate rather than being refused on the client. The exact GraphQL shape behind
each call is on [Teams](/game-api/teams) and in the
[operations reference](/game-api/reference/graphql/operations/mutations/create-team); a team can also be
granted permissions over a grid region, covered on
[Grids and permissions](/game-api/grids-and-permissions#group-grants-per-team-or-group).

Every call below is asynchronous and answers through exactly one of the two delegates it is given, even
when the request never reaches the server.

## Reading the cache first

`GetCachedMyTeams` and its neighbors read a local snapshot of the player's own memberships, refreshed only
by `GetMyTeams`; a join, leave or role change does not touch it, so call `GetMyTeams` again after a
mutation you want the cache to reflect. Read it for the value to show now; treat a query's result and
`OnMyTeamsCacheChanged` as the update that follows.

| Call | Returns |
|---|---|
| `HasCachedTeams()` | Whether the cache has been populated yet. |
| `GetCachedMyTeams()` | The player's memberships (`TArray<FCrowdyTeamMembership>`) as of the last refresh. |
| `IsPlayerInTeam(TeamId)` | Whether the player belongs to that team, from the cache. |
| `GetMyTeamById(TeamId, OutMembership)` | The cached membership for one team, if any. |
| `IsInAnyTeam()` | Whether the cache holds at least one membership. |
| `GetPrimaryMembership(OutMembership)` | The first cached membership. |
| `HasPermissionInTeam(TeamId, Permission)` | Whether the cached membership grants an `ECrowdyTeamPermission`. |

`OnMyTeamsCacheChanged` (`FOnMyTeamsCacheChanged`, `Memberships`) is a multicast, Blueprint-assignable
delegate that fires after `GetMyTeams` answers, and only then. Bind it once and re-read the cache; do not
poll.

## Queries

Each query takes an `FOnTeamError` alongside its success delegate; bind it to a `UFUNCTION` with the
signature `(FCrowdyTeamError Error, FString Message)`, where `Message` repeats `Error.Message`.

| Call | Success delegate | Notes |
|---|---|---|
| `GetMyTeams(OnSuccess, OnError)` | `FOnMyTeamsSuccess` | Repopulates the cache and fires `OnMyTeamsCacheChanged`. |
| `GetTeam(TeamId, OnSuccess, OnError)` | `FOnTeamSuccess` | One team by id. |
| `GetTeams(OnSuccess, OnError)` | `FOnTeamsSuccess` | Every team in the app, not just the player's. |
| `GetTeamMembers(TeamId, OnSuccess, OnError)` | `FOnTeamMembersSuccess` | |
| `GetTeamRoles(TeamId, OnSuccess, OnError)` | `FOnTeamRolesSuccess` | |
| `GetTeamPolicy(OnSuccess, OnError)` | `FOnTeamPolicySuccess` | App-wide, not per-team. |
| `GetPendingJoinRequests(TeamId, OnSuccess, OnError)` | `FOnTeamMembersSuccess` | See the warning below. |

:::note[GetPendingJoinRequests re-fetches the full member list and filters on the client.]
It runs the same query as `GetTeamMembers` and then keeps only the members whose status is pending. That
is fine at team scale, a handful to a few dozen members, but do not call it in a hot loop expecting a
cheaper, dedicated request.
:::

## Creating and managing a team

Every mutation reports success through its own delegate and failure through the shared `FOnTeamError`.

**Team lifecycle:** `CreateTeam(Name, Description, MembershipPolicy, OnSuccess, OnError)` returns
`FOnTeamSuccess` with the new `FCrowdyTeam`; `UpdateTeam(TeamId, Name, Description, OnSuccess, OnError)`
also returns `FOnTeamSuccess`; `DeleteTeam(TeamId, OnSuccess, OnError)` returns `FOnTeamVoidSuccess`.

**Membership:** `JoinTeam(TeamId, OnSuccess, OnError)` honors the team's `ECrowdyTeamMembershipPolicy`,
seating the player immediately for an `Open` team; `RequestToJoinTeam(TeamId, OnSuccess, OnError)` is for
a `Request` policy team and returns a pending member. Both return `FOnTeamMemberSuccess`.
`LeaveTeam(TeamId, OnSuccess, OnError)` returns `FOnTeamVoidSuccess`. `AddTeamMember(TeamId, UserId,
OnSuccess, OnError)` is the admin add that bypasses the membership policy; `RemoveTeamMember(TeamId,
UserId, OnSuccess, OnError)` takes them off. `AddTeamMember` answers with `FOnTeamMemberSuccess`,
`RemoveTeamMember` with `FOnTeamVoidSuccess`.

**Roles and permissions:** `CreateTeamRole(TeamId, RoleName, Permissions, Rank, OnSuccess, OnError)` and
`UpdateTeamRole(TeamRoleId, RoleName, Permissions, OnSuccess, OnError)` return `FOnTeamRoleSuccess`;
`DeleteTeamRole(TeamRoleId, OnSuccess, OnError)` returns `FOnTeamVoidSuccess`.
`SetTeamMemberRoles(TeamId, UserId, RoleIds, OnSuccess, OnError)` returns `FOnTeamMemberSuccess`.
`Permissions` is an `FCrowdyTeamPermissions` your code builds before the call.

:::warning[SetTeamMemberRoles replaces the member's roles, it does not add to them.]
Pass every role the member should end up holding, including ones they already have, or the call drops
the roles you left out.
:::

**App-wide policy:** `SetTeamPolicy(CreationPolicy, DefaultMembershipPolicy, OnSuccess, OnError)` returns
`FOnTeamPolicySuccess` and is an app-admin operation.

## Data types

| Struct | Holds |
|---|---|
| `FCrowdyTeam` | `TeamId`, `AppId`, `Name`, `Description`, `OwnerUserId`, `MembershipPolicy`, `Status`, `CreatedAt`. |
| `FCrowdyTeamMember` | `TeamMemberId`, `TeamId`, `UserId`, `Status` (active or pending), `Roles` sorted by rank, `CreatedAt`. |
| `FCrowdyTeamMembership` | `Team`, `Roles`, the effective `Permissions` (a server-computed union across roles), `JoinedAt`, and `HasPermission(ECrowdyTeamPermission)`. |
| `FCrowdyTeamPermissions` | Flags `bManageTeam`, `bManageMembers`, `bManageRoles`, `bInviteMembers`, all `BlueprintReadWrite`, and `Has()`. Build one to pass into `CreateTeamRole` or `UpdateTeamRole`. |
| `FCrowdyTeamPolicy` | `AppId`, `CreationPolicy`, `DefaultMembershipPolicy`, `MaxMembers` (0 is uncapped), `MaxTeamsPerUser` (0 is uncapped). |
| `FCrowdyTeamRole` | `TeamRoleId`, `TeamId`, `RoleName`, `Rank`, `bIsSystem` (every team has an undeletable system leader role), `Permissions`, `CreatedAt`. |
| `FCrowdyTeamError` | `Code` (`ECrowdyTeamErrorCode`) and `Message`. |

| Enum | Values |
|---|---|
| `ECrowdyTeamCreationPolicy` | `Admin`, `Member`, `Anyone` |
| `ECrowdyTeamMembershipPolicy` | `Open`, `Request`, `Invite`, `Admin` |
| `ECrowdyTeamPermission` | `ManageTeam`, `ManageMembers`, `ManageRoles`, `InviteMembers` |
| `ECrowdyTeamErrorCode` | `Unknown`, `NotFound`, `Forbidden`, `PolicyViolation`, `AlreadyMember`, `NotMember`, `NetworkError`, `ServerError` |

:::note[Code is a coarse bucket, not a precise diagnosis.]
`FCrowdyTeamError` is built by pattern-matching the server's message text; there is no structured error
code from the server. Read `Message` for the detail and branch on `Code` only for the broad cases.
:::

## Blueprint nodes

The subsystem's per-call delegates need a Create Event node per call. For a graph that just drops in a
node, use the async-action latent nodes instead: one static factory and `Activate()` per node, with
multicast `OnSuccess`/`OnError` (`FTeamsAsyncOnError`, the same two parameters as `FOnTeamError`),
wrapping the same server calls.

| Node | Class | Returns |
|---|---|---|
| Get My Teams | `UCrowdyTeams_GetMyTeams` | `FCrowdyMyTeamsResult` |
| Get Team | `UCrowdyTeams_GetTeam` | `FCrowdyTeam` |
| Get All Teams | `UCrowdyTeams_GetTeams` | `FCrowdyTeamsResult` |
| Get Team Members | `UCrowdyTeams_GetTeamMembers` | `FCrowdyTeamMembersResult` |
| Get Team Roles | `UCrowdyTeams_GetTeamRoles` | `FCrowdyTeamRolesResult` |
| Get Team Policy | `UCrowdyTeams_GetTeamPolicy` | `FCrowdyTeamPolicy` |
| Get Pending Join Requests | `UCrowdyTeams_GetPendingJoinRequests` | `FCrowdyTeamMembersResult` |
| Create Team | `UCrowdyTeams_CreateTeam` | `FCrowdyTeam` |
| Update Team | `UCrowdyTeams_UpdateTeam` | `FCrowdyTeam` |
| Delete Team | `UCrowdyTeams_DeleteTeam` | void |
| Join Team | `UCrowdyTeams_JoinTeam` | `FCrowdyTeamMember` |
| Request to Join Team | `UCrowdyTeams_RequestToJoinTeam` | `FCrowdyTeamMember` |
| Leave Team | `UCrowdyTeams_LeaveTeam` | void |
| Add Team Member | `UCrowdyTeams_AddTeamMember` | `FCrowdyTeamMember` |
| Remove Team Member | `UCrowdyTeams_RemoveTeamMember` | void |
| Set Team Member Roles | `UCrowdyTeams_SetTeamMemberRoles` | `FCrowdyTeamMember` |
| Create Team Role | `UCrowdyTeams_CreateTeamRole` | `FCrowdyTeamRole` |
| Update Team Role | `UCrowdyTeams_UpdateTeamRole` | `FCrowdyTeamRole` |
| Delete Team Role | `UCrowdyTeams_DeleteTeamRole` | void |
| Set Team Policy | `UCrowdyTeams_SetTeamPolicy` | `FCrowdyTeamPolicy` |

`FCrowdyTeamsResult`, `FCrowdyMyTeamsResult`, `FCrowdyTeamMembersResult`, and `FCrowdyTeamRolesResult`
each wrap one multi-item result (`Teams`, `Memberships`, `Members`, `Roles`); a single-item call like
`GetTeam` or `CreateTeam` returns its struct directly.

Each async-action node's own `On Success` pin is a multicast delegate named after its call:
`FTeamAsyncOnSuccess` (Get Team, Create Team, Update Team), `FTeamsAsyncOnSuccess` (Get All Teams),
`FMyTeamsAsyncOnSuccess` (Get My Teams), `FMemberAsyncOnSuccess` (Join Team, Request to Join Team, Add
Team Member, Set Team Member Roles), `FMembersAsyncOnSuccess` (Get Team Members, Get Pending Join
Requests), `FRoleAsyncOnSuccess` (Create Team Role, Update Team Role), `FRolesAsyncOnSuccess` (Get Team
Roles), `FPolicyAsyncOnSuccess` (Get Team Policy, Set Team Policy), and `FVoidAsyncOnSuccess` (Delete
Team, Leave Team, Remove Team Member, Delete Team Role). These are separate from the per-call
`FOnTeam*Success` delegates above; the async-action nodes never use those.

:::caution[Bind a per-call delegate to a UFUNCTION on a UObject that outlives the request.]
The response arrives asynchronously; if the object is gone by then, the callback has nowhere to land.
:::

:::note[The array delegates pass `const TArray<T>&`.]
`FOnTeamsSuccess`, `FOnTeamMembersSuccess`, `FOnTeamRolesSuccess`, `FOnMyTeamsSuccess`, and the cache event
`FOnMyTeamsCacheChanged` pass their array as `const TArray<T>&`, which is what the C++ handlers on this page
take. A handler must match or it fails to bind, and a project coming from 2.14.0 or earlier, where these
passed by value, changes its handlers once; see
[What's Changed](../guides/whats-changed.md#2026-09-22-sdk-v2150). In Blueprint prefer the async-action
nodes above, whose result pins are structs; a Blueprint pin has no by-value distinction.
:::

## Example: founding and joining a village

A village is a team. The player asks to join "the Village," and a successful join lights their `Torch`,
the light component the example cast already carries, to show membership at a glance.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

A "Found the Village" button calls `FoundVillage()`, which calls `CreateTeam("The Village", "Everyone
who shares one fire.", Open, HandleVillageFounded, FOnTeamError())`; `HandleVillageFounded(FCrowdyTeam)`
stores the new id in a private `VillageTeamId`, read back through the `BlueprintPure` `GetVillageTeamId()`:

<CppSnippet id="team-create" />

Overlapping the village post calls `JoinVillage()`, which calls `JoinTeam(GetVillageTeamId(), ...)`;
on success `HandleJoinedVillage(FCrowdyTeamMember)` sets `Torch->SetVisibility(true)`:

<CppSnippet id="team-join" />

`ShowVillageMembership()`, called from `BeginPlay`, guards on `HasCachedTeams()` and sets
`Torch->SetVisibility(Teams->IsPlayerInTeam(GetVillageTeamId()))` from the cache alone, before any round
trip completes:

<CppSnippet id="team-query" />

`WatchVillage()`, bound at `BeginPlay`, calls `OnMyTeamsCacheChanged.AddDynamic` and `GetMyTeams()`;
`HandleVillageCacheChanged(const TArray<FCrowdyTeamMembership>&)` re-runs `ShowVillageMembership()`
whenever the cache changes, from anywhere:

<CppSnippet id="team-events" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The Blueprint needs an `int64` variable `VillageTeamId` and the `Torch` light component the cast already
has.

Creating the village: the **Create Team** async node takes `Name` and `Description` literals and a
`MembershipPolicy` of `Open`; its `On Success` pin fires when the server has the team, breaks the `Team`
output, and sets `TeamId` into `VillageTeamId`.

<Blueprint src="team-create" title="OnFoundVillagePressed, Create Team, Break Crowdy Team, Set VillageTeamId" />

Joining it: overlapping the village post fires **Event ActorBeginOverlap**, which reads `VillageTeamId`
and calls **Join Team**; its `On Success` pin gets the `Torch` and sets its visibility.

<Blueprint src="team-join" title="Event ActorBeginOverlap, Get VillageTeamId, Join Team, Get Torch, Set Visibility" />

Reading the cache on spawn: **Event BeginPlay** gets the `Torch`, gets the **Crowdy Teams** subsystem and
`VillageTeamId`, and feeds them into **Is Player in Team** (pure), whose return value drives the torch's
visibility directly, no network call. The cache is empty until **Get My Teams** has answered once, so on
its own this graph hides the torch on spawn; the sync step below is what shows it. A **Has Cached Teams**
(pure) check into **Branch** guards the read, so the visibility set only runs once the cache has answered.

<Blueprint src="team-query" title="Event BeginPlay, Has Cached Teams, Branch, Get Torch, Is Player in Team, Crowdy Teams, Get VillageTeamId, Set Visibility" />

Staying in sync: add a custom event with one input, `Memberships` (array of `Crowdy Team Membership`),
connect it with **Bind Event to On My Teams Cache Changed** at Begin Play, then call **Get My Teams**; the
event's body re-runs the membership check above. No figure is shown for this step; the C++ tab shows the
same one.

</TabItem>
</Tabs>

## Gotchas

- The cache holds only the player's own memberships. `GetTeams` lists every team in the app; the cache
  never does.
- Only `GetMyTeams` writes the cache and fires `OnMyTeamsCacheChanged`. After a join, leave or role change,
  call `GetMyTeams` again or `IsPlayerInTeam` keeps answering from before the mutation.
- `GetPendingJoinRequests` filters the full member list on the client; it is not a dedicated server call.
- `SetTeamMemberRoles` replaces the member's role set. Pass the full set every time.
- `FCrowdyTeamError::Code` is pattern-matched from the server's message text, not a structured server
  code; treat it as a coarse bucket and `Message` as the detail.
- A per-call delegate needs a `UFUNCTION` on a `UObject` that outlives the request, including when the
  request never reaches the server.
- The array delegates take `const TArray<T>&` handlers; a mismatch fails to bind. The async-action nodes
  in Blueprint have no such split.

## Related

- [Authentication](./authentication.md): a signed-in player is what every team call needs.
- [Avatars](./avatars.md)
- [Voice chat](./voice-chat.md)
- [Host election](./host-election.md)
- [Channels](../runtime/channels.md): a sibling group-like system that shares the same permission table.
- [Change pings and pull](../game-models/change-pings-and-pull.md): what teams are not, in this version.
- [Teams and Channels in Crowdy Studio](../studio/teams-and-channels.md): the same data, authored ahead of time.
