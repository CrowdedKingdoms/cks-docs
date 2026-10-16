---
slug: unreal-and-ck-exec-names
sidebar_position: 10
title: Unreal and ck-exec names
description: The Unreal SDK's name for each part of a Server Object next to the name ck-exec uses for it, for reading the platform's pages, its operations tools and its logs.
---

# Unreal and ck-exec names

:::note
Server Objects run on [ck-exec](/exec/intro).
:::

The SDK names things the way an Unreal project would. The platform's [ck-exec pages](/exec/intro), its operations tools and its logs use their own words. This table maps one to the other.

| Unreal SDK | ck-exec |
|---|---|
| Server Object type: one definition asset, `UCrowdyServerObjectDefinition` | hub node type |
| Type Name | node type name |
| Server Object: `UCrowdyServerObject`, from `UCrowdyServerObjectSubsystem` | a hub instance |
| Instance Id | instance key |
| Variables: the State Struct, or the variables added in the asset | the hub's state, kept in its snapshots |
| Server Function | method |
| Server Name of a function | method name |
| Calling a Server Function: `UCrowdyServerObject::Call` | a call |
| Call outcome: `ECrowdyServerCallOutcome` | reply status (mapped on [Troubleshooting](./troubleshooting.md#outcomes)) |
| Variables Visible to Players, and following them: `WatchValues` | the hub's `state` topic, subscribed to, and its `read` method |
| Server message, sent by `messages::send_...` | a topic the hub publishes on (any topic but `state`) |
| Server Name of a message | topic |
| Listening to a message: `WatchMessage` in a game, `listen::<type>::<message>` in server code | subscribing to a hub instance's topic |
| Listen To | the types in the manifest's `calls`, which may subscribe |
| Kind: Server Function Library | a spoke node type, `"kind": "spoke"` in the manifest |
| Min Instances | `replicas` |
| Max Instances | `max_replicas` |
| Parallel Calls per Instance | `concurrency` |
| Calling a library: `UCrowdyServerObjectLibrary::CallLibraryFunction`, the **Call** node with no Target | a call to the spoke with the empty key; the platform picks an instance |
| Can Call Any Type | `"calls": ["*"]`; in server code, `calls::any` over `ctx.call` |
| Save Interval Seconds | `persist_every_ms` |
| Idle Timeout Seconds | `evict_after_ms` |
| The type's server code, generated into `Server/<Type Name>/` by **Generate Server Code** | the type's crate, built into the module its manifest entry names |
| Your code in `logic.rs`, implementing `Functions` | the hub's handlers: the generated `lib.rs` implements `Hub` and calls yours. For a library, it implements `Spoke` |
| Deploy on the Server Compute page, and `-op=deploy` | a build (`execBuild`) then a deploy (`execDeploy`) of a manifest that lists every type under a `root` hub type |
| Version: one deploy, listed on the Versions tab of the Server Compute page, with **Make active** to go back | a version (`execVersions`); activating an earlier one is `execActivateVersion`, a rollback |
| Switch off and Switch on for a type | the kill switch, `execSetEnabled` with a node type; calls are refused with `Paused` meanwhile |
| A call and its log lines: click a line's flow to follow it | a flow, the 32 hex digits every line of one call carries (`execLogs`) |
| The Activity tab of the Server Compute page | `execEndpointStats`, calls per endpoint |

Mods and CLIENT halves have no Unreal SDK counterpart yet. A spoke is a [Server Function Library](./server-function-libraries.md).

Two platform names show up where you might not expect them. `read` is the method the SDK calls to fetch the watched values, which is why no Server Function may use that name. And `state` is the topic every Server Object's server code publishes its variable changes on; a message cannot use it.

## Related

- [What a Server Object is](./overview.md)
- [Make a Server Function Library](./server-function-libraries.md)
- [ck-exec overview](/exec/intro)
