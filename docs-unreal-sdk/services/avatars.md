---
slug: avatars
sidebar_position: 3
title: Avatars
description: "A player's stored profile: the record fields, who may write them, per-app state keyed by AppId, the cache-only reads versus the network refresh, and the struct serialization helpers, in C++ and Blueprint."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Avatars

An avatar is a player-owned profile: an identity a player picks from and carries across sessions, holding small state other players can read and only the owner can write. It is not a live world actor and it is not a Game Model; it is a stored profile the rest of the SDK reads to seed one, distinct from [authoritative gameplay truth](../game-models/overview.md).

## When you touch this

When you build a profile or loadout screen, when a player changes a cosmetic or setting that should survive between sessions, or when you seed an entity's spawn state from a stored value the player already owns.

## The record

`UCrowdyAvatars` (Game Instance subsystem, category **Crowdy SDK > Avatars**) owns every avatar call. An avatar record, `FCrowdyAvatar`, holds:

| Field | Holds |
|---|---|
| `AvatarId` | The avatar's `int64` id. |
| `UserId` | The owning player's `int64` id. |
| `Name` | Display name. |
| `PublicState` | Base64 blob, readable by every player. |
| `PrivateState` | Base64 blob, readable by the owner only; stripped server-side on a non-owner read. |
| `CreatedAt` | Creation timestamp. |

Per-app data is a separate record, `FCrowdyAppAvatarState`, keyed by `AppId` and `AvatarId`: `RawState` (base64, empty string means not set), `CreatedAt`, `UpdatedAt`. This is the slot for cosmetics, settings, or any small struct your game defines; the avatar record's own fields do not hold arbitrary game data.

:::warning[Only the owner may write an avatar, and the SDK does not check locally.]
Every write, `UpdateAvatar`, `UpdateAvatarState`, `UpdatePublicAvatarState`, `UpdatePrivateAvatarState`, `UpdateAvatarAppState`, `DeleteAvatar`, is owner-only, enforced by the Game API against the caller's app-scoped token. `UCrowdyAvatars` performs no local ownership check: a write for an avatar the signed-in player does not own is sent over the wire and refused server-side, surfaced through `OnError` and usually classified `Forbidden`.
:::

## Reading avatars: cache versus network

`GetCachedMyAvatars`, `HasCachedAvatars`, and `GetMyAvatarById` are synchronous, cache-only, and never populate themselves. Only `GetMyAvatars` (a network refresh) repopulates the cache and fires `OnMyAvatarsCacheChanged` (`FOnMyAvatarsCacheChanged`, one param, the refreshed array) so anything watching the cache updates without polling. A create, rename, delete or state write does not touch the cache, so call `GetMyAvatars` again after a write you want the cache to reflect.

`GetAvatar` reads any avatar by id, including one you do not own; `GetUserAvatars` lists another user's avatars. Neither is limited to the signed-in player.

## Reading and writing per-app state

`GetAvatarAppState` and `GetAvatarAppStates` (batch) read the calling app's slot for one or many avatars. `UpdateAvatarAppState` replaces it.

:::warning[AppId always comes from project settings; there is no per-call override.]
`GetAvatarAppState`, `GetAvatarAppStates`, and `UpdateAvatarAppState` resolve `AppId` from project settings, not a parameter. This subsystem cannot target a different app's slot.
:::

`UpdatePublicAvatarState` and `UpdatePrivateAvatarState` each leave the other field untouched on the server; `UpdateAvatarState` replaces both public and private state atomically.

:::caution[The combined write still round-trips an unchanged field.]
Calling `UpdateAvatarState` with a field's old value does not clear it, it just resends it. Prefer the separate `UpdatePublicAvatarState` / `UpdatePrivateAvatarState` calls when only one field changes.
:::

## Serializing struct state

State fields are base64 strings on the wire. `SerializeToAvatarState` and `DeserializeFromAvatarState` convert any `USTRUCT` to and from that string; `GetAvatarAppStateAs` and `SetAvatarAppStateAs` are latent wrappers that fetch-and-deserialize or serialize-and-write in one call.

