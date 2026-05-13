---
slug: intro
sidebar_position: 1
title: Introduction
---

# Game API (`cks-game-api`)

The runtime / world / replication GraphQL API (historically **`cks-graphql-api`**):

- Reads identity, apps, and entitlements from the shared Postgres but **never** mutates
  management-owned tables.
- Owns chunks, voxels, actors, avatars, `app_user_states`, UDP-proxy subscriptions over
  GraphQL, the buddy-server registry, and the game-client bootstrap.

Use the sidebar for guides copied from `cks-graphql-api/docs/`, plus the **GraphQL schema
reference** under `reference/graphql/` (generated during `npm run build` from `schema.gql`).

Related: **CrowdyJS** SDK docs for calling this API from browser clients, and the
**UDP API** tab for raw Buddy/UDP once the wire-protocol reference is published.
