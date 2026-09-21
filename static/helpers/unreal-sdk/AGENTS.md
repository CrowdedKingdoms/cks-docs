# Crowdy Unreal SDK: agent rules

Drop into a project root, or paste into CLAUDE.md / .cursorrules.

## WHAT THE SDK IS

- A multiplayer plugin for UE5: entities, realtime view state, RPC events, server-owned
  Game Models, sessions, channels and voice, from C++ or Blueprint.
- Two planes. Crowdy State is client-owned, fast, UDP, for what players see.
- Game Models are server-owned truth for anything a cheater would want to lie about.
- Markers in UPROPERTY/UFUNCTION/UCLASS meta declare state, events and models; an entity
  is a UCrowdyEntityComponent.

## LOCKED RULES (never trade these away)

- Two planes, never collapsed. View state (movement, animation, visual flags, one-shot
  effects) goes on the view plane: a CrowdyState property, the continuous channel for
  movement, or a CrowdyEvent for a moment. Truth (HP, inventory, currency, score: anything
  a lying client could profit from) goes in a Game Model attribute; a persisted cosmetic
  goes through the avatars service.
  https://docs.crowdedkingdoms.com/unreal-sdk/concepts/two-planes
- Authoritative or cheat-sensitive state never goes on a CrowdyState property.
  https://docs.crowdedkingdoms.com/unreal-sdk/runtime/crowdy-state
- An authored empty invoke policy is sent as an explicit null that CLEARS the server's gate.
  A function with no policy keeps its inferred gate: "no require lines" means
  owner_of_self or is_participant, never open.
  https://docs.crowdedkingdoms.com/unreal-sdk/game-models/invoke-policies
- Every server id is 64-bit: store it in int64, never int32. appId travels as a JSON
  string; the SDK does the encoding, you never format it.
  https://docs.crowdedkingdoms.com/unreal-sdk/game-models/overview
- The host is a convention, not enforcement. Never gate cheat-sensitive state on "am I
  host". https://docs.crowdedkingdoms.com/unreal-sdk/concepts/host-is-a-convention
- Presence is the player's actor and it expires: the first thing a client needs is its own
  pawn as a Dynamic, PlayerDerived, LocalClient entity spawned after On UDP Connection
  Success (snippet qs-player; its id lands on possession: read it in
  OnCrowdyOwnershipAssigned, not BeginPlay). No fresh actor for 60 seconds marks the
  participant left; an empty session times out after 5 minutes.
  https://docs.crowdedkingdoms.com/unreal-sdk/concepts/sessions-and-presence
- Never hand-type the app id, org id, environment or API URLs into Project Settings or
  DefaultGame.ini. Config Sync writes them and silently overwrites what you typed.
  https://docs.crowdedkingdoms.com/unreal-sdk/studio/config-sync
- A world subsystem null-checks GetGameInstance() in Initialize(): it is null in the
  transient world at engine start.
  https://docs.crowdedkingdoms.com/unreal-sdk/runtime/replicated-subsystems
- Never call HasMetaData at runtime. Cooked builds strip metadata and the check answers
  false with no error. https://docs.crowdedkingdoms.com/unreal-sdk/guides/packaging
- A handler bound to an array delegate takes const TArray<T>&. A by-value parameter does
  not match and AddDynamic fails to compile.
  https://docs.crowdedkingdoms.com/unreal-sdk/game-models/collections

## MARKER PATTERNS (snippet excerpts; copy, never retype)

A UCrowdyEntityComponent makes the actor an entity; the constructor creates it with
CreateDefaultSubobject and sets Ownership (snippet qs-entity):

```cpp
	// Makes the actor an entity: every client in the session sees it, one of them owns it.
	UPROPERTY(VisibleAnywhere, Category = "Crowdy")
	TObjectPtr<UCrowdyEntityComponent> CrowdyEntity;
```

CrowdyState on a property (snippet qs-state). On a client-owned entity (Ownership =
LocalClient) the owner assigns and calls OnRep_Lit() itself; the SDK ships it. A
host-owned entity (Ownership = Host, the placed-actor default: Static, Stable) never
ships a plain write: mark it CrowdyManualDirty and call MarkStateDirty after each
write, or use CrowdyHeartbeat.
https://docs.crowdedkingdoms.com/unreal-sdk/runtime/crowdy-state#on-an-entity-you-do-not-own-the-host-push

```cpp
// View state: a wrong value is a visual glitch, not a cheat, so it belongs on the Crowdy State plane.
UPROPERTY(meta = (CrowdyState, CrowdyOnRep = "OnRep_Lit"))
bool bLit = true;

UFUNCTION()
void OnRep_Lit();
```

