---
slug: connection-and-reconnect
sidebar_position: 16
title: Connection and Reconnect
description: How the realtime connection comes up, what it reports while it is up, what happens when it drops, the opt-in monitor that drives a reconnect ladder, bundled sends, and the per-frame receive budget.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Connection and Reconnect

The realtime connection opens after sign-in, re-assigns itself a server when it loses one, and tells the game only when that fails. This page is what a game can read about the connection, what it should react to, and the two knobs that shape the traffic.

## When you need this

A connection indicator in the HUD, a "reconnecting" overlay, a decision about what to show while the world is not being updated. Everything else on the view plane depends on the connection and needs nothing from this page.

## The states

`UCrowdySDKSubsystem::GetUDPConnectionState()` (Blueprint: **Get UDP Connection State**) returns an `EUDPConnectionState`:

| State | Meaning |
|---|---|
| `Disconnected` | Not connected, and no reconnect in progress. |
| `Connecting` | The connection is being opened. |
| `Connected` | Up and carrying traffic. |
| `Reconnecting` | The connection lost its server and is assigning another. Reported, not acted on: it recovers on its own. |
| `GateKeep` (shown as Gate Kept) | The server is gatekeeping this client because the app is full. Nothing retries; the player has already been told. |

:::note[Poll it. No delegate is needed for a status indicator.]
`GetUDPConnectionState` is a pure node, safe to read every frame. Reserve the events below for the moments you must react to.
:::

The events on `UCrowdySDKSubsystem`, all Blueprint-assignable: **On UDP Connection Success** (`OnUDPConnectionSuccess`, an `FOnUDPConnectionSuccess`) whenever the connection comes up, including after a re-assignment, since that is a new session; **On UDP Timed Out** (`OnUDPTimedOut`, an `FOnUDPTimedOut`) when the transport gave up on a re-assignment, with the state at `Reconnecting`; **On UDP Address Notify** (`OnUDPAddressNotify`, an `FOnUDPAddressNotify` with `bSuccess` and `GateKeep`) when the server answers the access request. `RequestUDPAccess()` asks for the connection; the [Quickstart](../quickstart.md) never calls it because the sign-in does. Underneath sits `UCrowdyUDPSubsystem`, whose `GetConnectionState()` is the C++ read that needs no game thread and whose `GetUDPNetworkStats()` returns an `FUDPNetworkStatistics` (bytes and datagrams each way, messages per second, `Ping`, the client-notify counters and loss percentage); `ResetUDPNetworkStats()` zeroes it.

Coming up does more than flip the state: the same handler that broadcasts **On UDP Connection Success** joins the reliable-RPC channels, which is what makes the [session channel](./channels.md) "always joined".

## When it drops

The low-level connection re-assigns a server on its own; the SDK only surfaces it as `Reconnecting`. A failed re-assignment is where the game hears about it: the SDK marks the state `Reconnecting`, broadcasts **On UDP Timed Out**, and immediately asks for the connection again itself, so a handler that polls the state inside that event reads `Reconnecting`, never `Disconnected`. `Disconnected` is what you read only after that request fails too. If the failure was the app being full, the state is `GateKeep` instead and nothing retries. The timeout that starts a re-assignment is `UDPTimeoutSeconds` in the project settings, and the address family is `UDPProtocol` (`ECrowdyUDPProtocol`: `Auto` takes the IPv4 address, `IPv4` records that choice deliberately, `IPv6` takes the IPv6 address and does not fall back). Both are managed by Crowdy Studio and shown read-only in Project Settings; see [Config Sync](../studio/config-sync.md).

`StopNetworkOperations()` reports the session as disconnected for the UI to read; it does not close the socket or interrupt a recovery already under way, deliberately. `ToggleNetworkMessageProcessing()` discards received messages for development.

:::caution[StopNetworkOperations changes what the UI reads. It does not stop the connection.]
The connection belongs to the transport and recovers on its own. Asking the UI to show a disconnect must not be able to cancel that.
:::

## The connection monitor

