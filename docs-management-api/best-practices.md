---
sidebar_position: 4
title: Best practices
---

# Management API best practices

Identity, orgs, apps, entitlements, and billing. The management surface is
the same GraphQL endpoint as the Game API — what changes is the **token**,
not the host.

## Sign-in and tokens

- Obtain an **identity session token** with email + password, a magic link,
  or a social provider. [Sign in](/management-api/authentication).
- That session token is **rejected for gameplay**. Mint an **app-scoped
  token** with `mintAppToken` (or the [portal / PKCE flow](/management-api/portals-and-app-tokens))
  before any Game API, realtime, or UDP call.
- A browser game on **your own domain** must use hosted Studio `/authorize`
  — do not put a Crowded Kingdoms login form on a customer origin.
- Treat session and app tokens as secrets. Refresh the app token before
  `expiresAt` (`refreshAppToken`).
- Org API tokens are for **your** backends and CI. Do not ship them in a
  player-facing client.

## Hosts

- Prefer `platformConfig.sharedGameApiUrl` and the URLs `mintAppToken`
  returns over a hostname you assemble.
- Production GraphQL: `https://ck.prod.crowdedkingdoms.com/graphql`.
  Sandbox / integration: see
  [Dev tier](/management-ui/dev-tier).
- There is no separate management host. Do not set `managementUrl`.

## Apps and entitlements

- Create the app, then entitle players before they play. Open-by-default
  apps auto-entitle on first `mintAppToken`; restricted or paid apps need
  `grantAppAccess` (or a purchase). [Game setup](/management-api/game-setup).
- Runtime permission keys on a tier (`access`, `teleport`, …) are what the
  Game API and Buddy enforce. A token without the right key is
  `UNAUTHORIZED`, not a client bug.
- Publish to the shared platform (`publishAppToShared`). Customer-provisioned
  dedicated environments are retired.

## Billing and retries

- Wallet amounts are **micro-USD** (`*Microusd`). Processor amounts stay in
  cents.
- Pass an `idempotencyKey` on `createCheckout`, grants, and other
  economy-sensitive mutations.
- Shared-environment usage is real: a runaway client or load test can
  runtime-deny the app. Set spend caps before generating sustained traffic.
  [Shared environment](/management-api/shared-environment).

## Related

- [Overview best practices](/overview/best-practices)
- [Game API best practices](/game-api/best-practices)
- [Error codes](/overview/error-codes)
