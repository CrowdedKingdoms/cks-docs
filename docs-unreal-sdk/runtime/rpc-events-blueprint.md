---
slug: rpc-events-blueprint
sidebar_position: 8
title: RPC Events in Blueprint
---

# RPC Events in Blueprint

You can send CrowdyEvents from Blueprint without writing C++.

You mark a Custom Event as replicated in the Details panel, choose who receives it, then call it like any other event. The parameters you add to the Custom Event become the values that travel over the network.

This page covers the Blueprint workflow. For the C++ equivalent, see [RPC Events in C++](/unreal-sdk/runtime/rpc-events-cpp). For how each recipient is delivered and what decay and distance mean, see [Recipients and Routing](/unreal-sdk/runtime/recipients-and-routing).

## Before you start

:::warning[Prerequisites]
The actor that sends or receives a CrowdyEvent must carry a `UCrowdyEntityComponent`. An event is aimed at the entity its sender belongs to, by NetID, so an actor with no entity component has nothing to address.

The map also needs a map profile, or the SDK is inactive and nothing replicates.
:::

## Mark a Custom Event as replicated

1. Add a Custom Event to your actor or component graph. Give it a clear name, for example `SMC_SetObjectLocation` preceded by its designed purpose. For example, if something is meant to be spatially multicast use the convention SMC for it. MC for multicast, ROC for Run On Owner, and Host for Host.
2. Add the parameters you want to send as inputs on the Custom Event. Use the input types directly. There is no payload struct.
3. Select the Custom Event node so its settings appear in the Details panel.
4. Find the **Crowdy Replicates** checkbox in the Details panel and enable it.

![Crowdy Replicates checkbox in the Details panel of a Custom Event](/img/unreal-sdk/bp-crowdy-replicates-checkbox.png)

Once the checkbox is on, the extra routing fields appear below it.

## Set the routing fields

With **Crowdy Replicates** enabled, four dropdowns control how the event is delivered: Recipient, Decay Rate, Replication Distance, and Channel.

### Recipient

The recipient is who receives the event.


![Recipient dropdown on a replicated Custom Event](/img/unreal-sdk/bp-recipient-dropdown.png)

The options match the C++ recipient enum:

- **Spatial Multicast** is the default. The event is spatial and thinned by decay. The owner runs the body locally and announces to nearby clients.
- **Multicast** sends over a named channel at any distance with no decay. Set the channel in the Channel field.
- **Owning Client** delivers only to the entity's owner. This is targeted delivery.
- **Host** delivers only to the elected host. This is targeted delivery.

See [Recipients and Routing](/unreal-sdk/runtime/recipients-and-routing) for the full delivery model.

### Decay Rate

Decay Rate thins how many recipients get the event as distance grows.


![Decay Rate dropdown on a replicated Custom Event](/img/unreal-sdk/bp-decay-rate-dropdown.png)

Values are No Decay (default), Exponential Decay, Linear 50, Linear 25, Linear 10, and Linear 5.

### Replication Distance

Replication Distance is the maximum range, measured in chunks, that the event reaches.


![Replication Distance dropdown on a replicated Custom Event](/img/unreal-sdk/bp-replication-distance-dropdown.png)

Values run from None to Eight Chunks. The default is Eight Chunks.

### Channel

Channel is the named channel used when Recipient is Multicast. The SDK joins every referenced channel on connect, so you only need to type a name here.


![Channel field on a replicated Custom Event](/img/unreal-sdk/bp-channel-field.png)

:::note
Decay Rate and Replication Distance apply only to Spatial Multicast. For Multicast, Owning Client, and Host, the two dropdowns are ignored.

Multicast uses the Channel field instead. Owning Client and Host are targeted and do not use distance.
:::

## Calling the event

Call the Custom Event the same way you always have: drag a wire from the node that should trigger it then connect it.

When the event runs on the owner, the SDK sends it to the chosen recipients. On a Spatial Multicast event, the owner runs the body locally and the remote clients run the event body when the announcement arrives.

## Example gallery as Blueprint events

These are the same examples shown on the C++ page, rebuilt as Blueprint Custom Events. Each one passes its parameters directly.

### Object: move and rotate

`ASampleObjectEntity` drives an object through spawn, move, rotate, and destroy. Two replicated Custom Events carry the movement:

- `SetObjectLocation` has one input, a Vector. Mark it Crowdy Replicates with Recipient Spatial Multicast. When you call it on the owner, the new location replicates to nearby clients.
- `SetObjectRotation` has one input, a Rotator, with the same settings.

Build each as a Custom Event with the single input, enable Crowdy Replicates, leave Recipient on Spatial Multicast, then wire the input into a Set Actor Location or Set Actor Rotation node inside the event body.


![SetObjectLocation Custom Event taking a Vector input, marked Crowdy Replicates](/img/unreal-sdk/bp-set-object-location-event.png)

### Channel: announce to a named channel

`ASampleChannelSwitch` is a Static, Stable entity with an `Announce` event that broadcasts to everyone on a channel, at any distance.

Build `Announce` as a Custom Event with four inputs, passed directly:

- a String,
- an enum value (the sample uses an animation-state enum),
- an array of Integer,
- a Subclass of Actor.

Enable Crowdy Replicates. Set Recipient to Multicast. Set Channel to `SampleWorldChat`.

:::note
Because the recipient is Multicast, the Decay Rate and Replication Distance dropdowns do not apply.
:::

{/* TODO: replace with real screenshot */}
![Announce Custom Event with four inputs, Recipient set to Multicast and Channel set to SampleWorldChat](/img/unreal-sdk/bp-announce-channel-event.png)

### Targeted events

For an event meant only for the entity's owner, set Recipient to Owning Client. For an event meant only for the elected host, set Recipient to Host.

Both are targeted delivery, so distance does not apply. Build these the same way: a Custom Event with your inputs, Crowdy Replicates enabled, then the recipient set accordingly.

## Allowed parameter types

A Blueprint CrowdyEvent accepts the same parameter types as the C++ version, used directly:

- Boolean, Byte, Integer, Integer64, Float, Double
- Name, String, Text
- any enum
- any structure
- object references, class references, soft object, and soft class references
- arrays of any of the above, including object arrays
- sets and maps of non-object types

You cannot use a return value, a non-const output, a set or map of object references, delegates, or interfaces.

:::tip
Keep parameters small. CrowdyEvents are for view-state intent and gameplay signals, not for large blobs. Authoritative or cheat-sensitive data belongs on a separate server-authoritative path that is not yet documented, not in events.
:::

## Related pages

- [RPC Events in C++](/unreal-sdk/runtime/rpc-events-cpp)
- [Recipients and Routing](/unreal-sdk/runtime/recipients-and-routing)
