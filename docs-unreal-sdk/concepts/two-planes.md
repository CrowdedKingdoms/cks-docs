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

**Plane B, the truth plane (your server code).** Gameplay state the game must be able to trust: hit points, stats, inventory, currency, anything a client could benefit from lying about. The server owns it: your app's code on [ck-exec](/exec/intro) holds it, and a client asks that code for a change, which it decides and confirms. This is the only place a rule is enforced.

:::caution[The SDK does not wrap ck-exec yet.]
The SDK's own truth-plane API (Game Model containers and attributes, `CrowdyModel` markers, Crowdy Effects, invoke policies and sessions) was built on the game API's legacy game-model engine, which ck-exec replaced. The game API no longer serves it, so do not build on it. The Unreal SDK moves to ck-exec in a later release. Until then, C++ reaches your app's code on ck-exec through CrowdyCPP's `client.exec()` (CrowdyCPP 0.49.0 on dev): see [connect from a game](/exec/connect-from-a-game#crowdycpp) and [from the legacy engines](/exec/from-the-legacy-engines#tools).
:::

:::note[The elected host is a convention, not an enforcement point.]
Any client can, in principle, lie about its own view state. The host is a coordinator for shared view-plane logic, not a referee. See [The Host Is a Convention](./host-is-a-convention.md).
:::

## Where the planes are allowed to touch

A client can ask the server's code to change a truth value, and is told the result. No gameplay value ever flows from the view plane into the truth plane as trusted input: the server's code decides from what it holds, not from what a client says it sees.

## What the split means for your code

Each of these follows from the split above. The page that owns the detail is linked.

1. **If a cheater would want to change it, it belongs on the truth plane.** Hit points, currency, inventory, scores, cooldowns, anything a win depends on. Crowdy State is for what players see: position, animation, a light that is on or off. The low latency of Crowdy State is not a reason to put a trusted value there.
2. **Never decide gameplay from another client's Crowdy State.** Every client writes its own view state and nothing checks it, so a remote client's health bar, hit flag or score in Crowdy State is a claim, not a fact. Read the trusted value from the server instead. See [Crowdy State](../runtime/crowdy-state.md).
3. **Change a trusted value by asking, not by writing.** The server's code decides and confirms; there is no client-side write to a trusted value. See [Game API best practices](/game-api/best-practices).
4. **Expect the confirmed value to arrive a moment later.** Predict locally if you must, and let the confirmed value overwrite the prediction.
5. **Do not build authority on "I am the host".** The host is an elected client that coordinates view-plane work; it can leave, change, or lie. Anything that must be true for everyone goes through the server's code. See [The Host Is a Convention](./host-is-a-convention.md).
6. **Every server id is 64-bit.** Store app, user and team ids as `int64` (Blueprint `Integer64`), never as a 32-bit integer or a parsed number; the app id travels as a string.
7. **A packaged build only knows the markers it was cooked with.** `CrowdyEvent` and `CrowdyState` markers are baked into a registry at cook time; add a marker, cook again, and never read Unreal metadata at runtime in shipped code. See [Packaging](../guides/packaging.md).

## Deciding where a field goes

Ask one question: **can a malicious client benefit from lying about this value?** If yes, it belongs on the truth plane. If no, it is view state.

:::danger[Authoritative or cheat-sensitive state never belongs in Crowdy State.]
Crowdy State is written by the client that owns the entity and believed by everyone else. A hit-point value there is a hit-point value the owner can set to a million.
:::

The table below is a guide, not a rule book. Each row names the mechanism that fits.

| State | Plane | Mechanism |
|---|---|---|
| Movement | View | Dynamic entity mode: the continuous state channel sends a snapshot every replication interval. |
| Animation blend state | View | A Crowdy State property (`meta=(CrowdyState)`), diffed and sent on change. |
| A one-shot effect trigger (a muzzle flash, an impact) | View | An RPC event (`meta=(CrowdyEvent)`), because a trigger is not continuous state. |
| Hit points | Truth | Your server code, which applies damage and heals. |
| Inventory | Truth | Your server code. |
| Currency | Truth | Server code that outlives any one match. |
| Match score | Truth | A hub for the match, such as the `session` [starter pack](/exec/builds#starter-packs)'s. |
| Chat | View | An RPC event with the `Multicast` recipient over the session channel. Not gameplay truth. |
| A cosmetic display name | View | A Crowdy State property. Route it through the avatars service instead if it has to persist. |

## Gotchas

- Low latency is not a reason to move a value to the view plane. Predict locally if you must, but let the server's confirmed value overwrite the prediction.
- The Blueprint **Crowdy Replication** dropdown's **Server Owned** choice marks a legacy Game Model attribute, which no server reads any more. Use **Replicated** for view state, and keep trusted values in your server code.

## Related

- [Entities, Identity, and Ownership](./entities-identity-ownership.md): what an entity is and who may write its view state.
- [The Host Is a Convention](./host-is-a-convention.md): what host election does and does not decide.
- [Crowdy State](../runtime/crowdy-state.md): the view-plane property system.
- [ck-exec overview](/exec/intro): where the truth plane's code runs.
