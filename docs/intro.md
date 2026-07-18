---
slug: intro
sidebar_position: 1
title: Overview
---

# Overview

Crowded Kingdoms provides APIs that individuals and studios can use to create online games with unlimited player density (UPD). There are three distinct APIs: management, game, and replication. There is a central **management environment** (identity, orgs, billing, app registry) and a **shared game platform** where customer apps run by default — one managed Game API fleet per tier, scoped by `appId`. Platform operators can provision **dedicated environments** (isolated Game API + database + Buddy per org) for internal or enterprise use; that path is not self-service in the customer portal.

SDKs wrap these APIs in a more user-friendly interface and paradigm.

## Support

Join the [Crowded Kingdoms Discord](https://discord.gg/x7tMKGwHf) for community support, questions, and product updates.

## APIs

### Management  
- A GraphQL API at [https://api.crowdedkingdoms.com/graphql](https://api.crowdedkingdoms.com/graphql) (dev: [https://api.dev.crowdedkingdoms.com/graphql](https://api.dev.crowdedkingdoms.com/graphql))
- Manage user and org accounts
- Configure marketplace settings for apps (games)
- Create apps on the shared platform; manage billing and wallet

### Game 
- A GraphQL API on the **shared platform** for customer apps (discover URL via `platformConfig` or `app.gameApiUrl`)
- Dev tier shared endpoint: [https://game.shared.dev.cks-env.com/graphql](https://game.shared.dev.cks-env.com/graphql)
- Dedicated environments (operator-provisioned) host one or more apps on org-specific Game API hosts
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
