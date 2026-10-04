---
sidebar_position: 2
title: Best practices
---

# Game API best practices

How to use the Game API so the server owns gameplay truth. This page is the
contract between a game client (Unreal, CrowdyJS, CrowdyCPP, or a custom
engine) and the server code that decides outcomes, which runs on
**[ck-exec](/exec/intro)**.

## Hubs are authoritative

Put authoritative gameplay logic and the state it decides in ck-exec
**hubs**. A hub keeps its state in memory, runs one handler at a time, and is
snapshotted on an interval you choose (5 to 60 seconds), when it stops, and
whenever it asks (`ctx.persist_now()`, for a purchase or a checkpoint that
should not wait). Clients render and interpolate; they do not keep a second
source of truth for competitive or persistent results.

A type's `seed_b64` in the [manifest](/exec/intro#the-manifest) is the state
every new instance spawns with, and the root hub's seed is the app's starting
state.

## Endpoints: direct, validated state changes

A hub's endpoints are the changes a client asks for by name. Clients call them
through the SDKs' `exec` connection; see
[connect from a game](/exec/connect-from-a-game).

Use an endpoint when the caller already knows what to change:

- Deal damage or heal
- Capture a camp
- Change ownership
- Update a player's team assignment

Prefer one intent-level endpoint (`deal_damage`, `capture_camp`,
`assign_team`) over a client composing several writes. A hub runs one handler
at a time, so an endpoint that updates `health` and then sets `is_dead` from
the new value changes both before any other call reaches the hub.

Check who may call it in the handler. The platform sets the caller, so a
handler can trust `call.player()` for authorization, and `call.developer()`
guards an endpoint meant for your own tools. Only types marked `client` in the
manifest take calls from players at all. Platform rules such as tier
features and grid permissions are read in the handler too; see
[world and platform data](/exec/world-and-platform-data).

**Publish what changed.** A hub publishes on its topics (`ctx.publish`) and
clients subscribe to them. Topics are not a log: a push published while a
client was disconnected is not replayed, so read the state you display again
when the connection comes back.

## Clients request; they do not decide

Unreal (or any client) is responsible for **requesting** a change and
**presenting** the confirmed result. It should not independently decide
the authoritative outcome — not from local prediction alone, not from an
elected [host](/game-api/host-discovery), and not from a peer-supplied
value.

Prediction and animation are fine. Reconcile them to the hub's reply. If a
call is refused, leave the world as the server left it.

Host discovery (`gameHost` / `amIGameHost`) is informational. Host-only
*rules* belong in a hub, which checks its caller itself; the `session`
[starter pack](/exec/builds#starter-packs) keeps a host and a turn of its
own.

## Spokes and calls between hubs: workflow beyond one change

Some requests need server-side work that is not one direct state change:

- Find or create a team
- Search across many objects
- Process many objects
- Coordinate a match reset
- Run dynamic fan-out

Put that work in keyed hubs and **spokes**. A spoke holds nothing you cannot
lose, its replicas run side by side, and it changes state only by calling the
hub that owns it. Hubs call each other with `ctx.call` and hear each other
through topics. The root hub is limited to 50 calls a second, so work that
must scale does not live there.

Timers simulate (`ctx.timer_every`); endpoints referee a caller's intent. See
[timers, subscriptions and presence](/exec/timers-and-presence).

## One sentence

The client requests a direct change when it knows the target. A hub validates
and applies that change. Spokes and calls between hubs handle the wider
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
- Economy-sensitive mutations, such as the marketplace's, should send an
  `idempotencyKey`.

## Related

- [ck-exec overview](/exec/intro)
- [Connect from a game](/exec/connect-from-a-game)
- [From the legacy engines](/exec/from-the-legacy-engines)
- [Unreal SDK best practices](/unreal-sdk/guides/best-practices)
- [Overview best practices](/overview/best-practices)
