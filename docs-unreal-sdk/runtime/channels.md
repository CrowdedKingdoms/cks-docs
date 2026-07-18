---
slug: channels
sidebar_position: 10
title: Channels
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Channels

A channel is a named, non-spatial delivery group. Events and messages sent to a channel reach every member, at any distance, with no spatial decay.

This is the path you use for chat, lobby state, and other game-wide signals that are not tied to a position in the world.

There are two ways to use channels:

- Send a Multicast CrowdyEvent over a named channel. This rides the RPC system, so you get typed parameters and reliable delivery.
- Send a raw channel message with `PublishChannelMessage`. This is a fire-and-forget byte broadcast with no delivery guarantees.

For how channels compare to the other recipient modes, see [Recipients and routing](/unreal-sdk/runtime/recipients-and-routing).

:::note
The reliable channel is also what carries [replicated subsystems](/unreal-sdk/runtime/replicated-subsystems): a host-owned subsystem's Crowdy State deltas and its Multicast CrowdyEvents both ride it rather than the spatial path. Note that a single channel message does not fragment, so it has a hard payload cap; keep any per-message content small.
:::

## Multicast events over a channel

A CrowdyEvent with the `Multicast` recipient routes over a named channel instead of through space. You name the channel with the `CrowdyChannel` meta on the receiver.

```cpp
#include "Replication/RPC/CrowdyEvent.h"

UFUNCTION(meta=(CrowdyEvent, CrowdyRecipient="Multicast", CrowdyChannel="SampleWorldChat"))
void Announce_Implementation(const FString& Text, const TArray<int32>& Counts);
CROWDY_EVENT(Announce)
```

Call it like any other event:

```cpp
Announce(TEXT("hello"), { 1, 2, 3 });
```

The event reaches every member of `SampleWorldChat`, regardless of where they are in the world.

:::note
`CrowdyDecay` and `CrowdyDistance` do not apply to a Multicast event. Those are spatial controls only.
:::

Parameters work the same as any CrowdyEvent. You can pass typed values directly, with no payload struct. See [Recipients and routing](/unreal-sdk/runtime/recipients-and-routing) for the full list of allowed parameter types.

### Auto-join on connect

You do not call a join function for these channels.

When the SDK opens its UDP connection it joins every channel referenced by a `CrowdyChannel` meta in your project, plus a default session channel.

### The default session channel

Every connected client also joins a default channel named `__crowdy_session_<appId>`, where `<appId>` is your app's identifier.

A Multicast event with no `CrowdyChannel` set goes to this session channel, so a project-wide broadcast works without naming a channel.

:::note
The runtime channel set is the union of the default session channel and every `CrowdyChannel` name found across your receivers. Adding a new named channel is a matter of adding a receiver that references it; the join happens automatically on the next connect.
:::

## Raw channel messages

When you want to broadcast arbitrary bytes to channel members without the RPC layer, use `UCrowdyChannels` (module CrowdyServices).

```cpp
TArray<uint8> Payload;
// fill Payload with your encoded bytes

Channels->PublishChannelMessage(ChannelId, Payload);
```

Receivers handle the broadcast through `OnChannelMessageReceived`. Bind a `UFUNCTION` to it and decode the payload yourself.

Membership has cache accessors and queries that follow the same pattern as [Teams](/unreal-sdk/services/teams): read the cache for instant state, treat callbacks as eventual truth.

### Raw messages versus RPC

Raw channel messages are fire-and-forget. They have no ordering and no receipt guarantee. A message can arrive out of order, or not arrive at all, and the sender is not told.

| Path | Typed params | Ordering | Delivery guarantee |
| --- | --- | --- | --- |
| Multicast CrowdyEvent | Yes | Yes | Reliable |
| `PublishChannelMessage` | No (raw bytes) | No | None |

