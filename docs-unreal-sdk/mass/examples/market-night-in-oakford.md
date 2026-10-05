---
slug: market-night-in-oakford
sidebar_position: 1
title: Market night in Oakford
description: "A worked Crowds with Mass example in Oakford, end to end: the map profile, the material flag, the anim set and bank, a sitting pose, a wave and a cheer, a near tier actor for close players, a torch brightness field, and raiders whose Health is read from the server."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Market night in Oakford

On market night the village square fills with players, far more than the actor pool should draw as real actors. So the Oakford map draws every other player as a row of a crowd. This page builds that, step by step. You switch the map, give the crowd a look, add a sitting pose, a wave and a cheer, promote the players standing close, dim and brighten a torch, and read the health of the raiders on the north road from the server.

Each step shows the values and the order. [Draw a crowd with Mass](../draw-a-crowd-with-mass.md) and the pages linked from each step explain why. Every player is still a real actor on their own machine. A row is how another player's machine draws them.

## What you start from

The player is `ALanternPlayer`, a character class with a `Torch` point light and a `ULanternPlayerExecutor`. The executor sends `FLanternPlayerState`, which holds `Location`, `Rotation` and `bTorchLit`. Build it as [Continuous State](../../runtime/continuous-state.md#a-custom-executor) does, not as the [Quickstart](../../quickstart.md) leaves it. The crowd reads `Location` and `Rotation` to place a row. See [Make a character draw as a crowd row](../make-a-character-draw-as-a-crowd-row.md).

`BP_LanternPlayer` is your own Blueprint subclass of `ALanternPlayer`. It needs a skeletal mesh and the movement and input you already have, not a bare Character. Its Crowdy Entity Component is set to **Dynamic**, **Player Derived** and **Local Client**. You also need an idle, walk, run, sitting, fallen, wave and cheer clip for its skeleton.

Two parts need C++: the `Build.cs` lines, and the torch data under [Brighten the torch](#brighten-the-torch), which is a fragment, a trait, a processor and a field registration. Every other step has a Blueprint half and a C++ half that do the same thing.

The rules of the night:

- Players walk, run and stand at the stalls. One key (X) sits a player down and the same key stands them up again. A seated player's torch burns low.
- A player who trips on the cobbles lies on the ground until they are helped up.
- A wave of the torch (V) greets everyone in range. The inspect key (I) marks the player you are looking at, and the cheer key (C) sends a cheer at them.
- The players standing close to you get a real actor with the full animation graph. The rest of the square is rows.
- You can read how bright another player's torch is.
- The raiders camped on the north road are drawn as rows too. The health key (H) shows you how hurt the one you marked is.

## Add the module

The game module lists `CrowdyMass` in its `Build.cs`. This example declares fragments, a trait and a processor of its own, so it lists the engine's Mass modules too.

```csharp
PublicDependencyModuleNames.AddRange(new string[]
{
    "CrowdySDK", "CrowdyNet", "CrowdyReplication", "CrowdyServices",
    "CrowdyMass", "MassCore", "MassEntity", "MassSpawner"
});
```

There is no plugin to enable. See [Turn Mass on for a map](../turn-mass-on-for-a-map.md).

## Switch the Oakford map to Mass

1. In the Content Browser, click **Add**, then **Miscellaneous**, then **Data Asset**, and pick **Crowdy Map Profile**. Name it `DA_OakfordProfile`.
2. Open it. Under **Actor Management**, set **Backend Class** to **Crowdy Mass Rendering Backend**.
3. Leave **Enable Networking** ticked and **Backend Config** empty. The backend then reads **Project Settings, Plugins, Crowdy Mass**.
4. In **Project Settings, Plugins, Crowdy SDK**, open **Map Profiles** and add an entry that maps the Oakford map to `DA_OakfordProfile`. See [Assign the profile](../../runtime/map-profile.md#assign-the-profile).

You could also start from the shipped profile `/CrowdySDK/Mass/Data/DA_CrowdyMassDefaultProfile`, which already selects the Mass backend. Every other map keeps the actor pool.

From now on, on the Oakford map, a player you see on your screen is a crowd row, not a spawned `BP_LanternPlayer`. Your own pawn is still a real actor. See [Turn Mass on for a map](../turn-mass-on-for-a-map.md).

## Flag the material

1. Open the parent material of the lantern player's body, `M_LanternPlayer`. Open the parent, not a material instance.
2. Under **Usage**, tick **Used with Instanced Skinned Mesh**.
3. Save the material.

Skip this and the whole square is grey. [Fix a crowd that does not look right](../troubleshooting.md) has the checklist.

## The engine's animation pass

There is nothing to do here. The SDK hands each lantern player's animation to the renderer itself, and it turns the engine's own animation pass off for you when the game starts. Oakford needs no `DefaultMass.ini` for it. See [The engine's animation pass](../turn-mass-on-for-a-map.md#the-engines-animation-pass).

## Check the class with `crowdy.mass.derive`

Before you run anything, in the editor console:

```
crowdy.mass.derive BP_LanternPlayer
```

It prints the mesh it found on `BP_LanternPlayer`, which of the three routes supplied the mesh, the trace collision object type, and whether every material slot is flagged. It warns if the mesh is missing, if a material is not flagged, or if an authored config would win. The editor world has no Mass subsystem, so the anim set and the config answer appear only when you run the same command in Play In Editor, after the anim set below.

Nothing here needs an entity config of your own: Mass works one out from the class. See [Make a character draw as a crowd row](../make-a-character-draw-as-a-crowd-row.md).

## Look at the square

On one machine you see no crowd, because the backend does not draw your own entity as a row. Pick one of these:

- Give `DA_OakfordProfile` a **Backend Config** of **Crowdy Mass Backend Config** and tick **Render Local Owner** under **Mass Backend, Debug**. Your pawn then also draws as a row, overlapping the real one. Turn it off when you are done.
- Or place a **Crowdy Mass Area Spawner** in the square, with **Entity Class** `BP_LanternPlayer` and **Entity Count** 200.

See [Turn Mass on for a map](../turn-mass-on-for-a-map.md) for both. With two Play In Editor windows you see the real thing: each window shows the other player as a row, moving.

## Give the crowd legs

1. In the Content Browser, click **Add**, then **Miscellaneous**, then **Data Asset**, and pick **Crowdy Mass Anim Set**. Name it `DA_LanternPlayerAnims`.
2. Create the bank `TP_LanternPlayer`, the asset the crowd renders through, and add the idle, walk, run, sitting and fallen clips to it, each in its own slot. [Set up the animation set](../set-up-the-animation-set.md) shows how. Then set `TP_LanternPlayer` as `DA_LanternPlayerAnims`'s **Bank**. The config the SDK builds from `BP_LanternPlayer` draws its mesh through that bank, so nothing else needs authoring.
3. Under **Gaits**, add three rows, slowest first. Speeds are in Unreal units per second.

   | Gait Name | Sequence | Enter Speed | Exit Speed |
   |---|---|---|---|
   | `Idle` | the idle clip | 0 | 0 |
   | `Walk` | the walk clip | 100 | 60 |
   | `Run` | the run clip | 400 | 330 |

4. Add a **Crowdy Mass Anim Set** component to `BP_LanternPlayer` and set its **Anim Set** to `DA_LanternPlayerAnims`.

Which gait a row plays comes from how fast it moves on your screen. Nothing about gaits is sent. See [Set up the animation set](../set-up-the-animation-set.md).

## Sit and fall

A pose is held state, so something must say which one. On `ALanternPlayer` that is the `Stance` property of the enum `ELanternStance : uint8`, with the values `Standing`, `Sitting` and `Fallen`. The property is marked `CrowdyState` and `CrowdyHeartbeat`. A dropped change would otherwise leave a player sitting on every other screen until something else changed.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="mass-stance-decl" />

</TabItem>
<TabItem value="bp" label="Blueprint">

1. Add a variable named `Stance` to `BP_LanternPlayer`, of the `ELanternStance` enum.
2. In the variable's details, set **Replication** under **Crowdy Replication** to **Replicated**, and leave **Keyframe heartbeat** ticked.
3. Compile.

</TabItem>
</Tabs>

In `DA_LanternPlayerAnims`, under **Pose State**, leave **Pose State Enum Is** on **Native By Name** and pick `ELanternStance` as the **Pose State Enum**. Add two **Poses** rows:

| Pose Name | Sequence | Rank | Hold Last Frame |
|---|---|---|---|
| `Sitting` | the sitting clip | **Below Actions** | off |
| `Fallen` | the fallen clip | **Above Actions** | on |

`Standing` is value 0 and has no row. A value with no row clears the pose and the row walks or idles again. `Sitting` is ranked **Below Actions**, so a wave plays over a player who is sitting. `Fallen` is ranked **Above Actions**, so nobody waves from the ground.

The sit key toggles `Stance`. It also sets `TorchBrightness` to 0.3 while the player sits and 1.0 while they stand, and sets the intensity of the local `Torch` light to match. `TorchBrightness` is the property you add under [Brighten the torch](#brighten-the-torch). The sit key is the only thing that sets it.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="mass-stance-set" />

Bind `OnSit` to the sit key.

</TabItem>
<TabItem value="bp" label="Blueprint">

1. In `BP_LanternPlayer`, add the **X** key event. From **Pressed**, add **Is Crowdy Entity Locally Controlled** and a **Branch**, so only the pawn you control writes.
2. On true, add a second **Branch** on an **Equal (Enum)** that compares **Get Stance** to `Sitting`. On true, call **Set Stance** with `Standing`. On false, call **Set Stance** with `Sitting`.

<Blueprint src="mass-sit-stance" title="X, Branch on Is Crowdy Entity Locally Controlled, Branch on Stance equal to Sitting, Set Stance (Standing or Sitting)" />

Pan a Blueprint figure with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

Then, after either **Set Stance**, call **Set TorchBrightness** with a **Select Float** on whether **Get Stance** now equals `Sitting`: 0.3 if so, 1.0 if not. Call **Set Intensity** on the `Torch` component with **Get TorchBrightness** times 2000.

</TabItem>
</Tabs>

Press the key in one window. In the other, the row sits within a moment. Press it again and the row stands and walks. Set `Stance` to `Fallen` from your own knock-down code in the same way. See [Play poses and one-shot actions](../play-poses-and-one-shot-actions.md).

Each pose needs its own slot in `TP_LanternPlayer`. If a pose shares a slot with a gait, a player who leaves the pose stays frozen in it, and the anim set's validation says so when the set has a **Bank**.

## Wave the torch and cheer

An action is a one-shot that plays once and returns to walking. The anim set gets two rows under **Actions**, in this order:

| Action Name | Sequence |
|---|---|
| `Wave` | the wave clip |
| `Cheer` | the cheer clip |

Press **Sync Actions Into Bank**. It adds each clip to `TP_LanternPlayer` twice and fills in **Primary Index** and **Alternate Index** for both rows. Action ids start at 1 and follow the row order, so `Wave` is 1 and `Cheer` is 2.

### The wave: an event marked an action

`WaveTorch` is a Crowdy event on `ALanternPlayer`. It goes to everyone in range, it is marked an action, and it takes `ActionId`, `Variant` and `PlayRate`. Marked like that, a machine that holds the player as a row starts the matching action row with no code written for it.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="mass-wave-decl" />

The body plays the same action on a machine that holds the player as a real actor. The wave key calls `WaveTorch` with the id of `Wave`:

<CppSnippet id="mass-wave-body" />

Bind `OnWave` to the wave key.

</TabItem>
<TabItem value="bp" label="Blueprint">

1. In the Event Graph of `BP_LanternPlayer`, add a **Custom Event** named `WaveTorch`.
2. In Details, tick **Crowdy Replicates**, set **Recipient** to **Spatial Multicast** and tick **Is A One-Shot Action**.
3. Press **Add Parameters**. It creates the `ActionId`, `Variant` and `PlayRate` pins.
4. Compile. The marker is read off the compiled event, so recompile after you tick the box.
5. From the event, add **Play Crowdy Mass Action**. Wire the **Mesh** component to its **Mesh** pin, and `ActionId`, `Variant` and `PlayRate` to the matching pins.

<Blueprint src="mass-wave-body" title="WaveTorch, a replicated one-shot action event, into Play Crowdy Mass Action" />

Then, on the **V** key, call `WaveTorch` with `ActionId` 1, `Variant` 0 and `PlayRate` 1.

</TabItem>
</Tabs>

One call, three outcomes. On a machine that holds the player as a real actor, the body plays the clip. On a machine that holds a crowd row, or a near tier actor, the body runs on a stand-in and the declared action plays on the row. The near tier actor shows the same action through its animation Blueprint.

The mesh's animation graph needs a Slot node named `DefaultSlot`, which the stock mannequin graph already has. [Play poses and one-shot actions](../play-poses-and-one-shot-actions.md) owns the declaration and the body, and [Run your code on a crowd row](../run-your-code-on-a-crowd-row.md) explains the stand-in.

### The cheer: send an action by name

A cheer needs no event of its own. The inspect key traces from the camera and keeps the hit's `Target` when it hit a Mass entity. The cheer key sends the action by name to the player you kept.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="mass-trace-target" />

<CppSnippet id="mass-send-action" />

Bind `OnInspect` to the inspect key and `OnCheer` to the cheer key.

</TabItem>
<TabItem value="bp" label="Blueprint">

To mark a player:

1. Add a variable named `TracedTarget` of type **Crowdy Mass Entity Target** to `BP_LanternPlayer`.
2. Add the **I** key event, and from **Pressed** add **Crowdy Mass Line Trace Single**. Set **Trace Channel** to **Visibility** and **Draw Debug Type** to **For Duration**.
3. For **Start**, add **Get Player Camera Manager** and drag off it to **Get Camera Location**. Drag off the camera manager again for **Get Camera Rotation**, then **Get Forward Vector**. Multiply the forward vector by 3000, add **Start**, and connect the sum to **End**.
4. Break **Out Hit** and branch on **Hit Mass Entity**. It is true for a row and for a near tier actor alike. On true, add **Set TracedTarget** from the **Target** pin.

<Blueprint src="mass-trace-target" title="I, Crowdy Mass Line Trace Single, Branch on Hit Mass Entity, Set TracedTarget" />

To cheer at them:

1. Add the **C** key event. From **Pressed**, add **Is Crowdy Mass Target Live** on `TracedTarget` and a **Branch**.
2. On true, add **Send Crowdy Action**. Wire `TracedTarget` into **Target** and type `Cheer` as the **Action Name**.

<Blueprint src="mass-send-action" title="C, Branch on Is Crowdy Mass Target Live, Send Crowdy Action (Cheer)" />

</TabItem>
</Tabs>

The name is resolved against the anim set of the class the target stands for, and only the id travels. Everyone who draws that player as a row or a near tier actor sees the cheer, you included. The cheered player holds themselves as a real actor, so they do not see it. The action is a visual, so any client may send it. See [Target an entity, from Blueprint](../from-blueprint/target-an-entity.md) and [Target an entity, from C++](../from-cpp/target-an-entity.md), then [Call an event on it, from Blueprint](../from-blueprint/call-an-event-on-it.md) and [Call an event on it, from C++](../from-cpp/call-an-event-on-it.md).

## Give the players close by a real actor

A row has no animation graph, no bones to attach to and no real components. The players standing close to you should have them. That is the near tier. [Promote close entities to actors](../promote-close-entities-to-actors.md) explains each step.

1. Create a Blueprint class from **Crowdy Mass Near Tier Actor** and name it `BP_LanternPlayer_Shell`.
2. Create an Animation Blueprint for the character's skeleton and name it `ABP_LanternPlayer_Shell`. It is its own graph and not a copy of the character's, because **Get Owning Actor** returns the near tier actor and a cast to the character fails. Build it like this:
   - In **Event Blueprint Initialize Animation**, call **Get Owning Actor**, then **Get Component By Class** with **Crowdy Mass Near Tier**, and keep the result in a variable named `NearTier`.
   - In **Blueprint Thread Safe Update Animation**, set a `Speed` float from **Get Smoothed Speed** on `NearTier`, and drive the locomotion blend space from `Speed`.
   - Choose the sitting and fallen states from **Get Pose Name**, comparing against `Sitting` and `Fallen`.
   - Route the output through a Slot node named `DefaultSlot`, then to **Output Pose**. `Wave` and `Cheer` play over whatever the graph shows.
   - Add a **Blend Poses by bool** before the Slot node, driven by **Has Pose** and **Get Pose Name** equal to `Fallen`, so the graph skips the slot while the player is down. The near tier does not apply **Above Actions** for you.
3. On the shell's `Mesh` component, set the same **Skeletal Mesh** as `BP_LanternPlayer` and set **Anim Class** to `ABP_LanternPlayer_Shell`. Author nothing else. An empty event graph is the normal shape.
4. In `BP_LanternPlayer`, add a **Crowdy Mass Near Tier Shell** component and set **Near Tier Actor Class** to `BP_LanternPlayer_Shell`.
5. In **Project Settings, Plugins, Crowdy Mass**, under **Near Tier**, keep **Near Tier Distance** at 1000 and **Near Tier Visible Distance** at 2000. Set **Max Near Tier Actors** to 12, lower than the default of 50, so you can see the ceiling. The twelve nearest players win a real actor, and the rest of the square stays rows.

A C++ animation instance can read the same getters instead of a Blueprint graph.

Do not add a movement component, a colliding capsule or a Crowdy Entity component to the shell. Turn on `crowdy.mass.neartier.trace 1` and walk up to another player: the log says when the player gains a near tier actor and whether it came from the pool.

## Brighten the torch

Every player has a torch, and the crowd has to know how bright it is. That is crowd data of the game's own. The recipe is a replicated property, a fragment, a trait, a processor and a registered field.

On `ALanternPlayer`, `TorchBrightness` is a `float` property marked `CrowdyState` and `CrowdyHeartbeat`. It is declared in the snippet further down. In a Blueprint class, add a `float` variable of that name, set **Replication** to **Replicated** and leave **Keyframe heartbeat** ticked. The sit key is the only thing that sets it. A row has no actor to write it to, so the value is decoded and dropped unless a field claims it.

The fragment holds `TargetBrightness`, the value that arrived, and `Brightness`, the value the processor eases toward it, widest member first:

<CppSnippet id="mass-torch-fragment" />

The trait adds the fragment to the entity's template:

<CppSnippet id="mass-torch-trait" />

Add `ULanternTorchTrait` to the **Traits** of a **Crowdy Mass Entity Traits** component on `BP_LanternPlayer`. The processor eases `Brightness` toward `TargetBrightness` each frame:

<CppSnippet id="mass-torch-processor" />

`ULanternCrowdSubsystem` is a world subsystem. When the world's subsystems initialize, it registers the state field, which lands an arriving `TorchBrightness` on `TargetBrightness`, and the Blueprint field, which makes the same name readable and writable from a graph. Both registrations point at `TargetBrightness`, so a Blueprint read returns the value that arrived, and a Blueprint write sets a new target the crowd eases toward until the next replicated value replaces it.

<CppSnippet id="mass-torch-field" />

The class declaration in that snippet lists both overrides. The next section defines `OnWorldBeginPlay`.

### Flare the torch when a wave arrives

This step is optional. It shows what a registered handler does. A registered C++ handler for `WaveTorch` replaces both the event's body and the automatic action write on a crowd row. The row still waves only if the handler writes the action itself. The Blueprint node replaces the body only, so the row still waves.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The handler flares the torch and writes the wave action itself. It is the `OnWorldBeginPlay` that `ULanternCrowdSubsystem` declares above.

<CppSnippet id="mass-event-handler" />

</TabItem>
<TabItem value="bp" label="Blueprint">

1. In an event graph that runs once per machine, such as the game state, add **Receive Crowdy Event on Entity** and pick `WaveTorch` in its **Event** dropdown.
2. Wire **Event BeginPlay** into **Bind**.
3. From **On Event**, add **Is Crowdy Mass Target Live** on the node's **Target** and a **Branch**.
4. On true, add **Set Crowdy Mass Field (Float)** with **Target** from the node, **Field Name** `TorchBrightness` and **Value** 1.0.

<Blueprint src="mass-receive-event" title="Event BeginPlay, Receive WaveTorch on Entity, Branch on Is Crowdy Mass Target Live, Set Crowdy Mass Field (Float) (TorchBrightness, 1.0)" />

:::note[The row still waves.]
A bound Receive Crowdy Event on Entity node replaces the event's body on a row, but the declared action is still written, so the row plays the wave. The C++ handler replaces the action write too, so it writes the wave itself. See [Receive its events, from Blueprint](../from-blueprint/receive-its-events.md) and [Receive its events, from C++](../from-cpp/receive-its-events.md).
:::

</TabItem>
</Tabs>

### Read the brightness

Landing a value makes it available, so a graph reads it by name. Look at a player with the inspect key. Each frame the HUD checks that the traced target is still live, reads the field and puts the value into **Set Percent** on a Progress Bar named `TorchMeter`.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

Call `UCrowdyMassTargetLibrary::IsTargetLive(TracedTarget)`. When it is true, call `UCrowdyMassTargetLibrary::GetFieldFloat(TracedTarget, TEXT("TorchBrightness"), Brightness)` and pass `Brightness` to the meter.

</TabItem>
<TabItem value="bp" label="Blueprint">

On the HUD's tick, add **Is Crowdy Mass Target Live** on the traced target and a **Branch**. On true, add **Get Crowdy Mass Field (Float)** with the **Field Name** `TorchBrightness`. Wire its **Out Value** into **Set Percent** on `TorchMeter`.

</TabItem>
</Tabs>

When the other player sits, the meter drops to 30 percent. When they stand it returns to 100. Run `crowdy.mass.state.verdict` if the meter never moves. A `TorchBrightness` that no field claims shows in its dropped list. See [Add your own crowd data](../add-your-own-crowd-data.md), [Read and write its fields, from Blueprint](../from-blueprint/read-and-write-its-fields.md) and [Read and write its fields, from C++](../from-cpp/read-and-write-its-fields.md).

## The raiders on the north road

The warband from [Raiders on the north road](../../exec/examples/raiders-on-the-north-road.md) is far more than a village can draw as actors, and each raider already keeps a record on the server. On the Oakford map `BP_Raider` is drawn as a row too, and a row reads its raider's record.

`BP_Raider` is a Crowdy entity with a **Crowdy Server Object** component whose **Definition** is `CSO_Raider` and whose **Instance Mode** is **This Actor's Area**, as [the actors](../../exec/examples/raiders-on-the-north-road.md#the-actors) section of that page sets up. For a row, `BP_Raider` needs the same treatment as the player in the steps above: a flagged material and a `crowdy.mass.derive` check.

A client that never spawns a `BP_Raider` itself cannot resolve the class from the network. Add `BP_Raider` to **Project Settings, Plugins, Crowdy SDK, Replication, Preloaded Entity Classes**. See [Entities and Spawning](../../runtime/entities-and-spawning.md#a-dynamic-entity-can-appear-with-no-spawn-event-at-all).

With **This Actor's Area**, the game follows the areas around the local player's pawn or camera, as many as **Areas Followed Around a Player** says, which is 1 on `CSO_Raider`. A raider outside those areas has no values to read.

The raider's `Health` is visible to Everyone, so every row can read it. Its `Loot` is Owner Only and its `Hideout` Team Only, so a row yields them only for a player who may see them. Mark a raider with the inspect key (I). The health key (H) reads its `Health` and turns your own torch red when the raider is down to 10 or less, and white again otherwise.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="mass-server-value" />

Bind `OnCheckHealth` to the health key.

</TabItem>
<TabItem value="bp" label="Blueprint">

1. Add an Integer variable named `Health` to `BP_LanternPlayer`.
2. Add the **H** key event. From **Pressed**, add **Get Server Value** with `TracedTarget` as **Target** and the **Name** `Health`. Connect **Value** to **Set Health**.
3. Branch on the node's return value. On true, call **Set Light Color** on the `Torch` component.
4. Feed **New Light Color** from a **Select Color** with red in **A** and white in **B**. Connect `Health` to a `<=` node with 10 in its second input, and connect the result to **Pick A**. The torch turns red at 10 or less, and white otherwise.

<Blueprint src="mass-server-health" title="H, Get Server Value (Health), Set Health, Branch, Set Light Color on Torch (red at 10 or less)" />

</TabItem>
</Tabs>

**Get Server Value** returns true only for a value the server sent that fits the type of **Value**. The pose, the wave and the torch are view state: a modified client can lie about them, and the worst it can do is change what you see. `Health` is a server value, so it is the truth. Decide what is drawn from view state, and what is true from server values. See [Read its server values, from Blueprint](../from-blueprint/read-its-server-values.md), [Read its server values, from C++](../from-cpp/read-its-server-values.md) and [Crowd rows](../../exec/keep-a-record-per-entity.md#crowd-rows).

A record can take a moment to arrive for a raider that has just come into view, and Owner Only values arrive later than Everyone values. The first press can answer false.

## Test with two players in Play In Editor

1. Play the Oakford map. In **Advanced Settings** under **Multiplayer Options**, set **Number of Players** to 2 and click **Play**. The map you play must be the one mapped to `DA_OakfordProfile`. Sign both windows in.
2. In each window, the other player stands in the square as a row of `BP_LanternPlayer`, in its own colours and not grey. Walk one: the other window shows `Walk` at a walk and `Run` at a run.
3. Press the sit key (X) in the first window. The other window shows the player sit. Press it again and they stand.
4. Press the wave key (V). The other window shows the wave, even while the player sits. Press it twice quickly: the wave restarts.
5. In the second window, look at the first player, press the inspect key (I), then the cheer key (C). The second window shows the cheer on that row. The first window does not: it holds its own player as a real actor, and Send Crowdy Action only reaches machines that draw the player as a row or a near tier actor. A third window shows the cheer too.
6. Walk the first player to within 1000 cm (10 metres) of the second. The second window now shows a near tier actor with the full animation graph. Walk away and it goes back to a row.
7. With the first player marked in the second window, press the sit key (X) in the first window. The `TorchMeter` drops to 30 percent. Stand up and it returns to 100.
8. In the second window, look at a raider, press the inspect key (I), then the health key (H). The raider starts at 40 health and loses 5 every 5 seconds, so your torch turns red once it is down to 10 or less. At 0 health it retreats and returns at full health.

If one of these does not happen, [Fix a crowd that does not look right](../troubleshooting.md) has a checklist for it. A good first order is `crowdy.mass.derive`, then one client with **Render Local Owner**, then two clients.

## Related

- [Draw a crowd with Mass](../draw-a-crowd-with-mass.md): what the backend is and when to use it
- [Turn Mass on for a map](../turn-mass-on-for-a-map.md): the profile, the settings and the material flag
- [Make a character draw as a crowd row](../make-a-character-draw-as-a-crowd-row.md): the entity component, the mesh and `crowdy.mass.derive`
- [Set up the animation set](../set-up-the-animation-set.md): the bank, gaits and the slot pairs
- [Play poses and one-shot actions](../play-poses-and-one-shot-actions.md): Stance, `WaveTorch` and Send Crowdy Action
- [Promote close entities to actors](../promote-close-entities-to-actors.md): the shell and the animation graph
- [Add your own crowd data](../add-your-own-crowd-data.md): the torch fragment, trait and processor
- [Raiders on the north road](../../exec/examples/raiders-on-the-north-road.md): the Server Object behind the raiders
- [Fix a crowd that does not look right](../troubleshooting.md): symptoms and the console commands
