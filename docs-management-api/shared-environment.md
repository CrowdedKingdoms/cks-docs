---
sidebar_position: 30
title: Shared environment & billing
---

# Shared environment & billing

The **shared environment** is the primary way to ship a game on Crowded Kingdoms: create your app on the **shared platform** and your players connect to a single, managed Game API scoped by your `appId`. You do not provision or run any infrastructure.

:::tip[Sandbox and production]
The shared platform is **generally available**. Create an app through **[Get started](/management-ui/create-your-first-app)** or `createApp` with shared deployment — it is **immediately active** after create. Sandbox and production follow the same model.
:::

There are two deployment models in the platform:

- **Shared environment** (customer default) — your app runs on the shared Game API, scoped by your
  `appId`. Free to start; you pay only for metered usage above a free
  allowance.
- **Dedicated environment** — **retired without replacement.** There is no customer-provisioned
  stack and no API for one; contact Crowded Kingdoms if you need enterprise isolation.
  Every app uses the shared platform (`publishAppToShared`).

So in practice there is one model, and this page describes it.

## Free tier

- Every organization can create up to **`platformConfig.freeAppsPerOrg`** apps on the shared
  environment (default **3**).
- Each app includes a **monthly development quota**, per UTC calendar month:
  **5 GB of client egress**, **5 GB of client ingress** (decimal GB: 1 GB =
  1,000,000,000 bytes), **20 CPU-hours of compute** pooled across GraphQL
  resolvers and your app's [ck-exec](/exec/intro) code,
  **1 GB-month of stored data**, and **1 GB of compute-module writes** (what your
  hubs write when they save their state). Egress is the headline number and the
  one most games reach first. Unused quota does not roll over.
- **The quota runs a small game's hubs unfunded.** A hub saves its state on every
  persist interval, so its writes are roughly its state size times the persist
  rate times the hours it runs: a four-player game with about six hubs holding
  100 KB between them, saving every 30 seconds, writes about 12 MB per hour of
  play, so the 1 GB covers roughly 80 hours a month. Rows a hub writes have no
  allowance.
