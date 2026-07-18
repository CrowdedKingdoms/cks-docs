# GraphQL UDP Proxy API -- Client SDK Guide

:::note[Choosing an integration path]

**This is one of two client integration paths.** Use this proxy only if your client **cannot** open raw UDP sockets (browsers, generic JS/TS apps). UDP-capable clients (Unreal Engine, native desktop/mobile games) should authenticate on the Management API, **mint an app-scoped token** (`mintAppToken`), call **`serverWithLeastClients` on the Game API**, then speak raw UDP to Buddy. See the **[Replication API](/replication-api/intro)** for the native UDP path.

Both paths share the same Management API identity and the same **app-scoped token** minted from it (see **[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)**); only the transport differs (GraphQL mutations through this proxy vs. raw **UDP** to a **Buddy** server).

:::

The Game API acts as a UDP proxy between GraphQL clients and Buddy.
Clients on this path interact entirely through GraphQL (HTTP mutations +
WebSocket subscriptions); the API handles UDP connectivity, session registration
with Buddy, HMAC authentication, and binary serialization on the client's behalf.

## Authentication

Every Game API request uses an **app-scoped token** — a token confined to the one
app you are playing. The identity session token that `login` / `register` return
is a management-plane credential and is **rejected** on the Game API and realtime
surface. Mint an app token from the session token, then pass it as
`Authorization: Bearer <token>` on both HTTP requests and WebSocket connections to
the **Game API**:

```graphql
# On the Management API, with the identity session token as the Bearer:
mutation Enter($appId: BigInt!) {
  mintAppToken(input: { appId: $appId }) {
    token          # 64-char app-scoped token -- use this for all Game API requests
    gameTokenId    # numeric ID (informational)
    appId expiresAt gameApiUrl gameApiWsUrl
  }
}
```

App tokens expire (default ~30 min) — call `refreshAppToken` (with the app token
as the Bearer) before `expiresAt`. Browser games that run at a **different origin**
from your hub/Overworld use the OAuth2 Authorization-Code + PKCE flow
(`createPortalAuthorizationCode` → `exchangePortalCode`) instead of a direct mint.
CrowdyJS wraps both in `client.portal`. See
**[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)** and
**[Authentication](/game-api/authentication)**.

## Connection lifecycle

### 1. Subscribe to notifications (WebSocket)

