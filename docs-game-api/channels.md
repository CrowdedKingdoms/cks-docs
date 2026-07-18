---
sidebar_position: 17
title: Channels
---

# Channels

Channels are app-wide message groups for your game. Unlike spatial messages
(which reach nearby players), a **channel message is delivered to every member of
the channel, wherever they are** — ideal for guild chat, party voice
coordination, trade broadcasts, or app-wide announcements.

A channel is a kind of player [group](teams) (`group_type` `channel`), so it
shares the same membership and role model as teams: a channel has **members**,
**roles** (a `leader` role is created automatically for the creator), and
per-role **permissions**. The one channel-specific permission is
`send_messages`, which controls who may **publish** to the channel. Receiving is
available to every active member.

All channel management runs over the Game API GraphQL endpoint; publishing and
receiving messages run over the realtime UDP path (the same `udpNotifications`
subscription used for spatial traffic). Every operation requires an **app-scoped
token** for this app (send `Authorization: Bearer <token>`; mint one with
`mintAppToken` — see **[Authentication](/game-api/authentication)**).

## Deciding who can create and join channels

Each app has a **channel policy** with two settings:

- **creation policy** — who may create channels: `admin` (only app admins),
  `member` (any player with app access), or `anyone`.
- **default membership policy** — how new channels accept members by default:
  `open` (join instantly), `request` (join request awaits approval),
  `invite` (managers add members), or `admin` (app admins only).

App admins set the policy with `setChannelPolicy` (requires `manage_apps`), and
read it with `channelPolicy(appId)`:

```graphql
mutation {
  setChannelPolicy(input: {
    appId: "1",
    creationPolicy: "member",
    defaultMembershipPolicy: "open",
    maxMembers: 500,          # optional cap on members per channel
    maxGroupsPerUser: 20      # optional cap on channels a user may create/join
  }) { creationPolicy defaultMembershipPolicy maxMembers maxGroupsPerUser }
}
```

`maxMembers` and `maxGroupsPerUser` are optional limits — omit them (or pass
`null`) for no cap.

## Creating a channel

```graphql
mutation {
  createChannel(input: {
    appId: "1",
    name: "Global Trade",
    membershipPolicy: "open",   # optional; defaults to the app policy
    membersCanSend: true        # optional; defaults to true
  }) { groupId name membershipPolicy }
}
```

The creator becomes the **owner** with the system `leader` role (which holds
every channel permission, including `send_messages`).

`membersCanSend` controls the default for joiners:

- **`true` (open chat):** a default `member` role granting `send_messages` is
  created and auto-assigned to everyone who joins, so all members can post.
- **`false` (announce / read-only):** joiners receive messages but cannot post.
  Grant a posting role explicitly to chosen members (see Roles below).

## Joining and leaving

```graphql
mutation { joinChannel(groupId: "12") { status } }          # open -> active, request -> pending
mutation { requestToJoinChannel(groupId: "12") { status } }
mutation { leaveChannel(groupId: "12") }
```

`myChannels(appId)` lists the channels you belong to, with your roles and your
effective channel permissions. `channels(appId)` lists the active channels in an
app, and `channel(groupId)` fetches one.

## Managing members and roles

Members whose role grants `manage_members` (plus app admins) can add and remove
members; adding also approves a pending request. Players can always remove
themselves.

```graphql
mutation { addChannelMember(groupId: "12", userId: "42") { userId status } }
mutation { removeChannelMember(groupId: "12", userId: "42") }
```

A channel's roles carry these permission keys:

| Key | Allows |
| --- | ------ |
| `send_messages` | Publish messages to the channel |
| `manage_group` | Rename/delete the channel and edit its settings |
| `manage_members` | Add and remove members |
| `manage_roles` | Create/edit/delete roles and assign them |
| `invite_members` | Invite players to the channel |

For an announce channel, create a posting role and assign it to your
broadcasters:

```graphql
mutation {
  createChannelRole(input: {
    groupId: "12", roleName: "broadcaster", permissions: ["send_messages"]
  }) { groupRoleId roleName permissions }
}

mutation {
  setChannelMemberRoles(input: {
    groupId: "12", userId: "42", roleIds: ["88"]
  }) { userId roles { roleName } }
}
```

Use `channelRoles(groupId)` / `channelMembers(groupId)` to list a channel's
roles and members, and `updateChannelRole` / `deleteChannelRole` to change them
(the system `leader` role can't be deleted). Holders of `manage_group` (and app
admins) rename or retire the channel itself with `updateChannel(input)` and
`deleteChannel(groupId)`.

## Sending and receiving messages

Publishing and delivery happen over the realtime UDP path. Browser clients use
the `sendChannelMessage` mutation; native clients send the
`CHANNEL_MESSAGE_REQUEST` UDP message directly (see the
[Replication API wire formats](/replication-api/wire-formats)). Like other
realtime sends, `sendChannelMessage` opens a UDP proxy session automatically for
your **app-scoped token** (the token you minted for this app — not the identity
session token `login` returns).

```graphql
mutation {
  sendChannelMessage(input: {
    channelId: "12",
    uuid: "0123456789abcdef0123456789abcdef",  # your actor UUID (32 bytes)
    payload: "aGVsbG8=",                        # base64, app-defined, <= 1024 bytes
    sequenceNumber: 1
  })
}
```

- The payload is **opaque** to the server — encode whatever your app needs
  (chat text, a compact binary event, etc.).
- The sender must be an active member holding `send_messages`; otherwise the
  message is rejected (a `GenericErrorResponse` with `UNAUTHORIZED` is returned
  on `udpNotifications`).
- The sender does **not** receive an echo of its own message.

Every other active member receives a `ChannelMessageNotification` on the shared
`udpNotifications` subscription. As with every realtime subscription, open the
WebSocket with an `appId` in its `connection_init` payload — the session is
app-scoped (see the [UDP Proxy API guide](graphql-udp-proxy-api)):

```graphql
subscription {
  udpNotifications {
    __typename
    ... on ChannelMessageNotification {
      channelId
      uuid          # the sender's actor UUID
      payload       # base64, exactly as sent
      sequenceNumber
      epochMillis
    }
    ... on GenericErrorResponse { sequenceNumber errorCode }
  }
}
```

Messages are **ephemeral** — the server routes them and does not store history.
Keep your own log client-side if you need scrollback.

## Reference

See the [Game API GraphQL reference](/game-api/reference/graphql/graphql-overview)
for the exact inputs and return types, and [Permissions overview](permissions)
for how channel roles fit with app tiers and grid permissions.
