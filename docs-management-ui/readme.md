---
sidebar_position: 2
title: Upstream repository README
slug: readme
---

# Crowded Kingdoms Management UI

React 19 + Vite + TypeScript + Tailwind frontend that talks exclusively to
**`cks-management-api`**. It serves three personas plus the operator section:

- **End user** — `/login`, `/register`, `/account/*`, marketplace browsing,
  per-org dashboards.
- **Org member** — `/orgs/:slug/*`, environments, members, tokens, wallet,
  budgets, quotas.
- **Super admin** — `/admin/users`, `/admin/servers`, `/admin/payments`.
- **Operator** (company employee with `users.is_operator = true`) —
  `/admin/control-plane/*` (Environments, Change Orders, Catalog & Pricing,
  Secrets, Audit, Operators). Gated by `<RoleGate need="operator">`. See the
  [Control plane operator section](#control-plane-operator-section) below.

The game-side GraphQL (chunks/voxels/actors/UDP) lives in **`cks-game-api`**
and is consumed by the CrowdyJS SDK from gameplay clients — this UI does not
talk to game-api directly.

## Features

- **User Authentication**: Login, registration, password reset, and email confirmation (against management-api).
- **Profile Management**: Change password, update gamertag and disambiguation.
- **GraphQL Integration**: Apollo Client with a normalized cache persisted to
  `localStorage` via `apollo3-cache-persist`. Bump `APOLLO_CACHE_VERSION` in
  `src/lib/apollo.ts` when schema or `keyFields` change.
- **Volatile fetch policy**: catalog / pricing / environment data uses
  `VOLATILE_FETCH_POLICY` (`network-only`) so operator changes are never
  masked by a warm persisted cache.
- **Form Validation**: Client-side validation with Zod matching backend rules.
- **Responsive Design**: Modern UI built with Tailwind CSS.
- **Protected Routes**: Authentication-required pages with automatic redirects.
- **Persona gating**: `<RoleGate>` variants `'authenticated'`, `'superAdmin'`,
  `'operator'`, and `{ org, perm }` / `{ app, perm }`. UI affordance only; the
  API guards (`OperatorGuard`, `OrgPermissionGuard`, …) are the source of truth.

## Prerequisites

- Node.js 18+ and npm
- Running `cks-management-api` server (the new management/CP plane). Game-api
  is **not** required to run this UI.

## Environment Variables

Create a `.env` file with:

```bash
# Point at cks-management-api (NOT game-api).
VITE_API_URL=http://localhost:3001
VITE_GRAPHQL_ENDPOINT=http://localhost:3001/graphql
```

For production, update these URLs to point to the deployed management API.

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The application will be available at http://localhost:5173

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Type-check and build for production into `dist/`
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/             # Reusable components
│   ├── Layout.tsx          # Main layout with navigation
│   ├── PageSkeleton.tsx    # Reusable Suspense fallbacks (form/dashboard/...)
│   ├── PrefetchLink.tsx    # <Link> wrapper that warms route chunks + data
│   ├── ProtectedRoute.tsx  # Authentication guard
│   └── ThemeToggle.tsx
├── context/                # React contexts
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
├── graphql/
│   ├── auth.ts             # Auth + finance GraphQL operations
│   └── environments.ts     # Org environments, catalog, quotes, wallet (management API)
├── lib/
│   ├── apollo.ts           # Apollo Client + persisted cache
│   ├── routePreloader.ts   # Route registry, prefetchRoute, likely-next map
│   └── validations.ts      # Zod form schemas
├── pages/                  # Lazy-loaded route components
│   ├── Home.tsx
│   ├── Login.tsx
│   ├── Register.tsx
│   ├── Profile.tsx
│   ├── Finances.tsx
│   ├── ForgotPassword.tsx
│   ├── ResetPassword.tsx
│   └── EmailConfirmed.tsx
├── types/
│   └── auth.ts
├── App.tsx                 # Router + Suspense + RoutePrefetcher wiring
└── main.tsx                # Restores Apollo cache, then mounts <App />
```

## Authentication Flow

### Registration
1. User fills out registration form
2. Account is created and user receives confirmation email
3. User is automatically logged in with a 64-character token
4. Token is stored in localStorage for subsequent requests

### Email Confirmation
1. User clicks confirmation link in email
2. API validates token and redirects to `/email-confirmed?success=true/false`
3. Frontend displays appropriate success/error message

### Password Reset
1. User requests password reset on forgot password page
2. User receives password reset email
3. User clicks reset link, which redirects to `/reset-password?token=...`
4. User enters new password and submits form
5. Password is updated and user is redirected to login

### Profile Management
- Change password (requires current password)
- Update gamertag and disambiguation
- Resend email confirmation if not verified
- View account status and information

## Form Validation

Client-side validation mirrors backend validation rules:

- **Email**: Valid email format required
- **Password**: Minimum 8 characters
- **Gamertag**: Optional, 3-64 characters
- **Disambiguation**: 1-128 characters when updating gamertag

## GraphQL Integration

The frontend uses Apollo Client with:
- Automatic authentication headers (Bearer token)
- Caching and error handling
- Optimistic updates for better UX
- TypeScript integration for type safety

Apollo cache persistence lives in `src/lib/apollo.ts` and writes to
`localStorage` under `apollo-cache-persist`. When schema shape, normalization,
or environment-management data changes in a way that can leave stale UI state,
bump `APOLLO_CACHE_VERSION`; the next page load purges the old persisted cache.
For example, stale deleted environments can continue to render from local cache
until this version is bumped or the cache is manually cleared.

**Volatile environment data** — Pages under `src/pages/orgs/environments/` attach
`fetchPolicy: 'network-only'` (via `VOLATILE_FETCH_POLICY` from `apollo.ts`) to
queries that must always reflect server state: flavor catalog and prices, quotes,
wallet, and per-environment detail. Without this, `apollo3-cache-persist` can
serve yesterday's flavor list or prices after operators publish updates in the
control plane. When you add a new query in this area, import `VOLATILE_FETCH_POLICY`
and apply the same policy unless you have a strong reason not to.

Environment creation includes autoscaling controls for GraphQL min/max servers,
UDP/Buddy min/max servers, GraphQL load balancer count, and GraphQL load
balancer flavor. Environment detail exposes the same desired scaling values for
post-create edits through `updateEnvironmentScaling`.

## Control plane operator section

`/admin/control-plane/*` is the in-app surface for what used to be the
standalone `cks-control-plane` Next.js portal. It's gated by
`<RoleGate need="operator">`, which uses `users.is_operator || is_super_admin`.
Pages:

- `/admin/control-plane/environments` and `/environments/:slug` — paginated
  view across every org; deletion-protection toggle.
- `/admin/control-plane/change-orders` and `/change-orders/:id` — runner
  visibility (polled every 10s); detail view joins `cp_tasks` / `cp_steps` /
  `cp_step_runs`.
- `/admin/control-plane/catalog` — OVH catalog and pricing (placeholder until
  `cpOvhCatalog*` resolvers land).
- `/admin/control-plane/secrets` — `cp_secrets` + `cp_env_secrets` CRUD; the
  plaintext is libsodium-encrypted server-side with `CP_SECRET_KEY`.
- `/admin/control-plane/audit` — `cp_audit` viewer with environment_id filter.
- `/admin/control-plane/operators` — flip `users.is_operator` (super-admin
  only).

All queries on these pages use `VOLATILE_FETCH_POLICY`. The corresponding
GraphQL operations are defined in `src/graphql/controlPlane.ts` in the management-ui repo.
The matching server-side surface is `ControlPlaneResolver` in
`cks-management-api/src/control-plane/graphql/resolvers/`.

## Styling

The application uses Tailwind CSS for styling with:
- Responsive design principles
- Consistent color scheme (blue primary)
- Form styling and validation states
- Loading and error states
- Accessible components

## Production Deployment

The production build is hosted on Amazon S3 and served via CloudFront.
GitHub Actions workflows under `.github/workflows/` automate the deploy on
push to `dev` and `prod` branches.

### Workflows

- `deploy-frontend-dev.yml` — triggers on push to `dev`. Bucket,
  distribution id, and `VITE_*` URLs are hardcoded to the dev values.
- `deploy-frontend-prod.yml` — triggers on push to `prod`. Bucket,
  distribution id, and `VITE_*` URLs are hardcoded to the prod values.

Both workflows also support `workflow_dispatch` for manual runs.

### Required GitHub repo secrets

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

Region is pinned to `us-east-2` in each workflow's `env:` block.

### Deploy flow

1. Merge a feature branch into `dev` (or `prod`).
2. GitHub Actions runs `npm ci`, `npm run build` with the env-specific
   `VITE_*` values injected, then `aws s3 sync dist/ s3://$S3_BUCKET --delete`.
3. A CloudFront invalidation for `/*` is issued so clients pick up the new
   `index.html` + hashed bundles immediately.

## Architecture overview

The SPA is built around three pieces designed to keep navigations cheap:

- **Apollo Client with a typed cache** (`src/lib/apollo.ts`). `typePolicies`
  centralizes per-type normalization (e.g. `User.keyFields = ['userId']`,
  scalar singletons replace on merge). The normalized cache is persisted to
  `localStorage` via `apollo3-cache-persist` and rehydrated on boot in
  `src/main.tsx`, so warm reloads paint immediately. Bump
  `APOLLO_CACHE_VERSION` whenever the schema or normalization keys change to
  invalidate any stale persisted entries.
- **Route-level data preloading** (`src/lib/routePreloader.ts`). Each page
  is registered with a lazy chunk loader and an optional list of GraphQL
  loader queries. `prefetchRoute(routeId)` warms both. The
  `<PrefetchLink>` wrapper around `react-router-dom`'s `<Link>` triggers
  `prefetchRoute` on hover, focus, touch start, and when the link enters the
  viewport via `IntersectionObserver`. A static `LIKELY_NEXT_ROUTES` map is
  walked on `requestIdleCallback` after every navigation so the next likely
  page is already in cache by the time the user clicks.
- **Code-split routes with consistent skeletons** (`src/App.tsx`,
  `src/components/PageSkeleton.tsx`). Every page is `React.lazy`-loaded and
  wrapped in `<Suspense>` with a meaningful skeleton variant (`form`,
  `dashboard`, `centered`, `default`).

A service worker (configured via `vite-plugin-pwa` in `generateSW` mode) is
emitted at build time. It precaches the app shell + Vite's hashed assets, but
explicitly bypasses `/graphql` and `/api/*` (`NetworkOnly`) so live data is
never served from disk and there are no offline writes. The SW is disabled
during `vite dev`.

## API Compatibility

This frontend is designed to work with **`cks-management-api`** (NestJS +
Apollo + TypeORM) and expects:

- Token-based authentication (`game_tokens` bearer, 64-character hex).
- GraphQL endpoint at `/graphql`.
- REST auth endpoints under `/auth/*` for login / register / password / email
  flows.
- Email confirmation redirects to `/email-confirmed`.
- Password reset redirects to `/reset-password`.
- `Me { isOperator }` field present so `AuthContext.isOperator` and
  `<RoleGate need="operator">` work.

The management API may be a strict superset of the game API; users / orgs /
apps / billing / payments live here, not in game-api.
