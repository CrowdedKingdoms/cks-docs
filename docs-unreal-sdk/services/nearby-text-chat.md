---
slug: nearby-text-chat
sidebar_position: 4.5
title: Nearby Text Chat
description: "Send a line of text to the players near you and hear theirs: how far a line reaches, who sent it, what Sent means, refusals, limits, and how it differs from channel chat."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Nearby Text Chat

Nearby text chat sends a line of text to every player near your pawn, and hands you every line players near you send. There is no room to join and no list of members: who hears a line is decided by where the players stand, like a voice in a crowd. Like voice, it is a live relay with no server truth; the server keeps no history.

## When you touch this

When your game wants a local chat: players talk to whoever is standing around them, and a player who walks away stops hearing them. For chat with a fixed group wherever its members are, a party or a guild, use a channel instead ([Play Together](./play-together.md), [Channels](../runtime/channels.md)).

## The nodes

Everything lives on the **Crowdy Proximity Chat** subsystem (`UCrowdyProximityChat`, a Game Instance subsystem, category **Crowdy SDK > Proximity Chat**). Your module needs `CrowdyServices` in its Build.cs.

| Blueprint | C++ | Does |
|---|---|---|
| **Send Proximity Text** | `SendProximityText(const FString& Text, int32 DistanceChunks)` | Sends Text to every player within Distance Chunks of the chunk your pawn stands in. One exec pin per result. |
| **On Proximity Text Received** | `OnProximityTextReceived` | Fires with each line another player sends you. |
| **On Proximity Text Refused** | `OnProximityTextRefused` | Fires when the server refuses one of your lines. |
| **Describe Proximity Chat Result** | `DescribeProximityChatResult(ECrowdyProximityChatResult Result)` | A sentence for a result, for a log or a status line. |

**Send Proximity Text** checks the line before it sends anything, and leaves on the pin that says how it went:

| Result | Means |
|---|---|
| **Sent** | The line left this client. It is not a delivery receipt: the platform sends none. |
| **Empty Text** | There was nothing to send. |
| **Too Long** | The line is over 1024 bytes of UTF-8. A character outside plain ASCII takes two to four bytes. |
| **Not Connected** | The realtime connection is not up yet, or the player has no actor id yet. |
| **No Position** | There is no local pawn to measure the line's reach from. |

Nothing is sent unless the result is **Sent**.

## How far a line reaches

A line is addressed to the chunk your pawn stands in, and reaches every player whose chunk is within **Distance Chunks** of it on each axis: 0 is your own chunk only, and 8 is the farthest the server relays. A value outside 0 to 8 is clamped. Each player is placed by their own last actor update. At the default chunk size of 1600 units, a distance of 4 reaches a square of nine chunks on a side, 14400 units across, centred on your chunk. [Recipients and routing](../runtime/recipients-and-routing.md) explains chunk rings.

Every line names its own distance, so a game can have a short "say" and a longer "shout".

## Saying a line

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`SayNearby` sends a line to players within four chunks and brightens the torch only when it left.

<CppSnippet id="nearby-text-send" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A custom event, **SayNearby** with a **Line** string, calls **Send Proximity Text** with **Distance Chunks** set to 4. Only the **Sent** pin brightens the torch.

<Blueprint src="nearby-text-send" title="SayNearby, Crowdy Proximity Chat, Send Proximity Text, Set Intensity" />

</TabItem>
</Tabs>

## Hearing lines

**On Proximity Text Received** gives you one **Crowdy Proximity Text**:

| Field | Is |
|---|---|
| **Sender Uuid** | The sender's actor id as text, the same value **On Voice Speaker Talking** gives for that player. |
| **Sender Entity Id** | The sender's entity id. For a player on this SDK it is their pawn, so **Find Entity** returns the pawn while your client draws it. It is unset when the actor id is not one, for example from a CrowdyJS player. |
| **Text** | The line exactly as it arrived. |

Your own lines never come back to you; show a line as sent from your own **Sent** pin.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`WatchNearbyText` binds the event with `AddDynamic`. The handler looks the sender's entity up and turns the torch yellow while this client draws the sender, white when it does not.

