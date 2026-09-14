---
slug: before-you-ship
sidebar_position: 3
title: Before you ship
---

# Before you ship

Three things a client gets right on the machine it was built on and wrong in the build
you hand to players. None of them raises an error where the mistake is made: the wrong
host answers, the wrong SDK build installs cleanly, and a missing game-model seed only
shows up as containers that do nothing.

## 1. Use the host you were given — prefer the API's URL

Public hosts:

| Surface | Production | Bare brand name | Sandbox (dev) |
|---|---|---|---|
| CK API (GraphQL, HTTP and WebSocket) | `ck.prod.crowdedkingdoms.com` | `ck.crowdedkingdoms.com` — same addresses as `ck.prod` | `ck.dev.crowdedkingdoms.com` |
| Portal ([Management UI](/management-ui/intro)) | `studio.prod.crowdedkingdoms.com` | `studio.crowdedkingdoms.com` — same addresses as `studio.prod` | `studio.dev.crowdedkingdoms.com` |
| Sign-in / register | — | `app.crowdedkingdoms.com` — production portal | `app.dev.crowdedkingdoms.com` |
| Documentation | — | `docs.crowdedkingdoms.com` — this site | `docs.dev.crowdedkingdoms.com` |

`app.prod.crowdedkingdoms.com` and `docs.prod.crowdedkingdoms.com` do not resolve.
If you were given a different host for a preview environment, use that host —
do not invent one by pattern.

**Prefer the URL the API hands you over any host in that table.** `mintAppToken` and
`gameClientBootstrap` return `gameApiUrl` and `gameApiWsUrl` for the app you asked
about; use those for gameplay and keep the origin you started from as `discoveryUrl`.
An app lives in one datacenter and can be moved, which is why the API answers with
an endpoint rather than expecting you to build one. See
[Datacenters and endpoint routing](/game-api/datacenter-routing).

## 2. The default origin is baked into the SDK build

`npm install @crowdedkingdoms/crowdyjs` installs `latest`, whose default origin is
production (`https://ck.prod.crowdedkingdoms.com`). A sandbox project that never
passes `httpUrl` therefore talks to production.

```bash
npm install @crowdedkingdoms/crowdyjs          # production (latest)
npm install @crowdedkingdoms/crowdyjs@dev      # sandbox default origin
npm view @crowdedkingdoms/crowdyjs dist-tags   # what each tag resolves to right now
```

The simpler protection is to pass `httpUrl` and `wsUrl` explicitly, as every
example on this site does, so the default never decides anything.

## 3. Define the container type before binding a container to it

A game model does not travel with the app. `gameModelEnsureContainer` refuses a type the
app has not declared, with `extensions.code` of
[`CONTAINER_TYPE_UNDEFINED`](/overview/error-codes) — and `extensions.definedTypes`
lists what the app does declare, so a typo is visible without a second call. An app that
was recreated or moved between organizations comes back with that list empty: tokens
mint, players connect, realtime works, and only the model is missing. Re-run
`gameModelSeed`.

Older client builds could create the container and bind nothing, silently. The only sign
was in the game's own log:

```
[GameModel] InvokeAndApply: no container bound for entity F3B8B18E478BB6E95D9B1980C602CA47
```

Run the [`gameModelLint`](/game-api/game-models#linting-your-model) query against the app
before players do. It answers the whole-app version of the question — does this model
hang together — instead of surfacing one broken call at a time. The full treatment,
including seeding and authority, is in [Game Models](/game-api/game-models).

Ship with `clean: true`. Warnings are frequently fine — most are ordinary mid-edit states —
but some error codes are **enforced**, and an object with an enforced finding against it is
[quarantined](/game-api/game-models#an-error-can-stop-the-object-running): it refuses with
`OBJECT_QUARANTINED` until you write the definition again. The enforced set can grow, so an
error you decided to live with is the one that surprises you later.
