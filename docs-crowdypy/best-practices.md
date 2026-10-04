---
slug: best-practices
sidebar_position: 7
title: Best practices
---

# Best practices

- **Batch on the hot path.** In a game loop, send a frame's entities with
  `send_actor_updates` and read notifications with `connection.batches()`. A
  handler per notification is convenient, but it calls into Python once per
  event.
- **Keep columns as views.** Batch columns and actor snapshots are numpy views
  of native memory. Index and filter them in numpy, and copy only what you
  keep.
- **One game client per app.** Point it at the minted `game_api_url` with
  `discovery_url` set, and let `refresh_gameplay_token()` keep its token
  current. The UDP connection keeps its server across a refresh.
- **Warm up the first chunk.** Right after connecting, the server may refuse
  spatial sends until it has loaded your grid permissions. Send an actor update
  and wait for its echo before you rely on sends being accepted.
- **Use the World Stores for game state.** `session.tick()` applies everything
  natively and never waits on the network. Run it from your loop with
  `session.run()` or your own scheduler.
- **Handle errors by code.** Branch on `CrowdyGraphQLError.code` and the
  `CrowdyError` subclasses, not on message text.
