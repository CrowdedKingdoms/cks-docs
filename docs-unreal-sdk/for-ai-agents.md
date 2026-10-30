---
slug: for-ai-agents
sidebar_position: 90
title: For AI Agents
description: "The fastest correct path for a coding agent working in an Unreal project that uses the Crowdy SDK: where each kind of state goes, the marker vocabulary with one example each, what breaks silently in a cooked build, the settings never to hand-edit, how to do from a shell what the editor's Server Compute and Crowdy Studio pages do, and the console variables for testing alone."
---

# For AI Agents

This page is the routing layer for a coding agent working inside a studio's Unreal project. It does not re-explain the SDK; every row links the page that owns the fact, and the text of every page is available as plain-text files, one per section. Read this page, then pull only the pages a task needs.

Machine-readable files sit beside the docs. This page is where they are described. Start at the index, pull one section file, and check the slim symbol index before the full manifest.

| File | Size | Use it when |
|---|---|---|
| [`/helpers/unreal-sdk/llms.txt`](pathname:///helpers/unreal-sdk/llms.txt) | about 42 KB | You are starting a task. Every page with its URL and a one-line description, grouped into sections, each with the URL and size of its section file. |
| `/helpers/unreal-sdk/llms-<section>.txt`: [`start`](pathname:///helpers/unreal-sdk/llms-start.txt), [`concepts`](pathname:///helpers/unreal-sdk/llms-concepts.txt), [`studio`](pathname:///helpers/unreal-sdk/llms-studio.txt), [`runtime`](pathname:///helpers/unreal-sdk/llms-runtime.txt), [`mass`](pathname:///helpers/unreal-sdk/llms-mass.txt), [`exec`](pathname:///helpers/unreal-sdk/llms-exec.txt), [`services`](pathname:///helpers/unreal-sdk/llms-services.txt), [`guides`](pathname:///helpers/unreal-sdk/llms-guides.txt), [`reference`](pathname:///helpers/unreal-sdk/llms-reference.txt) | 20 to 430 KB each | You know which part of the SDK the task touches. Every page of that section as plain text, with C++ snippets inlined and a pointer line for each Blueprint graph. A section over 200 KB is split by subfolder: `exec` and `mass` also have `llms-exec-from-blueprint.txt`, `llms-exec-from-cpp.txt`, `llms-exec-examples.txt` and the same three for `mass`; `llms-exec.txt` then holds only the section's top-level pages. The index lists every file with its size. |
| [`/helpers/unreal-sdk/sdk-surface-index.jsonl`](pathname:///helpers/unreal-sdk/sdk-surface-index.jsonl) | about 340 KB | You need to know whether a symbol exists, which module and header it lives in, or where to look. One line per symbol: name, kind, module, header, and the first sentence of its help text where the manifest has one (console variables only today). Line one names the columns. |
| [`/helpers/unreal-sdk/sdk-surface.json`](pathname:///helpers/unreal-sdk/sdk-surface.json) | about 3 MB | The index is not enough: you need a function's specifiers and return type, a struct's metadata, an enum's values or a delegate's signature. Too large to read whole; query it with `jq` or a script. See [SDK surface manifest](./reference/sdk-surface.md). |
| [`/helpers/unreal-sdk/llms-full.txt`](pathname:///helpers/unreal-sdk/llms-full.txt) | about 1.6 MB | A tool wants every page in one file. About 400,000 tokens, so it does not fit a context window. Prefer the section files. |
| [`/helpers/unreal-sdk/AGENTS.md`](pathname:///helpers/unreal-sdk/AGENTS.md) | under 8 KB | A drop-in for a project root, `CLAUDE.md`, or `.cursorrules`: the locked rules and one example per marker. |

## Where does this state go

Ask one question: can a malicious client benefit from lying about this value? If yes, it belongs on the truth plane, in your app's server code on [ck-exec](/exec/intro), which the SDK reaches from C++ or Blueprint through [Server Logic](./exec/overview.md). If no, it is view state. [The Two Planes](./concepts/two-planes.md#deciding-where-a-field-goes) owns the rule and every row but the door's; that one applies the same test.

| State | Plane | Mechanism | Owning page |
|---|---|---|---|
| Movement | View | Dynamic entity mode, continuous state channel | [Continuous state](./runtime/continuous-state.md) |
| Animation blend state | View | `meta=(CrowdyState)` property, diffed on change | [Crowdy State](./runtime/crowdy-state.md) |
| A one-shot trigger (muzzle flash, impact) | View | `meta=(CrowdyEvent)` RPC, not a state field | [RPC events](./runtime/rpc-events-cpp.md) |
| Hit points, inventory, currency | Truth | Your server code | [The Two Planes](./concepts/two-planes.md#deciding-where-a-field-goes) |
| Match score | Truth | A hub for the match in your server code | [The Two Planes](./concepts/two-planes.md#deciding-where-a-field-goes) |
| A chat line | View | `CrowdyEvent` with the `Multicast` recipient, session channel | [Channels](./runtime/channels.md) |
| A door's open flag | View | `CrowdyState` boolean: a lie is a visual glitch. A placed door is host-owned, so the flag is also `CrowdyManualDirty` and the host calls `MarkStateDirty` after each write. If the door gates progress (a lock), the lock state belongs in your server code | [The Two Planes](./concepts/two-planes.md#deciding-where-a-field-goes), [the host push](./runtime/crowdy-state.md#on-an-entity-you-do-not-own-the-host-push) |
| A player's display name | View | `CrowdyState` property; route it through the avatars service if it must persist | [The Two Planes](./concepts/two-planes.md#deciding-where-a-field-goes), [Avatars](./services/avatars.md) |

:::danger[Authoritative or cheat-sensitive state never belongs in Crowdy State.]
Crowdy State is written by the owning client and believed by everyone else. Low latency is not a reason to move a value to the view plane; predict locally and let the server's confirmed value overwrite the prediction. [The Two Planes](./concepts/two-planes.md#gotchas).
:::

## The marker vocabulary

Two of the three are `meta=(...)` keys; the entity is a component. One canonical example each, all from the same lantern the [Quickstart](./quickstart.md) builds; the snippet id names the file the docs render.

| Marker | Goes on | Canonical example | Owning page |
|---|---|---|---|
| `CrowdyEntity` | A `UCrowdyEntityComponent` on an `AActor` (the component is the marker; set `Ownership`) | `qs-entity` | [Entities, identity, ownership](./concepts/entities-identity-ownership.md) |
| `CrowdyState` (+ `CrowdyOnRep`) | A `UPROPERTY` on an entity actor. On a client-owned entity (`Ownership` = Local Client, the lantern) the owner assigns and calls the notify itself; on a host-owned entity (`Ownership` = Host, the default a placed actor keeps) a plain assignment never ships: add `CrowdyManualDirty` and call `MarkStateDirty` after each write, or add `CrowdyHeartbeat` | `qs-state` | [Crowdy State](./runtime/crowdy-state.md#mark-a-property), [the host push](./runtime/crowdy-state.md#on-an-entity-you-do-not-own-the-host-push) |
| `CrowdyEvent` + `CrowdyRecipient` | A `UFUNCTION` named `X_Implementation`, plus `CROWDY_EVENT(X)`; recipient is one of `SpatialMulticast`, `Multicast`, `OwningClient`, `Host` | `qs-event` | [RPC events](./runtime/rpc-events-cpp.md#routing-keys) |

Four rules the examples assume: the first thing a client needs is its own pawn as a `Dynamic`, `PlayerDerived`, `LocalClient` entity spawned after **On UDP Connection Success** (`qs-player`), because the server knows a client by its actor updates and a `SpatialMulticast` reaches only clients with a fresh actor; that pawn registers inside its first possession, since the engine possesses a runtime spawn after its `BeginPlay`, so read its id and `IsLocallyOwned()` from `OnCrowdyOwnershipAssigned`, not at `BeginPlay`; a `SpatialMulticast` body runs on the caller too, so guard the call with `IsLocallyOwned()` ([RPC events](./runtime/rpc-events-cpp.md#gotchas)); a `CrowdyOnRep` function takes no parameters, read the property for the new value ([Crowdy State](./runtime/crowdy-state.md)); and the lantern's assign-and-stop is the client-owned pattern, because the Quickstart sets its `Ownership` to Local Client: a host-owned entity (`Ownership` = Host, the default a placed actor keeps: Static, Stable, level-placed) never ships a plain `CrowdyState` write, so mark the property `CrowdyManualDirty` and call `MarkStateDirty` after each write, or give it `CrowdyHeartbeat` ([the host push](./runtime/crowdy-state.md#on-an-entity-you-do-not-own-the-host-push)).

## Three things that break silently in a cooked build

Editor and Play in Editor hide all three. Only a packaged build shows them.

| Break | Why it is silent | Fix | Owning page |
|---|---|---|---|
| Reading `HasMetaData` at runtime | Cooked and Shipping builds strip UObject metadata; the check answers `false` and marker-driven code goes dark with no error | Read `UCrowdyBakedRegistry`; the SDK already does this for RPC and Crowdy State metadata | [Packaging](./guides/packaging.md#1-rebuild-the-baked-registry) |
| A marker added after the last cook | The baked registry is a snapshot taken at cook time; a new marker is invisible until it is rebaked | Cook again: the cook rebakes the registry at its start, so the break is a package cooked before the marker existed. **Tools > Rebuild Crowdy Registry** or Studio's **Rebuild (Deep Scan)** only refresh the in-editor view of the bake | [Packaging](./guides/packaging.md#1-rebuild-the-baked-registry), [Inspector and Registry](./studio/inspector-and-registry.md) |
| A placement guid read at `BeginPlay` | The engine releases the per-placement guid before `BeginPlay` in a cooked build; the editor keeps it alive | Read placement data at `OnRegister`, never at `BeginPlay` | [Stable identity in a packaged build](./concepts/entities-identity-ownership.md#stable-identity-in-a-packaged-build) |

A fourth hazard is loud, not silent: Shipping sets `WITH_DEV_AUTOMATION_TESTS` to 0, and a target that forces dev tests back on can then fail to compile a test file through a `!UE_BUILD_SHIPPING` region it reaches via a header. [What Shipping strips](./guides/packaging.md#5-what-shipping-strips).

## Settings never to hand-edit

Config Sync in Crowdy Studio writes the Network category of `UCrowdySDKDeveloperSettings` into `Config/DefaultGame.ini` under `[/Script/CrowdyReplication.CrowdySDKDeveloperSettings]`. The fields are read-only in Project Settings on purpose; a hand-pasted value is overwritten by the next sync, and a drifted project fails to connect with no obvious error.

| Never hand-type | Owned by you (fine to edit) | Owning page |
|---|---|---|
| `Environment`, `DiscoveryUrl`, `AppID`, `OrgId`, `GameApiHttpUrl`, `GameApiWsUrl`, `UDPProtocol`, `UDPTimeoutSeconds`, `HostPollIntervalSeconds` | `MapProfiles`, `DefaultProfile`, `BakedRegistry`, `PreloadedEntityClasses`, `IDOverrides`, `ClassIDOverrides` | [Config Sync](./studio/config-sync.md#what-config-sync-writes-and-what-you-own), [Project settings](./reference/project-settings.md) |

Do not copy the plugin's `[CoreRedirects]` into the project's `DefaultEngine.ini` either; `Plugins/CrowdySDK/Config/DefaultCrowdySDK.ini` already carries them. [Packaging](./guides/packaging.md#6-coreredirects-ship-with-the-plugin).

## Drive the editor without a window

An agent cannot press editor buttons. Two commandlets do what the Server Compute panel and Crowdy Studio's Project page do, from a shell:

```
UnrealEditor-Cmd.exe <Project>.uproject -run=CrowdyServerCompute -op=<op> [switches] [-out=result.json]
UnrealEditor-Cmd.exe <Project>.uproject -run=CrowdyStudio -op=<op> [switches] [-out=result.json]
```

Exit code 0 is success, 1 is a refusal or a failure, and `-out=` writes the result as JSON (`ok`, `error`, and the op's own fields). An op that changes the project or the app needs `-yes`; without it the op says what it would do and changes nothing. A commandlet run with an unknown or no `-op` prints every op it has.

Close the Unreal Editor first. It holds the project's Server Object types and settings in memory and saves its own copy over what an op wrote, so an op that writes the project refuses while an editor runs unless you pass `-editoropen`.

| Step | Op | Owning section |
|---|---|---|
| Check the sign-in and the project's app | `-run=CrowdyServerCompute -op=whoami` | [From the command line](./exec/deploy-with-server-compute.md#from-the-command-line) |
| List organizations, apps and datacenters | `-run=CrowdyStudio -op=apps` | [Sync from the command line](./studio/config-sync.md#sync-from-the-command-line) |
| Create an app | `-run=CrowdyStudio -op=createapp -org=<id> -name="My Game" -slug=my-game -datacenter=<code> -yes` | [Sync from the command line](./studio/config-sync.md#sync-from-the-command-line) |
| Point the project at an app | `-run=CrowdyStudio -op=sync -app=<id> -yes` | [Sync from the command line](./studio/config-sync.md#sync-from-the-command-line) |
| Read every entity class's CrowdyEvent routing and CrowdyState flags | `-run=CrowdyStudio -op=registry [-class=<substring>] [-norebuild] [-out=file]` | [Sync from the command line](./studio/config-sync.md#sync-from-the-command-line) |
| Add Game Kit starters | `-op=addstarter -starter=<name>` | [Add a starter](./exec/use-game-kit-starters.md#add-a-starter) |
| Define a Server Object type | `-op=exporttype -spec=type.json` (a template), `-op=newtype -spec=@type.json`, `-op=edittype -type=T -spec=@type.json -yes` | [Define a type from a file](./exec/deploy-with-server-compute.md#define-a-type-from-a-file) |
| Generate its server code | `-op=generate -type=T`, or `-op=generate -yes` for every type that is out of date | [From the command line](./exec/deploy-with-server-compute.md#from-the-command-line) |
| Remove or rename a type | `-op=removetype -type=T -yes`, `-op=renametype -type=T -to=/Game/Path/NewName -yes` (without `-yes` they only say what they would do) | [From the command line](./exec/deploy-with-server-compute.md#from-the-command-line) |
| Write its logic | Edit `Server/<Type Name>/src/logic.rs` | [Write logic.rs](./exec/write-server-logic.md#write-logicrs) |
| Deploy, call and read back | `-op=deploy -yes`, `-op=call -type=T -fn=F -key=K -inputs=@in.json -yes`, `-op=logs [-level=errors]`, `-op=instances` | [From the command line](./exec/deploy-with-server-compute.md#from-the-command-line) |
| Move running Server Objects to the new deploy | `-op=restart -type=T -yes`, or `-op=restart -yes` for every type with an instance on older code | [From the command line](./exec/deploy-with-server-compute.md#from-the-command-line) |
| Set up access features, teams, channels and grids | `-run=CrowdyStudio -op=features`, `-op=definefeature`, `-op=createteam`, `-op=createchannel`, `-op=creategrid`, `-op=grantgrid` and more (comma lists without spaces: `-keys=a,b`) | [Access, teams, channels and grids](./studio/config-sync.md#access-teams-channels-and-grids) |

`-op=generate` reports, per type, the functions `logic.rs` is missing and the ones it defines that the type no longer has, so the next edit is known. `-op=batch -ops=<file>` runs many ops in one editor start.

Who owns which file:

| File | Owner |
|---|---|
| `Server/<Type Name>/src/logic.rs`, and any `src/logic/<name>.rs` it declares with `mod <name>;` | You |
| `Cargo.toml`, `src/lib.rs`, `src/types.rs` in the same folder | Generate rewrites them; never edit |
| `Server/<Type Name>/revisions.json` | Server Compute: every kept deploy's code in full, so a restore is a copy |
| `GameKitWorld`, `GameKitActorStarters`, `PreloadedEntityClasses` and the map profiles in `Config/DefaultGame.ini` | You |
| The Network settings in `Config/DefaultGame.ini` | Config Sync, or `-run=CrowdyStudio -op=sync` |

Two things still need a person. Crowdy Studio's sign-in is once per machine and again when it expires; `-op=whoami` says whether it is there. The Blueprint-only editors (the Crowdy Replication variable panel, Crowdy Replicates events) have no text form; write the [C++ markers](#the-marker-vocabulary) instead. The `sbx.*` console commands exist only in the SDK's own Sandbox project, not in yours.

## Testing without a second client

Both switches are off by default. Turn them back off before testing real two-client routing. [Testing locally](./guides/testing-locally.md).

| Console variable | What it does | Owning section |
|---|---|---|
| `crowdy.rpc.loopback 1` | A sent `CrowdyEvent` is also delivered to your own receive path, once; a call made from inside the replayed body does not loop again | [Single-client RPC loopback](./guides/testing-locally.md#single-client-rpc-loopback) |
| `crowdy.state.loopback 1` | A state delta for an owned entity is decoded onto a lazily spawned local mirror (`RemoteProxy` role, its own NetID), so `OnRep` fires with one client. The mirror's trace line always says `(targeted)`; that label is cosmetic | [Single-client Crowdy State loopback](./guides/testing-locally.md#single-client-crowdy-state-loopback) |

For a headless smoke test in a development build, `crowdy.auth.signin.file <path>` signs in a test account from a JSON file (`{"email": "...", "password": "..."}`; never type a password on a console line), and `crowdy.auth.status` reports `SignedIn=true` once it has finished: poll it before player-side commands. [Sign in from the console](./guides/testing-locally.md#sign-in-from-the-console).

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
| Every id is `int64`; the app id travels as a JSON string and the SDK encodes it, never you | [The Two Planes](./concepts/two-planes.md#what-the-split-means-for-your-code) |
| The host is a convention, not enforcement; never gate cheat-sensitive state on it | [Host is a convention](./concepts/host-is-a-convention.md), [Host authority](./runtime/host-authority.md) |
| Presence is the player's actor: a client with no fresh actor is at no position and receives no spatial event | [Sessions and presence](./concepts/sessions-and-presence.md#presence-is-the-players-actor) |
| A world subsystem null-checks `GetGameInstance()` in `Initialize()`; it is null in the transient world at engine start | [Host authority](./runtime/host-authority.md#the-host-subsystem), [Replicated subsystems](./runtime/replicated-subsystems.md) |
| An array parameter on a delegate handler is `const TArray<T>&`; a by-value parameter does not match and `AddDynamic` will not compile | [Teams](./services/teams.md) |
| A `Multicast` call has a 1024-byte payload budget and is dropped loudly, never truncated; large payloads go on `SpatialMulticast` | [RPC events](./runtime/rpc-events-cpp.md#containers-and-their-bounds) |

## Related

- [Quickstart](./quickstart.md): the lantern every example above comes from.
- [Best Practices](./guides/best-practices.md): the four rules stated in the abstract.
- [Packaging](./guides/packaging.md): the checklist before a cooked build.
