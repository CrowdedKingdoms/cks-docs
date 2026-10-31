---
sidebar_position: 14.6
title: Safety reports and moderation
---

# Safety reports and moderation

A player reports another player of the same app from your game, or your app's code files the
report for them. Moderators in your organization review it with what the app's
[safety log](/replication-api/input-logging#the-safety-log) recorded of both players around the
moment, and resolve it, or record that it was reported to NCMEC's CyberTipline. Each report's
evidence is preserved, so it outlasts the log's 7 days and the reported player deleting their
account.

:::info[What is switched on]

- **Live** (Game API v2.60.0): filing (`fileSafetyReport`, and the hub node call `safety.report`),
  moderators (`moderate_safety`), reviewing, resolving and escalating, the preserved evidence, and
  the legal hold on a reported account that is deleted.
- **Being built:** an app that admits players under 18 needs at least one moderator in its
  organization; without one, its players under 18 are refused sign-in and Studio warns its
  developers. And every report with the reason `CHILD_SAFETY` also reaches Crowded Kingdoms'
  own moderators, across all games, with an alert to `abuse@crowdedkingdoms.com`; reports with
  other reasons stay with each game's moderators.

:::

## Filing a report

With the reporting player's app-scoped token, sent to the app's datacenter:

```graphql
mutation Report($input: FileSafetyReportInput!) {
  fileSafetyReport(input: $input) { reportId filedAt }
}
# variables: { "input": { "appId": "42", "reportedUserId": "778",
#   "reportedActorUuid": "0123456789abcdef0123456789abcdef", "reason": "HARASSMENT",
#   "details": "Kept following me and spamming chat.", "occurredAt": "2026-10-30T18:04:00Z" } }
```

| Field | What |
|---|---|
| `reportedUserId` | the player reported, one of the app's players |
| `reportedActorUuid` | optional: their actor, the 32-character id in hex as the SDKs make it (a dashed uuid is accepted too) |
| `reason` | `CHILD_SAFETY`, `HARASSMENT`, `SEXUAL_CONTENT`, `HATE`, `SELF_HARM`, `CHEATING` or `OTHER` |
| `details` | optional: the reporter's words, at most 1,000 characters |
| `occurredAt` | when it happened, within the past year |

- The reported player is not told.
- Refusals: `NOT_FOUND` for a player the app does not know; `BAD_USER_INPUT` for a report about
  oneself, an unknown reason, details over 1,000 characters, an `occurredAt` outside the past year
  or an actor id that is not hex; `RATE_LIMITED` after 20 reports in an hour by one player in one
  app.
- Your app's code on ck-exec files one with the node call
  [`safety.report`](/exec/players-and-safety#reports), for example from an in-game report command.

## What a report preserves

Filing a report links both players' recorded sessions from 15 minutes before `occurredAt` to the
filing (at most 100), and copies into a secure store:

- the recorded inputs of those sessions, from the app's safety log;
- both players' account records;
- the reported player's last known network address (a Crowded Kingdoms account's; a managed
  player has none);
- what your app's hubs hold about each player ([their export](/exec/players-and-safety#export)).

The copy is kept while the report is open, deleted when it is resolved, and kept for a year from the
CyberTipline submission when it is escalated. An app whose safety log is off records no inputs, so
its reports preserve everything above but them.

## Moderators

A moderator holds `moderate_safety`, an organization permission. The organization's admins hold
it; give it to others with a role:

```graphql
mutation Moderators($orgId: BigInt!) {
  createOrgRole(input: { orgId: $orgId, roleName: "Moderator", permissions: ["moderate_safety"] }) {
    orgRoleId
  }
}
# then updateOrgMemberRoles(orgId, userId, roleIds: [...their roles, orgRoleId]) gives a member
# the role. Both need manage_members.
```

`moderate_safety` lets its holder list, resolve and escalate the reports about the players of the
organization's apps, and read the recorded sessions a report covers, and nothing else of the safety
log. Every such read is audited.

## Reviewing

With the moderator's identity session token, sent to the app's datacenter:

```graphql
query Open($appId: BigInt!) {
  safetyReports(appId: $appId, status: OPEN, first: 50) {
    reportId reason details occurredAt filedAt
    reporterUserId reportedUserId reportedActorUuid
    sessions
    capture { status objects expected retainUntil }
  }
}
```

- Newest first, with open `CHILD_SAFETY` reports ahead of the rest. `status` is optional; `first`
  is at most 200.
- `sessions` are the recorded sessions the report covers. Read one with
  [`inputLogMessages`](/replication-api/input-logging#read-it)`(appId, gameTokenId)` and an
  app-scoped token for the app (a moderator may mint one for the app, as an app admin may), while
  the report is open or escalated.
- `capture.status` says where the preserved copy stands: `PENDING` (nothing copied yet; it is
  retried every minute), `PARTIAL`, `COMPLETE`, or `DISCARDED` (resolved, and deleted).

## Deciding

```graphql
mutation Resolve($appId: BigInt!, $reportId: BigInt!) {
  resolveSafetyReport(appId: $appId, reportId: $reportId,
    outcome: "Warned the player; muted for 24 hours.") { status resolvedAt }
}

mutation Escalate($appId: BigInt!, $reportId: BigInt!) {
  escalateSafetyReport(appId: $appId, reportId: $reportId, ncmecReportId: "123456789") {
    status ncmecSubmittedAt capture { retainUntil }
  }
}
```

- **Resolve** closes an open report with what was decided and done (at most 1,000 characters). Its
  preserved copy is deleted, and a legal hold the reported account got when it was deleted is
  released, so that deletion goes ahead. Resolving it again changes nothing; an escalated report
  cannot be resolved (`BAD_REQUEST`).
- **Escalate** records that the report was submitted to NCMEC's CyberTipline, under the id NCMEC
  gave the submission. The preserved copy is kept for a year from now, and nobody can delete it
  sooner; so is the reported account's legal hold. Escalating again under the same id changes
  nothing, under another id is `CONFLICT`, and a resolved report cannot be escalated
  (`BAD_REQUEST`).
- **Act on the player** with the app's own tools: [suspend or revoke](/management-api/game-setup#revoking-suspending-and-banning)
  their access, or take away a permission key.

Crowded Kingdoms reports apparent child sexual exploitation to NCMEC and keeps what the law
requires for that report; its [Safety](https://crowdedkingdoms.com/safety.html) page tells players
and parents where to go, `abuse@crowdedkingdoms.com` included.

## When a reported player deletes their account

Deleting an account that an open or escalated report is about first puts it under a legal hold,
one per report. A player's own deletion still closes the account, but its content and identity are
kept until the report is resolved, or for a year from the submission when it is escalated. An
organization's `deleteManagedPlayer` is refused `LEGAL_HOLD`: disable the player instead. A report
filed about an account already deleted holds it at once.

## What your game shows

- **A report option** wherever players meet, beside [block](communication#blocks), that asks the
  reason and, optionally, what happened. Fill in `occurredAt` and the actor yourself where you
  know them.
- **A confirmation** that the report was received (`filedAt`), and no outcome: the reporter is not
  told what a moderator decides.
- **The [Safety](https://crowdedkingdoms.com/safety.html) page**, for what a game cannot handle: a
  child in danger, or an intimate image shared without consent.

## Errors

| Code | When |
|---|---|
| `NOT_FOUND` | The reported player is not one of the app's players. |
| `BAD_USER_INPUT` | A report about oneself, an unknown reason, details over 1,000 characters, `occurredAt` outside the past year, or an actor id that is not hex. |
| `RATE_LIMITED` | More than 20 reports in an hour from one player in one app. |
| `FORBIDDEN` | `safetyReports`, `resolveSafetyReport` or `escalateSafetyReport` without `moderate_safety` on the app. |
| `BAD_REQUEST` | Resolving an escalated report, or escalating a resolved one. |
| `CONFLICT` | Escalating a report again under a different CyberTipline id. |
| `LEGAL_HOLD` | `deleteManagedPlayer` for a player an open or escalated report is about. |

All codes are on [Error codes](/overview/error-codes).
