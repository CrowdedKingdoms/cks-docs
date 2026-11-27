---
sidebar_position: 30
title: Shared environment & billing
---

# Shared environment & billing

The **shared environment** is the primary way to ship a game on Crowded Kingdoms: create your app on the **shared platform** and your players connect to a single, managed Application API scoped by your `appId`. You do not provision or run any infrastructure.

:::tip[Sandbox and production]
The shared platform is **generally available**. Create an app through **[Get started](/management-ui/create-your-first-app)** or `createApp` with shared deployment — it is **immediately active** after create. Sandbox and production follow the same model.
:::

There are two deployment models in the platform:

- **Shared environment** (customer default) — your app runs on the shared Application API, scoped by your
  `appId`. Free to start; you pay only for metered usage above a free
  allowance.
- **Dedicated environment** — self-serve dedicated and sandbox stacks were **retired**; private
  environments exist only by Enterprise Agreement. There is no stack to provision yourself and no
  API for one; contact Crowded Kingdoms if you need one
  ([what to send](/overview/organization-limits#a-dedicated-environment-needs-an-enterprise-agreement)).
  Every app uses the shared platform (`publishAppToShared`).

So in practice there is one model, and this page describes it.

## Free tier

- An organization can create any number of apps on the shared environment, and
  its apps share **one monthly development quota**, per UTC calendar month, worth
  three apps' quotas however many apps it has: **15 GB of client egress**,
  **15 GB of client ingress** (decimal GB: 1 GB = 1,000,000,000 bytes),
  **60 CPU-hours of compute** pooled across GraphQL resolvers and your apps'
  [ck-exec](/exec/intro) code, **3 GB-months of stored data**, **3 GB of
  compute-module writes** (what your hubs write when they save their state), and
  **730 GB-hours of reserved memory** (what your compute modules reserve: 1 GB held
  all month, for the whole organization). Any app may use all of it, and making
  more apps does not add to it. Usage is set
  against what is left as it arrives, and what an app has used free stays free;
  once the quota is used up, every app's usage is billed from the organization
  wallet. Egress is the headline number and the one most games reach first.
  Unused quota does not roll over.
- **The quota has been the organization's since November 2026.** Before then each
  app had its own, a third of the organization's (5 GB, 5 GB, 20 CPU-hours,
  1 GB-month, 1 GB). An app that used a meter in November 2026 before the 19th
  keeps its own quota for that meter until November 30; from December 1 every app
  shares. `allowancePool` returns when sharing started (`effectiveFrom`), how
  many apps' quotas the organization's is worth (`factor`) and whether the
  current month shares (`pooledNow`); `orgUsageProjection` reports
  `allowancePooled` and, for each shared meter, the quota (`poolUnits`) and how
  much of it is used (`usedUnits`) in `allowancePools`.
- **Egress and ingress follow the organization's tier** from December 1, 2026; the
  rest of the quota is the same at every tier. See [Free data tiers](#free-data-tiers).
- **An organization that cannot be charged may have 10 apps** (no spendable wallet
  balance, no auto-billing): creating an 11th, or restoring an archived app past
  10, is refused with `APP_LIMIT_REACHED` until it funds its wallet, turns on
  auto-billing or archives an app. Archived apps don't count, and no app is ever
  removed. `orgAppLimit(orgId)` reports the count, the funding and the cap. New
  apps are created **unlisted**: the marketplace lists an app only once it is set
  `PUBLIC` (`updateApp`).
- `platformConfig.freeAppsPerOrg` (default **3**) is how many free app slots the
  deprecated `orgFreeAppQuota` counts; the slots were a count only and never
  changed what is free or billed.
- **The quota runs a small game's hubs unfunded.** A hub saves its state on every
  persist interval, so its writes are roughly its state size times the persist
  rate times the hours it runs: a four-player game with about six hubs holding
  100 KB between them, saving every 30 seconds, writes about 12 MB per hour of
  play, so the 3 GB covers roughly 250 hours a month. Writes are charged by the
  byte only; how many rows a save touches does not matter.
- **Reserved memory is what your instances hold, whatever they use.** Each running
  hub reserves its type's memory limit (64 MiB unless the manifest sets
  `memory_mb`), a spoke that times its copies (16 by default), and a player's mod
  32 MiB, until the instance stops. Your players' mods count toward your
  organization's reserved memory, although their CPU bills their own wallets. A
  four-player Game Kit starter reserves about 576 MiB, about 440 GB-hours a month,
  inside the quota. An app that was already reserving memory in the month the rate
  was posted keeps it free until that month ends. See
  [Usage and budgets](/exec/operations#usage-and-budgets).
- **ck-exec instance limits follow funding.** An organization that cannot be
  charged (no spendable wallet balance, no auto-billing) may run **16 hub
  instances reserving 1,024 MB of memory** per datacenter at once **across all of its
  apps**; an organization that can be charged gets **16,384 instances and 65,536 MB
  for each app**, and Crowded Kingdoms can set a higher limit for it
  ([how to ask](/overview/organization-limits#funding-raises-your-compute-limit-and-crowded-kingdoms-can-set-a-higher-one)).
  Past either limit the next instance is refused until some stop;
  running ones are left alone. See
  [limits](/exec/operations#usage-and-budgets). An organization that holds its whole
  1,024 MB ceiling all month reserves about 780 GB-hours, a little more than the quota,
  so without a funded wallet its apps are refused near the end of a 30- or 31-day
  month.
- **Stored input logs have no free allowance.** An app records nothing until an
  org member with `manage_apps` turns on replay logging
  (`replayLoggingEnabled: true` on `updateApp`), which is refused with
  `INPUT_LOG_FUNDS_NEEDED` unless the org wallet can spend the projected cost of
  keeping one retention period of the app's recent traffic. Every message a client
  sends is recorded once it is on, keep-alives included (about 50 to 110 bytes a
  second for a connected player who does nothing), and recordings already kept go
  on being billed after it is turned off, until they age out. See
  [Input logging](/replication-api/input-logging).
- **You are billed for bytes, CPU, storage and reserved memory — never for counts.** A datagram,
  an API operation, a notification or a row a hub writes is paid for by the bytes
  it moves or writes and the CPU it takes; there is no per-message,
  per-operation, per-notification or per-row rate on the card (the message and
  operation counts were retired on 2026-09-06, rows written by compute modules
  on 2026-10-12).
- Within the quota your apps run at no cost. Above it, usage is billed from your
  organization wallet at the published rate card **as it arrives**: each
  dimension's month-to-date total is rounded up to the next whole cent once, and
  the wallet is debited as the total crosses each cent, within about a minute of
  the usage. The hourly rows on the Plan and Usage tab itemise what was used and
  what was charged during each hour; they are a statement, not a separate charge.
- **Nothing slows an app for being free.** CK does not rate-limit any app's
  egress, funded or not. An app past a free allowance whose organization cannot be
  charged is denied rather than slowed (`insufficient_funds`, see
  [What "access denied" means](#what-access-denied-means)), and a funded app's
  spend is bounded by the [caps you set](#spend-caps). Until 2026-11-09 an unfunded
  app was also capped at about 1 MB/s; it no longer is.

### Free data tiers

An organization's free egress and free ingress a month, each, follow its tier.
Compute, stored data, compute-module writes and reserved memory are the same at
every tier.

| Tier | Egress and ingress, each, a month | Condition |
|---|---|---|
| Base | 15 GB | Every organization |
| Domain | 100 GB | A member has confirmed an email address at the domain the organization gives as its own; free email providers' domains do not count |
| Profile | 200 GB | The organization has completed its project profile, and Crowded Kingdoms has approved it |
| Measured | 500 GB | One of its apps had at least 10 different player accounts, not the organization's members, play on at least 3 of the last 7 UTC days |

- **A tier applies from the start of the next month.** A check at 23:30 UTC every
  day sets each organization's tier for the next month: the highest whose
  condition it meets. A month's quota is fixed when the organization's apps first
  draw on it, so a tier reached mid-month waits for the next one, and so does a
  lower one. Saving the profile or the domain checks again at once. Tiers apply
  from December 1, 2026.
- **A written agreement** can give an organization a larger free allowance for
  whole months; when it ends, the organization has the tier its conditions give it.
  [What your organization can change](/overview/organization-limits#you-reach-two-free-data-tiers-yourself-and-crowded-kingdoms-decides-two-more)
  says which tiers you reach yourself, which Crowded Kingdoms decides, and what to
  send to ask for an agreement.
- **Where to see it.** Studio's Plan and Usage tab, or `orgFreeTier(orgId)`
  (`view_billing`): `thisMonth` and `nextMonth` (each a `level` and its
  `gigabytes`), `earnedLevel`, each condition's state (`conditions`),
  `ownDomain`, `measuredQualifyingDays` and `agreements`. `freeTierLevels`
  (public) lists the tiers, the Measured thresholds and `effectiveFrom`, the
  first month tiers apply on this environment (null while they do not). The API
  calls a tier a level (`FreeTierLevel`: `BASE`, `DOMAIN`, `PROFILE`, `MEASURED`,
  `AGREEMENT`).
- **The domain.** `setOrgOwnDomain(orgId, domain)` (`manage_billing`) takes a host
  name such as `studio.com` (a URL or `@studio.com` is tidied to it) and clears it
  with `null`; a free email provider's domain is refused with
  [`FREE_EMAIL_DOMAIN`](/overview/error-codes). A member's confirmed account email
  at the domain, or at one of its subdomains, meets the condition.
- **The project profile.** Seven questions about what the organization is
  building, the last one optional (`anythingElse`), read with
  `orgProjectProfile(orgId)` (`view_billing`) and saved with
  `setOrgProjectProfile(input)` (`manage_billing`): an omitted field keeps its
  answer and `null` clears it. `completedAt` is set while every answer but the
  last is in; `startingFromScratch: true` answers the networking question in
  place of `currentNetworking` and its cost.
- **Crowded Kingdoms reviews a complete profile** before the Profile tier
  applies, and promises no time for it. `status` (on the profile, and
  `profileStatus` on `orgFreeTier`) is `INCOMPLETE`, `WAITING_FOR_REVIEW`,
  `APPROVED` or `DECLINED`; `reviewedAt` is when Crowded Kingdoms decided. An
  approved profile earns the tier from the start of the next month. A decision
  stands when answers change; an incomplete profile earns nothing until it is
  complete again.
- **Usage reporting follows the tier.** `orgUsageProjection`'s
  `totalFreeAllowanceBytes` and `allowancePools` report the egress and ingress
  quotas at the organization's tier.
- The terms are the [Free Tier and Billing Basis](https://crowdedkingdoms.com/billing-basis.html)
  §3.5.

**What counts as a billed byte.** Both directions, each against its own monthly
allowance and at its own rate on the rate card: egress, the bytes the service
delivers to your clients, and ingress, the bytes your clients send to it (priced
since 2026-09-06). Volume is measured as wire bytes at the network interface, so it includes the transport and network
headers each frame carries, and it is counted after any compression the service
applies. A `MESSAGE_BUNDLE` datagram carrying several messages is one frame and is
metered once, in either direction. Keep-alives count as ingress too (from replication
server v0.48.0): an idle player sending a heartbeat every 2 s sends about 0.3 MB an
hour. A client-side byte counter will not match it. The full basis is in the
[Free Tier and Billing Basis](https://crowdedkingdoms.com/billing-basis.html).

**Estimating a game's bill.** The pricing page's
[cost estimator](https://crowdedkingdoms.com/pricing.html#calculator) counts wire bytes
the way the meter does: each delivered message's 79 bytes of framing and its share of
its datagram's 75, and the copy of each update that comes back to its sender. Its
Guided mode walks through a game a step at a time, and its
[scenario library](https://crowdedkingdoms.com/pricing.html#scenarios) starts from 62
kinds of game at four sizes under 12 usage patterns. Both price at the published rate
card, hour by hour across a month. It is an estimate, not a quote. Studio's Pricing page and
each app's **Usage & Billing** tab run the same estimator, scenarios included, priced at your
environment's rate card, so the same game gets the same estimate in all three places.

**What counts as a stored input-log byte.** `input_log_storage_byte_hours` is
measured in recorded bytes: each input counts at its record size — the
`sizeBytes` that `inputLogMessages` returns, a fixed header plus the message —
before compression and replication, so you can add it up yourself. The header is
48 bytes since the replication server release after v0.37.0 (40 before), which is
what a recorded spatial message's fixed overhead of 116 bytes is made of (with its
68-byte spatial header). Each byte is
billed for exactly the input log's retention (7 days, 168 hours), so 1 GB
recorded is 168 GB-hours, 0.23 GB-month; it is priced per GB-month on the rate
card in your account and on the
[pricing page](https://crowdedkingdoms.com/pricing.html). `appUsageSummary`
reports an app's byte-hours and the bytes it holds now, and
`appUsageProjection` the month so far and a projection.

**Rate bands.** Egress is priced in graduated rate bands since 2026-11-17: the
faster a connection is served, the less each gigabyte costs. Every UTC calendar
minute, each client connection's egress in that minute is split at the band
edges, which are rates (bits per second, averaged over the minute). Today there
are two: the first 22 kbps of each connection-minute (its first 165,000 bytes,
about 10 MB per connected hour) is charged at the first band's rate, and
everything above it at the second band's, so serving a connection faster never
re-prices the bytes below. The first band pays for the connection; above it a
gigabyte costs the same however the traffic is spread, batched or connected.
Egress that is not delivered over a client connection, such as API responses,
is charged at the first band's rate, and what an app uses of the free quota comes
off its first band first. The month's total is still rounded up to the cent
once. A minute recorded in parts, because the client reconnected or moved to
another server during it, is banded part by part. A game server's
[fleet session](#data-out-for-a-fleet-session) has one first band for each
player it carries. An app's bands for the month
are set at its first charge in that month, so a change to the rate card reaches
an app from its next month: an app that sent egress in November 2026 before the
switch keeps the previous volume bands (by the month's total) until December 1.
The schedule is on the rate card in your account and on the
[pricing page](https://crowdedkingdoms.com/pricing.html), and the
[Free Tier and Billing Basis](https://crowdedkingdoms.com/billing-basis.html)
§5.2 sets it out.

In the API, `meteredRateCard` lists a banded line's `priceBands` and says what
their edges measure in `priceBandBasis`. On `RATE`, each band has its
`priceCents` per the line's `unitQuantity` (a GB) and its upper edge
`upToBitsPerSecond`; on `VOLUME`, the edge is `upToUnits`, in raw units on the
month's running total (bytes, for egress). The last band's edge is `null`. The
line's own `priceCents` is the first band's rate, and a line priced at one rate
has no `priceBands`. `appUsageProjection` reports a rate-banded month as the
ledger last priced it: `dataOutRateBands` (each band's bytes so far and the free
bytes in it), `dataOutPricedCents`, and `projectedDataOutCents` for the month's
mix of bands scaled to the projected egress.

An app's [ck-exec](/exec/intro) code is metered minute by minute in compute
units: the greater of the CPU time and the fuel each minute used, so neither a
host stall nor unusually dense guest instructions under-report work. A
CPU-hour on the rate card is one core busy for one hour, and the price is the
rate card in your account and on the
[pricing page](https://crowdedkingdoms.com/pricing.html). Realtime events the
code sends count as replication egress, billed through the same monthly egress
aggregate as every other byte your app sends. See
[usage and budgets](/exec/operations#usage-and-budgets).

`orgFreeAppQuota` counts the free app slots (it is deprecated, and the slots never
changed what is free or billed):

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

### Data out for a fleet session

A [fleet session](/management-api/fleet-sessions) is one connection on which an
organization's game server carries many players. A carried player is billed as
a connected player, and nothing is added to the rate card. The charge is still
for bytes: the number of players a session carries only sets how many of its
bytes fall in the first band.

- **Data in (ingress)** is what the session sends.
- **Data out (egress)** is what the session is sent. The rate bands above apply with one
  first band for each carried player: for each fleet session and UTC minute, the
  first 165,000 bytes for each carried player-minute are charged at the first
  band's rate, and the rest at the second band's. A player carried for the whole
  minute is one player-minute, and a player carried for 30 seconds of it is half
  of one. A session that carries 40 players for a whole minute has 6,600,000
  bytes in the first band (40 × 165,000).
- **Allowances and spend caps** count bytes as before.

A fleet session is sent a shared update once, however many of its players can
see it, and it is not sent its own players' state unless it asks. Those bytes
are not delivered, so they are not billed.

## Creating an app (shared by default)

New apps created through the Management UI **Get started** wizard or `createApp` go live on the shared Application API immediately. `datacenter` is required: a `code` that `placeableDatacenters` lists as `placeable`.

```graphql
mutation {
  createApp(input: {
    orgId: "123"
    name: "My Game"
    slug: "my-game"
    datacenter: "va"
  }) {
    appId
    deploymentTarget
    runtimeStatus
    applicationApiUrl
  }
}
```

When create succeeds, expect:

- `deploymentTarget` = **`shared`**
- `runtimeStatus` = **`active`**
- `applicationApiUrl` = the tier's shared endpoint (discover via `platformConfig` if unset in the response)

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

An app can also have a **monthly budget**. Once the app's spend this calendar month
(UTC) reaches it, the app is denied until the month ends or you raise the budget.
Reserved throughput fees count toward the budget, but not toward the hourly and
daily caps. `0` removes the budget:

```graphql
mutation {
  setAppBudget(orgId: "123", appId: "456", monthlyLimitCents: "5000") {
    monthlyLimitCents
    currentMonthUsageCents
  }
}
```

### Auto-billing

Instead of (or in addition to) manual top-ups, an org owner can enable
**auto-billing**: when the wallet can't cover usage, the saved payment method is
charged automatically to top the wallet back up — up to a limit you set, or with
**no limit**. A top-up into an organization wallet, by checkout
(`createCheckout` with `ORG_WALLET_TOPUP`) or as the auto-billing amount
(`rechargeAmountCents`), is at least $10; a smaller one is refused with
`TOP_UP_BELOW_MINIMUM` (`walletTopUpMinimums` publishes the figure). With auto-billing off, an app is simply denied when the wallet runs
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

Two things a reservation is **not**:

1. **Not a ceiling.** It obliges CK to keep that much capacity in service for
   you; it does not cap what you may send. Use above the reserved rate is metered
   like any other usage rather than refused.
2. **Not a data allowance.** The monthly fee buys **capacity, not volume**. It is
   charged *in addition to* metered usage and includes no bytes of its own —
   reserving 5 MB/s does not make the first 5 MB/s free.

Billed monthly from the org wallet whether or not the capacity is used; upgrades
are prorated for the current month, and lowering or clearing a reservation charges
nothing. Requires `manage_billing` on the app's organization.

## What "access denied" means

When an app can't serve traffic, `appRuntimeState` reports a `runtimeStatus`
other than `active` and a `runtimeDenialReason`:

- `insufficient_funds` — the app needs to be paid for and cannot be: it has used
  more of a meter than its organization's free allowance has left, and the wallet
  is empty with auto-billing unable to cover it. Top up the wallet or enable
  auto-billing. CK checks each app meter by meter, within about a minute. It
  denies an app that keeps using a meter whose allowance is used up, and all of
  that app's traffic stops; an app that does not use that meter keeps running
  (one that only spends CPU while the data-out allowance is used up, for
  example). (An app still inside its allowances is not denied at all, so this
  reason covers both "out of allowance" and "out of money" — they are the same
  situation.)
- `spend_cap` — an hourly or daily spend cap, or the app's monthly budget, was
  reached. Raise it or wait for the hour, day or month to end.
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

Clients discover the shared Application API URL programmatically — never hard-code tier-specific hosts in production.

The public `platformConfig` query (no auth) returns the shared endpoints:

```graphql
query {
  platformConfig {
    sharedApplicationApiUrl
    sharedApplicationApiWsUrl
    freeAppsPerOrg
  }
}
```

Query the app directly for routing fields — `applicationApiUrl` is set for shared apps after create:

```graphql
query {
  app(appId: "456") {
    appId
    deploymentTarget   # "shared"
    runtimeStatus
    applicationApiUrl         # shared endpoint for this tier
  }
}
```

**`mintAppToken`** returns `applicationApiUrl` / `applicationApiWsUrl` alongside the app-scoped gameplay token — the most convenient path when wiring clients after sign-in.

Point your client (or a second `CrowdyClient`) at that `applicationApiUrl`, and pass the
same `appId` when you open the realtime subscription — the session is app-scoped.
For the SDK walkthrough see
[Loading an app's Application API](/crowdyjs/shared-environment-routing).
