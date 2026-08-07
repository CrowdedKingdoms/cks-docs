---
sidebar_position: 100
sidebar_label: GraphQL schema (overview)
slug: graphql-overview
---

# GraphQL schema reference

Browse **reference/graphql/** in the sidebar for every type, query, mutation and input on the management surface.

This is a **filtered view of the one Crowded Kingdoms schema**, narrowed to identity, org RBAC, marketplace, billing and entitlements (`app_user_access`, tier `permissionKeys`) so you can read the management surface without the world and replication operations. It is not a separate schema and not a separate server: everything here is served by the same endpoint, and grid studio operations (`createGrid`, `grantGridPermissions`, …) are on the [Game API schema reference](/game-api/reference/graphql-overview) — same endpoint, different section.

The published SDL for this view is [`/schema/management-api.graphql`](pathname:///schema/management-api.graphql); the complete schema is [`/schema/game-api.graphql`](pathname:///schema/game-api.graphql).
