---
slug: sessions-and-presence
sidebar_position: 3
title: Sessions and Presence
description: What a game session is, how the server decides a player is still there, and the create, join, leave, and end lifecycle every session goes through.
---

# Sessions and Presence

A game session is a group of players playing together, as the server sees it. Your game decides what one session stands for: a match, a lobby waiting to become a match, a room, a table. The server keeps the record of it, and every client reads that record rather than keeping its own.

## What a session is

The record the server keeps for one session holds: the roster (who is in it and since when), the admission rule (open, locked, or closed), the seat cap, who is host, who is present, whose turn it is, a revision counter that goes up on every change, and a status (active while it runs; completed or abandoned once it has ended).

Two things follow from the server keeping it:

- **Your client does not decide any of it.** Joining, leaving, changing the host, or taking a turn is a request; the server applies the rule and answers. A Blueprint check such as `Is Session Host` tells you what to show, and the server still refuses a host action from a client that is not the host.
- **Game Model state belongs to a session.** A container created during a match belongs to that match's session; reads and Effects run inside the session your client is in (the "active session"). That is what ties this page to the [truth plane](./two-planes.md): the session is the scope a Game Model value lives in.

:::note[One word, four things.]
A **Game Model session** (this page) is the group of players the server records when you Create or Join. The **login session** is your signed-in identity. The **session channel** is a transport every client of the app joins (`__crowdy_session_<appId>`). A **Crowdy Team** is a persistent group with membership and roles. Joining a team, riding the session channel, or being signed in does not make `is_participant` true; only a joined Game Model session does. [Invoke policies](../game-models/invoke-policies.md).
:::

## Presence is the player's actor

There is no heartbeat call. While a client's UDP connection is up and it is replicating an actor in the app, that client is present. A joined participant with no fresh actor for 60 seconds after joining is marked as left with the reason `PresenceExpired`, and a `ParticipantExpired` event is raised. A session nobody has been in for five minutes (the default empty timeout) is ended by the server with the reason `EmptyTimeout`.

:::info[A client that never spawns an actor is expired after 60 seconds under the default presence rule.]
A headless or API-only client, a test bot with no UDP connection, or a menu-only flow has no actor to be present with. Create such a session with `Presence = None` (`ECrowdySessionPresence::None` in the create options). Then nobody is ever expired, and the only ways out are Leave, End, and the empty timeout.
:::

By default any fresh actor of yours counts. An advanced Join option binds presence to one specific actor instead; it is off by default because a reconnect that hands out a new actor would otherwise expire the player.

## The lifecycle

1. **Create.** Names the session. The creator is joined, is the host, and by default the new session becomes the caller's active session.
2. **Join.** Takes the session id (the room code). Joining a session you are already in is how you reconnect: you get your roster row back with a new incarnation (a per-join counter the server hands back; Leave quotes it), and any older window of yours becomes stale.
3. **Play.** Game Model reads and Effects run inside the active session.
4. **Leave.** Requires the incarnation the join returned. The SDK remembers it per session, so most code never touches it. A different client, or a fresh launch, must Join again first.
5. **Host actions.** Set Admission, Transfer Host, and End are host-only; Set Turn may also be called by the player whose turn it is. By default (the Advanced **Refuse If Host Changed** pin) the SDK sends the host term it last read, and the server refuses with `HostTermStale` if the host changed since, so a stale host cannot act by accident.
6. **End.** The host ends it: everyone is marked as left, the session closes, and it stays readable as history.

:::note[Since 2.14]
The active session survives a map travel: create or join it in the lobby map, and the match map's placed objects bind their containers inside that same session. Leaving or ending the session forgets it; `Clear Active Crowdy Session` forgets it by hand.
:::

:::warning[A project on an SDK older than 2.14 loses the active session on map travel.]
Do not assume the lobby-then-match flow works until you have confirmed your plugin's version.
:::

## The session channel

The session channel is not the session. It is a shared transport, named `__crowdy_session_<appId>`, that every client of the app joins as soon as it connects. Reliable RPC events, the Game Model change ping, effect signals, and the session cue ("the session you are in changed") all ride it. You never have to create it; the runtime creates it on demand, and the Channels page in Crowdy Studio can pre-create it so it is visible right away.

## Gotchas

- `Presence = Actor` is the default. Pick `None` deliberately for anything that never spawns a character.
- A session id is the room code. Share it; do not try to derive it.
- Leave without a valid incarnation is refused. Join first on a fresh launch.
- `HostTermStale` is a refusal, not an error in your code: another client became host. Re-read and retry if the action still makes sense.

## Related

- [The Two Planes](./two-planes.md): why the server, not your client, keeps this record.
- [The Host Is a Convention](./host-is-a-convention.md): the session host versus the elected view-plane host.
- [Game Models overview](../game-models/overview.md) and [Sessions](../game-models/sessions.md): reads, Effects, and the session API in code.
- [Channels](../runtime/channels.md): the session channel and named channels.
