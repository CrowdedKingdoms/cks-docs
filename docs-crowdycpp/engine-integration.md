---
slug: engine-integration
sidebar_position: 7
title: Engine integration
---

# Engine integration

CrowdyCPP is designed to be the foundation for engine-specific SDKs,
including the official
[Crowdy Unreal SDK](https://github.com/CrowdedKingdoms/CrowdySDK-Unreal)
(docs: [Unreal SDK guide](/unreal-sdk/intro)). The design rules that make it
wrappable:

1. **No engine types, ever.** The public API uses `std::span`,
   `std::string_view`, and POD structs. Nothing allocates with `new` on hot
   paths or leaks platform handles, so an engine can marshal at whatever
   boundary it chooses.
2. **Pluggable platform services.** Engines inject their own implementations
   of the small platform interfaces.
3. **Threading stays with the engine.** Manual-pump mode spawns no SDK
   threads at all.
4. **Binary state stays binary.** Actor-state payloads are opaque bytes end
   to end — no base64, no JSON, no intermediate copies.
5. **The session layer maps to entity systems.** The
   [WorldSession](/crowdycpp/world-session) stores are exactly the inputs an
   engine's replication components need.

## The Unreal recipe

The expected integration shape for an Unreal plugin:

- **ThirdParty static library.** CrowdyCPP builds as a static library in a
  `ThirdParty` module of the plugin. The plugin's subsystems (connection,
  entities, voice, teams, persistence) become thin adapters over
  `crowdy::CrowdyClient`, `crowdy::replication`, and
  `crowdy::session::WorldSession`, keeping the Blueprint-facing API stable.
- **HTTP via `IHttpTransport`.** Wrap `FHttpModule` so all GraphQL traffic
  uses the engine's HTTP stack, proxies, and certificate handling.
  (Alternatively link the default libcurl transport — Unreal ships libcurl
  and OpenSSL in its own ThirdParty tree.)
- **Crypto via `ICrypto`.** Bind the engine's bundled OpenSSL for
  HMAC-SHA256.
- **`ILogger` / `IAllocator` / `IClock`.** Adapters onto `UE_LOG`, `FMemory`,
  and engine time, so SDK activity shows up in engine tooling.
- **Manual pump on an `FRunnable`.** Run `pump()` on an `FRunnable` network
  thread (or the task graph) and `poll()` on the game thread from a ticker.
  Callbacks therefore fire **on the game thread**, where `UObject`s are safe
  to touch — the SDK spawns no threads in this mode. See
  [Replication client → Threading modes](/crowdycpp/replication-client#threading-modes).
- **The 88-byte pose codec.** `crowdy::session::UnrealPose` is the 88-byte
  actor-state layout (version byte, position/rotation/velocity as f64
  triples, crouch flag, attachment enum) that interoperates with the current
  Unreal SDK's pose format — the same layout the open-source
  [cks-loadtest](https://github.com/CrowdedKingdoms/cks-loadtest) tool uses
  (see [Load testing](/replication-api/load-testing)). An Unreal wrapper maps
  its entity snapshots directly into the payload span.
- **WorldSession → entity systems.** The remote-actor registry (staleness,
  sample history) drives owner/proxy entity components and interpolation; the
  chunk cache backs voxel/terrain streaming; the inboxes back chat and direct
  messages; host tracking backs host-authority checks.

## Other engines

The same recipe applies beyond Unreal:

- **Custom C++ engines** consume the library directly — link
  `CrowdyCPP::crowdy`, choose owned-thread or manual-pump mode, and feed the
  session stores into your own entity and terrain systems.
- **Godot** wraps it in a GDExtension: manual pump from a background thread
  (or `_process`), signals emitted from the `poll()` site, and Godot's crypto
  and HTTP optionally injected through the same interfaces.
- **Unity** goes through a thin C shim: export a C ABI over the client,
  connection, and session objects, P/Invoke from C#, and keep the state
  structs blittable so payloads cross the boundary without marshalling.

In every case the division of labor is the same: CrowdyCPP owns protocol,
signing, correlation, and state bookkeeping; the engine owns threads, memory
visibility, and object lifetimes at the boundary.