<CppSnippet id="nearby-text-receive" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Event BeginPlay binds a custom event, **OnNearbyText** with a **Message**, to **On Proximity Text Received**. The event breaks the message, passes **Sender Entity Id** to **Find Entity**, and sets the torch yellow or white on whether the answer **Is Valid**.

<Blueprint src="nearby-text-receive" title="Event BeginPlay, Crowdy Proximity Chat, Bind Event to On Proximity Text Received, OnNearbyText, Break Crowdy Proximity Text, Find Entity, Is Valid, Branch, Set Light Color" />

</TabItem>
</Tabs>

No name travels with a line. To show one, read it from the sender's pawn if your game puts a name there, or look the player up with [Player Names](./player-names.md) once you know who they are.

## Refusals

A line leaves before the server judges it, so a refusal arrives later, on **On Proximity Text Refused**, with the same **Crowdy Send Refusal** that the realtime subsystem's **On Send Refused** carries ([Connection and reconnect](../runtime/connection-and-reconnect.md)). The usual cause is a player whose access tier lacks `use_text_chat`; every tier that grants access has it unless the app was set up otherwise.

The server names a refused send only by a one-byte sequence, so on a busy connection a refusal can name the wrong send, and the same refusal is reported at most once a second. Show it; do not act on it.

## What to expect

- **Lines are not reliable.** A line is one UDP packet with no retry, like a voice frame. Over a healthy connection that is rarely a problem; do not build anything that must arrive on it.
- **It follows the pawn.** Each line is addressed to the chunk the pawn stands in when it is sent, and a listener who has just moved is placed by their next actor update.
- **It reaches other SDKs.** A line is plain UTF-8 and nothing else, the same as CrowdyJS's and CrowdyCPP's nearby text, so players on those SDKs in the same app hear it and you hear theirs.
- **The sender is a claim.** The actor id is the one the sender chose, and the server does not check it against the sender. Treat **Sender Uuid**, **Sender Entity Id** and **Text** as untrusted input: cut long lines and line breaks before you put them on screen, and keep anything authoritative out of chat.

## From C++

The nodes above are `UFUNCTION`s and `UPROPERTY`s on `UCrowdyProximityChat`, so C++ calls them by the names in the table. The types behind them:

| Type | Is |
|---|---|
| `FCrowdyProximityText` | The line **On Proximity Text Received** carries: `SenderUuid` (`FString`), `SenderEntityId` (`FGuid`) and `Text` (`FString`). |
| `ECrowdyProximityChatResult` | The result of `SendProximityText`: `Sent`, `EmptyText`, `TooLong`, `NotConnected`, `NoPosition`. |
| `FOnCrowdyProximityTextReceived` | The delegate type of `OnProximityTextReceived`, with one `const FCrowdyProximityText&`. Bind it with `AddDynamic`. |
| `FOnCrowdyProximityTextRefused` | The delegate type of `OnProximityTextRefused`, with one `const FCrowdySendRefusal&`. |

`UCrowdyProximityChat::MaxTextBytes` is the 1024-byte limit, and the static `EntityIdFromSenderUuid(const FString&)` turns an actor id into the entity id it names, the same way the received line's `SenderEntityId` is made.

The chunk a line is addressed to comes from the game session: `UCrowdyGameSession::GetLocalPlayerChunk(const UWorld*)` is the chunk the world's first local player's pawn stands in, or the chunk last set with **Set Player Current Chunk Coordinates** when there is no pawn, and `TryGetLocalPlayerChunk(const UWorld*, FInt64Vector&)` answers false when there is no pawn instead. Voice chat is addressed the same way.

## Gotchas

- **Sent** is not delivery. A line nobody was near enough to hear is still **Sent**.
- **No Position** means no local pawn. A spectator or a menu with no pawn cannot send nearby text.
- The 1024-byte limit counts UTF-8 bytes, not characters.
- Text received is whatever another client sent: any length that fits one packet, with line breaks.

## Related

- [Voice Chat](./voice-chat.md): the voice twin, with a distance of its own.
- [Play Together](./play-together.md): chat rooms, parties and guilds over channels.
- [Recipients and routing](../runtime/recipients-and-routing.md): chunk rings and distances.
- [Connection and reconnect](../runtime/connection-and-reconnect.md): **On Send Refused**.
