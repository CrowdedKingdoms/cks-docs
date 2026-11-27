---
sidebar_position: 4
title: Wire formats
---

# Wire Formats

All datagrams start with a `uint8` message type which determines the layout for the rest of the datagram.

Byte order is always little-endian for integers.

:::note[The 64-octet token is your app-scoped token]
Throughout this reference, the "game token" (the 64-octet HMAC key and the
`gameTokenId` carried in spatial tails) is the **app-scoped token** you mint for
the app — from `mintAppToken` or `exchangePortalCode`, **not** the identity
session token that `login` returns. See **[Authenticate and assign](/replication-api/authenticate-and-assign)**
and **[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)**. An
expired token makes Buddy drop the session and emit `TOKEN_EXPIRED` (32).
:::

## UDP message type ranges

- **0–127 — non-spatial (custom):** application and control types that do not use the spatial high-bit convention. Quick test: `(messageType & 0x80) == 0`.
- **128–255 — spatial:** game spatial traffic; the high bit is always set. Quick test: `(messageType & 0x80) != 0`.

## UDP Message Types

Non-spatial (0–127, `(messageType & 0x80) == 0`):

```js
BAD_MESSAGE = 0;
// 1 — unused on the wire enum
MESSAGE_BUNDLE = 2;
GENERIC_ERROR_MESSAGE = 3;
// 10–12 — unused
CHANNEL_MESSAGE_REQUEST = 17;       // client -> server: publish to a channel
CHANNEL_MESSAGE_NOTIFICATION = 18;  // server -> client: deliver a channel message
COMMAND_RECONNECT = 22;             // server -> client: reconnect to a different server (load shedding)
CLIENT_ACTOR_HEARTBEAT = 26;        // client -> server: optional keep-alive for the client's own actor (see "Actor presence and heartbeats")
CLIENT_CAPABILITIES = 29;           // client -> server: what this client can read (see "Signed bundles"); server v0.30.0+
MESSAGE_BUNDLE_SIGNED = 30;         // server -> client: a bundle with ONE trailing HMAC, only to a client that advertised it
CHANNEL_MESSAGE_RANGED_REQUEST = 32; // client -> server: publish to a channel, delivered only near an origin chunk; server v0.35.0+
CHANNEL_AUDIO_REQUEST = 35;        // client -> server: send audio to a channel; server v0.37.0+
CHANNEL_AUDIO_NOTIFICATION = 36;   // server -> client: deliver channel audio; server v0.37.0+
COMMAND_RECONNECT_BOUND = 44;      // server -> client: COMMAND_RECONNECT bound to this assignment's nonce; server v0.45.0+
COMMAND_SESSION_RELEASED_BOUND = 45; // server -> client: COMMAND_SESSION_RELEASED bound to the nonce; server v0.45.0+
CONTROL_BOUND_ACK = 46;            // server -> client: this assignment's control frames come only in the bound forms; server v0.46.0+
CLIENT_MEDIA_SPEAKERS = 47;        // client -> server: the speakers whose spatial voice and video this client receives (see "Speaker lists"); server v0.49.0+
FLEET_CARRY = 49;                  // client -> server: a fleet session starts to carry a player (see "Fleet sessions"); server v0.50.3+
FLEET_RELEASE = 50;                // client -> server: a fleet session stops carrying a player; server v0.50.3+
FLEET_CARRY_RESULT = 51;           // server -> client: the answer to FLEET_CARRY; server v0.50.3+
FLEET_RELEASED = 52;               // server -> client: the server ended a carry; server v0.50.3+
FLEET_DELIVERY = 53;               // server -> client: one notification and the carried players who may receive it; server v0.50.3+
// other values in 19–127 are unused / reserved or internal server-to-server
```

Spatial (128–255, `(messageType & 0x80) != 0`):

```js
ACTOR_UPDATE_REQUEST = 128;
// 129 — retired ACTOR_UPDATE_RESPONSE
ACTOR_UPDATE_NOTIFICATION = 130;
VOXEL_UPDATE_REQUEST = 131;
// 132 — retired VOXEL_UPDATE_RESPONSE
VOXEL_UPDATE_NOTIFICATION = 133;
CLIENT_AUDIO_PACKET = 134;
CLIENT_AUDIO_NOTIFICATION = 135;
CLIENT_TEXT_PACKET = 136;
CLIENT_TEXT_NOTIFICATION = 137;
CLIENT_EVENT_NOTIFICATION = 138; // no "_REQUEST" version. Clients send notifications and the server replicates the message with the same type.
SERVER_EVENT_NOTIFICATION = 139; // no "_REQUEST" version. Servers send notifications only
GENERIC_SPATIAL_1 = 140;
// 141 — SHORT_SPATIAL_MESSAGE: reserved for a future compact layout; not yet implemented (no server handler)
SINGLE_ACTOR_MESSAGE = 142; // see "Single Actor Message" below; reuses the long form, distance/decay ignored
CLIENT_VIDEO_PACKET_2 = 143;       // client -> server: one webcam video FRAGMENT (see "Video payload"); needs use_video_chat
CLIENT_VIDEO_NOTIFICATION_2 = 144; // server -> client: the same bytes with 143 rewritten to 144 and the tail re-signed (as 134 -> 135)
ACTOR_LEFT_NOTIFICATION_2 = 145;   // server -> client only: an actor is no longer present (see "Actor left")
CHUNK_CHANGED_NOTIFICATION = 146;  // server -> client only: a chunk was replaced as a whole; read it again (see "Chunk changed"); server v0.45.0+
// 147–255 — reserved for future spatial types
```

Long HMAC spatial layout (below) applies to types **128–140** (`ACTOR_UPDATE_REQUEST` … `GENERIC_SPATIAL_1`), to `SINGLE_ACTOR_MESSAGE` (142), which reuses the same layout (the server ignores its `distance`/`decay rate` fields), and to **143–146** (video, actor-left and chunk-changed). In code, `isClientLongSpatialMessageType(t)` is true for `128 <= t <= 140`, for `142` and for `143`; `144`, `145` and `146` are server-only — a client that sends them is dropped like any other server-only opcode. `SHORT_SPATIAL_MESSAGE` (141) is reserved for a future compact layout and is **not yet implemented** (no server handler). The non-spatial `CLIENT_ACTOR_HEARTBEAT` (26) also **reuses this exact layout** so the same HMAC/parsing applies — but it is a local-only keep-alive (no fan-out); see "Actor presence and heartbeats" below.

UUIDs are client generated 32 byte UTF8 strings. The null termination byte (33rd slot) is not sent.

## Channel messages

