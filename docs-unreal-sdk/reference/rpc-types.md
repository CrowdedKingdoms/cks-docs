---
slug: rpc-types
sidebar_position: 10
title: RPC Parameter Types
description: "Which C++ and Blueprint types a CrowdyEvent parameter can carry, the wire limits on payload size and array length, how object references travel, and how a receiver reads a value back safely."
---

# RPC Parameter Types

Which types a CrowdyEvent function's parameters can use directly, and the hard limits the wire format enforces on top of that. Come here when you are shaping a new event's signature, or a registration failed and you need to know which rule it hit.

:::note[There is no payload struct to declare and nothing to serialize by hand. You pass the values, and the SDK handles the wire form.]
:::

## Allowed

These types can be used directly as CrowdyEvent parameters.

| Category | Types |
| --- | --- |
| Booleans and numbers | `bool`, `uint8`, `int32`, `int64`, `float`, `double` |
| Text | `FName`, `FString`, `FText` |
| Enums | any `UENUM` |
| Structs | any `USTRUCT` built from the allowed types above (a struct that hides a container is rejected; see below) |
| Object and class references | `UObject*`, `UClass*`, `TSubclassOf<...>`, `TSoftObjectPtr<...>`, `TSoftClassPtr<...>` |
| Arrays | `TArray<>` of any of the above, including arrays of object references |
| Sets and maps | `TSet<>` and `TMap<>` of non object element, key, and value types |

A struct's own members are not checked one by one, only for a buried container, so a struct built entirely from allowed leaf types always passes. Unreal's reflection already forbids a container nested inside another container at the parameter declaration, so the container rules below only ever bite one level down: inside a struct, or as a struct-typed array, set, or map element.

## Not allowed

These do not work as CrowdyEvent parameters, each for a specific reason.

| Not allowed | Why |
| --- | --- |
| A return value | A CrowdyEvent is one way; it cannot send data back to the caller. |
| A non const output reference | Same reason. A `const&` input is fine. |
| `TSet` or `TMap` of object references | Object identity hashing is out of scope. Use a `TArray` of object references instead. |
| A `USTRUCT` that hides a container (`TArray`, `TSet`, or `TMap`) anywhere inside it, and any `TArray`, `TSet`, or `TMap` whose element, key, or value is such a struct | A buried container's element count has no bound on the wire, so it is rejected at registration to keep a malformed packet from forcing a huge allocation. Pass the container as a top-level parameter instead. This includes `FGameplayTagContainer`, which holds an inner array; pass the tags as a `TArray<FGameplayTag>` parameter. |
| Delegates and interfaces (`TScriptInterface<>`) | No stable wire form. |

:::caution[A CrowdyEvent is one way. It cannot return a value or write back through a non const output reference. A `const&` input is fine.]
:::

## How references travel

References are not sent as raw pointers. Each kind resolves to a portable identity on the wire, one of three tags.

| Reference | On the wire |
| --- | --- |
| A tracked entity actor | Sent as its entity `NetID`, so it resolves to the matching instance on each client. |
| An asset or a class | Sent as its object path. |
| A runtime object that is neither an entity nor an asset | Sent as null, with a warning, because it has no portable identity. |

:::tip[A received object or class reference resolves by finding an already loaded asset. To allow loading missing assets from disk by path, set `crowdy.rpc.allowObjectLoad 1`. It is off by default so an untrusted peer cannot trigger arbitrary loads. See [Console variables](./console-cvars.md).]
:::

## Reading a value on receipt

A handler reads each parameter by name off the incoming call, never by its position on the wire, through a typed getter: a bool, a name, or a string comes back as is. `GetInt32` never narrows an incoming 64 bit value for you, because the value came from someone else's process; `GetInt64` accepts a 32 bit value widened, which loses nothing. `GetFloat` accepts a double narrowed, because a Blueprint float pin is a double under the hood while a C++ `float` property is not, so this one direction has to happen somewhere. Every getter answers a safe default rather than reinterpreting the bytes when the stored type does not match what you asked for.

## Limits

The manifest that drives the other reference tables on this site does not carry these numbers; they come from the wire format itself.

- A `Multicast` event's payload is capped at 1024 bytes on its reliable channel. An encoded call that would exceed this is dropped loudly at send, never truncated. `SpatialMulticast` has no channel cap of its own, but it still travels in a UDP datagram of at most 1232 bytes including the envelope, so it is a little more room, not an unbounded route.
- An array, set, or map parameter is capped at 65,536 elements. A forged, out of range count fails before any allocation happens, and the whole call is dropped cleanly rather than driving an unbounded allocation from an untrusted packet.
- The buried-container check above stops recursing at 8 levels of struct nesting. A struct cannot contain itself by value, so this is a defensive bound, not a limit you can reach by ordinary authoring.

## Gotchas

- A rejected registration for a buried container is a compile-time (editor load time) failure, not a runtime one; move the container to the top level of the parameter list.
- `TArray` of an object reference is fine; `TSet` and `TMap` of one are not.
- The 1024 byte cap belongs to `Multicast` alone. Do not size a `SpatialMulticast` payload against it.
- A getter mismatch fails quietly (a default value, not a crash), so a handler that reads the wrong type from a payload looks like it worked until you check the value.

## Related

- [RPC metadata keys](./rpc-meta-keys.md): the keys that route the event this page's parameters ride on.
- [RPC events in C++](../runtime/rpc-events-cpp.md): worked examples of declaring and calling an event.
- [Console variables](./console-cvars.md): `crowdy.rpc.allowObjectLoad` and the rest.
- [What a state property may be](../runtime/crowdy-state.md#what-a-state-property-may-be): the view plane's own, stricter type rules. Crowdy State rejects containers and object references outright; RPC parameters accept both.
