use crowdy_compute_sdk::{api, host_call};
use serde_json::json;

fn grid_origin() -> Option<(i64, i64, i64)> {
    let info = host_call("grid_info", json!({})).ok()?;
    let low = info.get("low")?;
    let parse = |value: &serde_json::Value| value.as_str()?.parse::<i64>().ok();
    Some((
        parse(low.get("x")?)?,
        parse(low.get("y")?)?,
        parse(low.get("z")?)?,
    ))
}

fn on_init() {}

fn on_tick(_dt: u32) {
    let Some((x, y, z)) = grid_origin() else {
        return;
    };
    let actors =
        api::actors_list(x, y, z).unwrap_or_else(|_| json!({ "actors": [] }));
    let count = actors
        .get("actors")
        .and_then(|value| value.as_array())
        .map(|value| value.len())
        .unwrap_or(0);
    let _ = host_call(
        "hud_set",
        json!({
            "payload": {
                "kind": "presence",
                "chunk": [x, y, z],
                "actors": count
            }
        }),
    );
}

fn on_invoke(_payload: &[u8]) -> Vec<u8> {
    Vec::new()
}

crowdy_compute_sdk::register_module!(
    init: on_init,
    tick: on_tick,
    invoke: on_invoke
);
