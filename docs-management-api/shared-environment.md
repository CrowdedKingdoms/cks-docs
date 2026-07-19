---
sidebar_position: 30
title: Shared environment & billing
---

# Shared environment & billing

The **shared environment** is the primary way to ship a game on Crowded Kingdoms: create your app on the **shared platform** and your players connect to a single, managed Game API scoped by your `appId`. You do not provision or run any infrastructure.

:::tip[Live on dev tier]
The shared platform is **generally available** on the dev tier. Create an app through **[Get started](/management-ui/create-your-first-app)** or `createApp` with shared deployment — it is **immediately active** after create. Test and production tiers follow the same model as they are promoted.
:::

There are two deployment models in the platform:

- **Shared environment** (customer default) — your app runs on the shared Game API, scoped by your
  `appId`. Free to start; you pay only for metered usage above a free
  allowance.
- **Dedicated environment** (operator-provisioned) — an isolated Game API + database + replication
  stack. Not self-service in the customer portal — contact Crowded Kingdoms for enterprise isolation. API reference: **[Dedicated environments](/management-api/dedicated-environments)**.

This page covers the shared environment.

## Free tier

- Every organization can create up to **`platformConfig.freeAppsPerOrg`** apps on the shared
  environment (default **3**).
- Each app includes a small **free hourly usage allowance** per metered
  dimension (network bytes, message/operation counts, resolver time, and — for
  server-side logic — automation compute units and
  [compute-module](/game-api/compute-modules) usage: `wasm_compute_units`,
  `wasm_egress_msgs`, `wasm_egress_bytes`).
- Within the free allowance the app runs at no cost. When an app exceeds its
  free hourly allowance, usage above the allowance is billed from your
  organization wallet at the published rate card.

Check your remaining free slots:

```graphql
query {
  orgFreeAppQuota(orgId: "123") {
    quota
    usedFree
    paidApps
    remainingFree
  }
}
```

## Creating an app (shared by default)

New apps created through the Management UI **Get started** wizard or `createApp` with shared deployment go live on the shared Game API immediately:

```graphql
mutation {
  createApp(input: {
    orgId: "123"
    name: "My Game"
    slug: "my-game"
    deploymentTarget: "shared"
  }) {
    appId
    deploymentTarget
    runtimeStatus
    gameApiUrl
  }
}
```

When create succeeds, expect:

- `deploymentTarget` = **`shared`**
- `runtimeStatus` = **`active`**
- `gameApiUrl` = the tier's shared endpoint (discover via `platformConfig` if unset in the response)

No separate provisioning step or `publishAppToShared` call is required for new shared apps.

### Publishing legacy or migrated apps

If you have an app that was created before shared-by-default, you can still publish it explicitly:

```graphql
mutation {
  publishAppToShared(appId: "456") {
    appId
    free
    checkout {
      externalUrl
    }
  }
}
```

- If you're under your free quota, `free` is `true` and the app goes live
  immediately — no payment.
- Beyond the free quota, pass a `planId` (from `sharedEnvPlans`) and a
  `provider` to start a recurring subscription for a **paid app slot**. The
  mutation returns a `checkout.externalUrl`; redirect the studio there to
  complete the subscription. The app goes live once the subscription is active.

```graphql
query {
  sharedEnvPlans {
    planId
    name
    priceCents
    currency
    billingInterval
  }
}
```

## Paying for usage

Usage is billed from your **organization wallet** (a prepaid balance). Top the
wallet up with a checkout, then usage above the free allowance is debited
automatically.

### Spend caps

Cap how much an app can spend per hour and/or per day. Once a cap is reached the
app is denied until the window resets (or you raise the cap):

```graphql
mutation {
  setAppSpendCaps(appId: "456", hourlyLimitCents: "500", dailyLimitCents: "5000") {
    runtimeStatus
    runtimeDenialReason
  }
}
```

Pass `null` for a limit to clear it.

### Auto-billing

Instead of (or in addition to) manual top-ups, an org owner can enable
**auto-billing**: when the wallet can't cover usage, the saved payment method is
charged automatically to top the wallet back up — up to a limit you set, or with
**no limit**. With auto-billing off, an app is simply denied when the wallet runs
dry; with it on, the app keeps running until your auto-billing limit is reached.

```graphql
mutation {
  setAutoBilling(orgId: "123", enabled: true, limitCents: "10000") {
    enabled
    limitCents
    autoBilledThisPeriodCents
  }
}
```

Set `limitCents: null` for no limit. Add a card first with
`setupSharedPaymentMethod`.

## What "access denied" means

When an app can't serve traffic, `appRuntimeState` reports a `runtimeStatus`
other than `active` and a `runtimeDenialReason`:

- `free_allowance` — the free hourly allowance is exhausted. Fund the wallet (or
  enable auto-billing), or wait for the hour to reset.
- `insufficient_funds` — the wallet is empty and auto-billing can't cover it.
  Top up the wallet.
- `spend_cap` — an hourly/daily spend cap was reached. Raise the cap or wait for
  the window to reset.
- `subscription_lapsed` — a paid app slot's subscription isn't active. Renew it.

```graphql
query {
  appRuntimeState(appId: "456") {
    deploymentTarget
    runtimeStatus
    runtimeDenialReason
    walletBalanceCents
    currentHourUsageCents
    currentDayUsageCents
    hourlyLimitCents
    dailyLimitCents
  }
}
```

While an app is denied or suspended, the Game API and realtime layer refuse new
connections for that `appId` with a reason-bearing error, so your client can
prompt the studio to fund the wallet, raise a cap, or renew. Server-driven work
pauses too: [autonomous processes](/game-api/autonomous-processes) and
[compute modules](/game-api/compute-modules) are deactivated until the app is
`active` again.

## Connecting clients

Clients discover the shared Game API URL programmatically — never hard-code tier-specific hosts in production.

The public `platformConfig` query (no auth) returns the shared endpoints:

```graphql
query {
  platformConfig {
    sharedGameApiUrl
    sharedGameApiWsUrl
    freeAppsPerOrg
  }
}
```

Query the app directly for routing fields — `gameApiUrl` is set for shared apps after create:

```graphql
query {
  app(appId: "456") {
    appId
    deploymentTarget   # "shared"
    runtimeStatus
    gameApiUrl         # shared endpoint for this tier
  }
}
```

**`mintAppToken`** returns `gameApiUrl` / `gameApiWsUrl` alongside the app-scoped gameplay token — the most convenient path when wiring clients after sign-in.

Point your client (or a second `CrowdyClient`) at that `gameApiUrl`, and pass the
same `appId` when you open the realtime subscription — the session is app-scoped.
For the SDK walkthrough see
[Loading an app's Game API](/crowdyjs/shared-environment-routing).
