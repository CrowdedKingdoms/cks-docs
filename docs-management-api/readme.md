---
sidebar_position: 2
title: API overview
slug: readme
---

# Management API overview

GraphQL/HTTP API for Crowded Kingdoms **management** concerns:

| Area | Examples |
| ---- | -------- |
| Identity | Sign-in by **email + password**, magic link, or social/OIDC; federated identities (`myIdentities`/`linkIdentity`), `me`. The dev bypass was removed on 2026-08-20. |
| Organizations | Members, roles, permissions, org tokens. |
| Apps marketplace | Apps metadata, access tiers, `app_user_access` grants, purchases. |
| Runtime catalog | `runtimePermissions` query — keys that can be assigned on tiers (not grid grants). |
| Billing | Wallets, transactions, budgets, quotas, Stripe/PayPal checkouts. |
| Hosting | Publish an app to the shared platform (`publishAppToShared`) and read its routing fields. Customer-provisioned environments were retired without replacement. |

Runtime game data (chunks, voxels, actors, grids, grid permissions, UDP) lives in the **[Game API](/game-api/intro)**, not here. Studio tools that configure grids must call the app’s **game API** GraphQL endpoint (`gameApiUrl`), not the management endpoint.

## Authentication

- **Sign-in**: a user signs in with **email + password**, a **magic link**, or a **social/OIDC** provider, and receives a bearer **identity session token** (64-character hex). Send `Authorization: Bearer <token>` on Management API GraphQL requests. Full flow — `register`/`login`, `requestLoginLink`/`completeLoginLink`, `socialLoginStart`/`socialLoginComplete`, and federated identities — is in **[Sign in](/management-api/authentication)**.
- **Identity session token is management-plane only**: it is **not** valid for the Game API / realtime / UDP. To play, mint a short-lived **app-scoped token** from it (`mintAppToken`, or the browser portal flow); see **[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)**.
- **Org automation**: create an **org token** in the Management UI (or via GraphQL) for server-side automation with your org’s permissions.

## GraphQL endpoint

There is **one origin per tier**, and the management and game surfaces are two surfaces of it. Base URLs are not per organization: nothing is provisioned for you and no hostname is handed out when a stack is ready, because there is no per-tenant stack.

**Dev tier (integration testing):** `https://ck.dev.v7.cks-env.com` — see **[Dev tier (client integration)](/management-ui/dev-tier)** for the full setup. Discover a tier's origin programmatically from the public `platformConfig` query (`sharedGameApiUrl`, `sharedGameApiWsUrl`) rather than hard-coding it.

## Hosting an app

Every app runs on the **shared platform**. Publish it with `publishAppToShared` — free under your org's app-slot quota (`platformConfig.freeAppsPerOrg`, default 3), and metered against the org wallet beyond it — then read the app's routing fields (`gameApiUrl`, `deploymentTarget`) before a player joins.

See **[Shared environment & billing](/management-api/shared-environment)** for the model and the free allowances, or the **[portal guide](/management-ui/environments)** for the same thing in the Management UI.

The customer-provisioned environment surface — `environmentDatacenters`, `environmentFlavors`, `environmentQuote`, `createEnvironment`, `orgEnvironment`, `linkAppToEnvironment`, `redeployEnvironment` — was **retired without replacement** and is not in the published SDL. **[Dedicated environments](/management-api/dedicated-environments)** is kept for historical reference only.

## Schema reference

**[GraphQL schema reference](/management-api/reference/graphql-overview)** — exhaustive types, queries, and mutations for this API.