`UCrowdyConnectionMonitor` is an opt-in game-instance subsystem that turns the raw timeout into a reconnect ladder. Call `InitConnectionMonitor()` once, in your Game Instance's `Init`; until then it does nothing. It attaches to the SDK subsystem's events alongside anything you bound yourself, in any order. `GetReconnectState()` (Blueprint: **Get Reconnect State**, pure) is the last state it reported, for a HUD that polls instead of binding. From then on it broadcasts `OnConnectionStateChanged` (an `FOnConnectionStatusChange`) with an `ECrowdyReconnectState`:

| State | When |
|---|---|
| `Disconnected` | **On UDP Timed Out** arrived. |
| `Connecting` | Every 10 seconds after that the monitor calls `RequestUDPAccess()` again and broadcasts this, up to 6 attempts. |
| `Connected` | The connection came back. The attempt counter resets. |
| `Failed` | Six attempts failed. The monitor stops. |

This is the monitor's own ladder state, distinct from `EUDPConnectionState` above.

:::warning[Failed is a dead end. After six attempts, about a minute, nothing brings the connection back on its own.]
The game decides what happens next: a retry button that calls `RequestUDPAccess`, a return to the menu, a message. Do not wait for a seventh attempt.
:::

The lantern village dims every placed lantern while the connection is down and restores them when it is back: `WatchConnection`, called from `Init`, starts the monitor and binds `HandleConnectionStateChanged`, which receives every ladder state, so the whole reaction is one function.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="conn-events" />

</TabItem>
<TabItem value="bp" label="Blueprint">

In the Game Instance Blueprint, from **Event Init**, a **Crowdy Connection Monitor** getter feeds **Init Connection Monitor** and then **Bind Event to On Connection State Changed**, whose custom event `OnReconnectState` receives `New State`. Dimming every lantern needs a loop, which is more than a six-node figure shows, so the graph binds the event and stops.

<Blueprint src="conn-events" title="Event Init, Crowdy Connection Monitor, Init Connection Monitor, Bind Event to On Connection State Changed, OnReconnectState" />

</TabItem>
</Tabs>

## Bundled sends

Outbound replication messages of one network pass are packed into bundle datagrams. `crowdy.net.send.bundle` (default 1) controls it; 0 sends one datagram per message, a diagnostic switch rather than a setting a shipping build needs. The variable is read when a connection opens, so flipping it takes effect on the next connect, not on the live socket.

## The receive budget

Inbound messages are delivered on the game thread, per frame, under two budgets: `crowdy.net.receive.maxmessages` (default 3072) caps how many messages one frame may deliver, and `crowdy.net.receive.maxdrainms` (default 4.0) caps the milliseconds one frame may spend delivering them. Whichever binds first ends that frame's drain and the rest waits for the next frame. The budget covers every message the connection receives, channel notifications and video fragments included, not only actor updates.

:::note[Raise the message count first.]
If drains keep ending on the time budget instead, delivery is costing more per message than the frame can afford, and the count is not the lever.
:::

`crowdy.net.receive.poolactorupdates` (default 1) reuses actor update message objects instead of allocating one per message; `crowdy.net.routes` prints the network router's subscription table; `crowdy.net.trace 1` logs socket, send, and receive activity, and `crowdy.serialize.trace 1` the encode and decode of each payload. `crowdy.serialize.scopes` adds CPU trace scopes inside decode for profiling.

## Deprecated calls

Five functions on `UCrowdySDKSubsystem` are deprecated (the compiler warns on each call) and do nothing useful: `StartUDPTimeoutMonitoring`, `StopUDPTimeoutMonitoring`, `TriggerUdpHeartbeat`, `DeregisterAllReceptionLayers`, and `SetQueryEndpoint`. The connection tracks its own liveness now; remove the calls.

## Gotchas

- `Reconnecting` needs nothing from you. Only `Disconnected` after a timeout does.
- `GateKeep` is an answer, not a failure. Retrying against a full app asks a server with no room whether it has room.
- Coming up joins the channels. A Multicast event sent before **On UDP Connection Success** is queued and flushed when the bootstrap finishes; see [Channels](./channels.md).
- The monitor is opt-in. Without `InitConnectionMonitor` its event never fires.
- `crowdy.net.send.bundle` changes take effect on the next connect.

## Related

- [Channels](./channels.md): what connecting joins.
- [Video frames](./video-frames.md): the largest consumer of the receive budget.
- [Authentication](./authentication.md): the sign-in that requests the connection.
- [Console variables](../reference/console-cvars.md).
