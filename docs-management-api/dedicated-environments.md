---
slug: dedicated-environments
sidebar_position: 20
title: Dedicated environments
---

# Dedicated environments

:::warning Retired
Dedicated customer environments no longer exist. All apps run on the shared
platform (the unified Crowded Kingdoms API on its PostgreSQL/Citus database). The
operations below are no longer served; this page is kept for historical
reference only.
:::

A **dedicated environment** is an isolated stack — Game API, database, and the
Buddy replication runtime — provisioned for your organization. Apps linked to an
environment route their players to that environment's Game API instead of the
shared platform.

You can provision either:

- **Dedicated** (`environmentClass: "dedicated"`, the default) — an isolated
  **multi-VM** stack: a dedicated database, a scalable Game API fleet behind a
  load balancer, and a Buddy fleet. This is the production option and supports
  scaling.
- **Developer sandbox** (`environmentClass: "dev_single"`) — a single all-in-one
  VM running Postgres, the Management API, the Game API, and Buddy. It is **not
  for production** (no scaling, single point of failure) but is the cheapest way
  to get a real `gameApiUrl` your client can connect to.

Both are created through the same `createEnvironment` flow below; the inputs
differ (dedicated takes per-component flavors + scaling bounds, the sandbox takes
a single `flavor`). If your app doesn't need isolation, you can skip environments
entirely and run on the **[shared environment](/management-api/shared-environment)**.

Every operation below requires the **`manage_environments`** permission on the
org (catalog and quote reads require **`view_environments`** / **`view_billing`**),
and billing runs through the **org wallet**. Exact fields per version are in the
**[schema reference](/management-api/reference/graphql-overview)**.

## 1. Browse the catalog

List datacenters that have customer-selectable instances, then the flavors
available in one:

```graphql
query {
  environmentDatacenters { region city continent isAvailable selectableInstanceCount }
}

query {
  environmentFlavors(datacenter: "BHS5") {
    flavorName
    vcpus
    ramMb
    diskGb
    customerHourlyPriceCents
  }
}
```

Pick a `flavorName` per role. For a **dedicated** environment you choose one for
each of the database, Game API, Buddy, and load-balancer roles; for the
**sandbox** you choose one VM (so pick roughly 8 GB RAM or more — one VM hosts
everything).

## 2. Quote it

Price the sandbox and confirm the wallet can cover it **before** you create.
`environmentQuote` returns the hourly cost, the first-day reserve that creation
debits, your wallet balance, and a `canCreate` flag:

```graphql
query {
  environmentQuote(input: {
    orgId: "ACME_ORG_ID",
    datacenter: "BHS5",
    environmentClass: "dev_single",
    flavor: "b3-8"
  }) {
    hourlyCostCents
    firstDayReserveCents
    walletBalanceCents
    availableBalanceCents
    canCreate
  }
}
```

If `canCreate` is `false`, top up the org wallet (see
**[Shared environment & billing](/management-api/shared-environment)** for wallet
mechanics) and quote again.

## 3. Create the sandbox

`createEnvironment` provisions the stack and returns immediately with the new
environment record; provisioning continues in the background.

```graphql
mutation {
  createEnvironment(input: {
    orgId: "ACME_ORG_ID",
    displayName: "Playtest v1",
    datacenter: "BHS5",
    environmentClass: "dev_single",
    flavor: "b3-8",
    x25519PublicKeyBase64: "BASE64_X25519_PUBLIC_KEY",
    appIds: ["APP_ID"]   # optional: link apps at create time
  }) {
    environment { slug status displayName }
  }
}
```

Notes:

- **`x25519PublicKeyBase64` is required.** Generate an X25519 keypair on your
  side and pass the **public** key (base64). The platform encrypts the
  environment's secrets to this key so only you can decrypt them — keep the
  matching private key safe.
- **`slug` is optional.** Omit it and the platform assigns an opaque `e-{12}`
  slug; you'll use that slug to read status and link apps. Pass `appIds` to link
  one or more apps as part of the deploy.

For a **multi-VM dedicated** environment, omit `environmentClass` (or set it to
`"dedicated"`) and supply the four per-component flavors plus scaling bounds
instead of a single `flavor`:

```graphql
mutation {
  createEnvironment(input: {
    orgId: "ACME_ORG_ID",
    displayName: "Production",
    datacenter: "BHS5",
    environmentClass: "dedicated",
    databaseFlavor: "b3-16",
    gameApiFlavor: "b3-8",
    udpBuddyFlavor: "b3-8",
    caddyFlavor: "b3-8",
    gameApiMinServers: 1,
    gameApiMaxServers: 3,
    udpBuddyMinServers: 1,
    udpBuddyMaxServers: 3,
    loadBalancerCount: 1,
    x25519PublicKeyBase64: "BASE64_X25519_PUBLIC_KEY"
  }) {
    environment { slug status environmentClass }
  }
}
```

Quote a dedicated environment with the same per-component fields via
`environmentQuote` before creating.

## 4. Wait for it to come up

Poll `orgEnvironment(orgId, slug)` until `environment.status` reports live, then
read the connection URLs from `outputs`:

```graphql
query {
  orgEnvironment(orgId: "ACME_ORG_ID", slug: "e-ab12cd34ef56") {
    environment { slug status displayName }
    outputs { name label value }
    deployProgress { __typename }
  }
}
```

The `outputs` list carries the published URLs (including the environment's Game
API URL). The simplest routing source, though, is the app itself once it's
linked — see the next step.

## 5. Link an app

If you didn't pass `appIds` at create time, link an app afterward. This sets the
app's `splitMode` and resolves its `gameApiUrl` to the environment's Game API:

```graphql
mutation {
  linkAppToEnvironment(input: {
    orgId: "ACME_ORG_ID",
    appId: "APP_ID",
    environmentSlug: "e-ab12cd34ef56"
  }) {
    appId
    gameApiUrl
    splitMode
  }
}
```

`linkAppToEnvironment` refuses apps that are published to the shared environment
or already linked elsewhere. After linking, clients read `app(appId)` to
discover the `gameApiUrl` — see **[Loading an app's Game API](/crowdyjs/shared-environment-routing)**.

## Managing an environment

- **Upgrade** — list forward-only target versions with
  `environmentForwardVersions(orgId, slug)`, then `redeployEnvironment` to move to
  the latest (or a chosen) release, preserving URLs and linked apps.
- **Scale** — `updateEnvironmentScaling` adjusts server bounds (multi-VM
  dedicated only; the sandbox is a single instance).
- **Pause / resume** — `resumeEnvironment` brings a suspended environment back.
- **Tear down** — `destroyEnvironment` releases the cloud resources;
  `purgeEnvironment` then deletes the destroyed record.

## Connecting clients

However an app is hosted, the client reads its routing fields (`gameApiUrl`,
`splitMode`, `deploymentTarget`) before a player joins and connects to that
`gameApiUrl`. See **[Loading an app's Game API](/crowdyjs/shared-environment-routing)**
for the full decision and SDK walkthrough.
