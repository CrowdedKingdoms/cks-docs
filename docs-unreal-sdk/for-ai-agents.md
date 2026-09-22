---
slug: for-ai-agents
sidebar_position: 90
title: For AI Agents
description: "The fastest correct path for a coding agent working in an Unreal project that uses the Crowdy SDK: where each kind of state goes, the marker vocabulary with one example each, what breaks silently in a cooked build, the settings never to hand-edit, and the console variables for testing alone."
---

# For AI Agents

This page is the routing layer for a coding agent working inside a studio's Unreal project. It does not re-explain the SDK; every row links the page that owns the fact, and the full text of every page is available as one file for your context window. Read this page, then pull only the pages a task needs.

Three machine-readable files sit beside the docs. This page is where they are described:

| File | What it is |
|---|---|
| [`/helpers/unreal-sdk/llms-full.txt`](pathname:///helpers/unreal-sdk/llms-full.txt) | Every page in this section as plain text, in sidebar order, with every C++ snippet inlined and a pointer line for every Blueprint graph. |
| [`/helpers/unreal-sdk/sdk-surface.json`](pathname:///helpers/unreal-sdk/sdk-surface.json) | The generated inventory of every reflected symbol the plugin ships. Check it before you go looking through headers; see [SDK surface manifest](./reference/sdk-surface.md). |
| [`/helpers/unreal-sdk/AGENTS.md`](pathname:///helpers/unreal-sdk/AGENTS.md) | The drop-in for a project root, `CLAUDE.md`, or `.cursorrules`: the locked rules and one example per marker, under 8 KB. |

## Where does this state go

Ask one question: can a malicious client benefit from lying about this value? If yes, it is a Game Model attribute on the truth plane. If no, it is view state. [The Two Planes](./concepts/two-planes.md#deciding-where-a-field-goes) owns the rule and every row but the door's; that one applies the same test.

| State | Plane | Mechanism | Owning page |
|---|---|---|---|
| Movement | View | Dynamic entity mode, continuous state channel | [Continuous state](./runtime/continuous-state.md) |
| Animation blend state | View | `meta=(CrowdyState)` property, diffed on change | [Crowdy State](./runtime/crowdy-state.md) |
| A one-shot trigger (muzzle flash, impact) | View | `meta=(CrowdyEvent)` RPC, not a state field | [RPC events](./runtime/rpc-events-cpp.md) |
| Hit points | Truth | `meta=(CrowdyModel)` attribute, "Server Owned" in Blueprint | [Game Models overview](./game-models/overview.md) |
| Inventory | Truth | Game Model container with items linked as a collection | [Collections](./game-models/collections.md) |
| Currency | Truth | Attribute on a container scoped `CrowdyScope="App"` | [Game Model meta keys](./reference/game-model-meta-keys.md) |
| Match score | Truth | Attribute on a container scoped to the session (the default) | [The Two Planes](./concepts/two-planes.md#deciding-where-a-field-goes) |
| A chat line | View | `CrowdyEvent` with the `Multicast` recipient, session channel | [Channels](./runtime/channels.md) |
| A door's open flag | View | `CrowdyState` boolean: a lie is a visual glitch. A placed door is host-owned, so the flag is also `CrowdyManualDirty` and the host calls `MarkStateDirty` after each write. If the door gates progress (a lock), the lock state is a Game Model attribute | [The Two Planes](./concepts/two-planes.md#deciding-where-a-field-goes), [the host push](./runtime/crowdy-state.md#on-an-entity-you-do-not-own-the-host-push) |
| A player's display name | View | `CrowdyState` property; route it through the avatars service if it must persist | [The Two Planes](./concepts/two-planes.md#deciding-where-a-field-goes), [Avatars](./services/avatars.md) |

:::danger[Authoritative or cheat-sensitive state never belongs in Crowdy State.]
Crowdy State is written by the owning client and believed by everyone else. Low latency is not a reason to move a value to the view plane; predict locally and let the server's confirmed value overwrite the prediction. [The Two Planes](./concepts/two-planes.md#gotchas).
:::

## The marker vocabulary

Four of the six are `meta=(...)` keys; the entity is a component and the effect is an asset. One canonical example each, all from the same lantern the [Quickstart](./quickstart.md) builds; the snippet id names the file the docs render.

| Marker | Goes on | Canonical example | Owning page |
|---|---|---|---|
| `CrowdyEntity` | A `UCrowdyEntityComponent` on an `AActor` (the component is the marker; set `Ownership`) | `qs-entity` | [Entities, identity, ownership](./concepts/entities-identity-ownership.md) |
| `CrowdyState` (+ `CrowdyOnRep`) | A `UPROPERTY` on an entity actor. On a client-owned entity (`Ownership` = Local Client, the lantern) the owner assigns and calls the notify itself; on a host-owned entity (`Ownership` = Host, the default a placed actor keeps) a plain assignment never ships: add `CrowdyManualDirty` and call `MarkStateDirty` after each write, or add `CrowdyHeartbeat` | `qs-state` | [Crowdy State](./runtime/crowdy-state.md#mark-a-property), [the host push](./runtime/crowdy-state.md#on-an-entity-you-do-not-own-the-host-push) |
| `CrowdyEvent` + `CrowdyRecipient` | A `UFUNCTION` named `X_Implementation`, plus `CROWDY_EVENT(X)`; recipient is one of `SpatialMulticast`, `Multicast`, `OwningClient`, `Host` | `qs-event` | [RPC events](./runtime/rpc-events-cpp.md#routing-keys) |
| `CrowdyContainer="Name"` | A `UCLASS`: an actor, an actor component (the example, bound to the entity it is attached to), or a subsystem | `gm-container` | [Containers and attributes](./game-models/containers-and-attributes.md#declaring-a-container) |
| `CrowdyModel` + `CrowdyKey` + `CrowdyOnRep` | A `UPROPERTY` on a container class; the server owns the value, the notify is parameterless | `gm-container` | [Containers and attributes](./game-models/containers-and-attributes.md#reacting-to-a-change) |
| `CrowdyEffect` | Not a meta key: a `UCrowdyEffect` asset authored in Studio or Effect Script, referenced from C++ as `TObjectPtr<UCrowdyEffect>` | `fx-declare` | [Effects from C++](./game-models/effects-cpp.md#declaring-the-reference), [Effect Script](./game-models/effect-script.md) |

Four rules the examples assume: the first thing a client needs is its own pawn as a `Dynamic`, `PlayerDerived`, `LocalClient` entity spawned after **On UDP Connection Success** (`qs-player`), because the server knows a client by its actor updates and a `SpatialMulticast` reaches only clients with a fresh actor; that pawn registers inside its first possession, since the engine possesses a runtime spawn after its `BeginPlay`, so read its id and `IsLocallyOwned()` from `OnCrowdyOwnershipAssigned`, not at `BeginPlay`; a `SpatialMulticast` body runs on the caller too, so guard the call with `IsLocallyOwned()` ([RPC events](./runtime/rpc-events-cpp.md#gotchas)); a `CrowdyOnRep` function takes no parameters, read the property for the new value ([The Two Planes](./concepts/two-planes.md#what-the-split-means-for-your-code)); and the lantern's assign-and-stop is the client-owned pattern, because the Quickstart sets its `Ownership` to Local Client: a host-owned entity (`Ownership` = Host, the default a placed actor keeps: Static, Stable, level-placed) never ships a plain `CrowdyState` write, so mark the property `CrowdyManualDirty` and call `MarkStateDirty` after each write, or give it `CrowdyHeartbeat` ([the host push](./runtime/crowdy-state.md#on-an-entity-you-do-not-own-the-host-push)).

## Three things that break silently in a cooked build

Editor and Play in Editor hide all three. Only a packaged build shows them.

| Break | Why it is silent | Fix | Owning page |
|---|---|---|---|
| Reading `HasMetaData` at runtime | Cooked and Shipping builds strip UObject metadata; the check answers `false` and marker-driven code goes dark with no error | Read `UCrowdyBakedRegistry`; the SDK already does this for RPC, Crowdy State, and Game Model metadata | [Packaging](./guides/packaging.md#1-rebuild-the-baked-registry) |
| A marker added after the last cook | The baked registry is a snapshot taken at cook time; a new marker is invisible until it is rebaked | Cook again: the cook rebakes the registry at its start, so the break is a package cooked before the marker existed. **Tools > Rebuild Crowdy Registry** or Studio's **Rebuild (Deep Scan)** only refresh the in-editor view of the bake | [Cooked builds](./game-models/containers-and-attributes.md#cooked-builds), [Packaging](./guides/packaging.md#1-rebuild-the-baked-registry), [Inspector and Registry](./studio/inspector-and-registry.md) |
| A placement guid read at `BeginPlay` | The engine releases the per-placement guid before `BeginPlay` in a cooked build; the editor keeps it alive | Read placement data at `OnRegister`, never at `BeginPlay` | [Stable identity in a packaged build](./concepts/entities-identity-ownership.md#stable-identity-in-a-packaged-build) |

A fourth hazard is loud, not silent: Shipping sets `WITH_DEV_AUTOMATION_TESTS` to 0, and a target that forces dev tests back on can then fail to compile a test file through a `!UE_BUILD_SHIPPING` region it reaches via a header. [What Shipping strips](./guides/packaging.md#5-what-shipping-strips).

## Settings never to hand-edit

Config Sync in Crowdy Studio writes the Network category of `UCrowdySDKDeveloperSettings` into `Config/DefaultGame.ini` under `[/Script/CrowdyReplication.CrowdySDKDeveloperSettings]`. The fields are read-only in Project Settings on purpose; a hand-pasted value is overwritten by the next sync, and a drifted project fails to connect with no obvious error.

| Never hand-type | Owned by you (fine to edit) | Owning page |
|---|---|---|
| `Environment`, `DiscoveryUrl`, `AppID`, `OrgId`, `GameApiHttpUrl`, `GameApiWsUrl`, `UDPProtocol`, `UDPTimeoutSeconds`, `HostPollIntervalSeconds` | `MapProfiles`, `DefaultProfile`, `BakedRegistry`, `DefaultModelNotificationCarrier`, `PreloadedEntityClasses`, `IDOverrides`, `ClassIDOverrides` | [Config Sync](./studio/config-sync.md#what-config-sync-writes-and-what-you-own), [Project settings](./reference/project-settings.md) |

Do not copy the plugin's `[CoreRedirects]` into the project's `DefaultEngine.ini` either; `Plugins/CrowdySDK/Config/DefaultCrowdySDK.ini` already carries them. [Packaging](./guides/packaging.md#6-coreredirects-ship-with-the-plugin).

## Testing without a second client

Both switches are off by default. Turn them back off before testing real two-client routing. [Testing locally](./guides/testing-locally.md).

| Console variable | What it does | Owning section |
|---|---|---|
| `crowdy.rpc.loopback 1` | A sent `CrowdyEvent` is also delivered to your own receive path, once; a call made from inside the replayed body does not loop again | [Single-client RPC loopback](./guides/testing-locally.md#single-client-rpc-loopback) |
| `crowdy.state.loopback 1` | A state delta for an owned entity is decoded onto a lazily spawned local mirror (`RemoteProxy` role, its own NetID), so `OnRep` fires with one client. The mirror's trace line always says `(targeted)`; that label is cosmetic | [Single-client Crowdy State loopback](./guides/testing-locally.md#single-client-crowdy-state-loopback) |

## Trace console variables

Every area exposes `crowdy.<area>.trace`, off by default; warnings and errors print regardless. The four to reach for first, and the two to leave alone:

| Console variable | Shows | Owning page |
|---|---|---|
| `crowdy.rpc.trace` | Every `CrowdyEvent` send and receive: function, entity, addressing, owned or delegated | [Testing locally](./guides/testing-locally.md#trace-console-variables) |
| `crowdy.state.trace` | Owned-entity diffing, delta emission, datagram sizes | [Testing locally](./guides/testing-locally.md#trace-console-variables) |
| `crowdy.entity.trace` | Registry add and remove, event routing and dispatch, actor tracking | [Testing locally](./guides/testing-locally.md#trace-console-variables) |
| `crowdy.net.trace` | UDP transport: socket open and close, sends and receives, pool churn | [Testing locally](./guides/testing-locally.md#trace-console-variables) |
| `crowdy.serialize.scopes`, `crowdy.state.scopes` | CPU trace scopes around every message decode, a real per-message cost; leave off unless reading that timing | [Console variables](./reference/console-cvars.md#trace-gates) |

The full table, including behavior switches and diagnostic commands, is on [Console variables](./reference/console-cvars.md); which log category pairs with which trace is on [Log categories](./reference/log-categories.md).

## Locked rules in one place

| Rule | Owning page |
|---|---|
| Every id is `int64`; the app id travels as a JSON string and the SDK encodes it, never you | [Ids are 64-bit](./game-models/overview.md#ids-are-64-bit-and-the-sdk-does-the-json) |
| The host is a convention, not enforcement; never gate cheat-sensitive state on it | [Host is a convention](./concepts/host-is-a-convention.md), [Host authority](./runtime/host-authority.md) |
| An empty invoke policy is sent as an explicit null that clears the server's gate; deleting `require` lines on a player-callable function does not clear it, the inferred gate applies | [An empty policy clears the server's policy](./game-models/invoke-policies.md#an-empty-policy-clears-the-servers-policy) |
| Presence is the player's actor: a participant with no fresh actor for 60 seconds is marked left; an empty session ends after five minutes | [Sessions and presence](./concepts/sessions-and-presence.md#presence-is-the-players-actor) |
| A world subsystem null-checks `GetGameInstance()` in `Initialize()`; it is null in the transient world at engine start | [Host authority](./runtime/host-authority.md#the-host-subsystem), [Replicated subsystems](./runtime/replicated-subsystems.md) |
| An array parameter on a delegate handler is `const TArray<T>&`; a by-value parameter does not match and `AddDynamic` will not compile | [Collections](./game-models/collections.md#collections) |
| A `Multicast` call has a 1024-byte payload budget and is dropped loudly, never truncated; large payloads go on `SpatialMulticast` | [RPC events](./runtime/rpc-events-cpp.md#containers-and-their-bounds) |

## Related

- [Quickstart](./quickstart.md): the lantern every example above comes from.
- [Best Practices](./guides/best-practices.md): the four rules stated in the abstract.
- [Packaging](./guides/packaging.md): the checklist before a cooked build.
