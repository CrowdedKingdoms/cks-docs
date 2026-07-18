---
sidebar_position: 31
title: Native & non-browser clients
---

# Native & non-browser clients

This guide is for **native clients** — Unreal/Unity desktop, console, and mobile
games, native launchers, and any custom client that is **not** a browser page.
Native clients use the **same** app-scoped token system as the web (see
[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)); the only
browser-specific piece is the cross-origin redirect. This page shows how a native
client signs in, obtains an **app-specific token**, and uses it for gameplay.

The model is unchanged:

- **Identity session token** — from a [passwordless sign-in](/management-api/authentication).
  A *management-plane* credential that can mint app tokens; **rejected for
  gameplay**. Keep it in the OS secure store; never hand it to a game stack you
  don't control.
- **App-scoped token** — short-lived (~30 min), confined to one app. The Bearer
  for that app's Game API + realtime surface, and the HMAC key for its UDP
  traffic. This is what a native game actually plays with.

```text
sign in (passwordless)  ->  identity SESSION token
        |                         |
        |                         v
        |                   mint an APP-SCOPED token  (mintAppToken / portal code)
        v                         |
  OS secure store                 v
                          Game API (Bearer) + UDP (HMAC)  ->  play
```

## Step 1 — Sign in (passwordless)

There is no password. A native client runs one of the
[passwordless flows](/management-api/authentication) and stores the returned
**session token** in the OS secure store (Keychain, Android Keystore, Windows
DPAPI/Credential Manager, libsecret) — not a plaintext file.

The web examples in [Sign in (passwordless)](/management-api/authentication) use a
`redirectUri` on a web origin. On native, use a redirect the OS can hand back to
your app:

- a **custom URI scheme** you register — `mygame://auth/callback`, or
- a **loopback** address — `http://127.0.0.1:<port>/callback` (RFC 8252).

**Magic link.** `requestLoginLink({ email, redirectUri })` → the email link opens
the system browser → it redirects to your scheme/loopback carrying the one-time
token → `completeLoginLink(token)`. In dev (`DEV_AUTH_BYPASS`) `requestLoginLink`
returns `devToken` directly, so tests skip the inbox.

**Social / OIDC.** Drive the OAuth dance in the **system browser** —
`ASWebAuthenticationSession` (iOS/macOS), Chrome Custom Tabs (Android), or AppAuth
— never an embedded webview (which can capture credentials):

```graphql
mutation Start($input: SocialLoginStartInput!) {
  socialLoginStart(input: $input) { authorizeUrl state }
}
# { "input": { "provider": "google", "redirectUri": "mygame://auth/callback" } }
```

Open `authorizeUrl`; the provider returns `code` (+ your `state`) to the
redirect; finish with `socialLoginComplete({ provider, code, state })`.

**Dev bypass.** `devLogin({ email })` returns a session in one call on
local/dev/test (`DEV_AUTH_BYPASS`); `FORBIDDEN` in production.

:::caution[Register your native redirect URIs]
The server validates `redirectUri` **origins** for magic-link and social flows.
Custom schemes and loopback addresses used by your native client must be allowed
for it, or the call is rejected — the same allow-list discipline as web.
:::

## Step 2 — Get an app-specific token

This is the core of native integration. Pick the pattern that matches who holds
the session token and whether the game is first- or third-party.

### A. Single first-party game — direct `mintAppToken`

The common case: your game signed the user in, so it already holds the session
token. Mint a token for **its own** app and play with it.

```graphql
mutation Enter($appId: BigInt!) {
  mintAppToken(input: { appId: $appId }) {
    token gameTokenId appId expiresAt gameApiUrl gameApiWsUrl launchUrl
  }
}
```

Send `Authorization: Bearer <session token>`. Free/open apps auto-grant on first
mint; paid apps need an entitlement (else `FORBIDDEN`). The session token stays in
your secure store to mint/refresh; the **app token** drives gameplay.

### B. Native launcher → child game (local handoff)

A native launcher (an Overworld for native games) holds the session and launches
child games — each child should get **only** an app token, never the session.
The launcher mints per child and passes the app token over a **local** channel
(launch argument, environment variable, stdin, or local IPC):

```text
launcher (holds SESSION)  --mintAppToken(childAppId)-->  app token
        |                                                     |
        +--- spawn child process, pass APP TOKEN only --------+
child game (gets APP TOKEN, never the session)  ->  play
```

This mirrors the browser Overworld, but the handoff is a trusted local process
boundary, so no redirect/PKCE is required.

