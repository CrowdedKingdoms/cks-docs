---
slug: intro
sidebar_position: 1
title: Introduction
---

# CrowdyJS SDK

Browser-first TypeScript SDK: **`@crowdedkingdoms/crowdyjs`**. (Building a
native client? [CrowdyCPP](/crowdycpp/intro) mirrors this API surface in
portable C++ and replicates natively over UDP.)

- **Management API** — authentication, profiles, app routing reads (`client.apps`), and public platform config (`client.platform`).
- **Game API** — world synchronization, teleport, the GraphQL UDP proxy (browsers), [channels](/crowdyjs/channels) & [teams](/crowdyjs/teams), [game models](/crowdyjs/game-model), and Replication API server assignment.
- **Agentic Crowdy Studio (v12 development pilot)** — typed, durable
  Ask/Build/Play sessions through `client.crowdyStudioAgent`, with exact tools,
  project checkpoints, approvals, scoped Play leases, and immediate human
  takeover. It is disabled by default and is not a production-rollout claim;
  see [Agentic Crowdy Studio](/crowdyjs/agentic-crowdy-studio).

Sign-in is **passwordless** (`client.auth`: magic link, social/OIDC, or the dev bypass — no `login`/`register`) and returns an **identity session token** (Management API only — account, studio admin, and minting app tokens); gameplay uses a short-lived **app-scoped token** confined to one app. `client.portal` mints app tokens (with a consent gate for untrusted apps), and the **two-client pattern** keeps an identity client (session token) separate from a per-game client (app token). See **[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)** and the **[SDK guide](/crowdyjs/readme)** for install, configuration, and examples.
