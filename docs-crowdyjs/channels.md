---
sidebar_position: 3
title: Channels
---

# Channels

The SDK exposes app-wide message channels via `client.channels` (CRUD and
membership) and `client.udp` (publishing and receiving messages). A channel
message reaches every member of the channel regardless of where they are in the
world. See the Game API [Channels](/game-api/channels) guide for the full
permission model.

## Manage channels

Channels are a **Game API** surface, so they need an **app-scoped token**: log in
on an identity client, mint a token for the app, and drive channels from a
per-game client (see [Portals & app-scoped tokens](/management-api/portals-and-app-tokens)).

```ts
import {
  BrowserLocalStorageTokenStore,
  createCrowdyClient,
} from '@crowdedkingdoms/crowdyjs';

const identity = createCrowdyClient({
  httpUrl: 'https://ck.dev.crowdedkingdoms.com/graphql',
  tokenStore: new BrowserLocalStorageTokenStore('crowdyjs:session'),
});
await identity.auth.login({ email: 'player@example.com', password }); // see /crowdyjs/readme#sign-in-with-clientauth

const appToken = await identity.portal.mintAppToken('1');
const game = createCrowdyClient({
  httpUrl: appToken.gameApiUrl ?? 'https://ck.dev.crowdedkingdoms.com/graphql',
  wsUrl: appToken.gameApiWsUrl ?? 'wss://ck.dev.crowdedkingdoms.com/graphql',
  tokenStore: new BrowserLocalStorageTokenStore('crowdyjs:app:1'),
});
game.setToken(appToken.token);

// Create an open chat channel (members can post by default).
const channel = await game.channels.create({
  appId: '1',
  name: 'Global Trade',
  membershipPolicy: 'open',
  membersCanSend: true,
});

await game.channels.join(channel.groupId);
const mine = await game.channels.mine('1');     // channels I belong to
const members = await game.channels.members(channel.groupId);
```

Other methods mirror the GraphQL surface: `list`, `get`, `roles`, `policy`,
`update`, `remove`, `requestToJoin`, `leave`, `addMember`, `removeMember`,
`setMemberRoles`, `createRole`, `updateRole`, `deleteRole`, and `setPolicy`.

## Send and receive messages

Subscribe with a `channelMessage` handler — passing the `appId` as the second
argument, since every realtime subscription is app-scoped — then publish with
`client.udp.sendChannelMessage`. The first subscriber opens the shared realtime
WebSocket; publishing opens the UDP proxy session automatically.

```ts
const unsubscribe = game.udp.subscribe(
  {
    channelMessage: (msg) => {
      // msg.channelId, msg.uuid (sender), msg.payload (base64), msg.sequenceNumber
      const text = Buffer.from(msg.payload, 'base64').toString();
      console.log(`[${msg.channelId}] ${text}`);
    },
    genericError: (err) => console.warn('channel error', err.errorCode),
  },
  '1', // the app whose realtime session this subscription opens
);

await game.udp.sendChannelMessage({
  channelId: channel.groupId,
  uuid: myActorUuid,                 // 32-byte UTF-8 actor id
  payload: Buffer.from('hello').toString('base64'),
  sequenceNumber: 1,
});

// later
unsubscribe();
```

Notes:

- The sender must hold the channel `send_messages` permission; otherwise the
  publish is rejected (delivered as a `genericError` with `UNAUTHORIZED`).
- The sender receives **no echo** of its own message.
- Payloads are opaque (base64) and messages are ephemeral — keep your own
  scrollback client-side if needed.
