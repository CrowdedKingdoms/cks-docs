---
slug: voice-chat
sidebar_position: 4
title: Voice Chat
description: "Turn on the built-in voice channel: capture your microphone, send it over the SDK's own transport with Opus, play back other players, the owner-echo check, the Windows-only device watch, and which module you list to reach the voice subsystem from C++."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Voice Chat

Voice chat is a thin, opt-in add-on: capture your microphone, encode it, send it over the SDK's own UDP transport, decode and play back what other players send. The two-plane model does not apply here. There is no server truth for voice, only a live stream the server relays between clients and never stores.

## When you touch this

When your game wants live player-to-player audio alongside its gameplay: push-to-talk, an always-on party channel, or a quick way to confirm a build's audio path with owner echo before anyone else connects.

## The functions

All six live on `UCrowdySDKSubsystem` (Game Instance subsystem, module CrowdySDK, category **CrowdySDK > Communication**). There is no separate wrapper to write: get the subsystem and call them. They need only `CrowdySDK` in your module's Build.cs; you list `CrowdyVoice` only to reach the voice classes directly, below.

| Call | Does |
|---|---|
| `StartVoiceChat()` | Begins capturing your microphone. |
| `StopVoiceChat()` | Stops capturing. |
| `PlayVoiceChat()` | Enables local playback of other players. |
| `MuteVoiceChat()` | Disables local playback. |
| `SetVoiceChatStreamTimeoutThreshold(float InSeconds)` | How long a silent remote stream is kept before it is dropped. |
| `ToggleOwnerEcho(bool bEnable)` | Loops your own captured audio back to you, for confirming capture without a second client. |

Capture and playback are independent: you can send without listening, listen without sending, or both. Internally all six forward to `UVoiceChatSubsystem` and `FVoiceChatService`. Neither is exposed to Blueprint; from C++ `UVoiceChatSubsystem` is a world subsystem in the `CrowdyVoice` module, so you reach it only if your Build.cs lists `CrowdyVoice`, and the six calls above are the supported way in.

## A push-to-talk toggle

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`StartTalking` and `StopTalking` bind to an Enhanced Input action's Started and Completed triggers in `SetupPlayerInputComponent`, the same "fetch the game instance subsystem" pattern every page in this section uses: capture starts while the action is held and stops on release.

<CppSnippet id="voice-toggle" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Two custom events stand for the input action's Started and Completed pins. **OnTalkStarted** calls **Start Voice Chat**; **OnTalkCompleted** calls **Stop Voice Chat**; one **Crowdy SDK Subsystem** node feeds both calls.

<Blueprint src="voice-toggle" title="OnTalkStarted, Crowdy SDK Subsystem, Start Voice Chat, OnTalkCompleted, Stop Voice Chat" />

</TabItem>
</Tabs>

`StartTalking` and `StopTalking` also brighten and dim the `Torch` (`SetIntensity(8000.f)` /
`SetIntensity(2000.f)`), so the example has a visible signal beyond the console trace described below.

## Confirming capture with owner echo

Turn on owner echo, speak, and you should hear yourself:

```cpp
Voice->StartVoiceChat();
Voice->ToggleOwnerEcho(true);
```

:::caution[Turn owner echo back off once capture is confirmed.]
Leaving `ToggleOwnerEcho(true)` on means the player hears their own microphone continuously, not just during the check.
:::

## Watching activity

There is no Blueprint event for incoming voice, so nothing to show in a graph; the tool is a console variable. `crowdy.voice.trace 1` (read in code through `CrowdyVoiceTrace::Voice`) gates `LogCrowdyVoice` info logging for the voice subsystem, the capture and playback service, and the device monitor. Use it as a troubleshooting knob, not as a gameplay hook.

## The device monitor (Windows only)

The SDK spawns an audio device monitor for its own use when the voice subsystem starts. It watches audio devices connect and disconnect on Windows only; on every other platform it logs "Audio device monitoring is only supported on Windows" and does nothing. It is a private class with nothing for a game to call or bind.

## Reaching the voice subsystem from C++

`UVoiceChatSubsystem` is not exposed to Blueprint. From C++ it is an ordinary world subsystem: add `CrowdyVoice` to your module's `PublicDependencyModuleNames` and call `GetWorld()->GetSubsystem<UVoiceChatSubsystem>()`. `IsCapturing()` is true only while the capture device stream is open and delivering samples, so a `StartVoiceChat()` that found no microphone reads false.

It declares four delegates: `OnAudioNotify` (`FAudioNotify`, no parameters), `OnAudioDataGenerated` (`FOnAudioDataGenerated`), `OnAudioDataReceived` (`FOnAudioDataReceived`), and `OnStreamTimeout` (`FOnStreamTimeout`). Only `OnAudioNotify` fires, once per decoded incoming voice frame from any remote player; bind it with `AddDynamic` to a `UFUNCTION` with no parameters. The other three are declared and never broadcast in the current build.

:::caution[This is not a supported binding surface.]
`OnAudioNotify` is the one voice delegate that fires; the other three never do, and none carries a player id or the audio itself. Treat a bind on it as a talk indicator at most, and the trace CVar above as the observation tool.
:::

## How the transport works

Captured audio is compressed with Opus (`FVoiceChatService` owns the encoder and decoder pair, one decoder per remote player) and sent as an ordinary `FClientAudioPacketMessageRequest` over the same UDP channel every other RPC uses, not a separate connection. The service decodes each incoming frame and hands the samples to a per-player playback buffer, `FAudioChatTrack`, which is why device output uses a procedural sound wave rather than a fixed asset.

The `CrowdyVoice` module links `AudioCapture`, `AudioCaptureCore`, `AudioMixer`, and `Voice` purely to read the local microphone. A project that only plays back other players and never calls `StartVoiceChat()` does not need capture hardware access, though `UCrowdySDKSubsystem` always depends on `CrowdyVoice` since the six calls live there regardless.

## Gotchas

- Voice is relayed live like any other RPC; the server stores nothing, so there is no truth to check against Game Models.
- The six calls need only `CrowdySDK` in Build.cs; `UVoiceChatSubsystem` needs `CrowdyVoice`, and of its four delegates only `OnAudioNotify` fires.
- The device monitor is the SDK's own; it does something on Windows only and exposes nothing to a game.
- `ToggleOwnerEcho(true)` is a one-time check, not a setting to leave on.
- `SetVoiceChatStreamTimeoutThreshold` only affects how long a silent stream is kept; it does not mute or drop active audio.

## Related

- [Authentication](./authentication.md): the subsystem-fetch pattern this page reuses.
- [Connection and reconnect](../runtime/connection-and-reconnect.md): the shared UDP transport voice rides on.
- [Troubleshooting](../guides/troubleshooting.md): the trace CVar pattern used above.
