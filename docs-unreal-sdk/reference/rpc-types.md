---
slug: rpc-types
sidebar_position: 5
title: RPC Parameter Types
---

# RPC Parameter Types

A CrowdyEvent can carry these parameter types directly.

:::note
There is no payload struct to declare and nothing to serialize by hand. You pass the values, and the SDK handles the wire form.
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

## Not allowed

These do not work as CrowdyEvent parameters, each for a specific reason.

| Not allowed | Why |
| --- | --- |
| A return value | A CrowdyEvent is one way; it cannot send data back to the caller. |
| A non const output reference | Same reason. A `const&` input is fine. |
| `TSet` or `TMap` of object references | Object identity hashing is out of scope. Use a `TArray` of object references instead. |
| A `USTRUCT` that hides a container (`TArray`, `TSet`, or `TMap`) anywhere inside it, and any `TArray`, `TSet`, or `TMap` whose element, key, or value is such a struct | A buried container's element count has no bound on the wire, so it is rejected at registration to keep a malformed packet from forcing a huge allocation. Pass the container as a top-level parameter instead. This includes `FGameplayTagContainer`, which holds an inner array; pass the tags as a `TArray<FGameplayTag>` parameter. |
| Delegates and interfaces | No stable wire form. |

:::caution
A CrowdyEvent is one way. It cannot return a value or write back through a non const output reference. A `const&` input is fine.
:::

## How references travel

References are not sent as raw pointers. Each kind resolves to a portable identity on the wire.

| Reference | On the wire |
| --- | --- |
| A tracked entity actor | Sent as its entity `NetID`, so it resolves to the matching instance on each client. |
| An asset or a class | Sent as its object path. |
| A runtime object that is neither an entity nor an asset | Sent as null, with a warning, because it has no portable identity. |

:::tip
A received object or class reference resolves by finding an already loaded asset. To allow loading missing assets from disk by path, set `crowdy.rpc.allowObjectLoad 1`. It is off by default so an untrusted peer cannot trigger arbitrary loads.
:::

See [RPC Events in C++](/unreal-sdk/runtime/rpc-events-cpp) for worked examples.
