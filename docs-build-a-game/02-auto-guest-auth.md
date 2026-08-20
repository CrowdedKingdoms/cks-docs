---
sidebar_position: 3
title: "02 — Auto guest sign-in"
slug: 02-auto-guest-auth
---

# Auto guest sign-in

## Goal

Give every visitor a session automatically — no login form, no password.

## Pattern

A guest is a **real account the browser creates for itself**: a generated email and
a generated password, both stored locally. There is no login form, and the account
is a normal one — the player can add a magic link or a social identity to it later
and keep their progress.

This used to be one call to a dev bypass. That bypass is gone (see the note
below), and the replacement is barely longer, because a brand-new address is
exactly the case where `register` returns a session immediately.

```ts
const stored = JSON.parse(localStorage.getItem('guest') ?? 'null');
const guest = stored ?? {
  email: `guest-${crypto.randomUUID().slice(0, 8)}@demo.local`,
  // Generated, kept locally, never shown. It is what lets this browser get back
  // into the SAME account tomorrow -- lose it and the guest is a new player.
  password: `Aa1!${crypto.randomUUID()}`,
};

await client.auth.register(guest);
localStorage.setItem('guest', JSON.stringify(guest));
```

On subsequent visits, restore the stored session first and only sign in again if it
has lapsed. Note this is `login`, not `register`: the address exists now, and
`register` would refuse it.

```ts
await client.session.restore();
if (!client.session.getToken()) {
  await client.auth.login(guest);
}
```

Store the guest credentials separately from the bearer token.
`BrowserLocalStorageTokenStore` holds whichever token is current — the identity
**session token** right after sign-in, then the **app-scoped token** once you mint
it (below).

:::note[Why not a magic link?]
A magic link needs the player to open an inbox, which is exactly the friction a
guest flow exists to avoid. Password is the automatic path. If you would rather
not hold a password in `localStorage`, `requestLoginLink` is the alternative and
costs you the inbox round trip.

The **dev bypass this chapter used to recommend is gone** — `devLogin` was deleted
on 2026-08-20, along with the `devToken` shortcut, because both handed out a
session with no proof that the caller owned the address. Nothing replaces them on
any tier. See [Sign in](/management-api/authentication).
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

Provide a "Reset guest" control that clears the stored guest credentials and calls
`client.auth.logout()`. Clearing them is what makes the next visit a new player;
the old account still exists and is simply unreachable from this browser.

## Exit criteria

- Refresh preserves session
- Incognito window gets a new guest account

Next: [Connect & bootstrap](/build-a-game/03-connect-and-bootstrap)
