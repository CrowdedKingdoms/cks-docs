---
sidebar_position: 10
title: Build mods in Blocks with Friends
---

# Build mods in Blocks with Friends

Blocks with Friends (BWF) provides an in-world Rust IDE for player-authored
server and client mods. This guide is for a mod developer using the game,
not a studio operator deploying platform infrastructure.

## Open the editor

1. Enter BWF with an app-scoped game token.
2. Stand inside a grid you own and that grants the player-code write/run keys.
3. Press **M**.
4. Pick `server` or `client`, then choose a starter template.

The panel opens Monaco with separate `Cargo.toml` and `src/lib.rs` tabs. Rust
syntax colors work locally. Completion, hover, navigation, and inline
diagnostics come from rust-analyzer. They are advisory; **Deploy** invokes the
authoritative platform compiler.

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

The service compiles offline against the same pinned SDK and vendored
dependency sources used by rust-analyzer. Do not add arbitrary crates; only
the platform allow-list is accepted.

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

Use **Deploy draft** while iterating when you want server spatial egress
suppressed from other sessions. A normal Deploy compiles and enables the
server module after admission and quota checks.

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

Deploy and successfully compile the client module first, then the server
module. In the panel:

1. choose the server under **Server mod**;
2. choose the client under **Requires client mod**;
3. select **Set requirement**.

The edge pins the current immutable versions. Deploying a new server version
removes the old attachment until you compile and bind the new version.

Visitors entering the grid see one trust prompt for the author. It displays
the aggregate server+client capability summary. Widening capabilities requires
fresh trust; removing capabilities can retain trust only when the server can
prove the new summary is strictly narrower.

## Debugging

- **Compile failed:** read the rustc log in the panel; server compilation is
  authoritative even if rust-analyzer showed no problem.
- **No completion/diagnostics:** syntax colors and Deploy still work. Reopen the
  panel after the authoring service reconnects.
- **Deploy refused:** inspect the quota meter and typed gate reason.
- **Client HUD does not appear:** confirm visitor trust, `run_client_code`,
  current grid presence, and that the attachment remains active.
- **Server does not tick:** the grid must contain a Buddy-confirmed live actor;
  empty grids suspend tick modules.

See [Player client mods and live coding](/crowdyjs/player-client-mods) for host
integration and sandbox details, and [Player code](/game-api/player-code) for
the server-side API model.
