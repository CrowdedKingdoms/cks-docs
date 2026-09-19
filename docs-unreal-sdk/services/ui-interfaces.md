---
slug: ui-interfaces
sidebar_position: 6
title: UI Interfaces
description: "Optional hooks for plugging your own HUD, player, and minigame classes into the SDK, the Blueprint reception layer that forwards events and actor updates to delegates, and the entity and session utility library."
---

# UI Interfaces

A small set of Blueprint interfaces a game can implement to let the SDK drive its HUD, player, and
minigame classes, plus two things that are not UI at all but live in the same module: the Blueprint
reception layer, which forwards incoming events and actor updates to delegates without a line of C++,
and `UCrowdyUtilities`, an entity and session helper library. All of it lives in `CrowdyServices`.

## When you touch this

When you want the SDK to open and close your widgets instead of doing it by hand, when a Blueprint-only
project needs to receive game events or actor updates without binding a delegate in C++, or when gameplay
code needs an entity's id, owner, or host state and you would rather call a library function than reach
into the entity component yourself.

Nothing else in the SDK requires any of this. CrowdyState, RPC, and Game Models work with none of
`ICrowdyHUD`, `ICrowdyUIRootWidget`, `ICrowdyPlayer`, `ICrowdyMinigame`, or `ACrowdyHUDBase` implemented.

## HUD hooks

`ICrowdyUIRootWidget` is the contract for a widget that owns the four UI layers and stacks widgets on
them. `ICrowdyHUD` is the contract for a HUD actor that routes commands to that root widget. Each `I`
interface is the Blueprint-facing half of a `UINTERFACE` pair; the generated class you never call
directly is `UCrowdyUIRootWidget` for the first and `UCrowdyHUD` for the second.
`ACrowdyHUDBase` (`Blueprintable`, `Abstract`, derives `AHUD`) implements `ICrowdyHUD` for you and adds
two editable properties, `HUDWidgetClass` and `WidgetSetConfig`. `UW_CrowdyHUD` is the SDK's own
`UUserWidget` implementation of `ICrowdyUIRootWidget`. `HUDWidgetClass` defaults to none: make a Widget
Blueprint parented to `UW_CrowdyHUD` with four Overlay widgets named `GameLayer`, `GameMenuLayer`,
`MenuLayer` and `ModalLayer`, and assign it as **HUD Widget Class** on your HUD Blueprint's class
defaults; until then BeginPlay logs a warning and starts no widget system.

| Interface | Function | Does | Parameters that matter |
|---|---|---|---|
| `ICrowdyUIRootWidget` | `PushToLayer` | Creates and pushes a widget onto one of the four layers | `Layer` (`ECrowdyUILayer`), `bClearLayerFirst`, `WidgetClass` |
| `ICrowdyUIRootWidget` | `PopFromLayer` | Pops the top widget off a layer | `Layer`, `bRemoveFromParent` |
| `ICrowdyUIRootWidget` | `GetLayer` | Returns the `UOverlay` backing a layer | `Layer` |
| `ICrowdyHUD` | `ExecuteUICommand` (**Execute Crowdy UI Command**) | Routes an `FGameplayTag` command to the HUD | `Command`, `bHideOtherWidgetsInLayer`, `bChangeInputMode` |
| `ICrowdyHUD` | `GetWidgetReference` | Returns an already-created widget of the given class, or null | `WidgetClass` |
| `ICrowdyHUD` | `ToggleLayerVisibility` | Shows or hides a whole layer | `Layer`, `bVisible` |
| `ACrowdyHUDBase` | `InitializeCrowdyWidgets` | `BlueprintNativeEvent` called once from BeginPlay; the default creates every widget in `WidgetSetConfig`. Override to add to that and call the parent | none |

`UCrowdySDKSubsystem::OnCrowdyHUDReady` (**Crowdy HUD Ready**, `FOnCrowdyHUDReady`, no parameters) fires
once `ACrowdyHUDBase` has created every widget in `WidgetSetConfig`; bind it on the Crowdy SDK Subsystem
when something must wait for the HUD to exist.

`ECrowdyUILayer` (`GameLayer`, `GameMenuLayer`, `MenuLayer`, `ModalLayer`) names the four layers.
`ECrowdyInputMode` (`Game`, `GameAndUI`, `UI`) is the input mode a widget switches to. A widget set is a
`UCrowdyWidgetSet` data asset, one `FWidgetSpec` per tag in its `WidgetSpecMap`, each spec carrying a
`WidgetClass`, `Layer`, `bClearLayerFirst`, `bStartVisible`, and the entering and exiting input modes.
`ACrowdyHUDBase::WidgetSetConfig` points at one; its private `ToggleWidget` and `GetWidget` do the actual
show and lookup work behind `ExecuteUICommand` and `GetWidgetReference`.

Set both `HUDWidgetClass` and `WidgetSetConfig` on the HUD Blueprint's class defaults; they are saved with
it.

This section has no example: the tables above are the reference.

## Player and minigame hooks

`ICrowdyPlayer::GetPlayerName` and `ICrowdyPlayer::InteractMessage` (an interact prompt with a `Message`
and a `Duration`) are the player-facing hooks, generated alongside `UCrowdyPlayer`.
`ICrowdyMinigame::GetMinigameName` and `ICrowdyMinigame::JoinMinigame` are their minigame equivalents,
generated alongside `UCrowdyMinigame`.

:::warning[GetPlayerName and GetMinigameName are placeholders today.]
Both are hooks the SDK never calls and never implements; whatever you return is yours, and nothing in the
SDK reads it. Do not build a feature that expects the SDK to fill either one.
:::

