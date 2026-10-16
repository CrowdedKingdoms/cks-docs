---
slug: call-a-library
sidebar_position: 5
title: Call a Server Function Library
description: Call a Server Function Library from C++ with UCrowdyServerObjectLibrary::CallLibraryFunction, with a struct or with inputs added in the asset, roll loot from the chest on the north road, how the call is held and answered exactly once, what a missing definition, a type that is not a library, an unknown function or a missing world answer, and why the first call after idle can be slow.
---

# Call a Server Function Library

:::note
Server Objects run on [ck-exec](/exec/intro).
:::

A [Server Function Library](../server-function-libraries.md) has no instance to pick and no values to read, so a game does not acquire it and hold it as it does a Server Object. It calls a function by naming the definition: `CallLibraryFunction`, a static function of `UCrowdyServerObjectLibrary` in `CrowdyServerObjectLibrary.h`, in the `CrowdyExec` module.

## Call one

The chest on the north road hands out a trinket when the local player walks into it. `LootRollerDefinition` is the `CSO_LootRoller` asset from [Make a Server Function Library](../server-function-libraries.md#make-the-asset), picked in the chest's Details panel, and `RollLoot` takes the structs below:

<CppSnippet id="so-library-call" />

Walk into the chest and the log reads `The chest holds SilverRing:t1`. The library keeps nothing, so the same `Seed` and `Tier` give the same item every time.

`CallLibraryFunction(WorldContext, Definition, Function, Inputs, OnDone, TimeoutSeconds)` takes:

- **WorldContext**: any object in the game's world, such as the actor.
- **Definition**: the library's definition asset.
- **Function**: the function's **Name** on the definition, `RollLoot` here.
- **Inputs**: an `FInstancedStruct` holding the function's Input Struct, made with `FInstancedStruct::Make`. For a function with no inputs, pass an empty `FInstancedStruct()`.
- **OnDone**: runs once with an `FCrowdyServerCallResult`, on the game thread. It holds the `Outcome`, the `Reply` on success, a `Reason` for anything but success, and `bRetryable`, as for [a call to a Server Object](./call-functions.md#call-one).
- **TimeoutSeconds**: optional. A limit of its own for this call that can only shorten the wait, as in [Give up sooner](./call-functions.md#give-up-sooner).

A function whose inputs are [added in the asset](../create-a-type.md#variables-inputs-and-outputs-or-a-struct) takes an `FInstancedPropertyBag`, the second overload. `MakeParams` of the library's Server Object hands you a copy with the default values; set the ones you want by name. The subsystem gives you that object for an empty Instance Id, and `CallLibraryFunction` shares it:

<CppSnippet id="so-library-bag" />

The reply reads by name through `CrowdyExec::ToList` from `CrowdyExecCodec.h`, as on [Call one with inputs added in the asset](./call-functions.md#call-one-with-inputs-added-in-the-asset).

## How it is held and answered

- **The world holds the library.** The first call to a library connects it, and the game instance's `UCrowdyServerObjectSubsystem` keeps it, as its own owner, until the subsystem shuts down. There is nothing to release, and calls to the same library share one connection. Calling `Acquire` yourself works too and is ready as soon as the connection opens, but `CallLibraryFunction` needs none of it.
- **OnDone runs exactly once.** A call that cannot be sent completes at once, inside `CallLibraryFunction`, so `OnDone` can run before it returns. Only a game instance shutdown skips it, for calls still waiting; sign-out completes them as `Canceled`.
- **A refusal is an outcome, not a crash:**

  | Cause | Outcome | Reason names |
  |---|---|---|
  | A null definition, or a definition that is not a Server Function Library | `BadRequest` | the asset, "... is not a Server Function Library" |
  | A function the definition does not have | `BadRequest` | the type and the function |
  | No world, or a world with no game instance | `Unavailable` | that it needs a world with a game instance |

  `Definition->IsFunctionLibrary()` tells you whether an asset picked at run time is a library before you call it, and `Definition->Kind` is the `ECrowdyServerObjectKind` behind it.

  Every other outcome is a call's, listed on [Troubleshooting](../troubleshooting.md#outcomes): `Denied` for a function that is **Server Only** or **Developers Only**, `ServerError` for an input outside its **Value Range**, `Timeout`, `Paused` and the rest.
- **Calls run side by side.** Two calls that are sent together are two independent calls, and the server may answer them on different instances, in either order. A library has no state to link them.
- **The first call after the library has been idle can take over a second.** Your `OnDone` simply runs later. A call that goes on past the project's **Server Object Call Timeout**, 20 seconds unless you changed it, ends as `Timeout`.
- **Capture your actor weakly,** as on [Call one](./call-functions.md#call-one): `OnDone` can run after the actor that made the call is gone. The chest's lambda touches nothing of the actor, so it captures nothing.

## Related

- [Call a Server Function Library, from Blueprint](../from-blueprint/call-a-library.md): the **Call** node, which needs no Target
- [Call its functions](./call-functions.md): the previous page, a call to a Server Object
- [Make a Server Function Library](../server-function-libraries.md): the asset, **Kind** and **Scaling**
- [Loot for the Hollow Giant](../examples/hollow-giant-loot.md): the loot roller, the chest and the boss
- [Troubleshooting](../troubleshooting.md#outcomes): every outcome
