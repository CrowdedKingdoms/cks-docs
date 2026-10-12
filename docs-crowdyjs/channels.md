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
  httpUrl: 'https://ck.prod.crowdedkingdoms.com/graphql',
  tokenStore: new BrowserLocalStorageTokenStore('crowdyjs:session'),
});
await identity.auth.login({ email: 'player@example.com', password }); // see /crowdyjs/readme#sign-in-with-clientauth

const appToken = await identity.portal.mintAppToken('1');
const game = createCrowdyClient({
  httpUrl: appToken.gameApiUrl ?? 'https://ck.prod.crowdedkingdoms.com/graphql',
  wsUrl: appToken.gameApiWsUrl ?? 'wss://ck.prod.crowdedkingdoms.com/graphql',
  tokenStore: new BrowserLocalStorageTokenStore('crowdyjs:app:1'),
});
game.setToken(appToken.token);

// Create an open chat channel (members can post by default).
const channel = await game.channels.create({
  appId: '1',
  name: 'Global Trade',
  membershipPolicy: 'open',
  membersCanSend: true,
  membersCanSpeak: false,   // true: every member may also send channel audio
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

## Voice on a channel

CrowdyJS 18.7.0 sends and receives channel audio (replication v0.37.0): a party or guild
can talk wherever its members are. The sender needs the channel's `send_voice` right
(`membersCanSpeak: true` on `channels.create` gives it to every member) and `use_voice_chat`;
a refusal arrives as a `genericError` with `UNAUTHORIZED`.

```ts
game.udp.subscribe(
  {
    channelAudio: (a) => jitter.push(`${a.channelId}:${a.uuid}`, fromBase64(a.audioData)),
  },
  '1',
);

const packetizer = new VoicePacketizer({ codec: VoiceCodec.OPUS, frameMs: 20 });
await game.udp.sendChannelAudio({
  channelId: channel.groupId,
  uuid: myActorUuid,
  payload: toBase64(packetizer.packetize(opusFrame)),
});
```

- `sendChannelAudio` sends opcode 35 on the binary relay when `realtime.binaryTransport`
  is on, and falls back to the GraphQL mutation; members receive it through the same
  `channelAudio` handler either way. Prefer the relay for sustained voice.
- The payload is opaque, at most 1,024 bytes; the [voice helpers](voice-chat#voice-payload-helpers)
  are an optional format. The sender gets no echo.
- Every member's downlink is billed as egress, so keep voice channels small.

## Limit delivery by distance

`client.udp.sendRangedChannelMessage` (CrowdyJS 18.5.0) publishes to a channel but
delivers only to the members with a live actor within `maxDistance` chunks of an
origin chunk, by straight-line distance with the boundary included. Members receive
it through the same `channelMessage` handler, so the receiving code above does not
change.

```ts
await game.udp.sendRangedChannelMessage({
  channelId: channel.groupId,
  uuid: myActorUuid,
  payload: Buffer.from('over here').toString('base64'),
  appId: '1',                        // the app this game client's token is for
  chunk: { x: '10', y: '0', z: '-4' }, // the origin, usually your actor's chunk
  maxDistance: 5,                    // chunks, inclusive
  sequenceNumber: 2,
});
```

A member 3 chunks east and 4 north of the origin (exactly 5) receives it; one 4 east
and 4 north (about 5.66) does not. `maxDistance` is 0 (the origin chunk only) to
`CHANNEL_RANGED_MAX_DISTANCE` (2147483647); a larger one, or a payload over 1024 bytes,
is refused with a `CrowdyGraphQLError` and reaches nobody. It takes the same right as `sendChannelMessage`, the
sender receives no echo, and a member with no live actor receives nothing. On the
binary relay it is sent as the `CHANNEL_MESSAGE_RANGED_REQUEST` datagram
(`serializeRangedChannelMessage`); see the
[Game API channels guide](/game-api/channels#limit-delivery-by-distance).
