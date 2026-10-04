---
sidebar_position: 3
title: Best practices
---

# CrowdyJS best practices

## Two clients, two tokens

Build an **identity** client (session token) and a **per-game** client
(app-scoped token). Gameplay surfaces reject the session token.

```ts
const identity = createCrowdyClient({ httpUrl, tokenStore: sessionStore });
await identity.auth.login({ email, password });
const appToken = await identity.portal.mintAppToken(appId);

const game = createCrowdyClient({
  httpUrl: appToken.gameApiUrl ?? httpUrl,
  wsUrl: appToken.gameApiWsUrl ?? wsUrl,
  tokenStore: appStore,
});
game.setToken(appToken.token);
```

Do not set `managementUrl`. There is one GraphQL origin.

A game on **your own domain** uses hosted Studio sign-in
(`client.portal.signIn`), not `auth.login` from the page.

## Follow the app's endpoint

Use `gameApiUrl` / `gameApiWsUrl` from `mintAppToken` or
`game.serverStatus.gameClientBootstrap(appId)`. Keep the shared origin as
`discoveryUrl` for recovery. See
[Shared environment routing](/crowdyjs/shared-environment-routing) and
[Datacenter routing](/game-api/datacenter-routing).

Pass `httpUrl` and `wsUrl` explicitly so an SDK default never silently
points a sandbox build at production.

## Server code on ck-exec

Drive gameplay rules through your app's [ck-exec](/exec/intro) hubs, which a
game calls through `client.exec`. The browser presents confirmed state; it
does not decide damage, captures, or team assignment locally. A call that is
refused throws a `CrowdyExecError` whose `status` names why (`AppError`,
`Denied`, …); `retryable` is true for the statuses worth trying again with
backoff.

See [Game API best practices](/game-api/best-practices) and
[connect from a game](/exec/connect-from-a-game).

## Credentials

- Do not embed a `manage_apps` session or an org token in the public game
  bundle.
- Refresh the app token before `expiresAt`.
- Studio-admin surfaces belong in a trusted admin tool, not the shipped
  player client.

## Related

- [SDK guide](/crowdyjs/readme)
- [Overview best practices](/overview/best-practices)
