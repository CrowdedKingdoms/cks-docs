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

## 1. Use the tier-labelled host you were given

Every customer-facing surface has a host per tier, and the bare brand name is an alias
for production. The aliases answer, so nothing tells you which one you used.

| Surface | dev | test | production | Bare brand name |
|---|---|---|---|---|
| CK API (GraphQL, HTTP and WebSocket) | `ck.dev.crowdedkingdoms.com` | `ck.test.crowdedkingdoms.com` | `ck.prod.crowdedkingdoms.com` | `ck.crowdedkingdoms.com` — same addresses as `ck.prod` |
| Portal ([Management UI](/management-ui/intro)) | `studio.dev.crowdedkingdoms.com` | `studio.test.crowdedkingdoms.com` | `studio.prod.crowdedkingdoms.com` | `studio.crowdedkingdoms.com` — same addresses as `studio.prod` |
| Sign-in / register | `app.dev.crowdedkingdoms.com` | `app.test.crowdedkingdoms.com` | — | `app.crowdedkingdoms.com` — redirects to the production portal |
| Documentation | `docs.dev.crowdedkingdoms.com` | `docs.test.crowdedkingdoms.com` | — | `docs.crowdedkingdoms.com` — this site |

Two entries in that table have no tier-labelled production host at all:
`app.prod.crowdedkingdoms.com` and `docs.prod.crowdedkingdoms.com` do not resolve. The
shape is not a rule you can apply to a name you have not checked.

**Prefer the URL the API hands you over any host in that table.** `mintAppToken` and
`gameClientBootstrap` return `gameApiUrl` and `gameApiWsUrl` for the app you asked
about; use those for gameplay and keep the origin you started from as `discoveryUrl`.
That is not only about tiers — an app lives in one datacenter and can be moved between
them, which is why the API answers with an endpoint rather than expecting you to build
one. See [Datacenters and endpoint routing](/game-api/datacenter-routing).

A client that composes its own URL from a hostname is pinned to that hostname. Two API
roots have been retired since August 2026 and production moved to a labelled host on
2026-08-27; a client reading `gameApiUrl` followed all of it without a release.

## 2. The default origin is baked into the SDK build, per tier

`@crowdedkingdoms/crowdyjs` publishes one build per tier under an npm dist-tag:

| dist-tag | Version shape | `CROWDY_DEFAULT_HTTP_ORIGIN` in that build |
|---|---|---|
| `dev` | `X.Y.Z-dev.N` | `https://ck.dev.crowdedkingdoms.com` |
| `test` | `X.Y.Z-test.N` | `https://ck.test.crowdedkingdoms.com` |
| `latest` | `X.Y.Z` | `https://ck.crowdedkingdoms.com` (production) |

`npm install @crowdedkingdoms/crowdyjs` installs `latest`, so a project meant for the dev
tier that never passes `httpUrl` points at production. Install the tag that matches the
tier you are integrating against:

```bash
npm install @crowdedkingdoms/crowdyjs@dev    # or @test, or omit for production
npm view @crowdedkingdoms/crowdyjs dist-tags # what each tag resolves to right now
```

The build states which tier it is for: `CROWDY_DEFAULT_TIER` is `dev`, `test` or `prod`,
alongside `CROWDY_DEFAULT_HTTP_ORIGIN`, `CROWDY_DEFAULT_WS_ORIGIN` and
`CROWDY_DEFAULT_HOST`. Assert on it in your startup code if a cross-tier client would be
expensive to discover in the wild.

The simpler protection is to pass `httpUrl` and `wsUrl` explicitly, as every example on
this site does, so the default never decides anything.

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
