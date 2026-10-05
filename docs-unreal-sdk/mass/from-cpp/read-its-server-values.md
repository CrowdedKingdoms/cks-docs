---
slug: read-its-server-values
sidebar_position: 5
title: Read its server values
description: "Read the values a Server Object keeps about a crowd entity from C++: set up the class, read a value with UCrowdyMassServerValuesLibrary::GetServerValueAs, and react to a change with UCrowdyMassServerRecordsSubsystem."
---

# Read its server values

This page has a Blueprint twin: [Read its server values, from Blueprint](../from-blueprint/read-its-server-values.md).

The values the server owns about a player or a creature, such as health, loot or a team's orders, are what is true. They cannot live on an actor for a crowd row, because a crowd row has no actor. They live in a Server Object that keeps **a record per entity**, and a row reads its own record in place. Nothing is copied into a fragment, and nothing runs per row per frame: the work is one pass over a batch of changed records.

The Server Object type and its server code are on [Keep a record per entity](../../exec/keep-a-record-per-entity.md), and this page does not repeat them. It covers what a crowd adds: the setup on the entity's class, and the calls a row uses.

| You need | Include |
|---|---|
| `UCrowdyMassServerValuesLibrary` | `Target/CrowdyMassServerValuesLibrary.h` |
| `UCrowdyMassServerRecordsSubsystem`, `FOnCrowdyMassServerValuesChanged` | `Subsystems/CrowdyMassServerRecordsSubsystem.h` |
| `UCrowdyMassNearTierComponent` | `Components/CrowdyMassNearTierComponent.h` |

## When you need this

- To show a value on a player or creature you are looking at: a health bar over a raider.
- To react when a value changes: a bar that moves, a marker that appears.

The pose, the torch and the wave are view state. A modified client can lie about them, and the worst it can do is change what you see. A server value is the truth, and a player may only read what the server chose to send them.

## Set up the class

On the Oakford north road, the raiders are `BP_Raider`, keeping a record each in `CSO_Raider` (see [Raiders on the north road](../../exec/examples/raiders-on-the-north-road.md)). On a Mass map the players who watch the road draw each raider as a crowd row, and a row reads the same record.

1. **Make the type.** A Server Object definition with **Holds** set to **A Record per Entity**, whose server code adds a record for each entity, keyed by the entity's id. Each variable is **Server Only**, **Everyone**, **Owner Only** or **Team Only**. `CSO_Raider` has `Health` for **Everyone**, `Loot` for **Owner Only** and `Hideout` for **Team Only**.
2. **Put the component on the class.** The entity's actor class carries a `UCrowdyServerObjectComponent` whose **Definition** is that type. It can be native, in the Blueprint, or inherited. The SDK reads it once for the class, from the class default object. `BP_Raider` has one with **Definition** `CSO_Raider`. See [One object per area](../../exec/from-cpp/get-a-server-object.md#one-object-per-area).
3. **Pick the object with the component's Instance Mode.** Rows follow only a mode that is the same for the whole class:

   | Instance Mode | What the rows read |
   |---|---|
   | **Only One Instance** (a setting of the type) | The type's one object. It wins over every Instance Mode. |
   | **Instance Id**, with an id typed | The object with that id. |
   | **This Actor's Area** (`ECrowdyServerObjectInstanceMode::ThisActorsArea`) | The objects of the areas around the local view. |

   With **Signed-In Player**, **This Actor**, **Player's Team** or **From Server Value**, the rows get no server values, and the log says why once for the class.
4. **Use the entity's id as the record id.** A row's record is the one whose id is the entity's UUID as 32 hex digits, the form a census of the world reports as `uuid`.

`UCrowdyMassServerValuesLibrary::ClassGetsServerValues(const UClass*)` answers whether rows of a class can get server values at all: whether it carries such a component, reading a record per entity, in a mode rows can follow. Use it in a startup check.

With **This Actor's Area**, the game follows the areas within the type's **Areas Followed Around a Player** of the local player's pawn or camera, and moves them as the view moves. A value of 1 means the 3 by 3 areas around the view. It lets go of an area only when the view is more than that radius plus one away, so a border does not flap. With no pawn or camera to follow, no area is followed and the rows read nothing.

## Read a value

`UCrowdyMassServerValuesLibrary::GetServerValueAs<T>(const FCrowdyMassEntityTarget& Target, FName Name, T& Out)` reads the variable called `Name` into `Out`. `T` must be exactly the type of the variable: a number of the same width, a `bool`, an `FString`, `FName` or `FText`, a `UENUM`, or a `USTRUCT`. The Blueprint node is **Get Server Value**.

