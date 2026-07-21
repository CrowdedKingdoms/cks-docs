---
slug: game-setup
sidebar_position: 3
title: Set up a game & entitle players
---

# Set up a game and give players access

Bringing a game online involves two roles:

- **The admin** (an org owner / studio) sets the game up: an organization, an app, and one or more **access tiers**.
- **Players** then get access to that app — either automatically (open‑by‑default) or by an explicit grant.

**Entitlements** — who may play, at which tier, and which runtime permission keys that tier carries — are defined here on the **Management API**. The **[Game API](/game-api/intro)** enforces them at runtime: on a player's first connect it mirrors the entitlement and provisions the matching world‑grid permissions, and **Buddy** (the UDP server) checks both app‑ and grid‑level permissions on every spatial message.

All operations below are available in the **[Management UI](/management-ui/intro)** and via GraphQL with a user session token or an **org API token**. Exact field names per version are in the **[schema reference](/management-api/reference/graphql-overview)**.

---

## 1. Admin: set up your game

### a. Create an organization

You become the org owner (full `manage_apps` / `manage_environments` permissions).

```graphql
mutation { createOrganization(input: { name: "Acme Games", slug: "acme" }) { orgId } }
```

### b. Create an app

Creating an app **automatically provisions a free, default access tier** holding the standard runtime permission keys (`access`, `teleport`, `update_voxel_data`, `use_voice_chat`). That single step makes the app **immediately playable** and is what enables open‑by‑default access (next section).

```graphql
mutation {
  createApp(input: { orgId: "ACME_ORG_ID", name: "My World", slug: "my-world", status: LIVE, visibility: PUBLIC }) {
    appId
  }
}
```

`createApp` requires the **`manage_apps`** permission on the org (org owners have it by default). `status` is one of `DRAFT`, `LIVE`, `ARCHIVED`; `visibility` is `PUBLIC`, `UNLISTED`, or `PRIVATE` (only `PUBLIC` + `LIVE` apps surface in the marketplace).

**Manage the app over its lifecycle** (also `manage_apps`):

```graphql
# Update metadata: name, description, visibility, status, metadata.
mutation { updateApp(appId: "APP_ID", input: { description: "Now with voxels", visibility: UNLISTED }) { appId } }

# Take an app offline without deleting it (sets status to ARCHIVED).
mutation { archiveApp(appId: "APP_ID") { appId status } }
```

Read an app's current state any time with the `app(appId)` query — including the routing fields (`gameApiUrl`, `splitMode`, `deploymentTarget`) covered in step **d**.

### c. (Optional) Define additional access tiers

Add tiers for premium/paid access, or to grant a narrower/broader set of permissions. List assignable keys with the `runtimePermissions` query.

```graphql
mutation {
  createAccessTier(input: {
    appId: "APP_ID",
    name: "Premium",
    isFree: false,
    isDefault: false,
    permissionKeys: ["access", "teleport", "update_voxel_data", "use_voice_chat"]
  }) { tierId }
}
```

Tier operations require the **`manage_access_tiers`** permission. Edit or retire tiers with `updateAccessTier(tierId, input)` and `archiveAccessTier(tierId)`, and list an app's tiers (no auth) with `appAccessTiers(appId)`.

> **Opting out of open‑by‑default:** if you do **not** want anonymous/auto access, remove (or never create) a tier that is both `isFree` **and** `isDefault`. Players then only get access through an explicit grant (below).

The four player-code keys (`write_server_code`, `run_server_code`,
`write_client_code`, `run_client_code`) are **not** in the generated default
tier. Add them only to tiers intended for authors or mod users; see
[Player code and owned grids](/game-api/player-code).

### c.1 (Optional) Censor player code with strict admission

New apps default to `IMPLICIT_ALLOW` (censorship off). To require studio
approval for every running player artifact:

```graphql
mutation {
  setAppCodeAdmissionMode(appId: "APP_ID", mode: ALLOW_LIST)
}
```

`ALLOW_LIST` is strict: self-authored code in its author's own grid still waits
for the code, author, or authoring org to be admitted. Deploy and compile remain
available; only execution is gated.

```graphql
mutation {
  admitAppCode(input: {
    appId: "APP_ID"
    subjectKind: AUTHOR
    subjectRef: "PLAYER_USER_ID"
  }) {
    admissionId
    admittedAt
  }
}
```

Use `appCodeAdmissions` to inspect active/history rows and
`revokeAppCodeAdmission` to drain admitted code. Writes require
`manage_compute`; reads require `view_compute_diagnostics`. Admission never
grants source access — closed source remains author-only with no moderation
override.

**Admission at scale (P4a).** Once the app has a marketplace catalog, the
moderation surface is `appCodeAdmissionQueue(appId)`: every listing joined
with its allow-list standing (`ADMITTED` / `PENDING` / `REVOKED`) and which
subject matched (the listing, its author, or its owning org). The wholesale
pattern is admitting an **org** once (`subjectKind: ORG`) so every listing
that org owns — current and future — is admitted; per-listing admission
remains for precise control. De-admission drains running installs exactly
like a run-key revocation. For a hostile listing, pair the catalog kill
(`setPlayerCodeListingStatus(..., status: KILLED)`) with the game-side
fleet-wide runtime kill
(`playerComputeSetSwitch(scope: "listing", listingRef: ...)`).

### c.1a (Optional) Choose how claims confer grid ownership (P4a)

Games differ on how a player comes to **own** a grid. Configure the app's
claim policy (requires `manage_apps`):