- **ck-exec instance limits follow funding.** An app whose organization cannot be
  charged (no spendable wallet balance, no auto-billing) may run **16 hub
  instances reserving 1 GB of memory** per datacenter at once; an organization
  that can be charged gets **16,384 instances and 64 GB**. Past either limit the
  next instance is refused until some stop; running ones are left alone. See
  [limits](/exec/operations#usage-and-budgets).
- **Stored input logs have no free allowance.** An app records nothing until an
  org member with `manage_apps` turns on replay logging
  (`replayLoggingEnabled: true` on `updateApp`), which is refused with
  `INPUT_LOG_FUNDS_NEEDED` unless the org wallet has a spendable balance. See
  [Input logging](/replication-api/input-logging).
- **You are billed for bytes, CPU and storage — never for counts.** A datagram,
  an API operation or a notification is paid for by the bytes it moves and the
  CPU it takes; there is no per-message, per-operation or per-notification rate
  on the card (the count dimensions were retired on 2026-09-06).
- Within the quota the app runs at no cost. Above it, usage is billed from your
  organization wallet at the published rate card **as it arrives**: each
  dimension's month-to-date total is rounded up to the next whole cent once, and
  the wallet is debited as the total crosses each cent, within about a minute of
  the usage. The hourly rows on the Plan and Usage tab itemise what was used and
  what was charged during each hour; they are a statement, not a separate charge.
- A free app that has never been funded is also **shaped to roughly 1 MB/s** of
  egress. That cap is lifted by funding the org wallet or enabling
  [auto-billing](#auto-billing) — not by buying a reservation. Once an
  organization can be charged, CK does not rate-limit its egress, and spend is
  bounded by the [caps you set](#spend-caps) rather than by a throughput ceiling.

**What counts as a billed byte.** Egress only: bytes the service delivers to your
clients. Ingress — what your clients send — is metered and visible in usage, but
does not count toward the monthly volume or its allowance. Volume is measured as
wire bytes at the network interface, so it includes the transport and network
headers each frame carries, and it is counted after any compression the service
applies. A `MESSAGE_BUNDLE` datagram carrying several messages is one frame and is
metered once, in either direction. A client-side byte counter will not match it. The full basis is in the
[Free Tier and Billing Basis](https://crowdedkingdoms.com/billing-basis.html).

**What counts as a stored input-log byte.** `input_log_storage_byte_hours` is
measured in recorded bytes: each input counts at its record size — the
`sizeBytes` that `inputLogMessages` returns, a fixed header plus the message —
before compression and replication, so you can add it up yourself. Each byte is
billed for exactly the input log's retention (7 days, 168 hours), so 1 GB
recorded is 168 GB-hours, 0.23 GB-month; it is priced per GB-month on the rate
card in your account and on the
[pricing page](https://crowdedkingdoms.com/pricing.html). `appUsageSummary`
reports an app's byte-hours and the bytes it holds now, and
`appUsageProjection` the month so far and a projection.

**Volume bands.** A line on the rate card can be priced in graduated volume
bands, and egress is: the more an app sends in a UTC calendar month, the lower
the rate on its next gigabyte. Each byte is charged at the rate of the band it
falls in, so reaching a higher band does not re-price the bytes below it. The
bands count each app's own egress from the start of the month, free quota
included (the 5 GB quota is the bottom of the first band), and the month's
total is still rounded up to the cent once. An app's rate for the month is set
at its first charge in that month, so a change to the rate card reaches an app
from its next month. The schedule is on the rate card in your account and on
the [pricing page](https://crowdedkingdoms.com/pricing.html). In the API,
`meteredRateCard` lists a banded line's `priceBands`: each band's `priceCents`
per the line's `unitQuantity` (a GB, for egress) and its upper edge
`upToUnits` in raw units (bytes, for egress; `null` on the last, open-ended
band). The line's own `priceCents` is the first band's rate, and a line priced
at one rate has no `priceBands`.

An app's [ck-exec](/exec/intro) code is metered minute by minute in compute
units: the greater of the CPU time and the fuel each minute used, so neither a
host stall nor unusually dense guest instructions under-report work. A
CPU-hour on the rate card is one core busy for one hour, and the price is the
rate card in your account and on the
[pricing page](https://crowdedkingdoms.com/pricing.html). Realtime events the
code sends count as replication egress, billed through the same monthly egress
aggregate as every other byte your app sends. See
[usage and budgets](/exec/operations#usage-and-budgets).

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

New apps created through the Management UI **Get started** wizard or `createApp` go live on the shared Game API immediately. `datacenter` is required: a `code` that `placeableDatacenters` lists as `placeable`.

```graphql
mutation {
  createApp(input: {
    orgId: "123"
    name: "My Game"
    slug: "my-game"
    datacenter: "or"
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
  }
}
```

Publishing is free. There is no paid app slot and no per-app fee (API Terms of
Service §3.7): every app runs on the shared environment, and what you pay for is
the usage it meters, drawn from your organization wallet as described below. The
`planId` and `provider` arguments still accepted by `publishAppToShared`, and the
`sharedEnvPlans` catalog, are deprecated leftovers of the retired slot model and
are ignored; do not pass them.

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

## Reserved capacity

Reserving capacity is optional and separate from paying for usage. It asks the
platform to **provision and hold** a minimum for your app, and it is sold in two
independent dimensions because a game may need a great deal of one and little of
the other:

- **Realtime (UDP) throughput**, in bytes/sec. Set with
  `setAppReservedThroughput`; read back as `app.reservedUdpBytesPerSec`.
- **API request rate**, in GraphQL operations/sec, as
  `app.reservedGraphqlOpsPerSec`.

Reserving one does not reserve the other.

Three things a reservation is **not**:

1. **Not a ceiling.** It obliges CK to keep that much capacity in service for
   you; it does not cap what you may send. Use above the reserved rate is metered
   like any other usage rather than refused.
2. **Not a data allowance.** The monthly fee buys **capacity, not volume**. It is
   charged *in addition to* metered usage and includes no bytes of its own —
   reserving 5 MB/s does not make the first 5 MB/s free.
3. **Not how you lift the free-tier cap.** Funding a wallet does that (see
   [Free tier](#free-tier)). Before 2026-09-01 a reservation doubled as a
   rate-limit bypass; it no longer does.

Billed monthly from the org wallet whether or not the capacity is used; upgrades
are prorated for the current month, and lowering or clearing a reservation charges
nothing. Requires `manage_billing` on the app's organization.

## What "access denied" means

When an app can't serve traffic, `appRuntimeState` reports a `runtimeStatus`
other than `active` and a `runtimeDenialReason`:

- `insufficient_funds` — the app needs to be paid for and cannot be: it is past a
  free allowance and the wallet is empty with auto-billing unable to cover it.
  Top up the wallet or enable auto-billing. (An app still inside its allowances
  is not denied at all, so this reason covers both "out of allowance" and "out of
  money" — they are the same situation.)
- `spend_cap` — an hourly/daily spend cap was reached. Raise the cap or wait for
  the window to reset.
- `subscription_lapsed` — retired with the paid app slot; no current app can carry
  this reason. Listed because the enum still names it.

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

While an app is denied, nothing is delivered for it, and every path tells your
client why so it can say "this world is paused" instead of showing an empty one:

- **Sign-in still works.** `mintAppToken` and `refreshAppToken` return the token
  with a `runtimeGate` (`status` and `reason`; no wallet figures), and
  `gameClientBootstrap` returns the same `runtimeGate` instead of failing.
- **Realtime refuses.** The GraphQL realtime proxy refuses to connect with
  `APP_PAUSED` (carrying the reason). A direct or relayed session gets a generic
  error with code **33 (`APP_PAUSED`)** in answer to a send, at most once every
  few seconds per session; see [error codes](/replication-api/operations).
- **Hubs pause.** The app's [ck-exec](/exec/operations#usage-and-budgets) code is
  switched off entirely, and a refused call names the cause ("app 456 is paused:
  its organization has no funds (insufficient_funds)").

Everything resumes by itself within a minute of the app becoming `active` again:
fund the wallet, raise the cap, or renew.

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
