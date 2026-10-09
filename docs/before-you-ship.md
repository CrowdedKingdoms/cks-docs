---
slug: before-you-ship
sidebar_position: 3
title: Before you ship
---

# Before you ship

Two things a client gets right on the machine it was built on and wrong in the build
you hand to players. Neither raises an error where the mistake is made: the wrong host
answers, and the wrong SDK build installs cleanly.

## 1. Use the host you were given — prefer the API's URL

Public hosts:

| Surface | Production | Bare brand name |
|---|---|---|
| CK API (GraphQL, HTTP and WebSocket) | `ck.prod.crowdedkingdoms.com` | `ck.crowdedkingdoms.com` — same addresses as `ck.prod` |
| Portal ([Management UI](/management-ui/intro)) | `studio.prod.crowdedkingdoms.com` | `studio.crowdedkingdoms.com` — same addresses as `studio.prod` |
| Sign-in / register | `studio.prod.crowdedkingdoms.com/login` | `studio.crowdedkingdoms.com/login` — same portal |
| Documentation | — | `docs.crowdedkingdoms.com` — this site |

`docs.prod.crowdedkingdoms.com` does not resolve. The `dev` and `test` hosts
(`*.dev.crowdedkingdoms.com`, `*.test.crowdedkingdoms.com`) are Crowded Kingdoms' internal
environments: they refuse outside accounts with `TIER_ACCESS_REQUIRED`, so a build shipped
against them works for nobody you ship it to. The former `app.*.crowdedkingdoms.com` sign-in hosts were retired on 2026-09-16; use the Studio hosts above.
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
production (`https://ck.prod.crowdedkingdoms.com`). Install `latest`: the `dev` and
`test` dist-tags are builds for Crowded Kingdoms' internal environments, whose default
origins refuse outside accounts.

```bash
npm install @crowdedkingdoms/crowdyjs          # production (latest)
npm view @crowdedkingdoms/crowdyjs dist-tags   # what each tag resolves to right now
```

The simpler protection is to pass `httpUrl` and `wsUrl` explicitly, as every
example on this site does, so the default never decides anything.
