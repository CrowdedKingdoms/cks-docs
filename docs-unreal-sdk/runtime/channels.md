---
slug: channels
sidebar_position: 15
title: Channels
description: "Named, non-spatial message groups: create and join one, publish raw bytes to every member, receive them, and understand the session channel every client joins and the three kinds of traffic that ride it."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Channels

A channel is a named message group within one app: create it, join it, publish to it, and every member receives the message wherever they stand. It is also the transport a `Multicast` CrowdyEvent and a [replicated subsystem](./replicated-subsystems.md)'s state deltas ride, and every client joins one channel, the session channel, whether or not it ever creates another.

`UCrowdyChannels` is a game-instance subsystem. Every server call on it is asynchronous and answers through exactly one of two delegates, success or `FOnChannelError`, including when the request never reaches the server. Publishing is not one of those calls: it goes out over UDP and is not acknowledged.

## When to use one

Guild chat, a party's coordination, a village-wide announcement, trade broadcasts: anything that must reach a group regardless of distance. For a moment that only nearby players need, a `SpatialMulticast` event is cheaper; for a value, [Crowdy State](./crowdy-state.md) or a [Game Model](../game-models/overview.md).

## The session channel

Every app has one channel every client joins on connect, named `__crowdy_session_<appId>`, created on demand when it does not exist and the app's creation policy lets a member create one (otherwise create it once in Crowdy Studio, or the log warns that Game Model signals and default-channel events will drop). It is an SDK-owned transport, not a place for your own messages. It carries every `Multicast` CrowdyEvent with no `CrowdyChannel` of its own, every replicated subsystem's Crowdy State delta, and the Game Model plane's signals (the model-changed ping that triggers a re-pull, an effect signal, and a session-changed cue).

:::warning[A message you publish on the session channel, or on any channel a Multicast event names, never reaches OnChannelMessageReceived.]
Every channel the connect-time bootstrap joins (the session channel and each channel a Multicast event names) and every channel you hand to `RegisterReliableRpcChannel` is an RPC transport: a payload arriving on it goes to the RPC decoder and is never broadcast to the game. Publish your own notices on a channel of your own, one channel per purpose.
:::

`GetSessionChannelId()` is its resolved id, 0 until joined or created, and `AreReliableChannelsReady()` turns true once the connect-time bootstrap has joined every channel the app's Multicast events name plus the session channel. Both are pure nodes you can poll.

:::warning[A channel a Multicast event names must already exist. Only the session channel is created for you.]
The bootstrap joins named channels; it never invents one, because a missing name is usually a typo. It logs `[CrowdyChannels] Multicast channel 'X' was not found for this app - RPCs targeting it will drop. Create it (or fix the name) in Crowdy Studio.` A channel you create at runtime after the bootstrap has run needs `RegisterReliableRpcChannel(ChannelId, Name)` once you have joined it, or events naming it still drop. Registering it makes it an RPC transport: raw `PublishChannelMessage` payloads on it are decoded as RPC frames and are not delivered to `OnChannelMessageReceived`, so keep one channel per purpose.
:::

## Create and join

`CreateChannel(Name, Description, MembershipPolicy, bMembersCanSend, OnSuccess, OnError)` creates one; the creator becomes its owner with the system `leader` role, which holds every permission including `send_messages`. `ECrowdyChannelMembershipPolicy` decides how others get in: `Open` (join at once), `Request` (a join request awaits approval), `Invite` (managers add members), `Admin` (app admins only). `bMembersCanSend` true creates a default `member` role granting `send_messages` to everyone who joins; false makes an announce-only channel where joiners receive but cannot post until given a role. The app's `FCrowdyChannelPolicy` (read with `GetChannelPolicy`) holds who may create channels at all (`ECrowdyChannelCreationPolicy`: `Admin`, `Member`, `Anyone`), the default membership policy, and the caps `MaxMembers` and `MaxChannelsPerUser` (0 means none); `SetChannelPolicy` sets the two policies, and the caps are set in Crowdy Studio.

