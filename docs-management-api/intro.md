---
slug: intro
sidebar_position: 1
title: Introduction
---

# Management API

GraphQL service for the **management plane**—everything studios and players need before connecting a game client:

- Identity, organizations, RBAC, apps marketplace, app-access tiers, billing, payments,
  quotas, email delivery, and **dedicated environments** (provision, quote, scale, and inspect isolated stacks).
- Disabled-by-default **Agentic Crowdy Studio development policy**: platform/app
  allowlists and caps, `use_studio_agent`, emergency kills, privacy/retention,
  and sanitized platform-funded usage. See
  [Agentic Crowdy Studio policy](/management-api/agentic-crowdy-studio-policy).

**Entitlements** (who has access at which tier, runtime permission keys on tiers) are defined here. **Spatial grid configuration** (virtual-estate regions and per-user grid grants) lives on the **[Game API](/game-api/intro)** — each app’s `gameApiUrl` in production.

Use the [Management UI](/management-ui/intro) for the same operations in a browser, or call this API directly with a user session token or **org API token**.

The **[GraphQL schema reference](/management-api/reference/graphql-overview)** lists every type, query, and mutation.

The **[Game API](/game-api/intro)** owns runtime world data, grid studio mutations, and the GraphQL UDP proxy. It validates bearer tokens and tier entitlements against this API and does not replace management operations such as billing or passwordless sign-in.
