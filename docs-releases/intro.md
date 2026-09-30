---
slug: intro
sidebar_position: 1
title: Changelog
---

# API changelog

Notable, consumer-facing changes to the public Crowded Kingdoms APIs (Management API,
Game API, Replication API) and SDKs. Newest first.

The intent is that a breaking change ships with a deprecation window — the field keeps
working and is marked `@deprecated` in the schema (visible in the
[reference](/management-api/reference/graphql-overview) and the downloadable SDL) until
a stated removal date. **Three removals did not get one**, and each is called out in
its own entry rather than left to be discovered: the customer-provisioned
environment surface on [2026-07-27](#2026-07-27), the dev sign-in bypass on
[2026-08-20](#2026-08-20), and the game API's legacy engines on
[2026-09-28](#2026-09-28-dev-the-legacy-engines-removed), so far on the dev environment
only. Treat **the published SDL as the authority** on what exists today; this page is the
record of how it got there.

Older entries describe the game API's legacy engines (game models, automations, compute
modules and player code), which ck-exec replaced. Their links lead to the matching section
of [from the legacy engines](/exec/from-the-legacy-engines), which maps what you used to
what you use now.

:::note[`crowdy-compute` was never publicly distributed]

Several entries below announce a `crowdy-compute` CLI. It was an internal
convenience and **was never published**. The entries are left as written because
this page is a historical record. The compute modules it deployed were replaced by
ck-exec, which builds and deploys through the game API (`execBuild`, `execDeploy`); its
own CLI is not published either. See
[from the legacy engines](/exec/from-the-legacy-engines#build-and-deploy).

:::

## Unreleased (Unreal SDK, Server Objects; Game Models deprecated)

Server Objects are additive; the Game Model deprecation below is not, and
affects every project that uses Game Models. Per-item detail:
[What's Changed](/unreal-sdk/guides/whats-changed#unreleased-after-v2170).

- **The Unreal SDK's Game Model API is deprecated and does nothing; a later release removes it.**
  Every call fails at once with `GAME_MODEL_DEPRECATED`, C++ warns at each use, each Blueprint that
  uses Game Models gets one compiler warning listing them, and Crowdy Studio's Game Model page and
  CrowdyMass's Game Model values stop working. Server Objects replace it.
  See [Move from Game Models](/unreal-sdk/exec/move-from-game-models).
- **Server Objects bring ck-exec to the Unreal SDK, from C++.** A data asset describes a type of
  server-owned state (the struct the server keeps, the fields players may watch, the functions they
  may call); the game acquires a shared Server Object by type and Instance Id, is told each time its
  watched values change, and calls its Server Functions, with a busy server retried for it.
  Blueprint use is in a later entry below. See
  [Server Logic](/unreal-sdk/exec/overview).
- **Generate Server Code writes a Server Object type's server code from its definition asset.**
  Right-click the asset in the Content Browser: the editor writes a Rust crate under
  `Server/<Type Name>/` in the project, regenerates the glue that keeps watched values, Owner Only
  and Who Can Call in step with the definition, and leaves you one file, `logic.rs`, for what
  each Server Function does. It warns before a regeneration drops a field or enum value. The
  asset's editor also has a **Server Code** tab: an external-editor button and an editor for the
  code with Save and Revert, and a **Generate** button in its toolbar. **Code Source** lets you choose **My own file**, a
  `.rs` file of your own, instead of the generated `logic.rs`; Generate Server Code then never
  creates or overwrites it, and Server Compute sends it as the type's `logic.rs`.
  See [Write its server logic](/unreal-sdk/exec/write-server-logic).
- **Server Compute builds and deploys a project's server code, and shows how it runs.** Open
  Crowdy Studio and choose **Server Compute** in its navigation; it uses Studio's sign-in and the
  app set there. **Deploy** sends every Server Object type in the project to ck-exec's build and
  deploys the result as the app's active server code, with the build output shown on the page.
  Its tabs list the versions (with **Make active** to go back to an earlier one), switch one type
  or the whole app off and on, read the logs, including one call's lines, and show how the calls
  to each Server Function went. The same operations run from the command line for CI with
  `UnrealEditor-Cmd <project> -run=CrowdyServerCompute -op=deploy -yes`; `deploy`, `starters`,
  `activate`, `disable` and `enable` refuse without `-yes` and send nothing. See
  [Server Compute](/unreal-sdk/exec/deploy-with-server-compute).
- **The Server Object definition asset has its own editor, and Server Compute tracks what changed.**
  Double-clicking the asset opens an editor like the Material or Blueprint editors: a toolbar with
  **Generate**, **Deploy** and a status readout, a **Server Code** tab with line numbers and Rust
  colouring, and a **Details** tab with the settings, the watched values ticked from State's fields
  and the Type Name suggested and checked as you type. Some settings read differently, for example **Who
  Can Read** and **Players See**. **Open Server Compute** in the Deploy dropdown opens Crowdy Studio on
  that page. **Who Can Call** (Players or Server only) replaces Player Callable: a Server only
  function refuses a player's call. Each deploy now records what it sent beside the type's crate,
  in `revisions.json`, so the Server Compute page can tell you, per type, that it has **No
  changes**, has **Changed**, is **New** or is a **Removed** type still live, and offers **Deploy**
  only when something changed. The asset lists the type's earlier deployed code to view, compare
  or restore, a type can be removed from the project from its menu, and a **Settings** tab sets how
  many revisions are kept. `-op=changes` reports the same comparison for CI. Commit
  `revisions.json` with the crate. See [Create a Server Object type](/unreal-sdk/exec/create-a-type)
  and [Server Compute](/unreal-sdk/exec/deploy-with-server-compute).
- **A Server Object's State, params and reply can be Lists instead of structs.** Set **State As**,
  **Sends As** or **Replies As** to **List** and add named values right in the asset, each with a
  type and a starting value, with no struct to write. A List travels exactly like a struct with the
  same fields, and the generated server code gives it the name a struct would have
  (`VillageBeaconState`, `FeedBeaconParams`, `FeedBeaconReply`), so `logic.rs` does not change.
  From C++, `MakeParams` and a `Call` overload send a List, `CrowdyExec::ToList` reads a List reply
  and `GetStateList` a List State, all by name. Existing definitions stay Struct. See
  [Create a Server Object type](/unreal-sdk/exec/create-a-type#variables-inputs-and-outputs-or-a-struct).
- **Each Server Functions entry labels its header row** with **Function** before the name and
  **Who can call** before the Players / Server only choice, each with a tooltip saying what it does.
- **The Server Object asset editor now works like the Blueprint editor.** A **Server Object** panel,
  where My Blueprint is, lists the type's **Variables** (each with its type pill and an eye for
  **Visible to Players**) and **Functions** (each with its pins, such as `(Oil) -> Oil`), and
  **Details** follows the selection. Labels use Blueprint's words: **Readable By** (was Who Can
  Read), **Callable By** (was Who Can Call; **Players** or **Server Only**), **Visible to Players**
  (was Players See), **Inputs** and **Outputs** (were Sends and Replies), each with a **Use Struct**
  check-box in place of State As, Sends As and Replies As, and Lists are now variables, inputs or
  outputs added in the asset. The wire, saved data and C++ calls are unchanged. See
  [Create a Server Object type](/unreal-sdk/exec/create-a-type#the-asset-editor).
- **Server Objects work from Blueprint.** A **Crowdy Server Object** component holds a Server Object
  for its actor from Begin Play to End Play: pick the definition and an **Instance Mode**, **Instance
  Id** (actors with the same id share one), **Signed-In Player** (the player's own, for Owner Only
  types) or **This Actor** (a placed actor's place in the level), and it raises **On Variables
  Changed** and **On Status Changed**. The **Server Objects** nodes cover the rest: **Get Server
  Object**, **Release Server Object**, **Get Player Instance Id**, **Call Server Function** (with
  **On Success** and **On Failed**, exactly one of which runs), **Make Inputs**, **Set Server Value**
  and **Get Server Value** (by name), and on the object **Get Status**, **Get Failure Reason**, **Get
  Instance Id**, **Get Variables**, **Watch Variables** and **Stop Watching Variables**. Typed nodes
  with typed pins follow in a later entry below. See
  [Get a Server Object, from Blueprint](/unreal-sdk/exec/from-blueprint/get-a-server-object).
- **Server Objects get members, access rules, timers and Can Call.** In the asset, **Readable By**
  gains **Members** and **Callable By** gains **Members** and **Leader**; each function can have a
  **Cooldown** (seconds, per player) and each number input a **Value Range**. **Members From** is
  **None**, **This Object** (Join, Leave, Add Member, Remove Member, Make Leader and Set Open For
  Joining, a leader, **Max Members**, and **Open For Joining**) or **Crowdy Team**. **Timers**
  (**Every** or **After**, each a function in `logic.rs`) and the **On Player Joined** and **On Player
  Left** events run on the server, and **Can Call** lets one type call another with typed calls. A
  refusal by one of these rules reaches the caller as **Denied**, and a cooldown as **Denied** and
  retryable. The component gains the **Player's Team** and **From Server Value** modes, and the
  object the nodes **Get Members**, **Get Member Count**, **Get Leader**, **Is Open For Joining**,
  **Is Member** and **Is Leader**. Generate and deploy a type again to use them. See
  [Access, members and timers](/unreal-sdk/exec/access-members-and-timers) and
  [Guild halls and arena lobbies](/unreal-sdk/exec/examples/guild-halls-and-arenas).
- **Typed Blueprint nodes, find by asset and Only One Instance.** In any Blueprint graph, a variable's name now offers `Get <Variable> (<Asset>)` and `On <Variable> Changed (<Asset>)`, a function's name `Call <Function> (<Asset>)`, and each asset `Get Server State (<Asset>)`, all under **Server Objects**, with a real pin for every value: Boolean to Map, enums, vectors, colors, dates, tags, soft references and your own structs (**Split Struct Pin**). `On <Variable> Changed` is bound once from Begin Play, runs at once with the current value and after every change of that variable, and needs no unbinding. `Call <Function>` has typed inputs and outputs, with **On Success** and **On Failed**. The object comes from **Target** (**Self** by default) or from **Find By Asset**: **Instance Id**, **Signed-In Player** or **Player's Team**. A new **Only One Instance** setting gives a type one shared instance for every player, which needs no Instance at all. Only variables ticked **Visible to Players** are offered, and a value that does not fit its pin is refused, not cut: a **Call** sends nothing and runs **On Failed** naming the input. **Get** has an advanced **Has Value** pin, false until the server has sent the values. A name that clashes with a node's own pin (such as `Team Id` or `On Success`) gets no node, and the compile says to rename it. The untyped nodes stay for dynamic cases. **Behavior change:** the names in **On Variables Changed** and **Watch Variables** are now the ones **Get Server Value** finds, also for variables renamed with **Server Names**. A new walkthrough, [Tip jar: your first Server Object](/unreal-sdk/exec/examples/tip-jar), builds a tip jar with only the editor. See [Get a Server Object, from Blueprint](/unreal-sdk/exec/from-blueprint/get-a-server-object).
- **A shared boss, end to end, and a trace for Server Objects.** A new example page,
  [Shared boss fight](/unreal-sdk/exec/examples/shared-boss), builds one boss that every player hits, with
  its health on the server, a per-player cooldown, a 1 to 25 damage range, hits refused while it is
  defeated and a Respawn timer that brings it back, then plays it with two players and switches the
  type off and on from Server Compute. The new console variable `crowdy.exec.trace` (off by default,
  log category `LogCrowdyExec`) prints each Server Object's status changes, the reads and pushes it
  applied with their epoch, sequence number and changed variable names, why it read again, its
  subscribes, each call sent and answered with its time, and connection closes and redials. It prints
  no values and no tokens. See [Seeing what a Server Object is doing](/unreal-sdk/exec/troubleshooting#seeing-what-a-server-object-is-doing).
- **A timer that cannot start refuses the call.** If the platform refuses a timer a Server Function starts, the call fails as `ServerError` ("the change was not kept: timer Respawn could not start: ..."), nothing it changed is kept or published, and timers it already started in that call are cancelled. See [Timers and events](/unreal-sdk/exec/access-members-and-timers#timers-and-events).
- **Renames ask, every value is checked.** Renaming a variable, input or output added in the asset now asks at Generate whether to keep the old name on the server, so saved values carry over; a new Type Name offers to move the old server code folder; the generated code checks every value an Unreal client would refuse, including a state loaded from an older save (`unreadable`); each function keeps its own default values; and a function name can no longer reach the server in the wrong letter case in a packaged game. Generate and deploy your types again. See [After you change the definition](/unreal-sdk/exec/write-server-logic#after-you-change-the-definition).
- **Type Settings, CSO_ names, tidier nodes.** The Server Object panel opens on a pinned **Type Settings** row, with a matching toolbar button, for the type's own settings. New assets come from **Add > Crowdy > Server Object** and are named `CSO_`; older `DA_` assets keep working. Details reads more plainly (seconds, **Min** and **Max**, timers that run **Every** or **Once After**), Call nodes tuck **Outcome**, **Reason** and **Retryable** under the arrow at the bottom (wired ones stay), and an `On <Variable> Changed` can be placed more than once. A new page, [Relate Server Objects to each other](/unreal-sdk/exec/relate-server-objects), covers registries, shared objects, lobbies and teams. Nothing to do.
- **Generate fills in what logic.rs is missing.** A Server Function, timer or event added after `logic.rs` was written is now offered as an empty version at Generate, or with **Add Stubs** in the Server Code tab, instead of only breaking the build; a method the type no longer has is named. Each timer's name is a constant, `timers::END_MATCH`, so a misspelt timer no longer compiles. The Server Code tab now picks up a save from another editor by itself. Generate again. See [After you change the definition](/unreal-sdk/exec/write-server-logic#after-you-change-the-definition).
- **The Crowdy Teams cache keeps itself current.** Signing in clears and refills the "my teams" cache, signing out empties it (`OnMyTeamsCacheChanged` fires with an empty list), and a successful create, join, leave, delete, update, member removal or role change refreshes it; Request To Join does not, since the membership is pending. A stale Get My Teams answer never fills it. C++ gains `ClearMyTeamsCache()`. See [Crowdy Teams](/unreal-sdk/services/teams#reading-the-cache-first).
- **Too many new names no longer fail a whole Server Object message.** A client accepts at most 1 Mi (1,048,576) characters of new names per run; past it a new Name reads as None, an object path of new names reads as empty, the rest of the message still applies and the client logs one warning. See [Create a Server Object type](/unreal-sdk/exec/create-a-type#field-types).
- **Lists that start with different values get their own struct in the generated code.** A List that shares another's shape but starts with different values is its own struct, not a `pub type` alias, and Generate shows a notice when a List switches; one that starts with the same values stays an alias. Generate again and fix any `logic.rs` that used one for the other. See [Create a Server Object type](/unreal-sdk/exec/create-a-type#variables-inputs-and-outputs-or-a-struct).
- **Moving or renaming a definition asset keeps its server code findable.** Saving it updates its crate's `Cargo.toml` record, so a later Type Name change still finds the folder. A Ready Server Object also stops keeping an earlier read refusal's text as its failure reason.

## 2026-10-03 (dev: chunk loads show recorded voxel edits; CrowdyJS 18.2.0, CrowdyCPP 0.56.0)

Every voxel write except a chunk write-back lands only in the chunk's edit log: a hub's or
mod's `world.set_voxels`, `updateVoxel`, and realtime voxel updates. Since Game API v2.33.0 on
the dev environment, `getChunk` and `getChunksByDistance` return each recorded edit as a
`voxelStates` entry with its voxel type (`getChunksByDistance` only when `voxelStates` is
selected). The stored `voxels` hold none of them, so a client that reads only `voxels` loses a
hub's block on reload.

- **CrowdyCPP 0.56.0**: `ChunkStore::ensureAround`'s one bulk load selects `voxelStates` and puts
  each entry over the stored grid. An `IChunkSource` of your own reports them in
  `StoredChunk::voxelStates`. See [WorldSession](/crowdycpp/world-session).
- **CrowdyJS 18.2.0**: `ChunkStore` keeps a chunk it has already loaded when a later bulk load
  returns it again; before, moving put the stored grid back over the hydrated edits. Hydration
  also puts the edits on a chunk stored with `voxels: null`. A store hydrates when it has a
  `voxelStateCodec` or `hydrateVoxelStates: true`. See [World Stores](/crowdyjs/stores).
- A chunk that has never been stored comes back from neither read, even when edits were
  recorded for it.

## 2026-10-01 (CrowdyPy 0.5.0)

CrowdyPy catches up with CrowdyJS 18.1.0 and CrowdyCPP 0.55.0.

- **`client.exec.connect` sends the connect token only to a gateway on the platform's own
  domain**, as CrowdyJS and CrowdyCPP do. See
  [Where the connect token goes](/exec/connect-from-a-game#where-the-connect-token-goes). A
  gateway that refuses the token is reported as `Denied`, with its reason.
- **Open grids:** `game_apps.open_permissions` and `set_open_permissions`.
- CrowdyPy is on PyPI: `pip install crowdypy`.

## 2026-10-01 (open grids in the SDKs, CrowdyJS 18.1.0, CrowdyCPP 0.55.0; ck-exec limits)

The SDK side of the ck-exec preview's security review. On the dev environment.

- **Open grids in the SDKs.** `client.gameApps.setOpenPermissions` / `openPermissions`
  (CrowdyJS) and `gameApps().setOpenPermissions` / `openPermissions` (CrowdyCPP) wrap
  `setGridOpenPermissions` / `gridOpenPermissions`: the keys a grid grants every player with
  access. A zone everyone may build in has to grant `update_voxel_data` itself now, because the
  most specific grid over a chunk decides who builds there. See
  [open grids](/game-api/grids-and-permissions#open-grids).
- **Where the connect token goes.** `exec.connect` dials a ck-exec gateway only when it is on the
  platform's own domain, over `wss:` whenever the game API is `https:`; any other gateway is
  refused without being dialed. See
  [connect from a game](/exec/connect-from-a-game#where-the-connect-token-goes).
- **A refused connect token is `Denied` again** in Node (CrowdyJS with the `ws` package) and in
  CrowdyCPP, with the gateway's reason where the transport can read it. A browser cannot read
  the refusal and still reports `Unavailable`. See
  [when the gateway refuses](/exec/connect-from-a-game#when-the-gateway-refuses).
- **ck-exec's limits are written down**: 16 connections per player and app through a host
  (`HTTP 429` past them), what closes a connection (a text message, too many WebSocket pings), a
  ceiling of 1,024 running instances per app, and what one handler call may send, return and
  save. See [call limits](/exec/operations#call-limits) and
  [what one call may send and return](/exec/intro#what-one-call-may-send-and-return).

## 2026-10-01 (CrowdyPy 0.4.0, the Python SDK)

**CrowdyPy is the new official Python SDK.** It covers CrowdyJS's whole surface with
Python names, and its realtime path is CrowdyCPP's native UDP replication client,
compiled into the wheel. See the [CrowdyPy docs](/crowdypy/intro).

- One `cp312-abi3` wheel per platform for CPython 3.12 and later, plus free-threaded
  3.14. Both an asyncio client (`crowdypy.AsyncCrowdyClient`) and a blocking one
  (`crowdypy.sync.CrowdyClient`) are included.
- Native UDP replication with batched sends and zero-copy notification batches, plus
  the World Stores, the Game Kit, the ck-exec gateway, GraphQL subscriptions, the
  headless Crowdy Studio and the player-host observation contract.
- The [HMAC guide](/replication-api/hmac#python--sign-clientserver-and-verify-serverclient)
  gains a Python example.

## 2026-09-29 to 2026-09-30 (dev: who may build where, and the security review's fixes)

The ck-exec preview's security review, on the dev environment. CrowdyJS 18.0.2 to 18.0.4 and
CrowdyCPP 0.52.0 and 0.53.0 carry the SDK side.

- **The most specific grid decides a voxel write.** Every app has a world grid that grants
  every player, so a write used to pass wherever any grid covering the chunk granted it. Now
  the smallest grid covering the chunk decides: the player needs `update_voxel_data` on that
  grid, the world grid decides only the wilderness, and a chunk no grid covers is refused.
  `updateVoxel`, `updateChunk`, `sendVoxelUpdate`, a mod's `world.set_voxels` and, from
  replication server v0.34.0, a client's direct UDP voxel update all apply it. A zone everyone
  should build in grants everyone itself (`setGridOpenPermissions`, at most 32 open grids per
  app), and `claimGridChunk` claims only the wilderness (`GRID_NOT_CLAIMABLE` inside another
  grid). See [which grid decides a voxel write](/game-api/grids-and-permissions#which-grid-decides-a-voxel-write).
- **The wilderness setting.** `App.wildernessWritesOpen` (default true; `updateApp` sets it)
  closes the wilderness to every voxel write when false. `updateChunk` now needs `manage_apps`
  or the voxel permission for that chunk. See [wilderness](/game-api/grids-and-permissions#wilderness).
- **Voxel writes are range-checked.** A voxel outside 0–15 on any axis of its chunk, or a type
  outside 0–255, is refused on every write path: `updateVoxel`, `sendVoxelUpdate`,
  `updateChunk`'s `voxelStates` and `world.set_voxels`.
- **A player can take back an agreement to a CLIENT half**: `execRevokeClientModConsent` and
  `execRevokeAuthorTrust` (CrowdyJS 18.0.3 `revokeClientModConsent`, `revokeAuthorTrust`,
  `ExecClientHalves.revoke` and `forgetAuthor`; CrowdyCPP 0.52.0). See
  [serving it to visitors](/exec/client-halves#serving-it-to-visitors).
- **CLIENT halves hold to the page's rules** (CrowdyJS 18.0.2): a spatial or channel send goes
  out as an actor uuid the page derives for the grid, never one the CLIENT half names, and the
  page asks the player before the in-browser agent tests a draft.
- **A refused chunk write-back is dropped** by `ChunkStore` instead of being retried (CrowdyJS
  18.0.4, CrowdyCPP 0.53.0).
- **ck-exec 0.10's gateway** checks the connect token before the WebSocket opens (a refusal is
  `HTTP 401`, no longer a `4401` close) and limits pings, subscriptions, message size and new
  connections from one address. See [call limits](/exec/operations#call-limits).

## 2026-09-28 (dev: the legacy engines removed)

**Breaking, with no deprecation window, and on the dev environment only so far.** The game API
removed its four legacy developer-code engines: game models, automations, compute modules, and
player code with its browser client modules and player models. That took 129 root fields, 140
types and 11 error codes out of the schema. ck-exec replaces them, and
[from the legacy engines](/exec/from-the-legacy-engines) maps every removed call to what
replaces it; the engines' deleted pages redirect to their sections there. Test and production
keep the engines until they move to ck-exec.

- **CrowdyJS 18.0** removes their SDK surface (`client.gameModel`, `client.compute`,
  `client.playerCompute`, `client.playerModel`, the Game Kit's engines and `client.operator`),
  and Crowdy Studio runs on ck-exec only. 18.0.1 also drops what only platform staff can call.
  See CrowdyJS's [migration notes](https://github.com/CrowdedKingdoms/CrowdyJS/blob/dev/MIGRATION.md).
- **CrowdyCPP 0.50.0** removes the same, and 0.51.0 wraps only what players, developers and org
  admins can call.

## 2026-09-25 to 2026-09-27 (dev: the ck-exec preview)

**ck-exec, the runtime for your game's server code, is in preview on the dev environment.** You
write hubs (state, one instance per key) and spokes (stateless, scaled out) in Rust, build them
to WebAssembly, and deploy them with the app; players call them over a WebSocket to an execution
host. See the [ck-exec overview](/exec/intro). Each line below arrived in the CrowdyJS and
CrowdyCPP versions it names, on their dev releases.

- **Connecting players** (`execConnect`; CrowdyJS 17.9.0, CrowdyCPP 0.44.0):
  [connect from a game](/exec/connect-from-a-game).
- **Operating your code** (`execLogs`, `execInstances`, `execVersions`, `execActivateVersion`,
  `execSetEnabled`, `execConnectAsDeveloper`; CrowdyJS 17.10.0, CrowdyCPP 0.45.0):
  [operations](/exec/operations).
- **Builds on the platform and starter packs** (`execBuild`, `execBuildStatus`, `execStarters`;
  CrowdyJS 17.11.0, CrowdyCPP 0.46.0): [builds and starter packs](/exec/builds).
- **Mods**, players' code on grids they own (`execModBuild`, `execModDeploy` and the rest;
  CrowdyJS 17.12.0, CrowdyCPP 0.47.0): [mods](/exec/mods). Since 2026-09-27 a mod bills its
  owner's player wallet once the owner's monthly trial (250,000 compute units in each app) is
  used, and an empty wallet or a spend cap switches off only that owner's mods
  (`PLAYER_WALLET_EMPTY`, `PLAYER_SPEND_CAP`): [who pays for a mod](/exec/mods#who-pays-for-a-mod).
- **Following one call** and counters per endpoint (`execLogs(flow:)`, `execEndpointStats`;
  CrowdyJS 17.13.0, CrowdyCPP 0.48.0). From CrowdyJS 17.13.0 Crowdy Studio deploys a SERVER
  target as a mod.
- **CLIENT halves**, a mod's browser code (`execModClientBuild`, `execModClientDeploy`,
  `execGridClientMods`, `execConsentClientMod`, `execTrustAuthor`, `execModClientArtifact`;
  CrowdyJS 17.14.0 with `ExecClientHalves`, CrowdyCPP 0.49.0): [CLIENT halves](/exec/client-halves).

## 2026-09-23 (CPU price)

**The CPU rate is $0.20 per CPU-hour, one core.** It was $3.60. A CPU-hour is one core busy for one hour, not one machine. The same price covers GraphQL resolvers, automations, compute modules, and player-authored compute. The monthly allowance is unchanged: **20 CPU-hours** pooled per app. The price in effect is the rate card in your account and on the [pricing page](https://crowdedkingdoms.com/pricing.html). A price applies from the next settlement period for usage that has already been billed this month.

## 2026-09-23 (Unreal SDK v2.16.0)

One change, additive: the Backend selector gains a Test tier. Per-item detail: [What's Changed](/unreal-sdk/guides/whats-changed).

- **Backend gains a Test tier, and its default now follows the SDK build's own release tier.** The
  built-in hosts behind Dev and Production moved to `ck.dev.crowdedkingdoms.com` and
  `ck.prod.crowdedkingdoms.com`; the old `api.dev.crowdedkingdoms.com` and `api.crowdedkingdoms.com`
  hosts no longer resolve. The new Test tier resolves to `ck.test.crowdedkingdoms.com`. A project's
  default Backend now follows the build's own release tier instead of always defaulting to
  Production, so the public release still defaults to Production. Each tier vendors its own
  CrowdyCPP (0.42.1). See [Project settings](/unreal-sdk/reference/project-settings#the-default-backend).

## 2026-09-22 (grid-scoped parity: Game API, CrowdyJS 17.7.0, CrowdyCPP 0.43.0, crowdy-dsh 0.4.0)

Player code inside a grid can now do everything app-scoped code can, confined
to the grid. Additive, except that the crowdy-dsh bridge protocol moves to v4
(CrowdyJS 17.7 pairs with crowdy-dsh 0.4).

- **Player host parity.** `emit_channel` and `emit_event` no longer return
  `denied_v1`. A module posts into its grid's
  [grid channels](/game-api/channels#grid-channels) and publishes on the
  grid event bus (other modules on the grid; studio modules that add a
  `grid_event` trigger). `container_get_batch`, `edge_add` / `edge_delete`,
  `sessions_list` and `avatar_state_get` answer on a grid. Every spatial kind
  originates in the grid and reaches `min(distance, 8, spatialMaxDistance)`.
  Details: [Player code](/exec/from-the-legacy-engines#player-code).
- **Studio `emit_spatial`**: `server_event` is opcode 139 and `client_event`
  138 for studio modules too (they were 140 / 139, which CrowdyJS never
  decoded), and both require the `[u16 eventType]` prefix.
- **New GraphQL**: `mintGridToken` ([grid-scoped tokens](/game-api/grid-tokens)),
  `createGridChannel`, `gridChannels`, `gameModelSessions(gridId)`,
  `CreateSessionInput.gridId`, `GmSession.gridId`, `Group.gridId`,
  `PlayerComputeDeployInput.gridEvents`, and the `channelEgress` /
  `spatialMaxDistance` / `gridEventEgress` player policy knobs.
- **Compute SDK 0.1.6**: `api::emit_event_to(target, name, payload)`;
  game kit `kit-core::grid` (publish, send_to, post, decode).
- **CrowdyJS 17.7.0**: `client.grid(appId, gridId)`, `client.grids`,
  `@crowdedkingdoms/crowdyjs/grid-program` (the full SDK in a sandboxed JS
  program), `startGridMod` / `createGridHostCalls`, the broker allowlist from
  the platform host catalog, the page-local grid event bus for CLIENT mods.
  [Guide](/crowdyjs/grid-programs).
- **CrowdyCPP 0.43.0**: `client.grids()` and `sessions(..., gridId)`.
- **crowdy-dsh 0.4.0**: `grid_context`, `grid_program_run`,
  `grid_program_status` agent tools.

## 2026-09-22 (Unreal SDK v2.15.0)

Six changes. One is a source break for C++ projects and is the only one that asks anything of a
game; the rest are additive or remove work a project may have done. Per-item detail and the
before-and-after of each: [What's Changed](/unreal-sdk/guides/whats-changed).

- **Eighteen array delegates pass `const TArray<T>&` instead of `TArray<T>` by value**: the ten
  single-cast teams, avatars and channels callbacks, three multicast cache events, and five Game
  Model outcome events. A C++ project that updates and rebuilds gets a compile error naming the
  handler's parameter, and changes `TArray<FCrowdyTeam> Teams` to `const TArray<FCrowdyTeam>&
  Teams`. Blueprint pins are unaffected. Nothing changes silently: if it builds, it is right.
- **The actor pool draws with no Backend Config at all.** Up to 2.14.0 a map profile with an empty
  Backend Config, or one naming no Replication Policy Class, tracked remote entities and drew
  none of them. It now falls back to the built-in `UCrowdyTransformRepPolicy`, so authoring a
  Backend Config is optional. A project that worked around the blank screen can drop the
  workaround. See [Rendering backends](/unreal-sdk/runtime/rendering-backends).
- **The shipped transform policy interpolates across a ring of samples** instead of the two it
  used to keep, and extrapolates for at most 0.2 s past the newest, so a late or lost update no
  longer shows as a pause and a jump.
- **A Player Derived pawn possessed after it begins play gets its account identity on
  possession**, respawned pawns included. Up to 2.14.0 the identity was read once at `BeginPlay`,
  which every runtime-spawned player pawn misses, so it registered under a random id and anything
  keyed on the local player id did not work for it. **Read the pawn's id and `IsLocallyOwned()`
  from On Crowdy Ownership Assigned, not at `BeginPlay`.** See
  [Entities, identity and ownership](/unreal-sdk/concepts/entities-identity-ownership).
- **The Unreal client reads signed downlink bundles** (CrowdyCPP 0.42.1 vendored). It
  advertises `BUNDLE_SIGNED` once the realtime connection is up and every 15 s after, and a
  Replication API v0.30.0 server then sends its notifications as `MESSAGE_BUNDLE_SIGNED`:
  one HMAC per datagram verified in the transport instead of one per member, with the messages
  a game receives unchanged. An older server ignores the advertisement and keeps the per-member
  form. `crowdy.net.recv.signedbundles 0`, read when a connection opens, turns the
  advertisement off for a before-and-after comparison. See
  [Connection and reconnect](/unreal-sdk/runtime/connection-and-reconnect#signed-inbound-bundles).
- **Crowdy Studio shows every value a live model holds.** The Game Model page's Live tab used
  to summarize a selected live model on one line that named a few attributes and then said
  "and N more". It now fills a panel under the instance list: one row per attribute with its
  value, what it holds and its description, the attributes the model declares that this live
  model has no value for (reading **not set**), a search box over names and values, **Copy
  value** and **Copy values**, and an **Internal** switch for the keys the runtime keeps for
  itself. The page's pre-seed strip hides itself while the Live tab is open, so the list and the
  panel get its height. See
  [Game Models authoring](/exec/from-the-legacy-engines#tools).

## 2026-09-21 (Replication API v0.30.0 / v0.31.0, Game API v2.8, CrowdyJS 17.6, CrowdyCPP 0.42)

Everything here is additive; a client that does nothing new sees nothing new.

- **Signed downlink bundles, opt-in** (Replication API v0.30.0). A client that
  sends `CLIENT_CAPABILITIES` (opcode 29) with the `BUNDLE_SIGNED` bit receives its
  bundled notifications as `MESSAGE_BUNDLE_SIGNED` (opcode 30): the same framing,
  members without a per-member HMAC, and **one** 32-byte HMAC over the whole
  datagram. Seven actor members fit per bundle instead of six and the server does
  one HMAC per datagram instead of one per member; measured on the test tier, egress
  per delivered notification fell 18 %. A client that never advertises is served
  exactly as before, and a server older than v0.30.0 ignores opcode 29. Details and
  the verification recipe: [Wire formats — signed bundles](/replication-api/wire-formats#signed-bundles--message_bundle_signed-30-and-client_capabilities-29).
- **CrowdyJS 17.6.0 and CrowdyCPP 0.42.1 advertise `BUNDLE_SIGNED`** on every
  `ready` and every 15 s (a token refresh or a server-side migration resets the
  server's record). CrowdyCPP 0.42.0 built opcode 29 and never put it on the wire.
  CrowdyCPP verifies the trailing HMAC; CrowdyJS strips it and walks
  (it never verified downlink HMACs). Nothing to change in a game that is on
  CrowdyJS 17.6.0 or CrowdyCPP 0.42.1.
- **Replication API v0.31.0 — interest-scoped peer presence.** Server-internal: the
  peer heartbeat no longer announces every actor to every server, so a sparse world
  no longer hits a fleet-wide chunk ceiling (~8 000 populated chunks) however many
  servers run. No wire change; nothing to change in a client.
- **CLIENT compute mods: tick rate and mouse input** (Game API v2.8.0, CrowdyJS
  17.6.0). A CLIENT crate may set `[package.metadata.crowdy] tick_interval_ms`
  (16–1000; default 1000) in its `Cargo.toml` — the only key admitted in that table —
  and call `api::pointer_clicks()` (CLIENT only, `input` capability group, 400/s) to
  drain the host game's mouse clicks each tick. See
  [Build mods — tick rate and mouse input](/build-a-game/bwf-mod-development#tick-rate-and-mouse-input).
- **`emit_spatial("server_event", …)` is opcode 139** (`SERVER_EVENT_NOTIFICATION`)
  with the payload framed `[u16 eventType LE][state…]`, and `client_event` is 138
  (Game API v2.8.0). Before this a `server_event` went out as an untyped generic
  spatial blob that typed decoders (CrowdyJS's event router, a CLIENT mod's scene
  catalog) never saw. [Compute host API](/exec/from-the-legacy-engines#realtime).

## 2026-09-19 (Game API v2.7.0, Replication API v0.29.x)

- **`refreshAppToken` may now answer `authorizedServer: null` while your server is
  healthy.** A native client that passes `currentServer` on refresh is told to keep
  its socket when the reply names a server and to call `serverWithLeastClients`
  again when it is `null`; since v2.7.0 `null` is also returned when the node is
  running near its capacity and a cooler sibling has room — the refresh is the
  cheapest moment for the fleet to spread players, so under load expect to be moved
  occasionally. CrowdyJS `PortalAPI.refresh(currentServer)` and CrowdyCPP
  `refreshToken` already do this; browser clients on the UDP proxy re-place on every
  refresh by design. [Portals & app-scoped tokens](/management-api/portals-and-app-tokens).
- **Placement avoids hot servers** (Game API v2.7.0) and the replication servers
  rebalance resident players below their Full line (Replication API v0.29.0–v0.29.5,
  which also bundles server-to-server traffic). Server-side only; a client sees at
  most a `COMMAND_RECONNECT` it already had to handle.

## 2026-09-16 (Game API v2.6.0, CrowdyJS 17.5, CrowdyCPP 0.41)

- **Bulk container reads and keyed seeding.** `gameModelContainers` pages for real
  (omitted `limit` = 200, max 1 000, `BAD_REQUEST` above) and forwards `bindingKey`;
  `containerStates(appId, containerIds)` (max 500) is the bulk twin of
  `containerState`; `seed` accepts a per-container `bindingKey` and a per-type
  `scope: session | app`; `createSession({ seedFromApp })` stamps the app's keyed
  template rows into the new session (max 2 000 rows). Seeded copies of an ended
  session are dropped after the tier's retention window — **7 days on every tier**.
  CrowdyJS 17.5.0 wraps all of it (`containers()`, `containerStates()`, `seed`,
  `createSession({ seedFromApp })`, `kit.matches.create({ seedFromApp })`); CrowdyCPP
  0.41.0 mirrors it. [Game models](/exec/from-the-legacy-engines#running-your-logic),
  [CrowdyJS game model](/exec/from-the-legacy-engines#calling-it-from-clients).

## 2026-09-15 (Replication API v0.28.0, Game API / Management API)

Security hardening from an internal review of authentication and authorization.
Nothing here changes a conforming client; each item says what would.

- **Client→server spatial messages must be signed** (Replication API v0.28.0). A
  long-spatial datagram from a client with `containsAuth = 0` is now dropped without a
  reply. The unsigned tail bound a packet to its session only by the `gameTokenId` in
  it, which is not a secret. CrowdyJS, CrowdyCPP and the Unreal SDK have always signed;
  only a hand-rolled client that omitted the HMAC is affected. See
  [HMAC](/replication-api/hmac) and the [worked example](/replication-api/example-packet).
- **Per-session send-rate limit** (Replication API v0.28.0): 500 messages/second
  sustained, bursts to 1,000, silent drop beyond. The busiest legitimate mix the docs
  describe (voice + video + actor updates, every bundle member counted) is roughly a
  quarter of that. See [Rate limits](/overview/rate-limits).
- **Revocation reaches the realtime plane.** `logout`, `logoutAllDevices`,
  `changePassword`, `resetPassword` and `revokeAppAuthorization` now tell the
  replication servers, so a native client's session ends within seconds instead of at
  its app token's expiry.
- **Tokens are stored hashed.** Session, e-mail confirmation, password-reset and
  organization tokens are stored as a hash and cannot be shown again after the response
  or e-mail that carries them. App-scoped tokens are the exception (they are the
  per-message HMAC key). **When each tier took this change every credential was reset
  once**: signed-in sessions, app-scoped tokens held by game clients, organization
  tokens, and confirmation / reset links minted before it. Sign in again, re-mint app
  tokens, and request a new link where needed.
- **A group fetched by id is served only to an app token for its own app.**
  `channel(groupId)`, `channelMembers`, `team`, `teamMembers`, the role reads and every
  by-id channel/team mutation answer `NOT_FOUND` when the app-scoped token belongs to a
  different app — and when the caller presents an identity session token, which is
  never a gameplay credential. Mint an app token (`mintAppToken`) to work on groups, as
  every first-party client already does. Same-app app tokens are unchanged.
- `OrgTokenWithSecret.token`'s description now says what is true: returned once, stored
  hashed.

## 2026-09-14 (Game API v2.1–v2.4, CrowdyJS 17.2–17.4, CrowdyCPP 0.38–0.40)

- **Game-model sessions** (Game API v2.4.0, CrowdyJS 17.4.0): `leaveSession`,
  `setSessionAdmission`, `transferSessionHost`, `endSession`, `sessionSnapshot`,
  `sessionEvents`, `sessionInspect` and the `sessionChanged` subscription; `GmSession`
  carries `admission`, `maxParticipants`, `participantCount`, `hostUserId`,
  `hostTerm`, `revision`, `endedAt`, `endReason`. Two rules: `leaveSession` requires
  the `incarnation` the join returned, and **presence is the player's replicated
  actor** — a participant with no fresh actor after the join grace window is expired
  by the server (create with `presence: 'none'` to opt out). Error codes
  `SESSION_FULL`, `SESSION_LOCKED`, `SESSION_CLOSED`, `SESSION_ENDED`,
  `SESSION_NOT_PARTICIPANT`, `SESSION_TARGET_NOT_PARTICIPANT`,
  `SESSION_INCARNATION_STALE`, `SESSION_HOST_TERM_STALE`.
  [Roster, admission, host and presence](/exec/from-the-legacy-engines#running-your-logic).
- **Third-party hosting on Crowdy Games** (Game API v2.1.0, CrowdyJS 17.2.0):
  `client.hosting` (claim a slug, publish a bundle, list), the Node subpath
  `@crowdedkingdoms/crowdyjs/hosting` (`publishDirectory`), and `EmbeddedHost` for
  sign-in under the Crowdy Games shell. Hosting mutations take an identity session,
  never an app token. [Hosting](/crowdyjs/hosting).
- **Guided "Create repository on GitHub"** (Game API v2.3.0, CrowdyJS 17.3.0):
  `githubNewRepositoryUrl` / `githubRepositorySlug`,
  `controller.createGitHubRepository()`, `status.repositorySelection`. The GitHub
  App still cannot create a repository itself. [Crowdy Studio and GitHub](/game-api/crowdy-studio-github).

## 2026-09-13 (Replication API v0.27.0, CrowdyCPP 0.37, CrowdyJS 17.1)

**Clients may bundle their requests.** `MESSAGE_BUNDLE` (opcode 2) — the framing the
replication server has always used to pack several notifications into one datagram —
is now accepted on the uplink too. Nothing removed; a client that keeps sending one
message per datagram is unaffected.

- **Replication server v0.27.0:** a client datagram whose first byte is `2` is
  unpacked and every member is gated, authenticated and rate-accounted exactly as if
  it had arrived alone. Rules: ≤ 1232 bytes, ≤ 32 members, no nesting (a nested
  member is dropped, its siblings proceed), a framing fault drops the remainder of
  the datagram but keeps the members already processed, and the datagram's wire bytes
  are metered once. See
  [Message Bundle per Datagram](/replication-api/wire-formats#message-bundle-per-datagram).
- **CrowdyCPP 0.37.0:** `replication::Connection` bundles outbound sends by default
  (`Config::bundleSends`, `Config::bundleWindowMs` = 1 ms), flushing on the window,
  on capacity, on `Connection::flushSends()`, at the end of `WorldSession::tick()`,
  before `*AndWait`, and on disconnect. A lone message is sent unwrapped.
  `Stats::bundlesSent` is new; `datagramsSent` may now be less than `messagesSent`.
  `bundleSends = false` is the 0.36 behaviour. See
  [Replication client](/crowdycpp/replication-client#bundled-sends-0370).
- **CrowdyJS 17.1.0:** the same on the binary relay (`realtime.binaryTransport`):
  `realtime.bundleSends`, `realtime.bundleWindowMs`, `client.udp.flushSends()`,
  `client.realtime.binaryRelayStats()`. The GraphQL transport is unchanged — the
  proxy signs one message per mutation.
- **Rollout order:** deploy the replication server before shipping an SDK build
  that bundles. Against an older server, two messages sent within a window are
  dropped together; `bundleSends: false` is the escape hatch.
## 2026-09-13 (Game API v2.0.0, CrowdyJS 17, crowdy-dsh 0.3)

**A bound GitHub repository is the project's working tree; GitHub stays
optional.** Breaking, without a deprecation window: the GitHub surface was
nine days old and the deploy-input change is what makes "what compiles is
what was saved" true.

- **Optional, reversible.** `CrowdyStudioProject.source` is `STUDIO` until the
  owner binds a repository and `GITHUB` while one is bound;
  `crowdyStudioProjectCreate` is unchanged. `crowdyStudioGitHubBind` gains a
  required `initial` — `PUSH_PROJECT` commits the project into the branch
  (`GITHUB_REPO_HAS_FILES` if it already has rust under the layout roots),
  `TAKE_REPOSITORY` adopts the branch (`GITHUB_REPO_EMPTY` if it has none).
  Unbind keeps the files.
- **While bound, `files` is the server's mirror** of the rust under the layout
  roots at `githubSha`, read as before. `crowdyStudioProjectSaveFiles`,
  `crowdyStudioProjectSave` with file bodies and
  `crowdyStudioProjectImportFile` refuse with `GITHUB_BOUND_USE_CONTENTS`;
  writes are `crowdyStudioGitHubPutFile` / new `crowdyStudioGitHubDeleteFile`
  commits carrying `expectedCommitSha` (stale → `GITHUB_STALE_SHA`; the blob
  `sha` is now optional). New `crowdyStudioGitHubRefresh` brings the mirror to
  the branch head; new `crowdyStudioGitHubLayout` resolves `crowdy.json`
  server-side (clients must not parse it). `crowdyStudioGitHubTree` returns
  `{ commitSha, entries }`; `Tree` / `File` / `Layout` take an optional full
  40-hex `commitSha`.
- **Removed:** `crowdyStudioGitHubSetAutosave` and
  `CrowdyStudioGitHubStatus.autosave`; `DeployPlayerComputeInput.sourceFilesJson`,
  `sdkVersion`, `abiVersion`. **`playerComputeDeploy` now takes `projectId`**
  (+ `commitSha` for a `GITHUB` project) and the server resolves the source;
  `PlayerWasmModuleVersion` gains `projectId`, `sourceRevision`,
  `githubCommitSha`. The org compute API (`computeDeployVersion`) is unchanged.
- **Tokens:** the app token may call Status / Layout / Tree / File / PutFile /
  DeleteFile / Refresh (owner-scoped); ConnectUrl / Repos / Bind / Unbind need
  the identity session. A game never needs an identity session for GitHub.
  Every GitHub field is datacenter-only.
- **CrowdyJS 17.0.0:** `saveProject` commits a bound project automatically
  (one commit per changed file); `bind(…, initial)`, `refresh()`, `layout()`,
  `deleteFile()`, the `github` embed option; `pushToGitHub`, `pullFromGitHub`,
  `setAutosave`, the Push / Pull buttons and the SDK-side `crowdy.json`
  helpers are gone. Bridge protocol v3; `@crowdedkingdoms/crowdy-dsh` 0.3.x
  writes a bound project the same way.
- See [Connect your GitHub repo to a Studio project](/game-api/crowdy-studio-github)
  and [Player code](/exec/from-the-legacy-engines#player-code).

## 2026-09-11 (Game API, CrowdyJS 16, CrowdyCPP 0.34)

**The Crowdy Agent orchestrator is replaced by the in-browser DeepSeek Harness
and a metered model endpoint.** Breaking, without a deprecation window: the
orchestrator was allowlisted development that no released game depended on
except through CrowdyJS 15's agent dock, which is retired with it.

- **Removed from the Game API (21 root fields):** queries
  `crowdyStudioAgentSession`, `crowdyStudioAgentSessions`,
  `crowdyStudioAgentHistory`, `crowdyStudioAgentToolDescriptors`,
  `crowdyStudioAgentBudget`; mutations `crowdyStudioAgentCreateSession`,
  `...AttachClient`, `...SetMode`, `...AcknowledgeEvents`, `...Heartbeat`,
  `...SendMessage`, `...ApproveTool`, `...RejectTool`, `...ToolResult`,
  `...GrantLease`, `...RevokeLease`, `...Pause`, `...Resume`, `...CancelRun`,
  `...CloseSession`; subscription `crowdyStudioAgentEvents`. The six tables
  behind them are dropped. A CrowdyJS 15.x client loses its agent dock when
  this deploys.
- **Added:** REST `GET /v1/model/models` and `POST /v1/model/chat/completions`
  (OpenAI-compatible, app-token bearer, ZDR routing, per-request reservation
  and settlement at the app's rate card); GraphQL
  `crowdyStudioProviderConsent`, `crowdyStudioSetProviderConsent`,
  `crowdyStudioModelUsage`; `SetCrowdyStudioAgentAppPolicyInput.funding`
  with `payerKind: PLAYER | ORG` (default `PLAYER`; `ORG` needs
  `manage_billing`); the `player_model_microusd` metric in hourly player
  billing and `AGENT_FUNDS_NEEDED` (HTTP 402). See
  [Agentic Crowdy Studio and the model endpoint](/game-api/agentic-crowdy-studio).
- **CrowdyJS 16.0.0:** `dsh` mount option and `@crowdedkingdoms/crowdyjs/crowdy-dsh`
  replace the `agent` option, `client.crowdyStudioAgent`, `/crowdy-agent`,
  `PlayerControlGate`, `AgentControlBanner` and the lease manager. Games ship
  the harness from the published `@crowdedkingdoms/crowdy-dsh` package under
  `/dsh/` of their origin. See [Agentic Crowdy Studio](/crowdyjs/agentic-crowdy-studio).
- **CrowdyCPP 0.34.0:** `crowdy/agent/*`, the Studio host adapter, agent
  projection, lease manager and control gate are removed;
  `CrowdyStudioAgentAPI` keeps policy/usage and gains consent and model usage.
- **Management UI:** the app's Agent policy panel gains "Who pays for model
  usage" (player wallet by default; org wallet for billing admins) and a
  usage table with the payer.
- **Rollout order:** ck-api first (this removes the 15.x dock on that tier),
  then CrowdyJS `16.0.0-<tier>.N`, then `@crowdedkingdoms/crowdy-dsh`, then the
  games' pins. Schema contraction (the six tables) is a separate
  `--allow-contract` order after the ck-api deploy.

## 2026-09-10 (Game API)

**Cookie CSRF matches any presented `ck_csrf`.** (ck-api v1.98.0, Studio
v1.23.0)

- Prod's `.crowdedkingdoms.com` Domain leftover plus the tier cookie no longer
  fails hosted `/authorize` with `CSRF_MISMATCH`. The guard accepts a header
  that matches any `ck_csrf` on the Cookie header. Studio last-wins and
  prefers this tier's API-host Domain.
- **Action:** none for SDK / game clients (Bearer skips CSRF). Do not ask us
  to narrow the prod cookie Domain — public `studio.crowdedkingdoms.com`
  needs it.

## 2026-09-09 (Game API)

**Studio session moves to an HttpOnly cookie + CSRF.** (ck-api v1.92.1, Studio
v1.21.0)

- Sign-in still returns `AuthResponse.token` for native clients, CrowdyJS,
  Construct, and scripts. Those keep `Authorization: Bearer` and skip CSRF.
- Studio no longer writes `localStorage.auth_token`. ck-api sets `ck_session`
  (HttpOnly; Secure; SameSite=Lax) and readable `ck_csrf`. Subsequent Studio
  GraphQL calls send credentials plus `X-CSRF-Token`.
- Cookie auth from a non-first-party `Origin` is
  `COOKIE_AUTH_ORIGIN_REFUSED`. Missing or mismatched CSRF is `CSRF_REQUIRED` /
  `CSRF_MISMATCH`. Customer origins still hold only app tokens from hosted
  `/authorize`.
- Prod cookie Domain is `.crowdedkingdoms.com` so public
  `studio.crowdedkingdoms.com` can send CSRF. `v1.92.0` derived
  `.prod.crowdedkingdoms.com` from the labelled `FRONTEND_URL` and public
  Studio never received `ck_csrf`.
- **Action:** none for SDK / game clients. Studio users sign in again if an
  old `localStorage` bearer has expired; leftover bearers keep working until
  then.

**Idempotent replay keeps ISO timestamps; `voxelState` is optional.** (ck-api
v1.91.0, CrowdyJS 15.8.0)

- Nest's default DateTime scalar serialized a replayed ISO string as `null`,
  which 500'd `grantAppAccess` (and any other `@Idempotent()` Date field) on
  retry. The registered `DateTime` scalar accepts the string.
- `VoxelUpdateRequestInput.voxelState` is optional. CrowdyJS `setVoxel` omits
  the field when there is no state.
- CrowdyCPP **0.31.0** adds `refreshAsync(ip4, port)` so an async gameplay
  token rotation can name the current Buddy (the sync overloads already could).

## 2026-09-08 (Game API)

**Invoke policies now apply to app admins. `bypassPolicy` is the explicit, audited
override.** (ck-api v1.89.0)

- Until now a caller holding `manage_apps` skipped every Game Model invoke policy
  implicitly, with nothing on the result to say so. A developer testing their own
  game with their own account therefore saw policies that appeared unenforced. From
  v1.89.0 an admin's `gameModelInvoke` is judged exactly like a player's.
- `InvokeFunctionInput.bypassPolicy: Boolean` (default `false`) skips the policy for
  one call. Honoured only with `manage_apps` (`NOT_ALLOWED` otherwise); the result
  carries `GmInvokeResult.policyBypassed: true` and the call is audit-logged.
- A stored `condition` leaf with no compiled `ast` now refuses rather than throws.
- Clarified in [Game models](/exec/from-the-legacy-engines#running-your-logic):
  `gameModelFunctions` strips the compiled `ast` from `invokePolicyJson` on read-back,
  and `self.owner_user_id` in a condition is a declared property, never the row owner
  (`$self_owner_id` / `owner_of_self`).
- **Action:** GM tooling that ran with an admin account and depended on the skip must
  add `bypassPolicy: true`. Nothing else changes.

## 2026-09-08

**Hosted sign-in: a browser game on its own domain signs players in through Studio.
Direct sign-in is first-party only. No deprecation window.**

- **Breaking, and deliberately without a window** (the platform has no third-party
  customers in production yet). Every direct sign-in mutation on the Management API --
  `login`, `register`, `requestLoginLink`, `completeLoginLink`, `socialLoginStart`,
  `socialLoginComplete`, `checkAuthMethod`, `requestPasswordReset`, `resetPassword`,
  `confirmEmail`, `resendConfirmationEmail`, and the `/auth/*` REST twins -- is served
  only to **first-party browser origins** (Crowded Kingdoms Studio, crowdy.games) and
  to **non-browser callers** (no `Origin` header: Node, CLIs, Unreal/Unity, CrowdyCPP).
  From any other browser origin the answer is `extensions.code`
  **`HOSTED_SIGN_IN_REQUIRED`** (403). ck-api `v1.88.0`.
- **What to do instead:** send the player to Studio's hosted sign-in page
  (`https://studio.<tier>.crowdedkingdoms.com/authorize`) with a PKCE challenge and
  exchange the code they return with for an **app-scoped token**
  (`exchangePortalCode`, unchanged and public). In **CrowdyJS 15.6.0** that is
  `client.portal.signIn({ appId, redirectUri })` and
  `client.portal.handleSignInCallback()`; `isHostedSignInRequiredError` recognises
  the refusal. Your origin must be one of the app's **redirect URIs** (Studio > Apps >
  Settings > Sign-in & redirect URIs). Why: a page on a customer's domain that
  collects a Crowded Kingdoms password is indistinguishable from a phishing page.
  [Sign in](/management-api/authentication) ·
  [Portals & app-scoped tokens](/management-api/portals-and-app-tokens#hosted-sign-in-for-a-game-on-its-own-domain).
- **CORS follows the same registry.** The API accepts browser requests from
  first-party origins and from every origin in some app's redirect URIs -- read live,
  honoured within ten seconds of a save, no restart. Anything else gets no CORS
  headers. Until now the API reflected any origin.
- **Sessions are revoked on recovery.** `resetPassword` deletes every session of the
  account (and every app token minted from one); `changePassword` deletes every
  session but the calling one. Both used to leave them alone.
- **Rate limits** on every public sign-in mutation, per address and per client;
  `login` counts failures per address (ten in fifteen minutes answers
  `RATE_LIMITED`). Masked mutations stay masked when limited.
- **GraphQL introspection is off on every tier.** The SDL is published
  [here](/management-api/reference/graphql-overview) and ships in CrowdyJS. Queries
  deeper than 12 levels or wider than 2,000 fields are refused at validation.
- **The Construct 0.3.0** follows: hosted sign-in, and Setup runs from `npm run setup`
  (it needs a session the browser no longer holds). **Crowdy-Games**: every game's
  authorize URL is Studio's; the Overworld's `authorize.html` forwards there.

## 2026-09-07

**The Construct — the public starter repository; `simple-web-demo` retired**

- [`CrowdedKingdoms/the-construct`](https://github.com/CrowdedKingdoms/the-construct) is
  the public starter for browser games on Crowded Kingdoms and the
  [build-a-game](/build-a-game/intro) tutorial's companion: an engine-agnostic platform
  layer over CrowdyJS 15.4 (two tokens, datacenter routing, token rotation, World Stores),
  a three.js hub and a pixi.js paint program driven by one session, a kit-seeded game
  model, Crowdy Studio embedded with **SERVER and CLIENT** mods, and a Setup that
  creates your organization and app with no card (from inside the game until
  [2026-09-08](#2026-09-08); from `npm run setup` since). MIT; a GitHub
  template repository; clone `prod`.
- The `simple-web-demo` repository (June 2026; a `file:` SDK dependency and the retired
  per-developer environment handles) is removed. Nothing it demonstrated is lost: every
  chapter of the tutorial still stands alone, and The Construct's `PaintScene` is the same
  shared canvas built with World Stores.
- [Embed Crowdy Studio](/crowdyjs/crowdy-studio-embed) no longer tells new games to start
  SERVER-only; it describes both postures and points at The Construct for the full one.
- [Create your first app](/management-ui/create-your-first-app) now matches the live
  wizard: App (with datacenter) → Review, no billing step; the free allowance is monthly.

## 2026-09-06

**ck-api v1.85.0 — the card is bytes, CPU-hours and storage; usage is charged as it arrives; the development quota is monthly**

One pricing change, one cadence change, and the counts are gone.

- **Six count dimensions are retired**: `replication_recv_msgs`,
  `replication_send_msgs`, `graphql_recv_ops`, `udp_notifications`,
  `wasm_egress_msgs` (shared card) and `player_egress_msgs` (player card). A
  datagram, an API operation or a notification is paid for by the bytes it moves
  and the CPU it takes — both of which were already priced — so a count was the
  same action billed twice. Their rate and allowance rows are deleted on every
  tier; `setBillingRate` refuses the names; the counts are still recorded and
  shown in `appUsageSummary`. Every operation a client can call is now audited
  against the card in `docs/billing-coverage.md` (ck-api repo).
- **Every dimension is charged as the usage arrives.** Until now bytes were billed
  within a minute (monthly aggregate, rounded up once, debited as each cent was
  crossed) while every other dimension waited 60–75 minutes for the hour to close
  and settle. Now every dimension takes the byte path. The hourly rows in
  `appSharedUsageCharges` continue, as a **statement**: `amountCents` is what was
  debited during that hour and `walletTransactionId` is null (the debits have
  their own `shared_usage` transactions); `usageSnapshot._pricing.mode` is
  `"statement"` on rows written under the new rule.
- **The free tier is a monthly development quota.** Per app per UTC calendar
  month: 5 GB egress, 5 GB ingress, **20 CPU-hours pooled** across GraphQL
  resolvers, automations and compute modules (`compute_cpu_ms` on the card), and
  1 GB-month of stored data. Compute-module writes carry no allowance. The hourly
  allowances are gone.
- **Rate card fields.** `RateCardEntry` / `PublicRateCardEntry` gain `freeUnits`
  and `freePeriod` (`HOUR | DAY | MONTH`); `freePerHour` is now null for any
  allowance that is not hourly, and `freePerMonth` is the monthly-allowances table
  (the byte aggregates and the player trial) as before. `SetBillingRateInput`
  gains `freeUnits` and `freePeriod`; `freePerHour` still works and means
  `freeUnits` with `freePeriod: HOUR`.
- Player billing is unchanged in cadence (per closed hour against the monthly
  trial pool); the retired `player_egress_msgs` is the only player-card change.

## 2026-09-01

**ck-api v1.73.0 — nothing runs for an app with no player in it; reservations split**

Three behaviour changes, one reprice, and the API Terms are published at last.

- **`alwaysOn` is retired and `computeUpsertModule` REFUSES `alwaysOn: true`.**
  `WasmModule.alwaysOn` is `@deprecated` and always `false`. A compute module now
  ticks only while its app has at least one player connected somewhere in the
  fleet, and stops when the last one leaves. This is a removal without a
  deprecation window on the INPUT side, because the alternative was to keep
  accepting a flag that no longer did anything: an app passing `true` would have
  believed its world was advancing while it was not. The `always_on_module_minutes`
  billing dimension is gone with it — it could only ever meter zero.

- **Scheduled work is presence-gated.** A `schedule` automation that comes due
  while its app is empty is **skipped** and rescheduled from the moment a player
  returns; the missed runs are **never made up**. Timers **wait** and fire late
  rather than firing into an empty world. `event` and `manual` triggers, and
  synchronous `computeInvoke`, are unaffected.

  **Write for it.** Advance the world by `now - lastRun` rather than one step per
  run, and store expiries as timestamps rather than remaining-tick counters. An
  automation that assumes a cadence will silently fall behind whenever nobody is
  playing. See [Presence](/exec/from-the-legacy-engines#timers-and-triggers).

- **Reservations split into two dimensions and mean something different.**
  `App.reservedEgressBytesPerSec` is `@deprecated` in favour of
  `App.reservedUdpBytesPerSec`, joined by a new `App.reservedGraphqlOpsPerSec`
  (GraphQL operations/sec). Reserving one does not reserve the other.

  A reservation is now a **capacity floor**: it obliges CK to provision and hold
  that much for you. It is **not a ceiling** (use above it is metered, not
  refused), **not a data allowance** (the fee buys capacity, not volume, and is
  charged in addition to metered usage — reserving 5 MB/s does not make the first
  5 MB/s free), and **not how the free-tier cap is lifted**. Funding the org
  wallet or enabling auto-billing lifts the ~1 MB/s shaping; before today a
  reservation doubled as that bypass. See
  [Reserved capacity](/management-api/shared-environment#reserved-capacity).

- **Egress repriced to 19c.** Byte dimensions moved from 15c to 19c per GiB, and
  `aggregate_data_volume` is 19c per decimal GB. The free tier is unchanged at
  5 decimal GB of client egress per app per calendar month.

- **The measurement basis is stated.** Volume is **egress only**, measured as
  wire bytes at the network interface — including the transport and network
  headers each frame carries — and counted after any compression the service
  applies. **Ingress is metered but does not count** toward Aggregate Data Volume.
  A client-side byte counter will not match your bill.

- **The API Terms of Service and Rate Card are now published.** Previously they
  existed but were not reachable:
  [API Terms of Service](https://crowdedkingdoms.com/api-terms.html),
  [Free Tier and Billing Basis](https://crowdedkingdoms.com/billing-basis.html),
  [SDK Developer Terms](https://crowdedkingdoms.com/sdk-terms.html).

- **SDKs.** CrowdyJS **15.4.0** drops `alwaysOn` from the module fragment, adds
  `sharedEnvironment.setReservedThroughput()`, and reads both reservation
  dimensions. CrowdyCPP **0.29.0** does the same and documents that
  `Connection::Stats` byte counters are a local diagnostic that will not
  reconcile against a bill. Both previously told developers to set `alwaysOn` for
  modules that must run without connected players.

## 2026-08-28

**ck-api v1.67.0 — a notification aimed at another app's channel is now caught**

- **`channel_name`, and why you should switch to it.** A
  [channel notification](/exec/from-the-legacy-engines#realtime) now takes `payload`
  plus **exactly one of** `channel_id` or `channel_name`. A name is resolved on every
  invocation against the app the function is running in; an id is resolved once, when
  you wrote it. That matters because channel membership is scoped to the app, so a
  function naming a channel that belongs to a **different** app produces a
  notification that is built, sent to every server, and dropped for want of a
  recipient — while your invoke succeeds and the run records success, because
  emission is best-effort and never fails your function. The only symptom is silence.
  This is what an app **recreated or moved between organizations** leaves behind when
  its model is copied with an id in it. Your client was never affected: it joins
  `__crowdy_session_<appId>` by name and follows the app it is connected to. This
  gives the server the same property. Existing `channel_id` notifications keep
  working unchanged.
- **Two new system params**, `$app_id` and `$session_channel_name`, so a model never
  has to write down which app it belongs to.
- **Two new lint codes** on
  [`gameModelLint`](/exec/from-the-legacy-engines#running-your-logic):
  `notification_channel_foreign` (error — the channel belongs to another app) and
  `notification_channel_unknown` (warning — no such channel here). Only literal ids
  and names can be checked; a computed one cannot, which is a further reason to
  prefer a name.
- **You can now see it happening.** `gameModelAppDiagnostics` gains
  `notificationsEmitted24h` and `notificationsUndeliverable24h`; a non-zero
  undeliverable count beside a healthy run history is this bug. The offending
  function is named by a new `NOTIFICATION_UNDELIVERABLE` entry in `userCodeFaults`.
  Note this is not "delivery is broken" — it counts datagrams that were delivered to
  every server successfully and had no recipient.

## 2026-08-22

**ck-api v1.61.0 → v1.63.0 — a completed purchase is now fulfilled**

All three releases are on dev, test and production (`prod/v1.63.0`).

- **Purchases were being charged and not fulfilled.** A payment provider tells us a
  session completed by calling a webhook, and that callback was the half that was
  broken: the URL each provider held named a host that had been decommissioned, on
  every tier. The hosted checkout worked, the card was charged and the money moved —
  and nothing on our side ever heard about it, so no entitlement was granted and no
  checkout reached `completed`. If you have a customer whose payment succeeded and
  whose entitlement never arrived, that is this, and it is fixed.
- **PayPal webhook signatures are verified against PayPal's published certificate**
  rather than only through the provider's verification endpoint (v1.61.0). Both
  verdicts must agree, so a forged callback is rejected even if one path is
  unavailable.
- **A webhook naming a checkout we no longer hold is recorded instead of dropped**
  (v1.62.0). It previously failed to insert and was retried forever.
- **Stripe's `Invoice.subscription` moved in their Basil API version** and we were
  reading the old location, so subscription-lifecycle events were delivered,
  verified, recorded — and inert (v1.63.0). Renewals and cancellations act again.

Nothing about the request you make changed: no field was added, removed or renamed
by any of the three. This is behaviour a client cannot see and can only be told
about.

## 2026-08-21

**ck-api v1.60.0 + CrowdyJS 15.1.0 — error codes are correct, and a passwordless account can add a password**

Two changes an integrator has to act on, both live on dev, test and production.

- **`extensions.code` is now correct for roughly 155 refusals.** Until v1.60.0 only
  four HTTP statuses reached you as a distinct code (400, 401, 403, 422); everything
  else — every `NOT_FOUND`, every `CONFLICT` — arrived as `INTERNAL_SERVER_ERROR` with
  the real status in `extensions.httpStatus`. If you branched on `httpStatus` you are
  unaffected. If you branched on `code`, re-read
  **[Error codes](/overview/error-codes)** before your next release.
- **`Throws CONFLICT` no longer appears in any mutation description.** Where a refusal
  stopped carrying that code, the description stopped claiming it.
- **New: `setInitialPassword(newPassword)`.** A signed-in user whose account has no
  password — one created by magic link or a social provider — can add one from the
  session alone. `changePassword` still requires the current password and now refuses
  such an account with `PASSWORD_NOT_SET` instead of `UNAUTHENTICATED`.
- **Four new codes**, all of which mean the session is fine and the user should *not*
  be signed out: `PASSWORD_ALREADY_SET`, `PASSWORD_NOT_SET`, `INVALID_CURRENT_PASSWORD`,
  `EMAIL_ALREADY_REGISTERED`. The first three previously arrived as `UNAUTHENTICATED`,
  which is also what an expired session looks like — so a client that signs the user out
  on `UNAUTHENTICATED` was signing them out for mistyping a password.
- **CrowdyJS 15.1.0** wraps all four password mutations (`auth.setInitialPassword`,
  `auth.changePassword`, `auth.requestPasswordReset`, `auth.resetPassword`) and adds
  three error-code predicates. Games pin the SDK exactly; there is no caret to carry
  you onto it.

See **[Sign in](/management-api/authentication)** and
**[Error codes](/overview/error-codes)**.

## 2026-08-20 (email)

**ck-api v1.53.0 — transactional email is actually sent**

- **Magic links, email confirmations and password resets now arrive.** Sending was
  switched off on every tier before this release, so every flow that depends on the
  player reading an email could be started and never completed. They are sent from
  `noreply@crowdedkingdomstudios.com` on dev, test and production.
- **This is what makes the bypass removal below survivable**, and the order matters:
  an account the bypass created has no password, and a magic link is the way back
  into it.
- **A hard bounce or a spam complaint suppresses an address**, and a later successful
  delivery clears only a *transient* bounce. If a player reports never receiving
  anything, a bad address earlier in that address's history is the first thing to
  check rather than the last.
- No schema change: no field was added, removed or renamed.

## 2026-08-20

**BREAKING — the dev sign-in bypass is gone from every tier**

- **`devLogin` is deleted**, and so is the **`devToken`** field on `requestLoginLink`.
  Neither exists on dev, test or production; there is no environment in which
  authentication is weaker than production. `devLogin` returned a session for any
  address with no proof of ownership, and `devToken` put the emailed one-time token in
  the response body.
- **Use `login` / `register` instead.** Email + password has existed throughout and is
  a first-class permanent method, not a fallback: any page that described this platform
  as passwordless was wrong.
- SDK wrappers were removed in **CrowdyJS 15.0.0** and **CrowdyCPP 0.26.0**. The Unreal
  SDK's `DevLogin` entry point and its **Dev Login** Blueprint node have nothing to call
  in any build that still ships them.
- An account the bypass created has **no password**, so the bypass going away removes
  the only way it was ever signed into. Sign in with a magic link to that address, then
  `setInitialPassword` (above) to attach one.

## 2026-08-18

**BEHAVIOUR CHANGE — a player's free usage is a monthly trial, not an hourly allowance**

- **There is no hourly free allowance for a player any more.** It is zero. In its place
  each **(player, app)** pair gets a pooled **monthly trial** — 250,000 compute units
  by default — after which usage is charged to the player's wallet. An hourly figure
  made a small mod permanently free, which is not what a trial is for; a monthly pool
  is spendable in one afternoon or across a month, and it is the same total either way.
- **Read the allowance rather than assuming it.** `billingRateCard(scope:)` carries the
  per-metric free monthly and free hourly figures alongside the price. A tier's card is
  data an operator can correct, so a figure quoted in a client is a figure that will be
  wrong.
- **Read the unit as well as the price.** A rate is a price *and* a unit
  (`unitLabel` / `unitQuantity`), and they are one number: `20c per GiB-month` and
  `20c per 100 MB-hour` are the same price and differ by four orders of magnitude in
  what they cost. ck-api v1.50.0 made a rate correction move both together.
- **Sub-cent usage no longer rounds up per metric.** It carries in whole micro-cents
  and rounds once across all metrics at the end of the hour. Without that, zero hourly
  free would have put a floor of roughly 60c–$1.20 a month on a player who does almost
  nothing.
- **A developer's markup is paid into the org wallet in the same transaction as the
  player debit** (ledger entry type `markup_payout`), instead of accruing to a balance
  nothing ever paid out from.
- The **org**'s own shared free allowance is a separate figure and is still hourly.
  Nothing above changes it.

## 2026-07-27

**BREAKING — one API origin, and customer-provisioned environments are retired**

> **Draft — the wording of this entry is under review.** It records a change that
> reached customers on 2026-07-27 and was never written down here, which is why an
> integrator could still find a five-step provisioning recipe in these docs a month
> later.

- **The Management API and the Game API are two surfaces of one origin**, and one
  server answers both. The separate management service was absorbed on 2026-07-27 and
  its repository archived. `management-api.graphql` is now that unified SDL — it is the
  same schema `game-api.graphql` describes, published under both names because the
  guides are split that way. Base URLs are per **tier**, never per organization.
- **The customer-provisioned environment surface is gone from the published SDL**:
  `environmentDatacenters`, `environmentFlavors`, `environmentQuote`,
  `createEnvironment`, `orgEnvironment`, `linkAppToEnvironment`,
  `redeployEnvironment` and `environmentRedeployPlan`. Both classes went with it — the
  multi-VM **dedicated** stack and the single-VM **developer sandbox**
  (`environmentClass: "dev_single"`). They were **retired without replacement in that
  form**; there is no per-tenant stack to provision and no API for one.
- **What to use instead: `publishAppToShared`.** Every app runs on the tier's shared
  platform, scoped by its `appId`. It has been in the published SDL since this
  changelog began, so this is a surface being removed rather than a capability
  arriving: publishing is free under your org's app-slot quota
  (`platformConfig.freeAppsPerOrg`, default 3) and metered against the org wallet
  beyond it. Read the app's `gameApiUrl` / `deploymentTarget` before a player joins,
  and discover the tier's origin from `platformConfig.sharedGameApiUrl` rather than
  hard-coding it. See **[Shared environment & billing](/management-api/shared-environment)**.
- **This is not a deprecation window.** The fields are absent, so a call naming one
  fails to validate against the schema rather than returning a deprecation warning. If
  you built against them, `publishAppToShared` plus the app's routing fields is the
  whole migration — there is no per-component flavor, scaling bound or datacenter
  choice to carry across, because there is no stack to size.
- Customer-provisioned environments stay retired; every app uses the shared
  platform (`publishAppToShared`). Contact Crowded Kingdoms if you need
  enterprise isolation.

## 2026-07-24

**Game API v0.21.0 + CrowdyJS 12.2.0 + CrowdyCPP 0.15.0 — app-scoped active player-count events (additive)**

- New `gameModelActivePlayerCount(appId)` snapshot returns the best-known
  app-wide gameplay-session count plus `status` (`FRESH` / `PARTIAL` /
  `UNAVAILABLE`), nullable `observedAt`, and `revision`. Only `FRESH` is
  authoritative; missing telemetry is never silently reported as an
  authoritative zero. Requests require a bearer app-scoped token matching
  `appId`.
- New best-effort, post-observation
  `gameModelActivePlayerCountChanged(appId)` subscription publishes
  `previousCount`, `currentCount`, `delta`, `revision`, and `observedAt`.
  Consumers deduplicate by revision and re-query the snapshot on startup,
  reconnect, or a revision gap.
- The gauge counts active app-scoped gameplay sessions, not distinct users,
  actors, game-model sessions, or per-server load. Explicit disconnect or
  deauthorization, token expiry, and inactivity expiry remove a session;
  abandoned sessions can linger for roughly 120 seconds plus observation
  latency, and brief reconnect overlap can transiently count twice.
- Automations can use
  `gameModelUpsertAutomationTrigger(onEvent: "player_count_changed")`.
  Runs receive `previous_player_count`, `current_player_count`,
  `player_count_delta`, and `player_count_revision`; event values override
  same-named static params. `debounceMs` uses trailing-edge coalescing, while
  model-event filters are invalid. Existing autonomous-function guards,
  budgets, circuit breakers, and metering still apply.
- CrowdyJS exposes `client.gameModel.activePlayerCount(appId)` and
  `client.gameModel.activePlayerCountChanged({ appId }, handlers)`.
- CrowdyCPP exposes typed `gameModel().activePlayerCount(appId)` sync/async
  reads and `gameModel().activePlayerCountChanged(appId, callbacks)` over its
  GraphQL subscription client.

See [Game Models → Active player count](/exec/from-the-legacy-engines#calling-it-from-clients)
and [Autonomous processes → Player-count changes](/exec/from-the-legacy-engines#timers-and-triggers).

## 2026-07-24

**Game API `v0.20.0` — ensured containers and `$self_container_id`**

Additive Game API release for game-model developers:

- New **`gameModelEnsureContainer`** mutation: an atomic get-or-create for
  game model containers keyed by an opaque, caller-chosen **`bindingKey`**
  (scoped to app + type + session). N concurrent callers converge on one
  container without client-side leader election. Returns the container plus a
  `created` flag; creation-only inputs (`displayName`, `properties`, …) are
  ignored when the container already exists. See
  [Ensured containers](/exec/from-the-legacy-engines#state).
- `GmContainer` exposes the new nullable **`bindingKey`** field, and
  `gameModelContainers` accepts a `bindingKey` filter.
- New **`$self_container_id`** system parameter available in model function
  bodies, policy `condition` expressions, and notification `args`
  expressions — it names the container the expression runs against and cannot
  be spoofed by caller-supplied params. See
  [Model-driven notifications](/exec/from-the-legacy-engines#realtime).

Schema change is additive only (nullable column + partial unique index); no
realtime wire or Replication API impact.

## 2026-07-24

**Agentic Crowdy Studio — historical development rollout (superseded)**

> **Historical.** The version numbers in this entry describe the July 2026
> development train. They are **not** the live stack. Current CrowdyJS:
> `npm view @crowdedkingdoms/crowdyjs dist-tags`.

The coordinated development stack at that time was: environment release
**`v0.1.94`** with Game API **`v0.19.16`**, Management API
**`v0.1.193-dev`**, CrowdyJS **`12.0.0`**, the matching Blocks with Friends
bundle, and these public docs. It was a **development** rollout—not
production or general availability—and did not authorize unattended
real-money activity.

- OpenRouter now uses the stable streaming
  **`/api/v1/chat/completions`** transport, not the Responses beta. Requests
  enforce `require_parameters`, ZDR, `data_collection: "deny"`, no plugins, and
  no unsafe fallback. Multi-tool provider rounds are rejected or serialized
  locally; every tool name, input, and output remains strictly validated
  against the local pinned descriptor.
- The allowlisted development model is **`openai/gpt-oss-120b`** because its
  tool endpoint supports ZDR. Model, request/token/cost caps, and usage remain
  platform allowlisted and funded. The provider key remains encrypted and
  server-only.
- Sanitized live evidence passed Ask's expected exact response; Build
  `workspace.file.read`; checkpointed `workspace.file.patch` with a source
  revision advance; and an agent-edited draft compile after ordinary platform
  ABI boilerplate was added.
- Play completed a bounded `game.observe` dispatch/result and dispatched
  `game.control.move`. Human input then revoked the lease and preempted the run;
  a late success from the old context was rejected with
  `AGENT_CONTEXT_STALE`.
- The deployed BWF bundle, visible takeover banner, and offline/local Stop
  browser gates passed.
- **Stabilization train (historical):** `v0.1.94` was the final tracked
  environment manifest for that July 2026 train. Intermediary direct-ingest
  manifests used during stabilization were backfilled into release history and
  are not separate supported targets. **Do not redeploy from this entry** —
  use `deployed-versions.sh` for what is live.

The public record deliberately excludes account identifiers, session/tool IDs,
credentials, content hashes, secret values, and provider bodies.

## 2026-07-23

**Development preview — Agentic Crowdy Studio (CrowdyJS 12, Game API,
Management API, Blocks with Friends)**

This coordinated contract is implemented on development branches and reflected
in the downloadable development schemas. It is **not a production deployment or
general-availability announcement**. The feature remains disabled/killed by
default, and this preview does **not** authorize production, unattended
real-money activity, wallet actions, or broad autonomous gameplay.

- **CrowdyJS 12 (breaking greenfield agent contract):** adds
  `@crowdedkingdoms/crowdyjs/agent` and `/player-host`, while
  `/crowdy-studio` gains the integrated Ask/Build/Play dock.
  `client.crowdyStudioAgent` is the typed app-token Game API transport for
  durable replay/ack, epochs, exact approvals, leases, heartbeat, tool results,
  and reconnect. The immutable `crowdy.agent-tools/1` registry, execute-once
  browser dispatcher, checkpoint-aware project controller, and
  `crowdy.player-host/1` contracts contain no provider key, raw GraphQL
  executor, DOM driver, shell, fetch, UDP escape hatch, or client-mod bridge.
  Existing manual Studio mounts remain unchanged when `agent` is omitted.
- **Game API Agent GraphQL:** adds five owner/app queries, 15 idempotent control
  mutations, and the ordered `crowdyStudioAgentEvents` subscription under the
  `crowdyStudioAgent*` prefix. Durable sessions/runs/events/tool calls,
  approvals, workspace/Play leases, checkpoints, budgets/usage, client epochs,
  provider orchestration, policy freshness, and stable `AGENT_*` errors live in
  the Game API. The pilot registry advertises only implemented,
  policy/mode/host-filtered tools and separately requires
  `use_studio_agent`; live deploy, destructive, trust, economic, and
  irreversible work remains exact-human-approval gated.
- **Management policy GraphQL and S2S:** adds app reads
  `crowdyStudioAgentPolicy`, `crowdyStudioAgentEffectivePolicy`,
  `crowdyStudioAgentUsage`, app mutation `setCrowdyStudioAgentPolicy`, and
  operator `cpCrowdyStudioAgentPlatformPolicy`,
  `cpSetCrowdyStudioAgentPlatformPolicy`, and
  `cpSetCrowdyStudioAgentAppKill`. Platform/app model, tool, mode, risk,
  budget, privacy, retention, and kill layers publish the nested
  `crowdy.studio-agent-policy/1` replica contract; sanitized terminal usage
  returns through `crowdy.studio-agent-usage/1`. Missing/stale policy fails
  closed. `use_studio_agent` is app-only, separately grantable, and not in the
  default tier. The pilot is platform-funded and never debits a player wallet.
- **Blocks with Friends host:** adds a bounded `BwfPlayerHostAdapter`,
  observation builder, exact generic command router over the same typed intent
  services used by humans, synchronous input/death/offline takeover, and an
  accessible external lease/Pause/Stop banner. Observations expire and are
  bounded; commands bind observation/host/entity revisions. High-risk
  grid/trust/commerce and PvP actions remain unadvertised.
- Public guides now cover the
  [player/SDK flow](/crowdyjs/agentic-crowdy-studio),
  [game-host boundary](/game-api/agentic-crowdy-studio), and
  [Management app policy](/management-api/agentic-crowdy-studio-policy).

**CrowdyJS 11.1 + Blocks with Friends: resizable Crowdy Studio**

- Crowdy Studio now fills and observes its host element, relayouts Monaco when
  a split pane changes size, and responds to container width instead of the
  whole browser viewport.
- Blocks with Friends embeds it as a resizable right-hand desktop dock with a
  live game viewport, focus-scoped game/editor input, and a full-screen
  narrow-screen fallback.
- Source still autosaves independently from runtime. Creators explicitly choose
  **Test draft** or **Deploy live** before SERVER or CLIENT changes compile and
  apply; this release adds no auto-deploy and changes no GraphQL schema.

**CrowdyJS 11 + Game API: Crowdy Studio rename**

- New private Game API project storage separates autosaved SERVER/CLIENT
  source from immutable compile versions. Projects use optimistic revisions;
  personal-library files stay owner-only; studio common files are immutable
  and copy into projects by value.
- Final Game API roots are `crowdyStudioProjects`, `crowdyStudioProject`,
  `crowdyStudioProjectCreate`, atomic `crowdyStudioProjectSave`,
  `crowdyStudioProjectSaveMetadata`, `crowdyStudioProjectSaveFiles`,
  `crowdyStudioProjectSetArchived`, `crowdyStudioLibraryFiles`,
  `crowdyStudioLibrarySave`, `crowdyStudioLibrarySetArchived`,
  `crowdyStudioCommonFiles`, `crowdyStudioCommonPublish`,
  `crowdyStudioProjectImportFile`, and
  `crowdyStudioProjectCreateFromModules`. Project, library, common-file,
  input, and enum schema types now use `CrowdyStudio*`; the `playerCompute*`
  deployment/runtime surface is intentionally unchanged.
- CrowdyJS `11.0.0` exports `mountCrowdyStudio` and
  `CrowdyStudioController` from
  `@crowdedkingdoms/crowdyjs/crowdy-studio`; the project provider is
  `client.crowdyStudio`. Crowdy Studio adds cloud autosave/conflicts, project
  file CRUD, My Library/Common Files, target-aware Monaco/fallback editors,
  authoritative rustc markers, full-stack deploy/pairing, Runs/Logs/Invoke,
  wallet/quota status, and truthful server+client stop behavior.
- The v10 `mountModStudio`, `ModStudioController`,
  `client.playerCodeProjects`, `mod-studio` package subpath, and
  `playerCodeProject*` / `PlayerCodeProject*` GraphQL names are removed, not
  deprecated. That authoring surface was still greenfield, so there are no
  legacy aliases to preserve.
- Blocks with Friends embeds the accessible Crowdy Studio, passes authoritative
  grid bounds and target-specific permissions, and seeds its first-party
  entrypoints into the common-file catalog.

**CrowdyJS 9.0.0: browser-local Rust authoring**

- CrowdyJS `9.0.0` is published. Blocks with Friends dev and test use it and
  load the Rust analysis worker, parser/grammar WASM, and generated platform
  symbol index as same-origin browser assets.
- This breaking major removes `languageServiceUrl` and `appToken` from
  `MountLiveCodingIDEOptions`. Monaco instead talks to a lazily loaded browser
  module worker over local LSP/JSON-RPC messages. Parser/grammar WASM and the
  generated platform symbol index are packaged assets; there is no public
  authoring endpoint, authoring token, or server language-service fallback.
- Syntax diagnostics, completion, hover, symbols, and workspace
  navigation are advisory. The worker is not rustc or rust-analyzer and does
  not provide borrow checking, complete trait/procedural-macro/build-script
  semantics, or a full Cargo build. **Deploy** still uses the authoritative
  server-side compiler.
- This migration changes no GraphQL field, SDL, or replication wire format.
  Dev and test now return HTTP 410 for a WebSocket Upgrade to the retired
  `/authoring-lsp` route. No production deployment is claimed by this entry.

## 2026-07-22

**Durable environment deployment progress (Management API)**

- `cpChangeOrder`, `orgEnvironment.deployProgress`, and destroy progress can
  now return read-only projected task/step progress for durable change orders
  instead of empty arrays. Recorded execution progress remains authoritative
  when available.
- Planned work remains `pending` until an outcome is observed or inferred.
  Fields unavailable for projected progress remain null, and identifiers
  should be treated as opaque.
- For projected step progress, `attempt` is `0` when no attempt or outcome has
  been observed or inferred, and `1` when an attempt or outcome has been
  observed or inferred.

**Machine-readable Game API permission metadata**

- The refreshed downloadable Game API SDL now publishes
  `@requiresPermission` metadata on permission-gated root fields. This makes
  existing authorization requirements discoverable to tools and agents; it
  does not change runtime authorization behavior.

## 2026-07-20

**Terrain grounding for engine agents + `chunk_get` repair (game-api v0.14.5)**

- `chunk_get` now works (its SQL had referenced a nonexistent column since
  Phase 3, so every call errored) and returns the dense voxel grid as
  `stateBase64` plus the game's opaque metadata blob as `chunkStateBase64`.
- New `crowdy-game-kit-sim` `terrain::TerrainCache`: cached, per-tick
  budgeted ground sampling over dense chunks (`ground_y(x, z)` — the
  server-side equivalent of a client ground scan), fail-soft on unloaded
  chunks and non-voxel games.
- The `mob-engine` and `npc-engine` templates (and Blocks with Friends'
  `bwf-mobs`) now walk agents ON the terrain instead of approximating
  height from nearby players — the approximation floated/flew mobs whenever
  players jumped or flew, and NPC heights froze at their seeded values.

**Redeploy dry run: preview what a release will do before running it**

> **Retired 2026-07-27** along with the rest of the customer-provisioned environment
> surface. `environmentRedeployPlan` is not in the published SDL. See the
> [2026-07-27 entry](#2026-07-27).

- New Management API query `environmentRedeployPlan(input)` — the DRY RUN
  of `redeployEnvironment`. Same input, read-only: it resolves the same
  target version and returns per-component version diffs (game-api, Buddy,
  base images), whether game-DB schema DDL applies or is skipped
  (`schemaWillApply` + `schemaGitRef`), Buddy artifact resolution, the
  exact pipeline tasks/steps the change order would run (enumerated
  through the real planner), and `blockers` — everything that would make
  the real mutation fail (active change order, missing flavors,
  non-deployable version) reported instead of thrown. Requires
  `view_environments` (the mutation still requires `manage_environments`).
- SDK coverage: CrowdyJS **8.15** (`client.environments.redeployPlan(input)`)
  and CrowdyCPP **v0.11.0** (`admin_().redeployPlan(input)`).

**Complete flow timelines: demand-driven compute runs always record**

- `wasm_module_runs` now records every demand-driven run — `invoke` and
  `event` entries, success or failure, each carrying its `flowId` — in
  addition to the existing init rows, failures, and circuit probes. Flow
  timelines (`gameModelFlow`) therefore show the compute leg of a
  cross-engine chain instead of only its Model/Automation legs. Healthy
  high-frequency ticks still aggregate into per-minute usage rather than
  one row per tick.
- `computeAppDiagnostics` gains `toolchainRustVersion` /
  `toolchainWasmOptVersion`: the compile-toolchain fingerprint of the
  replica that served the query (null when the toolchain is not
  provisioned). Skewed replicas compile correct but non-shared artifacts,
  so surfacing the fingerprint makes fleet drift visible from the studio.
  CrowdyJS **8.14.1** / CrowdyCPP **v0.10.1** select the new fields.

**Operator-editable platform compute ceilings (Management API)**

- New operator-only Management API surface: query `cpComputePlatformCeilings`
  and mutation `cpSetComputePlatformCeilings` read and patch the nine
  platform ceilings the Game API's `computeSetPolicy` clamps per-app compute
  policies against (`maxModules`, `maxTickHz`, `fuelPerTick`,
  `fuelPerInvoke`, `maxMemoryMb`, `maxRunMs`, `maxDbOpsPerTick`,
  `maxEgressMsgsPerMin`, `maxEgressBytesPerMin`). Patch semantics: omitted =
  unchanged, explicit `null` = clear the override (env/default bootstrap
  values apply), value > 0 = set. Requires `is_operator`; changes are
  audited. Both fields went with the legacy engines: see [policy and
  ceilings](/exec/from-the-legacy-engines#operations).
- Ceiling edits replica-sync to every game-api and take effect in the
  `computeSetPolicy` clamp within ~30 seconds — no game-api restart. The
  `COMPUTE_PLATFORM_MAX_*` environment variables remain bootstrap defaults.
- Game API behavior change (non-breaking): the `computeSetPolicy` ceiling
  clamp now reflects operator-set values, so the ceiling named in the
  `... exceeds the platform ceiling (N)` error can change over time.
- SDK coverage: CrowdyJS **8.14** (`client.operator.computePlatformCeilings()`
  / `setComputePlatformCeilings(input)`) and CrowdyCPP **v0.10.0**
  (`operator_().computePlatformCeilings()` / `setComputePlatformCeilings`)
  wrap the two fields with the same patch semantics.

## 2026-07-19

**Flow-correlation query + SDK sweep (CrowdyJS 8.13 / CrowdyCPP 0.9)**

- New Game API query `gameModelFlow(appId, flowId)`: stitch one flow
  correlation id into a single cross-engine timeline — the `gameModelEvents`
  rows, `gameModelAutomationRuns` and `computeModuleRuns` sharing the
  `flowId` minted at the entry edge, each array ordered by time ascending. A
  diagnostics surface gated by app-admin `manage_apps`; see
  [Tracing a flow](/exec/from-the-legacy-engines#operations). Partial indexes
  back the `flow_id` lookups on all three tables.
- CrowdyJS **8.13** / CrowdyCPP **0.9**: the default event/run selections now
  include `flowId`, and `gameModel.flow({ appId, flowId })` /
  `gameModel().flow(appId, flowId)` fetch the stitched timeline (parity 0
  missing). Older servers reject the new field/operation with a validation
  error — everything else keeps working.
- Kit invoke helpers treat `computeInvoke`'s typed **contract violation**
  (`BAD_REQUEST` "Invoke params violate …") as a gameplay verdict: `kitInvoke`
  resolves `{ success: false, errorMessage }` and engine invokes resolve
  `{ success: false, reason }` instead of throwing (new `isKitVerdictError`
  predicate in CrowdyJS).

**Compute fleet hardening: revision-guarded state, flow correlation, shared artifacts, lane codegen**

- State-blob writes are revision-guarded: the tick-lease holder always wins
  and a non-lease instance's stale `state_set` is dropped with an observable
  module-log warning — keep referee-critical records in Model, not the blob
  (see the new state-contract warning in
  [Compute Modules](/exec/from-the-legacy-engines#running-your-logic)).
- New `flowId` on `gameModelEvents`, `gameModelAutomationRuns` and
  `computeModuleRuns`: one correlation id per entry call, carried across
  `model_invoke`, event triggers and `emit_event` cascades — cross-engine
  flows ("what happened to this kill's reward") are now stitchable.
- `wasm_module_artifacts`: modules compile once per fleet; replicas fetch
  bytes by cache key instead of recompiling, and instances log a toolchain
  fingerprint at boot (`COMPUTE_EXPECTED_RUST_VERSION` turns skew into a
  loud error).
- `crowdy-compute lanes`: declare a fixed-size actor-lane layout once
  (JSON) and generate matched little-endian codecs for Rust, TypeScript and
  C++ — no more hand-packing the same bytes on every side.

**Container-change push, typed invoke contracts, optimistic-action kit**

- New subscription `gameModelContainerChanged`: post-commit, metadata-only
  container-change events (which container, which keys — pull the
  visibility-filtered state on receipt) with typeName/session filters,
  fanned out across API replicas. Replaces interval polling with
  pull-on-push; Blocks with Friends' NPC reconcile loop now rides it with a
  polling fallback for older servers.
- Compute invoke triggers may declare a typed **contract**
  (`contractJson`): declared params are validated pre-sandbox (structured
  `BAD_REQUEST` instead of a guest runtime error), contracts surface on
  `computeModuleTriggers`, and `crowdy-compute types` generates TypeScript
  wrappers from them.
- CrowdyJS **8.11** adds `gameModel.containerChanged(...)` and the
  `runOptimisticAction` kit helper (the packaged optimistic apply → referee
  invoke → confirm/rollback loop with actionId receipts); CrowdyCPP **0.8**
  mirrors with `crowdy::kit::run_optimistic_action` (parity 0 missing; the
  push stream is waived for native clients).

**Container query predicates, automation compute actions, event deltas**

- `gameModelContainers` gains `where` (up to 8 AND-combined property
  predicates, the automation-selector shape, type defaults honored) plus
  `limit`/`offset` paging; the compute host mirrors it as
  `containers_list_where` (SDK `0.1.5`).
- Automations gain `actionKind: compute_invoke`: bind a schedule/event/
  manual automation directly to a compute module's invoke export (trusted
  server path, `targetMode: global`) — the first-class home for cron-shaped
  compute work, replacing the marker-function pattern.
- `property_changed` event deliveries to compute modules now carry the
  `oldValue`/`newValue` delta.
- SDKs: CrowdyJS **8.11** / CrowdyCPP **0.8** expose the new arguments and
  fields (`containersWhere` convenience in CPP); older servers reject the
  new arguments — omit them and everything else keeps working.

**Compute SDK 0.1.4 — atomic world+model referee commits**

- New host call `model_invoke_with_world`: up to 16 voxel writes commit on
  the **same SQL transaction** as an `autonomousInvocable` Model function.
  A denied function touches no voxel; a failed voxel write rolls the Model
  commit back. Each write charges one data op.
- Blocks with Friends' `mine`/`place` referee moved onto the atomic call —
  the earlier compensation/refund ordering and its bounded loss windows are
  retired (action receipts remain for client retry idempotency).
- No GraphQL schema changes; see the
  [Compute host API](/exec/from-the-legacy-engines#world-and-platform-data) reference.

**Docs: the "self-reported vitals" client-trust pattern**

- [Choosing Game APIs](/exec/from-the-legacy-engines) now names the
  self-reported vitals pattern (client-committed survival stats under
  `owner_of_self`) with its four guardrails: clamp every write, gate
  restoration on consumed resources, never gate grants or competitive
  results on self-reported state, and move abuse-sensitive writes behind a
  compute referee (the expression language deliberately has no clock
  builtin, so Model invoke policies cannot express cooldowns).

**Choosing Game APIs + BWF/TMS authority dogfood**

- The canonical five-tier API guide now maps mechanics and genre starters to
  platform primitives, Model functions, automations, compute engines and
  client conventions.
- Compute SDK `0.1.3` adds app-scoped `model_invoke`, preserving Model
  transactions/events/notifications when a live referee commits durable
  results.
- CrowdyJS 8.10 / CrowdyCPP 0.7 add atomic inventory crafting and barter,
  including a hardened server-grant posture.
- BWF schema v6 moves craft/smelt/trade/chests/quests to atomic Model
  transactions and PvP/fishing/mine/place/rewards to compute referees.
- TMS now routes all battle actions, turns, enemy AI and outcomes through
  `tms-battle`; automations remain test fixtures only.

**Compute hardening complete -- measured limits, calibrated billing, failure containment, and the Model-vs-Compute guide**

Compute hardening for this release:

- Compute billing's deterministic equivalent is now **22M fuel per unit**
  instead of the earlier 28M placeholder.
- Failure handling covers compile rollback, fuel/watchdog/OOM/panic
  containment, circuit reset, 256 KB state rejection, deploy mid-tick,
  event cascade depth, and spend-cap pausing.
- Runtime fixes: trigger upserts no longer stack duplicate rows; tick-rate
  edits reload a live module; failed compiles restore the prior succeeded
  version.
- New [Model API vs Compute](/exec/from-the-legacy-engines) decision guide,
  measured engine policy-footprint table, and calibrated billing/limits
  prose.

## 2026-07-19

**Realtime + live-ops engines and the template registry -- the game-kit catalog complete (CrowdyJS 8.9.0, CrowdyCPP v0.6.0)**

Wave 3 closes out the 30-abstraction game-kit catalog with the realtime/
competitive set (all additive):

- **New GraphQL surface**: `computeTemplates` +
  **`computeDeployTemplate`** — the platform's engine-template registry.
  Deploy any canonical engine by NAME (source-hash-deduped, triggers bound,
  enabled in one call); `moduleName` runs parameterizations side by side.
  SDK sugar: `client.compute.deployTemplate(...)` and
  `kit.deploy(blueprints, { engines: [...] })`.
- **Kit crates**: `kit-play` gains `abilities` (cast books, sub-stepped
  projectiles, AoE falloff) and `timing` (checkpoints/laps/ghost tracks);
  `kit-sim::zones` gains shrinking circles (BR schedules with
  warning/shrink/settle events).
- **Engine templates**: `abilities-engine` (AbilityDef-driven casts,
  type-94 events), `movement-warden` (observe/flag envelopes, type-95),
  `territory` (capture/decay/siege/income, type-96), `racing` (server-timed
  laps, auto-boarded results, ghost replays, type-97) + `possession` (the
  authoritative ball), `liveops-scheduler` (window modifiers on the compute
  bus) — plus the `arena-blitz` (G6) and `zone-rush` (G14 BR-lite)
  acceptance examples.
- **CrowdyJS 8.9.0 / CrowdyCPP v0.6.0**: new `kit.abilities` / `movement` /
  `territory` / `racing` / `liveops` / `moderation` / `telemetry` surfaces,
  the `kit.loot` engine path (pity rolls), liveops/moderation/telemetry
  blueprints, and event types 94–98 with parsers in both SDKs. Everything
  capability-detected; the movement warden observes and flags only — it
  never corrects (client prediction is untouched).

## 2026-07-19

**Session-genre engines -- kit-play completion, kit-econ, six new engine templates, and SDK surfaces (CrowdyJS 8.8.0, CrowdyCPP v0.5.0)**

Wave 2 of the game-kit program brings the session genres to the paved road
(all additive):

- **Kit crates**: `crowdy-game-kit-play` completes with `turns` (initiative,
  timeouts, simultaneous reveal), `score` (authoritative win conditions),
  and `cards` (server-held hidden hands, seeded shuffles);
  `crowdy-game-kit-ai` adds flow fields, a path cache, and budgeted
  turn-game movers; new **`crowdy-game-kit-econ`** ships order-book markets,
  server-computed standings, production chains with offline catch-up, and
  pity-timer loot. All allowlisted + vendored.
- **Engine templates**: `match-engine` (server-driven lifecycle over
  MatchMeta), `deck-engine` (true hidden information), `instance-engine`
  (private world slices, seeded runs), `director` (wave schedules, boss
  phases, party scaling), `matchmaking` (rating buckets, party blocks,
  compute-event handoff to matches), `market-engine` + `board-engine`
  (escrowed order books; tie-aware server rankings with season snapshots),
  and the `minigame` invoke-loop scaffold — plus playable examples per
  genre: `card-duel`, `dungeon-run`, `tower-defense`, `gacha-shrine`,
  `idle-factory`. The Tactical Model Simulator's enemy phase + outcome
  authority moved into a `tms-battle` compute referee (kit-ai).
- **CrowdyJS 8.8.0 / CrowdyCPP v0.5.0**: engine paths on
  `kit.matches`/`kit.decks`/`kit.leaderboards`, new
  `kit.instances`/`kit.director`/`kit.matchmaking`/`kit.minigames`,
  `kit.economy.orderBook`, quests FTUE tutorial sequencing, and reserved
  event types 91 (turn) / 92 (score) / 93 (proposal) with parsers in both
  SDKs. Everything capability-detected — model-only deployments keep their
  behavior.

## 2026-07-19

**Compute Engines -- the game-kit crate family, engine templates, and SDK engine surfaces (CrowdyJS 8.7.0, CrowdyCPP v0.4.0)**

Server-side game engines become a paved road (all additive):

- **Three new platform-vendored kit crates** join `crowdy-game-kit-core` on
  the module dependency allowlist: **`crowdy-game-kit-ai`** (budget-capped
  A* over a `CostProvider`, steering behaviors, FSM + JSON behavior-tree
  interpreter), **`crowdy-game-kit-sim`** (deterministic day cycle, weather
  fronts, resource nodes, timestamp growth/farming, wave schedules, rule
  zones), and **`crowdy-game-kit-play`** (the combat referee: presence-based
  hit validation, damage pipeline, kill credit, contact damage).
- **Engine templates** — deployable, data-driven reference engines in
  `compute-examples/engines/`: `npc-engine` (behavior-tree agents + pets),
  `mob-engine` (pooled spawns, aggro/leash/packs, refereed `attack_mob`),
  `world-engine` (weather + nodes + farming). The CLI scaffolds a copy with
  `crowdy-compute new <name> --engine <npc|mob|world>`; a `pets` example
  ships alongside the original five. New docs page:
  [Compute engines](/exec/from-the-legacy-engines#running-your-logic).
- **CrowdyJS 8.7.0** — engine kit surfaces: the `kit/wire` pose/lane
  registry (`engineLanes()`, `enginePoseCodec`, type-77/90 event parsers),
  `kit.mobs`, `kit.pets`, `kit.combat.attackRouted`, `kit.worldsim.forecast`,
  `kit.npcs.overlayLivePoses`, and per-session engine capability detection
  (`kit.engines`) so the same client code runs on model-only deployments.
- **CrowdyCPP v0.4.0** — the same surfaces in C++ (`crowdy/kit/wire.hpp`,
  `kit.mobs()`, `kit.pets()`, `attackRouted`, `forecast`), parity-tracked
  against CrowdyJS.

## 2026-07-18

**Compute Modules -- developer tooling: crowdy-compute CLI, game-kit utility crate, examples + tutorial**

The compute developer experience grows a paved road (all additive):

- **`crowdy-compute` CLI** (in the `compute-examples` repository folder):
  `new` scaffolds a module crate, `check` mirrors the deploy validation
  locally (plus a real `wasm32-wasip1` build when a toolchain is present),
  `deploy` runs the full upsert → compile-wait → triggers → enable flow
  idempotently, `watch`/`invoke`/`status` cover the observe loop.
- **`crowdy-game-kit-core`** — a platform-vendored Rust utility crate for
  module authors: durable-state harness, actor-pose wire codecs, chunk math,
  player presence, cadence helpers, event framing, invoke routing, seeded
  RNG. Add `crowdy-game-kit-core = "0.1.0"` to your module's dependencies.
- **SDK `0.1.2`** adds two host functions: `container_get_batch` (up to 32
  containers + properties in one data-op) and `actors_list_radius` (a chunk
  box of actors in one call), plus a native test-host shim so module crates
  can `cargo test` off-platform.
- **Five runnable examples** (tick-counter, scoreboard, npc-pathfinder,
  world-weather, mini-game) and a new
  [Compute tutorial](/exec/from-the-legacy-engines#running-your-logic) — zero to a live module in
  under 30 minutes.

**Game API -- Compute Modules: server-side Rust/WebAssembly logic (additive)**

The Game API gains **[Compute Modules](/exec/from-the-legacy-engines#running-your-logic)** — studios
write Rust, deploy the source through GraphQL, and the platform compiles it to
WebAssembly and runs it server-side, sandboxed and fuel-metered:

- **New GraphQL surface (additive):** mutations `computeUpsertModule`,
  `computeDeployVersion`, `computeSetModuleEnabled`, `computeDeleteModule`,
  `computeUpsertTrigger`, `computeDeleteTrigger`, `computeSetPolicy`,
  `computeInvoke`; queries `computeModules`, `computeModule`,
  `computeModuleVersions`, `computeModuleTriggers`, `computeModulePolicy`,
  `computeModuleRuns`, `computeModuleStats`, `computeModuleLogs`,
  `computeAppDiagnostics`. Full signatures in the
  [GraphQL reference](/game-api/reference/graphql-overview).
- **Triggers:** fixed-rate ticks, model/compute event subscriptions, and
  client-callable invoke exports (synchronous RPC via `computeInvoke`, gated by
  the same authority-policy trees as model functions).
- **Host API:** typed, app-scoped access to game-model data, app state blobs,
  chunks/voxels/actors, and replication emits that arrive on the existing
  `udpNotifications` stream — see the
  [Compute host API reference](/exec/from-the-legacy-engines#world-and-platform-data). Clients need no
  changes.
- **Permissions:** two new org permission keys — `manage_compute` (authoring)
  and `view_compute_diagnostics` (monitoring). Org owners hold both by
  default; existing `manage_apps` grants are unaffected.
- **Billing:** three new shared-environment usage metrics with free hourly
  allowances — `wasm_compute_units`, `wasm_egress_msgs`, `wasm_egress_bytes`
  (see [Shared environment](/management-api/shared-environment)). Rates are
  placeholders pending load-test calibration.
- The management UI app dashboard gains a **Compute** tab (author, deploy,
  watch compiles, monitor runs) driven by the same public API.

No existing schema fields, wire messages, or behaviors changed.

**Game API v0.13.13 -- invoke policy denials return results; `userAppState` round-trip fix**

Two consumer-facing behavior fixes in `gameModelInvoke` and the per-user app
state store (no schema shape or wire change):

- **Invoke policy denials are results, not errors.** A `gameModelInvoke`
  rejected by the function's invoke policy (`owner_of_self`, `condition`,
  `is_host`, ...) now resolves with `success: false` and an `errorMessage`,
  and writes a failure event visible in `gameModelEvents` — matching the
  documented kit contract ("authority denials are not exceptions — check
  `success`"). Scope violations (an `invokeScope: "server"` function called
  without app-admin rights) still throw `FORBIDDEN`. If your client caught
  `FORBIDDEN` to detect gameplay denials, check `success` instead;
  `@crowdedkingdoms/crowdyjs@8.4.6` and CrowdyCPP handle both server
  generations transparently in their kit helpers.
- **`updateUserAppState` stores what you send.** The mutation now decodes its
  base64 `state` input before storage, so `userAppState` / `userAppStates`
  return exactly the base64 that was written. Previously reads returned a
  double-encoded value; rows written through older servers return the correct
  encoding after their next write.

**CrowdyJS 8.4.5 / 8.4.6 (npm)** — `kitInvoke` maps `FORBIDDEN` policy
denials from older Game API builds onto the documented
`{ success: false, errorMessage }` result (8.4.6 republishes 8.4.5 with the
runtime `VERSION` constant synced).

**CrowdyCPP v0.1.0 -- initial public release of the native C++ SDK**

[CrowdyCPP](https://github.com/CrowdedKingdoms/CrowdyCPP) is the official
portable C++ SDK (C++20, CMake, Linux/Windows/macOS), now documented in the
new [CrowdyCPP](/crowdycpp/intro) docs tab:

- **Native UDP replication.** Unlike browser-first CrowdyJS, replication goes
  directly to the replication servers over the
  [Replication API wire protocol](/replication-api/wire-formats) — zero-copy
  framing, HMAC-signed sends, verified receives, automatic token refresh and
  reconnect. See [Replication client](/crowdycpp/replication-client).
- **Full GraphQL surface parity with CrowdyJS** (same domains, two-token
  model, and error codes), a [WorldSession](/crowdycpp/world-session) layer
  mirroring World Stores, and the full 15-layer
  [Game Kit](/exec/from-the-legacy-engines#running-your-logic) with blueprint equivalence — worlds
  deployed from either SDK are playable from both.
- **Engine-wrappable by design**: pluggable HTTP/crypto/clock/log interfaces
  and a thread-free manual-pump mode for engine plugins. See
  [Engine integration](/crowdycpp/engine-integration).

SDK-only: no schema or wire change; servers need no changes.

## 2026-07-18

**Game API v0.13.12.2 + CrowdyJS 8.4.1 -- schema hygiene + plot owner-mirror kinds (additive)**

A description-only hygiene pass on the Game API schema (no wire, DDL, or
behavior change) plus a small CrowdyJS Game Kit patch:

- **`ActorUpdateResponse` / `VoxelUpdateResponse` are formally marked
  legacy.** These `UdpNotification` union members are never emitted — the
  game server retired their dedicated opcodes; an applied update arrives as
  your own `*Notification` self-echo and failures arrive as
  `GenericErrorResponse`. Their type descriptions, the union description,
  and the [UDP proxy guide](/game-api/graphql-udp-proxy-api) now say so
  explicitly, and the guide's example subscription no longer selects them.
  They remain in the union for backward compatibility and will be removed in
  a future major version.
- **Deprecation reasons now carry removal dates** (per the agent-readiness
  checklist): the offset-pagination `limit`/`offset` args on
  `voxelUpdateHistory`/`gameModelEvents` (and their `*Connection` variants,
  where they are ignored) state removal no earlier than 2027-01-01.
- **CrowdyJS 8.4.1**: `plotBlueprint` gains `ownerIdKind: 'int' | 'string'`
  — string owner mirrors (the Blocks-with-Friends convention) now work with
  kit plots: guards compare via `to_string($caller_user_id)`, buying writes
  the owner as a string, and `""` is the for-sale sentinel. The bundled
  schema/reference pick up the hygiene descriptions.

Published SDL + GraphQL reference regenerated. Requires nothing — additive
documentation; clients need no changes.

## 2026-07-18

**CrowdyJS 8.4.0 -- World Stores: SDK-managed game state (additive)**

A new opt-in layer, `@crowdedkingdoms/crowdyjs/stores`, moves the client-side
bookkeeping every game hand-writes (actor registries, pose codecs, chunk
caches, chat rings, host polling — ~1,600+ LOC in the reference MMO) into the
SDK as typed, queryable, source-of-truth stores fed by ONE shared
`udpNotifications` subscription:

- **Codecs**: `StateCodec<T>` with `jsonCodec` / `textCodec` / `rawCodec` and
  `structCodec` — a declarative fixed-layout binary DSL for replication
  state (the 48-byte pose in ~10 lines). Developers register their custom
  types + encoders/decoders once; stores speak typed values everywhere.
- **`session.self`** (LocalActorStore): minted + persisted actor uuid, typed
  state, a **5 Hz send loop** with send-on-change dedup + periodic
  keyframes, and queryable `lastSent` / `lastAck` (the applied self-echo) /
  `lastError` / `status`.
- **`session.actors`** (RemoteActorStore): decode-once registry with
  self-echo filtering, timestamped sample history for interpolation,
  read-time staleness + reaping, join/update/leave events, and **lanes**
  (players vs mobs from one stream).
- **`session.errors`**: `GenericErrorResponse`s attributed to the tracked
  sends that caused them (per-actor lookup, ring buffer).
- **`session.chunks`** (ChunkStore): deduped `getChunksByDistance` loading
  with automatic sparse-voxel-state hydration, realtime `voxelUpdate` merge,
  typed voxel/chunk-state codecs, optimistic `setVoxel`, and the
  deterministic-worldgen write-back pattern (`onMissing` + throttled queue).
- **Messaging**: `channelInbox` (per-channel typed history — inbound channel
  fan-out at last), `actorInbox` (typed direct messages), `events`
  (per-eventType codecs for client/server events + `lastEvent`).
- **Durable**: `host` (heartbeat tracker), `save` (typed app save blob with
  debounced autosave), `avatar` (typed public/private/app state), `model`
  (ContainerMirror — typed game-model snapshots with notify-to-pull channel
  binding).

Ergonomics: **compile-time toggles** — the core client never imports the
layer (`"sideEffects": false`; unimported stores tree-shake away) and the
session's TypeScript type is conditional on the config, so unconfigured
stores don't exist. **Background-tab safe** — writes ride unthrottled
WebSocket events; timer-driven work runs on an injectable `Ticker` with a
`workerTicker()` (dedicated Web Worker, exempt from background-tab timer
throttling). SDK-only: no schema or wire change. See
[CrowdyJS → World Stores](/crowdyjs/stores).

## 2026-07-18

**CrowdyJS 8.3.0 -- Game Kit genre layers (additive)**

The Game Kit grows from four building blocks to a genre-covering catalog —
eleven new layers, each a blueprint builder + typed runtime helper, all pure
composition over the existing GraphQL surface (no schema change):

- **Economy** (`economyBlueprint` / `kit.economy`): multi-currency wallets,
  atomic shop buys, `$self_owner_id`-pinned escrow trades and player market,
  optional restock automation. Trusted mints default to server scope.
- **Progression** (`kit.progression`): xp/levels via the `fn:` curve-helper
  pattern, skill prerequisite chains, threshold achievements, host-gated
  rating for match results.
- **Loot** (`kit.loot`): weighted tables unrolled into seed-driven expression
  chains at build time, atomic single-claim grants, event-triggered pooled
  drops.
- **Quests** (`kit.quests`): event-automation progress, atomic
  claim-into-stack+wallet, cron daily resets.
- **Combat** (`kit.combat`): server-side damage/death, status-effect ticks
  via the selector-join pattern, `turnBased` / `hostSynced` / `reviveGroup`
  options.
- **Matches** (`kit.matches`): session-backed lobbies/rounds/turns/scores
  with a per-match notification channel (notify-to-pull; `onMatchChanged`)
  and counter-based turn ticks.
- **Decks** (`kit.decks`): hidden hands via owner-visibility properties (the
  two-property reveal trick) and shuffle-by-position automations.
- **World simulation** (`kit.worldsim`): day/night clock with a spatial
  notification, regenerating nodes, crops, host-read wave counters.
- **Social** (`kit.social` + `guildBlueprint`): parties/guilds/chat over
  teams + channels, grid territory grants, and a composite guild-hall + bank
  blueprint.
- **Leaderboards** (`kit.leaderboards`): trusted keep-best submits,
  client-side ranking, cron season rolls.
- **Monetization** (`kit.features` + `featureGate`): feature keys, tier
  grants, and `*policyExtra` gating options on the plot/lock builders.

Cross-cutting: `blueprints.ts` split into per-concept modules (import paths
unchanged), shared `KitTrustedAuthority` / `ownerIdKind` conventions, and a
new pattern guide (simulation tiers, notify-to-pull, timers without a clock,
hidden information, anti-cheat checklist). See
[CrowdyJS → Game Kit](/exec/from-the-legacy-engines#running-your-logic) and the expanded
[genre map](/exec/from-the-legacy-engines#running-your-logic). Requires
`cks-game-api` v0.13.12.1+.

## 2026-07-18

**Game API -- permission-read builtins + selector permission predicates (additive)**

Game-model logic can now **read** the runtime grid ACL and grid layout,
completing the read+write loop that permission effects opened:

- **Six new expression builtins**, usable in mutations, return expressions,
  notification args, permission-effect expressions, and policy `condition`
  rules: `has_grid_permission(user, key[, grid])`,
  `grid_at(cx, cy, cz[, mode])` (overlap modes `first` | `smallest` |
  `largest`), `has_chunk_permission(user, key, cx, cy, cz[, mode])`,
  `grid_contains`, `grid_min`, `grid_max`. Reads are app-scoped, cached per
  invocation, charged 25 gas per uncached lookup, and observe grants applied
  by the same invocation's permission effects (read-your-writes).
- **Automation selector permission predicates**: `selfPermissionWhere` /
  `candidatePermissionWhere` filter automation targets by whether the user
  behind a container has/lacks a grid permission (owner- or property-derived
  user id; literal, property-derived, or any-grid scope) — one batched ACL
  query per predicate. Validated at `gameModelUpsertAutomation` time.
- Upload static analysis warns on wrong builtin arity, invalid `mode`/axis
  literals, and unknown permission keys.

Read-only feature: no schema migration and no wire change. See
[Game Models → Reading permissions from expressions](/exec/from-the-legacy-engines#running-your-logic)
and [Autonomous processes → Permission predicates](/exec/from-the-legacy-engines#running-your-logic).
CrowdyJS 8.2.0 ships the matching Game Kit surface (`plotBlueprint`,
chunk-permission lock authority, typed selector predicates). Requires
`cks-game-api` v0.13.12+.

## 2026-07-17

**Game API -- model permission effects (additive)**

Game-model functions can now **write runtime grid permissions** as declared,
transactional effects. A new `permissionEffects` array on
`gameModelUpsertFunction` / `gameModelSeed` functions declares grants/revokes
(`{ action, permissionKeys, userExpression, gridIdExpression,
ttlSecondsExpression? }`) that apply **in the same transaction** as the
function's property mutations — "pay gold AND get plot access" is one atomic
invoke, immediately enforced by the replication layer on movement/voxel writes.
Details:

- Expressions are compiled server-side and evaluated in the invocation context;
  the system params `$caller_user_id`, `$current_turn_user_id`,
  `$self_owner_id`, and `$session_id` are now injected into **function-body**
  evaluation as well (previously policy `condition` expressions only) and
  cannot be spoofed by same-named caller params.
- Effects are capped at 4 per function, gas-charged, validated against the
  `runtime_permissions` catalog, and require the grantee to hold app access; a
  failing effect rolls back the whole invocation (`success: false`).
- New audit field `GmEvent.permissionEffectsAppliedJson` records every applied
  effect (player- and automation-driven alike).
- New types: `FunctionPermissionEffectInput`, `GmFunctionPermissionEffect`
  (returned on `GmFunction.permissionEffects`).

See [Game Models → Permission effects](/exec/from-the-legacy-engines#world-and-platform-data)
and the worked land-purchase example in
[Modeling game concepts](/exec/from-the-legacy-engines#running-your-logic).
Requires `cks-game-api` with the `2026-07-17-model-permission-effects` migration.

## 2026-07-10

**Unreal SDK 2.1.0 -- Crowdy State, replicated subsystems, and host authority**

A large, mostly additive release on the 2.0 architecture: a client-authoritative view plane for
per-property replication, non-actor subsystem participants, and an explicit host-authority and
ownership surface. New capabilities:

- **Crowdy State property replication.** Mark a `UPROPERTY` or a Blueprint variable with
  `meta=(CrowdyState)` and the owning client diffs and replicates just that value to peers on
  the client-authoritative view plane, with no snapshot struct or executor. Bare per-property
  markers tune it: `CrowdyOnRep` (a parameterless RepNotify), `CrowdyOwnerOnly` (deliver only
  to the entity's owner), `CrowdyManualDirty` (send on an explicit `MarkStateDirty` rather than
  every tick), and `CrowdyHeartbeat` (opt into the periodic keyframe re-send for late joiners).
  See [Crowdy State](/unreal-sdk/runtime/crowdy-state) and the
  [metadata keys reference](/unreal-sdk/reference/state-meta-keys).
- **Replicated subsystems.** A host-owned UE Subsystem can take part in both view planes
  (Crowdy State properties and CrowdyEvents) without becoming an actor, via a function library
  or two abstract base classes. See
  [Replicated subsystems](/unreal-sdk/runtime/replicated-subsystems).
- **Host authority and explicit ownership transfer.** New `Ownership`, `HostOverride`, and
  `StateHeartbeat` fields on `UCrowdyEntityComponent` for level-placed world entities and host
  super-user writes; a request/grant ownership-transfer flow (`UCrowdyOwnershipTransfer`); a
  server-validated host check (the **Is Crowdy Entity Host (Server)** node); and client-side
  ownership helpers (`DoesCrowdyEntityOwn`, `IsCrowdyEntityHost`, `GetCrowdyEntityComponent`).
  See [Host authority](/unreal-sdk/runtime/host-authority) and
  [Ownership transfer](/unreal-sdk/runtime/ownership-transfer).

**Breaking changes**

These are the only changes that touch an existing 2.0 project; everything above is additive.

- **`CrowdyHasAuthority` renamed.** The Blueprint-pure "am I the host" check on
  `UCrowdyUtilities` is now **`GetCrowdyHasAuthority`** (Blueprint DisplayName still "Crowdy Has
  Authority"). The old `CrowdyHasAuthority` name is now the exec/branch variant (Blueprint
  "Switch Crowdy Has Authority"). Update C++ callers from `CrowdyHasAuthority(this)` to
  `GetCrowdyHasAuthority(this)`; Blueprint nodes re-resolve on recompile. See
  [Host authority](/unreal-sdk/runtime/host-authority#checking-authority).
- **`ECrowdyDecayRate` corrected.** Removed the non-functional **`Linear_100`** value (the
  `CrowdyDecay` option on a `SpatialMulticast` CrowdyEvent). It shared an underlying value with
  `Linear_50`, so the two were indistinguishable on the wire. The ladder is now `No_Decay` (0),
  `Exponential_Decay` (1), `Linear_50` (2), `Linear_25` (3), `Linear_10` (4), `Linear_5` (5). A
  Blueprint that had selected "Linear 100 Decay" should re-select a rate; it behaved exactly
  like "Linear 50 Decay" before. See
  [Recipients and routing](/unreal-sdk/runtime/recipients-and-routing).
- **RPC container parameters hardened.** A CrowdyEvent parameter that buries a container
  (`TArray`/`TSet`/`TMap`) inside a struct is now rejected at registration, because a malformed
  packet could drive an unbounded allocation from its element count; pass the container as a
  top-level parameter instead. Direct `TArray`/`TSet`/`TMap` of supported element types still
  work. The set/map parameter wire format also changed (internal blob version 2), so every peer
  must run a build from this line -- a mixed 2.0/2.1 session drops set/map RPCs at the version
  gate. See [RPC parameter types](/unreal-sdk/reference/rpc-types).

## 2026-07-01

**Social and magic-link sign-in (Unreal SDK, additive)**

- Three new Blueprint Async Action latent nodes round out the sign-in surface: **Dev
  Login**, **Magic Link Sign In**, and **Social Sign In**, joining the existing
  Login / Register / Restore Session nodes on `UCrowdyAuthentication`. Each has
  Success/Error exec pins, so a Blueprint-only project no longer needs to wire the
  underlying delegates by hand. See
  [Blueprint nodes](/unreal-sdk/services/authentication#signing-in).
- **Crowdy Studio's** sign-in page now offers a federated social provider or an
  emailed magic link, alongside the existing email + password, dev sign-in, and
  organization token options. All four session-scoped methods (password, social,
  magic link, dev) grant full authoring access — teams, channels, grids, game
  models, Config Sync, and the Web Console; only the organization token remains
  management-only. See
  [Crowdy Studio: Signing in](/unreal-sdk/studio/overview#signing-in).

No breaking changes — email + password sign-in (`Login`/`Register`) remains fully
supported side by side with the new methods.

## 2026-06-28

**Dedicated environments available to all studios (Management API)**

> **Retired 2026-07-27.** Everything announced below was removed from the published
> SDL and is no longer served. Nothing here is a surface to build against; see the
> [2026-07-27 entry](#2026-07-27) and
> [Shared environment & billing](/management-api/shared-environment).

- You can now create **multi-VM dedicated environments** (`environmentClass: "dedicated"`,
  the default) directly — an isolated Game API fleet, database, and Buddy replication stack
  for your studio. Previously only the single-VM **developer sandbox**
  (`environmentClass: "dev_single"`) was available and dedicated returned a "coming soon"
  error. `createEnvironment` / `environmentQuote` take the four per-component flavors
  (`databaseFlavor`, `gameApiFlavor`, `udpBuddyFlavor`, `caddyFlavor`) plus scaling bounds;
  creation still gates on the org wallet (`environmentQuote.canCreate`) and requires
  `manage_environments`. The dedicated-environments page was removed; see
  [Shared environment & billing](/management-api/shared-environment).
- `CksEnvironment` gains an additive **`isShared`** boolean (true only for the platform's
  shared environment; always false for your environments). No breaking changes. Clients
  still discover an app's runtime via `app.gameApiUrl` / `platformConfig.sharedGameApiUrl` —
  the shared Game API endpoint is resolved dynamically, so never hard-code it.

## 2026-06-26

**CrowdyJS package — npm org move, v6 version line restored**

- The SDK is published as **`@crowdedkingdoms/crowdyjs`** (moved from the former
  `@crowdedkingdomstudios` org). The version line **continues the v6 series**: the
  current release is **`6.1.1`** (npm `latest`), the direct successor to the old org's
  `6.1.0` — **same code, new package name**. Two interim `1.0.x` publishes during the
  org move reset the version by mistake; they remain installable but are superseded by
  `6.1.1`. Install is unpinned, so `npm install @crowdedkingdoms/crowdyjs` resolves to
  `6.1.1`. See the [CrowdyJS SDK guide](/crowdyjs/readme).

## 2026-06-26

**Game model automations / NPCs (Game API, additive)**

- **Server-driven automations** invoke your [game model functions](/exec/from-the-legacy-engines#running-your-logic)
  on their own — on a schedule or in reaction to model activity — so you can build NPCs,
  spawners, and ticking world systems that run with no client connected. (**Superseded
2026-09-01:** scheduled automations are now skipped while an app has no players —
see [that entry](#2026-09-01) and [Presence](/exec/from-the-legacy-engines#timers-and-triggers).) New GraphQL:
  `gameModelUpsertAutomation`, `gameModelUpsertAutomationTrigger`, `gameModelRunAutomation`,
  `gameModelSetAutomationEnabled`/`Policy`, and the monitoring queries
  `gameModelAutomations`, `gameModelAutomationRuns`, `gameModelAutomationStats`, and
  `gameModelAppDiagnostics`. The entry-point function opts in with `autonomousInvocable`.
  All require `manage_apps`. See [Autonomous processes (NPCs)](/exec/from-the-legacy-engines#timers-and-triggers).

**Model-driven realtime notifications (Game API, additive)**

- A model function can now **push a realtime notification** to clients as part of its
  invocation, via a `notifications` array on `gameModelUpsertFunction` (and `gameModelSeed`).
  Each effect has a `kind` (`spatial` | `channel` | `actor`) and arguments built from model
  expressions; the notification arrives on the existing `udpNotifications` stream as a
  `ServerEventNotification`, `ChannelMessageNotification`, or `SingleActorMessageNotification`.
  Player-invoked and automation-driven changes notify players identically.
  See [Model-driven notifications](/exec/from-the-legacy-engines#realtime).

**`deleteGrid` (Game API, additive)**

- New `deleteGrid(input: { appId, gridId })` mutation removes a studio-created peer grid
  (e.g. to unblock `GRID_OVERLAPS_EXISTING`). Hybrid result like `createGrid`; refuses the
  default world grid and grids with nested children; requires `manage_apps`. See
  [Grids and permissions](/game-api/grids-and-permissions#deleting-a-grid).

**Management API additions (additive)**

- `environmentQuote` and `orgEnvironment(s)` now return `environmentClass` and
  `singleBoxFlavor`; `appUsageSummary` now returns automation activity totals
  (`automationRuns`, `automationInvocations`, `automationComputeUnits`); new
  `buddyBillingTiers` / `graphqlBillingTiers` / `postgresBillingTiers` catalogs with
  `updateEnvironmentBillingTiers`; and a `playerPulse` live-concurrency query.

**CrowdyJS v6.1 (SDK, additive)**

- The SDK now wraps the **full** public surface — every non-deprecated root field has a
  typed method, including the above. New highlights: `client.gameApps.deleteGrid`, the
  game-model automation + `notifications` wrappers, the game-model studio reads, and Relay
  `*Connection` cursor-pagination variants alongside the offset lists. `deleteGrid` requires
  a server on release `v0.1.33+`. See the CrowdyJS guides:
  [Automations](/exec/from-the-legacy-engines#timers-and-triggers), [Model-driven notifications](/exec/from-the-legacy-engines#realtime),
  and [Grids](/crowdyjs/grids).

## 2026-06-13

**Signed server→client notifications (Replication API)**

- Buddy now **signs server→client long-spatial notifications** (actor / voxel / audio /
  text / generic-spatial / single-actor) with a per-recipient **HMAC-SHA256** keyed on
  your 64-octet game token — the same scheme you already use to sign client→server
  messages. Signed notifications arrive with `containsAuth = 1` and a 32-byte HMAC in the
  spatial tail (the 8-byte slot after it carries server epoch-millis, not part of the HMAC).
- **Native (direct-UDP) clients:** verify the HMAC and drop any `containsAuth = 1`
  long-spatial notification whose tag doesn't match. See [HMAC](/replication-api/hmac)
  for the algorithm, key handling, and per-language libraries (OpenSSL/C++, .NET, Node,
  Python, Go, Rust), plus [Send and receive](/replication-api/send-and-receive).
- **Browser clients on the GraphQL UDP proxy are unaffected** — the proxy handles the
  signed format transparently.

Additive to the wire layout (the HMAC slot already existed); no fields removed.

## 2026-06-13 (load shedding)

**Resource-aware load shedding (additive)**

- **New `ServerState` values `NearCapacity` and `Full`.** Game servers now report a
  resource-overload state. `serverWithLeastClients` already returns only
  `ReadyForClients` servers, so an overloaded server is automatically skipped for new
  connections — no client change needed for host selection.
- **New Replication API opcode `COMMAND_RECONNECT` (22).** A server under hard overload
  asks a client to move: `[22][32B HMAC]`, where the HMAC (HMAC-SHA256 keyed on your
  64-octet game token over the type byte) authenticates the command as server-originated.
  Native (direct-UDP) clients should verify it, then re-query `serverWithLeastClients` and
  reconnect within the grace period; see [Operations → Load shedding](/replication-api/operations) and
  [Wire formats](/replication-api/wire-formats). **Browser clients on the GraphQL UDP
  proxy are migrated automatically** and never see this message.

No fields were removed; both changes are additive.

## 2026-06-13 (later)

**Agent-readiness design changes (additive)**

- **Idempotency keys.** Economy-sensitive and destructive mutations now accept an optional
  `idempotencyKey` (on the `input` object or as a top-level argument). Replaying with the
  same key + identical parameters returns the first result instead of re-applying; a
  different payload under the same key returns the new `IDEMPOTENCY_CONFLICT` error code.
  Covers Management API checkout/billing/grant/quota/app/environment/org mutations and Game
  API `rollbackVoxelUpdates`, `revokeGridPermissions`, team and actor/avatar deletes.
- **Relay cursor pagination.** New `*Connection` queries (`first`/`after`, `edges`/`pageInfo`)
  for the largest lists (e.g. `usersConnection`, `appsConnection`, `checkoutsConnection`,
  `paymentEventsConnection`, `walletTransactionsConnection`, `appUserAccessConnection`,
  `voxelUpdateHistoryConnection`, `actorsConnection`, `gameModelEventsConnection`). The
  offset queries remain; their `limit`/`offset` args are now `@deprecated`. See
  [Pagination](/overview/pagination).
- **Machine-readable permissions.** Guarded fields now carry a `@requiresPermission(scope:,
  permission:, scopeArg:)` directive in the SDL/introspection.
- **Structured errors.** New error codes (`SCOPE_MISSING`, `CONFLICT`, `IDEMPOTENCY_CONFLICT`,
  `RATE_LIMITED`, plus corrected `UNAUTHENTICATED`/`NOT_FOUND`) and `extensions.remediation` /
  `extensions.requiredPermission`. See [Error codes](/overview/error-codes).
- **Security fix.** `effectiveQuota` now requires `view_usage` on the most-specific scope
  (tier/app/org) instead of being readable by any authenticated user; metric-only lookups
  (free-tier defaults) remain open. This is a deliberate behavior change for cross-tenant
  callers.

No fields were removed. The ID/UUID scheme and the UDP wire-protocol versioning are
unchanged by design.

## 2026-06-13

**Documentation & schema self-description**

- Every public GraphQL query, mutation, subscription, argument, field, and enum value now
  carries a description across the Management API and Game API — including the required
  permission and side effects on each operation. These flow into the
  [GraphQL reference](/game-api/reference/graphql-overview) and the downloadable SDL.
- Published downloadable SDL at stable URLs:
  [`/schema/management-api.graphql`](pathname:///schema/management-api.graphql),
  [`/schema/game-api.graphql`](pathname:///schema/game-api.graphql),
  [`/schema/crowdyjs.graphql`](pathname:///schema/crowdyjs.graphql).
- Added an [`/llms.txt`](pathname:///llms.txt) index and a
  [For AI agents](/overview/for-ai-agents) quickstart, plus consolidated
  [Error codes](/overview/error-codes), [Pagination](/overview/pagination), and
  [Rate limits](/overview/rate-limits) references.
- Replication API: published a consolidated opcode/byte-layout reference, documented the
  NAK-vs-silent-drop failure model and the best-effort reliability contract, and added a
  [worked example packet](/replication-api/example-packet).

**Deprecations (Management API)**

- `CheckoutPurpose.DONATION` and `CheckoutPurpose.PROPERTY_TOKENS` are deprecated — these
  products are no longer purchasable. Use `ORG_WALLET_TOPUP` or `APP_ACCESS_PURCHASE`.
  Existing historical checkouts are unaffected.
- The `myDonationData` and `myPropertyTokens` queries are deprecated (legacy read paths
  retained for historical records only).

No fields were removed in this release. Deprecated fields continue to function.

## Earlier

Prior releases predate this public changelog. For SDK breaking-change notes, see the
CrowdyJS migration guide in the [CrowdyJS](/crowdyjs/readme) docs.
