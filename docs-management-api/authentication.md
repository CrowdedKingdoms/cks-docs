---
sidebar_position: 3
title: Sign in (passwordless)
---

# Sign in (passwordless)

Crowded Kingdoms is **passwordless**. There is **no email + password login and no
registration form** — accounts are created on first sign-in. A user authenticates
one of three ways, and every path returns an identity **session token** (an
`AuthResponse`):

- **Magic link** — a one-time link emailed to the address.
- **Social / OIDC** — a federated provider (e.g. Google).
- **Dev bypass** — a direct sign-in for local/dev/test only (never production).

The session token is a **management-plane** credential. It is **not valid for
gameplay**: to play, mint a short-lived **app-scoped token** from it — see
[Portals & app-scoped tokens](/management-api/portals-and-app-tokens) and
[Game API → Authentication](/game-api/authentication).

:::note[Browser clients]
CrowdyJS wraps every flow below behind `client.auth` (passwordless) — see
[CrowdyJS → Authentication](/crowdyjs/readme#authentication-session-vs-app-scoped-tokens).
You rarely hand-write these mutations in a browser.
:::

## What you get back

A successful sign-in returns an `AuthResponse`:

```graphql
type AuthResponse {
  token: String!        # identity SESSION token — send as Authorization: Bearer <token>
  gameTokenId: String!  # id of the underlying session row
  user: User!           # the authenticated (or just-created) account
}
```

Send `Authorization: Bearer <token>` on subsequent Management API requests. Resolve
the caller with `me { userId email gamertag }`.

## Magic link (email)

Two steps. Request a link, then complete the sign-in with the token from it.

```graphql
# 1) Email a one-time sign-in link. Always reports sent=true (no account
#    enumeration). Creates the account on first sign-in. Public.
mutation Request($input: RequestLoginLinkInput!) {
  requestLoginLink(input: $input) {
    sent
    devToken   # DEV ONLY: present when DEV_AUTH_BYPASS is on (no email is sent); else null
  }
}
# variables: { "input": { "email": "player@example.com", "redirectUri": "https://app.example.com/auth/callback" } }
```

```graphql
# 2) Complete sign-in with the token from the link (or devToken in dev). Public —
#    the token authorizes the call; throws if invalid/expired/already used.
mutation Complete($input: CompleteLoginLinkInput!) {
  completeLoginLink(input: $input) { token gameTokenId user { userId email } }
}
# variables: { "input": { "token": "<one-time-token-from-the-link>" } }
```

The `redirectUri` origin must be an allowed app/UI origin; it defaults to the
platform sign-in page. In development (`DEV_AUTH_BYPASS=true`) no email is
delivered — `requestLoginLink` returns the `devToken` directly so tests and local
flows can call `completeLoginLink` without an inbox.

## Social / OIDC

Providers are pluggable. List the enabled ones, then run a standard
redirect-based OAuth/OIDC handshake.

```graphql
# Which providers are enabled right now, e.g. ["google"].
query Providers { availableLoginProviders }
```

```graphql
# 1) Begin: returns a URL to send the browser to and an opaque state to round-trip.
mutation Start($input: SocialLoginStartInput!) {
  socialLoginStart(input: $input) { authorizeUrl state }
}
# variables: { "input": { "provider": "google", "redirectUri": "https://app.example.com/auth/google/callback" } }
```

Redirect the browser to `authorizeUrl`. The provider sends the user back to your
`redirectUri` with a `code`; complete the sign-in with that `code` and the
`state` you started with:

```graphql
# 2) Complete: creates/links the account by provider identity, returns a session.
mutation Done($input: SocialLoginCompleteInput!) {
  socialLoginComplete(input: $input) { token gameTokenId user { userId email } }
}
# variables: { "input": { "provider": "google", "code": "<from-provider>", "state": "<from-step-1>" } }
```

The framework is **provider-agnostic**. Today it ships:

| Provider | Enabled when |
|---|---|
| **`google`** | `GOOGLE_CLIENT_ID` **and** `GOOGLE_CLIENT_SECRET` are configured on the server. |
| **`mock`** | Dev only — appears **only** when `DEV_AUTH_BYPASS=true`. Never in production. |

`availableLoginProviders` reflects exactly what is configured, so drive your
sign-in UI from it rather than hard-coding provider buttons.

## Dev bypass

`devLogin` returns a session for an email **without** email or social
verification. It is active **only** when the server runs with
`DEV_AUTH_BYPASS=true` (local, dev, and test environments) and throws `FORBIDDEN`
otherwise. It is used by tests and fixtures and is **never** enabled in
production.

```graphql
mutation Dev($input: DevLoginInput!) {
  devLogin(input: $input) { token gameTokenId user { userId email } }
}
# variables: { "input": { "email": "player@example.com" } }
```

## Federated identities (linking sign-in methods)

An account can have several linked sign-in identities (a Google identity, an email
magic-link identity, …). The account is created on **first** sign-in; on later
sign-ins an identity is matched by `(provider, subject)` and linked to an existing
account by **verified email**, so signing in with Google and with a magic link for
the same verified address resolves to one account.

```graphql
# The signed-in user's linked identities (requires a session token).
query Mine { myIdentities { identityId provider subject email emailVerified lastLoginAt } }
```

- `linkIdentity(input: { provider, code, state })` — link an additional identity
  from a `socialLoginStart` callback to the **signed-in** account. Throws if that
  identity is already linked to another account.
- `unlinkIdentity(identityId)` — remove a linked identity. Refuses to remove your
  **last** remaining sign-in method (so you can never lock yourself out).

## Sessions and sign-out

- `logout` ends the current session (deletes the `game_token` that authenticated
  the request); other devices stay signed in. Signing out an identity session also
  **revokes every app token it minted**.
- `logoutAllDevices` ends every active session for the user.

## Security notes

- Treat the session token (and any app token) as a secret; use HTTPS only in
  production.
- `requestLoginLink` never reveals whether an address has an account (`sent` is
  always `true`); one-time link tokens are single-use and short-lived.
- Restrict your own frontends' CORS and redirect origins to trusted hosts; the
  server validates `redirectUri` origins for both magic-link and social flows.
- The dev bypass (`devLogin` + the `mock` provider) must never be enabled in
  production. `availableLoginProviders` and the presence of `devToken` are the
  machine-readable signals that it is on.
