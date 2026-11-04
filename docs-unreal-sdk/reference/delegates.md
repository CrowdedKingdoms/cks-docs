---
slug: delegates
sidebar_position: 3
title: Blueprint Delegates
description: "Every dynamic multicast delegate the SDK exposes to Blueprint, grouped by the class that owns it, with its signature type and the page that explains when it fires."
---

import SurfaceTable from '@site/src/components/SurfaceTable';

# Blueprint Delegates

A dynamic multicast delegate is what you bind with **Bind Event to** or **Assign** in Blueprint, or `AddDynamic` in C++. The table below lists the ones a game can bind, grouped by the owner class. It leaves out `UCrowdyConnectionMonitor::OnConnectionStateChanged`, because the SDK reconnects on its own. The voice ones are `OnVoiceMicStateChanged` and `OnVoiceSpeakerTalking` on `UCrowdySDKSubsystem`.

## When you come here

You have a delegate bound and want to know what its parameters mean, or you know roughly what you want to react to and want the class that fires it.

Every delegate below fires on the game thread. This is a constant fact about every dynamic multicast delegate the SDK broadcasts, never a per-delegate choice, so it is stated once here instead of as a column that would read the same value on every row: your handler runs like any other Blueprint event or `UFUNCTION`, with no thread-safety code of your own to write.

<SurfaceTable table="delegates" group="owner" />

:::note[OnConnectionStateChanged is not in the table.]
`UCrowdyConnectionMonitor::OnConnectionStateChanged` is not part of the documented path: the SDK reconnects on its own, and starting the monitor adds a second retry loop. Binding it to observe the connection state is safe; do not build retry logic on it. See [Connection and reconnect](../runtime/connection-and-reconnect.md).
:::

## Gotchas

- A delegate's owner class must be reachable before you can bind it: a game instance subsystem's delegate is safe to bind in a C++ Game Instance's `Init` after `Super::Init()`, and in Blueprint from the Game Mode's Event BeginPlay (the Game Instance's Event Init runs before the subsystems exist); a world subsystem's needs a valid world first.
- Binding twice fires your handler twice. Unbind (`Remove Dynamic` or `RemoveDynamic`) before a re-bind on a path that can run more than once, such as a widget that reconstructs.
- The voice delegates live on `UCrowdySDKSubsystem`, which stays alive across maps, so you bind them once and they keep firing after a map change. The earlier voice delegates (`OnAudioNotify`, `OnAudioDataGenerated`, `OnAudioDataReceived`, `OnStreamTimeout`) and the audio device monitor's two are gone. See [Voice chat](../services/voice-chat.md).

## Related

- [Subsystems](./subsystems.md)
- [Async actions](./async-actions.md)
- [Connection and reconnect](../runtime/connection-and-reconnect.md)
