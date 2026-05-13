---
sidebar_position: 2
title: System architecture
slug: architecture
---

# Project Architecture

This document briefly outlines the high level architecture of the various projects. The descriptions should not be overly detailed, they should just contain the material needed to understand the scope of each project and how it achieves its design.

## Database Schema

Single Postgres cluster shared by `cks-management-api` and `cks-game-api`. Canonical greenfield DDL lives in `cks-management-api/scripts/migrations/0001-genesis.sql`; future migrations land as `0002-*.sql`, .... Spatial coordinates use Postgres composite types (`vector3_int64`, `vector3_int16`, `vector3_double`) so chunk and voxel positions are first-class column values. The legacy `schema/schema.sql` is retained for historical reference only.

Identity sits at the top: `users` (with `is_super_admin`, `user_type`, optional `org_id` for shadow accounts) plus the auth-token tables `game_tokens` (bearer for any logged-in client), `org_tokens` (server-side org-level auth), `confirmation_tokens`, `password_reset_tokens`. SES bounce/complaint state is tracked in `email_status` and `email_events` with helper functions for sendability and reputation.

Multi-tenancy and authorization live below identity: `organizations` own `apps` (each app is an isolated "world"); `org_permissions` is the seed catalog of permission keys; `org_members` links users to orgs and joins through `org_member_roles` -> `org_roles` -> `org_role_permissions` to resolve effective permissions. New orgs auto-seed a system `Owner` role with every permission via `OrganizationsService.createOrganization` (see LEARNINGS for the fan-out pattern). A separate, app-scoped `roles`/`user_roles`/`role_permissions` triple gates in-game grid permissions and is unrelated to org RBAC.

Marketplace and money: `app_access_tiers` defines the purchasable plans per app (with optional `stripe_price_id` / `paypal_plan_id`); `app_user_access` records who has access at which tier. The provider-agnostic payment ledger is `checkouts` (one row per intent, UNIQUE on `(provider, external_id)`) plus `payment_events` (the webhook receipt log, idempotent on `(provider, external_event_id)`). Successful checkouts fan out into `org_wallets` + `wallet_transactions` (top-ups), `app_user_access` (purchases), `donations`, or `property_tokens` based on `CheckoutPurpose`. Org budgets are `app_budgets`; service-level quotas live in `service_quotas` with `free_tier_defaults` as the floor.

World data hangs off `apps`: `chunks` (16x16x16 voxel cubes, with optional CDN-uploaded JSONB voxel-state and LOD blobs), `voxel_updates` (per-block state changes), `actors` (player / NPC presence in a chunk), `avatars`, `grids` + `app_grid_assignments` (rectangular regions used for in-game permissions), and per-(app, entity) state tables (`app_user_states`, `app_avatar_states`, `app_grid_states`) that store opaque `bytea` blobs. Audit + rollback is built in: triggers mirror writes into `actors_history` and `voxel_updates_history`, and a `rollback_voxel_updates()` SQL function reverts a user's edits in a time range either as a dry run or for real.

Operational telemetry: per-minute usage counters in `client_replication_usage` and `client_graphql_usage` (each with a materialized view aggregating per `(user, org, app, minute)`); server health snapshots in `server_status` and `graphql_servers` (with `server_status_history` + a trigger capturing every update).

## Buddy UDP Servers

## Management API (`cks-management-api`)

NestJS + TypeORM + Apollo. One process, two responsibilities: GraphQL/HTTP and the in-process **control-plane step runner** (started in `onModuleInit`, mutual-exclusion via `pg_try_advisory_lock(8675309001)`). Registers itself in `graphql_servers` with `kind='management-api'`. Schema is code-first.

Modules: `auth` (token + super admin + new operator guard), `users` (identity only), `organizations` + org RBAC, `apps` (marketplace metadata), `app-access`, `billing`, `quotas`, `email`, `payments` (Stripe + PayPal webhooks), `environments` (customer-facing `cks_*` CRUD + change-order insertion), `game-apps` (grids + permissions catalog), `graphql-usage`, `server-status` (graphql_servers half only), `control-plane` (the ported runner: components, steps, providers, catalog sync, billing-hourly, autoscaling, secrets, audit, plus the operator GraphQL surface).

Authorization: `TokenAuthGuard` populates `req.user`; `OrgPermissionGuard` + `AppOwnershipGuard` cover org-scoped resources; new `OperatorGuard` short-circuits on `users.is_operator || is_super_admin` and gates every control-plane operation.

Cloud-provider credentials (OVH, AWS, GitHub, OpenStack) come from `.env` via `ConfigService`. The legacy `cp_cloud_credentials` table is dropped.

## Game API (`cks-game-api`)

Renamed from `cks-graphql-api`. NestJS + TypeORM + Apollo. Owns the runtime / world / replication GraphQL surface only: `chunks`, `voxels` (+ history + rollback), `actors`, `avatars`, `app_user_states`, UDP proxy + buddy `server_status` registry, `teleport`, `voxel-maintenance`, `udp` + `udp-proxy` (browser UDP over GraphQL subscriptions), the carved game half of users (avatars/actors/app_user_states). Registers itself in `graphql_servers` with `kind='game-api'`. Validates Bearer tokens by reading `game_tokens` directly from the shared DB.

