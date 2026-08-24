---
sidebar_position: 26
title: "Compute tutorial: zero to a live module"
---

# Compute tutorial: zero to a live module

This is the fastest path from nothing to **server-side code running on your
game's servers** — budget 30 minutes end to end, most of it reading. It uses
[CrowdyJS](/crowdyjs/intro), the same package your game client already installs, and
nothing else.

Everything here is the [Compute Modules](/game-api/compute-modules) GraphQL
surface underneath. The SDK is a typed shortcut to it, not a separate product:
each step names the field it calls, so you can drop to raw GraphQL — or to any
other language — at any point.

This tutorial assumes compute is the right tier. For the decision criteria
and the recommended hybrid pattern, see
[Model API vs Compute](/game-api/model-vs-compute).

## 0. Prerequisites (~4 min)

- **Node 20+** and the SDK:

```bash
npm install @crowdedkingdoms/crowdyjs@15.1.0
```

  **Version 15.0.0 or newer is required** — `auth.login` arrived in 15.0.0,
  which was a breaking release. The compute methods below are in both 15.0.0
  and 15.1.0. Pin exactly rather than with a caret: a caret never matches a
  prerelease, so `^15.0.0` silently skips the `dev` and `test` builds.

- **An app** you administer. Your user needs the org `manage_compute`
  permission, on an environment with compute enabled.

- **Your environment's GraphQL origin.** Do not copy one out of a tutorial —
  this page named a dead host for months. Take it from your environment's
  dashboard, and see below for the per-app URL the platform hands you.

- **Optional**, only for compiling locally before you deploy: a Rust toolchain
  with `rustup target add wasm32-wasip1`. You do not need it. The platform
  compiles your source when you deploy.

## 1. Sign in and get a client (~2 min)

```js
import { createCrowdyClient } from "@crowdedkingdoms/crowdyjs";

const client = createCrowdyClient({
  httpUrl: "https://<your environment's origin>/graphql",
  wsUrl:   "https://<your environment's origin>/graphql",
});

await client.auth.login({ email: "you@example.com", password: process.env.PASSWORD });

const APP_ID = "<your app id>";
const app = await client.portal.mintAppToken(APP_ID);
client.setToken(app.token);
```

`mintAppToken` also returns **`gameApiUrl`** and **`gameApiWsUrl`** — the Game
API actually serving your app, which lives in one datacenter. If they are
non-null, build your working client with those instead of the origin you
started from; you will be talking to the datacenter holding your data rather
than to whichever one DNS chose.

## 2. A live module, with no Rust at all (~3 min)

The platform ships a **registry of ready-made engines** and serves them from
your environment. You do not fetch, build, or vendor them — you name one and
it deploys. Ask what is available:

```js
const templates = await client.compute.templates({ appId: APP_ID });
templates.forEach((t) => console.log(t.name, "—", t.description, "| exports:", t.exports));
```

That is the `computeTemplates` query. Deploy one:

```js
const mod = await client.compute.deployTemplate({
  appId: APP_ID,
  templateName: "mob-engine",
  moduleName: "my-mobs",        // optional; defaults to the template name
});
```

`computeDeployTemplate` is **one call in place of four**: it upserts the
module, publishes the template source (deduped by hash), binds the template's
triggers, and enables it. Compilation runs asynchronously, so wait for it:

```js
const version = await client.compute.waitForCompile(APP_ID, "my-mobs", { timeoutMs: 180_000 });
console.log(version.compileStatus, version.compiledSizeBytes, "bytes");
```

You now have server-side code running against your world, and you have written
none. The engines are **data-driven** — behaviour comes from model containers
such as `MobDef` and `EncounterDef` — so the intended path is to parameterize
one rather than fork it. See [Compute engines](/game-api/compute-engines).

## 3. Watch it and call it (~3 min)

```js
const stats = await client.compute.moduleStats({ appId: APP_ID, windowMinutes: 60 });
const logs  = await client.compute.moduleLogs({ appId: APP_ID, moduleName: "my-mobs", limit: 20 });
const runs  = await client.compute.moduleRuns({ appId: APP_ID, moduleName: "my-mobs", limit: 20 });

const result = await client.compute.invoke({
  appId: APP_ID,
  moduleName: "my-mobs",
  exportName: "status",
  paramsJson: JSON.stringify({}),
});
```

