---
slug: overview
sidebar_position: 1
title: Game Models Overview
description: "The truth plane in one page: what a container, an attribute, a function, and a session are to an Unreal client, why every read is a pull, and the two rules about ids you must never break."
---

# Game Models Overview

Game Models hold the gameplay state the server is authoritative for: hit points, fuel, inventory, scores, anything a client must not be able to forge. A client never writes one. It reads the last value the server confirmed, asks the server to run a function that changes it, and re-reads when the server says something changed.

## When you reach for this section

When a value decides who wins, what a player owns, or what they paid for. Movement, animation, and anything that only needs to look right on other screens belongs on the view plane, [Crowdy State](../runtime/crowdy-state.md), and never here. [The Two Planes](../concepts/two-planes.md) is the decision table; this section is the truth-plane half of it.

:::danger[Authoritative or cheat-sensitive state is a Game Model attribute, never a Crowdy State property.]
A variable is one or the other. In Blueprint the **Crowdy Replication** dropdown offers one choice per variable; in C++ a property that carries both `CrowdyState` and `CrowdyModel` is rejected when the class is discovered. Nothing on the view plane is checked by a server, so a value that matters to fairness cannot live there.
:::

## The four words

The server side defines three primitives; the Unreal SDK adds a fourth word for the room they run in. The [Game Models page of the Game API docs](/game-api/game-models) owns the server-side meaning of each; this section says only what the Unreal client does with them.

| Word | On the server | In Unreal |
|---|---|---|
| **Container** | A row of state of one type, owned by a player or by the app | A `UCLASS` tagged `CrowdyContainer`: an actor, an actor component, or a subsystem. It binds to the entity it belongs to when that entity registers. Not only actors: a component can be its own container, and so can a world or game-instance subsystem. [Containers and attributes](./containers-and-attributes.md). |
| **Attribute** | A property definition on the type, with a value type and a visibility | A `UPROPERTY` marked `CrowdyModel` ("Server Owned" in Blueprint). The client holds a cached copy of the confirmed value and a zero-argument `CrowdyOnRep` function that runs when it changes. |
| **Function** | A named, transactional piece of logic on the type, with an invoke policy | Authored on a **Crowdy Effect** asset in [EffectScript](./effect-script.md) ([Authoring effects](./authoring-effects.md) is the walkthrough) and applied from gameplay code: [from C++](./effects-cpp.md), [from Blueprint](./effects-blueprint.md), and the general [Call Model Function](./functions-and-return-values.md) node. |
| **Session** | A match, room, or lobby that containers can be scoped to | A `SessionId` string every Game Model call accepts, with an active session the SDK remembers for you. [Sessions](./sessions.md). |

## Pull, never push

State is always pulled. When a function commits on the server, the client that called it receives the confirmed result in the same response and applies it to its own cache. Every other client receives a small notification, a nudge that carries no value, re-pulls the container, and applies whatever the server returns. The nudge and the pull are the whole coupling between the planes; [Change pings and pull](./change-pings-and-pull.md) walks through both carriers and the one debugging switch you need.

Two consequences you will meet on every page:

- Your code sees a change land through the attribute's `CrowdyOnRep`, or through the **Listen for Model Changes** node, never through a push handler with the new value in it.
- A getter returns the cached copy. Until the first pull lands, that copy is the class default, so a value being present proves nothing ran.

:::caution[Never write an attribute from the client.]
A client assignment to `Fuel` changes a local copy that the next server pull overwrites. To change the value, apply an Effect; the server runs it, confirms the result, and every bound client re-pulls. This is the same rule the [Quickstart](../quickstart.md) states in its Game Model step, and it has no exception.
:::

## Ids are 64-bit, and the SDK does the JSON

Every id you meet here, the app id, a user id, a container owner's id, is a 64-bit integer. In your code they are `int64`: `GetLocalUserId` returns one, `CreateSession` takes a `TArray<int64>` of participants, `TransferSessionHost` takes an `int64 ToUserId`. On the wire the app id travels as a JSON string, because the server rejects it as a number, and the SDK encodes it that way on every Game Model call it builds. You never hand-build that JSON.

:::warning[Carry every id as int64 end to end, and never hand-roll the appId JSON.]
The only way to break this from your side is to store a user or owner id in an `int32`, or a float, on the way to a Game Model call. A truncated id names nobody, and the server's answer for it is a refusal, not a warning. The wire encoding is the SDK's job; the width is yours.
:::

## Where each page fits

Read them in the order below the first time; after that each stands alone.

1. [Containers and attributes](./containers-and-attributes.md): declare a container class, mark an attribute Server Owned, read it back, react to a change.
2. [Authoring effects](./authoring-effects.md) and [EffectScript](./effect-script.md): writing the server function an effect asset is.
3. [Applying an effect from C++](./effects-cpp.md) and [from Blueprint](./effects-blueprint.md): the only way client code changes truth-plane state.
4. [Functions and return values](./functions-and-return-values.md): calling a function by name, typed parameters, and reading an answer back.
5. [Invoke policies](./invoke-policies.md): who may call a function, and the one rule about an empty policy.
6. [Automations](./automations.md), [Coalescing](./coalescing.md): a function that runs itself, and a burst of applies that merges into one call.
7. [Collections](./collections.md): containers that own other containers, and free containers with no actor.
8. [Pre-seeding](./pre-seeding.md), [Ensured identity](./ensured-identity.md): how a placed object finds the same row on every client.
9. [Kits](./kits.md): Combat, Living World, Leaderboards, and Guild schema deployed in one step.
10. [Change pings and pull](./change-pings-and-pull.md): how a change reaches every client.
11. [Sessions](./sessions.md): matches, rooms, and lobbies, with a roster, a host, and a turn.

Authoring the schema and pushing it to the server happens in Crowdy Studio; that page is [Game Models authoring](../studio/game-models-authoring.md).

## Gotchas

- A Game Model attribute exists on the server only after **Sync to Server** in Studio. Until then every read returns the default you pass.
- Do not apply an Effect until `gameModelEnsureContainer` / bind has **returned**. Binding is what creates the row. Until the first pull, a getter is the C++ / Blueprint class default, so a "wrong" health or team id in that window is expected. [Ensured identity](./ensured-identity.md).
- "Session" means several things in this SDK. The Game Model session on these pages is a match: the group of players Create / Join record. The login session is your signed-in identity, held by `UCrowdyGameSession` (see [Authentication](../services/authentication.md)). The session channel is a transport every client of the app joins. A Crowdy Team is a persistent group with roles; joining one is not joining a session. [Sessions and Presence](../concepts/sessions-and-presence.md) keeps the four apart.
- A cross-entity Effect with no `require` infers `is_participant`. An app that never creates a Game Model session always refuses those player calls. [Invoke policies](./invoke-policies.md).
- The elected host of the view plane is a convention. `is_host` on a function is that elected host, not the Game Model session host. [The Host Is a Convention](../concepts/host-is-a-convention.md).
- Trace everything on this plane with `crowdy.gamemodel.trace 1`; the log category is `LogCrowdyGameModel`.

## Related

- [The Two Planes](../concepts/two-planes.md): the decision table for where a value lives.
- [Game Models on the Game API](/game-api/game-models): the server-side model, its schema, and its concurrency rules.
- [Game Models authoring](../studio/game-models-authoring.md): Preview, Sync to Server, and staged deletes in Studio.
- [Crowdy State](../runtime/crowdy-state.md): the view plane, for everything that is not a Game Model.
