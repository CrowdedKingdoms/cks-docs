---
sidebar_position: 1
title: Introduction
slug: intro
---

# Build a collaborative canvas game

This tutorial walks you through building a **multiplayer pixel canvas** on Crowded Kingdoms — step by step, at the wire level: sign in, mint an app token, subscribe to the realtime stream, send actor and voxel updates, and read them back.

## What you'll build

- **Auto guest login** on first visit (no login form), then an **app-scoped token** minted before gameplay
- **Mouse-controlled dot** as your actor in the world
- **Click to paint** ground cells that persist in the game database
- **Viewport edge scroll** when you reach the window boundary
- **Collaborative viewport push** — multiple players coordinate to pan the shared window

Each chapter is self-contained code you can paste into any Vite + TypeScript project.

## The companion repository: The Construct

[`the-construct`](https://github.com/CrowdedKingdoms/the-construct) is the public starter
repository and this tutorial's working companion. It contains everything the chapters teach,
built the way a real game is built: an engine-agnostic platform layer over CrowdyJS (two tokens,
datacenter routing, token rotation), World Stores for presence and chunks, a three.js hub and a
pixi.js **paint program** — the same shared canvas this tutorial builds — driven by one session,
a kit-seeded game model, Crowdy Studio embedded with server and client mods, and a Setup wizard
that creates your org and app from inside the game.

```bash
git clone https://github.com/CrowdedKingdoms/the-construct.git
cd the-construct
npm install
npm run dev
```

Open [http://localhost:5175](http://localhost:5175), create an account, let Setup create your app, then step on the
**Paint** pad. Where a chapter below shows the raw call, the repository shows the same thing
through World Stores: `src/platform/realtime/WorldStores.ts` (presence, chunks),
`src/scenes/program-pixi/PaintScene.ts` (painting, persistence), `src/platform/network/NetworkManager.ts`
(sign-in, minting, rotation). Read the tutorial for the mechanism and the repository for the
architecture.

## Prerequisites

- Node.js 20+
- A modern browser
- No org membership required for the dev tier

## Fixed dev-tier configuration

All chapters use these values:

```text
ApiHttpUrl=https://ck.dev.crowdedkingdoms.com/graphql
GameApiHttpUrl=https://ck.dev.crowdedkingdoms.com/graphql
GameApiWsUrl=wss://ck.dev.crowdedkingdoms.com/graphql
AppId=<your-app-id>
```

Create your own app on dev and use its `appId` — The Construct's Setup wizard does exactly this, or use CK Studio's **Get started**.

See also [Dev tier (client integration)](/management-ui/dev-tier).

## Chapters

1. [Project setup](/build-a-game/01-project-setup) — connectivity and config
2. [Auto guest auth](/build-a-game/02-auto-guest-auth) — register, then mint an app-scoped token
3. [Connect & bootstrap](/build-a-game/03-connect-and-bootstrap) — app token → UDP proxy
4. [Canvas coordinates](/build-a-game/04-canvas-coordinates) — world → chunk/voxel
5. [Actor presence](/build-a-game/05-actor-presence) — mouse → dot
6. [Painting voxels](/build-a-game/06-painting-voxels) — click to color
7. [Viewport edge scroll](/build-a-game/07-viewport-edge-scroll) — pan the window
8. [Collaborative viewport](/build-a-game/08-collaborative-viewport) — push together
9. [Full game](/build-a-game/09-full-game) — assembly

Reference pages:

- [Voxel color format](/build-a-game/reference-voxel-color-format)
- [Actor state layout](/build-a-game/reference-actor-state-layout)