The lantern village creates a `village` channel for lit notices once the connection is up: `CreateVillageChannel`, called from the game instance's connected handler (the create needs the game token), and `HandleVillageChannelCreated` stores the id behind `GetVillageChannelId`, the one place the id lives.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="ch-create" />

</TabItem>
<TabItem value="bp" label="Blueprint">

In the Game Instance Blueprint, at **Event Init** a **Crowdy SDK Subsystem** getter feeds **Bind Event to On UDP Connection Success**, whose custom event `OnConnected` calls **Create Channel**, a latent node with `Name`, `Description`, `Membership Policy`, and `Members Can Send` inputs and **On Success** (a `Channel` struct) and **On Error** pins. Binding to the connection is what keeps the create after sign-in; at Init there is no token yet and it would answer on **On Error**. To keep the id, drag a **Break Crowdy Channel** off the `Channel` pin on the success branch and set an Integer64 variable `VillageChannelId` from `Channel Id`.

<Blueprint src="ch-create" title="Event Init, Crowdy SDK Subsystem, Bind Event to On UDP Connection Success, OnConnected, Create Channel" />

</TabItem>
</Tabs>

Every connecting client running this asks the server to create the channel. A real game has one client create it, the host for instance, or calls `GetChannels` first and creates only on a miss; the server's creation policy is the real gate on who may.

`JoinChannel(ChannelId, ...)` joins an open channel and `RequestToJoinChannel` files a request on a `Request` channel; `LeaveChannel` leaves. The creator is already a member and needs neither, though the local cache (`HasCachedChannels`, `IsPlayerInChannel`) does not show the new channel until `GetMyChannels` has run.

## Publish and receive

`PublishChannelMessage(ChannelId, Payload)` sends raw bytes to every active member except the sender. The caller must already be a member holding `send_messages`; an open channel's default member role grants it. The server caps a channel message payload at 1024 bytes.

:::warning[Publishing is unacknowledged UDP: no ordering, no delivery guarantee, and the caller is never told if it was dropped.]
It is the right tool for a notice, not for a value. Put anything that must be right on every client in a state property or a Game Model.
:::

The lantern's `PublishLit`, called from the owner-gated overlap, publishes a one-byte notice, its lit flag, on the village channel, reading the id from the game instance's `GetVillageChannelId`:

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="ch-publish" />

</TabItem>
<TabItem value="bp" label="Blueprint">

From **Event ActorBeginOverlap**, behind an **Is Crowdy Entity Locally Controlled** branch (the owner gate the C++ has): a **Crowdy Channels** subsystem getter feeds the `Target`, **Get VillageChannelId** (the Integer64 variable the create graph set) the `Channel Id`, and a one-element **Make Array** the `Payload` byte array of **Publish Channel Message**. The array's one element is the lit byte, 0 in the figure; wire your lit flag into it. It is a plain call with no result pins.

<Blueprint src="ch-publish" title="Event ActorBeginOverlap, Is Crowdy Entity Locally Controlled, Branch, Crowdy Channels, Get VillageChannelId, Make Array, Publish Channel Message" />

</TabItem>
</Tabs>

`OnChannelMessageReceived` fires on the game thread for every delivery, with the channel id, the sender's `SenderUUID`, and the payload. The village's `HandleVillageNotice`, bound by `WatchVillageChannel` from `Init`, reads the one byte and sets every lantern's visibility from it; the check on the payload's length before the read is the validation the caution below asks for.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="ch-receive" />

</TabItem>
<TabItem value="bp" label="Blueprint">

There is no Blueprint figure for the receive side: `OnChannelMessageReceived` carries a byte-array `Payload`, and the generated graphs on this site cannot express a bound event with an array parameter. In your own Blueprint, drag off a **Crowdy Channels** subsystem getter, choose **Bind Event to On Channel Message Received**, and create the matching custom event from the `Event` pin; it receives `Channel Id`, `Sender UUID`, and `Payload` as an array of bytes.

