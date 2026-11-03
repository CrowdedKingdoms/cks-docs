---
slug: voice-chat
sidebar_position: 4
title: Voice Chat
description: "Turn on the built-in voice channel: open your microphone, hear other players, set how far your voice reaches, see who is talking and what the microphone is doing, test with owner echo, send audio that is not the microphone, what changes across maps, devices and platforms, and why every player needs the same SDK version."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Voice Chat

Voice chat is a small, opt-in add-on. It opens your microphone, sends what you say over the SDK's own UDP transport, and plays back what other players send. The two-plane model does not apply here. There is no server truth for voice, only a live stream the server relays between clients and never stores.

## When you touch this

When your game wants live player-to-player audio next to its gameplay: push-to-talk, an always-on party channel, a "who is talking" indicator, or a quick check of a build's audio path with owner echo before anyone else connects.

:::caution[Every player needs this SDK version for voice.]
Voice uses the voice packet format shared with the CrowdyJS and CrowdyCPP SDKs: Opus audio in 20 ms frames, with reordering and loss concealment. Players on an earlier SDK version cannot hear players on this one, and the reverse. Update every client that should take part in voice. See [What's Changed](../guides/whats-changed.md#2026-10-30-sdk-v2220).
:::

## The nodes

Everything lives on the **Crowdy SDK Subsystem** (`UCrowdySDKSubsystem`, a Game Instance subsystem, category **Crowdy SDK > Voice**). There is no wrapper to write: get the subsystem and call it. Your module needs only `CrowdySDK` in its Build.cs.

| Blueprint | C++ | Does |
|---|---|---|
| **Start Voice Chat** | `StartVoiceChat()` | Opens your microphone and sends your voice while you speak. |
| **Stop Voice Chat** | `StopVoiceChat()` | Closes your microphone. Other players see you stop talking. |
| **Play Voice Chat** | `PlayVoiceChat()` | Lets you hear other players. |
| **Mute Voice Chat** | `MuteVoiceChat()` | Stops you hearing other players. |
| **Set Voice Chat Stream Timeout Threshold** | `SetVoiceChatStreamTimeoutThreshold(float InSeconds)` | How long a silent player's stream is kept before it is released. Default 2 seconds; the value is clamped to 0.5 seconds up to 1 hour. |
| **Toggle Owner Echo** | `ToggleOwnerEcho(bool bEnable)` | Plays your own voice back to you, as other players hear it. |
| **Set Voice Chat Distance** | `SetVoiceChatDistance(int32 Chunks)` | How far your voice reaches, in chunks around the chunk your pawn stands in: 0 to 8, default 8. |
| **Get Voice Chat Distance** | `GetVoiceChatDistance()` | The distance last set. |
| **Get Voice Mic State** | `GetVoiceMicState()` | What your microphone is doing right now. |
| **On Voice Mic State Changed** | `OnVoiceMicStateChanged` | Fires when that state changes. |
| **On Voice Speaker Talking** | `OnVoiceSpeakerTalking` | Fires when a player starts or stops talking. |

Sending and hearing are independent. You can send without listening, listen without sending, or do both. Other players' voices are muted until you call **Play Voice Chat**, so a game that wants to hear anyone calls it once, for example when it starts.

**Toggle Owner Echo** is a normal exec node: wire it into your graph like any other call. Earlier SDK versions never ran it from Blueprint.

## A push-to-talk toggle

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`StartTalking` and `StopTalking` bind to an Enhanced Input action's Started and Completed triggers in `SetupPlayerInputComponent`, using the same "fetch the game instance subsystem" pattern every page in this section uses. The microphone opens when the action starts and closes on release.

<CppSnippet id="voice-toggle" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Two custom events stand for the input action's Started and Completed pins. **OnTalkStarted** calls **Start Voice Chat**; **OnTalkCompleted** calls **Stop Voice Chat**. One **Crowdy SDK Subsystem** node feeds both calls.

<Blueprint src="voice-toggle" title="OnTalkStarted, Crowdy SDK Subsystem, Start Voice Chat, OnTalkCompleted, Stop Voice Chat" />

</TabItem>
</Tabs>

`StartTalking` and `StopTalking` also brighten and dim the `Torch` (`SetIntensity(8000.f)` / `SetIntensity(2000.f)`), so the example has a visible signal as well.

## Showing who is talking

**On Voice Speaker Talking** gives you two values: **Speaker Uuid**, the talking player's actor id as text, and **Talking**, true when that player starts and false when they stop. "Talking" means their voice rose above a silence gate. It ends about 0.3 seconds after they stop. A microphone that is open but quiet sends nothing, so it does not count as talking.

The event fires whether or not you called **Play Voice Chat**, so a talk indicator works even while you have others muted.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`WatchVoice` binds `OnVoiceSpeakerTalking` with `AddDynamic` to a `UFUNCTION` that takes the speaker id and the talking flag, then calls `PlayVoiceChat()`. The handler turns the torch green while a player talks and white when they stop.

<CppSnippet id="voice-notify" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Event BeginPlay binds a custom event, **OnSpeakerTalking** (with **SpeakerUuid** and **bTalking**), to **On Voice Speaker Talking** on the **Crowdy SDK Subsystem**, then calls **Play Voice Chat**. The custom event branches on **bTalking** and sets the **Torch** light color to green or white.

<Blueprint src="voice-notify" title="Event BeginPlay, Crowdy SDK Subsystem, Bind Event to On Voice Speaker Talking, Play Voice Chat, OnSpeakerTalking, Branch, Set Light Color" />

</TabItem>
</Tabs>

The example keeps no list of speakers, so with several people talking the torch follows whichever event arrived last. For a real roster, keep a set keyed by **Speaker Uuid** and add or remove on each event.

## How far your voice reaches

Your voice is addressed to the chunk your pawn stands in and reaches every player whose chunk is within the voice distance of it on each axis. The distance counts whole chunks: 0 is your own chunk only, and 8, the default, is the farthest the server relays. At the default chunk size of 1600 units, a distance of 1 is a 4800-unit square centred on your chunk. See [Recipients and routing](../runtime/recipients-and-routing.md) for how chunk rings work.

Set it once, for example when the player arrives. It is kept across map changes like the other voice settings.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`KeepVoiceNearby` sets the distance to one chunk when the player's pawn is assigned to this client.

<CppSnippet id="voice-distance" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Event BeginPlay calls **Set Voice Chat Distance** with **Chunks** set to 1.

<Blueprint src="voice-distance" title="Event BeginPlay, Crowdy SDK Subsystem, Set Voice Chat Distance" />

</TabItem>
</Tabs>

Nearby text has a distance of its own on every line; see [Nearby Text Chat](./nearby-text-chat.md).

## Reading the microphone

**Get Voice Mic State** returns one of five values, and **On Voice Mic State Changed** fires with the new one.

| State | Means |
|---|---|
| **Off** | Voice chat is not using the microphone. |
| **Starting** | The microphone is open and its first audio has not arrived yet. |
| **Capturing** | The microphone is live. This does not mean you are speaking; silence is not sent. |
| **No Device** | No microphone was found. Voice chat opens one as soon as it is available. |
| **Error** | The microphone could not be used, or this platform cannot capture audio. Check that it is connected and that the OS lets this app use it, then call **Start Voice Chat** again. |

A map change closes and reopens the microphone, so you see **Off** then **Starting** again. That is expected. A microphone that opens but delivers no audio for about three seconds goes to **Error**, with a log warning that points at the OS microphone permission. The usual cause is a denied permission.

## Confirming capture with owner echo

Call **Start Voice Chat**, then **Toggle Owner Echo** with Enable set to true, and speak. You should hear yourself, a little late: your voice goes to the server and comes back like any other player's. While echo is on, your own **Speaker Uuid** also shows up in **On Voice Speaker Talking**.

You need **Play Voice Chat** for this too, since echo is played like anyone else's voice.

:::caution[Turn owner echo back off once capture is confirmed.]
Leaving it on means the player hears their own microphone continuously, not just during the check. The setting carries across map changes, so it stays on until you turn it off.
:::

## What to expect

- **Your pawn places your voice.** Each frame is addressed to the chunk your pawn stands in when it is sent, so voice follows the player as they move. Between pawns, during a respawn or as a map ends, it stays where the pawn last stood in that map. Before the map's first pawn, it is addressed to the chunk last given to **Set Player Current Chunk Coordinates** on the game session, which is the origin chunk unless your game sets it. Frames are dropped until the connection is up and your player has an id.
- **Settings carry across maps.** Whether your microphone is on, play or mute, owner echo, the distance and the timeout all stay as you set them when the next map loads. You do not call anything again after a map change.
- **A missing microphone is not a failure.** The state reads **No Device**, and voice chat opens the microphone as soon as one is available. On Windows a newly connected microphone is noticed right away; elsewhere voice chat looks again every couple of seconds.
- **A changed default microphone restarts capture on Windows.** If the player unplugs a headset or picks another default device, voice chat reopens the microphone by itself.
- **Up to 16 speakers are heard at once.** A seventeenth speaker is not played until one of the others is released.
- **Received voice plays about 120 ms behind.** The delay absorbs uneven delivery, and it is on top of the network time.
- **Lost packets are concealed.** Short gaps are filled in rather than heard as clicks.

## Platforms

- **Windows:** full support, including the default-device watch above.
- **Mac:** a packaged game needs the `NSMicrophoneUsageDescription` key in its Info.plist. The engine's own editor Info.plist has it; the engine's Mac template for game targets (`Build/Mac/Resources/Info.Template.plist` in the engine) does not include `NSMicrophoneUsageDescription`. To add it, open **Project Settings > Platforms > Xcode Projects**, and under **Plist Files** press **Restore Info.plist to default** once. That copies the engine template into your project's `Build/Mac/Resources/` folder and points **Mac: Info.plist Template** at it. Then add the `NSMicrophoneUsageDescription` key to that file with a short sentence for the player, such as "This game uses the microphone for voice chat."
- **Linux:** the engine has no audio capture on Linux, so voice capture reports that it is not supported there: **Start Voice Chat** leaves the state at **Error** and logs a warning. The same happens in a build that runs with audio turned off.

## From C++ beyond the nodes

The nodes above are the normal way in, and the Crowdy SDK subsystem keeps your settings across maps. C++ code that wants the per-map voice object can use these instead.

`ECrowdyVoiceMicState` is the enum behind **Get Voice Mic State**: `Off`, `Starting`, `Capturing`, `NoDevice` (shown as **No Device**) and `Error`. Each means what the table under [Reading the microphone](#reading-the-microphone) says.

On `UCrowdySDKSubsystem` the two Blueprint events have delegate types you can bind from C++ with `AddDynamic`:

| Delegate type | Property | Parameters |
|---|---|---|
| `FOnVoiceMicStateChanged` | `OnVoiceMicStateChanged` | `ECrowdyVoiceMicState State` |
| `FOnVoiceSpeakerTalking` | `OnVoiceSpeakerTalking` | `FString SpeakerUuid`, `bool bTalking` |

`UVoiceChatSubsystem` is the voice chat of one map: a world subsystem, so `GetWorld()->GetSubsystem<UVoiceChatSubsystem>()` gives you the one for the current map, and it ends with the map. Its members:

| Member | Does |
|---|---|
| `GetMicState()` | The current `ECrowdyVoiceMicState`. |
| `IsCapturing()` | True while the state is `Capturing`. |
| `IsPlaying()` | True while other players' voices are being played, after `PlayVoiceChat()` and before `MuteVoiceChat()`. |
| `SetOwnerEcho(bool bEnable)` | Plays your own voice back to you, as **Toggle Owner Echo** does. |
| `SetDistance(int32 Chunks)`, `GetDistance()` | How far your voice reaches in this map, as **Set Voice Chat Distance** sets it for every map. |
| `FeedVoicePcm(TConstArrayView<int16> Samples)` | Sends 48 kHz mono samples as your voice, through the same silence gate, encoder and send path as the microphone. See [Sending audio that is not the microphone](#sending-audio-that-is-not-the-microphone). |
| `EndVoiceFeed()` | Ends the talk burst `FeedVoicePcm` started, so listeners see you stop talking. |
| `GetStats()` | Returns an `FCrowdyVoiceStats` of running counters for this map; see [Watching activity](#watching-activity). |
| `OnMicStateChanged` | Native multicast delegate (`FOnCrowdyVoiceMicStateChanged`) with the new `ECrowdyVoiceMicState`. Fires on the game thread, and also when the map ends with the microphone open. |
| `OnSpeakerTalking` | Native multicast delegate (`FOnCrowdyVoiceSpeakerTalking`) with the speaker's actor id as an `FString` and a `bool` for talking. Fires on the game thread. |

The native delegates are bound with `AddUObject` or `AddLambda`, not `AddDynamic`, and a binding on `UVoiceChatSubsystem` is gone when the map is. The subsystem's start, stop, play, mute and distance calls are better made through the nodes, so your settings carry to the next map.

### Sending audio that is not the microphone

`FeedVoicePcm` sends audio your code produces, such as a recorded line, a bot's voice or a test tone, exactly as the microphone's audio is sent. Give it 48 kHz mono 16-bit samples in real time: about 960 samples every 20 ms, for example one 20 ms frame per tick of a ticker. A larger push is cut into frames and sent at once, which a listener hears as a burst. Call `EndVoiceFeed` when the sound ends, so listeners see you stop talking.

The feed and the microphone share one stream, so `FeedVoicePcm` answers false and sends nothing while the microphone is starting or capturing, and **Start Voice Chat** ends a fed burst before it opens the microphone. It also answers false in a map with no voice chat. Silence below the gate is skipped, as it is from the microphone.

## Watching activity

The tool for troubleshooting is a console variable. `crowdy.voice.trace 1` turns on `LogCrowdyVoice` info logging for the microphone, playback and device changes. Warnings and errors are always on. Use it as a troubleshooting knob, not as a gameplay hook; for gameplay, bind **On Voice Speaker Talking** and **On Voice Mic State Changed**.

From C++, `UVoiceChatSubsystem::GetStats()` (a world subsystem, so `GetWorld()->GetSubsystem<UVoiceChatSubsystem>()`) returns running counters for the current map: packets sent, silent frames the gate skipped, packets received, frames played, frames concealed for loss, frames dropped because a speaker's playback was full, malformed packets, and the number of speakers heard right now. A debug overlay or a soak test can read them; they are not a Blueprint node.

## How the transport works

Your voice is cut into 20 ms frames, compressed with Opus, and sent as an ordinary audio message over the same UDP connection every other message uses, not a separate one. Frames go out only while you speak, and the last one of a burst tells listeners you stopped.

On the receiving side the SDK puts each player's packets back in order, decodes them, conceals lost frames, and plays them through a 2D audio component per speaker, so voice is not positional and needs no sound asset. The `CrowdyVoice` module holds all of this and is a public dependency of `CrowdySDK`, so you do not list it yourself. Apart from the members listed under [From C++ beyond the nodes](#from-c-beyond-the-nodes), the voice classes inside it are internal, and the nodes above are the supported way in.

## Gotchas

- Every player needs the same SDK version for voice. A mixed group splits into players who hear each other and players who hear nothing.
- Others are muted until **Play Voice Chat**. A game that never calls it hears nobody, though **On Voice Speaker Talking** still fires.
- **Capturing** means the microphone is live, not that the player is speaking.
- **Toggle Owner Echo** true is a one-time check, not a setting to leave on, and it survives map changes.
- **Set Voice Chat Stream Timeout Threshold** only affects how long a silent stream is kept; it does not mute or cut off active audio. A value outside 0.5 seconds to 1 hour is clamped and logged.
- **Set Voice Chat Distance** counts chunks from the chunk your pawn stands in, not units from the pawn, and a value outside 0 to 8 is clamped and logged.
- A player whose access tier lacks `use_voice_chat` has every voice packet refused. The refusal arrives late on the realtime subsystem's **On Send Refused**, with the message type 134; see [Connection and reconnect](../runtime/connection-and-reconnect.md).
- A packaged Mac game needs `NSMicrophoneUsageDescription` in its Info.plist, and the engine's Mac template does not include it.
- The old voice events `OnAudioNotify`, `OnAudioDataGenerated`, `OnAudioDataReceived` and `OnStreamTimeout` are gone. Use **On Voice Speaker Talking** for who is talking.

## Related

- [Authentication](./authentication.md): the subsystem-fetch pattern this page reuses.
- [Connection and reconnect](../runtime/connection-and-reconnect.md): the shared UDP transport voice rides on.
- [Troubleshooting](../guides/troubleshooting.md): the trace CVar pattern used above.
- [Blueprint Delegates](../reference/delegates.md): the two voice events in the delegate table.
