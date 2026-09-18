---
slug: quickstart
sidebar_position: 3
title: Quickstart
description: Sign in and sync your app, sign the player in at runtime, then build one lantern that shows an entity, an RPC event, a replicated property, and a server-owned value.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Quickstart

This page builds one small thing, a lantern, and puts one of each SDK idea on it: an entity, an RPC event, a Crowdy State property, and a Game Model attribute. Each step is a few lines of C++ or a few Blueprint nodes, and each ends with something you can see. A single Play in Editor client is enough for all of it.

Two words you will meet on every step. An **entity** is an actor other players can see: an actor with a Crowdy Entity Component, which gives it a shared identity and one **owner**, the client that simulates it; every other client holds a **proxy** that plays back what the owner sends. A **map profile** is a small data asset (`UCrowdyMapProfile`) that switches the SDK on for one map; it is assigned per map under **Project Settings, Plugins, Crowdy SDK, Map Profiles**.

## Before you start

1. [Install the plugin](./installation.md) and confirm your project compiles.
2. Open Crowdy Studio, [sign in](./studio/sign-in.md), pick your app on the Project page, and press **Sync to project** on its Configuration tab. See [Config Sync](./studio/config-sync.md).
3. Optional: give your test map a [map profile](./runtime/map-profile.md) of its own. Without one it runs on the SDK's shipped default, which is enough for this page.

