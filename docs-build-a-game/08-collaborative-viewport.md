---
sidebar_position: 9
title: "08 — Collaborative viewport"
slug: 08-collaborative-viewport
---

# Collaborative viewport

## Goal

Multiple players at viewport edges push the shared window together; conflicting pushes cancel.

## Push flags

Encode edge push intent in actor state byte 16 (see [Actor state layout](/build-a-game/reference-actor-state-layout)):

| Bit | Direction |
| --- | --- |
| 1 | North (top edge) |
| 2 | South |
| 4 | East |
| 8 | West |

When the dot is within `EDGE_MARGIN` of an edge, set the corresponding bit.

## Net force

Each frame, collect push vectors from all players (local + remote):

```
netX = sum(pushX for each player) / playerCount
netY = sum(pushY for each player) / playerCount
viewport.x += netX * PUSH_SPEED
viewport.y += netY * PUSH_SPEED
```

Two players pushing east and one pushing west → net +0.33 east.

## Coordination gameplay

Players must cooperate to reach distant canvas regions and paint together — opposing pushes stall movement.

## Exit criteria

- 2+ clients demonstrate coordinated panning
- Opposing pushes visibly cancel

Next: [Full game](/build-a-game/09-full-game)
