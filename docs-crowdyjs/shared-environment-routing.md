---
sidebar_position: 40
title: Loading an app's Game API
---

# Loading an app's Game API

Every customer app runs on the managed **shared Game API**, scoped by `appId`.
Clients discover that URL programmatically; avoid hard-coding tier-specific hosts.

## The routing fields

After login, ask the management API where an app runs.
`client.apps.routeFor(appId)` returns three fields (a thin read over the
`app(appId)` query):

- **`gameApiUrl`** — the Game API base URL to connect to. **This is the field
  that matters**: when it is set, build a Game API client against it.
- **`splitMode`** — `false` for shared-platform apps (single managed endpoint).
- **`deploymentTarget`** — `"shared"` for apps on the shared platform.

In short: **if `gameApiUrl` is set, use it.** Before create completes, or when
reading tier defaults, use the platform's shared endpoint from `platformConfig`
(public, no auth):

```ts
import {
  BrowserLocalStorageTokenStore,
  createCrowdyClient,
} from '@crowdedkingdoms/crowdyjs';

// Identity client (Overworld/hub origin): holds the session token.
const base = createCrowdyClient({
  httpUrl: 'https://api.crowdedkingdoms.com/graphql',
  tokenStore: new BrowserLocalStorageTokenStore('crowdyjs:session'),
});

const cfg = await base.platform.config();
// cfg.sharedGameApiUrl, cfg.sharedGameApiWsUrl, cfg.freeAppsPerOrg
```

## Build the gameplay client

Sign in on the identity client (`auth.login` / `auth.register`, magic link, or
social), then **mint an app-scoped token**
for the app you are entering — gameplay rejects the identity session token. Build
the gameplay client against the app's `gameApiUrl` with its **own** token store and
seed it with the app token:

```ts
await base.auth.login({ email: 'player@example.com', password });

const route = await base.apps.routeFor(appId);
const gameApiUrl = route.gameApiUrl ?? cfg.sharedGameApiUrl;

// Same-origin/native mint with the session token. A game on a DIFFERENT origin
// uses the PKCE portal flow instead — see Portals & app-scoped tokens.
const appToken = await base.portal.mintAppToken(appId);

const game = createCrowdyClient({
  httpUrl: gameApiUrl,
  wsUrl: gameApiUrl.replace(/^http/, 'ws'),
  tokenStore: new BrowserLocalStorageTokenStore('crowdyjs:app:' + appId),
});
game.setToken(appToken.token);
// drive gameplay through `game`
```

The two clients never share a token store: `base` keeps the identity session
token, while `game` holds the app-scoped token for one app, and `game` points at
the app's own datacenter endpoint. `mintAppToken` also returns `gameApiUrl` / `gameApiWsUrl`, so
you can route from its response instead of `routeFor` for an already-provisioned
app. Rotate the app token with `game.portal.refresh()` before it expires;
switching apps mints a fresh per-app token. See
[Portals & app-scoped tokens](/management-api/portals-and-app-tokens).

## Open the realtime subscription

When you open the realtime subscription through that client, pass the **same
`appId`** — the Game API scopes each session to one app (subscribing without it
fails with `RealtimeConnectionEvent` `code: 'APP_ID_REQUIRED'`):

```ts
game.udp.subscribe(handlers, appId);
// or, equivalently:
game.world(appId).subscribe(handlers);
```

Run one per-game client per app (each holding that app's own app-scoped token)
when a player is in multiple apps at once.

## Handling "access denied"

If an app has exceeded its free allowance, run out of wallet funds, hit a spend
cap, or has a lapsed paid subscription, the Game API refuses new connections for
that app with a reason-bearing error. Surface it to the studio so they can fund
the wallet, raise the cap, or renew. See
[Shared environment & billing](/management-api/shared-environment) for the full
list of states and how to recover.

## Operator-provisioned dedicated stacks

Some internal or enterprise apps route to **dedicated** Game API hosts provisioned by platform operators. Those apps may report `splitMode: true` with a per-org `gameApiUrl`. Customer self-service apps on the shared platform do not use this path — rely on `platformConfig.sharedGameApiUrl` and `deploymentTarget: "shared"`.
