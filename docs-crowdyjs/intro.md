---
slug: intro
sidebar_position: 1
title: Introduction
---

# CrowdyJS SDK

Browser-first TypeScript SDK shipped as **`@crowdedkingdomstudios/crowdyjs`**. Wraps:

- **`cks-management-api`** — authentication, profiles, marketplace, org dashboards, billing.
- **`cks-game-api`** — voxel/world synchronization, teleport, realtime UDP-proxy channel.

It keeps a shared `AuthState` so bearer tokens ride both transports identically — see **Upstream README** beside this guide for APIs and quick starts.
