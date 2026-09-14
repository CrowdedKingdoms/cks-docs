---
sidebar_position: 4
title: Best practices
---

# API best practices

These rules apply across the Management API, Game API, Replication API, and
the SDKs. Per-surface detail lives with each API.

## Authority: Models, effects, and Compute

- **Game Models** are the authoritative source of gameplay state.
- Use **Game Model functions (effects)** for direct, validated state changes.
  A game client — including Unreal — can invoke these effects directly. Typical
  cases: dealing damage, healing, capturing a camp, changing ownership, or
  updating a player's team assignment.
- An effect should update the state it owns **and** any immediate dependent
  state in the **same transaction**. For example, dealing damage updates
  `health` and then determines `is_dead`.
- The client **requests** a change and **presents** the confirmed result. It
  must not independently decide the authoritative outcome.
- Use **Compute** when a request needs server-side workflow beyond one direct
  state change: finding or creating a team, searching across containers,
  processing many objects, coordinating a match reset, or running dynamic
  fan-out work.
- Compute should **invoke Game Model effects** rather than duplicate their
  validation and mutation rules.

In short: the client requests a direct change when it knows the target; Game
Model effects validate and commit that change; Compute handles the wider
workflow when the target or process must be discovered or coordinated.

See **[Game API best practices](/game-api/best-practices)** and
**[Choosing Game APIs](/game-api/model-vs-compute)**.

## Tokens and hosts

- Sign-in returns an **identity session token**. It is not valid for gameplay.
- Mint an **app-scoped token** (`mintAppToken` or the portal flow) for the Game
  API, realtime, and UDP.
- Prefer URLs the API returns (`gameApiUrl`, `gameApiWsUrl`, `discoveryUrl`)
  over a hostname you compose. An app lives in one datacenter and can move.
- Do not embed a studio-admin or org token in a game client you ship to
  players.

## Errors and retries

- Read `extensions.code` (and `blame` / `retryable` on player-facing faults).
  See [Error codes](/overview/error-codes).
- Pass an `idempotencyKey` on economy-sensitive and destructive mutations.
- Handle `WRONG_DATACENTER` by reconnecting to `extensions.gameApiUrl`.

## Per-API guides

| Surface | Page |
| --- | --- |
| Game API, models, effects, Compute | [Game API best practices](/game-api/best-practices) |
| Management API, sign-in, entitlements | [Management API best practices](/management-api/best-practices) |
| Native UDP / Buddy | [Replication API best practices](/replication-api/best-practices) |
| Unreal | [Unreal SDK best practices](/unreal-sdk/guides/best-practices) |
| CrowdyJS | [CrowdyJS best practices](/crowdyjs/best-practices) |
