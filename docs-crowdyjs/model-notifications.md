---
sidebar_position: 16
title: Model-driven notifications
---

# Model-driven notifications

A [game model function](game-model) can push a **realtime notification** to
clients as part of its invocation — so a server-driven change (an NPC acting, a
trap firing, a score updating) reaches players the same way a player-driven
change does, with no extra client send. The notification arrives on the
[`client.udp.subscribe`](./overview.md#realtime-notifications) stream players are
already listening to.

For the full contract (the three delivery kinds, required arguments, and delivery
semantics) see **[Game API → Model-driven notifications](/game-api/model-driven-notifications)**.

## Declaring notifications (studio-admin)

Add a `notifications` array when you author the function with
`client.gameModel.upsertFunction`. Each entry has a `kind`
(`spatial` | `channel` | `actor`), an optional `emitAs` (spatial only), and an
`args` list of `{ name, expression }` where `expression` is a model expression
evaluated in the invocation's context:

```ts
await client.gameModel.upsertFunction({
  appId: '1',
  name: 'ringBell',
  invokeScope: 'player',
  invokePolicyJson: JSON.stringify({ type: 'owner_of_self' }),
  mutations: [{ target: 'self', property: 'lastRung', expression: 'now()' }],
  notifications: [
    {
      kind: 'spatial',
      emitAs: 'server_event',
      args: [
        { name: 'chunk_x', expression: 'self.chunk_x' },
        { name: 'chunk_y', expression: 'self.chunk_y' },
        { name: 'chunk_z', expression: 'self.chunk_z' },
        { name: 'event_type', expression: '42' },
        { name: 'distance', expression: '16' },
      ],
    },
  ],
});
```

`client.gameModel.getFunction({ appId, name })` returns the stored
`notifications` so you can read them back.

## Receiving them (game client)

No new subscription is required — the notifications surface on the existing
`udpNotifications` handlers. Like any realtime subscription, this runs on the
app's **app-scoped token** (an identity session token is rejected with
`APP_TOKEN_REQUIRED`), so open it from a per-game client that holds the token —
see [Portals & app-scoped tokens](/management-api/portals-and-app-tokens):

```ts
client.udp.subscribe(
  {
    // kind: 'spatial' (emitAs: 'server_event') →
    serverEvent: (e) => console.log('model event', e.eventType, e.state),
    // kind: 'channel' →
    channelMessage: (e) => console.log('channel', e.channelId, e.payload),
    // kind: 'actor' →
    singleActorMessage: (e) => console.log('to me', e.uuid, e.payload),
  },
  '1', // appId (required)
);
```

`state` / `payload` are base64, exactly like the client-initiated spatial sends.
These notifications are server-originated and **best-effort** — there is no
`sequenceNumber` correlation or delivery ACK (treat them like any
`ServerEventNotification`: a hint to react/refresh).

## Player- and NPC-driven changes notify identically

Because notifications live on the function, they fire whether the function is
invoked by a player (`client.gameModel.invoke`) or headlessly by an
[automation / NPC](automations). That is the recommended way to make NPC and
other server-driven model changes visible to players in real time.
