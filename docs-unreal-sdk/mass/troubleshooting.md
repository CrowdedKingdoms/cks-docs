---
slug: troubleshooting
sidebar_position: 11
title: Fix a crowd that does not look right
description: "Fix a grey crowd, rows that never appear, stand in bind pose, float or play another row's clip, poses and actions that do nothing, missing server values, a class that never promotes, and a Blueprint field read that answers false. Lists the crowdy.mass console commands and the order to check a new setup."
---

# Fix a crowd that does not look right

Find the symptom, then work down its list in order. Each list is ordered so a step rules out the layer below it, and each step points to the page that explains the setting. The last two sections list the console commands and switches that help, and the order in which to check a new setup.

## The crowd is grey

The entities spawn, move and can be hit, but they draw in the engine's default grey material.

1. Flag the character's parent material, not a material instance: tick **Used with Instanced Skinned Mesh** under **Usage**. [Turn Mass on for a map](./turn-mass-on-for-a-map.md) has the steps.
2. Resave the material. A flag the editor sets on the fly and nobody saves is gone on the next launch.
3. Run `crowdy.mass.derive` on the class. When a slot is not flagged, the line says how many checked slots are not flagged for instanced skinned meshes and names the slot, the material instance and the base material to flag.
4. Look in `LogMaterial`. The engine substitutes the default material there, so no Crowdy Mass line mentions it.

See [Make a character draw as a crowd row](./make-a-character-draw-as-a-crowd-row.md) for `crowdy.mass.derive`.

## Nothing appears at all

