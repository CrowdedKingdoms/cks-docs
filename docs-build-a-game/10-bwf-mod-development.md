---
sidebar_position: 10
title: Build mods with Crowdy Studio
---

# Build mods with Crowdy Studio

Blocks with Friends (BWF) embeds Crowdy Studio for player-authored server and
client Rust mods. A server mod is a [ck-exec mod](/exec/mods) on your grid; a
client mod is that mod's [CLIENT half](/exec/client-halves), which runs in each
visitor's browser. This guide is for a mod developer using the game, not a
studio operator deploying platform infrastructure.

## Open Crowdy Studio

1. Enter BWF with an app-scoped game token.
2. Stand inside a grid you own and that grants the code keys:
   `write_server_code` and `run_server_code` for a server mod,
   `write_client_code` and `run_client_code` for a client mod.
3. Press **M**.
4. Open or create a server, client, or full-stack project. You can copy an
   app-provided starter from **Common Files** into either target.

Crowdy Studio opens Monaco with target-aware `Cargo.toml` and `src/*.rs` tabs.
Rust syntax colors, parser diagnostics, workspace completion, hover, symbols,
and workspace-local navigation run in a lazily loaded browser module worker.
The worker loads local parser/grammar WASM; it has no authoring endpoint and
receives no game token. Its feedback is advisory. **Test draft** and **Deploy
live** run the authoritative platform build.

On desktop, Crowdy Studio opens in a resizable right-hand dock so the running
game remains visible. Drag the divider (or focus it and use the arrow keys) to
balance the game and editor. Click the game to return to pointer-lock controls,
then click the editor to code; the panes isolate their keyboard input. Narrow
screens use the full-screen editor.

Edits autosave to the cloud, but they do not change the running grid until you
select **Test draft** or **Deploy live**. This keeps builds and
neighbor-visible effects explicit while still letting you observe the updated
server mod or hot-swapped CLIENT worker without closing the studio.

The local worker is a parser and indexed-symbol service, not rustc or
rust-analyzer. It cannot prove borrow/lifetime correctness, perform complete
trait resolution or type inference, expand procedural macros, run Cargo build
scripts, or reproduce full crate/build-target semantics. A locally clean file
can still fail deployment, and a local warning does not block deployment.

A new project's server target starts from the platform's mod starter. For a
client mod, download:

- [Cargo.toml](/helpers/bwf-mod/Cargo.toml)
- [client-hud-lib.rs](/helpers/bwf-mod/client-hud-lib.rs)
- [machine-readable authoring checklist](/helpers/bwf-mod/authoring-checklist.txt)

## Project shape

Each target is a crate, and every deployment sends it with this minimum shape:

```text
Cargo.toml
src/lib.rs
```