</TabItem>
</Tabs>

:::caution[A channel message is not signed on the way down. Validate the payload before acting on it.]
The server does not sign the delivery, and any member with `send_messages` could have sent it. Treat the bytes as untrusted input: bound every length, clamp every value, and never let one decide an outcome that must hold against a modified client. Three payload prefixes are reserved on every channel and dropped before you see them: text beginning `cmc:`, `csg:`, or `gms|` is the Game Model plane's, so a notice that happens to start that way never arrives.
:::

## The full surface

Cache and queries, on `UCrowdyChannels`: `HasCachedChannels` (has `GetMyChannels` ever completed), `GetCachedMyChannels` (the memberships, no round trip), `IsPlayerInChannel`, `GetMyChannelById`, `IsInAnyChannel`, `HasPermissionInChannel` (an `ECrowdyChannelPermission`: `SendMessages`, `ManageChannel`, `ManageMembers`, `ManageRoles`, `InviteMembers`), `GetMyChannels`, `GetChannel`, `GetChannels`, `GetChannelMembers`, `GetChannelRoles`, `GetChannelPolicy`, `GetPendingJoinRequests`. `OnMyChannelsCacheChanged` fires when the cached membership list changes.

Mutations: `CreateChannel`, `UpdateChannel`, `DeleteChannel`, `JoinChannel`, `RequestToJoinChannel`, `LeaveChannel`, `AddChannelMember`, `RemoveChannelMember`, `CreateChannelRole`, `UpdateChannelRole`, `DeleteChannelRole`, `SetChannelMemberRoles`, `SetChannelPolicy`.

Every query and mutation also exists as a latent Blueprint node with **On Success** and **On Error** pins, one class each: `UCrowdyChannels_GetMyChannels` (**Get My Channels**), `UCrowdyChannels_GetChannel`, `UCrowdyChannels_GetChannels` (**Get All Channels**), `UCrowdyChannels_GetChannelMembers`, `UCrowdyChannels_GetChannelRoles`, `UCrowdyChannels_GetChannelPolicy`, `UCrowdyChannels_GetPendingJoinRequests`, `UCrowdyChannels_CreateChannel`, `UCrowdyChannels_UpdateChannel`, `UCrowdyChannels_DeleteChannel`, `UCrowdyChannels_JoinChannel`, `UCrowdyChannels_RequestToJoinChannel` (**Request to Join Channel**), `UCrowdyChannels_LeaveChannel`, `UCrowdyChannels_AddChannelMember`, `UCrowdyChannels_RemoveChannelMember`, `UCrowdyChannels_SetChannelMemberRoles`, `UCrowdyChannels_CreateChannelRole`, `UCrowdyChannels_UpdateChannelRole`, `UCrowdyChannels_DeleteChannelRole`, `UCrowdyChannels_SetChannelPolicy`. A list result arrives wrapped (`FCrowdyChannelsResult`, `FCrowdyMyChannelsResult`, `FCrowdyChannelMembersResult`, `FCrowdyChannelRolesResult`) so a **Break** node unwraps it. `PublishChannelMessage` has no latent twin; it is a plain call on the subsystem.

The types:

