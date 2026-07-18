---
slug: intro
sidebar_position: 1
title: Operators
---

# Control-plane operators

Platform operators manage the control plane from the Management UI's admin area
(**`/admin/control-plane/*`**), backed by Management API GraphQL mutations and
scheduled workers.

Operators handle:

| Concern | UI surface |
| ------- | ----------- |
| Environments lifecycle | `/admin/control-plane/environments*` |
| Change orders queue | `/admin/control-plane/change-orders*` |
| Pricing catalog | `/admin/control-plane/catalog*` |
| Secrets + audit logs | Secrets / Audit drawers |

## First super admin (bootstrap)

There is no special admin login — the platform is
[passwordless](/management-api/authentication) for everyone. The **first** super
admin is bootstrapped from config, because granting super admin (`setSuperAdmin`)
itself requires an existing super admin.

`is_super_admin` is a platform-wide flag on `users` that **short-circuits every
permission check** (and also covers operator access). Bootstrap it once:

1. Deploy the Management API with **`SUPER_ADMIN_BOOTSTRAP_USER_IDS`** set to the
   user id(s) to promote (deployments typically ship
   `SUPER_ADMIN_BOOTSTRAP_USER_IDS=1`).
2. Have the root admin **sign in for the first time** through the normal passwordless
   flow — a magic link or social provider in production, or the dev bypass in
   dev/test. Accounts are created on first sign-in, and because this is the first
   account it becomes **`user_id = 1`**.
3. **Restart** the management API. On boot, it idempotently
   sets `is_super_admin = TRUE` for every id in `SUPER_ADMIN_BOOTSTRAP_USER_IDS` that
   already exists. It only ever promotes — never demotes — so clearing the var can't
   lock anyone out.

The promotion runs at boot and only for users that already exist, so the order is
**deploy → root admin signs in (creates the user) → restart to promote**. After that,
the root admin (user 1) grants or revokes super admin / operator for anyone else with
`setSuperAdmin(userId, value)` — no further env bootstrap needed; demote with
`setSuperAdmin(userId, false)`.

See also **[Releases](/releases/intro)** for manifest ingestion workflows.
