---
slug: read-and-follow-variables
sidebar_position: 2
title: Read and follow its variables
description: Read a Server Object's variables that players can see from its state struct and react to each change with WatchValues, when the listener runs, what the field names in it are, and what a client can and cannot do with the values.
---

# Read and follow its variables

:::note
Server Objects run on [ck-exec](/exec/intro).
:::

The variables a [definition](../create-a-type.md) marks **Visible to Players** are a Server Object's public face. The SDK keeps a copy of them current on every client that has the Server Object, and tells your code each time the server changes them.

## React to changes

`WatchValues`, a function of `UCrowdyServerObject`, takes a listener and returns an `FDelegateHandle`. The beacon watches its Server Object right after acquiring it, and sets its light from the oil and the lit flag:

<CppSnippet id="so-watch" />

The listener, an `FOnCrowdyServerValuesChanged` delegate, receives the Server Object and the names of the fields that changed. It runs:

- **once when the values first arrive**, naming every variable players can see. This comes just before `OnStatusChanged` reports Ready, so by the time a status handler sees Ready the values are already applied;
- **once when you start watching, if the values are already current**, naming every variable players can see. A second beacon that acquires a Server Object the first one already made Ready is set up at once, with no special case in your code. A listener added from inside a Ready status handler is called once, not twice;
- **once per change on the server**, naming every field that change touched. A Server Function that changes both `Oil` and `bLit` produces one call naming both, never two calls or a moment where one is new and the other old.

`UnwatchValues(Handle)` removes a listener. A listener bound to a `UObject`, as above, is skipped once that object is gone, so the beacon does not need to remove its own; a lambda or raw binding does.

## Read the values

`GetState()` returns an `FInstancedStruct` holding the definition's State struct. Read it with `GetPtr` and the struct type, as the beacon does, at any time, not only inside the listener.

- The variables **Visible to Players** hold what the server last sent. Before the first values arrive they hold the struct's defaults.
- The other fields, the **Server Only** variables, hold the struct's defaults, always. They never leave the server, so `LastFedBy` reads `0` on every client.
- The copy belongs to the SDK. Changing it changes nothing on the server, and the next change from the server overwrites it. To change a value, [call a Server Function](./call-functions.md).

When the definition's variables are [added in the asset](../create-a-type.md#variables-inputs-and-outputs-or-a-struct) rather than taken from a struct, there is no struct to read them into. `GetStateList()` returns them as an `FInstancedPropertyBag` to read by name; it is empty when the variables come from a struct:

```cpp
const FInstancedPropertyBag State = Beacon->GetStateList();
const TValueOrError<int32, EPropertyBagResult> Oil = State.GetValueInt32(TEXT("Oil"));
const TValueOrError<bool, EPropertyBagResult> bLit = State.GetValueBool(TEXT("bLit"));
if (Oil.HasValue() && bLit.HasValue())
{
	Light->SetIntensity(bLit.GetValue() ? Oil.GetValue() * 100.f : 0.f);
}
```

The same rules hold: the variables players do not see keep their default values on every client.

## Field names

The names the listener receives are the fields' names on the server: the C++ member name (`Oil`, `bLit`), the name of a variable added in the asset, a Blueprint struct field's name with the spaces and other characters removed, or the Server Name you set under **Field Names** on the definition. Compare them exactly as they are spelled there.

## Related

- [Create a Server Object type](../create-a-type.md): choosing which variables players see
- [Call its functions](./call-functions.md)
- [Read and follow its variables, from Blueprint](../from-blueprint/read-and-follow-variables.md): **On Changed**, **Watch Variables** and **On Variables Changed**
- [Troubleshooting](../troubleshooting.md#a-value-is-not-what-you-expect): when a value is not what you expect
- [The Two Planes](../../concepts/two-planes.md): why these values are the server's, not the client's