| Type | Holds |
|---|---|
| `FCrowdyChannel` | `ChannelId`, `AppId`, `Name`, `Description`, `OwnerUserId`, `MembershipPolicy`, `Status`, `CreatedAt`. |
| `FCrowdyChannelMember` | `ChannelMemberId`, `ChannelId`, `UserId`, `Status` (`active`, or `pending` while a request waits), `Roles` sorted by rank, `CreatedAt`. |
| `FCrowdyChannelMembership` | Your own membership of one channel: `Channel`, `Roles`, the effective `Permissions` across them, `JoinedAt`. |
| `FCrowdyChannelRole` | `ChannelRoleId`, `ChannelId`, `RoleName`, `Rank`, `bIsSystem`, `Permissions`, `CreatedAt`. Every channel has a non-deletable `leader` role. |
| `FCrowdyChannelPermissions` | The five flags: `bSendMessages`, `bManageChannel`, `bManageMembers`, `bManageRoles`, `bInviteMembers`. |
| `FCrowdyChannelPolicy` | `AppId`, `CreationPolicy`, `DefaultMembershipPolicy`, `MaxMembers`, `MaxChannelsPerUser`. |
| `FCrowdyChannelError` | An `ECrowdyChannelErrorCode` (`Unknown`, `NotFound`, `Forbidden`, `PolicyViolation`, `AlreadyMember`, `NotMember`, `NetworkError`, `ServerError`), a best-effort classification, and the `Message` to show. |

Every id is an `int64`; the server's ids are 64-bit.

In C++ each call takes a pair of dynamic delegates: a success type shaped for its result (`FOnChannelSuccess` with an `FCrowdyChannel`, `FOnChannelsSuccess` with the array, `FOnChannelMemberSuccess`, `FOnChannelMembersSuccess`, `FOnChannelRoleSuccess`, `FOnChannelRolesSuccess`, `FOnMyChannelsSuccess` with the memberships, `FOnChannelPolicySuccess`, `FOnChannelVoidSuccess` for the calls that return nothing) and `FOnChannelError`. The two events are `FOnMyChannelsCacheChanged` and `FOnChannelMessageReceived`. The latent nodes expose the same shapes as multicast pins (`FChannelAsyncOnSuccess`, `FChannelsAsyncOnSuccess`, `FMyChannelsAsyncOnSuccess`, `FChannelMemberAsyncOnSuccess`, `FChannelMembersAsyncOnSuccess`, `FChannelRoleAsyncOnSuccess`, `FChannelRolesAsyncOnSuccess`, `FChannelPolicyAsyncOnSuccess`, `FChannelVoidAsyncOnSuccess`, and `FChannelAsyncOnError`).

## What rides a channel from the SDK itself

A `Multicast` CrowdyEvent is encoded into a channel payload and published over the session channel, or the channel its `CrowdyChannel` names once this client has joined it. A replicated subsystem's Crowdy State delta travels the same way. Both are capped at 1024 bytes by the SDK's own codec and dropped loudly, never truncated, when they would exceed it; a Multicast event whose parameters can never fit is refused at registration. "Reliable" on this path means every member is a recipient, not that delivery is guaranteed; see [Recipients and routing](./recipients-and-routing.md#multicast-what-reliable-means).

`crowdy.rpc.reliable.trace 1` logs the reliable sends and receives on the channel transport.

## Gotchas

- The session channel is always joined, even in a project with no Multicast event. It is where the Game Model pings arrive.
- A named channel is join-only from the SDK's side. Create it in Crowdy Studio or at runtime, then `RegisterReliableRpcChannel` if you created it after connecting.
- `send_messages` gates publishing, not membership. An announce-only channel is a channel whose joiners lack it.
- The sender never receives an echo of its own message.
- Channel management is a Game API call and needs the app-scoped token the sign-in gives you; see [Authentication](./authentication.md). The wire protocol and the GraphQL calls are on the [Game API channels page](/game-api/channels).

## Related

- [Recipients and routing](./recipients-and-routing.md): the Multicast recipient.
- [RPC events in C++](./rpc-events-cpp.md): the `CrowdyChannel` key and the payload cap.
- [Replicated subsystems](./replicated-subsystems.md): deltas over the session channel.
- [Connection and reconnect](./connection-and-reconnect.md): when the channel bootstrap runs.
- [Teams and channels in Studio](../studio/teams-and-channels.md): authoring channels without code.