1. Check that a map profile for this map selects **Crowdy Mass Rendering Backend** as its **Backend Class** and has **Enable Networking** ticked. Check that the profile is assigned under **Project Settings, Plugins, Crowdy SDK, Map Profiles**. See [Assign the profile](../runtime/map-profile.md#assign-the-profile).
2. Check that the Mass entity subsystem is running. It exists in Play In Editor and game worlds whose map profile selects the Mass backend, not in the editor world and not on an actor pool map. See [Crowd nodes do nothing on this map](#crowd-nodes-do-nothing-on-this-map).
3. Run `crowdy.mass.derive` on the class and check that a mesh resolves.
4. Check whether you are the only client. The backend does not draw your own entity as a row, so on one client you see nothing. Tick **Render Local Owner**, which lives under **Mass Backend, Debug** on the **Crowdy Mass Backend Config**, or place a **Crowdy Mass Area Spawner** in the level. See [Turn Mass on for a map](./turn-mass-on-for-a-map.md).
5. Search the log for `nothing configures a Mass entity config`. That line says no config could be worked out from the class, and it names what is missing.
6. Search the log for a warning that an entity named a class id this client cannot resolve to a loaded class. If it appears, add the class to **Project Settings, Plugins, Crowdy SDK, Replication, Preloaded Entity Classes**. See [Entities and Spawning](../runtime/entities-and-spawning.md#a-dynamic-entity-can-appear-with-no-spawn-event-at-all).
7. If the rows stand at the world origin instead, name the transform fields of the state struct your executor sends `Transform`, or `Location` (or `Position`) plus `Rotation`. `LogCrowdyMass` names the struct once and lists the accepted spellings. See [Make a character draw as a crowd row](./make-a-character-draw-as-a-crowd-row.md).

## Crowd nodes do nothing on this map

A Crowdy Mass node or call runs without an error, but nothing happens. A **Crowdy Mass Area Spawner** spawns nothing, a trace finds no entity, or a bound event never fires.

1. Open the map's profile and check **Backend Class**. The Mass subsystems are created only when it is **Crowdy Mass Rendering Backend**. On **Actor Pool Rendering Backend** they do not exist, and the nodes and calls that need them do nothing. See [Pick the backend on the map profile](./turn-mass-on-for-a-map.md#pick-the-backend-on-the-map-profile).
2. Check that the profile is the one the map uses: a **Map Profiles** entry for the map's short name, or the **Default Profile**. A map with no entry runs on the profile the SDK ships, which draws actors. See [Assign the profile](../runtime/map-profile.md#assign-the-profile).
3. Look in the log for the one-time line. A **Crowdy Mass Area Spawner** warns once that it spawned nothing, **Set Crowdy Mass Hit Zone Table** warns once and hits keep the default zone, and **Receive Crowdy Event on Entity** and **Receive Server Values Changed on Entity** log once and receive nothing.
4. Remember what still works on an actor pool map. **Play Crowdy Mass Action** and the action id lookup read the actor's class, so they work there.
5. In C++, get the entity subsystem with `World->GetSubsystem<UCrowdyMassEntitySubsystem>()` and check for null before you use it. A world subsystem of your own that needs it should gate itself in `ShouldCreateSubsystem`, so it exists only on maps that draw crowd rows; see [Add your own crowd data](./add-your-own-crowd-data.md). `UCrowdySDKDeveloperSettings::ProfileDrawsCrowdRows(Profile)` answers whether a profile draws crowd rows.

## Rows stand in bind pose

The rows are drawn, but they stand in the mesh's bind pose and do not walk, pose or play actions. Work down the list in order.

1. Run `crowdy.mass.derive` on the class in a Play In Editor or game world on a Mass map. Check what it says for the anim set. An answer of nothing means the class names no set.
2. Check that the class has a **Crowdy Mass Anim Set** component whose **Anim Set** is filled in, and that the set names a **Bank**. Without the component the log says the class names no animation set and its entities render in their bind pose. See [Set up the animation set](./set-up-the-animation-set.md).
3. Check the log for a line saying the set did not load. Fix the reference it names; until then the class renders in bind pose.
4. If you authored a Mass entity config for the class, check that its visualization trait's mesh entry (**Skinned Mesh Instance Desc**, **Meshes**) names a **Transform Provider**, the same bank as the set's **Bank**. When the mesh carries no bank the log says so, and nothing can be animated. See [Set up the animation set](./set-up-the-animation-set.md#connect-the-bank-to-the-crowds-mesh).
5. If you authored a config, also add a **Crowdy Mass Animation** trait that names the set. The class's own **Anim Set** component is still found, so pose and action names resolve, but nothing renders the set. The log says `nothing renders that set` and names it. See [Make a character draw as a crowd row](./make-a-character-draw-as-a-crowd-row.md).
6. Check that the **Bank** holds the clips the set indexes; saving the set runs its checks. See [Set up the animation set](./set-up-the-animation-set.md).
7. Set `crowdy.mass.anim.force` to a bank index to force that clip on every row, then set it back to -1. Turn on `crowdy.mass.anim.trace 1` to log every animation index written, per row.

## Rows float, sink or face sideways

The rows animate, but they stand above or below the ground by a fixed amount, or face a quarter turn away from where they walk.

1. A row draws its mesh where the class places it. Open the class and check the mesh component's location and rotation: a character's mesh usually sits half the capsule's height below the capsule's centre, turned -90 degrees. A config the SDK builds from the class copies that placement, so fix it on the class.
2. If you authored a Mass entity config, set its mesh entry's **Local Transform** to the same location and rotation. An authored config is not given the class's placement. See [Author a config by hand](./make-a-character-draw-as-a-crowd-row.md#author-a-config-by-hand).
3. For a near tier actor that floats or sinks while the rows look right, see **Entity Transform Offset** on [Promote close entities to actors](./promote-close-entities-to-actors.md#entity-transform-offset).

## Animation lands on the wrong row

Rows play each other's clips, or `LogCrowdyMass` warns once a second that a mesh batched more animation entries than instances, so more than one processor is filling its animation batch. The SDK turns the engine's own animation pass off at startup, so something has turned it back on.

1. Open **Project Settings, Mass** and check that the engine's instanced skinned mesh animation pass is not ticked.
2. Open `Config/DefaultMass.ini` if the project has one. If it sets `bAutoRegisterWithProcessingPhases=True` for `MassConsumeInstancedSkinnedMeshAnimationProcessor`, remove that line.
3. If the project uses the MetaHuman crowd plugin, its own pass is left alone and also fills an animation batch. To turn it off, set `bAutoRegisterWithProcessingPhases=False` under `[/Script/MetaHumanCrowd.MetaHumanMassSimpleAnimationProcessor]` in `Config/DefaultMass.ini`.

See [The engine's animation pass](./turn-mass-on-for-a-map.md#the-engines-animation-pass).

## The crowd moves but never poses

1. Name a pose state enum on the anim set. **Poses** with rows and no **Pose State Enum** is a validation error.
2. Declare a property of that enum on your class and mark it `CrowdyState`. It must be that enum, not any enum. The type is the contract; the name is yours.
3. Declare the enum as `enum class : uint8`. A wider enum cannot ride the one byte a pose uses.
4. Check that no fragment field is registered under the name of that same property. A field claimed by name takes the property from the pose, and the log says nothing poses entities of that class. Register the field against a second property, or drop it. See [Add your own crowd data](./add-your-own-crowd-data.md).
5. Drop `CrowdyOwnerOnly` from the property. A crowd observer is never the owner, so it never receives the value.
6. Add the property to the heartbeat. An enum is held state, sent when it changes. Without `CrowdyHeartbeat`, one dropped change leaves the pose wrong until something else changes. The heartbeat also needs a non-zero **State Keyframe Interval (Seconds, 0 = off)** on the map profile and a **State Heartbeat** that is not **Off** on the entity component.
7. Run `crowdy.mass.state.verdict` in a play session. Check whether the property is in the dropped list, and whether the pose writes from CrowdyState move at all.
8. Check that the observer resolves the class. An update names its class by id, and a client resolves only the ids of classes that were loaded when the SDK started. Add the class to **Project Settings, Plugins, Crowdy SDK, Replication, Preloaded Entity Classes**. Until then the log warns that the entity named a class id this client cannot resolve, and the client falls back to guessing from the state struct. The guess works only once a component of that class has begun play on that machine, and it fails for two classes that share one struct. See [Entities and Spawning](../runtime/entities-and-spawning.md#a-dynamic-entity-can-appear-with-no-spawn-event-at-all). Do this before you suspect the pose path.

See [Play poses and one-shot actions](./play-poses-and-one-shot-actions.md) and [Set up the animation set](./set-up-the-animation-set.md).

## An event arrives and nothing animates

The body of the event runs, which makes it look as if everything worked, but the row does not play the action.

1. Mark the event an action. In C++ that is the `CrowdyAction` meta key. In Blueprint it is the **Is A One-Shot Action** box on the custom event. Recompile after you tick it, because the marker is read off the compiled function.
2. Run `crowdy.rpc.dumpfn <ClassName> <FunctionName>` and look for `action=1`. Run it on the receiving machine as well as the sender. A Blueprint class name ends in `_C`.
3. Give the event an `int32` input named `ActionId`. Without it nothing starts, and the log says so once per function. The names `ActionId`, `Variant` and `PlayRate` are read by name, and case does not matter; an event that spells them differently needs a registered handler.
4. Check whether something registered a C++ handler for the event with `RegisterEventHandler`. It replaces both the event's body and the automatic action write on a row, so the handler must write the action itself with `CrowdyMassWriteAction`. A bound **Receive Crowdy Event on Entity** node replaces the body only, and the row still plays the action. See [Run your code on a crowd row](./run-your-code-on-a-crowd-row.md).
5. If the **Is A One-Shot Action** box is missing, assign a map profile that selects the Crowdy Mass Rendering Backend under **Project Settings, Plugins, Crowdy SDK**, as a **Map Profiles** entry or the **Default Profile**. The box stays hidden until one does. See [Mark the event](../runtime/rpc-events-blueprint.md#mark-the-event).

## An action does not restart on a repeat

The first play works, and sending the same action again while it plays does nothing.

1. Open the anim set and check the action row. **Primary Index** and **Alternate Index** must be two different bank slots that hold the same clip. Equal values, or both still `-1`, are a validation error.
2. Set the set's **Bank**, then press **Sync Actions Into Bank**. It adds the clip to the bank twice and writes both indices.
3. If the class uses an authored config, check that its mesh entry names the same bank as the set's **Bank**. Nothing can catch a different one: validation checks the indices against the set's **Bank**.

See [Set up the animation set](./set-up-the-animation-set.md).

## An entity is stuck in a pose

An entity keeps its pose after the replicated value changes back.

1. Check whether the pose shares a bank slot with a gait, another pose or an action. Leaving the pose then hands the renderer the index it already has, and nothing changes on screen.
2. Set the set's **Bank**. Validation names the collision and tells you to give the pose a sequence of its own in the bank.
3. If you set the pose with **Set Crowdy Mass Entity Pose**, use a pose name the class's anim set authors. A name it does not author clears the pose instead of setting it.

See [Set up the animation set](./set-up-the-animation-set.md).

## A replicated variable does nothing on the crowd

`CrowdyState` alone lands nothing on a crowd row, because there is no actor to write onto. The value is decoded and then dropped unless a fragment field claims it.

1. Run `crowdy.mass.state.verdict`. It lists every replicated property that no field claims, and the log message for each names the call to make.
2. Call `IsStateFragmentFieldRegistered` with the property name. If it answers false, your registration never ran.
3. Register the field with the type the property is declared as. A name match with a wrong type is refused, with a line naming both.
4. Check whether the property is a struct, an `FName`, an `FString`, an `FVector`, an `int16` or a bitfield `bool`. None of these can be bound to a fragment field. Read them on the actor representation, or declare a plain `bool`.
5. Drop `CrowdyOwnerOnly` from the property if the crowd should see it. A crowd observer never receives an owner-only value.
6. Check that the name is not already claimed in this world for another type. Names are claimed per world and carry one type.
7. Check that the row carries a fragment to land the value in, and that something reads it. A landed value is stored, not shown. Showing it takes a processor, a near tier AnimBP, or a Blueprint field read.

See [Add your own crowd data](./add-your-own-crowd-data.md) and [A field that silently does nothing](../runtime/crowdy-state.md#a-field-that-silently-does-nothing).

## A row gets no server values

**Get Server Value** answers false for a crowd row, or **Receive Server Values Changed on Entity** never runs.

1. Check that the entity's actor class carries a **Crowdy Server Object** component whose type holds **A Record per Entity**. The class is read once, from the class default object.
2. Set the component's **Instance Mode** to one the rows can follow: **Only One Instance** (a setting of the type, and it wins over every Instance Mode), **Instance Id** with an id typed, or **This Actor's Area**. Any other mode logs one warning for the class and the rows get nothing.
3. Check that the server holds a record whose id is the entity's id, as 32 hex digits. A row finds its record by that id and by nothing else.
4. With **This Actor's Area**, check that the local player has a pawn or a camera to follow. With none, no area is followed.
5. Check that the variable is visible to the player. **Owner Only** and **Team Only** values reach only a player who may see them, and they arrive later than **Everyone** values.
6. Check that the name is the variable's name in the Server Object asset, and that the type you connect to **Value** matches the variable's type.
7. Ask later if you ask too early. A row drawn the moment a player enters an area reads nothing until the object has been read.

See [Read its server values, from Blueprint](./from-blueprint/read-its-server-values.md) and [Keep a record per entity](../exec/keep-a-record-per-entity.md#crowd-rows).

## A class never promotes

A class has a near tier shell, and its entities stay crowd rows however close they get. Reasons 1 to 4 are logged once per class, except a class with no shell component at all, which is the ordinary case and says nothing.

1. Declare the shell on the class. It needs a **Crowdy Mass Near Tier Shell** component with **Near Tier Actor Class** filled in. A component with an empty slot is reported differently from no component.
2. Give the shell class a **Crowdy Mass Near Tier** component. A shell without one is refused, because nothing would drive it from the entity. A Blueprint subclass of **Crowdy Mass Near Tier Actor** has one already.
3. Check whether an authored Mass entity config already promotes. If it names a high-resolution actor and its nearest level spawns it, that decision wins, the shell declaration is never read, and you get one warning.
4. Check whether the config carries more than one visualization trait of different classes. That is refused and named.
5. Check that the entity is inside **Near Tier Distance** (off screen) or **Near Tier Visible Distance** (on screen), and that fewer than **Max Near Tier Actors** are already promoted. The nearest entities win the limited places. These settings apply only when the config was derived from the class. This reason is not logged.
6. Turn on `crowdy.mass.neartier.trace 1` to see each promotion, pool checkout and release.

A config that names an actor while its nearest level still draws an instance is not a reason. It promotes nothing by itself, so the declared shell replaces the actor it names, the class is promoted after all, at the config's own distances, and the log warns.

See [Promote close entities to actors](./promote-close-entities-to-actors.md).

## A near tier actor stands still

Turn **Drive Owner Transform** back on if it is off on the shell's **Crowdy Mass Near Tier** component. Nothing else moves a near tier actor. Also check that the shell has no movement component or colliding capsule: the transform is written every frame, and a movement component fights it.

See [Promote close entities to actors](./promote-close-entities-to-actors.md).

## A near tier actor plays no actions

1. Check that the shell's Mesh uses its own animation Blueprint, such as `ABP_LanternPlayer_Shell`, that reads the near tier getters. A copy of the character's animation Blueprint casts to the character, the cast fails on the near tier actor, and the graph stays in its default pose.
2. Add a Slot node to the shell's animation graph whose name matches **Action Slot Name** on the near tier component. The default is `DefaultSlot`. Without one, a single warning says the graph has no such slot.
3. Remove any **Crowdy Mass Anim Set** component from the shell that names a different set from the entity's. Actions are refused for that pairing, and the message names both sets.
4. Check the pose that should suppress actions. If it is ranked **Above Actions**, the near tier does not honour that rank, so the graph has to bypass the slot itself while **Has Pose** is true.

See [Promote close entities to actors](./promote-close-entities-to-actors.md).

## A Blueprint field read always answers false

**Get Crowdy Mass Field** or **Set Crowdy Mass Field** returns false every time.

1. Register the name in C++, then call **Is Crowdy Mass Field Registered** with the **Field Name** once at startup. An unregistered name fails every read and write. The log warns `Nothing is registered as '<name>'` at most once every five seconds per name.
2. Check **Is Crowdy Mass Target Live** first, and do not keep a stored target across a respawn.
3. Match the node's type to the member. **Integer** is exactly `int32`, **Float** takes `float` or `double`, **Byte** takes `uint8` or a byte-wide enum, and **Boolean** takes `bool` including a bitfield.
4. Do not access a field while Mass is processing. That is refused and logged, an Error for a write and a Warning for a read, at most once every 5 seconds per field name. Move the work to a phase-end delegate or a deferred broadcast.

See [Read and write its fields, from Blueprint](./from-blueprint/read-and-write-its-fields.md).

## The event dropdown is empty

The **Event** dropdown on **Call Crowdy Event on Entity** or **Receive Crowdy Event on Entity** lists nothing.

1. Open the dropdown again. While the asset registry is still scanning, the list is incomplete.
2. Check that the class you want is one the list holds: the classes the Mass rendering backend is configured for, loaded classes that carry a Crowdy Entity component, and the SDK's own events under **Any Crowd Entity**.
3. Turn on `crowdy.mass.nodes.trace 1` in the editor. It logs where each entry came from.

See [Call an event on it, from Blueprint](./from-blueprint/call-an-event-on-it.md).

## Commands and switches

Every `crowdy.mass.*` command and variable is compiled out of Shipping builds, so none of them exists in a shipped game. The four `CrowdyMass.` commands in the first table are not guarded that way. They help when rows draw but their shadows or animation look wrong, and when you are asked for their output in a bug report.

### Commands

| Command | Takes | What it tells you |
|---|---|---|
| `crowdy.mass.derive` | A class: a short name, an asset path or a full object path | What a Mass entity config built from that class would contain, without spawning anything. It names the mesh, which of the three routes supplied it, the trace collision object type and the material verdict. In a Play In Editor or game world on a Mass map it also names the anim set and whether an authored config would be used instead. It logs a warning when the mesh cannot be resolved, a material is not flagged, or an authored config wins. In the editor world with no play session, the animation answer is left out and the config answer says it is unknown. |
| `crowdy.mass.state.verdict` | Nothing; needs a play session | One block saying whether Crowdy State is reaching crowd entities: every replicated property no fragment field claims, how many deltas were claimed and applied, every drop reason, and which road wrote the pose. A property you fix leaves the list. Paste the whole block when you report a problem. |
| `CrowdyMass.LogSkinnedMeshShadowDiagnostics` | Nothing | Logs the shadow and render flags of the crowd's instanced skinned mesh components in the current world. |
| `CrowdyMass.RecreateSkinnedMeshRenderState` | Nothing | Marks the render state of those components dirty, so they rebuild. |
| `CrowdyMass.ForceSkinnedMeshAlwaysAnimate` | Nothing | Sets those components to always animate at the component level and recreates their render state. |
| `CrowdyMass.LogRepresentationAnimationDiagnostics` | Nothing | Logs the Mass representation, level of detail, velocity and animation state of the crowd's remote entities. |

### Commands from the rest of the SDK that this page uses

These belong to the SDK as a whole and are listed on [Console Variables](../reference/console-cvars.md).

| Command or variable | Default | What it does here |
|---|---|---|
| `crowdy.rpc.dumpfn <Class> <Function>` | none | Prints how this process routes one event, including `action=` for a function marked an action. |
| `crowdy.state.heartbeat.advisories` | none | Lists every Crowdy State enum property that is outside the keyframe heartbeat. |
| `crowdy.rpc.loopback` | 0 | Delivers your own sends back to you, so one Play In Editor client can exercise a receive path. |

### Switches

| Variable | Default | What it does |
|---|---|---|
| `crowdy.mass.neartier.trace` | 0 | Logs when a crowd entity gains a near tier actor, whether the actor was built or taken from the pool, and when it goes back. Also prints where the near tier actor placed its mesh. |
| `crowdy.mass.event.proxy` | 1 | Runs an inbound event's own body on a per-class stand-in for an entity held as a row. Set 0 to compare: an event nothing registered a handler for then lands only the action write a declared action gets. |
| `crowdy.mass.derive.force` | 0 | Builds every remote entity from a Mass entity config made out of its own class. It pushes aside per-class bindings, the backend override, the project **Remote Entity Config**, and the anim set an authored config's animation trait names; the class's own **Crowdy Mass Anim Set** component is used instead. Entities already spawned keep their config. |
| `crowdy.mass.anim.force` | -1 | Forces one animation bank index on every Mass entity. A negative value turns forcing off. |
| `crowdy.mass.anim.trace` | 0 | Logs every animation sequence index written, per entity. |
| `crowdy.mass.anim.dump` | 0 | While 1, logs once a second a summary of the anim sets in use and of the instance batches handed to each instanced skinned mesh component. |
| `crowdy.mass.interp.adaptive` | -1 | Replays each remote segment over the observed arrival interval. 1 on, 0 off for a fixed duration, -1 follows **Adaptive Smoothing** in the project settings. |
| `crowdy.mass.interp.overshoot` | -1.0 | How much longer than the observed arrival interval a segment is replayed over. Negative follows **Smoothing Interval Overshoot**. |
| `crowdy.mass.interp.min` | -1.0 | Shortest span, in seconds, a segment may be replayed over. Negative follows **Min Smoothing Duration**. |
| `crowdy.mass.interp.max` | -1.0 | Longest span, in seconds, a segment may be replayed over. Negative follows **Max Smoothing Duration**. |
| `crowdy.mass.nodes.trace` | 0 | Editor only. Logs where the entries of the **Call Crowdy Event on Entity** dropdown came from. |

## Check a new setup in this order

Each step rules out the layer below it.

1. Run `crowdy.mass.derive` on your class. Check that it resolves the mesh you expect and reports every material flagged.
2. On one client with **Render Local Owner** on, check that your own pawn draws as a row, stands on the ground, moves, and takes its pose when you change the pose property.
3. On two clients, check that the other player's row is visible, moving and posing on the other machine.
4. On two clients, send an event to an owning client and check that it arrives there.
5. On two clients, send a multicast event and check that it runs your body on the observer's stand-in and that the declared action animates the row.
7. On two clients, call **Get Server Value** on a row and check that it answers with the value the server holds.

## Related

- [Draw a crowd with Mass](./draw-a-crowd-with-mass.md): what the backend does and when to use it
- [Turn Mass on for a map](./turn-mass-on-for-a-map.md): the profile, the settings and the material flag
- [Market night in Oakford](./examples/market-night-in-oakford.md): a worked example that exercises each step above
- [Console Variables](../reference/console-cvars.md): the SDK's own `crowdy.*` switches