Those are `computeModuleStats`, `computeModuleLogs`, `computeModuleRuns` and
`computeInvoke`. Polling the first three on a timer is the whole of a "watch"
loop; `invoke` is the synchronous RPC path into a module's exports.

Note that **`moduleStats` is app-wide, not per-module** — it takes a look-back
window (default 60 minutes, max 1440) and summarises every module's activity
together. `moduleLogs` and `moduleRuns` are the two that narrow to one module,
and `moduleName` is optional on both.

For a health view across every module at once, including breaker state and
fuel, use `client.compute.appDiagnostics({ appId: APP_ID })`.

## 4. Your own module (~8 min)

A module is a small Rust crate compiled to WASM. You upload **source**, as
plain strings — there is no local build step, no bundler, and no artefact to
produce. Two files are required:

```js
const sourceFiles = {
  "Cargo.toml": `
[package]
name = "my-module"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
crowdy-compute-sdk = "0.1.5"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
`.trim(),
  "src/lib.rs": "/* your module */",
};
```

Then the four-step lifecycle the template call did for you:

```js
await client.compute.upsertModule({ appId: APP_ID, name: "my-module", description: "..." });

await client.compute.deployVersion({
  appId: APP_ID,
  moduleName: "my-module",
  sourceFiles,                 // the SDK JSON-encodes this into sourceFilesJson
  sdkVersion: "0.1.5",         // must match your Cargo.toml — see below
  abiVersion: 0,
});

const v = await client.compute.waitForCompile(APP_ID, "my-module", { timeoutMs: 180_000 });
if (v.compileStatus !== "succeeded") throw new Error(v.compileLog);

await client.compute.upsertTrigger({
  appId: APP_ID, moduleName: "my-module", triggerType: "tick", tickHz: 2,
});
await client.compute.setModuleEnabled({ appId: APP_ID, name: "my-module", enabled: true });
```

**Pass `sdkVersion` explicitly and keep it equal to your `Cargo.toml`.** The
SDK will default it from a constant baked into whichever CrowdyJS version you
installed, and that constant can lag the platform — 15.1.0 defaults to
`0.1.3` while `0.1.5` is current. Supported values are `0.0.1` and
`0.1.0`–`0.1.5`, with ABI `0`; there is no query that lists them, so treat the
[Compute Modules](/game-api/compute-modules) page as the reference.

Redeploying identical source is wasted work, so check the hash first:

```js
const [latest] = await client.compute.moduleVersions({ appId: APP_ID, moduleName: "my-module", limit: 1 });
// latest.sourceHash — compare before calling deployVersion again
```

The constraints your source must satisfy — the file layout, the size caps, the
dependency allowlist, and the ban on build scripts — are all listed under
[writing a module](/game-api/compute-modules#writing-a-module). They are
enforced at deploy time, so a violation comes back as a `BadRequestException`
naming the field rather than as a compile error.

## 5. Tour the registry (~10 min of reading)

`computeTemplates` is the catalogue, and it is worth reading through once
because most games find their shape in it rather than starting from an empty
crate. Each entry lists its `exports` — the names you can `invoke`.

The registry covers NPC and mob simulation, world simulation, match and
matchmaking flow, decks and boards, instances and directors, markets,
minigames, abilities, territory, racing, possession, movement validation, and
live-ops scheduling.

Because they are parameterized by model containers, two modules can run the
same engine with different data side by side — that is what the `moduleName`
override in step 2 is for.

## Where to go next

- [Compute engines](/game-api/compute-engines) — the registry in depth, and
  which containers parameterize each engine.
- [Compute Modules](/game-api/compute-modules) — concepts, the full lifecycle,
  limits, and billing.
- [Compute host API](/game-api/compute-host-api) — everything a module can
  call: world reads and writes, model invocation, actors, events, presence,
  and randomness.
