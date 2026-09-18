---
slug: crowdy-state-types
sidebar_position: 8
title: Crowdy State Types
description: What a CrowdyState property may be, POD leaves and structs, what is rejected at discovery and the exact error you will see, and where a list belongs instead.
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Crowdy State Types

Crowdy State replicates single values: POD leaves and `USTRUCT`s made of them. It does not replicate containers or object references in any position, and it says so once at startup for each property it drops. This page is the type rule, the rejection list, and the struct example.

## When you are here

You marked a property `CrowdyState` and nothing arrives, or you are about to mark one and want to know if it will. The classifier every surface shares, `FCrowdyStateLayoutBuilder::ClassifyStateProperty` (with `IsStateReplicatable` as the yes-or-no form and `DescribeStateSupport` for the sentence), decides at discovery; the Blueprint compiler's variable check and the variable-details dropdown reuse it, so every surface reports the same reason.

## Accepted

| Kind | Examples | Notes |
|---|---|---|
| Numeric | `int32`, `int64`, `uint8`, `float`, `double` | Diffed and sent as their bytes. |
| Boolean | `bool` | |
| Enum | `enum class E : uint8`, `TEnumAsByte` | Carried as the underlying integer. Consider `CrowdyHeartbeat`; see [Crowdy State](./crowdy-state.md#the-metadata-keys). |
| Name and string | `FName`, `FString` | |
| Plain struct | any `USTRUCT` whose fields, at every depth, hold no container | One slot in the layout; diffed and sent as one unit. |
| Net-serialized struct | `FVector`, `FRotator`, `FVector_NetQuantize`, any struct with a native net serializer | Rides its own `NetSerializeItem`, quantized as the engine defines it, and exempt from the nested-container check because its serializer bounds the decode. |

## Rejected

:::warning[Containers and object references are rejected at discovery, in any position, including inside a struct. Use a CrowdyEvent or a Game Model.]
The error names the escape hatch: `CrowdyState: property 'Players' on '/Script/MyGame.Lantern' is a container; CrowdyState does not replicate containers; use a CrowdyEvent RPC or a Game Model container. Omitting it.` A list of who lit the lantern is a `TArray` parameter on a [CrowdyEvent](./rpc-events-cpp.md) if it is a moment, or a [Game Model](../game-models/overview.md) container if it is truth. Never re-attempt it here.
:::

| Rejected | The reason discovery logs |
|---|---|
| `TArray`, `TSet`, `TMap` | `is a container; CrowdyState does not replicate containers; use a CrowdyEvent RPC or a Game Model container` |
| A plain struct that holds a container at any depth | `is a USTRUCT that transitively contains a container (TArray/TSet/TMap); such nested containers are rejected because a forged element count would drive an unbounded allocation on decode` |
| A fixed-size C array (`float Values[4]`) | `is a fixed-size array; CrowdyState replicates only single-value POD and USTRUCT properties (its positional diff would miss changes past element 0)` |
| `UObject*`, `TSubclassOf`, soft object and class references, interfaces, delegates | `is an object/interface/delegate reference; CrowdyState replicates only POD and USTRUCT values` |
| Anything else, `FText` for one | `has an unsupported type 'X'; CrowdyState replicates only POD and USTRUCT values` |

A rejected property is omitted from the class's layout, so it never corrupts the positional wire order of the ones that were accepted; the rest of the class replicates normally. The line is an error and is not gated by `crowdy.state.trace`, so it is in the log whether or not tracing is on.

## Structs

A plain `USTRUCT` is a single slot. The whole struct is compared with the engine's `Identical` and, when any field differs, the whole struct is sent; on the receiver every field lands together, before the notify runs. That is the reason to use one: two fields that must always be seen together, a colour and an intensity, cannot arrive half-applied the way two separate properties can.

The lantern's glow is such a pair. `FLanternGlow` holds a colour and an intensity; `WarmGlow` on the owner changes both, and `OnRep_Glow` applies both to the light in one step.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="state-struct" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A Blueprint variable of a C++ struct type replicates the same way: set its **Crowdy Replication** dropdown to **Replicated** and give it a RepNotify, exactly as for a scalar. Authoring a new struct type in Blueprint for this is unusual, so this page has no Blueprint graph of its own; the mechanics of marking and notifying are on [Crowdy State](./crowdy-state.md).

</TabItem>
</Tabs>

:::caution[A struct diffs and ships as one unit.]
Changing one field of a five-field struct re-sends all five. Five scalar properties diff independently and each ships alone. Group fields into a struct when they must land together; keep them separate when they change at different times.
:::

## Where the list you wanted belongs

| You wanted | Put it on |
|---|---|
| The names of the players who lit the lantern this match | A Game Model container, if it is truth the server should hold; otherwise a `TArray<FString>` parameter on a `Multicast` CrowdyEvent when it changes. |
| A ring buffer of recent positions | The [continuous state](./continuous-state.md) snapshot, as fixed fields, or nothing: the proxy interpolates for you. |
| A reference to another actor | Its NetID as an `FGuid`, resolved with `FindEntity` on the receiver. |
| A list of active effects | A Game Model collection. |

## Gotchas

- `FText` is not accepted on this plane, though it is on a CrowdyEvent. Use an `FString` or an `FName`.
- A struct that is net-serialized is exempt from the nested-container check only because its serializer bounds the decode. A plain struct with a `TArray` inside is rejected however small the array.
- The rejection fires once, at startup, as an error. Grep for `CrowdyState: property`.
- Quantization is decided by the struct's type. To ship a quantized position, declare `FVector_NetQuantize`, not `FVector`.

## Related

- [Crowdy State](./crowdy-state.md): the keys, the notify, the cadence.
- [Static entry points](./crowdy-state-static.md): the manual-dirty push.
- [RPC events in C++](./rpc-events-cpp.md): containers and object references as event parameters.
- [The Two Planes](../concepts/two-planes.md): what belongs on a Game Model instead.
