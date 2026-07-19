---
slug: intro
sidebar_position: 1
title: Introduction
---

# Game API

GraphQL API for **runtime / world / replication**:

- Uses identity, apps, and entitlements from the **[Management API](/management-api/intro)** — bearer tokens and tier entitlements are validated there. Does not replace management mutations such as billing or user registration.
- Serves chunks, voxels, actors, avatars, app user state, the **GraphQL UDP proxy** (for browsers), **[Game Models](/game-api/game-models)**, **[Compute Modules](/game-api/compute-modules)** (server-side Rust/WebAssembly logic), **[teams](/game-api/teams)** and **[channels](/game-api/channels)**, the Buddy server registry, and game-client bootstrap.
- **Studio grids** — `createGrid`, `grantGridPermissions`, `revokeGridPermissions`, and related queries. Grid data is stored in the **per-tenant game database**; tier/access checks still come from management.

Use the sidebar for integration guides. Start with **[Permissions overview](/game-api/permissions)** for how to set up what players can do in your game (tiers, [grids](/game-api/grids-and-permissions), and [teams](/game-api/teams)). Put your game's rules and state on the server with **[Game Models](/game-api/game-models)**, and add player messaging with **[Channels](/game-api/channels)**. The **[GraphQL schema reference](/game-api/reference/graphql-overview)** documents every operation.

**[CrowdyJS](/crowdyjs/intro)** wraps this API for TypeScript clients. **[Replication API](/replication-api/intro)** covers native UDP to Buddy servers.
