---
slug: video-frames
sidebar_position: 17
title: Video Frames
description: "Receive another player's webcam frames as whole encoded images: bind once, read the bytes, tell senders apart by the exact id, and decode them yourself."
---

# Video Frames

`UCrowdyVideoFrameReceiver` turns the video fragments the server fans out into whole frames and hands each one to you once, as an encoded image. The SDK does not decode it, does not know its dimensions, and has not checked that it is a valid image; turning the bytes into a texture is your code.

This SDK receives only. It has no public call, node, or subsystem that sends a video frame; the frames come from a client on the same app that publishes them through another Crowdy client, such as a browser on the JavaScript SDK ([Webcam video](/crowdyjs/webcam-video)). A game built on this SDK alone never produces one.

## When you need it

A picture-in-picture of a nearby player, a video wall in the village square, any feature that shows another client's camera. If the game never shows video it pays for none of this: with no listener bound a fragment is dropped the moment it reaches the receiver, with no copy and no partial frame held.

## Receive a frame

The receiver is a world subsystem, created for Play in Editor and game worlds only. Bind `OnVideoFrameAssembled` (an `FOnCrowdyVideoFrameAssembled`) and it fires on the game thread once per completed frame with an `FCrowdyVideoFrame`. C++ code may bind `OnVideoFrameReady` instead, a plain multicast delegate (`FOnCrowdyVideoFrameReady`) at the same firing point with no dynamic-delegate overhead.

The lantern village's player character binds at `BeginPlay`, and its `HandleVideoFrame` sets the torch's intensity to the byte count of each frame: a visible stand-in for the decode the example deliberately leaves out, because decoding is not the SDK's, as the page says below.

<CppSnippet id="video-receive" />

In Blueprint the receiver is reached like any world subsystem: a **Crowdy Video Frame Receiver** getter node, **Bind Event to On Video Frame Assembled** off it, and a custom event with a `Frame` pin; **Break Crowdy Video Frame** opens the struct. The twin below, in the player character's Blueprint, binds at **Event BeginPlay**: a **Crowdy Video Frame Receiver** getter feeds **Bind Event to On Video Frame Assembled**, whose custom event `OnVideoFrame` calls **Set Visibility** on `Torch` (a Point Light component you add). Break the `Frame` pin to reach `Bytes`, `Sender Id`, and `Codec`.

<Blueprint src="video-receive" title="Event BeginPlay, Crowdy Video Frame Receiver, Bind Event to On Video Frame Assembled, OnVideoFrame, Get Torch, Set Visibility" />

:::caution[Binding late costs you the frame already in flight, and nothing else.]
Reassembly is turned on by the first bind. The one frame that was assembling when you bound may be missed; every frame after it is delivered. Nothing before the bind was kept.
:::

**Success signal.** With a publishing client (not one built on this SDK) sending video into the same app, the torch's intensity jumps with every completed frame, and `GetPendingSenderCount()` reads above zero while a frame is half arrived.

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

- A client's own fragments. The server fans a video packet out over the chunk it was sent to, which includes the sender, and a frame of your own camera is one you already have. They are discarded, never reassembled.
- A frame that never completes. A fragment for a frame the sender has moved past is dropped; the incomplete frame is abandoned and counted.

Video fragments share the per-frame receive budget with every other message the connection receives; see [Connection and reconnect](./connection-and-reconnect.md#the-receive-budget).

## Gotchas

- The receiver is a world subsystem. There is none in an editor world, and a new world has a new receiver with nothing bound.
- Nothing is reassembled until something is bound. A diagnostic that reads the counters with no listener sees zeros.
- `FrameId` is per sender. Do not use it to order frames from two cameras.
- `SenderUUID` is the SDK's actor key and is lossy by construction; `SenderId` is exact.

## Related

- [Connection and reconnect](./connection-and-reconnect.md): the receive budget these fragments share.
- [Voice chat](../services/voice-chat.md): the sibling communication feature.
- [Entities and spawning](./entities-and-spawning.md): the actor tracker whose departures release a sender.