```graphql
mutation {
  setAppGridClaimPolicy(appId: "APP_ID", policy: SELF_CLAIM)
}
```

`SELF_CLAIM` (default) lets `claimGridOwnership` assign ownership directly;
`APPROVAL` turns claims into requests your designated approvers accept;
`INVITE` requires a standing invite; `MARKETPLACE_ONLY` refuses direct
claims so ownership arrives only through grid purchase (the purchase edge is
part of the real-money phase). Changing policy never revokes existing
ownership rows.

### c.2 (Optional) Bound player compute cost and take a markup

Player compute bills the **player's own wallet**, never the org — see
**[Player wallets & billing](/management-api/player-billing)**. Two knobs
belong to the studio:

- **Player policy** (`setPlayerWasmPolicy`, `manage_compute`): per-player or
  cohort clamps at `app_default` / `tier` / `grid` / `user` scope, including
  `unitsPerHour`/`unitsPerDay` compute quotas, `maxCompilesPerHour`, and
  runtime budgets. Quotas protect world health independent of anyone's
  ability to pay.
- **Rate-card markup** (`setPlayerRateMarkup`, `manage_billing`): basis
  points added on the platform's base player rates — the studio's usage
  revenue, always itemized separately in the player's spend history.

`appPlayerUsage` (`view_compute_diagnostics`) shows per-player consumption;
`appPlayerMarkupAccrued` (`view_billing`) totals accrued markup income.

### d. Choose where the app runs

Your app needs a **Game API** to serve runtime traffic. Today you provision a **developer sandbox** and link your app to it; that gives the app a `gameApiUrl` and turns on split‑mode routing. See **[Dedicated environments](/management-api/dedicated-environments)** for the step‑by‑step flow.

> **Availability:** the **developer sandbox** (`environmentClass: "dev_single"`) is available now. **Shared platform hosting** (`publishAppToShared`) and **multi‑VM dedicated** environments are **coming soon** — the API rejects them for non‑preview accounts today.

Whichever hosting you use, query the app's routing fields (`gameApiUrl`, `splitMode`, `deploymentTarget`) before a player joins so the client connects to the right **Game API**. See **[Shared environment & billing](/management-api/shared-environment)** for the shared model and routing fields, and **[Loading an app's Game API](/crowdyjs/shared-environment-routing)** for the client walkthrough.

---

## 2. How players get access

There are two paths — most public games use the first.

### Open‑by‑default (zero‑friction)

If the app has a **free + default** tier (the one `createApp` made for you), then **any player is automatically granted that tier the first time they connect** — no per‑player admin action. The Game API resolves the entitlement on connect, mirrors it into the per‑tenant game database, and grants the player the app's default **world‑grid permissions**. From that point Buddy authorizes their spatial traffic.

### Explicit grant (admin‑controlled)

For premium tiers, or for apps that opted out of open‑by‑default, the admin grants a specific player a specific tier:

```graphql
mutation { grantAppAccess(input: { appId: "APP_ID", userId: "PLAYER_USER_ID", tierId: "TIER_ID" }) { appUserAccessId status } }
```

Revoke a player's access with `revokeAppAccess(appId, userId)`. Granting and revoking both require **`manage_access_tiers`**.

The grant propagates to the Game API automatically (the matching grid permissions are provisioned server‑side via replica‑sync), so the player is authorized end to end — again with no direct database access.

---

## 3. The player's flow

1. **Register or log in** through the Management API (`register` / `login`) — returns the **identity session token**. (Browser games can use the SDK's guest/anonymous auth; see **[CrowdyJS](/crowdyjs/intro)** and the **[Build a game](/build-a-game/intro)** tutorial.)
2. **Mint an app token** for this app — `mintAppToken` (native/same-origin) or the browser portal flow (`client.portal`). This is the **app-scoped token** used for gameplay; the session token is rejected by the Game API. The first mint auto-grants access on free tiers. See **[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)**.
3. **Connect** with [CrowdyJS](/crowdyjs/intro), the [Unreal SDK](/unreal-sdk/intro), or a raw UDP client, pointed at the app's `gameApiUrl` (returned by the mint), sending the app-scoped token as the Bearer.
4. **Play** — send actor, voxel, text, audio, and client‑event updates. The Game API and Buddy authorize each message against the player's tier and grid permissions. Refresh the app token (`refreshAppToken`) before it expires.

---

## What happens under the hood

```
Management API                         Game API (per app `gameApiUrl`)            Buddy (UDP)
──────────────                         ──────────────────────────────            ───────────
app + access tier (free, default)
        │  open-by-default on 1st connect (or explicit grantAppAccess)
        └────────────────────────────► mirror app_user_access
                                        + grant default world-grid permissions ──► enforces app + grid
                                                                                    permissions per message
```

A player with an **active tier** on an app is authorized everywhere that matters — no manual grid setup, no database writes by the integrator.

---

## Quick reference

| Goal | Admin does | Players get access via |
| ---- | ---------- | ---------------------- |
| Open/public game | `createApp` (keeps the free default tier) | Open‑by‑default on first connect |
| Invite‑only / paid | `createApp`, then remove the free default tier and define paid tiers | Explicit `grantAppAccess` per player (or after purchase) |
| Premium tier on an open game | `createApp` + `createAccessTier` (premium) | Free tier auto; premium via `grantAppAccess` |

See the **[GraphQL schema reference](/management-api/reference/graphql-overview)** for exact inputs, and the **[Dev tier](/management-ui/dev-tier)** page for integration‑testing endpoints.