### C. Confined / third-party native — OAuth2 PKCE (RFC 8252)

When the hub and game must **not** share the session even locally (e.g. a
third-party native game), use the same authorization-code + PKCE flow as the
browser, with a **loopback or custom-scheme** `redirectUri` registered in the
app's allow-list. The verifier never leaves the child; the session never leaves
the hub.

1. **Child** generates a PKCE verifier + challenge and asks the hub to authorize
   `appId` with its `redirectUri`.
2. **Hub** (holds the session) checks consent, then mints a one-time code:

   ```graphql
   mutation Authorize($input: CreatePortalAuthorizationCodeInput!) {
     createPortalAuthorizationCode(input: $input) { code redirectUri expiresAt }
   }
   # { "input": { "appId": "42", "codeChallenge": "<base64url-sha256>",
   #   "codeChallengeMethod": "S256", "redirectUri": "mygame://portal/callback" } }
   ```

   and hands `code` back to the child via the loopback/scheme.
3. **Child** exchanges it (no auth header — the code + verifier authorize the
   call):

   ```graphql
   mutation Exchange($input: ExchangePortalCodeInput!) {
     exchangePortalCode(input: $input) {
       token gameTokenId appId expiresAt gameApiUrl gameApiWsUrl launchUrl
     }
   }
   # { "input": { "code": "<one-time>", "codeVerifier": "<verifier>" } }
   ```

Untrusted apps require consent first (`portalConsent` → `authorizeApp`); the
Overworld (app 1) is trusted and skips it. See
[Consent and the OAuth client registry](/management-api/portals-and-app-tokens#consent-and-the-oauth-client-registry).

### Which pattern?

| Pattern | Who holds the session | Use when |
|---|---|---|
| **A. Direct mint** | the game itself | a single first-party native game |
| **B. Launcher handoff** | the launcher (child gets app token only) | a native hub launching your own games |
| **C. PKCE (loopback/scheme)** | the hub only (child never sees it) | third-party / sandboxed native games |

## Step 3 — Use the app token

The returned `token` is the credential for the app's stack — use the
`gameApiUrl`/`gameApiWsUrl` it came with:

- **Game API** — `Authorization: Bearer <app token>` on HTTP, and in the realtime
  `connection_init` payload. See [Game API → Authentication](/game-api/authentication).
- **UDP** — the app token is the **HMAC key** (the 64 characters **as-is**, do not
  hex-decode) and `serverWithLeastClients` installs your Buddy session;
  `gameTokenId` goes in the spatial message tail. Full steps in
  [Authenticate and assign](/replication-api/authenticate-and-assign) and
  [HMAC](/replication-api/hmac).

A session token (or a token for a different app) is rejected for gameplay:
`APP_TOKEN_REQUIRED` / `APP_SCOPE_MISMATCH` on realtime, `INVALID_APP_ID` on UDP,
`SCOPE_MISSING` on the Game API.

## Step 4 — Refresh and expiry

App tokens expire (~30 min). To keep playing the **same** app, rotate before
`expiresAt` (send the current app token as the Bearer):

```graphql
mutation Refresh { refreshAppToken { token expiresAt } }
```

If a token lapses mid-session, Buddy drops the session and emits **`TOKEN_EXPIRED`**
(UDP error 32) — mint/refresh and re-assign. Switching to a **different** app
always gets a fresh per-app token (pattern A/B/C again). See
[Error codes](/overview/error-codes).

## Security checklist for native clients

- Store the **session token** in the OS secure store; keep **app tokens** in
  memory (they are short-lived).
- Never pass the session token to a game stack you don't fully control — use
  pattern **C** (PKCE) for third-party native games so the session stays in the hub.
- Use the **system browser** for social sign-in, never an embedded webview.
- Register your native `redirectUri`s (custom scheme / loopback) on the app.
- HTTPS only for Management/Game API calls.

## SDKs

The **[Unreal SDK](/unreal-sdk/runtime/authentication)** implements this flow for
Unreal projects (sign-in → mint → `RequestUDPAccess`). For browsers, CrowdyJS
wraps the same model behind `client.auth` + `client.portal` — see
[CrowdyJS](/crowdyjs/intro). A custom native client talks to the GraphQL
mutations above directly.

This guidance applies equally to the Unreal Editor itself when it acts as a sign-in client (for example,
Crowdy Studio's social/magic-link sign-in) -- it runs the same system-browser + loopback redirect flow as
a packaged native game, not a browser-specific one.
