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
// 146–255 — reserved for future spatial types
```

Long HMAC spatial layout (below) applies to types **128–140** (`ACTOR_UPDATE_REQUEST` … `GENERIC_SPATIAL_1`), to `SINGLE_ACTOR_MESSAGE` (142), which reuses the same layout (the server ignores its `distance`/`decay rate` fields), and to **143–145** (video and actor-left). In code, `isClientLongSpatialMessageType(t)` is true for `128 <= t <= 140`, for `142` and for `143`; `144` and `145` are server-only — a client that sends them is dropped like any other server-only opcode. `SHORT_SPATIAL_MESSAGE` (141) is reserved for a future compact layout and is **not yet implemented** (no server handler). The non-spatial `CLIENT_ACTOR_HEARTBEAT` (26) also **reuses this exact layout** so the same HMAC/parsing applies — but it is a local-only keep-alive (no fan-out); see "Actor presence and heartbeats" below.

UUIDs are client generated 32 byte UTF8 strings. The null termination byte (33rd slot) is not sent.

## Channel messages

Channels are app-wide message groups: a channel message is delivered to every
member of the channel regardless of location (not chunk-routed). Membership and
the `send_messages` permission are managed over the Game API GraphQL surface
(see the Game API [Channels](/game-api/channels) guide). These are
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

### `CHANNEL_MESSAGE_NOTIFICATION` (server → client)

Delivered to every active member except the sender (no echo), standalone or
inside a `MESSAGE_BUNDLE`.

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
verified command, re-query `serverWithLeastClients` on the Game API (it will not
return the overloaded server) and reconnect with the same game token to the new
host and `clientPort`. The losing server keeps serving you for a short grace
period (≈5 s) and then deletes the session and ignores further packets. See
**[Operations → Load shedding](/replication-api/operations)**. Browser clients on
the GraphQL UDP proxy are migrated automatically and never see this message.

## Message Bundle per Datagram

The message bundle type simply puts multiple messages in a datagram as size allows.
Each message is another message type.
Messages are packed one after another and message lengths are used to determine the size of the actual message.
There will be at least one message in a bundle, but usually more. The parser must use the datagram length and parse through each message to determine if there is another message to parse.
Message bundles are only sent from the server to a client. Clients do not send message bundles.

| Identifier                            | Bits | Bytes | Type   | Description                                              |
| ------------------------------------- | ---- | ----- | ------ | -------------------------------------------------------- |
| messageType                           | 8    | 1     | enum   | `MESSAGE_BUNDLE`                                         |
| messageLength                         | 16   | 2     | uint16 | The length of the next message.                          |
| message                               | X    | X     | bytes  | The full message, corresponding to another message type. |
| messageLength                         | 0/16 | 0/2   | uint16 | The length of the next message if present.               |
| message                               | 0/X  | 0/X   | bytes  | The full message, corresponding to another message type. |
| more messages as datagram size allows |

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
- The server validates it like any spatial message (session + HMAC), then refreshes **only the sender's own actor presence and session** — there is **no fan-out** (other players are not notified) and no permission gate. It is purely a keep-alive.
- It carries no game state, so it is much cheaper than a full actor update for an idle actor.

**Cross-server presence is automatic.** You only ever talk to your own server; you never address other servers. The server itself keeps your actor visible to players on **other servers and other worker cores** on a server-controlled cadence. As long as you keep your local actor alive (via actor updates while moving, or `CLIENT_ACTOR_HEARTBEAT` while idle), remote players continue to see you — no special client action is required.

A reasonable client policy: send `ACTOR_UPDATE_REQUEST` as the actor moves, and when idle send a `CLIENT_ACTOR_HEARTBEAT` every couple of seconds (comfortably under the staleness window) so presence never lapses.

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
| stateLength | 16   | 2     | uint16 | The length of the state object. If 0, there is no state. Must be set when state is empty. |
| voxelState  | X    | X     | bytes  | an array of bytes.                                                                        |

Minimum **total** application length for a voxel update with `stateLength = 0`: **87** bytes without HMAC (`68` header + `10` fixed voxel fields + `9` tail), or **119** bytes with HMAC (`68 + 10 + 41`).

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

## Distance Field

- The distance for replication is in chunk units and clamped to the 0-8 range by Chebyshev distance.
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
- Server sent messages may be single messages or packed into bundles. Test the message type and handle appropriately.
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
