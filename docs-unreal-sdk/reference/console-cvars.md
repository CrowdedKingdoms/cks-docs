---
slug: console-cvars
sidebar_position: 6
title: Console Variables and Logs
---

# Console Variables and Logs

A quick lookup of the console variables and log categories the SDK ships.

For how to use them while debugging, see [Debugging and Logging](/unreal-sdk/runtime/debugging-and-logging).

## Trace variables

Each trace variable gates the informational logging for one area of the SDK.

- They are all off by default (value 0).
- Warnings and errors are always logged, regardless of the trace setting.
- Set one in the console, for example `crowdy.rpc.trace 1`.

| Variable | Area |
| --- | --- |
| `crowdy.sdk.trace` | Top level SDK: subsystem lifecycle and configuration. |
| `crowdy.net.trace` | UDP transport: socket open and close, sends and receives, worker pool. |
| `crowdy.query.trace` | GraphQL: query dispatch, responses, and subscription lifecycle. |
| `crowdy.serialize.trace` | Payload serialization: message encode and decode, registry resolves. High frequency. |
| `crowdy.entity.trace` | Entities: registry changes, event routing and dispatch, actor tracking. |
| `crowdy.pool.trace` | Actor pool: spawn, release, reuse, and rendering backend churn. |
| `crowdy.rpc.trace` | Every CrowdyEvent send and receive: function, entity, addressing, byte size. |
| `crowdy.rpc.reliable.trace` | Only the reliable channel transport path for Multicast events. |
| `crowdy.state.trace` | Crowdy State property replication: per-delta send and receive, entity, changed-property count, byte size, and whether the delta went out spatially, to the owner only, as a keyframe, or over the reliable channel for a replicated subsystem. Safe to share: it logs ids and byte counts, never property values or tokens. |
| `crowdy.services.trace` | Services: authentication, teams, avatars, persistence, host, utilities. |
| `crowdy.hud.trace` | The SDK HUD base and widgets. |
| `crowdy.voice.trace` | Voice chat: subsystem, capture and playback, device monitoring. |
| `crowdy.studio.trace` | The Crowdy Studio console GraphQL operations. Editor only. The bearer token is never logged. |

:::caution
`crowdy.serialize.trace` is high frequency. It logs every message encode and decode, so leave it off unless you are actively debugging serialization.
:::

## Behavior variables

These change behavior rather than logging.

| Variable | Effect |
| --- | --- |
| `crowdy.rpc.loopback` | When non-zero, a CrowdyEvent you send is also delivered to your own receive path, so you can test the full round trip with a single client. |
| `crowdy.state.loopback` | When non-zero, the single-client sibling of `crowdy.rpc.loopback` for Crowdy State. Each owned, tracked entity gets a lazily spawned local mirror (a distinct RemoteProxy entity with its own NetID), and every outgoing delta is replayed onto the mirror through the real receive path, so decode and OnRep fire with just one PIE client. Off by default. |
| `crowdy.rpc.allowObjectLoad` | When non-zero, a received object or class reference whose asset is not already loaded is loaded from disk by path. Off by default so an untrusted peer cannot trigger arbitrary asset loads; an unresolved reference is delivered as null. |

:::warning
Leave `crowdy.rpc.allowObjectLoad` off in production. While it is off, an untrusted peer cannot trigger arbitrary asset loads, and an unresolved reference is delivered as null.
:::

## Log categories

Each module logs under its own category.

Enable verbose output for one with, for example, `Log LogCrowdyRPC Verbose`.

| Category | Module |
| --- | --- |
| `LogCrowdySDK` | CrowdySDK |
| `LogCrowdyNet` | CrowdyNet |
| `LogCrowdyReplication` | CrowdyReplication |
| `LogCrowdyRPC` | CrowdyReplication (RPC) |
| `LogCrowdyServices` | CrowdyServices |
| `LogCrowdyVoice` | CrowdyVoice |
| `LogCrowdyStudio` | CrowdyStudio (editor) |
| `LogCrowdyEditor` | CrowdySDKEditor (editor) |

:::note
Info level lines are gated behind the matching trace variable; warnings and errors always print. Turn on the trace variable for the area you are debugging, then read the matching log category.
:::
