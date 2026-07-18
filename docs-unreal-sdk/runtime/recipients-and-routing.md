---
slug: recipients-and-routing
sidebar_position: 9
title: Recipients and Routing
---

# Recipients and Routing

Every CrowdyEvent has a recipient. The recipient decides who runs the receiver and how far the event travels.

You set the recipient with the `CrowdyRecipient` meta on the receiver function. It does not change at the call site, so pick the recipient when you declare the event.

The recipient enum is `ECrowdyEventRecipient`. It has four values:

- `SpatialMulticast`
- `Multicast`
- `OwningClient`
- `Host`

This page covers what each one does, how the spatial path thins delivery with decay and distance, and when to choose each.

:::note
An event is always aimed at the entity its sender object belongs to, by NetID, and the receiving actor must carry a `UCrowdyEntityComponent`. That is true for every recipient. The recipient only changes which clients run the body once the event reaches them.
:::

## The four recipients

You declare the recipient on the receiver function:

```cpp
#include "Replication/RPC/CrowdyEvent.h"

UFUNCTION(meta=(CrowdyEvent, CrowdyRecipient="OwningClient"))
void Heal_Implementation(int32 Amount);
CROWDY_EVENT(Heal)
```

Call `Heal(25)` to send. With `OwningClient`, only the entity's owner runs `Heal_Implementation`.

| Recipient | Travels over | Distance and decay | Who runs the body |
|-----------|-------------|--------------------|-------------------|
| `SpatialMulticast` (default) | Spatial UDP | Yes, decay-thinned | Clients near the entity |
| `Multicast` | A named channel | No, any distance | Every channel member |
| `OwningClient` | Targeted delivery | No | Only the entity's owner |
| `Host` | Targeted delivery | No | Only the elected host |

### SpatialMulticast

`SpatialMulticast` is the default. The event travels the spatial path: it reaches clients that are near the entity, and decay and distance thin that delivery.

Use it for events that only matter to players who can see the entity, such as a one-shot animation, a hit reaction, or a cosmetic effect tied to a location in the world.

On a SpatialMulticast event the owner runs the body locally and announces to the others. Remote clients run the `_Implementation`. The owner does not receive its own announcement back.

```cpp
UFUNCTION(meta=(CrowdyEvent, CrowdyRecipient="SpatialMulticast", CrowdyDistance="Four_Chunks", CrowdyDecay="Linear_50"))
void PlayHitSpark_Implementation(FVector Location);
CROWDY_EVENT(PlayHitSpark)
```

### Multicast

`Multicast` routes the event over a named channel set by `CrowdyChannel`. It reaches every member of that channel at any distance, with no decay.

Use it for events that must reach players regardless of where they stand, such as a world-wide chat line or a match-wide announcement.

```cpp
UFUNCTION(meta=(CrowdyEvent, CrowdyRecipient="Multicast", CrowdyChannel="SampleWorldChat"))
void Announce_Implementation(FString Message);
CROWDY_EVENT(Announce)
```

The SDK joins every referenced channel on UDP connect, plus a default session channel. See [Channels](/unreal-sdk/runtime/channels) for how channels are joined and named.

### OwningClient

`OwningClient` is targeted, point-to-point delivery: the server delivers the event to one client, and only the entity's owner runs the body.

Use it when only the player who owns the entity should react, such as a private result, a personal reward, or a correction meant for the owner alone.

`OwningClient` ignores distance and decay. Those apply only to `SpatialMulticast`.

### Host

`Host` is targeted delivery to the elected host. Only the host runs the body.

Use it when a client needs to hand a decision to the host, such as requesting a host-owned spawn or asking the host to arbitrate something that is a convention rather than an enforced rule.

The host is a convention, not an enforced server role. See [Host Authority](/unreal-sdk/runtime/host-authority) for how the host is elected and how to check whether this client is the host.

:::note
`OwningClient` and `Host` are targeted delivery. They do not fan out to nearby clients and they do not use a channel. Distance and decay have no effect on them.
:::

## How decay and distance thin spatial delivery

`ECrowdyDecayRate` and `ECrowdyReplicationDistance` apply only to `SpatialMulticast`. The other three recipients ignore them.

**Distance** sets how far the event can reach, measured in chunks. The values run from `None` to `Eight_Chunks`, and the default is `Eight_Chunks`. A smaller distance means the event reaches only clients close to the entity, and clients past the cutoff never receive it.

**Decay** thins delivery within that distance:

- With `No_Decay` (the default) every client inside the distance receives the event.
- With a decay rate, the chance of delivery falls off as a client gets farther from the entity, so far clients are more likely to be skipped than near ones.

Decay is a way to keep traffic down for events where a missed copy at long range does not matter.

The decay values are:

| Value | Effect |
|-------|--------|
| `No_Decay` (default) | Every client inside the distance receives the event |
| `Exponential_Decay` | Delivery chance falls off exponentially with distance |
| `Linear_50` | Linear falloff, the strongest of the linear rates |
| `Linear_25` | Linear falloff, thinner again |
| `Linear_10` | Sparse delivery at range |
| `Linear_5` | Sparsest delivery at range |

Set both on the receiver:

```cpp
UFUNCTION(meta=(CrowdyEvent, CrowdyRecipient="SpatialMulticast", CrowdyDistance="Eight_Chunks", CrowdyDecay="Exponential_Decay"))
void Footstep_Implementation(FVector Location);
CROWDY_EVENT(Footstep)
```

:::tip
Use a tighter distance and some decay for high-frequency cosmetic events like footsteps. Use `Eight_Chunks` and `No_Decay` for events a nearby player must not miss, like a death effect.
:::

## Choosing a recipient

- The event matters only to players who can see the entity: use `SpatialMulticast`. Add distance and decay to control reach and traffic.
- The event must reach players regardless of distance: use `Multicast` over a named channel.
- Only the owner should react: use `OwningClient`.
- The host should handle it: use `Host`.

:::tip
If you are unsure, start with `SpatialMulticast`. It is the default and it fits most in-world events.
:::

## Reference

For the full enum values, see the [Enums Reference](/unreal-sdk/reference/enums). For the channel side of `Multicast`, see [Channels](/unreal-sdk/runtime/channels). For the host side of `Host`, see [Host Authority](/unreal-sdk/runtime/host-authority).
