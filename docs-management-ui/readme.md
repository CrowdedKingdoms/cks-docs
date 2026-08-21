---
sidebar_position: 4
title: Account and org basics
slug: readme
---

# Account and organization basics

Supplement to **[Create your first app](/management-ui/create-your-first-app)** and **[Apps on the shared platform](/management-ui/environments)** for day-to-day portal use.

## Sign in

- Sign in with **email and a password**, a **magic link** (enter your email; Crowded Kingdoms sends a one-time link), or a **social provider** (e.g. Google). These are peers on one email-keyed account, not alternatives: an account created by magic link can add a password later. A magic-link or social account is **created automatically on first sign-in**.
- The portal stores a session token for GraphQL requests after sign-in.
- One account can link **multiple sign-in methods** (e.g. a Google identity and a magic-link email); they resolve to the same account by verified email.
- After sign-in, users **with no organization** land on **My Orgs** (`/orgs`) with a split path: share **User ID** to join an existing org, or **create a new organization**.

For the underlying mutations (`login`/`register`, `requestLoginLink`/`completeLoginLink`, `socialLoginStart`/`socialLoginComplete`), see the **[Management API → Sign in](/management-api/authentication)**.

## Your account

Under **Account** (`/account`):

- Update gamertag and disambiguation.
- Manage your **sign-in methods** — link or unlink social/email identities (you cannot remove your last remaining sign-in method).
- Review and revoke **connected apps** you've authorized to portal you in (`myAuthorizedApps` / `revokeAppAuthorization`).
- Review apps you have access to (**My Access**).

Legacy **Account → Payments** (donations and property-token checkouts) has been removed from the UI. Marketplace purchases and org wallet top-ups remain the supported billing surfaces.

## Marketplace

Browse **`/marketplace`** to discover apps. Purchases use Stripe or PayPal checkout flows tied to your user account and org wallet rules where applicable.

## Organization dashboard

Open **`/orgs/:orgSlug`** for studio operations:

| Tab | Purpose |
| --- | ------- |
| **Overview** | Setup checklist: org created → app registered → connect clients. Links to **Get started** and wallet top-up. |
| **Apps** | Registered games on the shared platform; **Create app** opens the app-first wizard. |
| **Members** | Invite users, assign org roles, manage access. |
| **Tokens** | Create org API tokens for server-side automation. |
| **Wallet** | Pre-paid balance used for metered usage and auto-billing — fund before heavy usage or when prompted during onboarding. |
| **Budgets** | Per-app spend limits. |
| **Quotas** | Service usage caps. |
| **Settings** | Org profile and configuration. |

**Get started** at `/orgs/:orgSlug/get-started` is the primary path for new apps on the shared platform. Tab URLs support `?tab=` deep links (for example `?tab=wallet` after a top-up redirect).

Per-app dashboards live at `/orgs/:orgSlug/apps/:appSlug` (connection URLs, access tiers, granted users, app settings).

## Integrating with APIs

The portal uses the **Management API**. Game clients and dedicated servers use the **Game API** and **Replication API** with **app-scoped tokens** after authenticating; see [CrowdyJS](/crowdyjs/intro) for browser games and [Dev tier (client integration)](/management-ui/dev-tier) for public dev hosts.

For custom studio backends, use org tokens and the [Management API GraphQL reference](/management-api/reference/graphql-overview) alongside [Shared environment & billing](/management-api/shared-environment).
