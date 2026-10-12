---
sidebar_position: 7.5
title: Develop on your machine
---

# Develop on your machine: the open dev kit

The open dev kit, `ckx-kit`, creates, tests, checks and builds your hubs, spokes and mods on your
own machine, the way the platform builds them, without deploying anything. It is the public half
of the platform's compute toolchain: the SDKs your crates compile against, the checks the
platform runs before and after it compiles, the tool that meters a mod's [CLIENT
half](client-halves), the starter crates, and the Rust release the platform pins. A crate that
passes here builds on the platform.

It is open source, under the MIT or Apache-2.0 licence:
[github.com/CrowdedKingdoms/ckx-kit](https://github.com/CrowdedKingdoms/ckx-kit). The SDKs are
`ckx-sdk` and `crowdy-client-sdk` on [crates.io](https://crates.io/crates/ckx-sdk), and the
command line is `@crowdedkingdoms/ckx-kit` on npm.

## What you need

- [rustup](https://rustup.rs). A crate pins the Rust release the platform builds with in its
  `rust-toolchain.toml`; install it with
  `rustup toolchain install <that version> --target wasm32-unknown-unknown`.
- Node.js 20 or later.
- [binaryen](https://github.com/WebAssembly/binaryen) (`wasm-opt`), for a mod's CLIENT half
  only.

`npx @crowdedkingdoms/ckx-kit doctor` says what is missing, and which platform toolchain release
the kit matches.

## Start a crate

```bash
npx @crowdedkingdoms/ckx-kit new mod my-mod
cd my-mod
cargo test                                  # natively, against a fake of the platform
npx @crowdedkingdoms/ckx-kit build --mod    # the platform's build and checks
```

`new` takes a template: `mod`, `client` (a mod's CLIENT half), `hub`, `spoke`, or one of the
[starter packs](builds#starter-packs)' crates (`world-tick`, `matchmaker`, `session`,
`npc-mobs`). The mod, hub and spoke templates and the starter crates come with their tests. The
crate names the exact SDK version and Rust release this kit matches.

## Test

`cargo test` runs your crate natively against `ckx_sdk::testing`, which plays the platform:

```rust
use ckx_sdk::prelude::*;
use ckx_sdk::testing::{FakeGrid, TestHub};

#[test]
fn a_visitor_is_welcomed() {
    let grid = FakeGrid::new(7, ChunkPos::new(0, 0, 0), ChunkPos::new(3, 1, 3), 42);
    let mut m = TestHub::<GridMod>::mod_on("grid-mod", grid).unwrap();
    let hello: String = m.call_typed(Caller::Player(9), "visit", &()).unwrap();
    assert_eq!(hello, "welcome to grid 7, visitor 1");
    m.advance(60_000).unwrap(); // the test's clock: due timers run as the platform runs them
    m.restart().unwrap();       // from the hub's snapshot, with its timers and subscriptions
}
```

- **Drive.** `TestHub::spawn` and `spawn_with` (with a seed) start a hub; `load` starts one from
  a snapshot an earlier version wrote; `mod_on` starts a mod on a `FakeGrid`; `TestSpoke::start`
  starts a spoke. `call` and `call_typed` call it as a player, a developer or another instance.
  `advance` and `advance_to` move the test's clock, and each timer that falls due on the way runs
  as the platform runs it. `topic`, `presence`, `session` and `world` deliver the platform's
  events. `persist` takes the snapshot, `restart` starts the hub again from it, and `upgrade`
  loads it into your next version.
- **Observe.** `logs`, `published`, `calls`, `sent`, `emitted`, `node_requests`, `watching`,
  `timers` and `persist_asked` say what the node did.
- **Answer.** For an app's own hubs and spokes, `answer_calls(type, …)` scripts what other types
  answer and `answer_node(op, …)` what the node API answers. A call or an operation the test
  answers nothing for gets `NotFound`.
- **A mod's grid.** `FakeGrid` holds chunks, voxels, actors and permissions (`with_chunk`,
  `with_voxel`, `with_actor`, `with_permission`, `with_open_permissions`) and answers the mod's
  node API operations with the node API's rules: only inside the grid, voxel writes only where
  its owner may edit voxels (`without_voxel_edits_at` stands for a smaller grid that does not
  let them), reads of its own grid only, and nothing once the grid changes hands (`transfer`) or
  is deleted (`delete`). Its refusals read exactly as the platform's.
- **The platform's rules.** Each call is held to the platform's bounds (`ckx_sdk::limits`: a
  4 MiB reply, an 8 MiB snapshot, what one call may send and log). Only the platform calls `$`
  methods. A mod's calls and subscriptions are refused, what it sends and emits is dropped, and
  only players call it.

A test runs one node at a time on its thread; `cargo test` gives each test a thread of its own.

## Build

`ckx-kit check` runs the platform's source checks on exactly the files the platform takes
(`Cargo.toml`, `README.md` and the `.rs` files under `src/`), and lists what it would not send.
`ckx-kit build` runs them, compiles with the pinned Rust for `wasm32-unknown-unknown` with the
platform's release profile and dependency versions, and checks the module: what it imports and
exports, and with `--mod`, the [mod limits](mods#build-deploy-and-switch-on). A CLIENT half is
metered and optimized as the platform does it, and its [capability
summary](client-halves#the-capability-summary), the list visitors are asked to agree to, is
printed with its hash. `--json` prints a report.

When it passes, build and deploy the same sources on the platform: [`execBuild`](builds) for an
app's types, [`execModBuild`](mods#build-deploy-and-switch-on) and
[`execModClientBuild`](client-halves#building-and-attaching) for a mod, or Crowdy Studio.

## What it does not check

- **Fuel, memory and deadlines.** They are measured only where the module runs: on the platform.
- **Your app's manifest.** Native tests hold an app's own types to no call policy and no node API
  scopes, and apply no node API rate limits.
- **The module's digest.** The platform rebuilds from your source, so its module's digest
  differs from yours (the build paths embedded in it differ). The checks and a CLIENT half's
  capability hash do not.

## Versions

The kit, `ckx-sdk` and `crowdy-client-sdk` are released with the platform's compute toolchain.
`ckx-kit new` writes the exact SDK version its kit matches, and `kit.pin` in the kit names the
toolchain release it was copied from. Use the latest release: versions ending in `-dev.N` or
`-test.N` are for our internal environments.

## Contributing

Issues and pull requests are welcome in the kit's repository. The SDKs, the checks, the meter
and the starters are copies of the platform's own (`kit.pin` lists them): a change to one of
them is made upstream, and reaches the kit with the next toolchain release.