The call returns false, and resets `Out` to `T()`, when the value has not arrived yet, when the variable does not exist, or when `T` is not the variable's type. The snippet reads a raider's health into an `int32` and uses the player's torch to show it: a raider on its last legs turns the torch red.

<CppSnippet id="mass-server-value" />

The server never sends a value the player may not receive, such as an **Owner Only** value of an entity they do not own. The call returns false for it.

:::note[The property-based calls still exist.]
`GetServerValueInto(Target, Name, const FProperty* DestProperty, void* Dest)` reads into a property you already hold and returns true only for a value that fits it. `FindServerValueProperty(Target, Name)` gives you the variable's property, and `PropertyHolds<T>(Property)` tells you whether a `T` fits it. Use them when the type is only known at run time.
:::

`UCrowdyMassServerValuesLibrary::FindServerValues(Target)` gives the whole record at once: a `const FInstancedStruct*` holding the record's value struct, or null when the entity has no record. Read it with `GetPtr<T>()` for the struct your type uses, and do not keep the pointer.

## React to a change

`UCrowdyMassServerRecordsSubsystem` is a world subsystem, created in Play In Editor and game worlds only, and only when the map profile selects the Crowdy Mass Rendering Backend. Get it with `World->GetSubsystem<UCrowdyMassServerRecordsSubsystem>()`. The delegate type is `FOnCrowdyMassServerValuesChanged`, a multicast delegate of `(const FCrowdyMassEntityTarget& Target, TConstArrayView<FString> Changed)`. `Changed` names the variables that changed, as `GetServerValueAs` takes them, and is empty when the entity's record was removed.

| Call | What it does |
|---|---|
| `AddClassHandler(const UClass*, FOnCrowdyMassServerValuesChanged::FDelegate)` | Runs the listener after each change of the values of a row of that class or a subclass. Returns an `FDelegateHandle`. |
| `RemoveClassHandler(FDelegateHandle)` | Takes it off. |
| `BindObjectHandler(const UClass*, UObject*, FName FunctionName)` | The same, for a function that takes the entity target and a `TArray<FString>`. This is what **Receive Server Values Changed on Entity** compiles to. Binding again changes nothing. |
| `UnbindObjectHandler(const UClass*, const UObject*, FName)` | Takes it off. |
| `WatchEntity(FMassEntityHandle, FOnCrowdyMassServerValuesChanged::FDelegate)` | Follows one row. It also runs once at the next flush if the record is already there. |
| `UnwatchEntity(FMassEntityHandle, FDelegateHandle)` | Stops following it. |

A record can arrive before its row exists. The record is kept, and the event runs once, with the current values, when the row appears. A row that moves from one followed area into the next does not see its record removed and added again.

## A near tier actor

A class that promotes to the near tier (see [Promote close entities to actors](../promote-close-entities-to-actors.md)) reads and hears the same values through its `UCrowdyMassNearTierComponent`. Both answer for the entity the near tier actor stands in for, so the actor and its row never disagree.

- `ReadServerValueInto(FName Name, const FProperty* DestProperty, void* Dest) const` reads the bound entity's variable. The Blueprint node is **Get Server Value**.
- `OnServerValuesChanged` is a dynamic multicast delegate, `FCrowdyMassNearTierServerValuesChanged`, with one parameter, `const TArray<FString>& Changed`. Bind it with `AddDynamic`.

## Gotchas

- **Read to draw.** The values are the server's. Change them by calling a Server Function, not from here.
- **Owner Only and Team Only values arrive later** than **Everyone** values, because they are fetched, at most once a second for each followed area.
- **The first values are not instant.** A row drawn the moment a player enters an area reads nothing until the object has been read.
- **A class stays followed for the life of the world** once a row of it has been seen.
- **A row gets no values.** Work through the checklist on [Fix a crowd that does not look right](../troubleshooting.md).

## Related

- [Keep a record per entity](../../exec/keep-a-record-per-entity.md): the type, the audience of a variable and the server code
- [Raiders on the north road](../../exec/examples/raiders-on-the-north-road.md): the record per raider this page reads
- [Target an entity](./target-an-entity.md): get the target `GetServerValueAs` takes
- [Promote close entities to actors](../promote-close-entities-to-actors.md): the near tier
- [Fix a crowd that does not look right](../troubleshooting.md): the checklist for a row that gets no values
- [Read its server values, from Blueprint](../from-blueprint/read-its-server-values.md): the same reads as nodes
