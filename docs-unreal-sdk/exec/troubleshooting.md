---
slug: troubleshooting
sidebar_position: 9
title: Troubleshooting
description: What to check when a Server Object stays in Connecting or fails, a value is not what you expect, or a call is refused (every call outcome and the refusals that come from your server code), and how to watch one work with crowdy.exec.trace. It applies to Blueprint and C++ alike.
---

# Troubleshooting

:::note
Server Objects run on [ck-exec](/exec/intro).
:::

This page is for Blueprint and C++ alike. In Blueprint, **Get Status** and **Get Failure Reason** are the nodes for what `GetStatus()` and `GetFailureReason()` answer in C++, and **On Failed** carries the **Outcome**, **Reason** and **Retryable** that `OnDone` receives. On a **Call** node those three pins are in the advanced area: click the small arrow at the bottom of the node to show them.

## A Server Object does not become Ready

Read its status first; the four statuses are on [Get a Server Object](./from-cpp/get-a-server-object.md#status). Then the reason it gives.

### Waiting is not failing

Most problems on the server clear up by themselves, so reading and watching a Server Object recover from every temporary one without your help. Before its first values arrive, a Server Object waits them out in **Connecting** instead of failing. It keeps trying, a little less often each time and never more than 10 seconds apart, and becomes Ready on its own once the cause is gone. While it waits, `GetFailureReason()` says what it is waiting for. It waits when:

- the type is not deployed on the server yet;
- the type is switched off on the server;
- the server does not let players use the type;
- the server code crashed and its Server Object is restarting;
- the server did not answer in time, or failed internally;
- the server code refused the read, such as `unreadable` when the state holds a value players cannot read (see [refusals from your server code](#refusals-from-your-server-code));
- the server is busy or cannot be reached.

So a game can acquire its Server Objects before their server code is deployed, and they come up as soon as it is.

### What makes it fail

A Server Object moves to **Failed**, and stays there, only when waiting cannot help:

- this player may not read it: an [Owner Only](./from-cpp/get-a-server-object.md#owner-only-types) Server Object that belongs to someone else;
- the deployed server code does not serve the variables players can see, or was built for another version of the SDK: generate and deploy it again;
- the values the server sends do not match the definition's State struct: the definition and the deployed code are out of step, so generate and deploy again;
- the server refused the SDK's request as malformed;
- the player signed out (`The player signed out`).

To try again after a failure, call `Acquire` again with the same definition and Instance Id, from the same owner or another; in Blueprint, call **Rejoin** on the component. The same object starts over from Connecting, and its values start from the definition's defaults.

## A value is not what you expect

- **A newer server sends an enum value this build does not have.** The field keeps its default and the SDK logs a warning once, under `LogCrowdyExec`. Update the game, or keep the value's old name under **Enum Value Names** if it was a rename.
- **The connection dropped.** Changes made while it was gone are not replayed. The SDK reads the values again when it reconnects and reports the fields that differ as one change. See [Get a Server Object](./from-cpp/get-a-server-object.md#sign-out-shutdown-and-dropped-connections).
- **The values stopped changing, or never arrived.** Check `GetStatus()` and `GetFailureReason()`. A Server Object waiting in Connecting (its type not deployed yet, or switched off) or one that has Failed keeps the last values it had, and the reason says what it is waiting for or why it stopped. See [Status](./from-cpp/get-a-server-object.md#status).

## Outcomes

`Outcome` is an `ECrowdyServerCallOutcome`. The platform's own status is in brackets.

| Outcome | What happened | What to do |
|---|---|---|
| Success [`Ok`] | The server code ran and answered. `Reply` holds the outputs. | Nothing. The watched values change for everyone, you included. |
| ServerError [`AppError`, `Internal`] | The server code refused the call or failed, or the platform failed handling it. `Reason` carries the message. Also returned when the reply does not fit the function's outputs. | Show or log `Reason`. See [refusals from your server code](#refusals-from-your-server-code). |
| Busy [`Busy`, `RateLimited`] | The server stayed busy through every retry. | Try again later, and call less often. |
| Unavailable [`Unavailable`, `Moved`] | The server could not be reached, so the call may or may not have run; or the Server Object has Failed (`Reason` is its failure reason). Not retried by the SDK. | Check `GetStatus()`. Call again only if running the function twice is harmless, or after the watched values show it did not happen. |
| NotDeployed [`NotFound`] | This type is not deployed on the server. The Server Object itself waits in Connecting until it is. | Deploy the type's server code to the app. |
| Timeout [`DeadlineExceeded`] | The server did not answer in time. The call may or may not have taken effect. | Watch the values before you call again. |
| Denied [`Denied`] | The server refused this player: the platform does not let players call this type at all, or the type's own server code refused them by a rule in the asset, such as **Callable By**, **Owner Only** or a **Cooldown**. `Reason` says why. | Show `Reason`. A refusal by a rule stays a refusal until something changes, except a cooldown, which is `bRetryable`: call again after the seconds it names. See [refusals from your server code](#refusals-from-your-server-code). |
| ServerCrashed [`Trapped`] | The server code crashed handling the call. The Server Object restarts on the server from its last save, so its most recent changes may be lost; the SDK reads its values again and reports what differs. | Read the server code's log. |
| BadRequest [`BadRequest`] | The call could not be sent as asked: an unknown function name, params of the wrong struct, or params that could not be encoded. `Reason` says which. | Fix the call. |
| Canceled | The Server Object was given back, or the player signed out, before the call finished. | Nothing, usually; the owner is gone or the session ended. |

## Refusals from your server code

A refusal whose message starts with one of these words came from the [server code generated for the type](./write-server-logic.md#what-the-generated-code-does-for-you), not from your own logic:

- `unknown_method`: the deployed server code has no such function. The definition is newer than what is deployed; generate and deploy the server code again. It reaches `OnDone` as a `ServerError`.
- `denied`: a player called a function they may not: **Server Only**, **Members** or **Leader** without being one, or, on an Owner Only type, a Server Object that is not theirs. It reaches `OnDone` as `Denied`, and `Reason` is the text after the word, such as "only members may call Deposit". A Server Only function is one no player may call, so a call from a game client is refused this way every time; only other server code and developer tools can call it. Set it back to **Players** in the [definition asset](./create-a-type.md#callable-by) if players should be able to. Deploy the type again afterwards, since the server code carries the choice.
- `cooldown`: the player called a function inside its **Cooldown**. It reaches `OnDone` as `Denied` with `bRetryable` set, and `Reason` says how many seconds to wait, such as "Feed can be called again in 4 s".
- `bad_params`: the server could not read the params, or a number is outside its **Value Range** (`bad_params: Amount must be 1 to 100`), and the rest of the reason names the field. Usually the deployed code is older than the definition. It reaches `OnDone` as a `ServerError`.
- `unreadable`: the Server Object's state holds a value no Unreal client could read, such as text in an `FGuid` field that is not a GUID, often one loaded from a save that older server code made. The rest of the reason names the field, such as `unreadable: Id: the server state holds a value players cannot read: a GUID is not in a form Unreal reads`. Reads are refused until your server code replaces the value, so players' Server Objects wait in Connecting with this as their reason and become Ready by themselves once it is fixed. See [the values every client can read](./write-server-logic.md#what-the-generated-code-does-for-you).
- `bad_seed`: the starting values given to a new Server Object hold a value no Unreal client could read, and the rest of the reason names the field. The Server Object does not start.
- `the change was not kept`: the call or hook would have put such a value into a watched field, or the reply held one, so the state went back to what it was. It reaches `OnDone` as a `ServerError`.

The [full list of what a refused player sees](./access-members-and-timers.md#what-a-refused-player-sees) is on the members page.

Any other `ServerError` reason is the message your server code refused with, such as the beacon saying it is full.

## Seeing what a Server Object is doing

When a Server Object never becomes Ready, stops changing, or two players disagree about it, turn on `crowdy.exec.trace`. It is off by default, and the warnings and errors print whether it is on or not. Turn it on in the editor's console (press the backtick key, in Play In Editor too):

```text
crowdy.exec.trace 1
```

or, for a packaged game or an editor started from the command line, add this to the command line:

```text
-ini:Engine:[ConsoleVariables]:crowdy.exec.trace=1
```

The lines go to the Output Log under `LogCrowdyExec`, at Log verbosity, each starting with `exec:`, then the type and Instance Id (`boss/boss-1`). An [Owner Only](./from-cpp/get-a-server-object.md#owner-only-types) Server Object prints `owner` in place of the Instance Id, so the player's user id never reaches the log. For a shared boss being hit by two players, one player's log reads:

```text
exec: boss/boss-1 status Connecting -> Ready
exec: boss/boss-1 subscribe ok
exec: boss/boss-1 read applied epoch=3 seq=41 changed=Health,MaxHealth,Phase,Respawns,Hits,LastHitBy
exec: boss/boss-1 call Hit sent
exec: boss/boss-1 push applied epoch=3 seq=42 changed=Health,Hits,LastHitBy
exec: boss/boss-1 call Hit answered Success ms=63
exec: boss/boss-1 push applied epoch=3 seq=43 changed=Health,Phase,Hits,LastHitBy
exec: boss/boss-1 push stale epoch=3 seq=43
exec: boss/boss-1 call Hit sent
exec: boss/boss-1 call Hit answered Denied ms=41
exec: connection closed
exec: redial ok
exec: boss/boss-1 reread reason=reconnect
exec: boss/boss-1 read applied epoch=3 seq=47 changed=Health,Hits,LastHitBy
```

What it prints:

- **Status changes**, such as `status Connecting -> Ready`.
- **Every read and push that was applied**, with its `epoch`, its `seq` and the names of the variables that changed (`changed=-` when none did). The `epoch` changes when the server restarts the Server Object, and `seq` orders its changes. The `seq` printed is the one the SDK applied, so if two players' logs show the same `epoch` and `seq` lines, they saw the same changes. The names come in the order Watch Variables reports them. A push that is older than what the object already has prints `push stale`, with the object's current `epoch` and `seq`, and is not applied.
- **Why it read again**, as `reread reason=` followed by `gap` (a change was missed), `overflow` (so many changes arrived while a read was in flight that they could not all be held), `epoch` (the server restarted the object), `reconnect` (the connection came back) or `ownerOnly` (an [Owner Only](./from-cpp/get-a-server-object.md#owner-only-types) or Members type, which tells watchers to read instead of sending the values).
- **Subscribes**, as `subscribe ok` or `subscribe failed` followed by the reason.
- **Calls**: `call Hit sent`, and `call Hit answered` with the [outcome](#outcomes) and how many milliseconds the answer took. A call the SDK retries for you because the server was busy prints `sent` once.
- **Connection**: `exec: dial failed` with the reason when the first connection could not be made, `exec: connection closed` when an open one drops, then `exec: redial ok` or `exec: redial failed` with the reason. Every `redial ok` is preceded by a `connection closed`. A close on purpose names why, and no redial follows it: `exec: connection closed (no Server Object in use)`, `(signed out)` or `(shutting down)`. The next Server Object you get opens a fresh connection.

It prints the names of the variables that changed, never their values, and never a token. Turn it off again with `crowdy.exec.trace 0` once you have your answer, since a busy fight writes a line for every hit.

## Related

- [Get a Server Object, from Blueprint](./from-blueprint/get-a-server-object.md) and [from C++](./from-cpp/get-a-server-object.md): the statuses, and what sign-out and a dropped connection do
- [Read and follow its variables, from Blueprint](./from-blueprint/read-and-follow-variables.md) and [from C++](./from-cpp/read-and-follow-variables.md)
- [Call its functions, from Blueprint](./from-blueprint/call-functions.md) and [from C++](./from-cpp/call-functions.md): what the SDK retries
- [Access, members and timers](./access-members-and-timers.md#what-a-refused-player-sees): every refusal a rule in the asset can cause
- [Deploy it with Server Compute](./deploy-with-server-compute.md): the Logs tab and the Activity tab
- [ck-exec operations](/exec/operations): logs, including a crashed call's
