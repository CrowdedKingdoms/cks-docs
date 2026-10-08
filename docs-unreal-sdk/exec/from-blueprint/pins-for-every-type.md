---
slug: pins-for-every-type
sidebar_position: 4
title: Pins for every type
description: The pin each Server Object variable, input and output type gets in Blueprint (bool, integers, floats, strings, enums, structs, containers, optionals and the C++-only types), names a node cannot use, types with no pin, and what the nodes do when the asset changes.
---

# Pins for every type

:::note
Server Objects run on [ck-exec](/exec/intro). The tagged v2.17.0 plugin does not have them; see [What's Changed](../../guides/whats-changed.md#unreleased-after-v2170).
:::

The typed nodes give every value a pin of its own type, so none needs a cast. This page is what the pins are, and what happens to them when the asset changes.

## What the pins are

Every value has a pin of its own type, with no casting.

| In the asset or C++ | Pin |
|---|---|
| `bool` | Boolean |
| `uint8` | Byte |
| `int32` | Integer |
| `int64` | Integer64 |
| `float`, `double` | Float |
| `FString` | String |
| `FName` | Name |
| Enums | The enum |
| `FVector`, `FRotator`, `FVector2D`, `FQuat`, `FIntPoint`, `FIntVector`, `FLinearColor`, `FColor`, `FDateTime`, `FTimespan`, `FGuid`, `FGameplayTag` | The struct of that name |
| Soft object and soft class references | A soft reference pin |
| Your own structs | The struct; right-click its pin and choose **Split Struct Pin** to get a pin for each field |
| `TArray`, `TSet`, `TMap` | An Array, Set or Map pin |
| `int8`, `int16`, `uint16` (C++ only) | Integer |
| `uint32`, `uint64` (C++ only) | Integer64 |
| `TOptional<T>` (C++ only) | A pin for T, and a **Has Value** pin beside it |

The C++-only types are carried on the nearest pin that holds every value. A value that does not fit, such as a negative Integer64 for a `uint64`, is refused: a **Call** fails through **On Failed** naming the input, and a **Get** logs a warning and reads the default.

An optional input is sent only when its **Has Value** is true; an optional output's **Has Value** says whether the server set it. On a **Get**, an optional's **Has Value** is false when it is empty and also before the server has sent the values.

A variable, input or output whose name is one a node uses for its own pin gets no node, and the Blueprint compile says to rename it. The names are `Team Id`, `Instance Id`, `Value Changed`, `Has Values`, `then`, `execute`, `self`, `Server Function`, `Call Outcome`, `Call Reason`, `Call Retryable`, `On Success`, `On Failed`, and another value's name followed by ` Has Value`. Rename it in the asset; the nodes follow. `Call Outcome`, `Call Reason` and `Call Retryable` are the pins a **Call** node shows as **Outcome**, **Reason** and **Retryable** in its advanced area, under the small arrow at the bottom of the node.

Two other things have no pin. An Array, Set, Map or optional inside another one cannot be held in a Blueprint, and neither can a C++ struct or enum that is not marked `BlueprintType`. The compile says which variable and why, for example "the struct FRelic is not BlueprintType; mark it BlueprintType", and the node is not offered in the menu until it does. Blueprint structs and enums you made in the editor already work.

### When the asset changes

The nodes follow the asset. Rename a variable or an input that you added in the asset, or a field of a Blueprint struct, and the node keeps it and its wires. Change a type and the pin changes with it; a wire that no longer fits is a compile error, and the message names the pin, so reconnect it or remove it. Remove a variable and the nodes for it say "has no variable Oil any more". A variable you untick from **Visible to Players** fails the same way, and the message tells you to tick it again or remove the node.

## Related

- [Get a Server Object](./get-a-server-object.md)
- [Read and follow its variables](./read-and-follow-variables.md): the **Get** and **On Changed** pins
- [Call its functions](./call-functions.md): the input and output pins of a **Call** node
- [Create a Server Object type](../create-a-type.md#field-types): the types a variable can have
