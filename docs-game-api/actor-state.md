---
sidebar_position: 19
title: Actor state
---

# Actor state

An **actor** is a concrete character instance in the world — the thing that walks
around in a specific game (app), at a position (chunk). An actor optionally
references an [avatar](avatar-state) (the reusable "class"/identity), and carries
its own state.

Like avatars, actors follow the rule: **only the owner can write; everyone can
read the public parts.** All operations require a logged-in player.

> Actors vs avatars: an **avatar** is a position-less identity a player owns and
> can reuse across games; an **actor** is one in-world instance of a character in
> a single game, with a position and its own per-instance state.

## The actor record

| Field | Meaning |
| ----- | ------- |
| `uuid` | The actor's id — a 32-byte string used by the realtime protocol (not a hyphenated UUID) |
| `appId` | The game this actor lives in |
| `userId` | The owner |
| `avatarId` | Optional link to one of the owner's avatars |
| `chunk` | The chunk the actor is in (`{ x, y, z }`) |
| `publicState` | Visible to everyone (base64 binary) |
| `privateState` | Visible to the owner only (base64 binary) |

An actor record can come into existence two ways:

- **Explicitly**, by calling `createActor` (below).
- **Automatically**, when the player starts moving in the world — the realtime
  layer creates/updates the actor as actor updates arrive. See
  [GraphQL UDP Proxy API](/game-api/graphql-udp-proxy-api).

## Creating an actor

```graphql
mutation {
  createActor(input: {
    appId: "1",
    uuid: "0123456789abcdef0123456789abcdef",   # exactly 32 bytes (UTF-8)
    avatarId: "5",                                # optional
    chunk: { x: "0", y: "0", z: "0" },
    publicState: "AAEC",
    privateState: "BQYH"
  }) { uuid appId chunk { x y z } }
}
```

You can only attach an `avatarId` that you own.

## Writing state (owner only)

Use `updateActorState` for state-only changes, or `updateActor` to also move the
actor or change its avatar:

```graphql
mutation {
  updateActorState(uuid: "0123...", input: {
    publicState: "AAEC",
    privateState: "BQYH"
  }) { uuid }
}
```

`deleteActor(uuid)` removes an actor you own.

## Reading state

| Operation | Returns |
| --------- | ------- |
| `actor(uuid)` | One actor. The owner sees `privateState`; everyone else sees public state only. |
| `actors(filter)` | **Your own** actors (filter by `appId`, `avatarId`, `uuid`, or `chunk`). |
| `batchLookupActors(input: { uuids })` | Public state for the given actors — use this to read other players' actors in bulk. |

```graphql
query {
  actor(uuid: "0123...") { uuid chunk { x y z } publicState privateState }
}

query {
  batchLookupActors(input: { uuids: ["0123...", "89ab..."] }) {
    uuid publicState
  }
}
```

## Realtime movement vs persisted state

The `publicState` / `privateState` on the actor record are **persisted** state
you set with the mutations above. A player's fast-changing live transform
(position within the chunk, rotation, animation) flows over the realtime channel
via `sendActorUpdate` and is broadcast to nearby players — see
[GraphQL UDP Proxy API](/game-api/graphql-udp-proxy-api). Sending actor updates is
also what makes a player a [host](host-discovery) candidate.

Use persisted actor state for things that should survive and be queryable
(equipment, status, customization); use the realtime channel for per-frame motion.

## Grid permissions and actors

When grid permissions are active in your world, what an actor may do as it moves
is governed by [grid permissions](grids-and-permissions): a player needs `access`
to enter/act in a region, `update_voxel_data` to build there, and `use_voice_chat`
for voice. See [Permissions overview](permissions).

## Reference

See the [Game API GraphQL reference](/game-api/reference/graphql/graphql-overview)
for the exact inputs and return types.
