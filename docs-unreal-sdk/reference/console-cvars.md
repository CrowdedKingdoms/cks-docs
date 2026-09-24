---
slug: console-cvars
sidebar_position: 4
title: Console Variables
description: "The console surface the SDK ships: trace gates you flip to see one area's internal decisions, behavior switches that change what the SDK does, and one-shot diagnostic commands, with which of them exist in a Shipping build."
---

import SurfaceTable from '@site/src/components/SurfaceTable';

# Console Variables

The SDK exposes 38 `crowdy.*` console entries, in three kinds: trace gates that turn on informational
logging for one area, behavior switches that change what the SDK does, and diagnostic commands that run
once and hold no stored value. A row badged **Editor only** exists only in the editor process. Six of the
diagnostic commands (`crowdy.rpc.dumpfn`, `crowdy.state.heartbeat.advisories`,
`crowdy.gamemodel.watchcontainers`, `crowdy.gamemodel.unwatchcontainers`, `crowdy.gamemodel.stats`,
`crowdy.gamemodel.stats.reset`) are compiled out of a Shipping build and are absent there rather than
silent; every other row ships in Development and Shipping.

## When you land here

You want to know what a `crowdy.*` name does before you type it, or you are looking for the switch that
turns on a specific area's logging. For the workflow around them (loopback testing, two-PIE setups), see
[Testing locally](../guides/testing-locally.md); this page is the lookup table.

## Trace gates

All 16 are off by default. Fourteen turn on that area's informational lines when set to `1`; the two
`.scopes` entries add Unreal Insights CPU scopes instead and log nothing. Warnings and errors print
regardless of the setting.

<SurfaceTable table="cvars" filter="role=trace" includeEditor />

:::caution[`crowdy.serialize.trace` and `crowdy.serialize.scopes` are high frequency.]
They log on every message encode and decode. Leave them off unless you are actively debugging
serialization.
:::

:::note[`crowdy.serialize.scopes` and `crowdy.state.scopes` are nested CPU trace scopes.]
Each nests inside a wider enclosing scope, so turning one on shifts the timing you read for that
enclosing scope too. If you are taking a performance reading, say whether the flag was on.
:::

`crowdy.studio.trace` is editor only and never logs the bearer token, a pattern worth copying in your own
logging around Studio calls.

## Behavior switches

These change what the SDK does rather than what it logs. None of the 13 exist only in the editor.

<SurfaceTable
  table="cvars"
  filter="role=behaviour"
  notes={{
    "crowdy.net.receive.maxmessages": "How many inbound replication messages one frame may deliver; whatever is left waits for the next frame. Default 3072.",
    "crowdy.net.receive.maxdrainms": "How many milliseconds of one frame may be spent delivering inbound messages. Raise the message count first. Default 4.",
    "crowdy.net.send.bundle": "Pack one network pass's outbound messages into one datagram. Needs a replication server of v0.27.0 or later; against an older one every bundled message is dropped together. Default 1, read when a connection opens.",
    "crowdy.net.recv.signedbundles": "Tell the replication server this client reads signed inbound bundles, so notifications arrive with one signature per datagram instead of one per member. A server older than v0.30.0 ignores it. Default 1, read when a connection opens.",
    "crowdy.replication.tracker.maxgatheredupdates": "How many actor updates for already-tracked actors may be gathered before the backlog is discarded; reached only when the world tick is not consuming them. Default 8192."
  }}
  notesLabel="Where the Help cell is empty"
/>

The notes map above stands in for these five rows because the surface exporter drops a CVar help built from adjacent `TEXT()` literals.

:::warning[Turn `crowdy.net.http2` off if you ship, or collect logs from, a build with logging enabled.]
On by default, it asks for HTTP/2 on the SDK's own requests (falling back to HTTP/1.1 when the server does not offer it); the game's other HTTP traffic and the engine's `http.CurlAllowHTTP2` are untouched. With HTTP/2, when a request fails at the network level (not a cancel or a timeout), the curl diagnostics the engine logs at `Warning` can include the request headers, bearer token included. A default Shipping build compiles logging out, so most projects never see this; if yours ships or collects logs from a build with logging enabled, set `crowdy.net.http2 0`. See [Change pings and pull](../game-models/change-pings-and-pull.md#when-a-change-does-not-show-up) for what it does to request timing.
:::

