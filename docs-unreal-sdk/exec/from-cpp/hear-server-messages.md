---
slug: hear-server-messages
sidebar_position: 3
title: Hear its messages
description: Hear a Server Object's messages from C++ with WatchMessage and UnwatchMessage, the FOnCrowdyServerMessage listener and its payload in the message's struct or read by name, the announcement of the shared boss's fall, when a message is delivered, held or lost, and what happens to a message that players cannot listen to.
---

# Hear its messages

:::note
Server Objects run on [ck-exec](/exec/intro).
:::

A message is the server telling everyone listening that something happened, such as the Hollow Giant falling. The [definition](../create-a-type.md#server-messages) lists a type's messages and its [server code](../write-server-logic.md#send-a-message) sends them. A message is an event and not a value: it reaches a game once, when it is sent, and nothing keeps it. To show what is true now, such as whether the boss is defeated, read a variable; see [Read and follow its variables](./read-and-follow-variables.md).

## Listen for a message

`WatchMessage`, a function of `UCrowdyServerObject`, takes the message's **Name** from the definition and a listener, and returns an `FDelegateHandle`. The boss watches its Server Object right after acquiring it, and announces the fall:

<CppSnippet id="so-message" />

The listener, an `FOnCrowdyServerMessage` delegate, receives the Server Object, the message's name and its payload as an `FInstancedStruct`. It runs once for each message the server sends, and never at any other time: not when the values first arrive, and not when you start watching.

- **The payload** is the struct the definition's **Payload Struct** names, here `FBossDefeated`, with `Winner` and `Hits`. Read it with `GetPtr`, as above. For a message with no values the `FInstancedStruct` is empty, and `GetPtr` gives null.
- **One listener can serve several messages.** Check `Message` to tell them apart; each `WatchMessage` call is for one message.
- **`UnwatchMessage(Message, Handle)`** removes a listener. A listener bound to a `UObject`, as above, is skipped once that object is gone, so the boss does not need to remove its own; a lambda or raw binding does.
- **`WatchMessage` gives an invalid handle and does nothing** when the definition has no message by that name, when the message has **Players Can Listen** off, when the listener is not bound, or when the Server Object is Released. The first two log a warning: "... has no message named BossDefeated, so nothing can listen to it", or "BossDefeated is heard only by other Server Object types; turn on Players Can Listen to hear it in a game". Check `MessageHandle.IsValid()` while you wire it up.

When the definition's payload values are [added in the asset](../create-a-type.md#variables-inputs-and-outputs-or-a-struct) instead of taken from a struct, there is no struct to read. `CrowdyExec::ToList` from `CrowdyExecCodec.h` gives the payload as an `FInstancedPropertyBag` to read by name:

<CppSnippet id="so-message-bag" />

## When a message is heard

The Server Object listens to a message's topic while at least one listener wants it, from C++, from a Blueprint node or from a component, and the connection is open. When the last listener goes it stops listening, and after a dropped connection comes back it listens again.

- **A message that arrives while the object is reading its values is held.** It is announced after the values are current, so a listener that reads `GetState()` sees the state the message followed. At most 32 are held; past that the oldest is dropped and the log warns. A message is announced only while the status is Ready; one that arrives while it is Connecting is held until then.
- **A message sent while the connection is closed is lost.** Nothing is replayed when it comes back. The Server Object reads its values again and reports what differs through `WatchValues`, but a message is not a value and cannot be read again.
- **A message in a record type can arrive before the record change it follows.** A type that keeps [a record per entity](../keep-a-record-per-entity.md) sends its records in batches, so a message sent right after a record changed may be announced before `OnRecordsChanged` reports it. Put what the listener needs into the payload.
- **A refused listen is asked again.** If the server refuses to let the player listen, the log warns once with the platform's reason, "... could not listen to its BossDefeated message, so it is asked again after a wait: ", and the Server Object asks again after a wait that grows from 1 second to 30. The Server Object does not fail.
- **A payload that does not fit its struct is dropped,** with a warning that names the message.
- **Every message listened to is a subscription.** A connection allows 256 subscriptions in all, and each subscribe counts against the 120 calls a connection may make every 10 seconds. See [A message never arrives](../troubleshooting.md#a-message-never-arrives).

## Related

- [Hear its messages, from Blueprint](../from-blueprint/hear-server-messages.md): **On Message Received**, **Watch Message** and **Stop Watching Message**
- [Read and follow its variables](./read-and-follow-variables.md): the previous page
- [Call its functions](./call-functions.md): the next page
- [Server messages](../create-a-type.md#server-messages): defining a message and who hears it
- [Send a message](../write-server-logic.md#send-a-message): what the server code does
- [Shared boss fight](../examples/shared-boss.md): the boss these messages announce
- [Troubleshooting](../troubleshooting.md#a-message-never-arrives): a message that never arrives