## The Blueprint reception layer

`UCrowdyBlueprintReceptionLayer` lets a Blueprint receive game events and actor updates without binding a
delegate in C++. `CreateAndRegisterLayer(WorldContextObject, Class)` spawns one and registers it. Once
registered, it broadcasts `OnEventNotificationReceived` (an `FGameEventNotificationBP`) for a matching
game event and `OnActorUpdateReceived` (an `FActorUpdateNotificationBP`) for a matching actor update.

Three `EditDefaultsOnly` arrays say what a layer subscribes to: `SupportedResponseTypes`
(`ECrowdyMessageType`), `SupportedActorUpdateTypes` (`FName`), and `SupportedEvents` (the struct types to
receive).

:::warning[An empty SupportedEvents array is a catch-all when the event opcode is listed.]
With `SupportedEvents` empty and `Client Event Notification` or `Server Event Notification` in
`SupportedResponseTypes`, the layer receives every event no other layer claimed. With all three arrays
empty it receives nothing. The same rule pairs `SupportedActorUpdateTypes` with `Actor Update
Notification`: empty plus the opcode is every actor update, empty alone is none.
:::

`DispatchToBlueprint` and the `RegisterLayer` internals are C++-only and not exposed to Blueprint;
`RegisterLayer` is safe to call more than once and builds one subscription per declared type, or the
unclaimed fallback when nothing is declared and the matching opcode is listed.

## The utilities library

`UCrowdyUtilities` is a static Blueprint function library for entities, sessions, and events. It is not
UI-specific, but it lives in the same module.

| Function | Does |
|---|---|
| `SpawnCrowdyEntity`, `DestroyCrowdyEntity` | Spawns or destroys an entity actor |
| `GetCrowdyEntityID`, `GetCrowdyEntity` | Converts between an entity actor and its id |
| `GetLocalPlayerEntityID` | The local player's entity id |
| `GetCrowdyEntityOwnerID`, `GetAllCrowdyEntitiesByOwner` | An entity's owner, or every entity a given owner has |
| `CrowdyIsEntityRegistered` | Whether an id is a known entity |
| `GetCrowdyEntityRole` | An entity's `ECrowdyRole` |
| `DoesCrowdyEntityOwn` | Whether one actor owns another, by Crowdy identity |
| `GetCrowdyEntityComponent` | An actor's entity component, falling back to `FindComponentByClass` when the actor does not implement `ICrowdyEntityComponentProvider` |
| `IsCrowdyEntityLocallyControlled`, `IsCrowdyEntityPlayerControlled` (and its exec-flow twin `SwitchIsCrowdyEntityPlayerControlled`) | Local or player control checks |
| `CrowdyIsRemoteProxy` (and its exec-flow twin `SwitchCrowdyIsRemoteProxy`) | Whether this is a remote proxy of the entity |
| `K2_SendCrowdyEvent` (display name **Send Crowdy Event**; C++-only template `SendCrowdyEvent<T>` for the same call without the Blueprint thunk) | Sends a game event struct with `Recipient`, `DecayRate`, and `ReplicationDistance` |
| `CrowdyHasAuthority` (exec-flow, **Switch Crowdy Has Authority**) / `GetCrowdyHasAuthority` (pure, **Crowdy Has Authority**) | True when this client is the host |
| `CrowdyIsConnectedToServer` | Whether the realtime connection is up |
| `CrowdyGetHostID` | The current host's id |
| `IsCrowdyEntityHost` | Whether this actor is the host player's own entity (its id equals the host id). For "owned by the host" compare `GetCrowdyEntityOwnerID` with `CrowdyGetHostID` |

:::warning[DoesCrowdyEntityOwn compares Crowdy ownership, not AActor::GetOwner.]
The name invites Unreal's actor-owner meaning, but this checks Crowdy entity ownership instead; it will
not agree with `AActor::GetOwner()` for an entity whose Unreal owner was never set to match.
:::

`IsCrowdyEntityHost` and `IsCrowdyEntityLocallyControlled` both fold in host election state. See
[Host election](./host-election.md) and [Host authority](../runtime/host-authority.md) for what "host"
means before relying on either.

## Gotchas

- Every hook on this page is optional. Nothing else in the SDK requires an implementation of any of them.
- `GetPlayerName` and `GetMinigameName` are placeholders the SDK never calls; nothing reads what you return.
- `HUDWidgetClass` defaults to none. Without a `UW_CrowdyHUD` Widget Blueprint assigned, the HUD base starts
  no widget system and `OnCrowdyHUDReady` never fires.
- The reception layer's `SupportedEvents` is a claim list, not a filter: empty plus the event opcode in
  `SupportedResponseTypes` widens the layer to every unclaimed event; empty alone receives nothing.
- The reception layer forwards transport-level notifications to Blueprint. It is not the Game Model
  change-ping and pull mechanism on [Change pings and pull](../game-models/change-pings-and-pull.md);
  the two do not replace each other.
- Everything on this page logs under `LogCrowdyServices`, gated by two trace CVars:
  `crowdy.services.trace` (`CrowdyServicesTrace::Services`) for the utilities library and reception
  layer, and `crowdy.hud.trace` (`CrowdyServicesTrace::Hud`) for HUD-side calls.

## Related

- [Host election](./host-election.md) and [Host authority](../runtime/host-authority.md): what
  `IsCrowdyEntityHost` and `IsCrowdyEntityLocallyControlled` fold in.
- [Channels](../runtime/channels.md): the message plane the reception layer's subscriptions ride.
- [Change pings and pull](../game-models/change-pings-and-pull.md): the Game Model notification and pull
  path, a different mechanism from the reception layer above.
