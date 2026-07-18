---
slug: rendering-backends
sidebar_position: 3
title: Rendering Backends
---

# Rendering Backends

A rendering backend decides how a replicated entity appears on remote clients.

When the owner of an entity sends state, every other client holds a remote proxy. The backend turns that incoming state into something on screen. It:

- Activates a visual when an entity comes into range.
- Deactivates it when the entity leaves.
- Applies interpolated state each frame.

The backend is pluggable through the `UCrowdyRenderingBackend` interface. The class is abstract, `Blueprintable`, and `EditInlineNew`.

## The default backend

The shipped default is `UCrowdyActorPoolBackend`. It spawns and pools real actors for each entity class.

Most projects never change it. If you do nothing, the map profile resolves to this backend with `UCrowdyActorPoolBackendConfig`.

You only need a custom backend when actor pooling is the wrong model for your project. A Mass Entity based backend is also under works, and will be available in a future release.

:::note
The backend is selected per map through the map profile. See [Map Profiles](/unreal-sdk/runtime/map-profile) for how a profile is resolved for a world.
:::

## Writing a custom backend

Subclass `UCrowdyRenderingBackend` and implement the four required overrides. The two lifecycle overrides are optional.

### Required overrides

These are pure virtual. You must implement all four.

- `ActivateInstance(int32 SlotId, const FGuid& UUID, UClass* EntityClass, const FInstancedStruct& InitialState)`: create or claim a visual for this entity. The actor manager calls this when an entity becomes visible.
- `DeactivateInstance(int32 SlotId, const FGuid& UUID)`: release the visual for this entity. Called when the entity leaves range or is destroyed.
- `ExtractUpdate(const FInstancedStruct& State, int64 ServerTimestampMs, int32 SlotId)`: take an incoming state snapshot and store it against the slot, keyed by the server timestamp, so it can be interpolated.
- `ApplyInterpolation(int32 SlotId, int64 RenderTimeMs)`: drive the visual to the interpolated state for the given render time. Called each frame.

### Optional overrides

- `InitializeBackend(UWorld* World, UCrowdyRenderingBackendConfig* Config)`: one-time setup when the backend starts. Read your config here.
- `DeinitializeBackend()`: tear down anything you allocated in `InitializeBackend`.

### Skeleton

```cpp
UCLASS(EditInlineNew)
class UMyRenderingBackend : public UCrowdyRenderingBackend
{
    GENERATED_BODY()

public:
    virtual void InitializeBackend(UWorld* World, UCrowdyRenderingBackendConfig* Config) override;
    virtual void DeinitializeBackend() override;

    virtual void ActivateInstance(int32 SlotId, const FGuid& UUID, UClass* EntityClass, const FInstancedStruct& InitialState) override;
    virtual void DeactivateInstance(int32 SlotId, const FGuid& UUID) override;
    virtual void ExtractUpdate(const FInstancedStruct& State, int64 ServerTimestampMs, int32 SlotId) override;
    virtual void ApplyInterpolation(int32 SlotId, int64 RenderTimeMs) override;
};
```

## Pairing a config class

A custom backend carries its own settings in a `UCrowdyRenderingBackendConfig` subclass. Define one config class alongside your backend, then read it in `InitializeBackend`.

```cpp
UCLASS(EditInlineNew)
class UMyRenderingBackendConfig : public UCrowdyRenderingBackendConfig
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere)
    int32 MaxVisibleInstances = 256;
};
```

:::tip
The Actor Pool backend follows the same pattern. Its config is `UCrowdyActorPoolBackendConfig`, with fields such as `DefaultPoolSizePerClass` (default 8) and `PerClassPoolOverrides`.
:::

## Selecting the backend in the map profile

The backend is chosen in the map profile, inside `ActorManagement` (a `FCrowdyActorManagementConfigStruct`). Two fields control it:

- `BackendClass`: a `TSubclassOf<UCrowdyRenderingBackend>`. Defaults to `UCrowdyActorPoolBackend`. Set this to your backend class.
- `BackendConfig`: an instanced `UCrowdyRenderingBackendConfig`. Set this to an instance of your config class.


![Map profile actor management with backend class and backend config fields](/img/unreal-sdk/map-profile-backend-select.png)

Assign the profile to your map in Project Settings, Plugins, Crowdy SDK, Map Profiles. See [Map Profiles](/unreal-sdk/runtime/map-profile) for the full setup.

## Do not re-subscribe to the ActorTracker

The actor manager already drives your backend. It calls `ActivateInstance` and `DeactivateInstance` for you as entities come and go.

:::warning
A custom backend must never subscribe to the ActorTracker itself. The actor manager is already the single caller of `ActivateInstance` and `DeactivateInstance`. If your backend also subscribes, every entity is activated twice and you get a double spawn.
:::

Treat the four required overrides as your only entry points for activation and update. Do not reach into the tracker to find entities on your own.
