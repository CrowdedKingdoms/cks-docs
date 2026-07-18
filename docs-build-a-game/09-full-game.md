---
sidebar_position: 10
title: "09 — Full game"
slug: 09-full-game
---

# Full game

## Goal

Combine all chapters into one shippable demo at `/canvas`.

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

| Layer | Technology |
| --- | --- |
| Tutorial shell | Vite + React + React Router |
| Rendering | Raw canvas 2D |
| Backend I/O | CrowdyJS → dev-tier APIs |
| Persistence | Game API voxels via UDP proxy |

## Next steps

- Deploy the demo as a static site (see [simple-web-demo README](https://github.com/CrowdedKingdoms/simple-web-demo#deploy-static-site))
- Embed or link from this docs section
- Extend with chat (`sendTextPacket`), larger palette, or zoom

**Try it:** [Open full canvas demo](http://127.0.0.1:5180/canvas) · [Run `npm run demo:verify`](/build-a-game/intro#verify-docs-are-sufficient) to validate all chapters

## Related docs

- [CrowdyJS SDK guide](/crowdyjs/readme)
- [GraphQL UDP Proxy API](/game-api/graphql-udp-proxy-api)
- [Dev tier](/management-ui/dev-tier)
