---
sidebar_position: 2
title: For AI agents
---

# For AI agents and integrators

This page is the fastest path for an autonomous agent (or any backend integrator) to
call Crowded Kingdoms correctly. It links the machine-readable schema, states the
global conventions, and walks the three most common end-to-end workflows.

This page is for external API clients and coding agents. The in-product
**Agentic Crowdy Studio** model runtime is a separate, allowlisted development
contract deployed in tracked release `v0.1.94`: use its
[player/SDK guide](/crowdyjs/agentic-crowdy-studio),
[game-host guide](/game-api/agentic-crowdy-studio), and
[operator runbook](/operators/agentic-crowdy-studio). It never gives a model
the raw GraphQL access described below.

## The surface at a glance

| API | Protocol | Use it for |
|-----|----------|------------|
| **Management API** | GraphQL (HTTP) | Identity, organizations, the apps marketplace, access tiers, billing, payments, quotas, and dedicated/shared environments. This is the **studio-backend** surface. |
| **Game API** | GraphQL (HTTP + WebSocket) | Runtime world data (chunks, voxels, actors, avatars) and the realtime **UDP-proxy** subscription/spatial-send surface. This is the **game-client** surface — authenticated with an **app-scoped token** (not the identity session token). |
| **Replication API (Buddy)** | Binary UDP | Lowest-latency native spatial replication. Most clients use the Game API UDP-proxy instead and never touch raw UDP. Buddy authenticates only app-scoped tokens. |
| **CrowdyJS** | TypeScript SDK | Browser clients — wraps passwordless sign-in, `client.portal` (app-scoped tokens / PKCE / consent), the Game API, and the UDP proxy. Use one identity client plus a per-game client. Prefer it for web. |

## Get the schema