:::warning[The State pin is a wildcard: one struct, string or scalar, never an array.]
`SerializeToAvatarState`, `DeserializeFromAvatarState`, `GetAvatarAppStateAs`, and `SetAvatarAppStateAs` are `CustomThunk` with a `CustomStructureParam`. The `int32&` in the C++ signature is a wildcard pin in Blueprint: connect a struct pin (or a single string, bool, integer or float) and the pin takes that type. An array, set or map pin is refused.
:::

The lantern serializes its torch color as a small cosmetic struct, writes it to the app-state slot, and re-applies it on spawn. The example assumes the player already has an avatar (created with `CreateAvatar`, or **Create Avatar** in Blueprint); with none, `AvatarId` stays 0 and every call below returns early.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`SetTorchColor` writes the picked `FLinearColor` directly with `FMemoryWriter`, byte-identical to what `SerializeToAvatarState` would produce for a linear color; C++ cannot call that helper itself, since its struct pin is a `CustomThunk` wildcard. `UpdateAvatarAppState` sends the encoded bytes, and `Torch` only recolours once the write's `OnSuccess` handler, `ApplyTorchColor`, confirms it.

<CppSnippet id="avatar-set" />

`LoadTorchColor` calls `GetAvatarAppState`; the handler `ApplyTorchColor`, shared with the write above, base64-decodes, guards on 16 bytes, and reads the color with `FMemoryReader` straight into `Torch`. The latent `GetAvatarAppStateAs` is not used here for the same wildcard-thunk reason as above.

<CppSnippet id="avatar-get" />

