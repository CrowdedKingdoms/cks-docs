---
slug: intro
sidebar_position: 1
title: Introduction
---

# Game API

GraphQL API for **runtime / world / replication**. It is the **same server and
the same URL** as the [Management API](/management-api/intro) surface — one
schema, one bearer-token scheme.

- Identity, apps, billing and entitlements are the management *surface* of this
  API — there is no second host to configure.
- Serves chunks, voxels, actors, avatars, app user state, the **GraphQL UDP proxy** (for browsers), **[teams](/game-api/teams)** and **[channels](/game-api/channels)**, replication server assignment, and game-client bootstrap, and deploys and connects players to your server code on **[ck-exec](/exec/intro)** (Rust compiled to WebAssembly).
- **Studio grids** — `createGrid`, `grantGridPermissions`, `revokeGridPermissions`, and related queries. Tier and access checks use the same API's management surface.
- **Agentic Crowdy Studio (allowlisted development)** — durable owner/app
  Ask/Build/Play sessions, ordered events, exact tools, approvals, checkpoints,
  budgets, and revocable Play leases. Access remains allowlisted; this does not
  claim production or autonomous real-money availability. See
  [Agentic Crowdy Studio](/game-api/agentic-crowdy-studio).

An app's world lives in **one datacenter**. After you mint an app token, read
`gameApiUrl` / `gameApiWsUrl` from `mintAppToken` or `gameClientBootstrap` and
use those URLs for gameplay. See
[Datacenters and endpoint routing](/game-api/datacenter-routing).

Use the sidebar for integration guides. Start with **[Best practices](/game-api/best-practices)**
for how Unreal (or any client) and your server code should share authority.
Then **[Permissions overview](/game-api/permissions)** for what
players can do (tiers, [grids](/game-api/grids-and-permissions), and
[teams](/game-api/teams)). Put your game's rules and state on the server with
**[ck-exec](/exec/intro)**, and add player messaging with
**[Channels](/game-api/channels)**. The
**[GraphQL schema reference](/game-api/reference/graphql-overview)** documents
every operation.

**[CrowdyJS](/crowdyjs/intro)** wraps this API for TypeScript clients. **[Replication API](/replication-api/intro)** covers native UDP to Buddy servers.
