---
slug: two-planes
sidebar_position: 1
title: The Two Planes
description: Why the SDK splits networked state into a fast, client-owned view plane and a server-enforced truth plane, and how to tell which one a field belongs to.
---

# The Two Planes

Every piece of networked state in the SDK lives on one of two planes. The view plane is fast and client-owned; the truth plane is server-owned and enforced. Keeping them apart is the one rule the rest of the SDK is built on.

## The split

**Plane A, the view plane (Crowdy State).** Continuous, client-authoritative state that has to move fast: movement, animation, transient effects. The client that owns an entity writes its view state; the SDK ships it to every other client over UDP, through RPC events and property replication. Nothing on this plane is checked by a server. An elected host helps coordinate it, but as a convention, not as an authority.

**Plane B, the truth plane (Game Models).** Gameplay state the game must be able to trust: hit points, stats, inventory, currency, anything a client could benefit from lying about. The server owns it. A client asks for the current value, and asks the server to change it by applying an Effect; the server decides and confirms. This is the only place a rule is enforced.

:::note[The elected host is a convention, not an enforcement point.]
Any client can, in principle, lie about its own view state. The host is a coordinator for shared view-plane logic, not a referee. See [The Host Is a Convention](./host-is-a-convention.md).
:::

## Where the planes are allowed to touch

There is exactly one coupling. When the server changes a truth value, a small notification rides the view plane just far enough to tell interested clients "something changed, re-read me". The notification carries no value; each client then pulls the confirmed state from the server.

No gameplay value ever flows from the view plane into the truth plane as trusted input. A client can trigger a re-read, or ask the server to run an Effect, and that is all.

:::info[Game Models are pull-based. There is no server push.]
A change on the server produces a ping. Every client that cares re-pulls and gets the confirmed value. Your code sees it land through a `CrowdyOnRep` function, never through a push handler.
:::

## The nine design rules

These are the rules the SDK holds itself to, in plain words. You will meet each of them again in the Game Models section.

1. **The planes never collapse.** Cheat-sensitive state goes to Game Models, never to Crowdy State, no matter how tempting the low latency.
2. **A packaged build reads a baked registry.** Cooked builds strip Unreal metadata, so the markers you write (`CrowdyEvent`, `CrowdyState`, `CrowdyModel`) are baked into a registry asset at cook time. Shipped code never reads metadata at runtime.
3. **The app id is a string on the wire.** Server ids are 64-bit; every API call sends the app id as a JSON string, and every id you store is an `int64`.
4. **A rep-notify function takes no parameters.** `CrowdyOnRep` names a parameterless function, GAS-style; read the property for the new value.
5. **The change ping is a plain struct.** The "re-read me" notification is an ordinary instanced struct dispatched as a game event, not pre-encoded bytes.
6. **Server function parameters travel as JSON.** The marshaller walks your properties and emits JSON, never a binary blob.
7. **A schema diff is structural.** Studio compares canonicalised JSON when it decides what a sync changes; a key order or whitespace difference is not a change.
8. **Every Game Model call names a session.** Queries and mutations are scoped to a session; the active session is supplied for you.
9. **An empty policy clears the policy.** An effect with no invoke policy is sent as an explicit null that removes the server's policy, so "no policy" is never "no gate" by accident.

## Deciding where a field goes

Ask one question: **can a malicious client benefit from lying about this value?** If yes, it is a Game Model attribute. If no, it is view state.

:::danger[Authoritative or cheat-sensitive state never belongs in Crowdy State.]
Crowdy State is written by the client that owns the entity and believed by everyone else. A hit-point value there is a hit-point value the owner can set to a million.
:::

The table below is a guide, not a rule book. Each row names the SDK mechanism that fits.

| State | Plane | Mechanism |
|---|---|---|
| Movement | View | Dynamic entity mode: the continuous state channel sends a snapshot every replication interval. |
| Animation blend state | View | A Crowdy State property (`meta=(CrowdyState)`), diffed and sent on change. |
| A one-shot effect trigger (a muzzle flash, an impact) | View | An RPC event (`meta=(CrowdyEvent)`), because a trigger is not continuous state. |
| Hit points | Truth | A Game Model attribute (`meta=(CrowdyModel)`, "Server Owned" in the Blueprint dropdown). |
| Inventory | Truth | A Game Model container, with items linked as a collection. |
| Currency | Truth | An attribute on a container class scoped to the app (`CrowdyScope="App"` on the class), so it outlives any one match. |
| Match score | Truth | An attribute on a container class scoped to the session (the default), so it belongs to the match. |
| Chat | View | An RPC event with the `Multicast` recipient over the session channel. Not gameplay truth. |
| A cosmetic display name | View | A Crowdy State property. Route it through the avatars service instead if it has to persist. |

:::note[Since 2.14]
`CrowdyScope` on a container class chooses whether its rows belong to the session (the default) or to the whole app.
:::

## Gotchas

- Low latency is not a reason to move a value to the view plane. Predict locally if you must, but let the server's confirmed value overwrite the prediction.
- A Crowdy State property and a Game Model attribute are different markers on different planes. The Blueprint dropdown makes the choice explicit: Replicated is view, Server Owned is truth.
- The change ping tells a client to re-pull; it never carries the value. Do not try to read state out of it.

## Related

- [Entities, Identity, and Ownership](./entities-identity-ownership.md): what an entity is and who may write its view state.
- [The Host Is a Convention](./host-is-a-convention.md): what host election does and does not decide.
- [Crowdy State](../runtime/crowdy-state.md): the view-plane property system.
- [Game Models overview](../game-models/overview.md): the truth plane.