CrowdyEvent plus CrowdyRecipient on a function; call Flicker(), implement
Flicker_Implementation() (snippet qs-event). Recipients: Multicast, SpatialMulticast,
OwningClient, Host. https://docs.crowdedkingdoms.com/unreal-sdk/runtime/rpc-events-cpp

```cpp
#include "Replication/RPC/CrowdyEvent.h"

// The receiver runs on every client in range, the caller included; Flicker() is the call that sends it.
UFUNCTION(meta = (CrowdyEvent, CrowdyRecipient = "SpatialMulticast"))
void Flicker_Implementation();
CROWDY_EVENT(Flicker)
```

CrowdyContainer on a class, CrowdyModel + CrowdyKey + CrowdyOnRep on its attributes
(snippet gm-container). The OnRep is a parameterless UFUNCTION.
https://docs.crowdedkingdoms.com/unreal-sdk/game-models/containers-and-attributes

```cpp
// A Game Model container: the server owns every CrowdyModel attribute on it, and it binds to the entity it is attached to.
UCLASS(ClassGroup = (Crowdy), meta = (BlueprintSpawnableComponent, CrowdyContainer = "LanternFuel"))
class ULanternFuel : public UActorComponent
{
	GENERATED_BODY()

public:
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Game Model", meta = (CrowdyModel, CrowdyKey = "fuel", CrowdyOnRep = "OnRep_Fuel", ClampMin = "0", ClampMax = "100"))
	float Fuel = 100.f;
```

CrowdyEffect is an asset authored in Effect Script; C++ only holds a reference and
applies it (snippet fx-declare).
https://docs.crowdedkingdoms.com/unreal-sdk/game-models/effects-cpp

```cpp
#include "Replication/GameModel/CrowdyEffects.h"

// The authored effect this lantern applies; pick the asset in the Details panel, the server owns what it does.
UPROPERTY(EditAnywhere, Category = "Crowdy")
TObjectPtr<UCrowdyEffect> RefuelEffect;
```

## DO NOT

- Do not put HP, inventory, currency or score on a CrowdyState property.
- Do not write a Game Model attribute from the client; mutate through an effect or a
  server function and let CrowdyOnRep deliver the result.
- Do not read HasMetaData, or any marker, at runtime; the baked registry is the source.
- Do not test a new marker in a package cooked before it existed: the registry is baked
  at cook, so cook again. Tools > Rebuild Crowdy Registry only refreshes the editor view.
- Do not read placement data at BeginPlay; a cooked build releases the placement guid
  before then. Read it at OnRegister.
  https://docs.crowdedkingdoms.com/unreal-sdk/concepts/entities-identity-ownership
- Do not edit the Network settings (Environment, DiscoveryUrl, AppID, OrgId,
  GameApiHttpUrl, GameApiWsUrl, UDPProtocol, UDPTimeoutSeconds, HostPollIntervalSeconds).
  https://docs.crowdedkingdoms.com/unreal-sdk/reference/project-settings
- Do not copy the plugin's CoreRedirects into the project's DefaultEngine.ini.
- Do not leave crowdy.serialize.trace or any .scopes CVar on; they cost CPU per message.

## TEST WITHOUT A SECOND CLIENT

https://docs.crowdedkingdoms.com/unreal-sdk/guides/testing-locally

- `crowdy.rpc.loopback 1`: a sent CrowdyEvent is also delivered to your own receiver,
  once. Set it back to 0 before testing two-client routing.
- `crowdy.state.loopback 1`: decodes your own deltas onto a local mirror entity so OnRep
  fires in one PIE client. Off by default.
- Trace gates, off by default, warnings always print: `crowdy.rpc.trace`,
  `crowdy.state.trace`, `crowdy.entity.trace`, `crowdy.net.trace`. Full table:
  https://docs.crowdedkingdoms.com/unreal-sdk/reference/console-cvars
- Build the editor target with Engine/Build/BatchFiles/Build.bat and read the log to
  `Link ...dll` and `Result: Succeeded`.

## FULL DOCS

- Quickstart: https://docs.crowdedkingdoms.com/unreal-sdk/quickstart
- Agent page: https://docs.crowdedkingdoms.com/unreal-sdk/for-ai-agents
- Every page as text: https://docs.crowdedkingdoms.com/helpers/unreal-sdk/llms-full.txt
- Surface manifest: https://docs.crowdedkingdoms.com/helpers/unreal-sdk/sdk-surface.json
