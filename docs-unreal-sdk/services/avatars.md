---
slug: avatars
sidebar_position: 3
title: Avatars
---

# Avatars

An avatar is a player profile scoped to your app. It is stored data that travels with the player and survives between sessions: a display name, a chosen loadout, cosmetic selections, progression flags, or any small struct your game defines.

Each avatar carries three kinds of state:

- A public part that other players can read.
- A private part that only the owning player can read.
- An app-state blob for your game's own data.

Avatars live on `UCrowdyAvatars`, a game instance subsystem in the CrowdyServices module.

:::note
Avatars are not the same as entities. An entity is a live, replicated actor in the world. An avatar is a stored profile. You read an avatar to populate UI or to seed an entity's initial state, and you write to it when the player changes something that should persist.
:::

## Get the subsystem

`UCrowdyAvatars` is a game instance subsystem, so you fetch it from the game instance.

```cpp
UCrowdyAvatars* Avatars = GetGameInstance()->GetSubsystem<UCrowdyAvatars>();
```

Hold the pointer for the lifetime of the object that uses it. The subsystem lives as long as the game instance does.

## Read your avatars

The subsystem keeps a local cache of the signed-in player's avatars. Read the cache for instant UI, and treat the network as eventual truth.

- `GetCachedMyAvatars` returns what the subsystem currently knows. It is synchronous and safe to call every frame for UI.
- `OnMyAvatarsCacheChanged` is a multicast delegate that fires whenever the cache updates. Bind a UFUNCTION to it and refresh your UI from the cache when it fires.
- `GetMyAvatars` asks the server for the current set and refreshes the cache. Call it on login, or when you want to force a resync.

A typical pattern is to bind to the change delegate first, then kick off `GetMyAvatars`, then build your UI off whatever the cache holds.

```cpp
void UMyProfileWidget::Activate()
{
    UCrowdyAvatars* Avatars = GetGameInstance()->GetSubsystem<UCrowdyAvatars>();
    Avatars->OnMyAvatarsCacheChanged.AddDynamic(this, &UMyProfileWidget::HandleAvatarsChanged);

    // Seed the UI from whatever is already cached.
    HandleAvatarsChanged();

    // Then ask the server to refresh.
    Avatars->GetMyAvatars(/* per-call delegates */);
}

void UMyProfileWidget::HandleAvatarsChanged()
{
    UCrowdyAvatars* Avatars = GetGameInstance()->GetSubsystem<UCrowdyAvatars>();
    const TArray<FCrowdyAvatar> Mine = Avatars->GetCachedMyAvatars();
    RebuildListFrom(Mine);
}
```

:::tip
Read the cache for anything that drives UI this frame. Use the change delegate to know when to redraw. Reserve `GetMyAvatars` for explicit resync points so you are not round-tripping the server on every interaction.
Same blueprint async nodes are a available for the whole operations that are supposed to be performed using Crowdy Avatars.
:::

## Create, update, and delete

The subsystem exposes the lifecycle operations you would expect:

- `CreateAvatar` makes a new avatar for the signed-in player.
- `UpdateAvatar` changes top-level fields on an existing avatar.
- `DeleteAvatar` removes one.

The three state parts each have their own update entry point so you can write just the slice you changed:

- `UpdatePublicAvatarState` writes the public part.
- `UpdatePrivateAvatarState` writes the private part.
- `UpdateAvatarAppState` writes the app-state blob.

These are network operations. Like the other CrowdyServices subsystems, they take per-call dynamic delegates for success and error, which you bind to UFUNCTIONs.

After a successful write the cache updates and `OnMyAvatarsCacheChanged` fires, so your UI can react without you threading the result through by hand.


:::note
Write only the part you changed. If the player edited their public display name, call `UpdatePublicAvatarState` and leave the private and app-state parts alone. Splitting the writes keeps payloads small and avoids overwriting data another part of your game owns.
:::

## Store your own struct in app state

The app-state blob is where your game's data goes. You do not work with raw bytes. The subsystem provides serialization helpers that move a `USTRUCT` in and out of app state, so you define a plain struct and let the helpers handle the conversion.

Define the struct your game wants to persist on the profile:

```cpp
USTRUCT()
struct FMyAvatarProfile
{
    GENERATED_BODY()

    UPROPERTY()
    FString Title;

    UPROPERTY()
    int32 Prestige = 0;

    UPROPERTY()
    TArray<FName> UnlockedCosmetics;
};
```

The save and restore paths mirror each other:

- To save, fill in the struct and hand it to the app-state update path through the serialization helper.
- To restore, read the avatar from the cache and run the inverse helper to get your struct back.

```cpp
void USaveExample::SaveProfile(const FMyAvatarProfile& Profile)
{
    UCrowdyAvatars* Avatars = GetGameInstance()->GetSubsystem<UCrowdyAvatars>();

    // The serialization helper turns your struct into app state,
    // then UpdateAvatarAppState writes it for the chosen avatar.
    Avatars->UpdateAvatarAppState(/* target avatar, serialized Profile, per-call delegates */);
}

void USaveExample::RestoreProfile()
{
    UCrowdyAvatars* Avatars = GetGameInstance()->GetSubsystem<UCrowdyAvatars>();

    const TArray<FCrowdyAvatar> Mine = Avatars->GetCachedMyAvatars();
    if (Mine.Num() == 0)
    {
        return;
    }

    // Read the app state from the cached avatar and run the helper
    // to deserialize it back into your struct.
    FMyAvatarProfile Profile;
    // Profile = <deserialize app state of Mine[0] with the helper>;

    ApplyProfileToGame(Profile);
}
```

The exact helper names and the shape of `FCrowdyAvatar` come from the shipped headers. The pattern is the same in every case: keep a regular `USTRUCT` in your game code, serialize it into app state when you write, and deserialize it back when you read.

:::caution
App state is part of the player's profile, not server-authoritative gameplay truth. Keep cheat-sensitive numbers (currency balances, match results) in Game Models or your persistence layer, not in avatar app state. Use app state for profile data: cosmetics, titles, preferences, and similar.
:::

## How this fits the rest of the SDK

Reach for a different system when the data is not profile data:

- For replicated, live world state, spawn an entity instead. See [Entities and spawning](/unreal-sdk/runtime/entities-and-spawning).
- For per-subject saved gameplay structs over a fast path, use the persistence subsystem. See [Persistence](/unreal-sdk/services/persistence).
- For team membership tied to the player, see [Teams](/unreal-sdk/services/teams).

A common flow is to read the avatar on login, seed an entity's initial spawn state from the public part, and write back to app state when the player changes something that should persist.
