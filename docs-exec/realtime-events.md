---
sidebar_position: 5
title: Realtime events
---

# Realtime events

:::caution Dev-tier preview
Available on the **dev** environment only; see the [overview](intro).
:::

A hub or spoke can show something to the players **around a place in the world**, or to the
members of a **channel**, at once. Players' clients receive these events from the replication
servers they're already connected to, as the same messages other players' actions produce. So a
server-driven actor (an NPC, a mob) moves like a player's, and a server event arrives through the
same parser as any other.

Use realtime events for what everyone nearby sees. Use [topics](timers-and-presence) for game
state a client subscribes to through the gateway. Any hub or spoke can send them; no
[scope](world-and-platform-data#scopes) is needed.

## From Rust

```rust
use ckx_sdk::prelude::*;

fn boss_roars(ctx: &Ctx, at: ChunkPos, pose: &[u8], raid_channel: u64) -> Result<()> {
    let boss = actor_id("boss-7");
    // Its pose, rendered like a remote player, to players within 2 chunks.
    ctx.emit_actor(&boss, at, 2, pose)?;
    // A server event (type 94), decoded as `[u16 LE event type][state]`.
    ctx.emit_spatial(at, 4, &boss, Spatial::Event { event_type: 94, state: br#"{"ability":"roar"}"# })?;
    // And a line in the raid's channel, from the boss.
    ctx.emit_channel(raid_channel, &boss, b"The ground shakes.")?;
    Ok(())
}
```

| Call | Players who receive it | Arrives as |
|---|---|---|
| `ctx.emit_actor(actor, at, distance, state)` | Within `distance` chunks of `at` | `ACTOR_UPDATE_NOTIFICATION` (130) from `actor` |
| `ctx.emit_spatial(at, distance, actor, Spatial::Event { event_type, state })` | The same | `SERVER_EVENT_NOTIFICATION` (139), payload `[u16 LE event_type][state]` |
| `Spatial::Voxel { x, y, z, voxel_type, state }` | The same | `VOXEL_UPDATE_NOTIFICATION` (133). This is an effect only; the durable write is `ctx.world().set_voxels`, which already shows the change. |
| `Spatial::Generic { payload }` | The same | `GENERIC_SPATIAL_1` (140) |
| `Spatial::ActorMessage { payload }` | Only the actor named as `actor` | `SINGLE_ACTOR_MESSAGE` (142) |
| `ctx.emit_channel(channel, sender, payload)` | The channel's members | `CHANNEL_MESSAGE_NOTIFICATION` (18) from `sender` |

The message layouts are in the replication API's [wire formats](/replication-api/wire-formats).
Server events use the reserved event types that CrowdyJS and CrowdyCPP already parse; see the
[compute engines](/game-api/compute-engines#wire-format-what-clients-decode) table.

`actor_id("…")` makes a 32-byte actor id from a string. A player's actor is their 32-character
UUID; a server-driven actor can use any 32 bytes, as long as it's stable.

## Who receives what

- **Only players in your app.** An event carries its app, set by the host from the instance
  that sent it, and players connected to other apps never see it.
- **Spatial events go by proximity.** Players within `distance` chunks of `at` receive the event
  (at most 8). There is no decay.
- **Channel messages go to the channel's members**, wherever they are. Membership is managed as
  for any [channel](/game-api/channels).

## Limits

| Limit | Value |
|---|---|
| Payload | 1,024 bytes |
| Distance | 8 chunks |
| Rate | 1,000 events and 512 KiB a second, per app on each execution host, with bursts up to twice that |

`emit_*` returns an error for a payload or distance over the limit. Events over the rate are
dropped and counted, not queued.

Delivery is **best effort**, like all realtime traffic. A successful call means the host
accepted the event, not that every client received it. The host batches events for up to 10 ms.

## Usage

Each app's events are metered per minute with its execution time: the events sent, their
bytes, and the events dropped over the rate.

## Coming from the legacy APIs

| Legacy | ck-exec |
|---|---|
| Compute `emit_spatial(kind: "actor", …)` | `ctx.emit_actor` |
| `emit_spatial(kind: "server_event", …)` | `ctx.emit_spatial(…, Spatial::Event { … })` |
| `emit_spatial(kind: "text", …)` | `Spatial::ActorMessage` |
| `emit_spatial(kind: "client_event", …)` | Not offered: a client event comes from a client. Send a server event instead. |
| `emit_channel(channel_id, payload)` | `ctx.emit_channel(channel, sender, payload)`, with a sender you choose |
| Game-model `notifications` effects | The handler calls `emit_*` where the effect was declared |
| The per-module `maxEgressMsgsPerMin` budget | The per-app rate above |

Next: [operations](operations).
