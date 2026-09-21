---
slug: delegates
sidebar_position: 3
title: Blueprint Delegates
description: "Every dynamic multicast delegate the SDK exposes to Blueprint, grouped by the class that owns it, with its signature type and the page that explains when it fires."
---

import SurfaceTable from '@site/src/components/SurfaceTable';

# Blueprint Delegates

A dynamic multicast delegate is what you bind with **Bind Event to** or **Assign** in Blueprint, or `AddDynamic` in C++. The SDK exposes 249 of them; 2 belong to a private actor a game cannot reference and are dropped from this table, and 1 more, `UCrowdyConnectionMonitor::OnConnectionStateChanged`, is left out because the SDK reconnects on its own, so 246 rows render below, every one linked to a page.

## When you come here

You have a delegate bound and want to know what its parameters mean, or you know roughly what you want to react to and want the class that fires it.

All 246 delegates below fire on the game thread. This is a constant fact about every dynamic multicast delegate the SDK broadcasts, never a per-delegate choice, so it is stated once here instead of as a column that would read the same value 246 times: your handler runs like any other Blueprint event or `UFUNCTION`, with no thread-safety code of your own to write.

<SurfaceTable table="delegates" group="owner" />

:::note[OnConnectionStateChanged is not in the table.]
`UCrowdyConnectionMonitor::OnConnectionStateChanged` is not part of the documented path: the SDK reconnects on its own, and starting the monitor adds a second retry loop. Binding it to observe the connection state is safe; do not build retry logic on it. See [Connection and reconnect](../runtime/connection-and-reconnect.md).
:::

## Gotchas

- A delegate's owner class must be reachable before you can bind it: a game instance subsystem's delegate is safe to bind in `Init`, a world subsystem's needs a valid world first.
- Binding twice fires your handler twice. Unbind (`Remove Dynamic` or `RemoveDynamic`) before a re-bind on a path that can run more than once, such as a widget that reconstructs.
- Two delegates on `AWinAudioDeviceMonitor` exist in the SDK but are not shown here: that actor is private and spawned by the voice subsystem for itself, so a game never has a reference to bind against. See [Voice chat](../services/voice-chat.md).

## Related

- [Subsystems](./subsystems.md)
- [Async actions](./async-actions.md)
- [Change pings and pull](../game-models/change-pings-and-pull.md)
- [Connection and reconnect](../runtime/connection-and-reconnect.md)
