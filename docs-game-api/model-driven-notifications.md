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
| `channel` | `payload`, and **exactly one of** `channel_id` or `channel_name` | `sender_uuid` | members of that [channel](channels) | `ChannelMessageNotification` |
| `actor` | `target_uuid`, `chunk_x`, `chunk_y`, `chunk_z`, `payload` | — | only the addressed actor | `SingleActorMessageNotification` |

`state` and `payload` are **base64-encoded** binary, exactly like the equivalent
fields on the client-initiated spatial sends.

### Naming a channel: prefer `channel_name`

A channel id is resolved once, when you author the function. A channel **name** is
resolved on every invocation, against the app the function is running in. That
difference is the whole reason `channel_name` exists.

Membership is scoped to the app: the server looks for members of *this channel* **in
this app**. So a function that names a channel belonging to a different app produces
a notification that is built, signed, delivered to every server, and then dropped
because nobody there is a member. Your invoke still succeeds and the run is still
recorded successful, because emission is deliberately best-effort and never fails
your function. The only symptom is silence.

That is not a hypothetical. It is what happens when an app is **recreated or moved
between organizations** and its model is copied across: the copy keeps the id, the id
still resolves, and it now points at somebody else's channel. Your client is
unaffected, because it joins `__crowdy_session_<appId>` by *name* and so follows the
app it is connected to — which is exactly the behaviour `channel_name` gives the
server side.

```graphql
args: [
  { name: "channel_name", expression: "$session_channel_name" }
  { name: "payload", expression: "concat(\"cmc:\", $self_container_id)" }
]
```

`$session_channel_name` is the app's default session channel, the one every client
joins on connect. For any other channel, name it directly — a literal name, or
`concat("lobby-", $app_id)`. Nothing in that expression can go stale when the app
moves.

If you do use `channel_id`, [`gameModelLint`](game-models#linting-your-model) checks
it: a literal naming another app's channel is
`notification_channel_foreign` (**error**), and one naming a channel that does not
exist is `notification_channel_unknown` (warning). A computed id — a property or a
param — cannot be checked, which is the other reason to prefer a name.

Whether anything is actually being dropped is visible on
`gameModelAppDiagnostics`: `notificationsEmitted24h` against
`notificationsUndeliverable24h`. A non-zero undeliverable count beside a healthy run
history is this bug. The offending function is named by a
`NOTIFICATION_UNDELIVERABLE` entry in `userCodeFaults`.

### Naming the container that changed

Arg expressions see the [system params](game-models#permission-effects-functions-that-write-grid-permissions)
injected into every evaluation — including **`$self_container_id`**, the
UUID of the container the function ran against. A "container X changed,
re-pull it" ping therefore needs **no parameters at all**:

```graphql
notifications: [
  {
    kind: "channel"
    args: [
      { name: "channel_name", expression: "$session_channel_name" }
      { name: "payload", expression: "concat(\"cmc:\", $self_container_id)" }
    ]
  }
]
```

This works identically for player invokes and [automation](autonomous-processes)
runs: an interval automation with `targetMode: "type"` fanning out over N
containers emits N notifications, each naming its own container — no caller
exists to fill a `notify_id`-style parameter, and none is needed. Injected
params cannot be spoofed by a same-named caller param.

## Signals

A function does **not** need any mutations. Leave `mutations` empty and the
function becomes a pure **signal**: invoking it pushes an event to clients and
changes no state. This is what you want when a client should just *react* — play
an effect, start a sequence, run a function in Unreal — and there is no property
worth replicating to stand in for the message.

```graphql
mutation {
  gameModelUpsertFunction(input: {
    appId: "1"
    name: "announceBossWave"
    containerTypeName: "BP_Boss"
    invokeScope: "server"
    autonomousInvocable: true
    parameters: [{ name: "wave", valueType: "int" }]
    mutations: []
    notifications: [
      {
        kind: "spatial"
        emitAs: "server_event"
        args: [
          { name: "chunk_x", expression: "self.chunk_x" }
          { name: "chunk_y", expression: "self.chunk_y" }
          { name: "chunk_z", expression: "self.chunk_z" }
          # Your own event id. Clients switch on this to pick a handler.
          { name: "event_type", expression: "4201" }
          { name: "distance", expression: "64" }
        ]
      }
    ]
  }) { name }
}
```

`event_type` is a 16-bit number you allocate — it is the name of the signal on
the wire, and how a client decides which handler to run. Add a `state` arg when
the signal carries data (base64 bytes); omit it for a bare ping.

Because `autonomousInvocable: true` is set, an
[automation](autonomous-processes) or a
[timer](autonomous-processes#timers) can fire this signal without a player having
invoked it — a scheduled automation on `BP_Boss` that announces each wave, for
instance. Not the same as firing into an empty app: scheduled work still needs
somebody present, see
[Presence](autonomous-processes#presence). On the client the signal arrives on the `ServerEventNotification`
handler you already have: `handlers.serverEvent` in CrowdyCPP, or
`serverEvent` / the `EventRouter` in CrowdyJS.

Prefer `kind: "channel"` over `spatial` when the audience is a group rather than
a place — a channel broadcast needs no chunk coordinates, which is easier when
the container has no meaningful position.

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
