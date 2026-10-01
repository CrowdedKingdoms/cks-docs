---
slug: studio
sidebar_position: 6
title: Studio and player host
---

# Studio and player host

## Headless Crowdy Studio

`crowdypy.studio.CrowdyStudioController` is the Crowdy Studio editor without a
browser, so a tool or a test can drive a project as the Studio does. It can:

- open a project and edit its files, with autosave and optimistic revisions
  (two sessions saving at once produce a conflict you resolve either way);
- bind a GitHub repository;
- apply agent patches with checkpoints;
- build, deploy and run the project as a ck-exec mod.

```python
from crowdypy.studio import CrowdyStudioController

studio = CrowdyStudioController.for_client(game, app_id=app_id, grid_id=grid_id)
studio.subscribe(lambda state: print(state.save_state, state.runtime.phase))
await studio.initialize()  # opens the first project
studio.update_file("SERVER", "src/lib.rs", source)  # autosaves
result = await studio.test_draft()  # build, deploy and switch on the mod
print(result.status, studio.get_state().build_output)
```

A SERVER target builds and deploys as a ck-exec mod. A CLIENT target builds as
that mod's CLIENT half and runs in the host you pass as `broker_factory`; the
browser Studio runs it in a Web Worker. Compiler output becomes
`authoritative_diagnostics` (`parse_rustc_diagnostics`). The pane layout
(`StudioLayoutController`) is persisted in the same format the browser Studio
uses.

## Player-host observation

`crowdypy.player_host` is the typed contract a game implements so tooling can
read the player it controls and its surroundings:

- `PlayerHostAdapterV1`, with `capabilities()` and `observe()`;
- the observation, capability and command types;
- the JSON Schemas that validate them.

`validate_json_schema_value` checks a value against a schema and accepts and
refuses exactly what CrowdyJS does. Coordinates, distances and health are
decimal strings, so no value loses precision.