Open a WebSocket with the `graphql-transport-ws` subprotocol and send
`connection_init` with your **app-scoped token** **and the `appId` you are
playing**. The realtime session is app-scoped: the Game API only delivers that
app's spatial notifications, **rejects** a subscription that arrives without an
`appId`, and **rejects** an identity session token or a token scoped to a
different app (see [Realtime connection events](#realtime-connection-events)).

```json
{ "type": "connection_init", "payload": { "Authorization": "Bearer <token>", "appId": "1" } }
```

After `connection_ack`, subscribe:

```graphql
subscription {
  udpNotifications {
    __typename
    ... on ActorUpdateNotification  { appId chunkX chunkY chunkZ distance decayRate uuid state sequenceNumber epochMillis }
    ... on VoxelUpdateNotification  { appId chunkX chunkY chunkZ distance decayRate uuid voxelX voxelY voxelZ voxelType voxelState sequenceNumber epochMillis }
    ... on GenericErrorResponse     { sequenceNumber errorCode }
    ... on ActorUpdateResponse      { appId chunkX chunkY chunkZ distance decayRate uuid sequenceNumber epochMillis }
    ... on VoxelUpdateResponse      { appId chunkX chunkY chunkZ distance decayRate uuid sequenceNumber epochMillis }
    ... on ClientAudioNotification  { appId chunkX chunkY chunkZ distance decayRate uuid audioData sequenceNumber epochMillis }
    ... on ClientTextNotification   { appId chunkX chunkY chunkZ distance decayRate uuid text sequenceNumber epochMillis }
    ... on ClientEventNotification  { appId chunkX chunkY chunkZ distance decayRate uuid eventType state sequenceNumber epochMillis }
    ... on ServerEventNotification  { appId chunkX chunkY chunkZ distance decayRate uuid eventType state sequenceNumber epochMillis }
    ... on SingleActorMessageNotification { appId chunkX chunkY chunkZ uuid payload sequenceNumber epochMillis }
    ... on ChannelMessageNotification { channelId uuid payload sequenceNumber epochMillis }
    ... on RealtimeConnectionEvent  { status code message retryable }
  }
}
```

All spatial types include the full header fields (`appId`, `chunkX/Y/Z`,
`distance`, `decayRate`, `uuid`), plus `sequenceNumber` and `epochMillis`
(server-generated UTC timestamp in milliseconds since epoch).  Only
`GenericErrorResponse` has a minimal 3-field format (no spatial header).

> **`ActorUpdateResponse` / `VoxelUpdateResponse` are legacy.** Current game
> servers do not emit per-request success responses for actor/voxel sends — treat
> a send as fire-and-forward and watch for a `GenericErrorResponse` (correlated by
> `sequenceNumber`) only if it fails. The two response fragments remain in the
> union for backward compatibility.
>
> `ChannelMessageNotification` is delivered on this same subscription but is
> **not** spatial (it has no chunk header) — see [Channels](/game-api/channels).

Subscribing automatically opens a UDP proxy session to the game server if one
does not already exist.  The server picks the game server with the fewest
clients.

#### Realtime connection events

`RealtimeConnectionEvent` reports session-level problems (it carries no spatial
header). Because the session is **app-scoped**, the most common one is a missing
`appId` in `connection_init`:

| `code` | `retryable` | Meaning |
|---|---|---|
| `APP_ID_REQUIRED` | `false` | No `appId` was sent in `connection_init`. App-agnostic subscriptions are not permitted — reconnect with the `appId` you are playing. |
| `APP_TOKEN_REQUIRED` | `false` | The connection used an identity **session token** (or a non-app token). Mint an app-scoped token (`mintAppToken` / portal) and reconnect. |
| `APP_SCOPE_MISMATCH` | `false` | The token is app-scoped but to a **different** app than the `appId` you subscribed with. Use this app's token. |
| `AUTH_REQUIRED` | `false` | Missing or invalid token on the connection. |
| `TOKEN_EXPIRED` | `false` | The app-scoped token passed its `expiresAt`. `refreshAppToken` (or re-portal) and reconnect. |
| `UDP_PROXY_CONNECTION_FAILED` | `true` | The proxy could not open a UDP session (for example the app is runtime-denied). Safe to retry. |

### 2. Register your actor in a chunk

Before another client can receive your updates, **you must send at least one
actor update** so the game server knows your chunk position.  This is the
"registration" step:

```graphql
mutation {
  sendActorUpdate(input: {
    appId: 0
    chunk: { x: 0, y: 0, z: 0 }
    distance: 8
    uuid: "<your-32-byte-uuid>"
    state: ""                     # empty state for registration
    sequenceNumber: 1
  })
}
```

Every client in the same chunk must do this.  After registration, the game
server fans out subsequent updates to all other registered clients in range.

### 3. Send actor updates

```graphql
mutation {
  sendActorUpdate(input: {
    appId: 0
    chunk: { x: 0, y: 0, z: 0 }
    distance: 8
    decayRate: 0
    uuid: "<your-32-byte-uuid>"
    state: "<base64-encoded-binary-state>"
    sequenceNumber: 2
  })
}
```

The mutation returns `true` when the UDP packet is sent.  Other clients in the
same chunk will receive an `ActorUpdateNotification` on their
`udpNotifications` subscription.

### 4. Receive notifications

Notifications arrive as `next` messages on the WebSocket subscription:

```json
{
  "id": "s1",
  "type": "next",
  "payload": {
    "data": {
      "udpNotifications": {
        "__typename": "ActorUpdateNotification",
        "appId": "0",
        "chunkX": "0",
        "chunkY": "0",
        "chunkZ": "0",
        "distance": 8,
        "decayRate": 0,
        "uuid": "abc123...",
        "state": "aGVsbG8=",
        "sequenceNumber": 2,
        "epochMillis": "1712345678000"
      }
    }
  }
}
```

### 5. Disconnect

```graphql
mutation { disconnectUdpProxy }
```

Unsubscribing from `udpNotifications` stops delivery but does **not** release
the UDP session.  Call `disconnectUdpProxy` explicitly, or the server will
release it after 30 seconds of inactivity.

## Complete flow (two clients)

```
Client A                          Web API                    Game Server
────────                          ───────                    ───────────
login + mintAppToken ──────────▶  app token A (this app)
subscribe udpNotifications ─────▶  (opens UDP proxy session, registers session)
                                   ◀── wait ~1.5s for session ready ──▶

sendActorUpdate (seq=1, empty) ──▶  UDP ACTOR_UPDATE_REQUEST ──▶  registers A in chunk

Client B                          Web API                    Game Server
────────                          ───────                    ───────────
login + mintAppToken ──────────▶  app token B (this app)
subscribe udpNotifications ─────▶  (opens UDP proxy session)
sendActorUpdate (seq=1, empty) ──▶  UDP ACTOR_UPDATE_REQUEST ──▶  registers B in chunk

sendActorUpdate (seq=2, state) ──▶  UDP ACTOR_UPDATE_REQUEST ──▶
                                                                  ◀── fan-out
                                   ◀── UDP ACTOR_UPDATE_NOTIFICATION
                                   ─── WebSocket next ──▶ Client A receives B's update
```

## Important notes

- **`state` must be base64-encoded binary**, not JSON.
- **`uuid` must be exactly 32 bytes** when UTF-8 encoded.
- **`sequenceNumber`** is a uint8 (0-255) that wraps.  Present on all spatial
  types.  In responses it echoes the request's sequence for correlation; in
  notifications it is the original sender's sequence.
- **`epochMillis`** is a server-generated UTC timestamp (milliseconds since
  epoch).  Present on all spatial types (notifications and responses).  Use it
  for ordering and synchronization.
- **`distance`** (0-8) controls how many chunks away the update replicates.
  Use 8 for maximum range.  The server clamps values to the 0-8 range using
  Chebyshev distance.
- **`decayRate`** controls how message delivery drops off with distance:

  | Value | Name | Behavior |
  |-------|------|----------|
  | 0 | None | All clients within `distance` receive every message. |
  | 1 | Exponential | Each distance ring receives half the messages of the previous ring. |
  | 2 | Linear 50% | Linear decay; the furthest ring receives 50% of messages. |
  | 3 | Linear 25% | Linear decay; the furthest ring receives 25% of messages. |
  | 4 | Linear 10% | Linear decay; the furthest ring receives 10% of messages. |
  | 5 | Linear 5% | Linear decay; the furthest ring receives 5% of messages. |

- **`appId`** is the app (world) identifier in the spatial wire header — an
  int64 at byte offset 1, distinct from chunk X/Y/Z coordinates.
- The proxy auto-reconnects to the game server if no traffic is seen for 30s.
  The subscription stays open but notifications pause until reconnection.
- **Server load shedding is handled for you.** If the assigned game server runs
  hot it can ask connected clients to move to a different server. The proxy
  intercepts that signal and transparently re-selects a server and re-authorizes
  your session — your WebSocket subscription stays open and there is nothing to
  handle in the browser. (Native UDP clients receive a `COMMAND_RECONNECT` and
  must move themselves — see the [Replication API](/replication-api/operations).)
- Error responses (e.g., invalid token, unknown app) arrive as
  `GenericErrorResponse` on the subscription.
- **Runtime-denied apps are refused.** If an app is suspended or over its budget
  (see [Shared environment & billing](/management-api/shared-environment)), the
  proxy refuses to open a session: HTTP mutations error and the subscription
  delivers a `RealtimeConnectionEvent` with `code: 'UDP_PROXY_CONNECTION_FAILED'`
  (`retryable: true`). Surface it so the studio can fund the wallet or lift the
  cap, then retry.

## Actor-to-actor messages

`sendSingleActorMessage` delivers a message to exactly one other actor (by its
UUID) instead of broadcasting to everyone nearby. The sender must know the
destination actor's current chunk. Only the target receives it -- as a
`SingleActorMessageNotification` on its own `udpNotifications` subscription --
and the sender gets no echo.

```graphql
mutation {
  sendSingleActorMessage(input: {
    appId: 0
    chunk: { x: 7, y: 1, z: 2 }   # the TARGET actor's chunk
    targetUuid: "<target-actor-32-byte-uuid>"
    payload: "aGVsbG8="            # base64; put your own identity here if needed
    sequenceNumber: 1
  })
}
```

The payload carries only the target's UUID, not the sender's; if the recipient
needs to know who sent it, include that in `payload`.

## Other mutations

| Mutation | Description |
|---|---|
| `sendVoxelUpdate` | Modify a voxel in a chunk |
| `sendAudioPacket` | Send voice audio data |
| `sendTextPacket` | Send chat text |
| `sendClientEvent` | Send a custom event |
| `sendSingleActorMessage` | Send a direct message to one actor by UUID (not broadcast) |
| `sendChannelMessage` | Publish to a channel; delivered to members as `ChannelMessageNotification` (see [Channels](/game-api/channels)) |
| `connectUdpProxy` | Explicitly open a UDP session (optional -- mutations and subscription auto-open) |
| `disconnectUdpProxy` | Release the UDP session |

## Queries

| Query | Description |
|---|---|
| `udpProxyConnectionStatus` | Check if a UDP session is active |
| `gameClientBootstrap(appId)` | One-shot startup payload: current user, version requirements, UDP proxy status, realtime protocol + subscription name, and spatial send limits (`maxReplicationDistance`, `maxDecayRate`, `sequenceNumberModulo`) |
