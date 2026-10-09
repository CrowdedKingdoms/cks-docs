---
slug: sessions-and-presence
sidebar_position: 3
title: Sessions and Presence
description: What the word session means in the SDK, how the server decides a player is present, and where a match, a lobby or a room lives.
---

# Sessions and Presence

"Session" names several things in this SDK, and none of them is a match. A match, a lobby waiting to become one, a room or a table is kept by your app's server code, and every client reads that record rather than keeping its own.

:::note[One word, three things.]
The **login session** is your signed-in identity. The **session channel** is a transport every client of the app joins (`__crowdy_session_<appId>`). A **Crowdy Team** is a persistent group with membership and roles. None of them is a match, and being in one does not make a player part of one.
:::

## Presence is the player's actor

There is no heartbeat call. While a client's UDP connection is up and it is replicating an actor in the app, that client is present. The server knows a client by the actor updates it sends: a client with no fresh actor is at no position on the map and receives no spatial event. A headless or API-only client, a test bot with no UDP connection, or a menu-only flow has no actor to be present with.

Server code hears presence too: on [ck-exec](/exec/intro), the app's root hub is told who entered or left the app's world. See [presence](/exec/timers-and-presence#presence).

## The session channel

The session channel is a shared transport, named `__crowdy_session_<appId>`, that every client of the app joins as soon as it connects. Reliable RPC events ride it. You never have to create it; the runtime creates it on demand, and the Channels page in Crowdy Studio can pre-create it so it is visible right away.

## Matches, lobbies and rooms

A match is state the game must be able to trust (its roster, its host, whose turn it is, the score), so it lives on the [truth plane](./two-planes.md), in your server code. On ck-exec that is a hub for the match: the `session` [starter pack](/exec/builds#starter-packs) keeps one game from lobby to result, with a host, ready checks, turns with a time limit, and a winner.

:::caution[The SDK's Game Model sessions are gone.]
The SDK's own session API (Create, Join, Leave and End on the Game Model subsystem, and the active session) was built on the game API's legacy game-model engine, which ck-exec replaced; the game API no longer serves it. Since v2.18.0 the SDK marks it deprecated and every call fails at once, and a later release removes it. A match is a [Server Object](../exec/overview.md) (from Blueprint or C++); see [Move from Game Models](../exec/move-from-game-models.md).
:::

## Gotchas

- A client that never spawns an actor is never present. Spawn the player's pawn once the connection is up.
- The session channel is not a match and carries no roster. Keep who is playing in your server code.

## Related

- [The Two Planes](./two-planes.md): why the server, not your client, keeps the record of a match.
- [The Host Is a Convention](./host-is-a-convention.md): what the elected view-plane host does and does not decide.
- [Channels](../runtime/channels.md): the session channel and named channels.
