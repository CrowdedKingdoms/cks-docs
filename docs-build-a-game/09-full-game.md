---
sidebar_position: 10
title: "09 — Full game"
slug: 09-full-game
---

# Full game

## Goal

Combine all chapters into one shippable game.

## Checklist

- [ ] Auto guest auth on load
- [ ] App-scoped token minted after auth, refreshed before expiry
- [ ] UDP connected and subscribed
- [ ] Mouse moves local dot; remote dots visible
- [ ] Click paints with color palette
- [ ] Paint hydrates on join and persists on reload
- [ ] Viewport scrolls at edges
- [ ] Collaborative push from multiple players
- [ ] Status panel: user, peers, net push, event log

## Stack summary

| Layer | In this tutorial | In The Construct |
| --- | --- | --- |
| Shell | Vite + TypeScript | Vite + TypeScript, `GameScene` adapter |
| Rendering | Raw canvas 2D | pixi.js (Paint) and three.js (hub) |
| Backend I/O | CrowdyJS → dev-tier APIs | CrowdyJS + World Stores |
| Persistence | Voxel updates via the UDP proxy | Chunk store write-back (`markDirty` → `chunks.update`) |

## Next steps

- Clone [The Construct](https://github.com/CrowdedKingdoms/the-construct) and compare its `PaintScene` with what you built — then replace it with your game (`docs/NEW-GAME-CHECKLIST.md`).
- Host it as a static site with the headers client mods need (`docs/HOSTING.md` in The Construct).
- Extend with chat (`sendTextPacket`), larger palette, or zoom.

## Related docs

- [CrowdyJS SDK guide](/crowdyjs/readme)
- [GraphQL UDP Proxy API](/game-api/graphql-udp-proxy-api)
- [Dev tier](/management-ui/dev-tier)
