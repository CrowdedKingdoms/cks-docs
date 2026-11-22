---
slug: voice-chat
sidebar_position: 4
title: Voice Chat
description: "Turn on the built-in voice channel: open your microphone, hear other players, set how far your voice reaches, play it flat or spatial, talk to a channel's members, mute or turn down one player, see who is talking and what the microphone is doing, test with owner echo, send audio that is not the microphone, what changes across maps, devices and platforms, and why every player needs the same SDK version."
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
| **Set Voice Chat Distance** | `SetVoiceChatDistance(int32 Chunks)` | How far your voice reaches, in chunks around the chunk your pawn stands in: 0 to 8. It replaces every map's **Voice Distance** until **Reset Voice Chat Distance**. |
| **Reset Voice Chat Distance** | `ResetVoiceChatDistance()` | Goes back to the current map's **Voice Distance**, and follows each map's again from here on. |
| **Get Voice Chat Distance** | `GetVoiceChatDistance()` | The distance in use: the one you set, or else the map's **Voice Distance**. |
| **Set Voice Speaker Muted** | `SetVoiceSpeakerMuted(int64 UserId, bool bMuted)` | Stops you hearing one player, by user id. |
| **Is Voice Speaker Muted** | `IsVoiceSpeakerMuted(int64 UserId)` | Whether that player is muted. |
| **Set Voice Speaker Volume** | `SetVoiceSpeakerVolume(int64 UserId, float Volume)` | How loud one player is: 0 to 4, 1 is as received. |
| **Get Voice Speaker Volume** | `GetVoiceSpeakerVolume(int64 UserId)` | The volume set for that player. |
| **Get Voice Speaker User Id** | `GetVoiceSpeakerUserId(const FString& SpeakerUuid)` | The user id behind a **Speaker Uuid**, or 0 until it is known. |
| **Get Voice Mic State** | `GetVoiceMicState()` | What your microphone is doing right now. |
| **On Voice Mic State Changed** | `OnVoiceMicStateChanged` | Fires when that state changes. |
| **On Voice Speaker Talking** | `OnVoiceSpeakerTalking` | Fires when a player starts or stops talking to the players near them. Channel voice has its own, see [Talk to a channel](#talk-to-a-channel). |

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

Your voice is addressed to the chunk your pawn stands in and reaches every player whose chunk is within the voice distance of it on each axis. The distance counts whole chunks: 0 is your own chunk only, and 8 is the farthest the server relays. At the default chunk size of 1600 units, a distance of 1 is a 4800-unit square centred on your chunk. See [Recipients and routing](../runtime/recipients-and-routing.md) for how chunk rings work.

Each map decides it with the **Voice Distance** of its [map profile](../runtime/map-profile.md), One Chunk unless the profile says otherwise. **Set Voice Chat Distance** replaces that on every map, for example when the player arrives, and it is kept across map changes until **Reset Voice Chat Distance** goes back to the current map's. Keep the map's **Movement Distance** at least as large as the voice distance in use: a player whose movement does not reach a listener is heard with no copy of them there.

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

Nearby text has a distance of its own on every line; see [Nearby Text Chat](./nearby-text-chat.md). Who a player hears and who hears them is theirs to choose; see [Player Safety](./player-safety.md).

## Flat or spatial playback

By default every voice plays flat (2D), at the volume it was sent. Open **Project Settings > Plugins > Crowdy Voice** (`UCrowdyVoiceDeveloperSettings`) to change that. The settings are read when a map's voice chat starts, so a change takes effect on the next map.

| Setting | Default | Does |
|---|---|---|
| **Playback Mode** (`PlaybackMode`, an `ECrowdyVoicePlaybackMode`) | Flat (2D) | **Spatial (3D)** plays each voice from where its speaker's character is drawn on this client, every frame, on the actor pool and on Mass crowd rows. |
| **Max Speakers** (`MaxSpeakers`) | 16 | How many players are heard at once, 1 to 64. See [The nearest speakers are heard](#the-nearest-speakers-are-heard). |
| **Attenuation** (`Attenuation`) | `SA_CrowdyVoice` | Spatial only. How a voice fades, pans and muffles. The SDK's `/CrowdySDK/Data/Voice/SA_CrowdyVoice` follows real hearing: full volume within 2 m, then 6 dB quieter each time the distance doubles, eased to silence by 40 m; duller with distance; a little quieter behind you; muffled and half as loud behind a wall (anything that blocks the Visibility channel); binaural where your project has a spatialization plugin. Pick your own **Sound Attenuation** asset to change it. |
| **Occlusion Checks Per Second** (`OcclusionChecksPerSecond`) | 10 | Spatial only, where the attenuation muffles voices behind walls: how often each heard voice traces for a wall, 1 to 30. One trace each time, off the game thread. |
| **Playout Delay** (`PlayoutDelayMs`) | 120 ms | How far behind received voice plays, 40 to 400 ms. A longer delay absorbs more uneven delivery. |
| **Silence Gate** (`SilenceGateDb`) | -50 dB | Below this level your microphone sends nothing, -90 to -10 dB. |
| **Silence Hold** (`SilenceHoldMs`) | 300 ms | How long the gate stays open after your voice drops below it, 20 to 2000 ms. |
| **Bit Rate (bits per second)** (`BitrateBps`) | 24000 | Bits per second of the sent voice, 6000 to 64000. |

When this client has no copy of the speaker, the voice plays from the centre of the chunk it was sent from, up to about 14 m off at the default chunk size. That happens for a player outside the map's **Movement Distance** but inside their voice range, and for a moment before a new player's copy appears; the voice moves to the copy once it exists. Keep **Movement Distance** at least as large as **Voice Distance** (the defaults, 8 and 1, already are) so you see whoever you hear.

## The nearest speakers are heard

At most **Max Speakers** players are heard at once. When every place is taken, a new speaker takes one only if they are at most 90% as far away as the farthest speaker heard, and that speaker is dropped once the newcomer's voice is ready to play. Two speakers at a similar distance do not trade places. Distance is to where your client draws the speaker, so a speaker it does not draw counts as farthest and never takes the place of a player you can see. A speaker who falls silent frees their place after the stream timeout.

## Talk to a channel

Your voice can go to the members of a [channel](../runtime/channels.md) wherever they are, in addition to the players near you or instead of them. These nodes are on the **Crowdy SDK Subsystem** like the rest.

| Blueprint | C++ | Does |
|---|---|---|
| **Start Channel Voice** (Channel Id, Mode) | `StartChannelVoice(int64 ChannelId, ECrowdyChannelVoiceMode Mode = Talk)` | Joins that channel's voice: you hear its members. In **Talk** mode (the default) they hear you while **Start Voice Chat** has your microphone open; in **Listen** mode you send nothing, as an audience does. Call it once per channel. |
| **Set Channel Voice Mode** (Channel Id, Mode) | `SetChannelVoiceMode(int64 ChannelId, ECrowdyChannelVoiceMode Mode)` | Switches a joined channel between **Listen** and **Talk**, as when a listener is given the floor. |
| **Get Channel Voice Mode** (Channel Id) | `GetChannelVoiceMode(int64 ChannelId)` | The channel's mode now; **Listen** for a channel you have not joined. |
| **Stop Channel Voice** (Channel Id) | `StopChannelVoice(int64 ChannelId)` | Leaves that channel's voice: you stop hearing it and sending to it. |
| **Is Channel Voice On** (Channel Id) | `IsChannelVoiceOn(int64 ChannelId)` | Whether you joined that channel's voice. |
| **Set Spatial Voice Enabled** (Enabled) | `SetSpatialVoiceEnabled(bool bEnabled)` | On by default. Off sends your voice only to the channels you joined in **Talk** mode, not to the players near you. |
| **Is Spatial Voice Enabled** | `IsSpatialVoiceEnabled()` | Whether the players near you hear you. |
| **Set Voice Channel Muted** (Channel Id, Muted) | `SetVoiceChannelMuted(int64 ChannelId, bool bMuted)` | Stops you hearing that channel. |
| **Is Voice Channel Muted** (Channel Id) | `IsVoiceChannelMuted(int64 ChannelId)` | Whether that channel is muted. |
| **Set Voice Channel Volume** (Channel Id, Volume) | `SetVoiceChannelVolume(int64 ChannelId, float Volume)` | How loud that channel is: 0 is silent, 1 is as received, up to 4. It multiplies the speaker's own volume from **Set Voice Speaker Volume**. |
| **Get Voice Channel Volume** (Channel Id) | `GetVoiceChannelVolume(int64 ChannelId)` | The volume set for that channel. |
| **On Voice Channel Speaker Talking** | `OnVoiceChannelSpeakerTalking` (`int64 ChannelId`, `FString SpeakerUuid`, `bool bTalking`) | Fires with **Channel Id**, **Speaker Uuid** and **Talking** when a member starts or stops talking on a channel. |

All of these carry over across map changes, like the other voice settings; when another account signs in on the same game instance, it starts with no channel's voice joined. **On Voice Speaker Talking** fires for spatial voice only; bind **On Voice Channel Speaker Talking** for channels.

**Join to hear.** Being a member of a channel is not enough to hear its voice: every member who should hear it calls **Start Channel Voice**. Members who may not talk there (an audience, a channel made without **Members Can Speak**) join in **Listen** mode; in **Talk** mode the server refuses every packet they send, about 50 a second while their microphone is open, and the log fills with the refusals. A channel whose voice you have not joined is never played. This matters because every player is a member of channels the SDK uses for its own messages. Call **Stop Channel Voice** when the player leaves the channel; until then the SDK keeps sending to it, and the server refuses each packet.

**Who may talk.** The server drops channel voice from a member who is not allowed to send it. The member's role in the channel needs the **Send Voice** permission, and the player needs voice chat allowed. **Create Channel** has a **Members Can Speak** input (off by default) that gives the default member role **Send Voice**; without it only roles you grant it to can talk. Hearing a channel needs only membership. The server does not send your own channel voice back to you. See [Channels](../runtime/channels.md#let-members-speak).

**How it plays.** Channel voice always plays flat (2D), whatever **Playback Mode** says. It takes speaker places like spatial voice, up to **Max Speakers**. A channel speaker whose player is known ranks ahead of every spatial speaker, so a nearer spatial speaker never displaces them. Their player is known usually a moment after they first speak; until then, and for an actor id that belongs to no known player, they rank behind every spatial speaker, so made-up ids cannot hold places. With every place taken by nearby speakers, a party member's first words can be lost while that happens. A player you muted with **Set Voice Speaker Muted** is muted on channels too. Each channel a player talks on is its own stream, so a player who talks on two channels is heard on both, once each.

**You can hear someone twice.** A listener who shares a channel with a speaker standing nearby hears that speaker spatially and on the channel. This is deliberate, and it is how CrowdyJS behaves. If your game does not want it, the speaker can turn spatial voice off with **Set Spatial Voice Enabled** while talking on the channel (then nobody near them hears them spatially), or a listener can mute the channel with **Set Voice Channel Muted**.

**A known limit.** The server does not yet check that channel voice comes from the player whose actor id it carries, so a member who may talk on a channel can send voice that claims to be another player's. Such voice is heard, shown in talking events and muted as that player, so muting the voice you hear mutes the player it claims to be and does not stop it; muting the channel does. It reaches only listeners who joined that channel's voice.

**What it costs.** One 20 ms frame is encoded once and sent once for each channel you talk on, plus once spatially. Every channel you add is another packet per frame, and channel delivery is billed per member. Talking on more than about three channels at once can hide the server's refusals from the log: the connection numbers its sends with one byte, and past about 256 sends a second it can no longer tell which send a refusal is about.

## Mute or turn down one player

The mute and volume nodes take a **User Id**, not an actor id, so they hold through that player's next sign-in, which gives them a new actor id, and across map changes. To act on a player who is talking, turn their **Speaker Uuid** into a user id first.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

Bind `OnVoiceSpeakerTalking`. In the handler, call `GetVoiceSpeakerUserId(SpeakerUuid)`; when it returns a non-zero id, call `SetVoiceSpeakerMuted(UserId, true)`.

</TabItem>
<TabItem value="bp" label="Blueprint">

**On Voice Speaker Talking** gives **Speaker Uuid**. Wire it into **Get Voice Speaker User Id** on the **Crowdy SDK Subsystem**, then wire that user id into **Set Voice Speaker Muted** with **Muted** set to true.

</TabItem>
</Tabs>

**Get Voice Speaker User Id** answers 0 until the user is known, usually a moment after they first speak, and 0 for a speaker not heard on this map in the last minute, so check for 0 before you use it. A lookup that finds no user is tried again every 10 seconds. A muted player's voice is not decoded and takes no speaker place. While anyone is muted, a new speaker is held silent for up to 1.5 seconds until their user is known, so a muted player is not heard for a moment after they sign in again. Muting is yours to offer; blocking, which the platform enforces, is stronger and is covered in [Player Safety](./player-safety.md#what-a-block-covers).

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

:::note[Realtime servers from v0.48.0 send your own voice back only when the plugin asks.]
The servers no longer return a speaker's own voice by default, which saves the data out that copy cost. The plugin needs a release that asks while owner echo is on; until you have one, **Toggle Owner Echo** plays nothing on those servers. The [changelog](/releases/intro) says which release asks.
:::

:::caution[Turn owner echo back off once capture is confirmed.]
Leaving it on means the player hears their own microphone continuously, not just during the check. The setting carries across map changes, so it stays on until you turn it off.
:::

## What to expect

- **Your pawn places your voice.** Each frame is addressed to the chunk your pawn stands in when it is sent, so voice follows the player as they move. Between pawns, during a respawn or as a map ends, it stays where the pawn last stood in that map. Before the map's first pawn, it is addressed to the chunk last given to **Set Player Current Chunk Coordinates** on the game session, which is the origin chunk unless your game sets it. Frames are dropped until the connection is up and your player has an id.
- **Settings carry across maps.** Whether your microphone is on, play or mute, owner echo and the timeout stay as you set them when the next map loads, and so does a distance you set with **Set Voice Chat Distance**. A distance you never set follows each map's **Voice Distance** instead. You do not call anything again after a map change.
- **A missing microphone is not a failure.** The state reads **No Device**, and voice chat opens the microphone as soon as one is available. On Windows a newly connected microphone is noticed right away; elsewhere voice chat looks again every couple of seconds.
- **A changed default microphone restarts capture on Windows.** If the player unplugs a headset or picks another default device, voice chat reopens the microphone by itself.
- **The nearest speakers are heard.** Up to **Max Speakers** (16 by default); a farther speaker is not played while every place is taken.
- **Received voice plays 120 ms behind by default.** **Playout Delay** sets it. The delay absorbs uneven delivery, and it is on top of the network time.
- **Lost packets are concealed.** Short gaps are filled in rather than heard as clicks.

## Platforms

- **Windows:** full support, including the default-device watch above.
- **Mac:** a packaged game needs the `NSMicrophoneUsageDescription` key in its Info.plist. The engine's own editor Info.plist has it; the engine's Mac template for game targets (`Build/Mac/Resources/Info.Template.plist` in the engine) does not include `NSMicrophoneUsageDescription`. To add it, open **Project Settings > Platforms > Xcode Projects**, and under **Plist Files** press **Restore Info.plist to default** once. That copies the engine template into your project's `Build/Mac/Resources/` folder and points **Mac: Info.plist Template** at it. Then add the `NSMicrophoneUsageDescription` key to that file with a short sentence for the player, such as "This game uses the microphone for voice chat."
- **Linux:** the engine has no audio capture on Linux, so voice capture reports that it is not supported there: **Start Voice Chat** leaves the state at **Error** and logs a warning. The same happens in a build that runs with audio turned off.

## From C++ beyond the nodes

The nodes above are the normal way in, and the Crowdy SDK subsystem keeps your settings across maps. C++ code that wants the per-map voice object can use these instead.

`ECrowdyVoiceMicState` is the enum behind **Get Voice Mic State**: `Off`, `Starting`, `Capturing`, `NoDevice` (shown as **No Device**) and `Error`. Each means what the table under [Reading the microphone](#reading-the-microphone) says.

On `UCrowdySDKSubsystem` the Blueprint events have delegate types you can bind from C++ with `AddDynamic`:

| Delegate type | Property | Parameters |
|---|---|---|
| `FOnVoiceMicStateChanged` | `OnVoiceMicStateChanged` | `ECrowdyVoiceMicState State` |
| `FOnVoiceSpeakerTalking` | `OnVoiceSpeakerTalking` | `FString SpeakerUuid`, `bool bTalking` |
| `FOnVoiceChannelSpeakerTalking` | `OnVoiceChannelSpeakerTalking` | `int64 ChannelId`, `FString SpeakerUuid`, `bool bTalking` |

`UVoiceChatSubsystem` is the voice chat of one map: a world subsystem, so `GetWorld()->GetSubsystem<UVoiceChatSubsystem>()` gives you the one for the current map, and it ends with the map. Its members:

| Member | Does |
|---|---|
| `GetMicState()` | The current `ECrowdyVoiceMicState`. |
| `IsCapturing()` | True while the state is `Capturing`. |
| `IsPlaying()` | True while other players' voices are being played, after `PlayVoiceChat()` and before `MuteVoiceChat()`. |
| `SetOwnerEcho(bool bEnable)` | Plays your own voice back to you, as **Toggle Owner Echo** does. |
| `SetDistance(int32 Chunks)`, `GetDistance()` | How far your voice reaches in this map: the map's **Voice Distance** until set. **Set Voice Chat Distance** sets it for every map. |
| `SetUserMuted`, `IsUserMuted`, `SetUserVolume`, `GetUserVolume`, `GetSpeakerUserId` | One player's mute and volume by user id in this map, as the **Set Voice Speaker** nodes set them for every map. |
| `SetChannelVoice(int64 ChannelId, bool bOn, ECrowdyChannelVoiceMode Mode)`, `GetChannelVoiceMode`, `SetSpatialVoiceEnabled`, `SetChannelMuted`, `IsChannelMuted`, `SetChannelVolume`, `GetChannelVolume` | Channel voice in this map, as the nodes under [Talk to a channel](#talk-to-a-channel) set it for every map. |
| `FeedVoicePcm(TConstArrayView<int16> Samples)` | Sends 48 kHz mono samples as your voice, through the same silence gate, encoder and send path as the microphone. See [Sending audio that is not the microphone](#sending-audio-that-is-not-the-microphone). |
| `EndVoiceFeed()` | Ends the talk burst `FeedVoicePcm` started, so listeners see you stop talking. |
| `GetStats()` | Returns an `FCrowdyVoiceStats` of running counters for this map; see [Watching activity](#watching-activity). |
| `OnMicStateChanged` | Native multicast delegate (`FOnCrowdyVoiceMicStateChanged`) with the new `ECrowdyVoiceMicState`. Fires on the game thread, and also when the map ends with the microphone open. |
| `OnSpeakerTalking` | Native multicast delegate (`FOnCrowdyVoiceSpeakerTalking`) with the speaker's actor id as an `FString` and a `bool` for talking. Fires on the game thread, for spatial voice only. |
| `OnChannelSpeakerTalking` | Native multicast delegate (`FOnCrowdyChannelVoiceTalking`) with the channel id, the speaker's actor id and a `bool` for talking. Fires on the game thread. |

The native delegates are bound with `AddUObject` or `AddLambda`, not `AddDynamic`, and a binding on `UVoiceChatSubsystem` is gone when the map is. The subsystem's start, stop, play, mute, distance, player and channel calls are better made through the nodes, so your settings carry to the next map.

### Sending audio that is not the microphone

`FeedVoicePcm` sends audio your code produces, such as a recorded line, a bot's voice or a test tone, exactly as the microphone's audio is sent. Give it 48 kHz mono 16-bit samples in real time: about 960 samples every 20 ms, for example one 20 ms frame per tick of a ticker. A larger push is cut into frames and sent at once, which a listener hears as a burst. Call `EndVoiceFeed` when the sound ends, so listeners see you stop talking.

The feed and the microphone share one stream, so `FeedVoicePcm` answers false and sends nothing while the microphone is starting or capturing, and **Start Voice Chat** ends a fed burst before it opens the microphone. It also answers false in a map with no voice chat. Silence below the gate is skipped, as it is from the microphone.

## Watching activity

The tool for troubleshooting is a console variable. `crowdy.voice.trace 1` turns on `LogCrowdyVoice` info logging for the microphone, playback and device changes. Warnings and errors are always on. Use it as a troubleshooting knob, not as a gameplay hook; for gameplay, bind **On Voice Speaker Talking** and **On Voice Mic State Changed**.

From C++, `UVoiceChatSubsystem::GetStats()` (a world subsystem, so `GetWorld()->GetSubsystem<UVoiceChatSubsystem>()`) returns running counters for the current map: packets sent, silent frames the gate skipped, packets received, frames played, frames concealed for loss, frames dropped because a speaker's playback was full, malformed packets, packets from speakers beyond **Max Speakers** (`PacketsOverCap`), speakers displaced by a nearer one (`SpeakersDisplaced`), packets from muted players and channels, or held while a new speaker's user is looked up (`PacketsMuted`), channel voice packets sent and received (`ChannelPacketsSent`, `ChannelPacketsReceived`) and those from a channel whose voice you have not joined (`ChannelPacketsIgnored`), and the number of speakers heard right now. A debug overlay or a soak test can read them; they are not a Blueprint node.

## How the transport works

Your voice is cut into 20 ms frames, compressed with Opus, and sent as an ordinary audio message over the same UDP connection every other message uses, not a separate one. Frames go out only while you speak, and the last one of a burst tells listeners you stopped.

On the receiving side the SDK puts each player's packets back in order, decodes them, conceals lost frames, and plays each speaker through an audio component, flat or spatial as set under [Flat or spatial playback](#flat-or-spatial-playback). Flat playback needs no sound asset. The `CrowdyVoice` module holds all of this and is a public dependency of `CrowdySDK`, so you do not list it yourself. Apart from the members listed under [From C++ beyond the nodes](#from-c-beyond-the-nodes), the voice classes inside it are internal, and the nodes above are the supported way in.

## Gotchas

- Every player needs the same SDK version for voice. A mixed group splits into players who hear each other and players who hear nothing.
- Others are muted until **Play Voice Chat**. A game that never calls it hears nobody, though **On Voice Speaker Talking** still fires.
- **Capturing** means the microphone is live, not that the player is speaking.
- **Toggle Owner Echo** true is a one-time check, not a setting to leave on, and it survives map changes.
- **Set Voice Chat Stream Timeout Threshold** only affects how long a silent stream is kept; it does not mute or cut off active audio. A value outside 0.5 seconds to 1 hour is clamped and logged.
- **Set Voice Chat Distance** counts chunks from the chunk your pawn stands in, not units from the pawn, and a value outside 0 to 8 is clamped and logged. It overrides every map's **Voice Distance** until **Reset Voice Chat Distance**.
- Voice reaches one chunk unless the map profile or **Set Voice Chat Distance** says otherwise. It used to reach 8.
- A player whose access tier lacks `use_voice_chat` has every voice packet refused. The refusal arrives late on the realtime subsystem's **On Send Refused**, with the message type 134; see [Connection and reconnect](../runtime/connection-and-reconnect.md).
- A packaged Mac game needs `NSMicrophoneUsageDescription` in its Info.plist, and the engine's Mac template does not include it.
- Spatial voice follows the speaker's drawn character. With no copy of them on this client it plays from the centre of the chunk it was sent from, so keep **Movement Distance** at least as large as **Voice Distance**.
- Channel voice needs the **Send Voice** permission on the sender's role, and the server drops it without. Create the channel with **Members Can Speak** on, or grant the role.
- Only the nearest **Max Speakers** are heard; with the default of 16, the 17th-nearest speaker is silent.
- The mute and volume nodes take a user id. **Get Voice Speaker User Id** answers 0 until the user is known. While anyone is muted, a new speaker is held silent for up to 1.5 seconds until their user is known.
- The old voice events `OnAudioNotify`, `OnAudioDataGenerated`, `OnAudioDataReceived` and `OnStreamTimeout` are gone. Use **On Voice Speaker Talking** for who is talking.

## Related

- [Authentication](./authentication.md): the subsystem-fetch pattern this page reuses.
- [Connection and reconnect](../runtime/connection-and-reconnect.md): the shared UDP transport voice rides on.
- [Troubleshooting](../guides/troubleshooting.md): the trace CVar pattern used above.
- [Blueprint Delegates](../reference/delegates.md): the two voice events in the delegate table.
