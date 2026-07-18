---
sidebar_position: 2
title: "01 — Project setup"
slug: 01-project-setup
---

# Project setup

## Goal

Verify connectivity to the dev-tier **Management API** and **Game API** before writing game logic.

## Configuration

```text
ManagementApiUrl=https://api.dev.crowdedkingdoms.com
GameApiHttpUrl=https://game.dev1.dev.cks-env.com/graphql
GameApiWsUrl=wss://game.dev1.dev.cks-env.com/graphql
AppId=1
OrgId=1
```

## Two URLs (required)

| API | URL | Purpose |
| --- | --- | --- |
| Management | `https://api.dev.crowdedkingdoms.com` | `register`, `login`, identity |
| Game | `https://game.dev1.dev.cks-env.com/graphql` | chunks, voxels, actors, UDP proxy |

CrowdyJS uses `managementUrl` **without** `/graphql`; game `httpUrl` and `wsUrl` **include** `/graphql`.

## CrowdyJS client

```ts
import {
  BrowserLocalStorageTokenStore,
  createCrowdyClient,
} from '@crowdedkingdoms/crowdyjs';

const client = createCrowdyClient({
  managementUrl: 'https://api.dev.crowdedkingdoms.com',
  httpUrl: 'https://game.dev1.dev.cks-env.com/graphql',
  wsUrl: 'wss://game.dev1.dev.cks-env.com/graphql',
  tokenStore: new BrowserLocalStorageTokenStore(),
});
```

:::note[Two tokens: identity vs app-scoped]
This client reaches both APIs, but the two surfaces take **different tokens**.
`register` / `login` (next chapter) return an **identity session token** — a
management-plane credential that is **rejected for gameplay**. Before any Game API
or UDP call you mint a short-lived **app-scoped token** for `AppId=1`
([chapter 2](/build-a-game/02-auto-guest-auth)) and drive gameplay with it. The
canonical wiring is an identity client (Management URL) plus a per-game client
configured with the app token; on the dev tier you can keep the single client above
and swap in the app token after minting. See
[Portals & app-scoped tokens](/management-api/portals-and-app-tokens).
:::

## Connectivity check

POST `{ query: "{ __typename }" }` to both GraphQL endpoints. Both should return HTTP 200.

## Exit criteria

- Management API reachable
- Game API reachable
- AppId=1 configured

**Try it:** [Open Chapter 1 demo](http://127.0.0.1:5173/chapter/1) (requires [local demo setup](/build-a-game/intro#run-the-interactive-demo))

Next: [Auto guest auth](/build-a-game/02-auto-guest-auth)
