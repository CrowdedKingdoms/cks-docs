---
sidebar_position: 1
title: Introduction
slug: intro
---

# Build a collaborative canvas game

This tutorial walks you through building a **multiplayer pixel canvas** on Crowded Kingdoms — step by step, with a live demo for each chapter.

## What you'll build

- **Auto guest login** on first visit (no login form), then an **app-scoped token** minted before gameplay
- **Mouse-controlled dot** as your actor in the world
- **Click to paint** ground cells that persist in the game database
- **Viewport edge scroll** when you reach the window boundary
- **Collaborative viewport push** — multiple players coordinate to pan the shared window

The companion demo app lives in the [`simple-web-demo`](https://github.com/CrowdedKingdoms/simple-web-demo) repository. Each chapter maps to an interactive route.

## Run the interactive demo

From the monorepo (requires the `CrowdyJS` repo as a sibling of `simple-web-demo`):

```bash
cd simple-web-demo
npm install
npm run dev
```

Open http://127.0.0.1:5180 — enter your env handle in the config bar, or jump straight to the [full canvas](http://127.0.0.1:5180/canvas?env=YOUR_HANDLE&app=1&org=1).

From the docs repo:

```bash
npm run demo:install   # first time
npm run demo:dev
```

### Verify docs are sufficient

The demo's Playwright suite exercises every chapter against the live dev tier. If it passes, the docs and APIs cover everything needed to build the game:

```bash
cd simple-web-demo && npm run verify
# or from cks-docs:
npm run demo:verify
```

| Chapter | Demo route |
| --- | --- |
| 1 — Project setup | http://127.0.0.1:5173/chapter/1 |
| 2 — Auto guest auth | http://127.0.0.1:5173/chapter/2 |
| 3 — Connect & bootstrap | http://127.0.0.1:5173/chapter/3 |
| 4 — Canvas coordinates | http://127.0.0.1:5173/chapter/4 |
| 5 — Actor presence | http://127.0.0.1:5173/chapter/5 |
| 6 — Painting voxels | http://127.0.0.1:5173/chapter/6 |
| 7 — Viewport edge scroll | http://127.0.0.1:5173/chapter/7 |
| 8 — Collaborative viewport | http://127.0.0.1:5173/chapter/8 |
| 9 — Full game | http://127.0.0.1:5173/chapter/9 |
| Canvas (full game) | http://127.0.0.1:5180/canvas |
| Tanks (multiplayer demo) | http://127.0.0.1:5180/tanks |

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

Create your own app on dev and use its `appId`, or follow the tutorial's seeded demo app if provided.

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
