---
slug: intro
sidebar_position: 1
title: Introduction
---

# Crowded Kingdoms Management UI

The **Management UI** is the web portal at [https://studio.crowdedkingdoms.com](https://studio.crowdedkingdoms.com), with a tier-labelled host per tier — [https://studio.dev.crowdedkingdoms.com](https://studio.dev.crowdedkingdoms.com) on dev. The sign-in addresses `app.crowdedkingdoms.com`, `app.dev.crowdedkingdoms.com` and `app.test.crowdedkingdoms.com` redirect to the matching portal and are fine to link to. `crowdedkingdoms.com` on its own is the marketing site, not the portal.

Studios and players use the portal to manage accounts, organizations, marketplace access, billing, and **apps on the shared platform** — the managed Game API where your games run, scoped by `appId`.

## Who uses it

| Audience | Typical tasks |
| -------- | --------------- |
| **Players / end users** | Register, confirm email, manage profile, browse the marketplace, purchase app access. |
| **Studio members** | Org dashboards: create apps, manage members, API tokens, org wallet, budgets, quotas, and app settings. |

Org permissions control which tabs a member sees (for example, only owners can invite members or top up the wallet). The Management API enforces the same rules; the UI is a convenience layer on top of GraphQL.

## New studio owner journey

1. **Register and sign in** — create your account at `/register` with email and a password, a magic link, or a social provider.
2. **Join or create an organization** — share your **User ID** with an org owner to get invited, or create a new studio from **My Orgs** (`/orgs`).
3. **Get started** — app-first wizard: name your game, complete billing setup if required, create on the **shared platform**.
4. **Connect clients** — mint an app-scoped token and point your game at the shared Game API URL.

You are not dropped into the marketplace by default when you have no org — the portal guides you toward studio setup.

## Main areas

- **Account** (`/account/*`) — profile, access you have purchased. Legacy account-level **Payments** (donations, property tokens) is no longer offered in the UI; studio spend uses the org wallet.
- **Marketplace** (`/marketplace`) — discover apps and buy access (Stripe or PayPal).
- **Organizations** (`/orgs/:orgSlug`) — studio operations: apps, members, tokens, wallet, budgets, quotas, settings, and **Get started** (`/orgs/:orgSlug/get-started`).

Game runtime (chunks, voxels, actors, UDP) is **not** configured in this portal; clients connect to the [Game API](/game-api/intro) and [Replication API](/replication-api/intro) using an **app-scoped token** minted from a login session (org-issued credentials are management-plane only and cannot drive gameplay) — see [Portals & app-scoped tokens](/management-api/portals-and-app-tokens).

## Next steps

- **[Dev tier (client integration)](/management-ui/dev-tier)** — public dev hosts, shared endpoints, and smoke checklist for early client testing.
- **[Create your first app](/management-ui/create-your-first-app)** — primary onboarding wizard (shared platform).
- **[Connecting to your app](/management-ui/connecting)** — endpoints, tokens, and client configuration.
- **[Apps on the shared platform](/management-ui/environments)** — routing, free tier, and app dashboard.
- **[Shared environment & billing](/management-api/shared-environment)** — wallet, usage, and runtime status.
- **[Management API](/management-api/intro)** — programmatic access to the same org, billing, and app operations.
- **[CrowdyJS](/crowdyjs/intro)** — browser SDK for game clients talking to the Game API.
