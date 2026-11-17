---
sidebar_position: 3
title: "02 — Sign in with Crowded Kingdoms"
slug: 02-sign-in
---

# Sign in with Crowded Kingdoms

## Goal

Sign the player in through Crowded Kingdoms' hosted page and come back with an **app-scoped
token** for your app. The game never sees a password or the player's session.

## Pattern

A browser game on its own domain cannot call the sign-in mutations (`register`, `login`, magic
link): the API answers `HOSTED_SIGN_IN_REQUIRED` to every page except Crowded Kingdoms Studio's.
Instead the game sends the player to Studio's `/authorize` page, and Studio sends them back with a
one-time code that the SDK exchanges for a token confined to your app. While the player is
signed in to Studio, that round trip needs no clicks.

Studio's page does everything around the sign-in, so your game handles none of it: signing in or
signing up, the platform's documents and your app's own, the player's age, a confirmed email for a
new password account, and, the first time the player enters an app that isn't trusted, their
consent.

## Register your page

The page the player returns to must be on one of your app's **redirect URIs**, matched by origin.
In Studio, open your app under **Apps** and add the page's origin under **Settings > Sign-in &
redirect URIs**: `http://localhost:5173` for the Vite dev server, and your production origin when you
[host the game](/build-a-game/host-your-game). The same list is the API's CORS allow-list for
your app, and a change applies within ten seconds.

## Sign in

```ts
const APP_ID = '<your-app-id>';
const returnTo = window.location.origin + window.location.pathname;

async function signedIn() {
  // 1. Back from the hosted page? Exchange the one-time code for an app token.
  const returned = await client.portal.handleSignInCallback();
  if (returned) return returned;

  // 2. A token from an earlier visit? Rotate it; an expired one is refused.
  if (await client.session.restore()) {
    try {
      return await client.portal.refresh();
    } catch {
      client.session.setToken(null);
    }
  }
  return null; // 3. Not signed in yet.
}

const entered = await signedIn();
if (!entered) {
  signInButton.hidden = false;
  signInButton.onclick = () =>
    client.portal.signIn({ appId: APP_ID, redirectUri: returnTo });
}
```

`client` is the one from [chapter 1](/build-a-game/01-project-setup), whose
`BrowserLocalStorageTokenStore` keeps the token across reloads. `handleSignInCallback()` stores
the token on the client and removes `code` and `state` from the address bar, so a reload does
not try to spend the code twice. It returns null when the URL carries no code, which is also what
happens when the player presses **Cancel** on the consent card: the page comes back with
`?error=access_denied`, and the button shows again.

The token response carries `token`, `appId`, `expiresAt`, and the app's own endpoint in
`gameApiUrl` and `gameApiWsUrl`; [Loading an app's Game API](/crowdyjs/shared-environment-routing)
covers routing to it. The token is already app-scoped: there is no `mintAppToken` step in a
browser game.

## Stay signed in

App tokens last about 30 minutes. Call `client.portal.refresh()` before `expiresAt` to rotate
the token without leaving the game. When a refresh is refused, call `client.portal.signIn` again:
the player's Studio session may have ended, or a document changed and needs accepting, and the
hosted page handles both.

## Sign out

A **Sign out** control forgets the token with `client.session.setToken(null)` and shows the
button again. The token lapses on its own within about 30 minutes; the player stays signed in to
Crowded Kingdoms until they sign out in Studio.

## Exit criteria

- Signing in returns to the game holding an app-scoped token for your app
- A reload keeps the player signed in
- Another browser profile signs in as a different player

**In The Construct:** `src/platform/network/NetworkManager.ts` (`signInHosted`,
`completeHostedSignInIfPresent`, `restore`) and `src/main.ts` (`boot`) do the same.

See [Portals & app-scoped tokens](/management-api/portals-and-app-tokens) for the flow underneath.

Next: [Connect & bootstrap](/build-a-game/03-connect-and-bootstrap)
