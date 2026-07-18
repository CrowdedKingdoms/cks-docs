---
slug: crowdy-state
sidebar_position: 6
title: Crowdy State (Property Replication)
---

# Crowdy State (Property Replication)

Crowdy State replicates a property on an entity without you writing a snapshot struct or an executor.

Mark a `UPROPERTY` on an entity actor, and the owning client diffs that property's value every replication tick, ships only what changed, and writes it back onto the same property on every other client's copy of the actor. No wire struct, no `GetActorState` override, no manual send call, unless you want one.

This page covers what Crowdy State is and is not, the five metadata keys, how the diffing and delivery actually work, what quantizes for free, the host convention, ownership transfer, and the honest limits: what does not replicate yet, and what happens at the edges.

## What Crowdy State is, and is not

Crowdy State is the fast, client-authoritative **view plane**. It exists to make a value on a live actor look right on every client: an animation flag, a facing direction, a "is aiming" bool, anything you would otherwise hand-roll into a continuous state struct.

Crowdy State is not truth, and it is not enforced. It is a sibling to [Actor State](/unreal-sdk/runtime/continuous-state), the executor-based snapshot channel. It is a view plane only: authoritative, cheat-sensitive, or persistent state is out of scope for Crowdy State and is handled by a separate server-authoritative path that is not yet documented.

Use this rule to decide where a value belongs:

- Would a cheater changing this value matter? Or does the value need to survive a reconnect? It does not belong on this plane. Keep it on the server-authoritative path instead.
- Is it just how things look, sound, or animate right now, and nothing breaks if a modified client lies about it? Put it in **Crowdy State**.

HP, currency, inventory, anything cheat-sensitive or that must persist: none of that belongs here. Movement-adjacent gameplay flags, cosmetic state, and anything view-only: that is exactly what this plane is for.

## Before you start

Crowdy State rides the same entity you already have.

:::warning[Prerequisites]
The actor must carry a `UCrowdyEntityComponent`. A Crowdy State property is written back by NetID, exactly like a CrowdyEvent, so an actor with no entity component has nothing to address.

The map also needs a map profile with the state replicator enabled (`bUseStateReplicator`, on by default), or nothing sends. See [Map Profile](/unreal-sdk/runtime/map-profile).
:::

## Mark a property

### C++

Add `meta=(CrowdyState)` to a `UPROPERTY`.

```cpp
UPROPERTY(meta = (CrowdyState))
bool bIsAiming = false;

UPROPERTY(meta = (CrowdyState, CrowdyOnRep = "OnRep_Stance"))
uint8 Stance = 0;

UFUNCTION()
void OnRep_Stance();
```

That is the whole setup for a C++ property. It is discovered automatically, laid out in declaration order alongside your other `CrowdyState` properties on the class, and diffed by the owning client from then on.

### Blueprint

A Blueprint variable uses the same metadata, set from the variable's Details panel instead of a UPROPERTY line.

