---
sidebar_position: 2
title: API overview
slug: readme
---

# Management API overview

GraphQL/HTTP API for Crowded Kingdoms **management** concerns:

| Area | Examples |
| ---- | -------- |
| Identity | **Passwordless** sign-in (magic link, social/OIDC, dev bypass), federated identities (`myIdentities`/`linkIdentity`), `me`. |
| Organizations | Members, roles, permissions, org tokens. |
| Apps marketplace | Apps metadata, access tiers, `app_user_access` grants, purchases. |
| Runtime catalog | `runtimePermissions` query — keys that can be assigned on tiers (not grid grants). |
| Billing | Wallets, transactions, budgets, quotas, Stripe/PayPal checkouts. |
| Environments | List datacenters and flavors, quote and create environments (developer sandbox today; multi-VM dedicated coming soon), link apps, read status and endpoints. |

Runtime game data (chunks, voxels, actors, grids, grid permissions, UDP) lives in the **[Game API](/game-api/intro)**, not here. Studio tools that configure grids must call the app’s **game API** GraphQL endpoint (`gameApiUrl`), not the management endpoint.

## Authentication

- **Passwordless sign-in**: there is no password. A user signs in with a **magic link**, a **social/OIDC** provider, or the **dev bypass**, and receives a bearer **identity session token** (64-character hex). Send `Authorization: Bearer <token>` on Management API GraphQL requests. Full flow — `requestLoginLink`/`completeLoginLink`, `socialLoginStart`/`socialLoginComplete`, `devLogin`, and federated identities — is in **[Sign in (passwordless)](/management-api/authentication)**.
- **Identity session token is management-plane only**: it is **not** valid for the Game API / realtime / UDP. To play, mint a short-lived **app-scoped token** from it (`mintAppToken`, or the browser portal flow); see **[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)**.
- **Org automation**: create an **org token** in the Management UI (or via GraphQL) for server-side automation with your org’s permissions.

## GraphQL endpoint

Production and staging base URLs are **per organization and environment**. Crowded Kingdoms provides hostnames when your dedicated environment is ready, or use the endpoints shown in the Management UI environment detail page.

**Dev tier (integration testing):** shared management host `https://api.dev.crowdedkingdoms.com` — see **[Dev tier (client integration)](/management-ui/dev-tier)** for the full two-URL setup and current game environment URLs.

## Environment operations

Studios typically:

1. Query catalog fields (`environmentDatacenters`, `environmentFlavors`).
2. `environmentQuote` with the region and class; confirm `canCreate` and wallet balance.
3. `createEnvironment` with `environmentClass: "dev_single"`, a `flavor`, and your `x25519PublicKeyBase64` (optionally `appIds`).
4. Poll `orgEnvironment(orgId, slug)` until status is live; read endpoints from `outputs`.
5. `linkAppToEnvironment` if you didn't link apps at create time.

See **[Dedicated environments](/management-api/dedicated-environments)** for the full API flow (developer sandbox today; multi-VM dedicated coming soon), or the **[portal guide](/management-ui/environments)** for the same flow in the Management UI.

## Schema reference

**[GraphQL schema reference](/management-api/reference/graphql-overview)** — exhaustive types, queries, and mutations for this API.
