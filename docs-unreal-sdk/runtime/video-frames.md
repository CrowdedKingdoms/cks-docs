---
slug: video-frames
sidebar_position: 18
title: Video Frames
description: "Send your player's camera frames as encoded JPEG images, and receive other players' frames as whole encoded images: bind once, read the bytes, tell senders apart by the exact id, and decode them yourself."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Video Frames

Video here means encoded still images sent as a stream. `UCrowdyVideoSender` sends one frame you give it to the players near your pawn. `UCrowdyVideoFrameReceiver` turns the video fragments the server fans out into whole frames and hands each one to you once, as an encoded image. The SDK does not capture a camera, does not encode, does not decode, does not know a frame's dimensions, and has not checked that received bytes are a valid image. Capturing and encoding a frame, and turning a received one into a texture, is your code.

Other clients on the same app, such as a browser on the JavaScript SDK ([Webcam video](/crowdyjs/webcam-video)), send and receive the same frames. Unreal players can show JPEG only: the receiver delivers WebP frames, but this SDK does not decode WebP. Send WebP only to clients that can show it.

## When you need it

A picture-in-picture of a nearby player, a video wall in the village square, any feature that shows another client's camera, or a camera the player shares with the people around them. If the game never shows video it pays for none of this: nothing is sent unless you call the sender, and with no listener bound a received fragment is dropped the moment it reaches the receiver, with no copy and no partial frame held.

## Send a frame

`UCrowdyVideoSender` is a game instance subsystem. You capture the image and encode it as JPEG; the SDK splits it into datagrams, sends it from the local player's actor at the chunk the pawn stands in, and every receiver reassembles it. It reaches every player within `Distance` chunks who holds `use_video_chat` in the app and whose Video Receive setting and blocks admit you, CrowdyJS and CrowdyCPP players included, and your own client does not get it back. A receiver who does not qualify gets nothing, and the sender is not told.

| Blueprint | C++ | Does |
|---|---|---|
| **Send Video Frame** | `SendVideoFrame(Frame, Codec, Distance)` | Sends one whole encoded image. **Codec** defaults to **Jpeg** and **Distance** to 1. Returns an `FCrowdyVideoFrameSend`. |
| **Describe Video Send Result** | `DescribeVideoSendResult(Result)` | The result in words, for a log or a screen. |
| **On Video Send Refused** | `OnVideoSendRefused` (`FOnCrowdyVideoSendRefused`) | Fires with an `FCrowdySendRefusal` when the server refuses one of your frames. |

`FCrowdyVideoFrameSend` holds `Result` (an `ECrowdyVideoSendResult`), `FrameId`, `Fragments` and `Message`. `FrameId` and `Fragments` mean something only when `Result` is **Sent**; `Message` says why a frame was not sent and is empty when it was.

The lantern village's player character sends a frame with `SendVideoFrameNearby`, which takes a JPEG your code produced, turns the torch white when the result is **Sent** and red when it is anything else, and turns it red again if the server later refuses a frame.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="video-send" />

</TabItem>
<TabItem value="bp" label="Blueprint">


A custom event `SendVideoFrameNearby` with a `Jpeg` byte array calls **Send Video Frame** on a **Crowdy Video Sender** getter node, breaks the returned struct with **Break Crowdy Video Frame Send**, and branches on whether `Result` is **Sent** to set the torch white or red.

<Blueprint src="video-send" title="SendVideoFrameNearby, Crowdy Video Sender, Send Video Frame, Break Crowdy Video Frame Send, ==, Branch, Get Torch, Set Light Color, Set Light Color" />

Once, at **Event BeginPlay**, bind **On Video Send Refused** to a custom event `OnVideoRefused`, which turns the torch red.

<Blueprint src="video-send-refused" title="Event BeginPlay, Crowdy Video Sender, Bind Event to On Video Send Refused, OnVideoRefused, Get Torch, Set Light Color" />

</TabItem>
</Tabs>

| Result | Means |
|---|---|
| **Sent** | The frame left this client. There is no delivery receipt; a refusal arrives later on **On Video Send Refused**. |
| **Not Connected** | No realtime connection yet, or it has closed. |
| **No Local Player** | The player has no actor id yet, or no local pawn to place the frame at. |
| **Empty** | The byte array has nothing in it. |
| **Too Large** | The frame is larger than 17,872 bytes (16 fragments of 1,117 bytes). |
| **Queue Full** | The outbound queue had no room for every fragment, or the connection refused the frame. |
| **Codec Not Sent** | Only JPEG and WebP frames can be sent. |

