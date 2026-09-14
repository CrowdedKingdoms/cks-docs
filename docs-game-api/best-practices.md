---
sidebar_position: 2
title: Best practices
---

# Game API best practices

How to use the Game API so the server owns gameplay truth. This page is the
contract between a game client (Unreal, CrowdyJS, CrowdyCPP, or a custom
engine), **Game Models**, and **Compute**.

For the five-tier decision table (platform primitives, models, automations,
compute, client presentation) see
**[Choosing Game APIs](/game-api/model-vs-compute)**.

## Game Models are authoritative

Put durable gameplay state on **[Game Models](/game-api/game-models)** —
containers, properties, and functions. The server evaluates the logic and
records every change. Clients render and interpolate; they do not keep a
second source of truth for competitive or persistent results.

Seed types and functions with `gameModelSeed` before players connect. A
recreated app does not carry the model with it — re-seed, and
`gameModelLint` before you ship.

## Effects: direct, validated state changes

Game Model **functions** are the effects you invoke for a single, known
target. Unreal and other clients can call them directly with
`gameModelInvoke`.

Use an effect when the caller already knows what to change:

- Deal damage or heal
- Capture a camp
- Change ownership
- Update a player's team assignment

Write the owned property **and** any immediate dependent state in the
**same function**, so they commit in one transaction. Example: a damage
effect updates `health`, then sets `is_dead` from the new value. Later
mutations in the same invoke see earlier writes.

Gate who may call the effect with an **invoke policy**
(`owner_of_self`, `is_current_turn`, `is_host`, …). The policy applies to
everyone, including studio admins testing the game.

Prefer one intent-level function (`deal_damage`, `capture_camp`,
`assign_team`) over a client composing several property writes.

## Clients request; they do not decide

Unreal (or any client) is responsible for **requesting** a change and
**presenting** the confirmed result. It should not independently decide
the authoritative outcome — not from local prediction alone, not from an
elected [host](/game-api/host-discovery), and not from a peer-supplied
value.

Prediction and animation are fine. Reconcile them to the Model or Compute
result. If `gameModelInvoke` is denied, leave the world as the server left
it.

Host discovery (`gameHost` / `amIGameHost`) is informational. For
host-only *rules*, put `is_host` on the effect's invoke policy.

## Compute: workflow beyond one change

Use **[Compute](/game-api/compute-modules)** when the request needs
server-side work that is not one direct state change:

- Find or create a team
- Search across containers
- Process many objects
- Coordinate a match reset
- Run dynamic fan-out

Ticks simulate; invokes referee a caller's intent. Compute state is a
rebuildable cache. Durable truth stays in the Model.

**Compute should invoke Game Model effects** (`model_invoke` /
`model_invoke_with_world` on the [host API](/game-api/compute-host-api))
rather than reimplementing validation and mutation as sequential property
writes. When a referee action spans the voxel world and the Model ledger,
use `model_invoke_with_world` so both commit in one transaction.

## One sentence

The client requests a direct change when it knows the target. Game Model
effects validate and commit that change. Compute handles the wider
workflow when the target or process must be discovered or coordinated.

## Calling the Game API

- Send an **app-scoped token**, not the identity session token.
  [Authentication](/game-api/authentication).
- After minting, call `gameClientBootstrap` and use the returned
  `gameApiUrl` / `gameApiWsUrl`. [Datacenter routing](/game-api/datacenter-routing).
- Native UDP: `serverWithLeastClients`, wait ~1.5 s, then send.
  [Replication server assignment](/game-api/graphql-server-registration).
- Browsers: [GraphQL UDP proxy](/game-api/graphql-udp-proxy-api).
- Spatial permission keys live on access tiers and grids.
  [Permissions](/game-api/permissions).
- Economy-sensitive Model or marketplace mutations should send an
  `idempotencyKey`.

## Related

- [Game Models](/game-api/game-models)
- [Compute modules](/game-api/compute-modules)
- [Compute host API](/game-api/compute-host-api)
- [Unreal SDK best practices](/unreal-sdk/guides/best-practices)
- [Overview best practices](/overview/best-practices)
