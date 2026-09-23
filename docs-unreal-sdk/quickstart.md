---
slug: quickstart
sidebar_position: 3
title: Quickstart
description: Sign in and sync your app, sign the player in at runtime, make your player pawn an entity the server can see, watch your own reflection, then build one lantern that shows an entity, an RPC event, a replicated property, and a server-owned value.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Quickstart

This page puts you on the wire, then builds one small thing, a lantern, with one of each SDK idea on it: an entity, an RPC event, a Crowdy State property, and a Game Model attribute. Each step is a few lines of C++ or a few Blueprint nodes, and each ends with something you can see. A single Play in Editor client is enough for all of it.

Two words you will meet on every step. An **entity** is an actor other players can see: an actor with a Crowdy Entity Component, which gives it a shared identity and one **owner**, the client that simulates it; every other client holds a **proxy** that plays back what the owner sends. A **map profile** is a small data asset (`UCrowdyMapProfile`) that switches the SDK on for one map; it is assigned per map under **Project Settings, Plugins, Crowdy SDK, Map Profiles**.

One fact shapes the order of the steps. The server knows a client by the actor updates it sends: your player pawn, as an entity, is what makes you present, and a client with no fresh actor is at no position on the map and receives no spatial event. So the pawn comes first, the lantern after.

## Before you start

1. [Install the plugin](./installation.md) into a project whose player already moves, the Third Person template or your own game, and confirm it compiles. Step 1 adds a component to the character you have; a bare Character has no body and no input, so start from one that walks.
2. Open Crowdy Studio, [sign in](./studio/sign-in.md), pick your app on the Project page, and press **Sync to project** on its Configuration tab. See [Config Sync](./studio/config-sync.md).
3. Optional: give your test map a [map profile](./runtime/map-profile.md) of its own. Without one it runs on the SDK's shipped default, which is enough for this page.
4. Know that nothing on this page reaches another client until your own pawn is sending updates (step 1). An event sent before that goes to nobody.