:::tip
Use a Multicast CrowdyEvent when correctness matters: lobby state, score updates, anything a player would notice if it were dropped. Reach for `PublishChannelMessage` only for high-volume, lossy traffic where an occasional miss is acceptable and you are encoding your own bytes.
:::

## Creating and managing channels at runtime

You are not limited to authoring channels in Crowdy Studio. `UCrowdyChannels` (module CrowdyServices) lets your game create and manage them live.

<Tabs>
<TabItem value="cpp" label="C++" default>

`CreateChannel` makes a new channel owned by the current player:

```cpp
void CreateChannel(const FString& Name, const FString& Description,
                   ECrowdyTeamMembershipPolicy MembershipPolicy, bool bMembersCanSend,
                   FOnChannelSuccess OnSuccess, FOnChannelError OnError);
```

`bMembersCanSend` decides whether ordinary members may publish, or only send through roles you grant. The success delegate returns the new `FCrowdyGroup` with its `GroupId`.

The rest of the surface mirrors teams, with per-call success and error delegates:

- Channel lifecycle: `UpdateChannel`, `DeleteChannel`.
- Membership: `JoinChannel`, `RequestToJoinChannel`, `LeaveChannel`, `AddChannelMember`, `RemoveChannelMember`.
- Roles and policy: `CreateChannelRole`, `UpdateChannelRole`, `DeleteChannelRole`, `SetChannelMemberRoles`, `SetChannelPolicy`.
- Cache and queries: `GetCachedMyChannels`, `IsPlayerInChannel`, `HasPermissionInChannel`, `GetMyChannels`, and the `OnMyChannelsCacheChanged` delegate. These follow the same cache-first pattern as [Teams](/unreal-sdk/services/teams).

</TabItem>
<TabItem value="blueprint" label="Blueprint">

All channel operations are available as Blueprint async action nodes under **Crowdy SDK | Channels**. They follow the same pattern as the [Teams Blueprint nodes](/unreal-sdk/services/teams): each node has `OnSuccess` and `OnError` output pins you bind directly in the graph.

**Query nodes** (under Crowdy SDK | Channels | Queries):

| Node | OnSuccess pins |
| --- | --- |
| Get My Channels | `Memberships` (FCrowdyMyChannelsResult) |
| Get Channel | `Channel` (FCrowdyGroup) |
| Get All Channels | `Channels` (FCrowdyChannelsResult) |
| Get Channel Members | `Members` (FCrowdyChannelMembersResult) |
| Get Channel Roles | `Roles` (FCrowdyChannelRolesResult) |
| Get Channel Policy | `Policy` (FCrowdyAppGroupPolicy) |
| Get Pending Join Requests | `Members` (FCrowdyChannelMembersResult) |

**Mutation nodes** (under Crowdy SDK | Channels | Mutations):

Create Channel, Update Channel, Delete Channel, Join Channel, Request to Join Channel, Leave Channel, Add Channel Member, Remove Channel Member, Set Channel Member Roles, Create Channel Role, Update Channel Role, Delete Channel Role, Set Channel Policy.

**Array result structs:** operations that return a list wrap the array in a result struct
(`FCrowdyChannelsResult`, `FCrowdyMyChannelsResult`, `FCrowdyChannelMembersResult`,
`FCrowdyChannelRolesResult`). Break the struct in the graph to reach the inner array. This
is a Blueprint reflection requirement; the inner array type is the same `FCrowdyGroup` /
`FCrowdyGroupMembership` / `FCrowdyGroupMember` / `FCrowdyGroupRole` you would use in C++.


</TabItem>
</Tabs>

:::note
Whether a player may create or change a channel is decided by the server from your app's policy, so a rejected call returns through the error delegate.
:::

Crowdy Studio offers the same operations as a native editor surface, which is convenient for setting channels up ahead of time. See the [Studio Teams and Channels](/unreal-sdk/studio/teams-and-channels) page.


![Crowdy Studio Channels page](/img/unreal-sdk/studio-channels.png)
