---
slug: intro
sidebar_position: 1
title: Overview
---

# Overview

Crowded Kingdoms provides APIs that individuals and studios can use to create online games with unlimited player density (UPD). There are **two**: one GraphQL API, and the replication (UDP) protocol.

The GraphQL API has two surfaces — **management** (identity, orgs, billing, app registry) and **game** (world data and realtime) — but they are one service at one endpoint, documented separately here because they are read at different times. What separates them is the token, not the host: sign-in yields an identity session token, and gameplay needs an app-scoped token minted from it.

Customer apps run on a shared platform scoped by `appId`. An app lives in **one datacenter**, so the API tells your client which endpoint to use for that app rather than expecting you to know. Dedicated per-org environments were retired without replacement.

SDKs wrap these APIs in a more user-friendly interface and paradigm.

## Support

Join the [Crowded Kingdoms Discord](https://discord.gg/x7tMKGwHf) for community support, questions, and product updates.

## APIs

### Management surface
- On the GraphQL API at [https://ck.prod.v7.cks-env.com/graphql](https://ck.prod.v7.cks-env.com/graphql) (dev: [https://ck.dev.v7.cks-env.com/graphql](https://ck.dev.v7.cks-env.com/graphql))
- Manage user and org accounts
- Configure marketplace settings for apps (games)
- Create apps on the shared platform; manage billing and wallet

### Game surface
- The same GraphQL API, for world data and realtime
- Call it at the app's own endpoint — `mintAppToken` and `gameClientBootstrap` return `gameApiUrl` / `gameApiWsUrl`, and `platformConfig` / `app.gameApiUrl` also carry it
- Used to get assigned a replication server
- Authenticated with an **app-scoped token** (minted per app from your identity session token — see [Portals & app-scoped tokens](/management-api/portals-and-app-tokens)), not the login session token
- Provides functionality to manage game state, permissions, settings, teams, channels, chunks, and more

### Replication  
- Our UDP replication servers are nicknamed "Buddy"
- Buddy servers run alongside the Game API (shared fleet or dedicated stack)
- Use the game API to get assigned one or more Buddies
- You communicate directly to the IP address given by the game API via unecrypted UDP
- You'll use Buddy to send spatially routed messages from one client to some or all nearby clients
- The revolution that now makes true single shard games with unlimited player density possible is that Buddy servers work together to spatially route an unlimited number of messages per second. If you build your game on top of this kind of replication layer, you'll be able to deliver the necessary information to each client to render a virtually unlimited number of objects in your player's field of view.

## SDKs

### Unreal
- https://github.com/CrowdedKingdoms/CrowdySDK-Unreal

### Javascript
- **CrowdyJS** — TypeScript SDK for browser and Node clients (`@crowdedkingdoms/crowdyjs`). MIT license. 
- NPM: https://www.npmjs.com/package/@crowdedkingdoms/crowdyjs
- GitHub: https://github.com/CrowdedKingdoms/CrowdyJS

### Godot (Planned)
- https://github.com/CrowdedKingdoms/CrowdySDK-Godot 


## Where to go next

- **[Brand guidelines](/overview/brand)** — colors, typography, wordmark, and UI tokens for Crowded Kingdoms surfaces.
- **[Client Workflow](/overview/client-workflow)** — how the APIs and SDK fit together.
- **[Dev tier (client integration)](/management-ui/dev-tier)** — public dev URLs and shared-platform config for early client testing.
- **[Create your first app](/management-ui/create-your-first-app)** — register on the shared platform.
- **Management API** — authenticate, manage orgs, apps, billing, and shared environment.
- **Game API** — chunks, voxels, actors, avatars, studio grids, and the GraphQL UDP proxy.
- **Replication API** — wire protocol for native UDP clients.
- **CrowdyJS** — install, configure endpoints, and run a game loop.
- **Management UI** — portal workflows including [apps on the shared platform](/management-ui/environments).

# Docs Project

- https://github.com/CrowdedKingdoms/cks-docs
- Pull requests are welcome!!
- We're all in the same shard now:)
