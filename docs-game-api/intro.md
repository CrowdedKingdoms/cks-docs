---
slug: intro
sidebar_position: 1
title: Introduction
---

# Game API

GraphQL API for **runtime / world / replication**. It is the **same server and
the same URL** as the [Management API](/management-api/intro) surface — one
schema, one bearer-token scheme. Gameplay rows live in **PostgreSQL + Citus**
(`crowded_kingdoms`, distributed by `app_id`), not galaxy.

- Identity, apps, billing and entitlements are the management *surface* of this
  API — there is no second host to configure.
- Serves chunks, voxels, actors, avatars, app user state, the **GraphQL UDP proxy** (for browsers), **[Game Models](/game-api/game-models)**, **[Compute Modules](/game-api/compute-modules)** (server-side Rust/WebAssembly logic), **[teams](/game-api/teams)** and **[channels](/game-api/channels)**, the Buddy server registry, and game-client bootstrap.
- **Studio grids** — `createGrid`, `grantGridPermissions`, `revokeGridPermissions`, and related queries. Grid data is stored in the Citus cluster next to the rest of the app; tier/access checks are the same API's management surface.
- **Agentic Crowdy Studio (allowlisted development)** — durable owner/app
  Ask/Build/Play sessions, ordered events, exact tools, approvals, checkpoints,
  budgets, and revocable Play leases on the current unified CK API. Access
  remains allowlisted; this does not claim production or autonomous real-money
  availability. Discover live ck-api versions with
  `infra-control-plane/scripts/ops/deployed-versions.sh`. See
  [Agentic Crowdy Studio](/game-api/agentic-crowdy-studio).

Use the sidebar for integration guides. Start with **[Permissions overview](/game-api/permissions)** for how to set up what players can do in your game (tiers, [grids](/game-api/grids-and-permissions), and [teams](/game-api/teams)). Put your game's rules and state on the server with **[Game Models](/game-api/game-models)**, and add player messaging with **[Channels](/game-api/channels)**. The **[GraphQL schema reference](/game-api/reference/graphql-overview)** documents every operation.

**[CrowdyJS](/crowdyjs/intro)** wraps this API for TypeScript clients. **[Replication API](/replication-api/intro)** covers native UDP to Buddy servers.