:::note[`crowdy.net.retry.busy` resends a refusal the platform blames on itself before the caller ever sees `Failed`.]
On by default. A query resends on any platform-blamed retryable refusal except `WRONG_DATACENTER` and `APP_UNAVAILABLE`; a container ensure or a `gameModelInvoke` resends only on `PLATFORM_BUSY`, since that is the one code that means the work never started. At most 3 retries, with the server's suggested wait when it names one or a doubling local wait otherwise. Turn it off (`0`) only to compare against the un-retried behavior; leave it on for a shipping build. See [Change pings and pull](../game-models/change-pings-and-pull.md#when-a-change-does-not-show-up) for what the retry counts look like in `crowdy.gamemodel.stats`.
:::

:::warning[Leave `crowdy.rpc.allowObjectLoad` off in production.]
While it is off, an untrusted peer cannot trigger an arbitrary asset load; an unresolved object or class
reference in a received RPC is delivered as null instead.
:::

`crowdy.rpc.loopback` and `crowdy.state.loopback` are not the same switch wearing two names.
`crowdy.rpc.loopback` delivers a sent event back to your own receive path. `crowdy.state.loopback` cannot
replay onto the same actor that sent the delta: an owner's own entity drops a non-host-sourced delta, and
changed-detection on decode sees no change against identical values. Instead it spawns a distinct,
lazily-created mirror entity and replays deltas onto that, so `CrowdyOnRep` still fires with one PIE
client. Expect two entities, not one, when you turn it on.

`crowdy.net.receive.poolactorupdates` defaults to `1` (pooling on). Turning it off is for an A/B
measurement against the same build, not a fix for anything.

## Diagnostic commands

Nine commands with no stored value. Only `crowdy.rpc.dumpfn` takes arguments and prints usage without
them; every other command acts as soon as you run it, and `crowdy.schema.RetagAssets` starts resaving
assets immediately. Six are compiled out of a Shipping build: `crowdy.rpc.dumpfn`,
`crowdy.state.heartbeat.advisories`, `crowdy.gamemodel.watchcontainers`,
`crowdy.gamemodel.unwatchcontainers`, `crowdy.gamemodel.stats`, and `crowdy.gamemodel.stats.reset`.

<SurfaceTable
  table="cvars"
  filter="role=command"
  includeEditor
  notes={{
    "crowdy.rpc.dumpfn": "Not in Shipping",
    "crowdy.state.heartbeat.advisories": "Not in Shipping",
    "crowdy.gamemodel.watchcontainers": "Not in Shipping",
    "crowdy.gamemodel.unwatchcontainers": "Not in Shipping",
    "crowdy.gamemodel.stats": "Not in Shipping",
    "crowdy.gamemodel.stats.reset": "Not in Shipping",
    "crowdy.cpp.selftest": "Every build",
    "crowdy.net.routes": "Every build"
  }}
  notesLabel="Build"
/>

:::tip[`crowdy.rpc.dumpfn` and `crowdy.state.heartbeat.advisories` print structured text you can paste directly into a bug report.]
:::

:::caution[Run `crowdy.schema.RetagAssets` on a clean sync, with no other outstanding changes.]
It is a one-time migration step you run after upgrading the SDK. Expect version-stamp diff noise in the
assets it touches; that noise is expected, not a sign something went wrong.
:::

`crowdy.cpp.selftest` and `crowdy.net.routes` carry no build guard, so they exist in every build including
Shipping; the six diagnostics above do not, and a Shipping console answers them with an unknown command.
[Change pings and pull](../game-models/change-pings-and-pull.md#when-a-change-does-not-show-up) reads
`crowdy.gamemodel.stats` for broader network diagnosis, not only a single missed notification.

## Gotchas

- Warnings and errors are never gated behind a trace flag. They print under the module's log category no
  matter what.
- `crowdy.net.receive.maxdrainms` (4 ms) and `crowdy.net.receive.maxmessages` (3072) bound one frame's
  receive drain. If drains keep ending on the time budget, delivery is costing more per message than the
  frame can afford, and raising the count is not the lever.
- `crowdy.gamemodel.bulkresolve` (default `1`) makes Host-owned entities bind their Game Model containers
  from one paged list per type instead of one ensure per entity. Leave it on unless you are isolating a
  regression against the old per-entity path.
- The two Game Model watch commands, `crowdy.gamemodel.watchcontainers` and
  `crowdy.gamemodel.unwatchcontainers`, are diagnostics: they open or close a feed and log what arrives,
  but nothing is re-pulled and no cache is written from them.

## Related

- [Log categories](./log-categories.md): the category each trace gate's lines print under.
- [Project settings](./project-settings.md): the settings-class properties that sit beside these CVars.
- [Testing locally](../guides/testing-locally.md): loopback and two-PIE workflows built on these switches.
- [Change pings and pull](../game-models/change-pings-and-pull.md): where `crowdy.gamemodel.emitfallbackping`,
  the watch commands, and `crowdy.gamemodel.stats` fit in a Game Model debugging session.
