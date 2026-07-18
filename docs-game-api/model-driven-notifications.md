---
sidebar_position: 21
title: Model-driven notifications
---

# Model-driven realtime notifications

[Game model functions](game-models) mutate server state when they are invoked —
by a player (`gameModelInvoke`) or by an [automation / NPC](autonomous-processes).
**Notification effects** let a function also **push a realtime notification to
clients** as part of that same invocation, so a model change can announce itself
without the caller making a separate spatial send.

This is how a server-driven change (an NPC moving, a trap firing, a score
updating) reaches players the *same way* a player-driven change does: it arrives
on the [`udpNotifications`](graphql-udp-proxy-api) subscription that clients are
already listening to.

## Declaring notifications on a function

Notifications are declared on the function definition, so every invocation of the
function emits them. Add a `notifications` array to
[`gameModelUpsertFunction`](/game-api/reference/graphql/operations/mutations/game-model-upsert-function)
(or to a function inside `gameModelSeed`):

```graphql
mutation {
  gameModelUpsertFunction(input: {
    appId: "1"
    name: "ringBell"
    invokeScope: "player"
    invokePolicyJson: "{\"type\":\"owner_of_self\"}"
    mutations: [
      { target: "self", property: "lastRung", expression: "now()" }
    ]
    notifications: [
      {
        kind: "spatial"
        emitAs: "server_event"
        args: [
          { name: "chunk_x", expression: "self.chunk_x" }
          { name: "chunk_y", expression: "self.chunk_y" }
          { name: "chunk_z", expression: "self.chunk_z" }
          { name: "event_type", expression: "42" }
          { name: "distance", expression: "16" }
        ]
      }
    ]
  }) {
    name
    notifications { kind emitAs args { name expression } }
  }
}
```

Each entry is a `FunctionNotificationInput`:

| Field | Meaning |
| ----- | ------- |
| `kind` | Delivery mode: `spatial`, `channel`, or `actor` (see below). |
| `emitAs` | **Spatial only.** Which notification shape clients receive: `server_event` (default), `generic_spatial`, or `actor_update`. |
| `args` | A list of `{ name, expression }`. Each `expression` is a model expression (the same expression language used by a function's `mutations`/`returnExpression`) evaluated in the invocation's context — e.g. `self.chunk_x`, a literal like `42`, or a parameter. |

The arguments you must provide depend on `kind`:

| `kind` | Required `args[].name` | Optional `args[].name` | Delivered to | Arrives as |
| ------ | ---------------------- | ---------------------- | ------------ | ---------- |
| `spatial` | `chunk_x`, `chunk_y`, `chunk_z` | `event_type`, `state`, `distance`, `decay`, `source_uuid` | players near that chunk (proximity fan-out) | `ServerEventNotification` (default), or `ClientEventNotification`-shaped / `ActorUpdateNotification` per `emitAs` |
| `channel` | `channel_id`, `payload` | `sender_uuid` | members of that [channel](channels) | `ChannelMessageNotification` |
| `actor` | `target_uuid`, `chunk_x`, `chunk_y`, `chunk_z`, `payload` | — | only the addressed actor | `SingleActorMessageNotification` |

`state` and `payload` are **base64-encoded** binary, exactly like the equivalent
fields on the client-initiated spatial sends.

## Delivery semantics

- **Emitted after the change is applied.** A function's notifications fire only
  after its mutations are committed, so clients never see a notification for a
  change that was rolled back.
- **Best-effort, like all realtime traffic.** Notifications travel over the same
  realtime path as spatial sends — there is no delivery acknowledgement and no
  `sequenceNumber` correlation (these are server-originated, not a reply to a
  client send). Treat them as fire-and-forget hints to pull/refresh, the same way
  you treat a `ServerEventNotification`.
- **Scoped by `kind`.** `spatial` fans out by proximity (the `distance`/`decay`
  you supply), `channel` reaches channel members, and `actor` reaches exactly one
  actor — the same audiences as the corresponding client sends.
- **Identical for player- and automation-driven invokes.** Whether a function is
  invoked by a player via `gameModelInvoke` or headlessly by an
  [automation](autonomous-processes), its declared notifications are emitted the
  same way.

## Receiving them on the client

Clients do **not** need any new subscription. The notifications surface on the
existing `udpNotifications` stream:

- `kind: spatial` → your `ServerEventNotification` handler (or the
  `ClientEvent` / `ActorUpdate` handler when you set `emitAs`).
- `kind: channel` → your `ChannelMessageNotification` handler.
- `kind: actor` → your `SingleActorMessageNotification` handler.

See [GraphQL UDP-proxy API](graphql-udp-proxy-api) for the subscription and the
notification union, and the CrowdyJS guide
[Model-driven notifications](/crowdyjs/model-notifications) for the SDK handlers.

## Reading back a function's notifications

`gameModelFunction` / `gameModelFunctions` (and `gameModelTypeSchema`) return each
function's `notifications` so you can inspect what a function emits without
re-deriving it from your source model.

## Reference

- [`gameModelUpsertFunction`](/game-api/reference/graphql/operations/mutations/game-model-upsert-function)
  and the `FunctionNotificationInput` input type in the
  [Game API GraphQL reference](/game-api/reference/graphql/graphql-overview).
- [Game models](game-models) · [Autonomous processes (NPCs)](autonomous-processes) ·
  [GraphQL UDP-proxy API](graphql-udp-proxy-api)
