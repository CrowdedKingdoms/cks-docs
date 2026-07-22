fn on_init() {}

fn on_tick(_dt: u32) {
    // Read or update only resources inside this module's owned grid.
    // Add crowdy_compute_sdk::api calls for your mechanic here.
}

fn on_invoke(payload: &[u8]) -> Vec<u8> {
    // Parse a client tool / automation request and return opaque bytes.
    payload.to_vec()
}

crowdy_compute_sdk::register_module!(
    init: on_init,
    tick: on_tick,
    invoke: on_invoke
);
