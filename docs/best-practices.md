---
sidebar_position: 4
title: Best practices
---

# API best practices

These rules apply across the Management API, Game API, Replication API, and
the SDKs. Per-surface detail lives with each API.

## Authority: hubs, endpoints, and spokes

- Authoritative gameplay logic and its state live in your app's
  **[ck-exec](/exec/intro) hubs**.
- A hub's **endpoints** are the direct, validated state changes a client asks
  for by name. Typical cases: dealing damage, healing, capturing a camp,
  changing ownership, or updating a player's team assignment.
- A hub runs one handler at a time, so an endpoint that updates `health` and
  then determines `is_dead` changes both before any other call reaches it.
- The client **requests** a change and **presents** the confirmed result. It
  must not independently decide the authoritative outcome.
- Check the caller in the handler. The platform sets it, so a handler can
  trust `call.player()` for authorization.
- Use keyed hubs and **spokes** when a request needs server-side workflow
  beyond one direct state change: finding or creating a team, searching,
  processing many objects, coordinating a match reset, or running dynamic
  fan-out work. A spoke changes state only by calling the hub that owns it.
- Clients learn of changes from a hub's topics. A push published while a
  client was disconnected is not replayed, so read the state again on
  reconnect.

In short: the client requests a direct change when it knows the target; a hub
validates and applies that change; spokes and calls between hubs handle the
wider workflow when the target or process must be discovered or coordinated.

See **[Game API best practices](/game-api/best-practices)** and
**[from the legacy engines](/exec/from-the-legacy-engines)**.

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
| Game API, hubs and spokes | [Game API best practices](/game-api/best-practices) |
| Management API, sign-in, entitlements | [Management API best practices](/management-api/best-practices) |
| Native UDP / Buddy | [Replication API best practices](/replication-api/best-practices) |
| Unreal | [Unreal SDK best practices](/unreal-sdk/guides/best-practices) |
| CrowdyJS | [CrowdyJS best practices](/crowdyjs/best-practices) |