- Management API SDL: [`/schema/management-api.graphql`](pathname:///schema/management-api.graphql)
- Game API SDL: [`/schema/game-api.graphql`](pathname:///schema/game-api.graphql)
- CrowdyJS SDL: [`/schema/crowdyjs.graphql`](pathname:///schema/crowdyjs.graphql)
- Introspection is enabled on the dev tier; each GraphQL API serves a Playground at its `/graphql` endpoint.

Every machine-readable index is at [`/llms.txt`](pathname:///llms.txt).

## Global conventions

- **Auth (passwordless, two tokens):** sign-in on the Management API is
  **passwordless** — there is no `login`/`register`. Obtain an **identity session
  token** with a magic link (`requestLoginLink` → `completeLoginLink`), a social
  provider (`socialLoginStart` → `socialLoginComplete`; enabled providers in
  `availableLoginProviders`), or — in dev/test (`DEV_AUTH_BYPASS=true`) — `devLogin`.
  That session token is a **management-plane** credential and is **rejected for
  gameplay**; the Game API + realtime/UDP surface require an **app-scoped token**
  confined to one app. Mint one from the session token with
  `mintAppToken(input:{ appId })` (or the PKCE portal flow across origins, which adds
  a consent gate for untrusted apps), then send `Authorization: Bearer <token>` — the
  **session token** on Management API requests, the **app-scoped token** on Game API
  HTTP requests and in the `graphql-transport-ws` `connection_init` payload. App
  tokens expire (~30 min) — `refreshAppToken` before then. See
  [Sign in (passwordless)](/management-api/authentication),
  [Portals & app-scoped tokens](/management-api/portals-and-app-tokens), and
  [Game API → Authentication](/game-api/authentication).
- **`BigInt`** is transmitted as a **decimal string** in both directions (e.g. `"123"`),
  never a JSON number — this avoids precision loss. IDs (`appId`, `orgId`, `userId`) are
  `BigInt`.
- **`DateTime`** is an ISO-8601 UTC string, e.g. `2026-06-12T18:00:00Z`.
- **Money** fields named `*Cents` are in minor currency units (cents); pair them with the
  adjacent `currency` field.
- **Errors** are structured — `extensions.code` (+ `remediation`, and `requiredPermission`
  for auth failures). See [Error codes](/overview/error-codes).
- **Pagination:** prefer the Relay `*Connection` queries (`first`/`after`); offset args are
  deprecated. See [Pagination](/overview/pagination).
- **Rate limits / cost** — see [Rate limits](/overview/rate-limits).
- **Idempotency:** economy-sensitive and destructive mutations accept an optional
  `idempotencyKey` (on the `input` object or as a top-level arg). Send one when retrying so a
  retry replays the first result instead of double-applying; a different payload under the
  same key returns `IDEMPOTENCY_CONFLICT`. The realtime `sequenceNumber` is **correlation
  only**, not deduplication.
- **Permissions are machine-readable:** each guarded field carries a
  `@requiresPermission(scope:, permission:, scopeArg:)` directive in the SDL/introspection.

## Get a sandbox key

Use the **dev tier** to sign in (passwordless), create an org and an app, and obtain your
identity session token without touching production data (then `mintAppToken` per app for
gameplay). On any environment with the **dev bypass** enabled (`DEV_AUTH_BYPASS=true` —
local/dev/test), an agent can get a session in one call with `devLogin(input:{ email })`
(and `requestLoginLink` returns `devToken` directly, no inbox); otherwise use the magic
link or a social provider — see [Sign in (passwordless)](/management-api/authentication).
Start at [Dev tier](/management-ui/dev-tier) and
[Create your first app](/management-ui/create-your-first-app).

## Workflow 1 — realtime gameplay (recommended path)

```graphql
# 1) Authenticate (Management API, passwordless). Returns the identity SESSION token.
#    Dev/test (DEV_AUTH_BYPASS): devLogin is a one-call session. In production use the
#    magic link (requestLoginLink -> completeLoginLink) or social (socialLoginStart ->
#    socialLoginComplete) instead. See /management-api/authentication.
mutation DevLogin {
  devLogin(input: { email: "player@example.com" }) {
    token   # session token — management-plane only; mint an app token next
  }
}

# 2) Mint an app-scoped token (Management API, session token as the Bearer). Use THIS
#    token for every Game API HTTP request and the realtime connection_init. (Browser
#    games at a different origin use the PKCE portal flow instead — see CrowdyJS.)
mutation Enter {
  mintAppToken(input: { appId: "1" }) {
    token expiresAt gameApiUrl gameApiWsUrl discoveryUrl
  }
}

# 3) Per-app bootstrap (Game API, app-token Bearer): version requirements, UDP state, spatial limits.
query Bootstrap {
  gameClientBootstrap(appId: "1") {
    sequenceNumberModulo
    maxReplicationDistance
    maxDecayRate
    udpProxyConnectionStatus { connected }
    versionInfo { minimumClientVersion }
  }
}

# 4) Open the UDP proxy (idempotent) and subscribe (appId-scoped).
mutation Connect { connectUdpProxy }

subscription Realtime {
  udpNotifications {
    __typename
    ... on ActorUpdateNotification { uuid chunkX chunkY chunkZ state sequenceNumber epochMillis }
    ... on GenericErrorResponse { sequenceNumber errorCode }
    ... on RealtimeConnectionEvent { status code message retryable }
  }
}

# 5) Send a spatial update. The Boolean result means "accepted for sending" — the
#    applied result (or an error) arrives asynchronously on the subscription above,
#    correlated by sequenceNumber.
mutation Move {
  sendActorUpdate(input: {
    appId: "1",
    chunk: { x: "0", y: "0", z: "0" },
    uuid: "0123456789abcdef0123456789abcdef",
    state: "AA==",          # base64 app-defined actor state
    distance: 8, decayRate: 1, sequenceNumber: 1
  })
}
```

Key behavior: `sendActorUpdate` returning `true` only means the datagram was accepted —
the server applies it asynchronously and reports failures as a `GenericErrorResponse`
carrying the same `sequenceNumber`. Unsubscribing stops delivery but does not close the
session; call `disconnectUdpProxy` to close it. Browser clients should use
[CrowdyJS](/crowdyjs/readme) instead of hand-writing this.

## Workflow 2 — native UDP (advanced, lowest latency)

For native clients that bypass the GraphQL proxy: sign in (passwordless) for the identity
session token, **mint an app-scoped token** for the app (`mintAppToken`), discover a server with the
Game API `serverWithLeastClients` (app-token Bearer), then send the binary long-spatial
message to the server's client port `9091` with an HMAC computed from your 64-octet
**app-scoped** token. Refresh before `expiresAt` (`refreshAppToken`) or Buddy drops the
session with `TOKEN_EXPIRED`. Full protocol: [Replication API](/replication-api/intro),
[Authenticate and assign](/replication-api/authenticate-and-assign),
[Wire formats](/replication-api/wire-formats), [HMAC](/replication-api/hmac). Native
clients never send the internal peer handshake.

## Workflow 3 — studio backend (economy and access)

Server-side automation (with a studio/org token) typically:

```graphql
# Create an app, then a paid access tier for it.
mutation NewApp { createApp(input: { orgId: "10", name: "My Game", slug: "my-game" }) { appId } }

mutation NewTier {
  createAccessTier(input: { appId: "42", name: "Premium", priceCents: "999", permissionKeys: ["access"] }) { id }
}

# Check an org wallet (minor units), then open a top-up checkout.
query Wallet { walletBalance(orgId: "10") { balanceCents currency } }

mutation TopUp {
  createCheckout(input: { purpose: ORG_WALLET_TOPUP, orgId: "10", amountCents: "5000", provider: STRIPE }) {
    externalUrl status
  }
}

# Grant a user access to an app (entitlement change that propagates to the game runtime).
mutation Grant { grantAppAccess(input: { appId: "42", userId: "777", tierId: "5" }) { status } }
```

The exact input fields are authoritative in the [Management API SDL](pathname:///schema/management-api.graphql)
and reference — every field, argument, and enum value carries a description, including the
required org/app permission and any side effects. Redirect the user to `externalUrl` to
complete a checkout; wallet credit reconciles via webhook, not the redirect.

## Agent gotchas

- **Retry safely with an idempotency key.** Economy-sensitive and destructive mutations
  accept an optional `idempotencyKey`; pass one (a UUID per logical operation) so a retried
  `createCheckout`/grant/etc. replays the first result instead of double-applying. Without a
  key, a retried non-idempotent mutation can double-create.
- **Permissions are per field and machine-readable.** Each guarded field has a
  `@requiresPermission` directive (and names the permission in its description). A read-only
  or wrong-scope token gets `FORBIDDEN` (with `extensions.requiredPermission`) or
  `SCOPE_MISSING`.
- **Game vs management surface.** Identity/billing operations only work on the Management
  API; calling them on the Game API returns `FORBIDDEN`/not-found. Route accordingly.
- **Consent gate on the portal handoff.** Minting a browser portal code for an **untrusted**
  app fails with a `FORBIDDEN` error whose message is prefixed `CONSENT_REQUIRED` until the
  user authorizes it. Check `portalConsent(appId)` and call `authorizeApp` first; trusted
  apps (e.g. the Overworld, app 1) skip consent. The requested `redirectUri` must also be in
  the app's `redirectUris` allow-list. See [Error codes → Consent](/overview/error-codes#consent).
- **Silent drops on native UDP.** A failed HMAC or bad token can be dropped with no NAK —
  do not treat silence as packet loss. (Not applicable to the GraphQL proxy path.)
