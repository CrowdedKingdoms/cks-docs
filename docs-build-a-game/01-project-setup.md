---
sidebar_position: 2
title: "01 — Project setup"
slug: 01-project-setup
---

# Project setup

## Goal

Verify connectivity to the Crowded Kingdoms API before writing game logic.

## Configuration

```text
ApiHttpUrl=https://api.dev.crowdedkingdoms.com/graphql
ApiWsUrl=wss://api.dev.crowdedkingdoms.com/graphql
AppId=1
OrgId=1
```

## One URL

There is a single endpoint. Identity (`register`, `login`) and gameplay (chunks,
voxels, actors, the UDP proxy) are surfaces of the same GraphQL API, so there is no
second URL to configure.

Bootstrap may hand your client a **different** origin than the one it started from:
apps live in a specific datacenter, and the API answers with that datacenter's
endpoint so the client can re-route to it. Let the SDK follow that rather than
hardcoding a per-datacenter hostname.

## CrowdyJS client

```ts
import {
  BrowserLocalStorageTokenStore,
  createCrowdyClient,
} from '@crowdedkingdoms/crowdyjs';

const client = createCrowdyClient({
  httpUrl: 'https://api.dev.crowdedkingdoms.com/graphql',
  wsUrl: 'wss://api.dev.crowdedkingdoms.com/graphql',
  tokenStore: new BrowserLocalStorageTokenStore(),
});
```

:::note[One endpoint, two tokens]
One URL does **not** mean one credential. `register` / `login` (next chapter) return
an **identity session token**, and that token is **rejected for gameplay**. Before any
world or UDP call you mint a short-lived **app-scoped token** for `AppId=1`
([chapter 2](/build-a-game/02-auto-guest-auth)) and drive gameplay with it. See
[Portals & app-scoped tokens](/management-api/portals-and-app-tokens).
:::

## Connectivity check

POST `{ query: "{ __typename }" }` to the GraphQL endpoint. It should return HTTP 200.

## Exit criteria

- API reachable
- AppId=1 configured

**Try it:** [Open Chapter 1 demo](http://127.0.0.1:5173/chapter/1) (requires [local demo setup](/build-a-game/intro#run-the-interactive-demo))

Next: [Auto guest auth](/build-a-game/02-auto-guest-auth)
