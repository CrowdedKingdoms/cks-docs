---
sidebar_position: 6
title: Hosting on Crowdy Games (retired)
---

# Hosting on Crowdy Games (retired)

Crowdy Games, the site where Crowded Kingdoms hosted developers' browser games, was
retired on **2026-10-29** on every environment. Crowded Kingdoms no longer hosts games:
build yours and serve it from a static host of your own, as
[Host your game](/build-a-game/host-your-game) describes. The platform's hosting API is
switched off, and its mutations answer `CONTENT_HOSTING_DISABLED`; see
[Management API → Hosting on Crowdy Games](/management-api/hosting-on-crowdy-games).

The SDK surface that wrapped it is still in CrowdyJS, deprecated:

- **`client.hosting`** (`claim`, `beginPublish`, `completePublish`, `abandonPublish`,
  `setEnabled` and `publishes`) rejects with `CONTENT_HOSTING_DISABLED`, and its other
  reads (`game`, `listed` and `mine`) resolve to `null` or an empty list.
- **`publishDirectory`** and `manifestForDirectory`, from
  `@crowdedkingdoms/crowdyjs/hosting`, cannot publish, because `beginPublish` is refused.
- **`EmbeddedHost`** (`client.embeddedHost`) bridged sign-in for a game framed by the
  Crowdy Games shell. Nothing frames games now, so `portal.signIn` finds no shell and
  takes the ordinary top-level flow, which is what a self-hosted game always did.

Remove these calls from your code; do not build anything new on them. Sign-in needs
only `client.portal.signIn` and `client.portal.handleSignInCallback`; see
[Hosted sign-in for a game on its own domain](/management-api/portals-and-app-tokens#hosted-sign-in-for-a-game-on-its-own-domain).
