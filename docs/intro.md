---
slug: intro
sidebar_position: 1
title: Overview
---

# Overview

Crowded Kingdom Studios (CKS) publishes several services — a **management** GraphQL
API (`cks-management-api`), a **runtime / game** GraphQL API (`cks-game-api`, built from
what was previously `cks-graphql-api`), a **Buddy** UDP replication tier (`cks-udp-api`,
outside this monorepo), the **CrowdyJS** npm SDK (`CrowdyJS/`), plus the React
**management UI** (`cks-management-ui`). This site aggregates public-facing docs for
customers and studios.

:::tip Repository layout

The canonical **monorepo** lives at `cks-project-root` on internal hosts. For the
repository list, deployment practices, and the **environment release version** flow,
see the root `README.md` in that repo (not duplicated here in full).

:::

## Where to go next

- **System architecture** — end-to-end description of each component and shared Postgres.
- **Navbar tabs** — each project has its own docs tree (Management API, Game API,
  CrowdyJS, Operators, Releases, …).
- **GraphQL schema reference** — under Management API, Game API, and CrowdyJS, generated from
  the checked-in `.gql` files in sibling repos (`npm run build` refreshes generated pages).

