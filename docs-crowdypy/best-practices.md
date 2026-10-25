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
- **No warm-up send.** The replication server (v0.42.0 and later) holds your
  first message until your session and the chunk's permissions are ready, and
  `*_and_wait` retries a session's first awaited send once against an older
  server (CrowdyPy 0.20.0). A plain send right after connecting can still be
  lost on an older server. An awaited actor or voxel update still waiting when
  the connection is reassigned is resent as soon as the new session is
  connected, rather than at its timeout (CrowdyPy 0.21.0).
- **Use the World Stores for game state.** `session.tick()` applies everything
  natively and never waits on the network. Run it from your loop with
  `session.run()` or your own scheduler.
- **Handle errors by code.** Branch on `CrowdyGraphQLError.code` and the
  `CrowdyError` subclasses, not on message text.
