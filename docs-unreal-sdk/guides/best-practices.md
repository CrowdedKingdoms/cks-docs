---
sidebar_position: 1
title: Best practices
---

# Unreal SDK best practices

How Unreal should share authority with the Crowded Kingdoms Game API.

## Unreal requests; the server decides

Unreal is responsible for **requesting** changes and **presenting**
confirmed results. It must not independently decide the authoritative
gameplay outcome — not from local prediction, not from a peer event, and
not from [host authority](/unreal-sdk/runtime/host-authority).

The elected host is a convenience for "which client runs shared setup
once." It is **not** an anti-cheat boundary. Do not put HP, currency,
inventory, captures, or team assignment behind a host check.

## Game Models and effects

Treat **[Game Models](/game-api/game-models)** as the authoritative
gameplay state.

When Unreal already knows the target, invoke a **Game Model function
(effect)** for the change: deal damage, heal, capture a camp, change
ownership, assign a team. The effect validates and commits, including any
immediate dependent state in the same transaction (`health`, then
`is_dead`).

When the target or process must be **discovered or coordinated** — find
or create a team, search containers, process many objects, reset a match,
fan out work — call **Compute**, and let Compute invoke those same
effects rather than duplicating their rules.

Details: [Game API best practices](/game-api/best-practices).

## Replication vs rules

CrowdyEvents, Crowdy State, and actor snapshots move **presentation**
(poses, cosmetics, one-shot FX). Use them to look responsive. Reconcile
competitive or persistent results to the Model or Compute response.

Owner/proxy simulation (`IsLocallyOwned()`) is for who **sends** an
entity's pose, not for who **decides** a rule.

## Tokens and Studio

- Sign in and sync the app in Crowdy Studio before networking.
  [Studio overview](/unreal-sdk/studio/overview).
- Gameplay uses an **app-scoped token**, not the identity session token.
  [Authentication](/unreal-sdk/runtime/authentication).
- There is no unauthenticated shortcut. Use email + password, magic link,
  or social sign-in.

## Related

- [Host authority](/unreal-sdk/runtime/host-authority)
- [Overview best practices](/overview/best-practices)
- [Replication API best practices](/replication-api/best-practices)
