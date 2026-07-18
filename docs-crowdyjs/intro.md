---
slug: intro
sidebar_position: 1
title: Introduction
---

# CrowdyJS SDK

Browser-first TypeScript SDK: **`@crowdedkingdoms/crowdyjs`**.

- **Management API** — authentication, profiles, app routing reads (`client.apps`), and public platform config (`client.platform`).
- **Game API** — world synchronization, teleport, the GraphQL UDP proxy (browsers), [channels](/crowdyjs/channels) & [teams](/crowdyjs/teams), [game models](/crowdyjs/game-model), and Replication API server assignment.

Sign-in is **passwordless** (`client.auth`: magic link, social/OIDC, or the dev bypass — no `login`/`register`) and returns an **identity session token** (Management API only — account, studio admin, and minting app tokens); gameplay uses a short-lived **app-scoped token** confined to one app. `client.portal` mints app tokens (with a consent gate for untrusted apps), and the **two-client pattern** keeps an identity client (session token) separate from a per-game client (app token). See **[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)** and the **[SDK guide](/crowdyjs/readme)** for install, configuration, and examples.