`Distance` is clamped to 0 through 8 chunks. Each sender counts its own frame ids, which wrap at 65535 and start from a value taken from the clock, so a client that restarts does not reuse ids the receivers just saw. An id is spent once the frame reaches the connection, even if the connection then refuses it. The earlier checks spend none.

**Keep it small.** The server fans a frame out to every player in range, so cost grows with the crowd. Keep `Distance` at 0 or 1, send no more than 10 frames a second, and keep each frame under about 8 KB (a small image at a JPEG quality near 0.5). The figures behind this are in [Webcam video](/crowdyjs/webcam-video).

:::warning[The player's access tier and Video Send setting must allow video.]
A frame is refused by the server when the player's access tier lacks `use_video_chat`, for the app or for the grid covering the chunk, or when the player's Video Send setting is Off, which is the default for a minor without a parent's consent. The call still answers **Sent**, because that result means only that the frame was queued. The refusal arrives later on **On Video Send Refused**, at most once a second for the same refusal, and on a busy connection it may name a different send: show it to the player, do not act on it. Check **Video Send** in [Player safety](../services/player-safety.md) before you offer a camera.
:::

**Success signal.** With another client in range that holds `use_video_chat` and whose Video Receive setting and blocks admit you, **Send Video Frame** answers **Sent** with `Fragments` above zero, and that client's receiver delivers the frame.

## Receive a frame

The receiver is a world subsystem, created for Play in Editor and game worlds only. Bind `OnVideoFrameAssembled` (an `FOnCrowdyVideoFrameAssembled`) and it fires on the game thread once per completed frame with an `FCrowdyVideoFrame`. C++ code may bind `OnVideoFrameReady` instead, a plain multicast delegate (`FOnCrowdyVideoFrameReady`) at the same firing point with no dynamic-delegate overhead.

The lantern village's player character binds at `BeginPlay`, and its `HandleVideoFrame` sets the torch's intensity to the byte count of each frame: a visible stand-in for the decode the example deliberately leaves out, because decoding is not the SDK's, as the page says below.

<CppSnippet id="video-receive" />

In Blueprint the receiver is reached like any world subsystem: a **Crowdy Video Frame Receiver** getter node, **Bind Event to On Video Frame Assembled** off it, and a custom event with a `Frame` pin; **Break Crowdy Video Frame** opens the struct. The twin below, in the player character's Blueprint, binds at **Event BeginPlay**: a **Crowdy Video Frame Receiver** getter feeds **Bind Event to On Video Frame Assembled**, whose custom event `OnVideoFrame` calls **Set Visibility** on `Torch` (a Point Light component you add). Break the `Frame` pin to reach `Bytes`, `Sender Id`, and `Codec`.

<Blueprint src="video-receive" title="Event BeginPlay, Crowdy Video Frame Receiver, Bind Event to On Video Frame Assembled, OnVideoFrame, Get Torch, Set Visibility" />

:::caution[Binding late costs you the frame already in flight, and nothing else.]
Reassembly is turned on by the first bind. The one frame that was assembling when you bound may be missed; every frame after it is delivered. Nothing before the bind was kept.
:::

**Success signal.** With another client in range sending video into the same app (this SDK or another), the torch's intensity jumps with every completed frame, and `GetPendingSenderCount()` reads above zero while a frame is half arrived.

## Choose whose video you receive

These two are on the **Crowdy SDK Subsystem** (category **Crowdy SDK > Video**). The server sends no video that is left out, so it costs no data.

| Blueprint | C++ | Does |
|---|---|---|
| **Set Video Speakers** (Speaker Uuids) | `SetVideoSpeakers(const TArray<FString>& SpeakerUuids)` | Has the server send you video only from these players' actor ids, at most 32, and none when the list is empty. Returns false, logs a warning and changes nothing for a longer list or an id that is not 32 characters. |
| **See All Video Speakers** | `SeeAllVideoSpeakers()` | Goes back to every player in range. |

The app can set a lower limit, `maxVideoSpeakers` (see [game setup](/management-api/game-setup#c5-cap-the-speakers-each-player-receives)), and the server refuses a longer list. Calling it again with the same players, in any order, sends nothing. Which players to name is your game's choice, such as the `SenderId` of the cameras on screen. The list holds across map changes and reconnects until **See All Video Speakers** or sign-out. Voice has its own pair; see [Voice Chat](../services/voice-chat.md#choose-whose-voice-you-receive).

## The frame

`FCrowdyVideoFrame`, all fields read-only:

| Field | What it is |
|---|---|
| `SenderId` (`FString`) | The sender's 32 wire octets as text. Exact and unambiguous; empty for an unset id. |
| `SenderUUID` (`FGuid`) | The key derived from those octets, the id the rest of the SDK addresses an actor by. Lossy: the derivation reads the octets as hexadecimal, so two senders whose ids differ only outside that alphabet derive the same key. `USerializationFunctionLibrary::ToGuid` (Blueprint: **To Guid**) derives the same key from a `SenderId` string, and returns an invalid guid for text that is not an actor id. |
| `Codec` (`ECrowdyVideoCodec`) | `Jpeg` or `WebP`. `Unknown` is what a byte this build has no entry for maps to; a fragment carrying one is dropped before it reaches you. |
| `FrameId` (`int32`) | The sender's own counter. It wraps, orders that sender's frames, and means nothing across two senders. |
| `Bytes` (`TArray<uint8>`) | The encoded image, JPEG or WebP according to `Codec`. |
| `ChunkX`, `ChunkY`, `ChunkZ` (`int64`) | The chunk the last fragment was broadcast over. |
| `ServerTimestamp` (`int64`) | When the server stamped that last fragment, in milliseconds since the epoch. |

:::warning[Use SenderId, not SenderUUID, to tell two senders apart for certain.]
`SenderUUID` is the convenient key for matching a frame to an entity you already track by `FGuid`. It can name more than one sender. When correctness depends on which camera this is, compare `SenderId`.
:::

:::danger[There is no decode anywhere in the SDK.]
`Bytes` is a JPEG or WebP file in memory. Turning it into a `UTexture2D` is your own code, with the engine's image wrapper module or a decoder of your choice, and validating it as an image is part of that job: the bytes came off the network from another client.
:::

## Housekeeping

| Call | What it answers or does |
|---|---|
| `GetPendingSenderCount()` | Senders with a frame half arrived. Zero while nothing is listening, since nothing is ingested. |
| `GetDroppedFragmentCount()` | Fragments dropped for a malformed header, or for a frame their sender had already moved past. |
| `GetAbandonedFrameCount()` | Frames abandoned incomplete: superseded by a newer frame, timed out, or the sender left. |
| `ForgetSender(SenderGuid)` | Drops whatever is half assembled for one sender and forgets its frame counter. Exposed because a sender the server never announced as gone is otherwise never released, and a sender that rejoins and restarts at frame zero has every fragment dropped as a straggler until its counter climbs back past the old value. One key can name more than one sender, and every sender it names is forgotten. |

The receiver releases a sender itself when the server announces its departure or the tracker times it out, using the same lossy key.

## What is not delivered

- A client's own fragments. The server sends them back only while **Toggle Owner Echo** is on, and a frame of your own camera is one you already have, so they are discarded, never reassembled.
- A frame that never completes. A fragment for a frame the sender has moved past is dropped; the incomplete frame is abandoned and counted.

Video fragments share the per-frame receive budget with every other message the connection receives; see [Connection and reconnect](./connection-and-reconnect.md#the-receive-budget).

## Gotchas

- The sender is a game instance subsystem. The receiver is a world subsystem: there is none in an editor world, and a new world has a new receiver with nothing bound.
- Nothing is reassembled until something is bound. A diagnostic that reads the counters with no listener sees zeros.
- `FrameId` is per sender. Do not use it to order frames from two cameras.
- `SenderUUID` is the SDK's actor key and is lossy by construction; `SenderId` is exact.

## Related

- [Connection and reconnect](./connection-and-reconnect.md): the receive budget these fragments share.
- [Player safety](../services/player-safety.md): the video permission, and finding out who a frame came from.
- [Voice chat](../services/voice-chat.md): the sibling communication feature.
- [Entities and spawning](./entities-and-spawning.md): the actor tracker whose departures release a sender.