![The Project page's Configuration tab, with the diff and the Sync to project button](/img/unreal-sdk/qs-config-sync.png)

:::caution[If you skip the sync, the SDK has no app id or Game API URLs to connect with, and nothing replicates.]
:::

:::note[A map with no profile of its own runs on the SDK's shipped default.]
Config Sync points the project at an app; a map profile decides what the SDK does on a map. With none assigned, the shipped default applies (networking on, the actor pool drawing remote entities with the shipped transform policy), so every step below works without authoring one. Author a profile when you need per-map settings; see [Map profiles](./runtime/map-profile.md).
:::

## About the code on this page

The C++ steps build three small things. Step 0 is the Game Instance, `LanternGameInstance.h` and `LanternGameInstance.cpp`. Step 1 is your player, `LanternPlayer.h` and `LanternPlayer.cpp`, with a Game Mode, `LanternGameMode.h` and `LanternGameMode.cpp`, that spawns it at the right moment. Steps 3 to 6 build one actor, `ALantern`, in `Lantern.h` and `Lantern.cpp`: step 3 gives you both files, each later step is what you add to them, and the finished actor is at the end of the page. The first comment line of each block names the file it goes in. The usual boilerplate is left out so the SDK parts stand out: add `#pragma once`, `#include "CoreMinimal.h"`, and the base class include (`GameFramework/Actor.h`, `GameFramework/Character.h`, `GameFramework/GameModeBase.h`, `Components/ActorComponent.h`, or `Engine/GameInstance.h`) at the top of each header yourself. Everything else, including the `.generated.h` line, is in the block.

The Blueprint steps build the same three things: a Game Instance Blueprint, a Character Blueprint with a Game Mode Blueprint, and one Actor Blueprint for the lantern. The lantern needs two components before you start: a **Sphere Collision** (the trigger a player walks into) and a **Point Light** named `Light`, the thing every lantern graph drives. Every Blueprint figure can be panned with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

## 0. Sign the player in

Nothing connects by itself. The SDK requests its realtime connection only after a player signs in, so the game signs the player in once, at startup, from its Game Instance: call `Login` (or `Register` for a new account) on the Crowdy SDK subsystem and wait for two events: **On Login** (the account is signed in) and then **On UDP Connection Success** (the realtime connection is up). Every entity, event, property, and Game Model read below depends on that connection.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="qs-login" />

Make it the project's Game Instance under **Project Settings, Maps & Modes, Game Instance Class**, then give it a test account in `Config/DefaultGame.ini` (`YourModule` is your game module's name):

```ini
[/Script/YourModule.LanternGameInstance]
Email=you@example.com
Password=your-test-password
```

</TabItem>
<TabItem value="bp" label="Blueprint">

Create a Blueprint with **Game Instance** as its parent class and make it the project's Game Instance under **Project Settings, Maps & Modes, Game Instance Class**. In its event graph the **Init** event runs once at startup; the **Login** node is latent, with **On Success** and **On Error** pins. Fill in a test account.

<Blueprint src="qs-login" title="Init, Login" />

</TabItem>
</Tabs>

**Success signal.** The log reports `Login ok`, then `Connected to the app` (the two handlers in the C++ block; in Blueprint, bind **On UDP Connection Success** on the Crowdy SDK Subsystem for the second moment). From then on `Get UDP Connection State` on the subsystem reads connected. See [Authentication](./services/authentication.md) for the sign-in link and provider flows, and for restoring a saved session so a returning player types nothing.

:::caution[A test account belongs in a config file or a pin default, never in shipped code.]
:::

## 1. Make your player a Crowdy entity

Your player pawn is the first entity, before any lantern, because it is what makes you exist to the server. A pawn with a `UCrowdyEntityComponent` in **Dynamic** mode sends an actor update every replication interval (ten a second on the shipped profile), and a heartbeat at least once a second while it stands still; the server registers your position from those updates, and from then on you are a recipient of everything sent near you. The component needs three settings changed from their defaults: **Mode** Dynamic (the continuous channel; the default, Static, is for things that do not move), **Identity Policy** Player Derived (the identity is derived from the signed-in account, so it is the same on every client and on every launch; only valid on the locally controlled pawn), and **Ownership** Local Client (this client simulates the pawn; a pawn the Game Mode spawns is owned by the client that spawned it whatever this reads, so Local Client is the honest value; the default, Host, is for a level-placed world entity, which sends nothing until the elected host is known). Leave **State Executor** empty: the SDK's default executor snapshots the pawn's location and rotation, which is all this page needs.

The identity is derived once and nothing re-derives it later: at `BeginPlay` when the pawn already has a controller, otherwise inside its first possession, which for a pawn the Game Mode spawns during play is the `RestartPlayer` call that spawned it. A pawn spawned by the Game Mode on the first frame begins play before the sign-in has answered, and its first updates leave before the server is ready for them, so the Game Mode starts players as spectators and the connected handler spawns the pawn instead. **On UDP Connection Success** fires once the server has assigned you and its readiness wait has elapsed (the SDK times that, you never do), and every update the pawn sends after it counts.

Where the account id becomes readable. The engine possesses a pawn spawned during play only after its `BeginPlay`, so the component waits and registers inside that first possession, after the pawn's own **Possessed** and **Controller Changed** events; the first controller of any kind completes it, and an AI-possessed pawn takes the random-id fallback with its warning. A respawn that leaves the old pawn standing hands the account id to the new one, and the old pawn's component stops replicating. Read the id from the component's **On Crowdy Ownership Assigned** (`OnCrowdyOwnershipAssigned`) or the entity subsystem's `OnEntityRegistered`, never from `BeginPlay` or **Possessed**; **Is Locally Owned** on the pawn reads false until that registration, so a pawn graph that gates on it at `BeginPlay` runs nothing.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`ALanternPlayer` is a Character with a `Torch` point light and the entity component. `ALanternGameMode` names it as the default pawn, starts players as spectators, binds **On UDP Connection Success** in its own `BeginPlay`, and spawns the pawn with `RestartPlayer` when the event fires. The event fires again after a re-assignment, and `RestartPlayer` keeps a pawn the player already has, so a reconnect does not respawn you.

<CppSnippet id="qs-player" />

<CppSnippet id="qs-player-spawn" />

`ALanternPlayer` has no mesh and no input of its own, so keep the body and the movement you already have: open the template's `BP_ThirdPersonCharacter` (or your own Character), set its **Parent Class** to `Lantern Player` under **Class Settings**, then create a Blueprint whose parent is `Lantern Game Mode` and set its **Default Pawn Class** to that character, overriding the C++ class the constructor names. Make that Game Mode Blueprint the project's default under **Project Settings, Maps & Modes, Default Modes, Default GameMode**, or set it as the test map's Game Mode Override in World Settings. The Game Instance from step 0 is unchanged.

</TabItem>
<TabItem value="bp" label="Blueprint">

Three Blueprints, two of them settings only.

1. **The Character.** Open the template's `BP_ThirdPersonCharacter`, or your own Character that already moves; a new Blueprint with **Character** as its parent has no body and no input, so do not start from one. In the Components panel click **Add** and choose **Crowdy Entity Component**. In its Details panel, under **Crowdy SDK, Entity Component**, set **Mode** to **Dynamic**, **Identity Policy** to **Player Derived**, and **Ownership** to **Local Client**. Two rows appear once Mode is Dynamic, **State Executor** and **Auto Register**: leave the executor at None and Auto Register ticked; a third, **Host Override**, appears once Ownership is Local Client: leave it at Allow. Add a **Point Light** named `Torch` while you are there; a later page drives it.
2. **The Game Mode.** Create a Blueprint with **Game Mode Base** as its parent class. Set **Default Pawn Class** to your Character and tick **Start Players as Spectators** under **Game Mode**. Make it the project's default under **Project Settings, Maps & Modes, Default Modes, Default GameMode**.
3. **The spawn.** In the Game Mode's event graph, from **Event BeginPlay**, get the **Crowdy SDK Subsystem** and **Bind Event to On UDP Connection Success** to a custom event `OnConnected` (the same **Bind Event** shape the [Authentication](./services/authentication.md#after-sign-in) page uses for On Login). `OnConnected` calls **Restart Player** with **Get Player Controller** (index 0) on its New Player pin. The Game Instance from step 0 is unchanged.

![The entity component's Details panel at its defaults: change Mode, Identity Policy, and Ownership](/img/unreal-sdk/entity-mode-identity.png)

<Blueprint src="qs-player-spawn" title="Event BeginPlay, Crowdy SDK Subsystem, Bind Event to On UDP Connection Success, OnConnected, Get Player Controller, Restart Player" />

</TabItem>
</Tabs>

**Success signal.** Press Play. The map sits still under a fixed camera until `Connected to the app`, then your character spawns at a Player Start and you can move it. With `crowdy.entity.trace 1` on, the log shows the pawn's entity registering on the wire right after the connection comes up.

:::caution[A pawn that begins play before the sign-in has answered derives its identity from user id 0.]
Nothing warns. Two such clients conflate into one player, and the host cannot be found by its avatar. Keep the pawn's spawn behind **On UDP Connection Success**, as the block does: the pawn then registers under your account's id inside the possession that `RestartPlayer` performs.
:::

## 2. See yourself

Walk forward. Within a second or two a second copy of your character appears where you were a moment ago and follows you around at a small delay (if you kept a bare Character with no mesh, the copy is the torch light alone). That is not a local mirror: your updates went to the server, the server fanned them back to every client in range, you included, and the actor pool on this client drew the result as a proxy of your own class, interpolated to about 100 milliseconds plus one round trip behind you. The shipped profile keeps that echo because **Enable Owner Tracking** on the map profile defaults to on; turning it off drops your own echo and nothing else.

What it means: the server received your updates, so you exist to it. The same updates are what make you a recipient of the lantern's event in step 4. In a shipped game you hide one side of the pair yourself (`SetActorHiddenInGame` on the local pawn when `IsLocallyOwned()`, or leave the echo off); for this page, keep it: it is the proof.

{/* Screenshot pending: qs-own-reflection (window shot, user-driven; steps in the shot manifest). */}

The other way to see the same thing is two real clients. Open two Play in Editor windows signed into two different accounts, as [Testing locally](./guides/testing-locally.md#two-pie-client-setup) describes; each window shows the other's pawn as a proxy, moving as its owner moves.

**Success signal.** A second character follows you. If none appears, check in this order: the log shows `Connected to the app`; the pawn spawned after it, not on the first frame; the map's profile (or the shipped default) has its actor tracker on; `crowdy.entity.trace 1` shows the registration.

## 3. Light a lantern

An entity is an actor with a `UCrowdyEntityComponent`. Two of the component's defaults are what most level-placed things want: **Static** mode (event-only; the other mode, **Dynamic**, streams a state snapshot every replication interval, as your pawn does) and a **Stable** identity every client derives the same way. This example changes the third: it sets **Ownership** to Local Client, so the client that placed the lantern owns it the moment it registers. With the default, Host, an entity is owned by the elected host, and `IsLocallyOwned()` stays false until the host is known, which happens after the sign-in above completes.

The lantern is a sphere trigger with a point light on it. On the client that owns it, the light turns blue; on every other client it keeps its default colour. That is the ownership question, asked once at `BeginPlay`.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="qs-entity" />

</TabItem>
<TabItem value="bp" label="Blueprint">

In the Actor Blueprint, click **Add** in the Components panel and choose **Crowdy Entity Component**, then set its **Ownership** to **Local Client** in the Details panel. In the event graph:

<Blueprint src="qs-entity" title="BeginPlay, Is Locally Owned, Branch, Set Light Color on Light" />

</TabItem>
</Tabs>

**Success signal.** Place the lantern in the map and press Play. Its light is blue, because this client owns it. The component also broadcasts `OnCrowdyOwnershipAssigned` on every client on the tick after the entity registers, with `bIsLocallyOwned` true on the owner; bind to it when you need the answer from an event rather than a poll. Once the sign-in has connected, `crowdy.entity.trace 1` logs the entity's registration on the wire.

## 4. Send one RPC event

An RPC event is a function you mark with `CrowdyEvent`. You call it like any function; the SDK runs the matching receiver on the other clients. The recipient decides who: `SpatialMulticast` (everyone in range, the default), `Multicast` (everyone on the session channel), `OwningClient`, or `Host`. A spatial event is addressed by position, and a client's position is the one its pawn's updates registered: this works now because step 1 put you on the map, and it reaches only clients whose pawns did the same.

The lantern's event is `Flicker`: walking into the lantern blinks its light off and on for a moment, and every client in range sees the blink. Only the owning client reacts to the overlap; on a `SpatialMulticast` event the owner runs the body itself and sends it to everyone in range, so a proxy's copy of the overlap must not send a second one.

In C++ the pattern has two halves. The **receiver** is a normal `UFUNCTION` you declare yourself, named `<Name>_Implementation` and tagged with the `CrowdyEvent` meta; it is what runs on every recipient. The **call site** is `CROWDY_EVENT(<Name>)`, a macro placed inside the class body (no trailing semicolon) that generates `<Name>(...)`: calling it marshals the arguments and sends them. The receiver has to be a real `UFUNCTION` because the header tool does not expand macros when it scans for reflected functions.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="qs-event" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A replicated event is a Custom Event with **Crowdy Replicates** ticked in its Details panel and a **Recipient** chosen there. The figure is the receiver. Call it by name from any graph on the actor, exactly like a local custom event: from **Event ActorBeginOverlap**, behind the same **Is Locally Owned** branch as step 3; the call node is the ordinary one the editor offers for any custom event.

<Blueprint src="qs-event" title="Flicker, a Custom Event with Crowdy Replicates ticked, Recipient Spatial Multicast" />

</TabItem>
</Tabs>

**Success signal.** Walk your pawn into the lantern: the light blinks. With one client there is nobody else to receive the event (a sender never receives its own event from the network); to see the send and the receive on the wire, loop it back to yourself:

```text
crowdy.rpc.loopback 1
crowdy.rpc.trace 1
```

Now the blink comes from the looped-back receive instead of the local run, and the trace logs the send and the receive (function, entity, addressing, parameter bytes). Turn both off before you measure anything.

## 5. Replicate one property

A Crowdy State property is a `UPROPERTY` marked `CrowdyState`. On the lantern, which step 3 made Local Client owned, the owner assigns and stops: the SDK diffs the property every tick, ships the change to every proxy, then runs the `CrowdyOnRep` function there. That is the client-owned pattern, in either entity mode, Static or Dynamic. A host-owned entity is different: the lantern post on the [identity page](./concepts/entities-identity-ownership.md#example), or any placed actor left at **Ownership** = Host, never ships a plain assignment; mark the property `CrowdyManualDirty` and call `MarkStateDirty` on the entity component after each write (or give it `CrowdyHeartbeat`), as [the host push](./runtime/crowdy-state.md#on-an-entity-you-do-not-own-the-host-push) explains.

The flicker in step 4 is a moment: a client that joins afterwards never sees it. The lantern's lit state is different, it has to be the same on every client, late joiners included, so it is a replicated property, `bLit`. Walking out of the lantern flips it, and `OnRep_Lit` applies it to the light wherever the value lands. The SDK runs the owner's notify too, on the tick that ships the change; calling it here as well makes the light react on the same frame. That is safe because `OnRep_Lit` only applies the current value.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="qs-state" />

</TabItem>
<TabItem value="bp" label="Blueprint">

There is no node for this; it is a setting on the variable.

1. Add a Boolean variable named `Lit` to the Actor Blueprint, default true.
2. Select it in **My Blueprint** and find the **Crowdy Replication** dropdown in the Details panel.
3. Set it to **Replicated**. A **RepNotify** field appears; the editor creates an `OnRep_Lit` function for you. In it, call **Set Visibility** on `Light` with `Lit`.
4. Compile. The variable's Get and Set nodes now show the replication badge in their corner.

From **Event ActorEndOverlap**, behind the same **Is Locally Owned** check, set `Lit` to NOT `Lit` and call `OnRep_Lit`. That is the client-owned pattern, the lantern's. On a host-owned actor (Ownership left at Host) a plain Set ships nothing: tick **Update manually** in the same dropdown and call **Mark Crowdy State Dirty** with the variable on its Property Name pin after each Set; see [the host push](./runtime/crowdy-state.md#on-an-entity-you-do-not-own-the-host-push). See [Crowdy State](./runtime/crowdy-state.md) for the other toggles in that dropdown.

</TabItem>
</Tabs>

:::warning[Crowdy State and Unreal replication are mutually exclusive on one variable.]
A Blueprint variable that is both natively Replicated and Crowdy Replicated fails to compile with an error in the Message Log. In C++, keep `Replicated` off a `CrowdyState` property. Pick one.
:::

**Success signal.** Walk through the lantern: the light goes out, and stays out; walk through again and it comes back. A single client owns the property but has no proxy to receive it, so to see the delivery, spawn a local mirror:

```text
crowdy.state.loopback 1
crowdy.state.trace 1
```

The trace logs each delta and its size, and `OnRep_Lit` runs on the mirror. Turn both off afterwards.

## 6. Read one server-owned value

A Game Model attribute lives on the server. You declare it on a container class, attach the container to an entity, sync the schema from Crowdy Studio, and read the confirmed value; a change goes through an Effect on the server, never through a client write.

The lantern's server-owned value is its fuel. The light's intensity follows it: when the confirmed value lands, the light dims to the fuel level (100 by default), and it follows every later change the server confirms.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The container, in its own two files, `LanternFuel.h` and `LanternFuel.cpp`:

<CppSnippet id="qs-model-read" />

The `CrowdyContainer` value is the model's name on the server; the `CrowdyKey` is the attribute's name there, lowercase. Then the lantern carries it, created in the constructor next to the entity component so it binds when the entity registers:

<CppSnippet id="qs-model-attach" />

</TabItem>
<TabItem value="bp" label="Blueprint">

1. In the Blueprint editor toolbar, open the **Crowdy SDK** menu and tick **Game Model Class**. The Blueprint is now a container.
2. Add a Float variable named `Fuel`, default 100, select it, and set its **Crowdy Replication** dropdown to **Server Owned**.
3. Compile, then listen for the confirmed values. **Listen for Model Changes** fires **On Game Model Changed** each time a confirmed value lands on the actor it targets, the first pull included; **Get Model Attribute (Float)** reads the cached server value by key.

<Blueprint src="qs-model-read" title="BeginPlay, Listen for Model Changes, Get Model Attribute (Float) by key, Set Intensity on Light" />

</TabItem>
</Tabs>

Then open Crowdy Studio, go to the **Game Model** page, and press **Sync to Server** so the server learns about the new model and attribute. Relaunch Play afterwards. See [Game Models authoring](./studio/game-models-authoring.md).

:::caution[Never write an attribute from the client.]
A client assignment to `Fuel` changes a local copy that the next server pull overwrites. To change the value, apply an Effect; the server runs it, confirms the result, and every bound client re-pulls. See the [Game Models overview](./game-models/overview.md).
:::

**Success signal.** Shortly after the connection is up, the light dims to the fuel level: `OnRep_Fuel` (or **On Game Model Changed**) ran with the confirmed value. `Is Game Model Ready` (`UCrowdyModel::IsContainerBound` in C++) turns true at the same moment, once the container is bound and the first values have landed. For the full story, including identity resolution and the pull, turn on `crowdy.gamemodel.trace 1`.

## 7. The finished lantern

The two lantern files after steps 3 to 6, for comparison with your own:

<CppSnippet id="qs-lantern-complete" />

## Gotchas

- No login, no connection. Until `Get UDP Connection State` reads connected, every step looks dead.
- No pawn, no presence. The server knows you by your pawn's updates; a client whose pawn is not sending is at no position and receives no spatial event, and its own spatial sends reach nobody. A `Multicast` event is the exception: it goes by session channel membership, which connecting joins.
- Spawn the pawn after **On UDP Connection Success**. Before it, the identity derives from user id 0 and the first updates leave before the server is ready to take them; nothing is queued or replayed, the next interval's update is the recovery. A pawn spawned after it registers inside its first possession, so read its id from **On Crowdy Ownership Assigned**, not at `BeginPlay`.
- The Game Mode binds the event in its own `BeginPlay`. A map opened after the connection is already up never sees it; check **Get UDP Connection State** at `BeginPlay` first and restart the player at once when it reads connected, or bind in the Game Instance and spawn from there.
- A map whose `MapProfiles` row or `DefaultProfile` names an asset that did not load is inactive; the warning names the asset. Check that before any code. A map with no row at all runs on the shipped default.
- The loopback variables are test aids. Leave them off in a normal session; they change what a single client sees.
- An RPC receiver must be a real `UFUNCTION` you declare yourself; the `CROWDY_EVENT` macro only generates the call site.
- A Game Model attribute exists on the server only after a sync. A read before that returns the default you pass.

## Next steps

- [The Two Planes](./concepts/two-planes.md): decide where each new piece of state goes.
- [Entities, Identity, and Ownership](./concepts/entities-identity-ownership.md): owner, proxy, host, and what Ownership chooses.
- [Sessions and presence](./concepts/sessions-and-presence.md): what the server counts as a present player, and when it stops.
- [Continuous state](./runtime/continuous-state.md): what your pawn sends every interval, and how to send more than the transform.
- [Entities and spawning](./runtime/entities-and-spawning.md): spawn entities at runtime and receive them on remote clients.
- [RPC events in C++](./runtime/rpc-events-cpp.md) and [in Blueprint](./runtime/rpc-events-blueprint.md).
- [Crowdy State](./runtime/crowdy-state.md): the five metadata keys and what each does.
- [Game Models](./game-models/overview.md): effects, policies, and sessions.
