---
slug: get-a-server-object
sidebar_position: 1
title: Get a Server Object
description: Acquire a Server Object from UCrowdyServerObjectSubsystem, how owners share one object and when it is given back, the four statuses, Owner Only types, and what sign-out, map travel and a dropped connection do.
---

# Get a Server Object

:::note
Server Objects run on [ck-exec](/exec/intro).
:::

A game never creates a `UCrowdyServerObject` itself. It asks `UCrowdyServerObjectSubsystem`, a game instance subsystem, for the one matching a [definition asset](../create-a-type.md) and an Instance Id, and names an owner: the object that needs it. The subsystem keeps the Server Object connected for as long as it has an owner, and shares it between every owner that asks for the same one.

## Acquire it

The beacon acquires its Server Object in `BeginPlay`, with itself as the owner and the village's name as the Instance Id. `BeaconDefinition` is the asset from [Create a Server Object type](../create-a-type.md), picked in the Details panel.

<CppSnippet id="so-acquire" />

`Acquire(Definition, InstanceId, Owner, OutError)` returns the Server Object, or null with `OutError` saying why:

- The definition cannot be used: it is missing, it has a problem the editor reported when you saved it, or a struct changed since it was saved.
- The Instance Id is not valid. It must be 1 to 256 bytes of UTF-8 with no control characters (`An Instance Id must be 1 to 256 bytes with no control characters`).
- There is no owner (`Acquire needs an owner`).

Instance Ids are case-sensitive: `oakford` and `Oakford` are two Server Objects.

You can acquire before the player has signed in. The Server Object waits in **Connecting** until the connection opens, and the subsystem keeps trying to open it while any Server Object needs one.

## One object, many owners

Every owner that acquires the same definition and Instance Id gets the same `UCrowdyServerObject`: one set of values, one stream of changes, and one connection to the server between them. Two beacons in the same village, or a beacon and a HUD widget showing its oil, share it.

The subsystem holds owners weakly. You do not have to give a Server Object back: when every owner has been destroyed, a grace period starts, `UCrowdyServerObjectSubsystem::GracePeriodSeconds` (10 seconds). An owner that acquires it again inside that time gets the same object back, values and all. When the grace period runs out, the Server Object is **Released** and forgotten; the next `Acquire` starts a fresh one.

- **Map travel.** The grace period does not run while the game instance is loading a map. A beacon destroyed by leaving one map and acquired again by a beacon in the next reuses the same Server Object, with no gap in its values.
- **Giving it back early.** `Release(Object, Owner)` stops one owner holding it, as if that owner had been destroyed. Use it for an owner that lives on after it stops needing the Server Object, such as a pooled widget.

## Status

A Server Object is always in one of four statuses, `ECrowdyServerObjectStatus`. Read the current one with `GetStatus()`; `OnStatusChanged`, an `FOnCrowdyServerObjectStatusChanged`, runs on every change after you acquire. `GetDefinition()` and `GetInstanceId()` return what it was acquired with.

| Status | Meaning |
|---|---|
| Connecting | Joining the Server Object and reading its variables for the first time, or waiting until the server can answer. |
| Ready | Its variables are current and its functions can be called. |
| Failed | It cannot be used. `GetFailureReason()` says why. Acquiring it again tries afresh. |
| Released | Given back. Nothing on it works any more. |

The beacon goes dark when its Server Object fails, rather than show oil it can no longer vouch for:

<CppSnippet id="so-status" />

A Server Object that waits in Connecting, or one that fails, says why in `GetFailureReason()`; see [A Server Object does not become Ready](../troubleshooting.md#a-server-object-does-not-become-ready). To see what one is doing, turn on [`crowdy.exec.trace`](../troubleshooting.md#seeing-what-a-server-object-is-doing).

## Owner Only types

A definition whose **Visibility** is **Owner Only** describes a Server Object that belongs to one player, such as a player's own stash. Its Instance Id must be the owning player's user id in decimal, which you get from `UCrowdyGameSession`: `LexToString(Session->GetUserID())`. Only that player can read its values or call its functions; for anyone else it fails as soon as the server refuses to show them.

For a group's shared object that only its members read, see **Members** under [Readable By](../access-members-and-timers.md#readable-by). Everything else works the same way. Each change reaches the owner a moment later than on a Public type, because the SDK fetches the new values when the server says they changed, instead of receiving them with the notice.

## Sign-out, shutdown and dropped connections

- **Sign-out.** When the player signs out, every Server Object fails with `The player signed out`, and every call still waiting finishes as `Canceled`. After the player signs in again, acquire them again.
- **Shutdown.** When the game instance shuts down, every Server Object is released quietly: no status change, no value change, and calls still waiting do not run their completion.
- **A dropped connection.** The SDK reconnects by itself and starts watching again. Changes made while it was gone are not replayed, so it reads the variables again and reports whatever differs as one change. Your code sees at most one extra change event.

## Related

- [Read and follow its variables](./read-and-follow-variables.md)
- [Call its functions](./call-functions.md)
- [Get a Server Object, from Blueprint](../from-blueprint/get-a-server-object.md): the same thing without C++
- [Troubleshooting](../troubleshooting.md): why a Server Object waits or fails, and `crowdy.exec.trace`
- [Player sign-in](../../runtime/player-sign-in.md)
