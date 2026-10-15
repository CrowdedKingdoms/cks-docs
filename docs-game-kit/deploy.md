---
sidebar_position: 6
title: Deploying the starters
---

# Deploying the starters

`kit.topology` turns "my game uses sessions and NPCs" into a deployed app: it reads the starter
packs the platform carries, composes a manifest with the types you pick and the ones they need,
checks it as the execution manager would, builds the crates on the platform and deploys them. It
needs an org admin with `manage_compute`, on the identity session.

```ts
const dev = client.kit(appId, { developer: true }); // the identity session
const plan = await dev.topology.plan(['session', 'npcs']);
// plan.types: world (the root), matchmaker (session's parent), session, npcs
// plan.crates: world-tick, matchmaker, session, npc-mobs
const { version, buildId } = await dev.topology.deploy(plan);
```

- **`plan(select, { overrides })`** adds each type's parent up to the root and each type it calls,
  keeps only the `calls` the plan holds, and merges your overrides into a type: a seed
  (`seed_b64`, the starter's JSON config), limits, scopes, `client`. It refuses what the manager
  would refuse (an undefined parent or callee, replicas on a hub, an unknown scope) and more crates
  than one build takes (16).
- **`deploy(plan)`** builds the plan's crates (about a minute and a half for the four first
  starters), waits, and deploys the manifest with the build. A failed build's log ends the error.
- **`kitManifestProblems(manifest)`** checks a manifest of your own the same way.

A genre starter takes its config from its seed. A private run that posts its depth to a
leaderboard, for instance, brings the `leaderboard` type it calls and names the board:

```ts
const runConfig = { floors: 3, rooms_per_floor: 4, board: 'deepest' };
const plan = await dev.topology.plan(['instance'], {
  overrides: { instance: { seed_b64: btoa(JSON.stringify(runConfig)) } },
});
// plan.types: world, instance, leaderboard
```

CrowdyCPP's `topology()` blocks (`plan(...).problems`, `deploy(plan)` with `ok` and `error`);
CrowdyPy's is async like the rest of its client.

## Your own version of a starter

The starters are a beginning, not a black box. Fetch one (`exec.starters`, or `ckx-kit new
session my-game` from the public kit), change its rules, test it natively with `cargo test`
against `ckx_sdk::testing`, and [build](/exec/builds) and deploy your crate in its place. Keep its
endpoints and topics, and the kit's clients drive it as they drove the starter; name the type
something else and tell the kit (`nodes: { session: 'duel' }`).

## What the starters need

- **A compute toolchain with the starters** on the environment you deploy to: ckx-sdk 0.10.0 for
  the world, matchmaking, session and npcs starters, 0.11.0 for the genre starters. The starters
  and `ckx_sdk::kit` come with it.
- **The `world.read` scope** for `npcs`, `territory` and `zone`, which read where players are. The
  planned manifest carries it. An `instance` with a `volume` also needs `grids.write` and
  `permissions.write`, which you add in its overrides.
- **Players in the world** for an area's mobs and pets, a control point and a circle: these hubs
  see the players whose actors are in the world near them, so a player who is not in the world is
  refused with `not_in_area` by an area and never counted on a point or in a circle.
