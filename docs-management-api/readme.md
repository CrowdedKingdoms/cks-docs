---
sidebar_position: 2
title: API overview
slug: readme
---

# Management API overview

GraphQL/HTTP API for Crowded Kingdoms **management** concerns:

| Area | Examples |
| ---- | -------- |
| Identity | Sign-in by **email + password**, magic link, or social/OIDC; federated identities (`myIdentities`/`linkIdentity`), `me`. |
| Organizations | Members, roles, permissions, org tokens. |
| Apps marketplace | Apps metadata, access tiers, `app_user_access` grants, purchases. |
| Runtime catalog | `runtimePermissions` query — keys that can be assigned on tiers (not grid grants). |
| Billing | Wallets, transactions, budgets, quotas, Stripe/PayPal checkouts. |
| Hosting | Publish an app to the shared platform (`publishAppToShared`) and read its routing fields. Self-serve customer environments were retired; private environments exist only by Enterprise Agreement. |

Runtime game data (chunks, voxels, actors, grids, grid permissions, UDP) lives in the **[Application API](/application-api/intro)**, not here. Studio tools that configure grids must call the app’s **Application API** GraphQL endpoint (`applicationApiUrl`), not the management endpoint.

## Authentication

- **Sign-in**: a user signs in with **email + password**, a **magic link**, or a **social/OIDC** provider, and receives a bearer **identity session token** (64-character hex). Send `Authorization: Bearer <token>` on Management API GraphQL requests. Full flow — `register`/`login`, `requestLoginLink`/`completeLoginLink`, `socialLoginStart`/`socialLoginComplete`, and federated identities — is in **[Sign in](/management-api/authentication)**.
- **Identity session token is management-plane only**: it is **not** valid for the Application API / realtime / UDP. To play, mint a short-lived **app-scoped token** from it (`mintAppToken`, or the browser portal flow); see **[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)**.
- **Org tokens**: a server credential for your organization's own backend, created in the Management UI (or via GraphQL). What a token may call is its scopes; today the only scopes sign in and manage your [org-managed players](/management-api/org-managed-players).

## GraphQL endpoint

There is **one origin per tier**, and the management and game surfaces are two surfaces of it. Base URLs are not per organization: nothing is provisioned for you and no hostname is handed out when a stack is ready, because there is no per-tenant stack.

**Production:** `https://ck.prod.crowdedkingdoms.com/graphql` — see **[Connecting game clients](/management-ui/client-integration)** for the full setup; build and test there. Crowded Kingdoms' `dev` and `test` environments are internal and refuse outside accounts (`TIER_ACCESS_REQUIRED`). Discover a tier's origin programmatically from the public `platformConfig` query (`sharedApplicationApiUrl`, `sharedApplicationApiWsUrl`) rather than hard-coding it.

## Hosting an app

Every app runs on the **shared platform**. Publish it with `publishAppToShared` — your organization's apps share one free allowance, and usage above it is metered against the org wallet — then read the app's routing fields (`applicationApiUrl`, `deploymentTarget`) before a player joins. An organization without a funded wallet or auto-billing may have 10 apps (`APP_LIMIT_REACHED` past it), and new apps are unlisted until set `PUBLIC`.

See **[Shared environment & billing](/management-api/shared-environment)** for the model and the free allowances, or the **[portal guide](/management-ui/environments)** for the same thing in the Management UI.

The customer-provisioned environment surface — `environmentDatacenters`, `environmentFlavors`, `environmentQuote`, `createEnvironment`, `orgEnvironment`, `linkAppToEnvironment`, `redeployEnvironment` — was **retired** and is not in the published SDL; private environments exist only by Enterprise Agreement. Every app uses the shared platform (`publishAppToShared`).

## Schema reference

**[GraphQL schema reference](/management-api/reference/graphql-overview)** — exhaustive types, queries, and mutations for this API.