`WatchAvatars`, bound at `BeginPlay`, picks up `AvatarId` from the first entry of a cache refresh and calls `LoadTorchColor`, so a cache change elsewhere still lands the stored color. The handler takes `const TArray<FCrowdyAvatar>&`; on the tagged v2.14.0 plugin `FOnMyAvatarsCacheChanged` still passes the array by value and the handler must too, or `AddDynamic` fails to bind (see [What's Changed](../guides/whats-changed.md#unreleased-after-v2140)).

<CppSnippet id="avatar-events" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Variables the Blueprint needs: `Torch` (a `UPointLightComponent` reference) and `AvatarId` (`int64`). Set `AvatarId` from a **Get My Avatars** result (the first entry's `AvatarId`) or from the cache-changed event described below; the two graphs read it and do nothing while it is 0.

Saving the color: `OnTorchColorPicked` (custom event, `NewColor`) runs **Serialize Struct to Avatar State** on `NewColor`, reads `AvatarId`, and passes the result to the **Update Avatar App State** async node; its `OnSuccess` pin calls **Set Light Color** on `Torch` with `NewColor`.

<Blueprint src="avatar-set" title="OnTorchColorPicked, Serialize Struct to Avatar State, Get AvatarId, Update Avatar App State, Get Torch, Set Light Color" />

Loading it on spawn: `Event BeginPlay` gets the **Crowdy Avatars** subsystem, reads `AvatarId`, and calls the latent **Get Avatar App State As**, whose wildcard output feeds `NewLightColor`; a **Branch** on its `bSuccess` output calls **Set Light Color** on `Torch`.

<Blueprint src="avatar-get" title="Event BeginPlay, Crowdy Avatars, Get AvatarId, Get Avatar App State As, Branch, Get Torch, Set Light Color" />

Following cache changes: no figure is shown for this step. Add a custom event with one input, `Avatars` (array of `Crowdy Avatar`), bind it with **Bind Event to On My Avatars Cache Changed** at Begin Play, set `AvatarId` from the first entry in its body, then run the loading path above; the C++ tab's `WatchAvatars` is the same step.

</TabItem>
</Tabs>

## Async action nodes

Every network call above also exists as a Blueprint async action node with the same name and, as its underlying class, the subsystem name plus the call (**Get My Avatars** `UCrowdyAvatars_GetMyAvatars`, **Get Avatar** `UCrowdyAvatars_GetAvatar`, **Get User Avatars** `UCrowdyAvatars_GetUserAvatars`, **Get Avatar App State** `UCrowdyAvatars_GetAvatarAppState`, **Get Avatar App States** `UCrowdyAvatars_GetAvatarAppStates`, **Create Avatar** `UCrowdyAvatars_CreateAvatar`, **Update Avatar** `UCrowdyAvatars_UpdateAvatar`, **Delete Avatar** `UCrowdyAvatars_DeleteAvatar`, **Update Public Avatar State** `UCrowdyAvatars_UpdatePublicAvatarState`, **Update Private Avatar State** `UCrowdyAvatars_UpdatePrivateAvatarState`, **Update Avatar App State** `UCrowdyAvatars_UpdateAvatarAppState`), each with its own `On Success` and `On Error` exec pins instead of a bound delegate. Their pins are the multicast `FAvatarAsyncOnSuccess`, `FAvatarsAsyncOnSuccess`, `FAppStateAsyncOnSuccess`, `FAppStatesAsyncOnSuccess`, `FAvatarVoidAsyncOnSuccess` and `FAvatarsAsyncOnError`; the subsystem's per-call `FOnAvatarSuccess`, `FOnAvatarsSuccess`, `FOnAppStateSuccess`, `FOnAppStatesSuccess`, `FOnAvatarVoidSuccess` and `FOnAvatarError` are a separate family the async nodes never expose. `TArray` results arrive wrapped, `FCrowdyAvatarList` for a list of avatars and `FCrowdyAppAvatarStateList` for a list of app states, so the result is one struct pin. `UpdateAvatarState` (the combined public-and-private write), `GetMyAvatarById`, `HasCachedAvatars`, `GetCachedMyAvatars`, `SerializeToAvatarState`, `DeserializeFromAvatarState`, `GetAvatarAppStateAs`, and `SetAvatarAppStateAs` have no async action node; a Blueprint reaches those only through the subsystem functions shown above.

## Creating and removing avatars

`CreateAvatar(Name, OnSuccess, OnError)` makes a new avatar for the signed-in player; `UpdateAvatar(AvatarId, Name, ...)` renames one; `DeleteAvatar(AvatarId, OnVoidSuccess, OnError)` removes one. All three are owner-only, enforced the same way as the state writes above.

## Error codes

`FCrowdyAvatarError` carries a `Code` (`ECrowdyAvatarErrorCode`: `Unknown`, `NotFound`, `Forbidden`, `NetworkError`, `ServerError`) and a `Message`. Bind `FOnAvatarError` to a `UFUNCTION` with the signature `(FCrowdyAvatarError Error, FString Message)`; `Message` repeats `Error.Message`. The async nodes' `FAvatarsAsyncOnError` has the same two parameters.

:::caution[The error code is a client-side guess, not a server code.]
`ECrowdyAvatarErrorCode` is classified from the error message text by substring match, not a code the server sends. Branch on it for a coarse UI response; do not treat it as a stable server contract.
:::

Cosmetic selections and progression flags belong here; currency balances and match results do not. Avatar state, public, private, or app, is profile data, not server-authoritative gameplay truth, which belongs in [Game Models](../game-models/overview.md).

## Gotchas

- `GetCachedMyAvatars`, `HasCachedAvatars`, and `GetMyAvatarById` never populate themselves; only `GetMyAvatars` does. A create, rename, delete or state write leaves the cache as it was.
- Every write is owner-only and enforced server-side; a non-owner's write is sent, not blocked locally.
- `AppId` for the per-app state calls always comes from project settings; there is no per-call override.
- The serialization helpers take a wildcard pin: one struct, string or scalar. An array, set or map pin is refused.
- `ECrowdyAvatarErrorCode` is a client-side text classification, not a server-issued code.

## Related

- [Teams](./teams.md): a sibling service on the same subsystem pattern.
- [Containers and attributes](../game-models/containers-and-attributes.md): the Game Model contrast, avatar state is not a container.
- [Entities and spawning](../runtime/entities-and-spawning.md): seeding an entity's spawn state from an avatar's public part.
