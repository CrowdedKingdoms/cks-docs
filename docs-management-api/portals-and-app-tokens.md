---
sidebar_position: 30
title: Portals & app-scoped tokens
---

# Portals & app-scoped tokens

Crowded Kingdoms uses **two kinds of token** so a game never receives a player's
full identity. An **Overworld** (a hub app — **app 1**, which is trusted) can
portal players into other games, and each game's stack only ever receives a token
confined to that one app.

- **Identity session token** — returned by a **sign-in**: email + password, a
  magic link, or social/OIDC — see [Sign in](/management-api/authentication).
  The dev bypass was removed from every tier on 2026-08-20.
  It is a *management-plane* credential (account, studio admin) and the **only**
  thing that can mint app tokens. It is **not valid for gameplay**: the Game API
  and the realtime/UDP surface reject it. Keep it on your trusted identity origin;
  never send it to a game stack.
- **App-scoped gameplay token** — short-lived (default ~30 min), confined to one
  app. Used as the Bearer against that app's Game API + realtime surface. A
  compromised or third-party game only ever sees a token for its own app.

## Sign in first

Everything below starts from an identity **session token**, which you get from a
sign-in on the CK GraphQL API — email + password, magic link, or social. Briefly:
`requestLoginLink` → `completeLoginLink` (magic link), `socialLoginStart` →
`socialLoginComplete` (social/OIDC), or `login`/`register` (email + password). The full flow
is in **[Sign in](/management-api/authentication)**. Hold the
session token on your identity origin and mint app tokens from it as below.

## Minting an app token

### Native / same-origin (`mintAppToken`)

A client that already holds the session token can mint directly:

```graphql
mutation Enter($appId: BigInt!) {
  mintAppToken(input: { appId: $appId }) {
    token gameTokenId appId expiresAt gameApiUrl gameApiWsUrl discoveryUrl launchUrl
  }
}
```

Send `Authorization: Bearer <session token>`. Free/open apps auto-grant access on
first mint; paid apps require an existing entitlement (else `FORBIDDEN`). Use the
returned `token` against `gameApiUrl` / `gameApiWsUrl`.

**Keep `discoveryUrl`, and do not confuse it with `gameApiUrl`.** `gameApiUrl` is the ONE
datacenter holding this app's data, which is where gameplay must go. `discoveryUrl` is the
shared origin, resolving to every datacenter — it is the only address that survives losing
one, and therefore the only way back when the endpoint you were given stops answering.
That matters most for exactly this flow: a client holding only an app token **cannot
re-mint**, because minting needs the session token it does not have. See
[Datacenters and endpoint routing](/game-api/datacenter-routing).

For native clients (Unreal/Unity, desktop, console, mobile, custom launchers), see
**[Native & non-browser clients](/management-api/native-clients)** for the full
sign-in → mint → play flow and the launcher / PKCE-loopback handoff
patterns.

### Browser handoff (OAuth2 Authorization Code + PKCE)

When the game runs at a **different origin** from the Overworld, use the
authorization-code flow so the verifier never leaves the game origin and the
session token never leaves the Overworld:

1. **Game origin** generates a PKCE verifier + challenge and redirects the player
   to the Overworld's authorize page with the challenge and its `redirect_uri`.
2. **Overworld origin** (holds the session token) checks consent, then mints a
   one-time code:

   ```graphql
   # For an untrusted app, gate on consent first (trusted apps return consentRequired=false).
   query Consent($appId: BigInt!) {
     portalConsent(appId: $appId) { trusted alreadyGranted consentRequired }
   }

   mutation Authorize($input: CreatePortalAuthorizationCodeInput!) {
     createPortalAuthorizationCode(input: $input) { code redirectUri expiresAt }
   }
   ```

   then redirects back to the game's `redirect_uri` carrying `code`. The
   `redirect_uri` must match the app's **registered allow-list** (see below) or
   the call is rejected.
3. **Game origin** exchanges the code (with its verifier) — no auth header
   required, the code + verifier authorize the call:

   ```graphql
   mutation Exchange($input: ExchangePortalCodeInput!) {
     exchangePortalCode(input: $input) {
       token gameTokenId appId expiresAt gameApiUrl gameApiWsUrl discoveryUrl launchUrl
     }
   }
   ```

The one-time code is single-use, short-lived (~60s), bound to the supplied
`redirect_uri`, and only issued after the redirect allow-list and consent checks
pass.