1. Select the variable in **My Blueprint**.
2. In the Details panel, find the **Crowdy Replication** dropdown.
3. Set it to **Replicated**. This writes the `CrowdyState` key onto the variable.
4. With Replicated selected, a **RepNotify** field appears. Point it at a parameterless custom event if you want a notify when the value changes (this writes `CrowdyOnRep`). Picking Replicated also auto-creates an `OnRep_<Var>` event graph for you the first time, if you have not named one.
5. A **Heartbeat** toggle also appears, and it defaults On the first time a variable enters Replicated mode (this writes `CrowdyHeartbeat`). Leave it on if you want the variable to ride the periodic keyframe; turn it off for a pure on-change property. See [Keyframes and spawn state](#no-relevance-gain-hook-keyframes-and-spawn-state) for what the heartbeat does.
6. Open **Advanced** for two more toggles: **Only send to owner** (`CrowdyOwnerOnly`) and **Update manually** (`CrowdyManualDirty`). Leave both off for the common case: a spatially broadcast, auto-diffed property.

Compiling the Blueprint is what makes the change take effect. A Blueprint variable becomes a real `FProperty` on the generated class, so it flows through the exact same discovery path as a C++ property, with no separate Blueprint-only logic.

After you Compile, a Crowdy State-replicated variable's **Get** and **Set** graph nodes show the same top-right replication corner badge Unreal draws on natively-replicated variables. That badge is your quick visual confirmation the variable is on the plane; it appears on the next Compile after you switch the dropdown to Replicated, and disappears again if you switch it back to None and Compile.

:::note
Crowdy State and Unreal's own native variable replication are mutually exclusive. Switching a variable to Replicated clears any native replication on it, and the compiler will flag it if you try to enable both.
:::

:::tip
If the variable's type cannot replicate on this plane (an object reference, a container, a static array), the Details panel tells you inline instead of silently doing nothing. See [Unsupported types](#unsupported-types-for-now) below for the full list.
:::

## The five metadata keys

These are the five keys, summarized below. The [Crowdy State metadata keys reference](/unreal-sdk/reference/state-meta-keys) collects the same table in compact form for quick lookup.

| Key | Blueprint label | Meaning |
| --- | --- | --- |
| `CrowdyState` | Replicated (the mode) | Marks the property for Crowdy State. Required; the other four keys do nothing without it. |
| `CrowdyOnRep` | RepNotify | The name of a parameterless notify function, run on the receiver right after the property is written, and only when its value actually changed. |
| `CrowdyOwnerOnly` | Only send to owner | Delivery scope: this property ships only to the entity's owning client, never on the spatial broadcast. |
| `CrowdyManualDirty` | Update manually | Skip the automatic per-tick diff. The value ships only when you explicitly mark it dirty. |
| `CrowdyHeartbeat` | Heartbeat | Opt this property into the periodic keyframe re-send. Without it, the property still replicates on change; it is just never re-sent while unchanged. |

```cpp
UPROPERTY(meta = (CrowdyState,
    CrowdyOnRep = "OnRep_StaminaHint",
    CrowdyOwnerOnly,
    CrowdyManualDirty,
    CrowdyHeartbeat))
float StaminaHint = 1.0f;
```

A few things worth being precise about:

- **Four of the five keys are bare markers.** `CrowdyState`, `CrowdyOwnerOnly`, `CrowdyManualDirty`, and `CrowdyHeartbeat` take no value: you add the bare key to turn each on. The code tests only whether the key is present, so writing `= true` is unnecessary, and `= false` would still read as on. `CrowdyOnRep` is the one key that takes a value, the notify function's name.
- **`CrowdyOnRep` is parameterless, GAS-style.** The notify function takes no arguments and gets no "previous value." Read the new value directly off the property inside the notify.
- **`CrowdyOnRep` fires on change, not on receipt.** The receiver only runs the notify when the incoming value actually differs from what it already held. A keyframe that re-sends an unchanged value is an idempotent no-op: the value is not rewritten and the notify does not fire. This matters when you mark a heartbeat property with a notify -- you will not get a notify every keyframe interval, only on a real change.
- **`CrowdyOwnerOnly` is a delivery scope, not secrecy.** It routes the property down a targeted, single-recipient path instead of the spatial broadcast, so only the owning client's copy is written. It is not encryption and it is not access control; it changes who receives the value, not who could in principle intercept it.
- **`CrowdyManualDirty` properties are never auto-diffed.** Nothing about the value changing on its own triggers a send. You push it yourself with `MarkStateDirty` (below). One call marks it dirty for exactly the next send; after that send goes out, the bit clears and you call it again for the next update.
- **`CrowdyHeartbeat` is opt-in, and only affects the periodic re-send.** A marked property is included in the keyframe heartbeat; an unmarked one is not. Neither setting touches on-change replication: a changed property always ships on the next tick regardless of this key. In C++ you must add the key explicitly. In Blueprint the Heartbeat toggle defaults On the first time a variable becomes Replicated, so Blueprint and C++ have deliberately different defaults.

## Owner diffing

Only the client that owns an entity diffs that entity's `CrowdyState` properties. A remote proxy never diffs; it only receives and applies.

Keep in mind a player is itself an entity, and a client can own many entities at once: its own pawn, anything it spawned, anything reassigned to it. Each owned entity is diffed independently at the map's replication cadence.

The cadence is the same `ReplicationIntervalHz` your map profile already sets for [Actor State](/unreal-sdk/runtime/continuous-state) (1 to 10, default 10), and the spatial broadcast uses a tight relevance distance, so a Crowdy State delta reaches roughly the same audience a `SpatialMulticast` CrowdyEvent would.

Each tick, for each owned entity:

1. Every `CrowdyState` property on the entity's class is compared against its own shadow copy of the last-sent value.
2. Only the properties that changed are encoded into one delta.
3. Spatial properties (not `CrowdyOwnerOnly`) go out on the broadcast path; `CrowdyOwnerOnly` properties that changed go out as a second, targeted delta to the owner alone.
4. `CrowdyManualDirty` properties are never part of this automatic diff; they only appear in a delta if you flagged them since the last send.

If nothing on an entity changed since the last tick, no delta is sent for it at all.

## Type-driven quantization

Some struct types shrink automatically on the wire, with no metadata to set.

If a property's type is a struct that has a native net serializer, for example `FVector_NetQuantize` or any of the `_NetQuantize` family, Crowdy State uses that serializer instead of the generic path. That is strictly opt-in by type: declare the property as `FVector_NetQuantize` instead of `FVector` and it quantizes; there is no key that turns quantization on or off for an arbitrary type.

```cpp
// Exact on the wire, no quantization.
UPROPERTY(meta = (CrowdyState))
FVector ExactLocation;

// Quantized automatically because FVector_NetQuantize carries a native net serializer.
UPROPERTY(meta = (CrowdyState))
FVector_NetQuantize CompactLocation;
```

:::caution
This is not limited to the `_NetQuantize` family by name. Any struct that declares a native net serializer quantizes the same way. `FRotator` is the example worth knowing: it has one, so a plain `FRotator` marked `CrowdyState` rounds to roughly 0.0055 degrees per axis on the wire. It is not exact, and it does not need to be marked as quantized; the engine's own serializer for that type is what is doing it. A plain `FVector` has no native net serializer, so it stays exact.
:::

## Host precedence: a convention, not enforcement

Crowdy State follows the same rule the rest of the SDK does: [the host is a convention](/unreal-sdk/runtime/host-authority), not a server that rejects anything.

For an entity you own, the receive side applies this rule:

- A correction that arrives from the elected host is applied, and your own shadow adopts the host's values so your next diff does not immediately revert them.
- A delta from anyone else, for an entity you own, is dropped. You are the one driving your own entities; a non-host peer does not get to write into them.

That is the entire mechanism, and it is worth being honest about what it does not do. This plane is client-authoritative and there is no server checking any of it. A modified client that lies about being the host, or forges the "this came from the host" flag, would have its correction honored exactly as if it were real. If a value needs real protection against a cheating client, it does not belong on this plane at all; keep it on the server-authoritative path instead.

## Authority and world entities

Everything above assumes the common case: you own an entity, you diff it, and the elected host may correct it. Two fields on `UCrowdyEntityComponent` let you change that default, and they are what make world objects and host overrides work.

### Two fields: Ownership and HostOverride

On the entity component's Details panel:

- **Ownership** (default **Local Client**): who owns and simulates this entity.
  - **Local Client**: this client owns it. The normal case, your pawn or anything you spawned. Its role is `Owner`.
  - **Host**: whichever client is currently host owns it. For level-placed world and AI entities that belong to the session rather than to any one player. Its role is `Host Owned`, and it carries no per-client owner id.
- **HostOverride** (default **Allow**), shown only when Ownership is Local Client: whether the elected host may override this entity's Crowdy State as a super-user.
  - **Allow**: a host correction is applied, and your own shadow adopts it so your next diff does not immediately revert it.
  - **Owner Only**: only you change this entity. Even a host correction is dropped.

Ownership is a separate axis from `Mode` (Dynamic/Static) and from `IdentityPolicy`. `Mode` governs the continuous [Actor State](/unreal-sdk/runtime/continuous-state) channel and has nothing to do with who owns the entity. A world entity almost always wants `IdentityPolicy = Stable`, so every client computes the same NetID for it; the component warns if you set Ownership to Host with any other identity policy.

:::note
These fields only take effect on an entity that resolves its own identity (a level-placed actor, or one placed with `IdentityPolicy = Stable`). An entity spawned at runtime through `SpawnCrowdyEntity` already gets its role from the spawn event, so it ignores Ownership: a host-spawned runtime entity is already host-owned in practice.
:::

### The host as a super-user

The elected host can write Crowdy State onto an entity it does not own, as a deliberate one-shot push. The mechanism is the same `Mark Crowdy State Dirty` you already use for manual-dirty properties, this time pointed at an entity you do not own:

```cpp
// From host-side code: correct a door on another player's entity.
UCrowdyStateBlueprintLibrary::MarkCrowdyStateDirty(OtherPlayersDoor, TEXT("bIsOpen"));
```

When the target is an entity you do not own, `Mark Crowdy State Dirty` reads the property's current value off that entity and broadcasts it once, stamped as coming from the host if you are the host. There is no shadow and no ongoing tracking; it is a single authoritative correction, not a subscription.

This is deliberately a separate, explicit path. Host-owned entities are never auto-diffed, and a host override is never a background diff. Keeping one explicit push path for all host-authority writes is what avoids the "host sets X, the client re-sends its own Y, and they fight" race that a second implicit mechanism would create.

What the receiver does with the push depends on who owns the target and on its HostOverride:

- On the entity's **owner**, an **Allow** correction from the host is applied and adopted; an **Owner Only** correction is dropped; and a push from anyone who is not the host is dropped (host precedence, exactly as in the section above).
- On a **third client** that holds the entity as a proxy, the correction is applied like any other delta. Enforcement is owner-side; proxies reflect what they receive. That is the unenforced view plane working as intended, not a hole.

:::warning
Anyone can call `Mark Crowdy State Dirty` on any entity, not just the host. A non-host push is not stamped host-sourced, so the real owner drops it, but this is a convention, not a security boundary: a modified client can forge the host-sourced flag. Cheat-sensitive state belongs on the server-authoritative path, never here.
:::

### World entities: only the host writes them

A Host-owned entity (a world prop, a shared switch, a session-owned AI) has no per-client owner. While you are the host, you drive it: it is tracked, its manual-dirty properties push when you mark them, and it emits the periodic keyframe for any `CrowdyHeartbeat`-marked properties so a late joiner still gets a baseline. Its ordinary properties are not auto-diffed; a world entity changes only when you explicitly push it.

On the receive side, a delta for a world entity is applied only if it is host-sourced; a push from a non-host client is dropped. So world state has a single writer (the host) by convention, the same way an owned entity has a single writer (its owner).

### Host changes and level travel

Host identity survives a level change (it lives on the game-instance session, not the world). Host-owned tracking follows it for you:

- If you spawn into a level where the host is already elected, your world entities register and are tracked correctly with no host-changed event, because tracking reads the current host live at registration.
- If the host changes mid-session, the client that becomes host starts driving every world entity, and the client that loses the role stops driving them (it no longer emits their state, keyframes included). No world entity ends up with two writers, and none ends up with zero.

You do not wire any of this. Place the world entity with `Ownership = Host` and `IdentityPolicy = Stable`, and the SDK tracks host election for you. For the general host convention (the `GetCrowdyHasAuthority` check, `OnHostElected`), see [Host Authority](/unreal-sdk/runtime/host-authority).

## Ownership transfer: request and grant

Ownership is not fixed for the life of an entity. A client can ask the current owner to hand an entity over, and the owner grants or ignores it. Like everything else on this plane, this is a coordination convention, not an enforced boundary: the transfer re-points who diffs the entity, nothing more. It is also transient, so a client that first observes the entity after a grant sees the spawn-time owner, not the transferred one.

The whole flow lives on a static Blueprint library, `UCrowdyOwnershipTransfer`, so you never have to fetch the entity component by hand:

- `RequestOwnershipTransfer(Target)`: from a client that does not own `Target`, ask its current authority for ownership.
- `GrantOwnershipTransfer(Target, NewOwner)`: from the authority, hand `Target` to whoever owns `NewOwner` (pass that player's avatar, or any entity they own).
- `GrantOwnershipTransferToPlayer(Target, NewOwnerPlayerID)`: the same grant, but by player id. The request handler hands you the requester's id directly, which is handy when that player has no local avatar to resolve.
- `GrantOwnershipToHost(Target)`: make `Target` host-owned, a world entity owned by whichever client is host.

Each of these is a safe no-op, never a crash, when the target is null or is not a registered Crowdy entity.

### The handshake

A request reaches the entity's current authority (its owning client, or the host for a host-owned world entity). What happens next depends on one per-entity flag on `UCrowdyEntityComponent`:

- If `bAutoApproveOwnershipRequests` is set, the authority grants immediately.
- Otherwise the authority's `UCrowdyEntitySubsystem::OnOwnershipRequested` fires. Your game code decides: call a Grant node to approve, or do nothing to reject. **Ignoring a request is the rejection.** There is no explicit deny call and no error path; silence is the answer.

A grant is announced reliably to every client and surfaces as `UCrowdyEntitySubsystem::OnEntityOwnershipChanged`, so all clients agree on who now owns the entity.

### What a transfer actually changes

Under the hood a transfer re-points `OwnerID` on the entity record and re-derives the entity's role from it. An actor's NetID is owner-independent, so it keeps the same NetID and stays addressable: existing references and in-flight sends still resolve. The old owner stops diffing the entity, the new owner builds a fresh shadow and starts diffing, and every bystander keeps its proxy.

:::caution
Two by-design edges are worth knowing. A new owner that never observed the entity has no history for it, so it re-baselines from the proxy defaults it holds; if the exact current values matter, put them in the spawn `InitialState` or push them explicitly after the grant. And granting to a player id that has no local presence on the granting client orphans the entity until it is re-granted. Neither is a bug; both fall out of this being a transient view plane rather than a persistent record.
:::

## No relevance-gain hook: keyframes and spawn state

Crowdy State has no "you just became relevant, here is a full snapshot" trigger. A newly relevant peer gets a baseline in one of two ways:

- The entity's spawn `InitialState`, the same struct passed to `SpawnCrowdyEntity`, if the values it needs were included there.
- The next periodic keyframe heartbeat, for properties that opt into it.

### The keyframe is opt-in per property

The keyframe heartbeat is a redundant, periodic full re-send of a property's current value, whether or not it changed, so a peer that missed everything up to that point still converges. It is **not automatic**: a property rides the heartbeat only if you mark it `meta=(CrowdyHeartbeat)`. An unmarked property still replicates the instant it changes; it is simply never re-sent while it sits unchanged.

This keeps the plane cheap by default. Most transient view state does not need a periodic baseline, so it should not pay for one. Opt a property in only when a late or packet-loss-desynced observer genuinely needs to converge to it without waiting for the next change.

There are three levels of control, from broad to narrow:

- **Map-wide off switch.** The map profile's `StateKeyframeIntervalSeconds` (default 2 seconds) sets the heartbeat interval. Set it to `0` to disable the heartbeat for the whole map. On-change replication is unaffected; only the periodic baseline stops.
- **Per-entity kill switch.** `ECrowdyStateHeartbeat` on `UCrowdyEntityComponent` is `Inherit` by default (follow the map) or `Off` (never emit a keyframe for this entity, regardless of its property marks or the map setting). A kill switch for always-active entities.
- **Per-property opt-in.** `meta=(CrowdyHeartbeat)` on the property itself. In C++ you add this key explicitly; in Blueprint the Heartbeat toggle in the Crowdy Replication dropdown defaults On the first time the variable becomes Replicated.

When the heartbeat does fire for an entity, it is staggered per entity so heartbeats do not all land on the same tick, and it carries every marked spatial (non-`CrowdyOwnerOnly`) property's current value at once.

:::caution
Be plain with yourself about the gap this leaves. If a peer becomes relevant right after a keyframe went out, and nothing on that entity changes in the meantime, that peer can hold stale or default values for up to one full keyframe interval before it sees a correct baseline. And a property with no `CrowdyHeartbeat` mark gets no periodic baseline at all: a peer that became relevant after the last change holds the default until the next change. This is a known, accepted design, not a bug to work around client-side. If a value absolutely cannot be wrong for even a few seconds after becoming relevant, put it in the spawn `InitialState`, or mark it `CrowdyHeartbeat` and accept the periodic cost, or reconsider whether it belongs on this transient view plane at all.
:::

## Manual dirty: pushing a value yourself

A `CrowdyManualDirty` property sits out of the automatic diff entirely. Nothing ships until you say so.

```cpp
// C++, from the owning entity's own code.
CrowdyEntity->MarkStateDirty(TEXT("StaminaHint"));

// Or flag every manual-dirty property on this entity at once.
CrowdyEntity->MarkAllStateDirty();
```

Both are `UFUNCTION(BlueprintCallable)` on `UCrowdyEntityComponent`, so they are available from Blueprint the same way. Call `MarkStateDirty` by property name after you change the value; it takes effect on the entity's next send tick, then the flag clears. On an entity you own, that schedules the manual-dirty property. On an entity you do not own, the same call is a one-shot host override push instead, described in [Authority and world entities](#authority-and-world-entities). Either way it is a harmless no-op, never an error, when the map runs no state replicator at all.

## Executor-state exclusivity

A single field lives on exactly one replication plane, never both.

If a property is marked `CrowdyState` and its name and type also match a field already declared in that actor's [Actor State](/unreal-sdk/runtime/continuous-state) executor struct, Crowdy State drops that property from its own layout at discovery time and logs an error. The continuous state channel keeps sole ownership of that field; Crowdy State will not also try to replicate it down a second path.

If you see that error, the fix is to pick one plane: either remove the field from your executor state struct and let Crowdy State own it, or remove the `CrowdyState` metadata and let the executor keep owning it.

## Unsupported types (for now)

Crowdy State covers plain values and plain structs: numbers, bools, enums, names, strings, and USTRUCTs built from those. A few categories are explicitly out of scope on this plane today:

- **Object references.** `UObject*`, soft references, class references, anything that names another object.
- **Containers.** `TArray`, `TSet`, `TMap`, in any position, including buried inside a struct.
- **Static (fixed-size) arrays.** A C-style `Score[4]` on a UPROPERTY.

A property of one of these kinds is rejected at discovery with a clear error and simply does not appear in the layout; it never corrupts the properties around it. If you need to replicate a reference or a collection, reach for a [CrowdyEvent RPC](/unreal-sdk/runtime/rpc-events-cpp), which supports arrays, sets, maps, and object references directly as call parameters. If the data is authoritative, it belongs on the server-authoritative path, not here.

:::note
Container support on this plane may become its own future phase. It is not planned as part of the current design; this page describes what exists today.
:::

## The LayoutHash guard

Every delta carries a hash of the sending client's property layout for that class. The receiver compares it against its own layout for the same class before touching anything.

If the two do not match, for example two clients running builds where a `CrowdyState` property was added, removed, reordered, or changed type, the receiver drops the delta cleanly instead of misreading bytes into the wrong properties. You will not see corrupted state from a layout mismatch; you will see a dropped delta and a warning in the log.

## Scale and per-observer batching

Be clear-eyed about what happens on the wire today, because it is easy to assume more batching exists than actually does.

Every Crowdy State delta your client sends is its own standalone UDP datagram. A spatial (broadcast) delta is one `DispatchGameEvent` call producing one message; a targeted, owner-only delta is one `DispatchSingleActorMessage` call producing one message. There is no client-side queue that gathers several entities' deltas, or several properties across different entities, into a single packet before it hits the socket. One dispatched delta is one send, at every layer between the replicator and the network socket.

The protocol does define a `MESSAGE_BUNDLE` message type, but it exists only as something the client can unpack on **receive**: if an incoming datagram happens to already be a bundle of several messages, the client splits it apart and dispatches each one individually. There is no corresponding path anywhere in the client that builds an outbound bundle. So `MESSAGE_BUNDLE` is not evidence of, and not a mechanism for, batching your own outbound Crowdy State traffic.

The spatial path already multicasts one delta to every relevant client in range, which is the batching Crowdy State gives you today: one send reaches many recipients, rather than one send per recipient. True per-observer batching, coalescing many different entities' state into a single packet tailored to one recipient, or relevance-aware fan-out that only sends what a specific observer needs, is a capability that would live on the relay server, not the client. It does not exist yet. This page will be updated if and when that lands; nothing here should be read as promising it is already happening under the hood.

## Debugging

Turn on `crowdy.state.trace` to see per-delta info lines as they are sent and received.

```text
crowdy.state.trace 1
```

With it on, you get one line per delta: which entity, how many properties changed, how many bytes the encoded blob was, and whether it went out as spatial, owner-only, or a keyframe. Warnings (a dropped foreign delta for an entity you own, a `LayoutHash` mismatch, a rejected property type) and errors (an executor-state exclusivity conflict) print regardless of the trace setting.

:::note
Trace output never includes bearer tokens or other secret material. It is safe to share a trace log when reporting an issue.
:::

### Single-client loopback

Crowdy State normally needs two clients to see anything: one owns and diffs the entity, another receives and applies. `crowdy.state.loopback` lets you exercise the full receive path with a single PIE client, the same way `crowdy.rpc.loopback` does for CrowdyEvents.

```text
crowdy.state.loopback 1
```

With it on, each owned, tracked entity gets a lazily-spawned local "mirror" -- a distinct `RemoteProxy` entity. Every outgoing delta is replayed onto that mirror through the real receive path, so decode, apply, and `CrowdyOnRep` all run with just one client. It is off by default, so a normal session is byte-for-byte unaffected.

:::caution
Loopback replays what actually gets sent; it does not change what triggers a send. A `CrowdyManualDirty` property still needs an explicit `Mark Crowdy State Dirty` to go out. Setting the value alone does not replicate it, with or without loopback on. If your loopback test shows nothing, check that you marked the property dirty, not just that you changed it.
:::

Two read-only handles help you check state in the editor without printing anything:

- `UCrowdyStateReplicator::IsStateReplicated(const AActor*)` tells you whether an actor's class carries at least one `CrowdyState` property, regardless of whether this client currently owns it.
- `UCrowdyStateReplicator::GetLastSentStateBytes(const AActor*)` reports the blob size this client last sent for that actor, or `-1` if this client does not drive it. It is a local diagnostic of what you last sent, not a guarantee of what any peer received.

For the full CVar table and the rest of the SDK's log categories, see the [console variables reference](/unreal-sdk/reference/console-cvars).

## Related

- [Actor State](/unreal-sdk/runtime/continuous-state): the executor-based snapshot channel Crowdy State sits alongside.
- [Crowdy State metadata keys](/unreal-sdk/reference/state-meta-keys): the compact reference table for the five keys.
- [RPC Events in C++](/unreal-sdk/runtime/rpc-events-cpp): the event path for object references, containers, and one-off signals.
- [Host Authority](/unreal-sdk/runtime/host-authority): the convention Crowdy State's host precedence is built on.
- [Entities and Spawning](/unreal-sdk/runtime/entities-and-spawning): `InitialState` and the owner/proxy split Crowdy State relies on.
