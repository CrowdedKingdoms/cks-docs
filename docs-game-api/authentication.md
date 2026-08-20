---
sidebar_position: 10
title: Authentication
---

# Authentication

Sign-in happens on the **[Management API](/management-api/intro)**, which is
**passwordless** — there is no email + password login and no password is ever
handed to a game. A user signs in with a magic link, a social provider, or the
dev bypass; that returns an identity **session token**. The Game API never sees
that flow and never receives a password — it only accepts the **app-scoped token**
minted downstream. See **[Sign in](/management-api/authentication)** for
`register`/`login`, `requestLoginLink`/`completeLoginLink`,
`socialLoginStart`/`socialLoginComplete`, and `me`.

## Gameplay requires an app-scoped token

The Game API and realtime/UDP surface accept only an **app-scoped token** (a token confined to one app), not the identity session token that sign-in returns. Obtain one by portaling into the app or with `mintAppToken` — see **[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)**. An identity session token is rejected for gameplay (`APP_TOKEN_REQUIRED` on the realtime subscription; `SCOPE_MISSING`/`FORBIDDEN` on HTTP); a token for the wrong app yields `APP_SCOPE_MISMATCH` / `INVALID_APP_ID`; an expired token yields `TOKEN_EXPIRED`.

## Using a token on the Game API

Send the app-scoped token on every GraphQL request (and in the realtime `connection_init` payload):

```http
Authorization: Bearer <64-character-hex-token>
```

CrowdyJS manages this for you: drive the Game API surface from a per-game client whose token store holds that game's app token (obtained via `client.portal`). See **[CrowdyJS](/crowdyjs/intro)** and [Portals & app-scoped tokens](/management-api/portals-and-app-tokens).

## Studio grid mutations

Grid operations (`createGrid`, `grantGridPermissions`, …) also run on the Game API and therefore also require an **app-scoped token** for the target app (studio admins can `mintAppToken` for their own app even without player entitlement). The server verifies `manage_apps` for the target app with the Management API. See **[Grids and permissions](/game-api/grids-and-permissions)**.

## Typical flow

1. **Sign in** on the Management API (passwordless) for the identity **session token** — magic link, social, or the dev bypass. See [Sign in (passwordless)](/management-api/authentication).
2. **Mint an app-scoped token** for the app you are entering — `mintAppToken` (same-origin/native) or the browser portal flow (cross-origin). Untrusted apps require user consent first; the Overworld (app 1) is trusted and skips it. See [Portals & app-scoped tokens](/management-api/portals-and-app-tokens) (and [Native & non-browser clients](/management-api/native-clients) for Unreal/Unity/desktop/console/mobile).
3. **Use the app token** as the Bearer for all Game API HTTP requests and in the realtime `connection_init` payload. Rotate it with `refreshAppToken` before `expiresAt`.

## Security notes

- Treat bearer tokens as secrets; use HTTPS only in production.
- Never send the identity session token to a game stack — only the app-scoped token belongs on the Game API.
- Restrict CORS on your own frontends to trusted origins.
