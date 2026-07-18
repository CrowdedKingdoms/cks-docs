---
sidebar_position: 3
title: "02 — Auto guest sign-in"
slug: 02-auto-guest-auth
---

# Auto guest sign-in

## Goal

Give every visitor a session automatically — no login form, no password.

## Pattern

Crowded Kingdoms is **passwordless** — there is no `register`/`login` and no
password. On the **dev tier** the **dev bypass** is enabled, so `devLogin` issues a
session for any email in one call. Generate a stable guest email on first visit and
sign in with it:

```ts
const guestEmail =
  JSON.parse(localStorage.getItem('guest') ?? 'null')?.email ??
  `guest-${crypto.randomUUID().slice(0, 8)}@demo.local`;

// Dev bypass (dev tier): one-call passwordless session. The account is created on
// first sign-in and matched by email afterwards, so the same guest email = same account.
await client.auth.devLogin(guestEmail);
localStorage.setItem('guest', JSON.stringify({ email: guestEmail }));
```

On subsequent visits, restore the stored session first and only sign in again if it
has lapsed:

```ts
await client.session.restore();
if (!client.session.getToken()) {
  await client.auth.devLogin(guestEmail);
}
```

Store the guest email separately from the bearer token. `BrowserLocalStorageTokenStore`
holds whichever token is current — the identity **session token** right after sign-in,
then the **app-scoped token** once you mint it (below).

:::note[Bypass disabled? Use a magic link]
`devLogin` only works where the dev bypass is on (`DEV_AUTH_BYPASS`, i.e. local/dev/test
including the dev tier) and returns `FORBIDDEN` otherwise. For a real "guest" flow in
production, swap it for the magic link: `client.auth.requestLoginLink({ email })` then
`client.auth.completeLoginLink(token)` (the token arrives by email), or a social
provider. See [Sign in (passwordless)](/management-api/authentication).
:::

## Mint an app-scoped token for gameplay

Sign-in returns an **identity session token**: a management-plane credential that the
Game API and UDP surface **reject**. While you hold it (right after signing in), mint a
short-lived **app-scoped token** for `AppId=1` — that token is what chapters 3+ use:

```ts
// Direct (same-origin) mint — the session token authorizes the call.
const appToken = await client.portal.mintAppToken('1');
client.setToken(appToken.token); // gameplay now uses the app-scoped token
```

`mintAppToken` returns `{ token, gameTokenId, appId, expiresAt, gameApiUrl, gameApiWsUrl, launchUrl }`. App tokens are short-lived (~30 min): call `client.portal.refresh()` before `expiresAt` to keep playing the same app. On a returning visit where `restore()` loaded a still-valid app token you can skip straight to chapter 3; if it expired, `refresh()` or sign in again and re-mint. When the game runs at a **different origin** from your identity/Overworld page, use the PKCE portal flow (`client.portal.beginEntry` / `handleAuthorizeRequest` / `completeEntry`) instead — `AppId=1` (the Overworld) is trusted, so it skips the consent screen; untrusted apps prompt the player first. See [Portals & app-scoped tokens](/management-api/portals-and-app-tokens) and [Game API authentication](/game-api/authentication).

## Reset

Provide a "Reset guest" control that clears the stored guest email and calls `client.auth.logout()`.

## Exit criteria

- Refresh preserves session
- Incognito window gets a new guest account

Next: [Connect & bootstrap](/build-a-game/03-connect-and-bootstrap)
