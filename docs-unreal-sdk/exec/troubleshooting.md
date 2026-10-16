---
slug: troubleshooting
sidebar_position: 9
title: Troubleshooting
description: What to check when a Server Object stays in Connecting or fails, a value is not what you expect, a message never arrives (Players Can Listen, a closed connection, a refused listen, the subscription limits), or a call is refused (every call outcome and the refusals that come from your server code), a call to a Server Function Library from server code that fails on its first, cold call, a library that will not save (Members and Leader callers, a Cooldown, Max Instances below Min Instances), and how to watch one work with crowdy.exec.trace. It applies to Blueprint and C++ alike.
---

# Troubleshooting

:::note
Server Objects run on [ck-exec](/exec/intro).
:::

This page is for Blueprint and C++ alike. In Blueprint, **Get Status** and **Get Failure Reason** are the nodes for what `GetStatus()` and `GetFailureReason()` answer in C++, and **On Failed** carries the **Outcome**, **Reason** and **Retryable** that `OnDone` receives. On a **Call** node those three pins are in the advanced area: click the small arrow at the bottom of the node to show them.

## A Server Object does not become Ready

Read its status first; the four statuses are on [Get a Server Object](./from-cpp/get-a-server-object.md#status). Then the reason it gives.

### Waiting is not failing

Most problems on the server clear up by themselves, so reading and watching a Server Object recover from every temporary one without your help. Before its first values arrive, a Server Object waits them out in **Connecting** instead of failing. It keeps trying, a little less often each time and, unless the server asks for longer, never more than 15 seconds apart, and becomes Ready on its own once the cause is gone. Every wait before a retry or a redial is stretched by a random amount, up to half again: a failed read's first retry waits 1 to 1.5 seconds, and a lost connection is redialled after 1 to 1.5 seconds, then 2 to 3, and so on up to 30 to 45. So many players do not retry in step after a server restart. While it waits, `GetFailureReason()` says what it is waiting for. It waits when:

- the type is not deployed on the server yet;
- the type is switched off on the server, or the whole app is switched off or paused (by its owner, or because it ran out of funds): the reason reads "The server is switched off or paused, so this Server Object waits: " followed by the platform's own words, such as "`village_beacon` is switched off in app 456" or "app 456 is switched off". To show the player a message instead of retrying, see [When the app is paused](../services/authentication.md#when-the-app-is-paused);
- the server does not let players use the type;
- the server code crashed and its Server Object is restarting;
- the server did not answer in time, or failed internally;
- the server code refused the read, such as `unreadable` when the state holds a value players cannot read (see [refusals from your server code](#refusals-from-your-server-code));
- the server is busy or cannot be reached; when the platform could not start the Server Object to read it, for example because the app is at its instance or memory limit, the reason reads "The server could not be reached: " followed by the platform's words;
- the connection to the server could not be opened: the reason reads "Could not open the connection to the server for `<Type Name>`: " followed by why, and names the type the SDK tried it with. When the refusal is that the server is switched off or paused, it reads "The server is switched off or paused for `<Type Name>`: " followed by the error instead. A try made with the root or a Server Function Library names no type, since the platform is not told one: "Could not open the connection to the server: " or "The server is switched off or paused: ". The next try uses another type's Server Object, so one type that is not deployed or is switched off does not hold up the others.

So a game can acquire its Server Objects before their server code is deployed, and they come up as soon as it is.

### What makes it fail

A Server Object moves to **Failed**, and stays there, only when waiting cannot help:

- this player may not read it: an [Owner Only](./from-cpp/get-a-server-object.md#owner-only-types) Server Object that belongs to someone else;
- the deployed server code does not serve the variables players can see, or was built for another version of the SDK: generate and deploy it again;
- the values the server sends do not match the definition's State struct: the definition and the deployed code are out of step, so generate and deploy again;
- the server refused the SDK's request as malformed;
- the Game API named a Server Object gateway outside its own domains, so the SDK will not connect to it: the reason reads "Could not open the connection to the server: the Game API named a gateway outside its own domains (" followed by why and "); if you host the server yourself, add its domain to Allowed Exec Gateway Domains in Project Settings". It is not retried until you acquire an object again (or call Restart). See [Server Object gateway domains](../reference/project-settings.md#server-object-gateway-domains) for the setting;
- the player signed out (`The player signed out`);
- the player's access to the game ended (`Your access ended: ` followed by the reason); see [When access ends](#when-access-ends).

To try again after a failure, call `Acquire` again with the same definition and Instance Id, from the same owner or another; in Blueprint, call **Rejoin** on the component. The same object starts over from Connecting, and its values start from the definition's defaults.

### When access ends

A player's access to the game can end while they play: it is suspended, revoked or expired, the platform signs the player out, or the account is blocked. The Game Session fires **On Access Ended** (see [When the player's access ends](../services/authentication.md#when-the-players-access-ends)) and Server Objects stop:

- Every Server Object fails with `Your access ended: ` followed by the reason, whatever its status was.
- A call in flight, and every call made afterwards, finishes as the outcome **Access Ended** (`ECrowdyServerCallOutcome::AccessEnded`), with the same reason. It is not retryable.
- Nothing reconnects or retries by itself, since the server would refuse it.

Show the reason and send the player back to sign in. A successful sign-in clears the ended state: a **Crowdy Server Object** component and a typed node set to **Find By Asset** get their Server Object again on their own. Code that called `Acquire` itself calls it again.

## A value is not what you expect

- **A newer server sends an enum value this build does not have.** The field keeps its default and the SDK logs a warning once, under `LogCrowdyExec`. Update the game, or keep the value's old name under **Enum Value Names** if it was a rename.
- **The connection dropped.** Changes made while it was gone are not replayed. The SDK reads the values again when it reconnects and reports the fields that differ as one change. See [Get a Server Object](./from-cpp/get-a-server-object.md#sign-out-shutdown-and-dropped-connections).
- **The values stopped changing, or never arrived.** Check `GetStatus()` and `GetFailureReason()`. A Server Object waiting in Connecting (its type not deployed yet, or switched off) or one that has Failed keeps the last values it had, and the reason says what it is waiting for or why it stopped. See [Status](./from-cpp/get-a-server-object.md#status).

## A message never arrives

A [message](./create-a-type.md#server-messages) is heard once, when the server sends it, and nothing keeps it. When a game or a Server Object expects one and gets nothing, check these in order.

**In a game, from Blueprint or C++:**

- **Players Can Listen is off.** Only the server code of a type that Listens To this one hears the message. A Blueprint **Received** node for it does not compile ("heard only by other Server Object types; turn on Players Can Listen"), and **Watch Message** or `WatchMessage` logs "... is heard only by other Server Object types; turn on Players Can Listen to hear it in a game" once and does nothing. Tick it in the asset, then generate and deploy the type. Likewise a name the definition does not have logs "... has no message named ..., so nothing can listen to it".
- **The deployed server does not send it yet.** A message you added, renamed or changed reaches the server only with the generated code and a deploy; see [After you change the definition](./write-server-logic.md#after-you-change-the-definition).
- **The function that sends it did not succeed.** A message is published only when the function that sent it succeeds, after its changes. A refusal sends nothing; look at the caller's `Reason` and the server code's [logs](./deploy-with-server-compute.md).
- **The game was not listening at that moment.** A message sent before the game started listening, or while its connection was closed, is lost and never replayed. Check `GetStatus()`: a Server Object that is not Ready announces nothing, and a message that arrives while it is still reading its values is held and announced once they are current, at most 32 of them. Past 32 the oldest is dropped and the log warns "held back 32 messages while reading its values, so the oldest was dropped".
- **The platform refused to let the player listen.** The log warns once, "`<Type Name>` could not listen to its `<Message>` message, so it is asked again after a wait: " followed by the platform's reason. The SDK asks again after a wait that grows from 1 second to 30, and nothing else about the Server Object fails. A message sent while the listen is refused is lost.
- **A limit was reached.** A connection allows 256 subscriptions, and each time the game listens it counts against the 120 calls a connection may make every 10 seconds. Each message a game listens to on each Server Object is one subscription, so many objects with several messages each can reach it: give back the objects the game no longer needs, and listen only to the messages it uses.
- **The message comes before the change it follows.** A type that keeps [a record per entity](./keep-a-record-per-entity.md) sends its records in batches, so a message sent right after a record changed can arrive first. Put what the listener needs into the payload.
- **The payload does not fit its struct.** The message is dropped with a warning that names it. The definition and the deployed code are out of step: generate and deploy again.

**In server code, listening to another type:**

- **The listen was never applied.** A `listen::...` call takes effect only when the function that made it succeeds, and the function fails, with `could not listen to boss.boss_defeated:` and the reason, when the platform refuses it. A type can listen to 256 messages at once. Check the function's result.
- **The key is not the sender's.** The key is the sender's Instance Id, with capitals significant: `boss-1` and `Boss-1` are two Server Objects.
- **The sender is not in Listen To.** Without it the `listen` functions and the `on_<type>_<message>` handler do not exist; see [Listen to a message](./write-server-logic.md#listen-to-a-message). Generate and deploy after adding it.
- **The message was sent too early.** One sent before the listen was applied, or while the listener was stopped, is missed.
- **The handler failed.** A handler that returns an error puts its state back, and a payload it cannot read fails it with `bad_message: <type>.<message>: ...`; read the logs.

## Outcomes

`Outcome` is an `ECrowdyServerCallOutcome`. The platform's own status is in brackets.

| Outcome | What happened | What to do |
|---|---|---|
| Success [`Ok`] | The server code ran and answered. `Reply` holds the outputs. | Nothing. The watched values change for everyone, you included. |
| ServerError [`AppError`, `Internal`] | The server code refused the call or failed, or the platform failed handling it. `Reason` carries the message. Also returned when the reply does not fit the function's outputs. | Show or log `Reason`. See [refusals from your server code](#refusals-from-your-server-code). |
| Busy [`Busy`, `RateLimited`] | The server stayed busy through every retry. | Try again later, and call less often. If one Server Object takes many calls at once, raise **Calls Waiting** in the type's [Server Limits](./create-a-type.md#every-setting). |
| Unavailable [`Unavailable`, `Moved`] | The server could not be reached, so the call may or may not have run; or the Server Object has Failed (`Reason` is its failure reason). When the platform says why, such as the app being at its instance limit, `Reason` adds its words after "The server could not be reached:". Not retried by the SDK. | Check `GetStatus()`. Call again only if running the function twice is harmless, or after the watched values show it did not happen. |
| NotDeployed [`NotFound`] | This type is not deployed on the server. The Server Object itself waits in Connecting until it is. | Deploy the type's server code to the app. |
| Timeout [`DeadlineExceeded`] | Nobody answered in time, and `Reason` says which side gave up. "AttackBoss ran past its Time per Call on the server: handler exceeded its deadline" means the server's own limit stopped the call (the type's **Time per Call**, 2 seconds unless changed), followed by the server's message; for a read it reads "The server took longer than this type's Time per Call to read this Server Object" (or "watch"). "The server sent no answer in time; the connection may be slow or lost" means no answer reached the game within the project's **Server Object Call Timeout** (20 seconds unless changed; see [Project settings](../reference/project-settings.md#server-object-timeouts)): the longest **Time per Call** (10 seconds) plus time spent waiting behind other calls on the server. "No answer within 5 seconds; FeedBeacon may still have run on the server" means the call's own **Timeout** ran out first (5 seconds here); it is not retryable, and an answer that arrives later is not reported. The call may or may not have taken effect. A call past **Time per Call** also restarts that Server Object from its last save, so changes since the last save are lost. | Watch the values before you call again. If the function does real work that needs longer, raise **Time per Call** in the type's [Server Limits](./create-a-type.md#every-setting); otherwise keep functions short, and set **Save Every** low on a type whose recent changes matter. **Time per Call** counts the function only, not the time a call waits behind others. A call that gives up earlier than the project's timeout has a **Timeout** set on its Call node (`TimeoutSeconds` in C++); clear it, or raise it, if the server needs longer. |
| Denied [`Denied`] | The server refused the call. Either the platform refused it, because players may not call this type at all, and `Reason` reads "The server refused the call to Feed: " followed by the platform's words; or the type's own server code refused the player by a rule in the asset, such as **Callable By**, **Owner Only** or a **Cooldown**, and `Reason` says why. A call refused because the server is switched off or paused is [Paused](#outcomes), not Denied. | Show `Reason`. A refusal by a rule stays a refusal until something changes, except a cooldown, which is `bRetryable`: call again after the seconds it names. See [refusals from your server code](#refusals-from-your-server-code). |
| Paused | The game's server, or this type, is switched off or paused, by its owner or because the app ran out of funds. It is retryable, and `Reason` reads "The server is switched off or paused, so it refused the call to Feed: " followed by the platform's words, such as "`village_beacon` is switched off in app 456", "app 456 is switched off" or "app 456 is paused: ...". | Try again later, or show the player a paused message; see [When the app is paused](../services/authentication.md#when-the-app-is-paused). Code that only checked for Denied should handle Paused too, and a Blueprint Switch on the outcome has a **Paused** pin. |
| AccessEnded | The player's access to the game ended: suspended, revoked, expired, signed out by the platform, or the account blocked. `Reason` reads `Your access ended: ` followed by why. Not retryable, and it applies to every Server Object until the player signs in again. | Show `Reason` and return the player to sign in; see [When access ends](#when-access-ends). A Blueprint Switch on the outcome has an **Access Ended** pin. |
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
- `the change was not kept`: the call or hook would have put such a value into a watched field, or the reply held one, or a message it sent held one or was larger than 1 MiB, so the state went back to what it was. It reaches `OnDone` as a `ServerError`.
- `bad_message`: a message this type listens to could not be read as its payload, as in `bad_message: boss.boss_defeated: ...`. The handler fails and the state goes back; the sender's definition and this type's deployed code are out of step, so generate and deploy both again.

The [full list of what a refused player sees](./access-members-and-timers.md#what-a-refused-player-sees) is on the members page.

Any other `ServerError` reason is the message your server code refused with, such as the beacon saying it is full.

## A call to a library from server code fails

The first call to a [Server Function Library](./server-function-libraries.md) after it has been idle can take over a second. A player's game just waits for it. A Server Object's function that calls the library is held to the platform's call deadline, and a call that outlasts it fails with "call deadline passed" although the library may still finish. A boss that rolls loot when it falls sees it as `loot_roller.roll_loot failed: call deadline passed`.

- **Decide what a failed call means.** If the answer is optional, as a drop is, take it only when the call came back: `if let Ok(loot) = calls::loot_roller::roll_loot(ctx, &roll) { ... }`, as in [Loot for the Hollow Giant](./examples/hollow-giant-loot.md#the-boss-rolls-on-its-fall).
- **Call again once when the function is safe to repeat.** A pure calculation is. The second call finds the library warm:

  ```rust
  let loot = calls::loot_roller::roll_loot(ctx, &roll).or_else(|_| calls::loot_roller::roll_loot(ctx, &roll))?;
  ```

  Do not repeat a call that changes a Server Object unless repeating it is harmless; see [Call other Server Objects](./access-members-and-timers.md#call-other-server-objects).
- **The helper does not exist.** `calls::loot_roller` is made only when the caller lists the library under **Can Call**, or the caller uses `calls::any` with **Can Call Any Type**. Add it, generate the caller's server code and deploy again.
- **`app N has no node type`.** A call by `calls::any` named a type the app does not run, or misspelled it. Deploy does not check names given to `calls::any`.
- **`denied`.** A player called a function that is **Server Only** ("players may not call this function") or **Developers Only** ("only developer tools may call this function"). Other server code can call a Server Only one, and developer tools both; see [Callable By](./create-a-type.md#callable-by).
- **Unavailable, with the platform's words.** The app is at its limit on running Server Objects, and every instance of the library counts toward it; see [Scaling](./server-function-libraries.md#scaling).

A function that sees a value reset between two calls is working as designed: a library keeps nothing, and each instance runs several copies of your code with their own memory. Keep the value in a Server Object.

## Library calls time out during a burst

A burst of calls that each keep the processor busy, such as many loot rolls at once, can come back as **Timeout** with "ran past its Time per Call on the server", even though one call alone is quick. The calls an instance runs at the same time share its processor, and **Time per Call** counts the time that passes, not the work done. The platform adds an instance only after calls have waited 2 seconds, so the first moments of a burst all land on the instances already running. In a test with one instance running four calls at once, 300 ms of work per call, and two players each sending 24 at once, a Time per Call of 2000 ms failed some calls and 5000 ms answered all of them.

- **Give the function room.** Raise **Time per Call** to cover **Parallel Calls per Instance** times the work one call does.
- **Start with more instances.** Raise **Min Instances** when bursts are expected, such as when a round ends and every player opens a chest.
- **Run fewer at once per instance.** A lower **Parallel Calls per Instance** gives each call more of the processor; raise **Max Instances** to keep the total.

## A Server Function Library will not save

Saving shows these for a library, and they are the whole list besides the usual checks of its Type Name, functions and server names:

| Message | What to do |
|---|---|
| "RollLoot: Members and Leader need members, and a Server Function Library has none." | Set the function's **Callable By** to **Players**, **Server Only** or **Developers Only**. |
| "RollLoot: a cooldown is saved data, and a Server Function Library saves none." | Set its **Cooldown** to 0. To limit how often a player may call, put the function on a Server Object. |
| "Max Instances must be at least Min Instances." | Raise **Max Instances**, or lower **Min Instances**. They are under **Scaling**. |
| "loot_roller is a Server Function Library and sends no messages." | A Server Object lists the library under **Listen To**. Move it to **Can Call**. |

See [Checks when you save](./server-function-libraries.md#checks-when-you-save).

## A ping fails

**Ping Server Objects** (`UCrowdyServerObjectSubsystem::Ping` in C++) fails with a `Reason` instead of a round trip when:

- "No Server Object connection is open": a ping never opens a connection. Acquire a Server Object first and ping once it is Ready, or ping again after the connection comes back.
- "Too many pings: the platform answers at most 60 every 10 seconds": the platform drops the rest of a connection's pings without a word, so the SDK refuses them before sending. Ping on a timer of a second or more, not every frame.

See [Ping the platform](./from-blueprint/call-functions.md#ping-the-platform).

## Seeing what a Server Object is doing

When a Server Object never becomes Ready, stops changing, or two players disagree about it, turn on `crowdy.exec.trace`. It is off by default, and the warnings and errors print whether it is on or not. Turn it on in the editor's console (press the backtick key, in Play In Editor too):

```text
crowdy.exec.trace 1
```

or, for a packaged game or an editor started from the command line, add this to the command line:

```text
-ini:Engine:[ConsoleVariables]:crowdy.exec.trace=1
```

The lines go to the Output Log under `LogCrowdyExec`, at Log verbosity, each starting with `exec:`, then the type and Instance Id (`boss/boss-1`). An [Owner Only](./from-cpp/get-a-server-object.md#owner-only-types) Server Object prints `owner` in place of the Instance Id, so the player's user id never reaches the log. The Players Online root has no Instance Id, so it prints `-` in its place, such as `exec: root/- read applied ...`. For a shared boss being hit by two players, one player's log reads:

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
- [Hear its messages, from Blueprint](./from-blueprint/hear-server-messages.md) and [from C++](./from-cpp/hear-server-messages.md): when a message is heard, held or lost
- [Call its functions, from Blueprint](./from-blueprint/call-functions.md) and [from C++](./from-cpp/call-functions.md): what the SDK retries
- [Make a Server Function Library](./server-function-libraries.md), and calling one [from Blueprint](./from-blueprint/call-a-library.md) or [from C++](./from-cpp/call-a-library.md)
- [Access, members and timers](./access-members-and-timers.md#what-a-refused-player-sees): every refusal a rule in the asset can cause
- [Deploy it with Server Compute](./deploy-with-server-compute.md): the Logs tab and the Activity tab
- [ck-exec operations](/exec/operations): logs, including a crashed call's
