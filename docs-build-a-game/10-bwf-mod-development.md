---
sidebar_position: 10
title: Build mods with Crowdy Studio
---

# Build mods with Crowdy Studio

Blocks with Friends (BWF) embeds Crowdy Studio for player-authored server and
client Rust mods. This guide is for a mod developer using the game, not a
studio operator deploying platform infrastructure.

## Open Crowdy Studio

1. Enter BWF with an app-scoped game token.
2. Stand inside a grid you own and that grants the player-code write/run keys.
3. Press **M**.
4. Open or create a server, client, or full-stack project. You can copy an
   app-provided starter from **Common Files** into either target.

Crowdy Studio opens Monaco with target-aware `Cargo.toml` and `src/*.rs` tabs.
Rust syntax colors, parser diagnostics, workspace completion, hover, symbols,
and workspace-local navigation run in a lazily loaded browser module worker.
The worker loads local parser/grammar WASM; it has no authoring endpoint and
receives no game token. Its feedback is advisory. **Test draft** and **Deploy
live** invoke the authoritative platform compiler.

The local worker is a parser and indexed-symbol service, not rustc or
rust-analyzer. It cannot prove borrow/lifetime correctness, perform complete
trait resolution or type inference, expand procedural macros, run Cargo build
scripts, or reproduce full crate/build-target semantics. A locally clean file
can still fail deployment, and a local warning does not block deployment.

Downloadable starter files:

- [Cargo.toml](/helpers/bwf-mod/Cargo.toml)
- [server-lib.rs](/helpers/bwf-mod/server-lib.rs)
- [client-hud-lib.rs](/helpers/bwf-mod/client-hud-lib.rs)
- [machine-readable authoring checklist](/helpers/bwf-mod/authoring-checklist.txt)

## Project shape

Every deployment sends a JSON source map with this minimum shape:

```text
Cargo.toml
src/lib.rs
```

Use the platform SDK pin:

```toml
[dependencies]
crowdy-compute-sdk = "0.1.5"
```

The server compiles offline against its pinned SDK and vendored dependency
sources. The browser worker's embedded platform index helps with names,
signatures, and hover text, but does not resolve arbitrary crates. Do not add
arbitrary dependencies; only the platform allow-list is accepted by the
authoritative server compile.

## Server mod

Server mods run in game-api **as the current grid owner**, never as a visitor
or the original marketplace author. They are confined to that grid and may
tick, receive events, or expose an invoke entry:

```rust
fn on_init() {}

fn on_tick(_dt: u32) {
    // Read/write only inside the owned grid.
}

fn on_invoke(_payload: &[u8]) -> Vec<u8> {
    Vec::new()
}

crowdy_compute_sdk::register_module!(
    init: on_init,
    tick: on_tick,
    invoke: on_invoke
);
```

Use **Test draft** while iterating when you want server spatial egress
suppressed from other sessions. **Deploy live** compiles and enables the server
module after admission and quota checks.

## Client HUD mod

Client mods run in the visitor's browser worker. They have no DOM, token,
network, or unrestricted world access. Presentation crosses a host call and
the game renders it in a mod-owned HUD region:

```rust
use crowdy_compute_sdk::{api, host_call};
use serde_json::json;

fn on_init() {}

fn on_tick(_dt: u32) {
    let info = match host_call("grid_info", json!({})) {
        Ok(value) => value,
        Err(_) => return,
    };
    let low = &info["low"];
    let parse = |v: &serde_json::Value| v.as_str()?.parse::<i64>().ok();
    let Some(x) = parse(&low["x"]) else { return };
    let Some(y) = parse(&low["y"]) else { return };
    let Some(z) = parse(&low["z"]) else { return };
    let actors = api::actors_list(x, y, z)
        .unwrap_or_else(|_| json!({ "actors": [] }));
    let _ = host_call(
        "hud_set",
        json!({ "payload": { "kind": "presence", "actors": actors["actors"] } }),
    );
}

fn on_invoke(_payload: &[u8]) -> Vec<u8> { Vec::new() }

crowdy_compute_sdk::register_module!(
    init: on_init,
    tick: on_tick,
    invoke: on_invoke
);
```

The downloadable client helper uses compile-ready control flow without the
abbreviations in this explanation.

## Bundle server and client halves

In a full-stack project, set distinct server and client module names and keep
the pairing requirement enabled. **Deploy live** autosaves one coherent
revision, compiles CLIENT first and SERVER second, binds the requirement only
after both compiles succeed, enables the server, and hot-swaps the exact client
artifact. The edge pins immutable versions; a partial compile failure never
writes a new requirement.

Visitors entering the grid see one trust prompt for the author. It displays
the aggregate server+client capability summary. Widening capabilities requires
fresh trust; removing capabilities can retain trust only when the server can
prove the new summary is strictly narrower.

## Debugging

- **Compile failed:** read the rustc log in the panel; server compilation is
  authoritative even if the local parser showed no problem.
- **No completion/diagnostics:** deployment still works. Check that the browser
  can load the same-origin module-worker and parser/grammar WASM assets, then
  reopen the panel. If local language startup fails, the editor deliberately
  falls back to the textarea, which is the only fallback.
- **Deploy refused:** inspect the quota meter and typed gate reason.
- **Client HUD does not appear:** confirm visitor trust, `run_client_code`,
  current grid presence, and that the attachment remains active.
- **Server does not tick:** the grid must contain a Buddy-confirmed live actor;
  empty grids suspend tick modules.

See [Crowdy Studio and player client mods](/crowdyjs/player-client-mods) for
host integration and sandbox details, and
[Player code](/game-api/player-code) for the server-side API model.