![The Project page's Configuration tab, with the diff and the Sync to project button](/img/unreal-sdk/qs-config-sync.png)

:::caution[If you skip the sync, the SDK has no app id or Game API URLs to connect with, and nothing replicates.]
:::

:::note[A map with no profile of its own runs on the SDK's shipped default.]
Config Sync points the project at an app; a map profile decides what the SDK does on a map. With none assigned, the shipped default applies (networking on, the actor pool drawing remote entities with the shipped transform policy), so every step below works without authoring one. Author a profile when you need per-map settings; see [Map profiles](./runtime/map-profile.md).
:::

## About the code on this page

The C++ steps build one actor, `ALantern`, in two files, `Lantern.h` and `Lantern.cpp`. Step 1 gives you both files; each later step is what you add to them, and the finished actor is at the end of the page. The first comment line of each block names the file it goes in. The usual boilerplate is left out so the SDK parts stand out: add `#pragma once`, `#include "CoreMinimal.h"`, and the base class include (`GameFramework/Actor.h`, `Components/ActorComponent.h`, or `Engine/GameInstance.h`) at the top of each header yourself. Everything else, including the `.generated.h` line, is in the block.

The Blueprint steps build one Actor Blueprint the same way. It needs two components before you start: a **Sphere Collision** (the trigger a player walks into) and a **Point Light** named `Light`, the thing every graph below drives. Every Blueprint figure can be panned with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

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

**Success signal.** The log reports `Login ok`, then `Connected to the app` (the two handlers in the C++ block; in Blueprint, bind **On UDP Connection Success** on the Crowdy SDK Subsystem for the second moment). From then on `Get UDP Connection State` on the subsystem reads connected. See [Authentication](./services/authentication.md) for the sign-in link and provider flows.

:::caution[A test account belongs in a config file or a pin default, never in shipped code.]
:::

## 1. Add one entity

An entity is an actor with a `UCrowdyEntityComponent`. Two of the component's defaults are what most level-placed things want: **Static** mode (event-only; the other mode, **Dynamic**, streams a state snapshot every replication interval) and a **Stable** identity every client derives the same way. This example changes the third: it sets **Ownership** to Local Client, so the client that placed the lantern owns it the moment it registers. With the default, Host, an entity is owned by the elected host, and `IsLocallyOwned()` stays false until the host is known, which happens after the sign-in above completes.

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

## 2. Send one RPC event

An RPC event is a function you mark with `CrowdyEvent`. You call it like any function; the SDK runs the matching receiver on the other clients. The recipient decides who: `SpatialMulticast` (everyone in range, the default), `Multicast` (everyone on the session channel), `OwningClient`, or `Host`.

The lantern's event is `Flicker`: walking into the lantern blinks its light off and on for a moment, and every client in range sees the blink. Only the owning client reacts to the overlap; on a `SpatialMulticast` event the owner runs the body itself and sends it to everyone in range, so a proxy's copy of the overlap must not send a second one.

In C++ the pattern has two halves. The **receiver** is a normal `UFUNCTION` you declare yourself, named `<Name>_Implementation` and tagged with the `CrowdyEvent` meta; it is what runs on every recipient. The **call site** is `CROWDY_EVENT(<Name>)`, a macro placed inside the class body (no trailing semicolon) that generates `<Name>(...)`: calling it marshals the arguments and sends them. The receiver has to be a real `UFUNCTION` because the header tool does not expand macros when it scans for reflected functions.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="qs-event" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A replicated event is a Custom Event with **Crowdy Replicates** ticked in its Details panel and a **Recipient** chosen there. Call it by name from any graph on the actor, exactly like a local custom event: here from **Event ActorBeginOverlap**, behind an **Is Locally Owned** check like the one in step 1.

<Blueprint src="qs-event" title="Flicker, a Custom Event with Crowdy Replicates ticked, Recipient Spatial Multicast" />

</TabItem>
</Tabs>

**Success signal.** Walk the pawn into the lantern: the light blinks. With one client there is nobody else to receive the event; to see the send and the receive on the wire, loop it back to yourself:

```text
crowdy.rpc.loopback 1
crowdy.rpc.trace 1
```

Now the blink comes from the looped-back receive instead of the local run, and the trace logs the send and the receive (function, entity, addressing, parameter bytes). Turn both off before you measure anything.

## 3. Replicate one property

A Crowdy State property is a `UPROPERTY` marked `CrowdyState`. The owning client changes it; the SDK diffs it every tick and ships the change to every proxy, then runs the `CrowdyOnRep` function there. It works in either entity mode, Static or Dynamic.

The flicker in step 2 is a moment: a client that joins afterwards never sees it. The lantern's lit state is different, it has to be the same on every client, late joiners included, so it is a replicated property, `bLit`. Walking out of the lantern flips it, and `OnRep_Lit` applies it to the light wherever the value lands. The SDK runs the owner's notify too, on the tick that ships the change; calling it here as well makes the light react on the same frame. That is safe because `OnRep_Lit` only applies the current value.

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

From **Event ActorEndOverlap**, behind the same **Is Locally Owned** check, set `Lit` to NOT `Lit` and call `OnRep_Lit`. See [Crowdy State](./runtime/crowdy-state.md) for the other toggles in that dropdown.

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

## 4. Read one server-owned value

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

## The finished lantern

The two C++ files after the four steps, for comparison with your own:

<CppSnippet id="qs-lantern-complete" />

## Gotchas

- No login, no connection. Until `Get UDP Connection State` reads connected, every step looks dead.
- Nothing happens on a map without a profile. Check that before any code.
- The loopback variables are test aids. Leave them off in a normal session; they change what a single client sees.
- An RPC receiver must be a real `UFUNCTION` you declare yourself; the `CROWDY_EVENT` macro only generates the call site.
- A Game Model attribute exists on the server only after a sync. A read before that returns the default you pass.

## Next steps

- [The Two Planes](./concepts/two-planes.md): decide where each new piece of state goes.
- [Entities, Identity, and Ownership](./concepts/entities-identity-ownership.md): owner, proxy, host, and what Ownership chooses.
- [Entities and spawning](./runtime/entities-and-spawning.md): spawn entities at runtime and receive them on remote clients.
- [RPC events in C++](./runtime/rpc-events-cpp.md) and [in Blueprint](./runtime/rpc-events-blueprint.md).
- [Crowdy State](./runtime/crowdy-state.md): the five metadata keys and what each does.
- [Game Models](./game-models/overview.md): effects, policies, and sessions.
