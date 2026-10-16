---
sidebar_position: 2
title: The kit protocol
---

# The kit protocol

What a kit hub sends the kit's clients and what it expects of them, on top of ck-exec's
[client protocol](/exec/connect-from-a-game). `ckx_sdk::kit` implements the server side; each
SDK's kit implements the client side. You need this page only to write a client of your own, or a
hub the kit's mirrors can follow.

## Kit messages

A kit hub's topics carry **kit messages**: MessagePack maps with the hub's data and four reserved
fields beside it.

| Field | What it is |
|---|---|
| `v` | The protocol version, 1. |
| `epoch` | The publishing instance's epoch. It changes whenever the instance is placed again: a move to another host, a restart, a crash. |
| `seq` | One more than the topic's last message, per topic. `(epoch, seq)` places a message in its stream. |
| `kind` | `snapshot`, `delta`, `changed` or `event`. |

```json
{ "v": 1, "epoch": 7, "seq": 3, "kind": "snapshot", "phase": "playing", "turn": 1 }
```

- **`snapshot`**: the topic's whole public state; it replaces what the client holds.
- **`delta`**: one change to a collection: `id`, then `type_name` and `props` (all of the member's
  public properties), or `removed: true`. Deltas apply in `seq` order.
- **`changed`**: something private changed for the players in `who` (player ids); `what` names it.
  Those players read it back with a call the hub answers for its caller alone. Topics have no
  access control, so a kit hub never publishes anything private.
- **`event`**: something that happened, with nothing to keep.

Every kit hub answers **`snapshot { topic }`** with a `snapshot` message whose `seq` is the topic's
last. A client mirrors a topic by subscribing, then calling `snapshot`, then applying what arrives
with a higher `seq`. It calls `snapshot` again when a message carries another `epoch`, when a
collection's `seq` skips one, and after its connection reconnects.

## Changes are safe to send again

A call that changes something may carry an **`action_id`** beside its arguments (at most 64
bytes). The hub keeps the answer for a while, and a call with the same id from the same caller gets
the same answer without running again. A client generates one id per attempt and keeps it for
every resend of that attempt, so a lost reply never charges, moves or harvests twice.

```json
{ "node": 3, "action_id": "6f1c0d2e9b3a4f5c" }
```

## Refusals carry a code

A hub's refusal is an `AppError` whose message is **`kit:<code>: <text>`**: branch on the code,
show the text. The shared codes:

| Code | When |
|---|---|
| `bad_request` | The arguments do not decode, or make no sense. |
| `not_found` | No such thing (a node, a mob, a match to accept). |
| `forbidden` | The caller may not do this (a player calling a developer's endpoint, someone else's pet). |
| `conflict` | The state does not allow it now. |
| `full` | No room. |
| `limit` | A bound the hub keeps (how many, how large); also the kit's own refusal of a 257th subscription. |
| `cooldown` | Too soon after the last time. |
| `not_your_turn`, `not_member`, `started`, `finished`, `not_ready`, `reserved` | Turn and lobby rules. |
| `empty`, `out_of_reach`, `expired`, `insufficient` | Resources, reach, time, cost. |
| `already_done` | The action already ran; its answer was too large to keep. |
| `unavailable` | Another hub this call needs did not answer, so it did not finish. The hub keeps no answer for it: send it again with the same `action_id`, as the kit's clients do, and it finishes what it began (ckx-sdk 0.12.0). |

A hub may add its own codes (lowercase letters, digits and `_`): the session starter refuses an
illegal move with `invalid_move`, the area starter a player who is not in it with `not_in_area`.

## Shard keys

A hub keyed by a place (an area of mobs) is keyed by the centre chunk of a square of `size` by
`size` chunks: `"<x>,<z>"`. The centre of the square holding chunk `(x, z)` is
`(floor(x / size) * size + size / 2, floor(z / size) * size + size / 2)`, with integer division,
so a client finds the hub for where a player stands without asking. Every SDK computes it the same
way (`shardKey`, `shard_key`).

## Realtime events and actors

Hubs show things to the players near a place through the realtime tier, not their topics.

- **Server events** have a type from the registry below and a JSON body with camelCase keys. Your
  own events start at 1000.
- **Server-driven actors** (mobs, NPCs, pets, a ball) carry a MessagePack map as their state:
  `kind`, `id`, `x`, `y`, `z` (in chunks), and optionally `hp`, `max_hp`, `mode`, `owner`, `yaw`,
  `name`. A player's own actor state is anything else, so the SDKs tell the two apart.

| Type | Event |
|---|---|
| 77 | A mob or a trap hit a player |
| 90 | The weather or the time of day turned |
| 91 | A turn passed to the next player |
| 92 | Scores or a result |
| 93 | A match was proposed to the players in it |
| 94 | An ability was cast, or landed |
| 95 | A movement a hub's warden flagged |
| 96 | A control point changed hands |
| 97 | A racer started, passed a checkpoint, finished a lap or the race |
| 98 | A play zone moved or shrank |
| 99 | A wave began or ended, or a boss changed phase |
| 100 | The contested object changed hands, or a goal was scored |
| 101 | An emote: a client event players send each other, `{ emote, targetUuid }` |

## How it is held together

ck-exec writes a golden record of the protocol from the starter hubs themselves: every message
kind, every refusal code, the shard keys, every realtime event, and each starter's calls with the
hub's real replies and topic messages. Each SDK's tests replay that record through a gateway that
answers only the next recorded call, from the recorded player, with the recorded arguments. A
change to a starter changes the record, and every SDK's tests say what has to follow.