A server mod is a `ckx-sdk` crate whose dependencies are `ckx-sdk`, `serde`
and `serde_json` only; see [what a crate may
contain](/exec/builds#what-a-crate-may-contain). A client mod is a
`crowdy-client-sdk` crate whose dependencies are `crowdy-client-sdk`, `serde`
and `serde_json` only; see [the crate](/exec/client-halves#the-crate):

```toml
[dependencies]
crowdy-client-sdk = "0.1.0"
serde_json = "1"
```

A client crate still on the legacy `crowdy-compute-sdk` is refused before any
build.

The platform builds both offline, in a sandbox, against its pinned SDKs. The
browser worker's embedded platform index helps with names, signatures, and
hover text, but does not resolve arbitrary crates. Do not add arbitrary
dependencies; the authoritative build refuses anything outside its allow-list.

## Server mod

A server mod is a [ck-exec mod](/exec/mods): a hub that runs **as the current
grid owner**, never as a visitor or the original marketplace author, in the
owner's own sandbox. The mod starter is a `ckx-sdk` crate that greets visitors
and follows what happens in its grid. Players standing in the grid call the
mod's endpoints by name. It reads the grid's chunks, voxels and actors, writes
voxels inside the grid while its owner holds `update_voxel_data`, and hears
the grid's world events; it calls no other node and sends no realtime events.
See [what a mod can do](/exec/mods#what-a-mod-can-do).

**Test draft** and **Deploy live** both build the server crate, deploy it to
the grid as the mod `mod:<server module name>`, and switch it on. Switching a
mod on needs the app's code admission.

## Client HUD mod

Client mods run in the visitor's browser worker. They have no DOM, token,
network, or unrestricted world access. Presentation crosses a host call and
the game renders it in a mod-owned HUD region:

```rust
use crowdy_client_sdk::{api, host_call};
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

crowdy_client_sdk::register_module!(
    init: on_init,
    tick: on_tick,
    invoke: on_invoke
);
```

The downloadable client helper uses compile-ready control flow without the
abbreviations in this explanation. [What it can
call](/exec/client-halves#what-it-can-call) lists every host call.

### Tick rate and mouse input

A CLIENT worker ticks once a second by default. Ask for a faster loop in the
crate's `Cargo.toml` — it is the only key admitted under
`[package.metadata.crowdy]`, a whole number of milliseconds, clamped to
16–1000:

```toml
[package.metadata.crowdy]
tick_interval_ms = 50   # 16..1000; default 1000
```

Inside `on_tick`, `api::pointer_clicks()` drains the mouse clicks the host game
(the holodeck canvas) collected since the previous call. It is CLIENT-only and
lives in the `input` capability group (rate cap 400 calls/s). The value is
`{ nowMs, buttons, holdingMs, clicks }`: `buttons` is the live `MouseEvent.buttons`
bitfield (1 = left held), `holdingMs` maps a button index to how long it has been
held (`"0"` = left), and `clicks` is the drained list of
`{ t: "down" | "up", button, atMs, heldMs?, nx, ny }` with canvas NDC (`nx`/`ny`
in −1..1, +ny up). Clicks on Studio chrome are omitted, so a mod can be tested
with the IDE open. A click-to-charge shot: start on a left `down`, draw the power
bar from `holdingMs["0"]`, fire on the left `up` using its `heldMs`.

```rust
fn on_tick(_dt: u32) {
    let input = match api::pointer_clicks() { Ok(v) => v, Err(_) => return };
    if let Some(clicks) = input["clicks"].as_array() {
        for c in clicks {
            if c["t"] == "up" && c["button"] == 0 {
                let charge_ms = c["heldMs"].as_u64().unwrap_or(0);
                // fire toward (nx, ny) with charge_ms …
            }
        }
    }
}
```

## Bundle server and client halves

In a full-stack project the client target is the server mod's CLIENT half:
the mod is named for the server module, and its CLIENT half rides it. **Deploy
live** autosaves one coherent revision and builds CLIENT first and SERVER
second, so a client failure never deploys a new server version. Only after
both builds succeed does it deploy and switch the server mod on, attach the
CLIENT half to it, and hot-swap your preview to the served module. There is
no pairing to set: a CLIENT half belongs to its mod.

A visitor's browser runs your CLIENT half only once they have agreed to it:
consented to it at its capability hash, or trusted you as its author on this
grid. The capability summary they are shown is derived from the built
module, and a version that can do something new is asked about again. See
[what a visitor is asked](/exec/mods#what-a-visitor-is-asked).

## Debugging

- **Build failed:** read the build log in the panel; the platform's build is
  authoritative even if the local parser showed no problem.
- **No completion/diagnostics:** deployment still works. Check that the browser
  can load the same-origin module-worker and parser/grammar WASM assets, then
  reopen the panel. If local language startup fails, the editor deliberately
  falls back to the textarea, which is the only fallback.
- **Deploy refused:** read the message. You have one build at a time, server
  or client (`RATE_LIMITED` while another runs); attaching needs you to own
  the grid with `write_client_code` and the app's code admission; see [CLIENT
  half errors](/exec/client-halves#errors).
- **Client HUD does not appear:** confirm the visitor consented or trusts
  you, holds `run_client_code` and stands in the grid, and that the mod is
  switched on with its CLIENT half attached.
- **Server mod does not answer:** check that it is switched on and that the
  app admits it. A mod that is switched on but not running starts when an
  actor arrives in its grid or a player calls it.

See [Crowdy Studio and mods in the browser](/crowdyjs/player-client-mods) for
host integration and sandbox details, [mods](/exec/mods) for the server-side
API, and [CLIENT halves](/exec/client-halves) for the client side.
