---
slug: intro
sidebar_position: 1
title: Introduction
---

# Management API

:::info There is one Crowded Kingdoms API, and this is part of it
The separate management server has been retired. Identity, organizations, apps,
billing, marketplace and studio policy are served by the **same GraphQL endpoint as
the [Game API](/game-api/intro)** — one server, one schema, one bearer token. Every
operation in this section still exists with the same name and shape; **there is no
second URL to configure.**

"Management API" now names a *surface* of that API rather than a service you deploy or
address. This section documents that surface, so you can read it without wading through
world and replication operations.
:::

The management surface covers everything studios and players need before a game client
connects:

- Identity, organizations, RBAC, the apps marketplace, app-access tiers, billing,
  payments, quotas, email delivery and usage.
- **Agentic Crowdy Studio development policy**: platform/app allowlists and
  caps, `use_studio_agent`, emergency kills, privacy/retention, and sanitized
  platform-funded usage; non-allowlisted apps remain fail-closed. See
  [Agentic Crowdy Studio policy](/management-api/agentic-crowdy-studio-policy).

**Entitlements** (who has access at which tier, runtime permission keys on tiers) are
defined here. **Spatial grid configuration** (virtual-estate regions and per-user grid
grants) is documented with the [Game API](/game-api/intro).

Use [Crowdy Studio](/management-ui/intro) for the same operations in a browser, or call
the API directly with a user session token or **org API token**.

The **[GraphQL schema reference](/management-api/reference/graphql-overview)** lists
every type, query and mutation on this surface. The published SDL at
[`/schema/management-api.graphql`](pathname:///schema/management-api.graphql) is the
unified schema filtered to it; [`/schema/game-api.graphql`](pathname:///schema/game-api.graphql)
is the whole thing.

Dedicated customer environments were retired without replacement — see
[Dedicated environments](/management-api/dedicated-environments).
