---
sidebar_position: 3
title: Sign in
---

# Sign in

A user authenticates one of three ways, and every path returns an identity
**session token** (an `AuthResponse`):

- **Email + password** — `register` to create an account, `login` to return to one.
- **Magic link** — a one-time link emailed to the address.
- **Social / OIDC** — a federated provider (e.g. Google).

These are peers on one email-keyed account rather than alternatives: an account
created by magic link can later add a password, and signing in with Google and
with a magic link for the same verified address resolves to the same account.

:::caution[The dev bypass is gone]
`devLogin` and the `devToken` field on `requestLoginLink` were **removed on
2026-08-20** — deleted, not disabled, so no environment variable brings them
back. `devLogin` returned a session for any address with no proof of ownership,
and `devToken` put the emailed one-time token in the response body where any
unauthenticated caller could read it. Automated clients should `register` an
account they hold the password to.
:::

The session token is a **management-plane** credential. It is **not valid for
gameplay**: to play, mint a short-lived **app-scoped token** from it — see
[Portals & app-scoped tokens](/management-api/portals-and-app-tokens) and
[Game API → Authentication](/game-api/authentication).

:::note[Browser clients]
CrowdyJS wraps every flow below behind `client.auth` — see
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
  }
}
# variables: { "input": { "email": "player@example.com", "redirectUri": "https://app.example.com/auth/callback" } }
```

```graphql
# 2) Complete sign-in with the token from the link. Public —
#    the token authorizes the call; throws if invalid/expired/already used.
mutation Complete($input: CompleteLoginLinkInput!) {
  completeLoginLink(input: $input) { token gameTokenId user { userId email } }
}
# variables: { "input": { "token": "<one-time-token-from-the-link>" } }
```

The `redirectUri` origin must be an allowed app/UI origin; it defaults to the
platform sign-in page. The token leaves **only** by email; there is no way to
read it out of the response. An environment with email delivery switched off
therefore cannot complete a magic-link sign-in at all — use email + password
there.

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


`availableLoginProviders` reflects exactly what is configured, so drive your
sign-in UI from it rather than hard-coding provider buttons.

## Email + password

`register` creates the account and returns a session immediately. `login`
returns to an existing one.

```graphql
mutation Register($registerUserInput: RegisterUserInput!) {
  register(registerUserInput: $registerUserInput) { token gameTokenId user { userId email } }
}
# variables: { "registerUserInput": { "email": "player@example.com", "password": "..." } }
```

```graphql
mutation Login($loginUserInput: LoginUserInput!) {
  login(loginUserInput: $loginUserInput) { token gameTokenId user { userId email } }
}
# variables: { "loginUserInput": { "email": "player@example.com", "password": "..." } }
```

Two behaviours to code against, because both are easy to meet by accident:

- **`register` on an address that already has an account does not sign you in.**
  The password is attached *pending email confirmation* and the mutation throws.
  This stops somebody who only knows an address from claiming a password on an
  account they do not control. Fall back to `login`.
- **`login` refuses an unconfirmed password when the account has another
  verified sign-in method**, with *"Confirm your email to enable password sign-in
  for this account."* The remedy is the emailed confirmation link, not a
  different password. A password-only account signs in immediately, because
  there is no other method to protect.

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
- There is no environment in which authentication is weaker. The dev bypass
  (`devLogin`, the `mock` provider, and `devToken`) used to make non-production
  tiers different, which meant a deploy could get security wrong; it is deleted
  rather than switched off, so there is nothing left to configure incorrectly.