Adds read-only TypeORM entities for management-owned tables it needs at connect time: `User` (slim), `App`, `GameToken`, `OrgToken`, `AppAccessTier`, `AppUserAccess`, `AppAccessTierPermission`, `RuntimePermission`, `Grid`, `AppGridAssignment`, `AppUserGridPermission`.

## Control plane (retired)

The legacy `cks-control-plane` Next.js portal + runner is fully ported into `cks-management-api`. Operator UI is at `/admin/control-plane/*` in `cks-management-ui`. The retired directory is kept for git history.

## Web UI Management Portal (`cks-management-ui`)

React 19 + Vite + TypeScript + Tailwind. Apollo Client on top, with a normalized cache that persists to `localStorage` via `apollo3-cache-persist` (rehydrated before React mounts so warm reloads paint instantly). Bump `APOLLO_CACHE_VERSION` in `src/lib/apollo.ts` whenever schema or `keyFields` change.

Environment-scoped queries (org environment list, datacenters, flavors, quotes, wallet, environment detail) use **`fetchPolicy: 'network-only'`** (via `VOLATILE_FETCH_POLICY` in `src/lib/apollo.ts`) so operator-published catalog prices and deployment state cannot be masked by a warm persisted Apollo cache. Prefer that pattern for any screen where the GraphQL API is the source of truth and stale cache would mislead operators.

One SPA serving three personas - super admin, org member, end user - plus a public marketplace front. The route tree is:

- `/login`, `/register`, `/forgot-password`, `/reset-password`, `/email-confirmed`
- `/account` (Profile, Avatars, MyAccess, Payments)
- `/marketplace` and `/marketplace/:orgSlug/:appSlug` (browse + buy app access via Stripe or PayPal)
- `/orgs` and `/orgs/:orgSlug` (tabbed org dashboard: Apps, Members, Tokens, Wallet, Budgets, Quotas, Settings)
- `/orgs/:orgSlug/apps/:appSlug` (tabbed app dashboard: Overview, Access Tiers, Granted Users, Settings)
- `/admin/*` (super-admin Users / UserDetail / Servers / Payments-audit)
- `/admin/control-plane/*` (operator only — Environments / Change Orders / Catalog / Secrets / Audit / Operators)

Persona awareness lives in `AuthContext` (`{ user, memberships, isSuperAdmin, isOperator, hasOrgPermission }`) derived from `me` + `myOrganizations`. `<RoleGate>` and an extended `<ProtectedRoute>` gate UI affordances; the API guards are the source of truth for security.

Per-route code-split chunks are wired through a small route preloader (`src/lib/routePreloader.ts`) that warms both the lazy chunk and the route's loader queries on hover/focus/viewport entry. A service worker (vite-plugin-pwa, `generateSW`) precaches the app shell but bypasses `/graphql`.

## CrowdyJS SDK

TypeScript SDK shipped to NPM (`@crowdedkingdomstudios/crowdyjs`) and consumed via `file:../crowdyJS` link by sibling repos in dev. Targets browsers and Node.

Single public class `CrowdyClient` exposes typed sub-clients per domain (`auth`, `users`, `orgs`, `apps`, `appAccess`, `billing`, `quotas`, `payments`, `chunks`, `voxels`, `actors`, `teleport`, `state`, `serverStatus`, `udp`). Each sub-client is a thin adapter over a `TypedDocumentNode` produced by `graphql-codegen` from `web-api/schema.gql` against the `.graphql` files under `src/operations/`. Codegen runs as `prebuild`, so a plain `npm run build` after a schema change refreshes everything.

A single `AuthState` is observed by both the HTTP `GraphQLClient` and the WebSocket `SubscriptionManager`, so HTTP and WS auth can never drift. UDP notifications come back over one shared `graphql-transport-ws` socket; consumers register handlers via `client.udp.subscribe({ onActorUpdate, ... })` and the SDK fans out per `__typename`.

## Edge of Epoch

Browser game built with Phaser 3.90 + Vite + TypeScript that exercises the GraphQL API and UDP proxy via the `@crowdedkingdomstudios/crowdyjs` SDK (linked from `../crowdyJS`).

`NetworkManager` is a singleton wrapper around `CrowdyClient`: handles login/register/session restore, persists auth via a small typed `LocalStorageService`, opens/closes the UDP proxy session, and adapts the SDK's single-`subscribe()` notification API to a per-handler shape (`onActorUpdate`, `onVoxelUpdate`, `onClientText`, ...) that the existing scenes use.

Scenes (`BootScene`, `LoginScene`, `GameScene`, `UIScene`) own UI; networked subsystems (`ActorSync`, `VoxelSync`, `ChatManager`, `EventBridge`, `world/ChunkManager`) all go through `NetworkManager` so the SDK only ever has one socket and one auth state per process.