Channels are app-wide message groups: a channel message is delivered to every
member of the channel regardless of location (not chunk-routed), unless it is
sent as a [distance-limited channel message](#channel_message_ranged_request-client--server).
Membership and the `send_messages` permission are managed over the Application API
GraphQL surface (see the Application API [Channels](/application-api/channels) guide). These are
**non-spatial** types, so they do not use the long spatial header.

### `CHANNEL_MESSAGE_REQUEST` (client → server)

Sent to the **client** UDP port. Channel publishes are always authenticated: the
HMAC uses the same scheme as long spatial messages (key = the 64-octet game
token; signed data = all bytes up to and including `containsAuth`, followed by
the token octets). The server requires the sender to be a channel member holding
`send_messages`, otherwise it replies with `GENERIC_ERROR_MESSAGE`
(`UNAUTHORIZED`).

| Identifier     | Bits | Bytes | Type   | Description                                                   |
| -------------- | ---- | ----- | ------ | ------------------------------------------------------------ |
| messageType    | 8    | 1     | enum   | `CHANNEL_MESSAGE_REQUEST` (17).                              |
| channelId      | 64   | 8     | int64  | The channel id to publish to.                               |
| uuid           | 256  | 32    | utf8   | The sending actor's UUID (32 bytes, no null terminator).    |
| payloadLength  | 16   | 2     | uint16 | Length of the application payload (max 1024).               |
| payload        | X    | X     | bytes  | Opaque application bytes.                                    |
| containsAuth   | 8    | 1     | bool   | Always 1.                                                   |
| hmac           | 256  | 32    | bytes  | HMAC-SHA256 over all bytes up to and including containsAuth. |
| gameTokenId    | 64   | 8     | int64  | Identifies the client session.                              |
| sequenceNumber | 8    | 1     | uint8  | Client sequence (0-255); correlates error responses.        |

### `CHANNEL_MESSAGE_RANGED_REQUEST` (client → server)

A channel publish that reaches only the members near an origin chunk (replication
server v0.35.0+). A member receives it when one of its live actors is in the origin's
app and within `maxDistance` chunks of the origin chunk, measured as the straight-line
(Euclidean) distance between chunk coordinates with the boundary included:
`dx² + dy² + dz² ≤ maxDistance²`. So `maxDistance` 0 reaches only the origin chunk, and
5 reaches a member 3 chunks east and 4 north but not one 4 east and 4 north (about
5.66), which the Chebyshev rings of spatial messages would count as 4. There is no cap
of 8. Members receive the ordinary `CHANNEL_MESSAGE_NOTIFICATION` (18), so receivers
need no change. A member with no live actor does not receive it, and the sender gets no
echo.

Sent to the **client** UDP port, authenticated exactly like `CHANNEL_MESSAGE_REQUEST`
(the HMAC covers every byte up to and including `containsAuth`, then the token octets),
and it needs the same right: channel membership with `send_messages`. It may travel
inside a client `MESSAGE_BUNDLE`.

| Identifier     | Bits | Bytes | Type   | Description                                                   |
| -------------- | ---- | ----- | ------ | ------------------------------------------------------------ |
| messageType    | 8    | 1     | enum   | `CHANNEL_MESSAGE_RANGED_REQUEST` (32).                       |
| channelId      | 64   | 8     | int64  | The channel id to publish to.                               |
| uuid           | 256  | 32    | utf8   | The sending actor's UUID (32 bytes, no null terminator).    |
| appId          | 64   | 8     | int64  | The origin chunk's app; must be your session's app.         |
| chunkX         | 64   | 8     | int64  | Origin chunk X.                                             |
| chunkY         | 64   | 8     | int64  | Origin chunk Y.                                             |
| chunkZ         | 64   | 8     | int64  | Origin chunk Z.                                             |
| maxDistance    | 32   | 4     | uint32 | Reach in chunks, inclusive: 0 to 2147483647.                |
| payloadLength  | 16   | 2     | uint16 | Length of the application payload (max 1024).               |
| payload        | X    | X     | bytes  | Opaque application bytes.                                    |
| containsAuth   | 8    | 1     | bool   | Always 1.                                                   |
| hmac           | 256  | 32    | bytes  | HMAC-SHA256 over all bytes up to and including containsAuth. |
| gameTokenId    | 64   | 8     | int64  | Identifies the client session.                              |
| sequenceNumber | 8    | 1     | uint8  | Client sequence (0-255); correlates error responses.        |

The header before the payload is 79 bytes and the tail after it 42, so a request is
121 to 1145 bytes. The server answers `GENERIC_ERROR_MESSAGE` with your sequence number
for a refusal: `UNAUTHORIZED` without the send right, `INVALID_APP_ID` when `appId` is
not your session's app, `INVALID_REQUEST` for a `maxDistance` above 2147483647. A server
older than v0.35.0 drops the request and delivers nothing.

Test vector: token `"A"` × 64, gameTokenId 555, channelId 100, uuid `"u"` × 32, appId 2,
chunk (-3, 4, 5), maxDistance 12, payload `hi`, sequenceNumber 9 encode to these 123
bytes:

```
20640000000000000075757575757575757575757575757575757575757575757575757575757575750200
000000000000fdffffffffffffff040000000000000005000000000000000c00000002006869017f1c386f
d1ec421f0a72745fae881f8adbcb17bcd8a0bb3e446565651d18533d2b0200000000000009
```

### `CHANNEL_AUDIO_REQUEST` (35) and `CHANNEL_AUDIO_NOTIFICATION` (36)

Channel voice (server v0.37.0). `CHANNEL_AUDIO_REQUEST` is exactly `CHANNEL_MESSAGE_REQUEST`
with type byte 35, signed the same way, and `CHANNEL_AUDIO_NOTIFICATION` exactly
`CHANNEL_MESSAGE_NOTIFICATION` (below) with type byte 36:

```
35: [1B type=35][8B channelId][32B uuid][2B payloadLen][payload <= 1024][1B containsAuth=1][32B HMAC][8B gameTokenId][1B seq]
36: [1B type=36][8B channelId][32B senderUuid][2B payloadLen][payload][8B epochMillis][1B seq]
```

- The payload is opaque: your audio format (the SDKs offer an optional
  [voice header](/crowdyjs/voice-chat#voice-payload-helpers)).
- The sender must be an active member whose role grants `send_voice`, and hold
  `use_voice_chat` for the channel's app; otherwise `UNAUTHORIZED`. A payload over 1,024
  bytes is dropped.
- Every other active member receives 36, wherever they are, standalone or inside a
  `MESSAGE_BUNDLE`; the sender gets no echo. There is no distance-limited form.

### `CHANNEL_MESSAGE_NOTIFICATION` (server → client)

Delivered to every active member except the sender (no echo), standalone or
inside a `MESSAGE_BUNDLE`. For a `CHANNEL_MESSAGE_RANGED_REQUEST`, only the members in
range receive it; the notification is the same.

| Identifier     | Bits | Bytes | Type   | Description                                  |
| -------------- | ---- | ----- | ------ | -------------------------------------------- |
| messageType    | 8    | 1     | enum   | `CHANNEL_MESSAGE_NOTIFICATION` (18).         |
| channelId      | 64   | 8     | int64  | The channel the message was published to.    |
| uuid           | 256  | 32    | utf8   | The sending actor's UUID.                   |
| payloadLength  | 16   | 2     | uint16 | Length of the application payload.           |
| payload        | X    | X     | bytes  | The opaque application bytes, verbatim.      |
| epochMillis    | 64   | 8     | int64  | Server-generated timestamp.                 |
| sequenceNumber | 8    | 1     | uint8  | The sender's sequence number, preserved.     |

## Server load shedding — `COMMAND_RECONNECT`

A server sends `COMMAND_RECONNECT` (22) when it is under resource pressure and
needs the client to move to a different server. It is **non-spatial** and is
always sent as its own datagram (never inside a `MESSAGE_BUNDLE`), so the first
byte is reliably `22`.

| Identifier  | Bits | Bytes | Type  | Description                                                              |
| ----------- | ---- | ----- | ----- | ------------------------------------------------------------------------ |
| messageType | 8    | 1     | enum  | `COMMAND_RECONNECT` (22).                                                |
| hmac        | 256  | 32    | bytes | HMAC-SHA256 over the type byte, keyed on the 64-octet game token string. |

The HMAC lets you authenticate the command as server-originated (only you and the
server hold the token). **Verify it before acting and ignore the datagram if it
does not match.** There is no reason field — you don't need to know why. On a
verified command, re-query `serverWithLeastClients` on the Application API (it will not
return the overloaded server) and reconnect with the same game token to the new
host and `clientPort`. The losing server keeps serving you for a short grace
period (≈5 s) and then deletes the session and ignores further packets. See
**[Operations → Load shedding](/replication-api/operations)**. Browser clients on
the GraphQL UDP proxy are migrated automatically and never see this message.

Test vector: token `abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+/` gives
`16c80d2cee8977578129f7295001cd1bea65dd11be3f518560529cb298ce5fc42b`. The HMAC covers the
type byte alone; CrowdyCPP before 0.81.0 computed it over the type byte followed by the token,
so it ignored every reconnect command.

### Bound control frames — `COMMAND_RECONNECT_BOUND` (44) and `COMMAND_SESSION_RELEASED_BOUND` (45)

`COMMAND_RECONNECT` and `COMMAND_SESSION_RELEASED` sign fixed bytes, so one captured from a
session verifies again for as long as the game token lives. From replication server v0.45.0 a
client can bind them to its current assignment: it draws 8 random bytes (a **control nonce**)
for each assignment and sends them after the flags in `CLIENT_CAPABILITIES`, with bit 1
(`BOUND_CONTROL = 2`) set (see "Signed bundles" below). The server then sends this client the
bound forms instead of 22 and 28:

```
44: [1B type=44][8B nonce][32B HMAC over the first 9 bytes]                (41 bytes)
45: [1B type=45][1B reason][8B nonce][32B HMAC over the first 10 bytes]    (42 bytes)
```

The HMAC is HMAC-SHA256 keyed on the 64-octet game token, as for 22 and 28. **Verify the HMAC,
then compare the nonce with the one this assignment sent: drop a frame with another nonce** —
it was captured from an earlier assignment and sent again. A verified 45 means what 28 with that
reason means; reason 5 (`IDLE`) is final. Like 22 and 28, both are always their own datagram.
Draw a new nonce for each assignment (and send the capabilities again), so the frames of one
session never verify in the next.

From replication server v0.46.0 the server **acknowledges** the nonce each time it accepts a
`CLIENT_CAPABILITIES` carrying `BOUND_CONTROL` and a nonce, so a client can tell it is talking to a
server that sends only the bound forms:

```
46: [1B type=46][8B nonce][32B HMAC over the first 9 bytes]                (41 bytes)
```

Verify it as you verify 44 (the HMAC, then the nonce against this assignment's). **After a verified
46 with this assignment's nonce, drop every `COMMAND_RECONNECT` (22) and `COMMAND_SESSION_RELEASED`
(28) on that assignment**: that server sends neither, so one that arrives was captured earlier and
sent again. A 46 with another assignment's nonce changes nothing. Forget the acknowledgement with
each new assignment; the next server acknowledges its own nonce.

Test vectors (token as above, nonce `0102030405060708`):

```
44:          2c010203040506070801da5c2e0f16ec592bd41e81286527373b1ecabb591bcc7f6481dfdb6ed2a5c2
45 reason 5: 2d050102030405060708fae450e083640dfdf23fd6cd963aef35d6f50be32304624468258dc7d8c18edf
46:          2e0102030405060708a2587a4b9f7b7a617387df74f45b78ace492b99e376dedff75f88956dbf62f85
```

Until an acknowledgement arrives, a client keeps accepting 22 and 28: an older server, and the Game
API's GraphQL proxy and binary relay toward a browser, still send them, and a client cannot tell an
older server from a replay. So an idle release in the legacy form still deserves the guard the SDKs
apply (one that arrives within a minute of this client's own gameplay input reconnects instead of
ending the session), and CrowdyCPP and CrowdyPy honour one legacy 22 per assignment at most, paced.

## Session released — `COMMAND_SESSION_RELEASED` (28)

A server sends `COMMAND_SESSION_RELEASED` (28) when it has ended your session and will
not answer it again. Like `COMMAND_RECONNECT` it is non-spatial and always its own
datagram, so the first byte is reliably `28`.

| Identifier  | Bits | Bytes | Type  | Description                                                                                          |
| ----------- | ---- | ----- | ----- | ---------------------------------------------------------------------------------------------------- |
| messageType | 8    | 1     | enum  | `COMMAND_SESSION_RELEASED` (28).                                                                     |
| reason      | 8    | 1     | uint8 | Why the session ended (below).                                                                       |
| hmac        | 256  | 32    | bytes | HMAC-SHA256 over the two leading bytes (type and reason), keyed on the 64-octet game token string.   |

**Verify the HMAC before acting and ignore the datagram if it does not match.** The
reason is inside the signed prefix, so it cannot be rewritten in flight.

| reason | Name            | What to do                                                                                                                                                                                                                                                                                       |
| ------ | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | `DEAUTHORIZED`  | The platform ended the session. Re-query `serverWithLeastClients` with the same token if the player is still playing; a token that was revoked is refused there.                                                                                                                                 |
| 1      | `STALE`         | The server heard nothing from you for too long. If the player is still playing, re-query `serverWithLeastClients` and reconnect.                                                                                                                                                                 |
| 2      | `TOKEN_EXPIRED` | The game token expired, and every server would refuse it. Refresh the app token, then re-query `serverWithLeastClients`.                                                                                                                                                                         |
| 3      | `OVERLOAD`      | The server is shedding load. Re-query `serverWithLeastClients` and reconnect, as for `COMMAND_RECONNECT`.                                                                                                                                                                                        |
| 4      | `REBALANCE`     | The server is evening out load across the fleet. Re-query `serverWithLeastClients` and reconnect.                                                                                                                                                                                                |
| 5      | `IDLE`          | The player sent no gameplay input for the app's idle timeout (`App.effectiveIdleTimeoutSeconds` on the Application API: 15 minutes unless the app sets its own). **Final:** do not reconnect until the player acts again. Heartbeats and keyframes that repeat an unchanged state do not count as input. |

Reason 5 arrives from replication server v0.44.0. Treat a reason you do not know like
`STALE`. Browser clients never see this message: the GraphQL UDP proxy reconnects for
them, or for reason 5 emits the connection event `IDLE_TIMEOUT` and ends the stream, and
the binary relay closes its WebSocket with code 4410.

## Speaker lists (`CLIENT_MEDIA_SPEAKERS`, 47)

From replication server v0.49.0 a client can name, per kind, the actors whose spatial voice
(`CLIENT_AUDIO_PACKET_2`) and webcam video (`CLIENT_VIDEO_PACKET_2`) it receives. Streams a list
leaves out are not sent to the client, so they are not billed. A client that sends no list, or
drops it, receives every stream of that kind in range.

The message uses the long-form spatial layout below (so the session and HMAC checks apply), with
chunk `(0,0,0)`, distance 0 and no actor UUID, like `CLIENT_CAPABILITIES`. The app payload is:

```
[u8 voiceMode][u8 voiceCount][u8 videoMode][u8 videoCount]
[voiceCount x 32B actor UUID][videoCount x 32B actor UUID]
```

| Mode | Meaning | Its count |
|---|---|---|
| `0` keep | this kind's list stays as it is | 0 |
| `1` only | receive this kind only from the actors that follow (from no one when there are none) | the names |
| `2` everyone | drop this kind's list: receive it from everyone in range again | 0 |

- **Names** are the 32-byte actor UUIDs the spatial messages carry. 32 names of one kind fill a
  datagram, so set a full voice list and a full video list in two messages (mode `0` for the other
  kind).
- **The app's numbers.** Each count may be at most the app's `maxVoiceSpeakers` or
  `maxVideoSpeakers` (1 to 32; 32 when the app sets none), which `gameClientBootstrap` returns. A
  message with a longer list, a length that does not match its counts, names on a kind that is not
  mode `1`, or an unknown mode is answered `GENERIC_ERROR` `INVALID_REQUEST` (15) and changes
  nothing. When an app lowers a number, a list already sent counts only its first names under the
  new one.
- **Lifetime.** The server keeps the lists with the session and forgets them with it, so a client
  sends them again after every assignment, reassignment and token refresh, and every ~15 s with its
  capabilities (the SDKs do). An accepted list is not answered and counts as data in.
- **Scope.** Only spatial voice and webcam video. Channel audio, text and every other message are
  unchanged; a speaker's own copy stays governed by `OWN_MEDIA_ECHO`; blocks and communication
  scopes still apply first.

## Fleet sessions (messages 49 to 53)

From replication server v0.50.3 an organization's own game server can hold one session and
*carry* its players on it: it sends and receives for each of them on that session.
[Run your own game servers with a fleet session](/management-api/fleet-sessions) explains the
lifecycle, the limits, and where each token lives. This section is the bytes.

The session's token is the **fleet token** that `openFleetSession` answers: 64 octets, with a
`gameTokenId` of its own. The Application API authorizes it on the realtime server the answer
names when the session is opened and again at each refresh. The session's first signed
datagram, its `CLIENT_CAPABILITIES` (29) under its own `gameTokenId`, binds the session to its
address, as a player's session is bound. Connect the UDP socket to that server's address, so
the operating system drops datagrams from anywhere else.

### What a fleet session sends

| Message | Game token ID in the tail | HMAC key |
| --- | --- | --- |
| For a carried player: any message that player's own session would send | The carried player's `gameTokenId` | The fleet token |
| The session's own: `CLIENT_CAPABILITIES` (29), `FLEET_CARRY` (49), `FLEET_RELEASE` (50), and `CLIENT_ACTOR_HEARTBEAT` (26) as a keep-alive that registers no actor | The fleet session's `gameTokenId` | The fleet token |

- A message for a carried player has the layout and the length it has on that player's own
  session. Only the key of the HMAC differs.
- The server applies the carried player's own permissions, blocks, age rules, speaker lists
  (`CLIENT_MEDIA_SPEAKERS`, 47, under the player's `gameTokenId`), send-rate budget (500
  messages a second with bursts to 1,000, for each carried player), idle timeout, and input log.
- A heartbeat for a carried player's actor carries that player's `gameTokenId`, like any other
  message for the player. From v0.51.0 it is judged for that player: where the player has no
  `access`, it is answered `UNAUTHORIZED` inside the session's signed bundle, and the player is
  not present there
  ([the rule](#a-keepalive-is-accepted-only-where-the-actors-update-would-be)). The session's
  own keep-alive is not held to `access`.
- A message that names a player the session does not carry, and any message other than those
  four under the session's own `gameTokenId`, is answered `GENERIC_ERROR_MESSAGE` with
  `UNAUTHORIZED` (`[3][seq][7]`). `CLIENT_CAPABILITIES` under a player's `gameTokenId` is
  answered `INVALID_REQUEST`. A heartbeat (26) that names a chunk of an app the session is not
  in is answered `INVALID_APP_ID` (18) and registers nothing.
- The sequence number is one byte for the whole session, so an error frame does not say which
  player a refusal was for.
- **How an error frame arrives.** To a fleet session that advertised `BUNDLE_SIGNED`, an error
  frame is a member of the session's `MESSAGE_BUNDLE_SIGNED`, so it is verified like every
  other member. To a fleet session that did not, it arrives alone and unsigned: treat it as a
  hint, stop sending for the player whose send it matches, then carry the player again or
  check the player's access through the Application API. A player's own session is unchanged.
- A player whose access is suspended or ended is delivered nothing, and sends for that player
  are answered `UNAUTHORIZED`. State for the session's other players still arrives plain and
  does not say which player it is not for.
  [Why a send is refused](/management-api/fleet-sessions#why-a-send-is-refused-and-what-your-server-does)
  lists every cause of `UNAUTHORIZED` and what a game server does for each.

### `FLEET_CARRY` (49) and `FLEET_RELEASE` (50) (client → server)

Both use the long-form spatial layout exactly as `CLIENT_CAPABILITIES` does: chunk `(0,0,0)`,
distance 0, no actor UUID, the fleet session's own `gameTokenId` in the tail, and the HMAC keyed
with the fleet token. The app payload starts at offset 68.

`FLEET_CARRY` payload (48 bytes; the datagram is 157 bytes):

| Identifier        | Bits | Bytes | Type  | Description                                                              |
| ----------------- | ---- | ----- | ----- | ------------------------------------------------------------------------ |
| playerGameTokenId | 64   | 8     | int64 | The `gameTokenId` of the player's app token.                             |
| epochMillis       | 64   | 8     | int64 | The sender's clock, in epoch milliseconds.                               |
| proof             | 256  | 32    | bytes | Proof that the sender holds the player's token (below).                  |

```
proof = HMAC-SHA256(key     = the player's 64-octet token,
                    message = "ck-fleet-carry" (14 ASCII bytes)
                              || 8B fleet gameTokenId
                              || 8B player gameTokenId
                              || 8B epoch millis)          integers little-endian
```

`FLEET_RELEASE` payload (8 bytes; the datagram is 117 bytes):

| Identifier        | Bits | Bytes | Type  | Description                                           |
| ----------------- | ---- | ----- | ----- | ----------------------------------------------------- |
| playerGameTokenId | 64   | 8     | int64 | The `gameTokenId` of the player to stop carrying.     |

- **When a carry is accepted.** The player's token is live in the session's app, it belongs to a
  player of the fleet token's organization, the proof holds, and `epochMillis` is within 30
  seconds of the server's clock.
- **A carry belongs to the player.** A carry of a user who is already carried, by the same
  session or another one, on any server, replaces the carry that stood. The session that
  carried the player before is sent `FLEET_RELEASED` with reason 1. When it is the same session
  (a carry with the player's refreshed token), nothing is sent and the player continues under
  the new `gameTokenId`. A player's own session under a `gameTokenId` ends when that
  `gameTokenId` is carried.
- **A carry with a refreshed token.** After `refreshAppToken`, send a 49 with the new token,
  and name the new `gameTokenId` on every message for the player from that moment. A message
  that names the new `gameTokenId` and arrives before the carry takes effect waits for it. The
  carry made with the old token stands until the new one takes effect, so there is no gap, and
  the player keeps their actors and their idle clock. After that, a message that still names
  the old `gameTokenId` is answered `UNAUTHORIZED`.
- **Status 1.** Send the carry once more about 250 ms later, with a new `epochMillis` and
  proof, before you take the token as gone.
- **Sending the same carry again.** While its carry stands, the same 49 is answered as it was.
  After that carry ended, or when it is older than the session's last accepted carry of that
  player, it is a replay and is answered status 3.
- **Rate.** A session may send 64 carries a second, with a burst of its `maxPlayers` + 32. A 49
  past that is dropped unanswered. A 49 can go unanswered for other reasons too: send it again
  with a new `epochMillis` and proof, as the SDKs do.
- **`FLEET_RELEASE` has no answer** and may be sent twice. After it, the player's actors leave
  as a session's do: `ACTOR_LEFT_NOTIFICATION_2` five seconds after their last message, unless
  they continue elsewhere. A lost 50 leaves the carry in place until the player is carried
  elsewhere or goes idle.

Test vectors: fleet token `fleet-token-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOP`
with `gameTokenId` 9001, player token
`player-token-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO` with `gameTokenId` 4242,
`appId` 7, and `epochMillis` 1795000000000.

```
proof:
5602abb9300581f6a20e247ea0b406f690646a3d27f9427e95c5f6363115b35a

FLEET_CARRY, sequenceNumber 0 (157 bytes):
3107000000000000000000000000000000000000000000000000000000000000000000010000000000000000
0000000000000000000000000000000000000000000000009210000000000000005e56eea10100005602abb9
300581f6a20e247ea0b406f690646a3d27f9427e95c5f6363115b35a9d69b5b07c19a2450e61725d9995c19c
940e41fa602fcce2535e780e5d2d81e3292300000000000000

ACTOR_UPDATE_REQUEST for the carried player, sequenceNumber 1, chunk (1,-2,3), distance 8,
uuid "0123456789abcdef0123456789abcdef", payload de ad be ef (113 bytes):
8007000000000000000100000000000000feffffffffffffff03000000000000000800013031323334353637
383961626364656630313233343536373839616263646566deadbeefafca3c1e53f866c6384fb186e2396664
b62d7acd0fee6d9445b96e283d1c09f4921000000000000001
```

The actor update's tail carries the player's `gameTokenId` (4242), and its HMAC verifies with
the fleet token and fails with the player's.

### `FLEET_CARRY_RESULT` (51), `FLEET_RELEASED` (52), and `FLEET_DELIVERY` (53) (server → client)

`FLEET_CARRY_RESULT` (18 bytes):

| Identifier        | Bits | Bytes | Type  | Description                                                    |
| ----------------- | ---- | ----- | ----- | -------------------------------------------------------------- |
| messageType       | 8    | 1     | enum  | `FLEET_CARRY_RESULT` (51).                                     |
| playerGameTokenId | 64   | 8     | int64 | The `gameTokenId` the carry named.                             |
| userId            | 64   | 8     | int64 | The player's user id when `status` is 0; otherwise 0.          |
| status            | 8    | 1     | uint8 | The result (below).                                            |

| status | Meaning |
| ------ | ------- |
| 0      | Carried. |
| 1      | No live token has that `gameTokenId`, or the token is for another app. |
| 2      | The token belongs to another organization's player. |
| 3      | The proof or its time failed, or the carry was a replay. |
| 4      | The session carries as many players as it may, or the server has no room for the carry. |

`FLEET_RELEASED` (10 bytes):

| Identifier        | Bits | Bytes | Type  | Description                                   |
| ----------------- | ---- | ----- | ----- | --------------------------------------------- |
| messageType       | 8    | 1     | enum  | `FLEET_RELEASED` (52).                        |
| playerGameTokenId | 64   | 8     | int64 | The `gameTokenId` the session carried.        |
| reason            | 8    | 1     | uint8 | Why the carry ended (below).                  |

| reason | Meaning |
| ------ | ------- |
| 1      | Another session carries the player. |
| 2      | The player's sign-in ended: it was revoked, or it expired and the player was not carried again with a live token. |
| 5      | The player sent no gameplay input for the app's idle timeout. |

Treat a reason you do not know as the carry having ended. When the fleet session itself ends,
its carries end and no `FLEET_RELEASED` is sent.

- **A 52 is sent once.** It can be lost, and it can arrive up to about 6 seconds after the
  carry ended. The sign to rely on is `UNAUTHORIZED` on the session's next message for that
  player.
- **After a crossing**, the previous session's messages for the player are answered
  `UNAUTHORIZED`. For a few milliseconds, and rarely for up to about 5 seconds, they can still
  be accepted, so a game server stops sending for a player before it hands the player off.
- **Reason 2 at a token's expiry.** A carried player whose token expires with no new carry is
  released with reason 2 at the expiry. A message that lands just before it is answered
  `TOKEN_EXPIRED` (`[3][seq][32]`).

`FLEET_DELIVERY`:

| Identifier         | Bits | Bytes | Type  | Description                                                                      |
| ------------------ | ---- | ----- | ----- | -------------------------------------------------------------------------------- |
| messageType        | 8    | 1     | enum  | `FLEET_DELIVERY` (53).                                                           |
| count              | 8    | 1     | uint8 | How many players follow, 1 to 32.                                                |
| playerGameTokenIds | X    | 8 × count | int64 | The carried players who may receive the notification.                        |
| notification       | X    | X     | bytes | One notification, as a player's own session would be sent it, unsigned (below).  |

**Two forms.** Each of the three arrives in one of two forms, and which one depends on whether
the session advertised `BUNDLE_SIGNED` in its capabilities.

To a session that did not advertise `BUNDLE_SIGNED`, each frame is followed by its own HMAC, the
last 32 bytes (in a 53, after the wrapped notification):

```
[frame][32B HMAC]      51: 50 bytes      52: 42 bytes      53: 2 + 8 × count + notification + 32
HMAC = HMAC-SHA256(key     = the fleet token's 64 octets,
                   message = every byte before the HMAC, from the type byte on,
                             followed by the fleet token's 64 octets)
```

The signed frame is alone in its datagram or a member of a `MESSAGE_BUNDLE` (2), whose length
prefix counts the frame and its HMAC.

To a session that advertised `BUNDLE_SIGNED`, the frame is a member of a
`MESSAGE_BUNDLE_SIGNED` (30) with no HMAC of its own. A `FLEET_DELIVERY` above 1,197 bytes
cannot be a member, so it is sent in the first form, alone. A session that advertised
`BUNDLE_SIGNED` therefore reads both forms.

**Replays.** In either form a 51, 52, or 53 is signed with the fleet token and carries nothing
that marks it as new, so a captured one that is sent again verifies again. Answer a
`FLEET_RELEASED` for a player who is still on the server by carrying the player again: the
server answers that carry.

**The notification inside a 53.** It is what a player's own session would have been sent,
without an HMAC:

```
long-spatial:  [1B notification type][8B appId][8B chunkX][8B chunkY][8B chunkZ][1B distance]
               [1B decay][1B containsAuth = 0][32B uuid][payload][8B epoch millis][1B seq]
channel:       [1B 18 | 36][8B channelId][32B sender uuid][2B payload length][payload]
               [8B epoch millis][1B seq]
```

A long-spatial notification keeps its 9-byte tail and has `containsAuth` 0. A channel
notification is byte for byte what any session receives. The notification's length is the
frame's length (without the frame's own HMAC in the first form) minus `2 + 8 × count`.

**The largest datagram.** A fleet session is sent datagrams of up to 1,242 bytes: a 53 with
one player, alone, with its own HMAC. Nothing else the server sends a client is above 1232. Size receive buffers
for 1,242.

### What arrives plain and what arrives inside `FLEET_DELIVERY`

| What | How a fleet session receives it |
| --- | --- |
| State: actor updates (130), actor departures (145), voxel edits (133), server events (139), and chunk changes (146) | The plain notification, once, when at least one carried player may receive it |
| State that is filtered for each receiver: a client's events (138) and app-defined spatial messages (140), to which blocks, age rules, and communication settings apply | Plain and once when no carried player in range is excluded. Inside a 53 that lists those who may receive it, and not plain as well, when some are excluded. Nothing when all are excluded |
| Communications: spatial voice (135), text (137), and video (144), `SINGLE_ACTOR_MESSAGE` (142), channel messages (18), and channel audio (36) | Always inside a 53 that lists the carried players who may receive it |

- A 53 always means "these players only". A plain 138 or 140 means "every player of yours in
  range".
- A 53 lists at most 32 players. A message for more is split over several frames.
- State that one of the session's own carried players sent is not sent back to the session,
  unless the session set `FLEET_OWN_STATE` (capability bit 3, value 8) and another of its
  carried players is in range. With the bit off a session still receives two things: a voxel
  edit it sent, and `ACTOR_LEFT_NOTIFICATION_2` for the actor of one of its own players.
- Around a crossing, the new session can receive a few state updates for the player that the
  previous session sent just before. Treat state for a player the session carries as stale.
- A carried sender's own text lists the sender. Its own voice and video list it only when the
  session set `OWN_MEDIA_ECHO`.
- A player with their own session sees carried players as any other actors, and carried
  players see that player the same way.

### How a session learns that it ended

The signed signal is `COMMAND_SESSION_RELEASED` (28), or `COMMAND_SESSION_RELEASED_BOUND` (45)
to a session that advertised `BOUND_CONTROL`. It is its own datagram, carries its own HMAC
keyed with the fleet token, and is sent once.

| reason | Meaning for a fleet session |
| ------ | --------------------------- |
| 0      | The fleet token was deauthorized: the session was closed through the Application API, its org token was revoked, or fleet sessions were switched off. |
| 1      | The server heard nothing from the session for too long. |
| 2      | The fleet token expired. |
| 3, 4   | The server is shedding load, or it is moving the session. |

The liveness signal is `CONTROL_BOUND_ACK` (46). A live session's `CLIENT_CAPABILITIES` with
`BOUND_CONTROL` is always answered with a signed 46, and an ended session's never is.

- Send `CLIENT_CAPABILITIES` every 15 seconds, and treat 45 seconds without a 46 as the session
  being gone: call `refreshFleetSession`, and when it answers `NOT_FOUND`, open a new session
  and carry the players again. The silence check also covers a lost 28 or 45 and a session
  that was never authorized on that server.
- After a `refreshFleetSession`, the server sends the session nothing until the next datagram
  it accepts from it. Send `CLIENT_CAPABILITIES` at once after every refresh.
- Until the first 46, a session can receive a plain `MESSAGE_BUNDLE` (2) whose members each
  carry their own HMAC. A frame too large for a signed bundle carries its own HMAC at any
  time.

### A session that comes back

- **The same server, from a new address.** After a `refreshFleetSession`, which authorizes the
  same token again, the carries stand. The session sends `CLIENT_CAPABILITIES` again and no
  `FLEET_CARRY`. Without a refresh, the server does not follow a change of address.
- **Another server.** A fleet session is sent `COMMAND_RECONNECT` (22, or 44 in the bound form)
  signed with the fleet token, and a refresh can name a new server. The new server holds no
  carry. After the refresh and `CLIENT_CAPABILITIES`, the session sends a new `FLEET_CARRY`
  (a new `epochMillis` and proof) for every player and is answered 51 for each. The server it
  left sends no `FLEET_RELEASED` for those players. If that server asked the session to move,
  it later sends `COMMAND_SESSION_RELEASED` (28, or 45 in the bound form) with reason 3 or 4.
- **Presence.** Voice and video do not keep a carried player present, as for any player. A
  carried player needs gameplay input within the app's idle timeout, or the carry ends with
  reason 5.

## Message Bundle per Datagram

The message bundle type simply puts multiple messages in a datagram as size allows.
Each message is another message type.
Messages are packed one after another and message lengths are used to determine the size of the actual message.
There will be at least one message in a bundle, but usually more. The parser must use the datagram length and parse through each message to determine if there is another message to parse — there is no count field.
Bundles travel in **both directions**: the server has always packed its notifications this way, and since replication server v0.27.0 a client may pack its requests the same way.

| Identifier                            | Bits | Bytes | Type   | Description                                              |
| ------------------------------------- | ---- | ----- | ------ | -------------------------------------------------------- |
| messageType                           | 8    | 1     | enum   | `MESSAGE_BUNDLE`                                         |
| messageLength                         | 16   | 2     | uint16 | The length of the next message.                          |
| message                               | X    | X     | bytes  | The full message, corresponding to another message type. |
| messageLength                         | 0/16 | 0/2   | uint16 | The length of the next message if present.               |
| message                               | 0/X  | 0/X   | bytes  | The full message, corresponding to another message type. |
| more messages as datagram size allows |

### Server → client

The server accumulates notifications for about 1 ms and sends them as one bundle
(at most 1232 bytes, at most 32 members). A lone notification is sent unwrapped.
`COMMAND_RECONNECT` (22) and `COMMAND_SESSION_RELEASED` (28) are never bundled, so
their first byte is always the opcode. Clients must parse bundles.

One datagram can be larger than 1232 bytes: a [fleet session](#fleet-sessions-messages-49-to-53)
is sent a `FLEET_DELIVERY` of up to 1,242 bytes. A player's own session is never sent one.

### Signed bundles — `MESSAGE_BUNDLE_SIGNED` (30) and `CLIENT_CAPABILITIES` (29)

Since replication server v0.30.0 a client can ask for its downlink bundles to be
signed **once** instead of once per member. It sends `CLIENT_CAPABILITIES` (29): the
long-form spatial layout below (so the usual session and HMAC checks apply), chunk
`(0,0,0)`, distance 0, no actor UUID, and a 4-byte little-endian flags word as the
app payload; bit 0 (`BUNDLE_SIGNED = 1`) means "I parse `MESSAGE_BUNDLE_SIGNED`". Bit 1
(`BOUND_CONTROL = 2`, server v0.45.0+) means "send me 44 and 45 instead of 22 and 28", and the
8-byte control nonce follows the flags (a 12-byte payload); a server reads the nonce only with
the bit set, and an older one reads only the flags. Bit 2 (`OWN_MEDIA_ECHO = 4`, server
v0.48.0+) means "send me my own spatial voice and video": from v0.48.0 a server does not send a
client the `CLIENT_AUDIO_PACKET_2` and `CLIENT_VIDEO_PACKET_2` it sent itself unless the bit is
set. Send the message again to turn the bit on or off; an older server ignores it and always
sends the copy. Bit 3 (`FLEET_OWN_STATE = 8`, server v0.50.3+) is for a
[fleet session](#fleet-sessions-messages-49-to-53): "send me the state my own carried players
sent, when another of my carried players is in range". It is off by default. The
server binds the flags to the worker that serves this client's flow and forgets them
when the session goes, so a client sends the message **after every assignment,
reassignment and token refresh, and again every ~15 s** (the SDKs do). Until it lands
the client is served in the form described above, which it must keep parsing.

A `MESSAGE_BUNDLE_SIGNED` is:

```
[1B 30] { [2B u16 LE length][member] } … [32B HMAC]
```

The members are notification bodies with `containsAuth = 0` and **no per-member
HMAC** (the same layout the long form shows for an unsigned message: the tail is
just epoch millis + sequence). The trailing 32 bytes are
`HMAC-SHA256(key = token, message = everything-before || token)` — exactly the
client-message scheme in "HMAC details", so one validator serves both directions. To
read one: verify the tail, strip 32 bytes, treat byte 0 as `MESSAGE_BUNDLE` and walk.
Seven 165-byte actor updates fit where six signed ones did; a member above 1 197
bytes (video fragments) still travels alone, signed per message; `COMMAND_RECONNECT`
and `COMMAND_SESSION_RELEASED` are never bundled either way. Even a single
notification to such a client arrives as a one-member signed bundle.

CrowdyJS 17.6.0 (`realtime` binary relay: `advertiseCapabilities`, default on) and
CrowdyCPP 0.42.1 (`Config::advertiseCapabilities`, default on) do this for you.
CrowdyCPP 0.42.0 built the capability message and its encoder discarded opcode 29,
so nothing reached the server. A server older than v0.30.0 ignores the capability
message.

### Client → server

A client may pack several requests — long-spatial messages, heartbeats, channel
messages — into one bundle. Every member is a complete message with its own
opcode, game token ID, HMAC tail and sequence number; the wrapper itself carries
no authentication and nothing to trust. The server unpacks the bundle and treats
each member exactly as if it had arrived alone: a member that fails (bad HMAC, no
session, permission denied) is dropped or answered on its own and does not affect
its siblings.

Rules:

- The datagram must fit **1232 bytes**; at most **32 members**. The largest single
  message that can travel inside a bundle is 1229 bytes — anything larger is sent
  on its own.
- **No nesting.** A member whose first byte is `2` is dropped; its siblings are
  still processed.
- A **framing fault** — a truncated length or body, a zero-length member, more than
  32 members — stops the walk. Members already processed stay processed; the rest
  of the datagram is dropped.
- **Accounting.** A bundle is one datagram: its wire bytes are metered once, and
  every accepted member counts as one message.
- A single-member bundle is legal but buys nothing: send one message unwrapped.

The SDKs do this for you. CrowdyCPP 0.37.0 (`Config::bundleSends`, on by default,
`Config::bundleWindowMs` = 1 ms, `Connection::flushSends()`) and CrowdyJS 17.1 on the
binary relay (`realtime.bundleSends`, `realtime.bundleWindowMs`,
`client.udp.flushSends()`) pack the messages sent within the window into one
datagram and send a lone message unwrapped. Against a server older than v0.27.0
turn bundling off; otherwise any two messages sent within a window are dropped
together.

## Error Codes

```js
NO_ERROR = 0;
UNKNOWN_ERROR = 1;
INVALID_TOKEN = 5;
APP_NOT_FOUND = 6;        // formerly MAP_NOT_FOUND
UNAUTHORIZED = 7;
GAME_TOKEN_WRONG_SIZE = 13;
INVALID_REQUEST = 15;
INVALID_APP_ID = 18;      // formerly INVALID_MAP_ID; also app-scope mismatch
USER_NOT_AUTHENTICATED = 20;
TOKEN_EXPIRED = 32;       // app-scoped token passed expiresAt — re-mint / refreshAppToken
APP_PAUSED = 33;          // the app's runtime gate is closed (no funds, spend cap, lapsed subscription); server v0.37.0+
```

## Error Response

All error responses use `GENERIC_ERROR_MESSAGE` (3) as the message type. The client matches errors to requests using the echoed sequence number. Per-request `_RESPONSE` types (129, 132) are retired.

| Identifier      | Bits | Bytes | Type  | Description                                                 |
| --------------- | ---- | ----- | ----- | ----------------------------------------------------------- |
| messageType     | 8    | 1     | enum  | Always `GENERIC_ERROR_MESSAGE` (3).                         |
| sequence number | 8    | 1     | uint8 | Client's sequence number from the original request. Wraps.  |
| errorCode       | 8    | 1     | enum  | See [Operations → common error codes](/replication-api/operations#common-error-codes) |

## Long Form Spatial Message

We overload many message types and use the `GENERIC_SPATIAL_1` to describe their format.

The following message types have the same structure as `GENERIC_SPATIAL_1`:

- `ACTOR_UPDATE_REQUEST`
- `ACTOR_UPDATE_NOTIFICATION`
- `VOXEL_UPDATE_REQUEST`
- `VOXEL_UPDATE_NOTIFICATION`
- `CLIENT_AUDIO_PACKET`
- `CLIENT_AUDIO_NOTIFICATION`
- `CLIENT_TEXT_PACKET`
- `CLIENT_TEXT_NOTIFICATION`
- `CLIENT_EVENT_NOTIFICATION`
- `SERVER_EVENT_NOTIFICATION`
- `GENERIC_SPATIAL_1`
- `CLIENT_ACTOR_HEARTBEAT` (non-spatial opcode 26; same layout, keep-alive only — see below)

`GENERIC_SPATIAL_1` is used in the public API and is suitable for any game genre.

Note on the HMAC: The signed message is all bytes before the HMAC field concatenated with the 64 token octets of the user's token.

| Identifier                   | Bits  | Bytes | Type  | Description                                                                                                                                           |
| ---------------------------- | ----- | ----- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| messageType                  | 8     | 1     | enum  | A long spatial opcode (128–140), e.g. `GENERIC_SPATIAL_1` (140).                                                                                      |
| appId                        | 64    | 8     | int64 | The app's numeric ID (world / tenant scope for this message).                                                                                          |
| chunk X                      | 64    | 8     | int64 | The chunk's x coordinate.                                                                                                                             |
| chunk Y                      | 64    | 8     | int64 | The chunk's y coordinate.                                                                                                                             |
| chunk Z                      | 64    | 8     | int64 | The chunk's z coordinate.                                                                                                                             |
| distance                     | 8     | 1     | uint8 | The chunk distance to replicate the message.                                                                                                          |
| decay rate                   | 8     | 1     | enum  | `DecayRate`: replication density across Chebyshev rings 1–8.                                                                                          |
| containsAuth                 | 8     | 1     | bool  | 0 if the hmac is not present. 1 if it is.                                                                                                             |
| uuid                         | 256   | 32    | utf8  | A client generated 32 byte string.                                                                                                                    |
| payload                      | X     | X     | any   | The payload for this message.                                                                                                                         |
| hmac                         | 0/256 | 0/32  | bytes | HMAC-SHA256 using the 64-octet game token string as key.                                                                                              |
| game token ID / epoch millis | 64    | 8     | int64 | Client-to-server: the client's game token ID. Server-to-client: epoch milliseconds (the client already knows its own token ID). Same slot, same size. |
| sequence number              | 8     | 1     | uint8 | Client's sequence number for this message. Wraps.                                                                                                     |

The fixed prefix (from `messageType` through `uuid`) is **68 bytes**; the `payload` field starts at **offset 68** in the UDP application payload. The trailing slot is **9 bytes** without HMAC (game token id + sequence) or **41 bytes** with HMAC (32 + 9). So the minimum total application length is **77** bytes with an empty `payload` and no HMAC (`68 + 9`), and **109** bytes with HMAC and an empty `payload` (`68 + 32 + 9`).

## Actor presence and heartbeats

The server tracks each actor's **presence** (which chunk it occupies and that it is alive). Presence is refreshed every time the client sends an `ACTOR_UPDATE_REQUEST` for that actor; if a client goes quiet, its actor's presence goes **stale after a few seconds** and the server stops replicating it to other players. So a client must keep some traffic flowing for any actor it wants to stay visible.

When the player is actively moving you already send `ACTOR_UPDATE_REQUEST`s, which keep presence fresh. When the player is **idle** (not moving), you can keep the actor alive cheaply with the optional `CLIENT_ACTOR_HEARTBEAT` (opcode `26`):

- It **reuses the long-spatial layout above** (same fields, same HMAC scheme), just with `messageType = 26`. Set the actor's current `chunk` + `uuid`; `distance`/`decay rate` are ignored (send `0`).
- The server validates it like any spatial message (session + HMAC), then refreshes **only the sender's own actor presence and session**. There is **no fan-out**: other players are not notified by it.
- From server v0.51.0 the server accepts it only where it would accept the same actor's `ACTOR_UPDATE_REQUEST`: see [below](#a-keepalive-is-accepted-only-where-the-actors-update-would-be). Before v0.51.0 it passed no permission check.
- It carries no game state, so it is much cheaper than a full actor update for an idle actor.
- From server v0.48.0 it counts as the app's data in, like every other message the server accepts (about 151 bytes on the wire), except while the app is paused for funds. So does `CLIENT_CAPABILITIES`.

**Cross-server presence is automatic.** You only ever talk to your own server; you never address other servers. **Presence** is the registration that your actor is alive in a chunk. The server keeps that registration current on other servers and other worker cores. An `ACTOR_UPDATE_REQUEST` while the actor is moving, or a `CLIENT_ACTOR_HEARTBEAT` while it is idle, is what keeps the registration from going stale. A heartbeat still does not fan out: other players are not notified by it.

**Replication is each spatial message.** It is delivered at the rate you send it. The Buddy a recipient is connected to does not thin that stream. The only thinning is the `distance` and `decay rate` on the message.

A reasonable client policy: send `ACTOR_UPDATE_REQUEST` as the actor moves, and when idle send a `CLIENT_ACTOR_HEARTBEAT` every couple of seconds (comfortably under the staleness window) so presence never lapses.

### A keepalive is accepted only where the actor's update would be

From replication server v0.51.0, a keepalive (`CLIENT_ACTOR_HEARTBEAT`, 26) passes the check an
actor update passes: the player needs `access` for the chunk the keepalive names
([Permissions](/replication-api/operations#permissions-always-enforced)). A place is private
to keepalives exactly when it is private to updates. A plot inside a world whose world grid
grants `access` stays open.

Where the player has no `access`:

- **Every keepalive is answered `UNAUTHORIZED`**, the error frame `[3][seq][7]`. It arrives
  unsigned on a player's session, and inside the signed bundle of a
  [fleet session](/management-api/fleet-sessions).
- **The player is not present there.** The session is sent nothing of the place, and it stays
  connected.
- **Keep sending at the normal cadence.** Never send faster, and never stop. When access is
  granted, the next keepalive is admitted within about 6 seconds, with no new sign-in.
- **A refused keepalive is not gameplay input** for the app's idle timeout, and it is not
  counted as data in. Its three-byte answer is data out.
- **Access that is removed** takes effect at the session's next token refresh, at most 30
  minutes later, as it does for updates.

**What your game does.** Nothing, if its players only stand where they may enter. Otherwise
expect `UNAUTHORIZED` in answer to the keepalive, and do not treat the player as present in
that place.

Four things are unchanged:

- an app where every region is open;
- a paused app, where keepalives are still accepted wherever the player has `access`;
- an idle player's first keepalive after a move, a reconnect, or a token refresh;
- a fleet session's own keepalive. A carried player's keepalive is judged for that player.

Before v0.51.0 a keepalive was not held to `access`. A player without `access` to a region of
their app could stay present there by keepalives, and was sent what happened there.

**The SDKs report a refused keepalive once**, for the actor and the place, and again when it
ends. They keep the keepalive rate as it was.

| SDK | A player's connection | A fleet session |
|---|---|---|
| CrowdyJS 18.41.0 | Sends no keepalive message: it keeps an actor present with actor updates | `FleetSession`'s `notPresent` and `notPresentEnded` handlers |
| CrowdyCPP 0.95.0 | `Handlers::notPresent` and `notPresentEnded`; `WorldSessionConfig::onNotPresent` and `onNotPresentEnded` | `FleetHandlers::notPresent` and `notPresentEnded` |

See [the CrowdyCPP replication client](/crowdycpp/replication-client#a-refused-keepalive-is-reported-once)
and [the fleet guide](/management-api/fleet-sessions#an-sdk-does-the-same-steps-for-you).

**No particular keyframe cadence is needed to be seen across servers (server v0.37.0).** Two
idle players on different servers see each other from the first full actor update after
joining, whatever the heartbeats between them; with the SDKs' defaults (a full update every
3 s, heartbeats every 2 s) that is 3 s after joining. Before v0.37.0 a heartbeat that reached the
server ahead of the first update kept the two from ever meeting until one changed chunk, and
only full updates every 1.5 s or faster without heartbeats worked around it. A heartbeat does not
change the rings or the distance your updates asked for.

## Spatial Routing Diagram

Our most commonly used client-to-server datagram looks like this. Bit and octet numbering follow
[RFC 791](https://www.rfc-editor.org/rfc/rfc791) Figure 4: each tick is one bit,
each row is 32 bits (four octets). Multi-byte integers are **little-endian** on
the wire. `~` marks a variable-length run. `N` is the total UDP application
payload length in octets for this single message (not an inner slice of a
`MESSAGE_BUNDLE`).

Because `messageType` is one octet, every following `int64` straddles three
32-bit rows (3 + 4 + 1 octets). Row labels show the **absolute** octet ranges
each row covers.

```
                Client → Server — Generic Spatial (RFC 791 style)

    0                   1                   2                   3
    0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 0 | messageType   |              appId (octets 1-3)               |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 4 |                      appId (octets 4-7)                       |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
 8 | appId oct. 8  |            chunk X (octets 9-11)              |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
12 |                    chunk X (octets 12-15)                     |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
16 |chunk X oct. 16|            chunk Y (octets 17-19)             |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
20 |                    chunk Y (octets 20-23)                     |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
24 |chunk Y oct. 24|            chunk Z (octets 25-27)             |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
28 |                    chunk Z (octets 28-31)                     |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
32 |chunk Z oct. 32|   distance    |   decay rate  | containsAuth  |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
36 |                      uuid (octets 36-39)                      |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
40 |                      uuid (octets 40-43)                      |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
44 |                      uuid (octets 44-47)                      |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
48 |                      uuid (octets 48-51)                      |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
52 |                      uuid (octets 52-55)                      |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
56 |                      uuid (octets 56-59)                      |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
60 |                      uuid (octets 60-63)                      |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
64 |                      uuid (octets 64-67)                      |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
68 |                                                               |
   ~                      payload (X octets)                       ~
   |                                                               |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
   |                                                               |
   ~       hmac (32 octets, present only if containsAuth = 1)      ~
   |                                                               |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
N-9|                     game token ID (int64)                     |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
N-5|                     game token ID (cont.)                     |
   +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
N-1| sequence (u8) |
   +-+-+-+-+-+-+-+-+
```

Fixed prefix (through `uuid`): **68 octets** (`messageType` at 0, `appId` at
1–8, `chunk X` at 9–16, `chunk Y` at 17–24, `chunk Z` at 25–32, `distance` /
`decay rate` / `containsAuth` at 33 / 34 / 35, `uuid` at 36–67). Tail without
HMAC: **9 octets** (`game token ID` + `sequence`). Tail with HMAC: **41
octets** (32 + 9). Minimum total `N` with empty payload: **77** (no HMAC) or
**109** (with HMAC).

`payload` length: `X = N − 68 − tailOctets`, where `tailOctets` is `9` or `41`.
HMAC input is bytes `[0 .. 68 + X)` concatenated with the 64-octet game token
string — see **[HMAC](/replication-api/hmac)**.


### Voxel payload (`VOXEL_UPDATE_REQUEST`, `VOXEL_UPDATE_NOTIFICATION`)

Voxel messages use the same long form shell. The table below is only the **`payload`** region (bytes at offset 68 onward), not the full datagram.

| Identifier  | Bits | Bytes | Type   | Description                                                                               |
| ----------- | ---- | ----- | ------ | ----------------------------------------------------------------------------------------- |
| voxelX      | 16   | 2     | int16  | The voxel's x coordinate in the chunk.                                                    |
| voxelY      | 16   | 2     | int16  | The voxel's y coordinate in the chunk.                                                    |
| voxelZ      | 16   | 2     | int16  | The voxel's z coordinate in the chunk.                                                    |
| voxelType   | 16   | 2     | int16  | The new voxel type for this location.                                                     |
| stateLength | 16   | 2     | uint16 | The length of the state object, at most 1,024 (server v0.37.0; a longer one is refused `INVALID_REQUEST`). If 0, there is no state. Must be set when state is empty. |
| voxelState  | X    | X     | bytes  | an array of bytes.                                                                        |

Minimum **total** application length for a voxel update with `stateLength = 0`: **87** bytes without HMAC (`68` header + `10` fixed voxel fields + `9` tail), or **119** bytes with HMAC (`68 + 10 + 41`).

The voxel position and type are **your app's signed 16-bit values**: the server checks no
narrower range (a game on 16×16×16 chunks uses 0-15, but nothing requires it). Since server
v0.37.0 an accepted edit is always delivered back to its sender, once, as a normal
`VOXEL_UPDATE_NOTIFICATION`, even when the sender's actor is out of range of the chunk; other
spatial messages reach their sender only when its actor is in range.

### Video payload (`CLIENT_VIDEO_PACKET_2`, `CLIENT_VIDEO_NOTIFICATION_2`)

Webcam video rides the long form shell exactly as voice does (134/135): a client
sends **143** with `use_video_chat` held for the app **and** for the target
chunk's grid (the same two-level check as `use_voice_chat`; a refusal is
`GENERIC_ERROR_MESSAGE` `UNAUTHORIZED` correlated by `sequenceNumber`), and the
server fans it out as **144** with the same chunk / distance / decay rules as
audio, never inspecting the payload. **A datagram is at most 1232 bytes**, so an
encoded frame does not fit in one message: the client cuts it into fragments,
and the receiver reassembles. The server and the GraphQL proxy never look inside
a fragment; the header below is a **client-to-client convention** that the
official SDKs implement (CrowdyJS `fragmentFrame` / `VideoFrameAssembler`,
CrowdyCPP `crowdy/media/video_frames.hpp`). Implement exactly this if you write
your own client, or your frames will not decode on anyone else's.

The `payload` region (offset 68 onward) of every video message is one fragment:

| Offset | Bytes | Field       | Meaning                                                                           |
| ------ | ----- | ----------- | --------------------------------------------------------------------------------- |
| 0      | 1     | `version`   | `0x01`. Anything else: drop the fragment.                                          |
| 1      | 1     | `codec`     | `0` = JPEG, `1` = WebP. `2–255` reserved: drop.                                   |
| 2      | 2     | `frameId`   | `uint16` **big-endian**, per sender, `+1` per frame, wraps at 65536.               |
| 4      | 1     | `fragIndex` | 0-based index of this fragment within the frame.                                  |
| 5      | 1     | `fragCount` | Total fragments in the frame, `1..16`. `0` or `> 16`: drop.                        |
| 6      | X     | `body`      | This fragment's slice of the encoded frame (a JPEG or WebP file), in order.       |

- Header is **6 bytes**. Max body is **1117 bytes** with HMAC (1149 without):
  the 1232-byte datagram less the 68-byte prefix, the 6-byte header and the 41-
  or 9-byte tail. Fragments are cut at the max body; only the last is shorter.
- **Ceiling: 16 fragments per frame (~17.8 KB).** A sender refuses a frame above
  the ceiling rather than sending a partial one. Aim far lower — see the cost note.
- **Reassembly:** buffer per `(sender uuid, frameId)`; a frame is complete when
  all `fragCount` indices are present, and is delivered **once**. Abandon an
  incomplete frame when a fragment with a *newer* `frameId` (mod 65536) from the
  same sender arrives, or after **500 ms** without progress. There is no
  retransmit and no NACK; the next frame is the recovery. Fragments for a
  `frameId` not newer than the last completed or abandoned one are stragglers:
  drop them.
- The 1-byte `sequenceNumber` in the tail is correlation-only, as for every
  spatial message; `frameId` is the ordering key.
- Recommended sending: `distance` **1** (your chunk and its neighbours),
  `decayRate` `0`, **at most 10 fps**, frames **≤ 8 KB** (JPEG quality ≈ 0.5 at
  128×96 lands at 2–5 KB).

:::warning[Every receiver pays for your video]
Bytes are billed on **egress**, and a video message is copied to every actor
within `distance`. One sender at 10 fps × 4 KB is ~40 KB/s (≈ 350 kbit/s) **to
each receiver**; ten cameras on in one chunk is ~400 KB/s into every player
standing there, and the app's egress meter counts every copy. Keep `distance`
at 0–1, frames small and the rate low, and give players a toggle — the
permission is opt-in (`use_video_chat` is granted on a tier, never by default)
for the same reason. See **[Operations → Permissions](/replication-api/operations)**.
:::

### Actor left (`ACTOR_LEFT_NOTIFICATION_2`)

**145** is server → client only and tells the actor's neighbourhood that the
server no longer considers it present. It uses the long form shell, signed like
every other server → client spatial notification: `chunk` is the actor's **last
known chunk**, `uuid` is the actor that left, `distance` is the radius the server
used for the fan-out and `decay` is `0`. The `payload` region is:

| Offset | Bytes | Field      | Meaning                                                                                                                                                                                 |
| ------ | ----- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0      | 1     | `reason`   | **0 = STALE** — the actor stopped updating (about five seconds after its last update). **1 = SESSION_RELEASED** — the server ended the session (deauthorisation or token expiry). `2–255` reserved: treat as STALE. |
| 1      | …     | reserved   | May be absent or longer in a later revision; ignore.                                                                                                                                    |

Semantics, stated as contract:

1. **Emitted once, at the moment the server stops considering the actor
   present** — the same moment its presence record is removed. Not on every
   silent tick, and not on session release alone if the actor was already gone.
2. **Fanned out to the actor's neighbourhood** with the same chunk-ring rules as
   its actor updates were, so exactly the clients that could have seen it are
   told. It is delivered like any other notification, standalone or in a
   `MESSAGE_BUNDLE`; the sender's own session, if it still exists, is not told.
3. **Not emitted for an actor still present elsewhere.** A session that moves to
   another server (a reconnect, or an overload shed — see `COMMAND_RECONNECT`)
   is a migration, not a leave: nothing is emitted and the actor stays present.
4. **Tolerate leave → join for the same `uuid`.** A true reconnect after a stale
   looks exactly like that; remove the actor on 145 and re-create it on the next
   `ACTOR_UPDATE_NOTIFICATION`. Never latch "gone forever".
5. **No acknowledgement, no retransmit.** Keep your own staleness reaper (the
   SDKs use 12 s without an update) as the fallback for a lost datagram; 145 is
   the fast path, not the only path.

### Chunk changed (`CHUNK_CHANGED_NOTIFICATION`)

**146** is server → client only (replication server v0.45.0). It tells the players near a chunk
that the chunk was **replaced as a whole** (a hub's or mod's `world.set_chunk`, Application API
v2.68.1), so they read it again instead of receiving a voxel update per voxel. It uses the long
form shell, signed like every other server → client spatial notification: `chunk` is the chunk,
`uuid` is empty, `distance` is the radius of the fan-out (8) and `decay` is `0`. It passes block
lists like voxel edits do. The `payload` region is:

| Offset | Bytes | Field       | Meaning                                                                                   |
| ------ | ----- | ----------- | ----------------------------------------------------------------------------------------- |
| 0      | 8     | `updatedAt` | int64 little-endian epoch milliseconds: the stored chunk's new `updatedAt`.               |
| 8      | …     | reserved    | May be absent or longer in a later revision; ignore.                                     |

Read the chunk again (`getChunk`, or a region read with `since`). A copy you hold whose
`updatedAt` is that new or newer already has the change. Older clients ignore 146 (an unknown
type) and see the change only on their next read. The Application API's GraphQL proxy delivers it as the
`ChunkChangedNotification` member of `udpNotifications`, and the binary relay passes it through.

## Distance Field

- The distance for replication is in chunk units and clamped to the 0-8 range by Chebyshev distance.
- A ring is the Chebyshev distance from the sender's chunk on that message. The same chunk is ring 1 for a sender in a neighboring chunk and ring 8 for a sender eight chunks away.
- Decay starts at ring 1. The sender's own chunk is not thinned. With `NONE` or `EXPONENTIAL`, an adjacent chunk receives every update. `LINEAR_50`, `LINEAR_25`, `LINEAR_10`, and `LINEAR_5` can thin ring 1; the table below is how often each ring is included.
- Which Buddy the recipient is connected to does not change either rule. `serverWithLeastClients` places by load.
- How games implement chunks is up to them. Within the game they can represent anything.
- Game designers should design their game around the fact that the server only replicates messages to 8 chunks distant.
- Game designers should take into account the available decay algorithms when determining how widely to space their actors in their chunks.

## Decay algorithms (`DecayRate`)

```js
NONE = 0;
EXPONENTIAL = 1;
LINEAR_50 = 2;
LINEAR_25 = 3;
LINEAR_10 = 4;
LINEAR_5 = 5;
```

| Enum                                              | Explanation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NONE`                                            | No tick-based thinning. Fan-out includes all Chebyshev rings `1..min(distance, 8)` (clamped to `Config::DISTANCES_COUNT`).                                                                                                                                                                                                                                                                                                                                                                                   |
| `EXPONENTIAL`                                     | For ring `d` ≥ 1, include that ring only when `(tick & ((1 << (d - 1)) - 1)) == 0`. Here `tick` is the sender’s per-actor distance counter in the chunk. Effect: ring 1 every update, ring 2 every 2nd, ring 3 every 4th, and so on.                                                                                                                                                                                                                                                                         |
| `LINEAR_50`, `LINEAR_25`, `LINEAR_10`, `LINEAR_5` | **Linear** taper with floor `floor_pct` ∈ {50, 25, 10, 5}. Let `maxDist = min(distance, 8)`. For each ring `d` from 1 to `maxDist`: `pct = 100 - (100 - floor_pct) * d / maxDist` (integer division), `thresh = max(1, pct * 20 / 100)`. Include the ring when `(tick % 20) < thresh` (same `tick` as above). At `d == maxDist`, `pct == floor_pct`, so the furthest ring fires on `floor_pct`% of the 20-slot cycle (e.g. 10/20 for `LINEAR_50`). Closer rings use a higher `pct` and thus fire more often. |

## HMAC details

View the client HMAC document for details on creating and parsing the HMAC. The client and server must use the same algo.

## Instructions to Clients

- After a client is authenticated to the server, the client should send an actor update request immediately for each actor so the server knows where everyone is.
- Set the message type according to what information needs to be sent. Although the messages are routed according to the distance and decay fields, the server has defaults and special handling rules for various message types.
- Set the **app ID** (`appId`) for the app this client is authorized to use.
- Set the chunk coordinates for the location of the given actor or event taking place.
- Set the distance the message needs to replicate. Any other clients within that distance will receive the message after the decay rate is factored in.
- Set the decay rate according to the `DecayRate` enum above.
- Decide if the HMAC will be included. Not all messages need to have the HMAC.
- If the HMAC is included, calculate it according to the client HMAC document.
- Set the game token ID field to the client's game token ID. In server responses, this same field will contain epoch milliseconds instead.
- Set the sequence number of this message. Sequence numbers are for the convenience of the client and should be incremented for each message sent, regardless of any error messages.
- Server sent messages may be single messages or packed into bundles. Test the message type and handle appropriately. Your own requests may be packed the same way (see [Message Bundle per Datagram](#message-bundle-per-datagram)); each member still carries its own HMAC tail and sequence number.
- **Verify inbound notifications:** server→client long-spatial notifications arrive with `containsAuth = 1` and a 32-byte HMAC. Recompute `HMAC-SHA256(token, prefix || token)` with your game token and **constant-time compare** to the tail HMAC; drop the message on mismatch. The 8-byte slot after the HMAC is server epoch millis (not part of the signed data). See **[HMAC](/replication-api/hmac)**.

## Instructions to Servers

- In each outbound spatial notification, overwrite the game token ID field with the current epoch milliseconds.
- If the inbound message has `containsAuth` set, validate the HMAC using the client's token.
- **Sign outbound long-spatial notifications:** set `containsAuth = 1` and write a 32-byte HMAC-SHA256 keyed on the **recipient's** 64-octet game token over `prefix || token` (the same scheme clients use to sign), so each client can authenticate the notification. See **[HMAC](/replication-api/hmac)**.

## Single Actor Message

`SINGLE_ACTOR_MESSAGE` (142) lets one actor send a message to exactly one other actor instead of broadcasting to everyone nearby.

It **reuses the [Long Form Spatial Message](#long-form-spatial-message) layout byte-for-byte** — the same header, payload, optional HMAC, and trailer. The only differences are in how the fields are interpreted:

- The `chunk` coordinates are the **destination** actor's chunk (the sender must know where the target actor currently is).
- The `uuid` is the **destination** actor's UUID.
- The `distance` and `decay rate` fields are **ignored** by the server (set them to 0).

The server delivers the message only to the single client that owns the destination actor, replicating it with the same opcode (142). There is no separate notification opcode and the sender receives no echo. The message carries only the target's UUID, not the sender's — if the recipient needs to know who sent it, include that in the `payload`.
