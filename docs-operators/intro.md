---
slug: intro
sidebar_position: 1
title: Operators
---

# Control-plane operators

The legacy **`cks-control-plane`** Next portal + cron runner migrated fully into **`cks-management-api`**
(GraphQL mutations + cron workers) plus the React routes under **`/admin/control-plane/*`** in **`cks-management-ui`**.

Operators (users with `users.is_operator`) handle:

| Concern | UI surface | Backend |
| ------- | ----------- | ------- |
| Environments lifecycle | `/admin/control-plane/environments*` | Runner components `environment_dns`, `postgres_*`, buddy + graphql payloads |
| Change orders queue | `/admin/control-plane/change-orders*` | `cks_environment_change_orders` → `cp_tasks`/`cp_steps` |
| Pricing catalog | `/admin/control-plane/catalog*` | `cks_ovh_*` tables + ingestion scripts |
| Secrets + audit logs | Secrets / Audit drawers | TypeORM repositories + KMS helpers |

Source-of-truth code lives inside `cks-management-api/src/control-plane/` (registry at
`cp-lib/components/registry.ts`). For database migrations apply `scripts/migrations/*.sql`.

See also **[Releases](/releases/intro)** for manifest ingestion workflows.