The official SDK wraps all of this in `client.portal` — including the consent
gate (`handleAuthorizeRequest` throws `PortalConsentRequiredError` for an untrusted
app until you approve) — see [CrowdyJS](/crowdyjs/intro).

## Consent and the OAuth client registry

Each app is an OAuth-style client with platform-controlled settings:

| Field | Meaning |
|---|---|
| `isTrusted` | First-party apps skip the consent screen. **The Overworld (app 1) is trusted.** Platform-controlled — studio admins cannot set it. |
| `redirectUris` | Allow-list of redirect URIs for the browser portal handoff (origin-matched). An empty list disallows browser portal entry. |
| `clientType` | `"public"` (browser/PKCE, no secret) or `"confidential"` (server-side). |
| `launchUrl` | Browser destination a player is sent to when they portal into the app. |

**Redirect allow-list.** `createPortalAuthorizationCode` validates the requested
`redirectUri` against the app's `redirectUris` by **origin**. A mismatch (or an app
with no registered URIs) is rejected, so a third party cannot redirect a player's
authorization code to an origin the app owner never approved.

**Consent gate for untrusted apps.** Trusted apps mint a code directly. For an
**untrusted** app, the user must have an active authorization grant; otherwise
`createPortalAuthorizationCode` fails with a `FORBIDDEN` error whose message is
prefixed **`CONSENT_REQUIRED`** (see [Error codes](/overview/error-codes#consent)).
The Overworld resolves this by showing a consent screen and recording the grant
before minting the code:

```graphql
# Does the user need to consent before this app can receive a token?
query Consent($appId: BigInt!) {
  portalConsent(appId: $appId) { appName trusted alreadyGranted consentRequired }
}

# Record the user's approval (idempotent). Call from the consent screen.
mutation Approve($input: AuthorizeAppInput!) {
  authorizeApp(input: $input) { grantId appId scopes status grantedAt }
}
# variables: { "input": { "appId": "42" } }
```

**App owners: register client settings.** With `manage_apps` on the app, configure
the allow-list and client metadata (the `isTrusted` flag is **not** settable here —
it is platform-controlled):

```graphql
mutation Settings($input: SetAppClientSettingsInput!) {
  setAppClientSettings(input: $input) { appId trusted consentRequired }
}
# variables: { "input": { "appId": "42",
#   "redirectUris": ["https://my-game.example.com/portal/callback"],
#   "clientType": "public",
#   "launchUrl": "https://my-game.example.com" } }
```

## Connected apps (view & revoke)

Consent grants are tracked as the user's "connected apps". A user can review and
revoke them at any time; revoking also **immediately revokes that app's live tokens**
for the user, so a portaled game loses access on the next call:

```graphql
# The signed-in user's active authorizations.
query Connected {
  myAuthorizedApps { grantId appId appName scopes status grantedAt revokedAt }
}

# Revoke an app's authorization (and its live app tokens for this user).
mutation Disconnect($appId: BigInt!) { revokeAppAuthorization(appId: $appId) }
```

## Staying connected: refresh

App tokens expire. To keep playing the **same** app without bouncing back through
the Overworld, rotate the token before it lapses (re-checks entitlement, revokes
the old token):

```graphql
mutation Refresh { refreshAppToken { token expiresAt } }
```

Send the current app token as the Bearer. Switching to a **different** app always
routes back through the Overworld for a fresh per-app token.

## What an app token may do

An app token is accepted on the Game API + realtime surface **only for its own
app**, plus read-only `me` and `refreshAppToken` on the Management API. Every
other management operation (billing, orgs, minting tokens for other apps)
requires the identity session token and returns `SCOPE_MISSING` for an app token.

## Errors

- `FORBIDDEN` on `mintAppToken` — no entitlement for a paid app.
- `FORBIDDEN` (message prefixed **`CONSENT_REQUIRED`**) on
  `createPortalAuthorizationCode` — the user has not authorized this untrusted app
  yet. Call `authorizeApp` (after `portalConsent`) first. See
  [Error codes → Consent](/overview/error-codes#consent).
- `BAD_REQUEST` on `createPortalAuthorizationCode` — the `redirectUri` origin is
  not in the app's registered `redirectUris` allow-list (or the app has none
  configured). The owner sets them with `setAppClientSettings`.
- `SCOPE_MISSING` — an app token was used for a management operation it isn't
  allowed to perform, or for a different app.
- Realtime `APP_TOKEN_REQUIRED` / `APP_SCOPE_MISMATCH`, UDP `TOKEN_EXPIRED` /
  `INVALID_APP_ID` — see [Error codes](/overview/error-codes).
