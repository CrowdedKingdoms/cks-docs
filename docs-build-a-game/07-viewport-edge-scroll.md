---
sidebar_position: 8
title: "07 — Viewport edge scroll"
slug: 07-viewport-edge-scroll
---

# Viewport edge scroll

## Goal

Keep a fixed-size window into an infinite world; scroll when the dot reaches the edge.

## Viewport state

Track `viewport.x` and `viewport.y` (world coordinates of the top-left corner). Render at:

```
screenX = worldX - viewport.x
screenY = worldY - viewport.y
```

## Edge detection

When the local dot's screen position is within `EDGE_MARGIN` pixels of any edge, shift the viewport:

```
if (localX < margin) viewport.x -= SCROLL_SPEED
if (localX > width - margin) viewport.x += SCROLL_SPEED
// same for Y
```

This is **client-only** — no server calls required.

## Exit criteria

- Single player can move beyond the initial view bounds

Next: [Collaborative viewport](/build-a-game/08-collaborative-viewport)
