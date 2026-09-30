---
slug: unreal-and-ck-exec-names
sidebar_position: 10
title: Unreal and ck-exec names
description: The Unreal SDK's name for each part of a Server Object next to the name ck-exec uses for it, for reading the platform's pages, its operations tools and its logs.
---

# Unreal and ck-exec names

:::note
Server Objects run on [ck-exec](/exec/intro). The tagged v2.17.0 plugin does not have them; see [What's Changed](../guides/whats-changed.md#unreleased-after-v2170).
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
| Save Interval Seconds | `persist_every_ms` |
| Idle Timeout Seconds | `evict_after_ms` |
| The type's server code, generated into `Server/<Type Name>/` by **Generate Server Code** | the type's crate, built into the module its manifest entry names |
| Your code in `logic.rs`, implementing `Functions` | the hub's handlers: the generated `lib.rs` implements `Hub` and calls yours |
| Deploy on the Server Compute page, and `-op=deploy` | a build (`execBuild`) then a deploy (`execDeploy`) of a manifest that lists every type under a `root` hub type |
| Version: one deploy, listed on the Versions tab of the Server Compute page, with **Make active** to go back | a version (`execVersions`); activating an earlier one is `execActivateVersion`, a rollback |
| Switch off and Switch on for a type | the kill switch, `execSetEnabled` with a node type; calls are refused with `Denied` meanwhile |
| A call and its log lines: click a line's flow to follow it | a flow, the 32 hex digits every line of one call carries (`execLogs`) |
| The Activity tab of the Server Compute page | `execEndpointStats`, calls per endpoint |

Spokes, mods and CLIENT halves have no Unreal SDK counterpart yet.

Two platform names show up where you might not expect them. `read` is the method the SDK calls to fetch the watched values, which is why no Server Function may use that name. And `state` is the one topic every Server Object's server code publishes its changes on.

## Related

- [What a Server Object is](./overview.md)
- [ck-exec overview](/exec/intro)
