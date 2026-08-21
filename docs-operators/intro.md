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
| Compute platform ceilings | GraphQL (`cpComputePlatformCeilings`); admin screen planned |
| Agentic Crowdy Studio rollout | Management policy/usage GraphQL and the [agent operations runbook](agentic-crowdy-studio) |

Agentic Crowdy Studio is deployed in tracked development release `v0.1.94`.
Its app/user/model/caps remain explicitly allowlisted and fail-closed. Apply the
runbook gate before expanding to another app, model, environment, or manifest.
It is not approved for production or autonomous real-money activity.

## Platform compute ceilings

The per-app [compute policy](/game-api/compute-modules#limits-and-circuit-breakers)
(`computeSetPolicy`) is clamped platform-wide by nine operator-settable
ceilings: `maxModules`, `maxTickHz`, `fuelPerTick`, `fuelPerInvoke`,
`maxMemoryMb`, `maxRunMs`, `maxDbOpsPerTick`, `maxEgressMsgsPerMin`, and
`maxEgressBytesPerMin`.

- **Read** them with the operator query
  [`cpComputePlatformCeilings`](/management-api/reference/graphql/operations/queries/cp-compute-platform-ceilings);
  **patch** them with
  [`cpSetComputePlatformCeilings`](/management-api/reference/graphql/operations/mutations/cp-set-compute-platform-ceilings)
  (both require `is_operator` / `is_super_admin`).
- Patch semantics: omitted fields stay unchanged; an **explicit `null` clears
  the override** — the game-api then falls back to its
  `COMPUTE_PLATFORM_MAX_*` environment variable, then the built-in default;
  a value (> 0) sets the ceiling.
- Edits propagate to every game-api over replica sync and take effect in the
  `computeSetPolicy` clamp within **~30 seconds, without a restart**. The
  env vars remain bootstrap defaults only.
- Lowering a ceiling does not shrink already-stored per-app policies; it
  rejects *future* `computeSetPolicy` values above the new ceiling.
- Every change writes an operator audit entry
  (`compute.platform_ceilings_set`).

## First super admin (bootstrap)

There is no special admin login — the platform is
[the ordinary sign-in flows](/management-api/authentication) for everyone. The **first** super
admin is bootstrapped from config, because granting super admin (`setSuperAdmin`)
itself requires an existing super admin.

`is_super_admin` is a platform-wide flag on `users` that **short-circuits every
permission check** (and also covers operator access). Bootstrap it once:

1. Deploy the Management API with **`SUPER_ADMIN_BOOTSTRAP_USER_IDS`** set to the
   user id(s) to promote (deployments typically ship
   `SUPER_ADMIN_BOOTSTRAP_USER_IDS=1`).
2. Have the root admin **sign in for the first time** through the normal
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
