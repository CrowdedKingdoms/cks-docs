---
slug: call-functions
sidebar_position: 4
title: Call its functions
description: Call a Server Function with UCrowdyServerObject::Call, with a struct or with inputs added in the asset, and what the SDK retries for you. The call outcomes and the refusals that come from your own server code are on the troubleshooting page.
---

# Call its functions

:::note
Server Objects run on [ck-exec](/exec/intro).
:::

A client never changes a Server Object's values. It asks, by calling one of the Server Functions its [definition](../create-a-type.md) lists, and the server's code decides what happens. Each function says who can call it, with [Callable By](../create-a-type.md#callable-by): **Players**, **Members**, **Leader** or **Server Only**, which refuses a player's call. A function can also have a **Cooldown**, and a number input a **Value Range**; see [Access, members and timers](../access-members-and-timers.md). The answer comes back to the caller; the change, if there is one, reaches every player through the [variables they can see](./read-and-follow-variables.md).

## Call one

When the local player walks into the beacon, the beacon offers it ten units of oil:

<CppSnippet id="so-call" />

`Call(Function, Params, OnDone)` takes:

- **Function**: the function's **Name** on the definition, `FeedBeacon` here.
- **Params**: an `FInstancedStruct` holding the function's Input Struct, made with `FInstancedStruct::Make`. For a function with no inputs, pass an empty `FInstancedStruct()`. A function whose inputs are added in the asset takes an `FInstancedPropertyBag` instead; see [below](#call-one-with-inputs-added-in-the-asset).
- **OnDone**: runs once with an `FCrowdyServerCallResult`, on the game thread. It holds the `Outcome`, the `Reply` on success (empty for a function with no outputs), a `Reason` sentence for anything but success, and `bRetryable`, which says calling again later may succeed.

Things worth knowing before you rely on it:

- **OnDone can run before `Call` returns.** A call the SDK can refuse without asking the server (an unknown function, params of the wrong struct, a Server Object that is already Failed or Released) completes at once, inside `Call`, and sends nothing.
- **You can call while the Server Object is still Connecting.** The call waits and is sent when the connection opens. If there is still no connection after 30 seconds, it completes as `Unavailable` with `The server could not be reached`.
- **The server may do less than you asked.** The beacon's reply is how much oil it holds after the feed, as the server decided; the params are only the offer.
- **Capture your actor weakly.** OnDone can run after the actor that made the call is gone; the beacon checks a `TWeakObjectPtr` before it touches its light.
- **Only a game instance shutdown skips OnDone.** Calls still waiting then are dropped without running it. Sign-out and a released Server Object complete them as `Canceled`, and the end of the player's access completes them as `AccessEnded`; see [When access ends](../troubleshooting.md#when-access-ends).

## Call one with inputs added in the asset

When a function's inputs are [added in the asset](../create-a-type.md#variables-inputs-and-outputs-or-a-struct) rather than taken from a struct, there is no struct to make. `MakeParams(Function)` hands you a copy of the function's inputs with their default values; set the ones you want by name and pass it to the `Call` that takes an `FInstancedPropertyBag`. Outputs added in the asset are read by name too, through `CrowdyExec::ToList` from `CrowdyExecCodec.h`:

```cpp
#include "CrowdyExecCodec.h"

FInstancedPropertyBag Params = Beacon->MakeParams(TEXT("FeedBeacon"));
Params.SetValueInt32(TEXT("Oil"), 10);
Beacon->Call(TEXT("FeedBeacon"), Params, [](const FCrowdyServerCallResult& Result)
{
	const TValueOrError<int32, EPropertyBagResult> Oil = CrowdyExec::ToList(Result.Reply).GetValueInt32(TEXT("Oil"));
	UE_CLOG(Result.IsSuccess() && Oil.HasValue(), LogTemp, Log, TEXT("The beacon holds %d"), Oil.GetValue());
});
```

- `MakeParams` returns an empty `FInstancedPropertyBag` for a function whose inputs are a struct, or that has none.
- The getters return a `TValueOrError`, so a name the reply does not have is an error, not a crash.
- The two kinds do not mix: passing a struct to a function whose inputs are added in the asset completes as `BadRequest` with "FeedBeacon takes FeedBeaconParams params".

## What the SDK retries

The SDK retries a call only when the server says it did not run it: a busy server. It tries up to three times in all, with a short wait between tries that grows each time (0.25 to 0.375 seconds, then 0.5 to 0.75) and is never shorter than the wait the server asks for, up to 30 seconds. Each wait is stretched by a random amount, up to half again, so many players do not retry in step. Only when those tries are spent does OnDone see `Busy`.

Nothing else is retried, because the SDK cannot tell whether the server already ran the call. A connection that drops after the server ran a purchase, for example, looks the same from the client as one that dropped before, and sending it again could buy twice. So an unreachable server reaches OnDone as `Unavailable` with `bRetryable` set, a timeout or a crash reaches it on the first answer, a server that is switched off or paused reaches it as `Paused` with `bRetryable` set, and your game decides whether calling again is safe. Where you can, write a Server Function so that a repeated call does no harm: take an amount to reach rather than an amount to add, or let the caller send an id the server remembers and ignores the second time.

The platform limits how often one player may call your app's code (see [call limits](/exec/operations#call-limits)); a call over the limit is answered as busy and retried the same way. Do not call a Server Function every frame.

## Give up sooner

A call waits for the answer as long as the project's **Server Object Call Timeout** allows, 20 seconds unless you changed it; see [Project settings](../../reference/project-settings.md#server-object-timeouts). Both `Call` overloads take a trailing `float TimeoutSeconds`, default 0, which is a limit of its own for that one call. It is counted from the call, retries and waiting to send included, and it can only shorten the wait: a value above the project's timeout changes nothing, and 0 leaves only the project's.

```cpp
FFeedBeaconParams Params;
Params.Oil = 10;
Beacon->Call(TEXT("FeedBeacon"), FInstancedStruct::Make(Params), [](const FCrowdyServerCallResult& Result)
{
	UE_CLOG(Result.Outcome == ECrowdyServerCallOutcome::Timeout, LogTemp, Warning, TEXT("%s"), *Result.Reason);
}, 5.f);
```

When it runs out, OnDone gets `Timeout` with `bRetryable` false and a `Reason` such as "No answer within 5 seconds; FeedBeacon may still have run on the server". The server is not told to stop, so the call may still take effect, and an answer that arrives later is not reported. Check the watched values before you call again.

## Ping the platform

`UCrowdyServerObjectSubsystem::Ping(OnDone)` asks the platform for an answer over the connection the Server Objects already hold, and runs `OnDone(bOk, RoundTripMs, Reason)` once, on the game thread. `RoundTripMs` is how long the platform took to answer; `Reason` says why when `bOk` is false.

```cpp
UCrowdyServerObjectSubsystem* Objects = GetGameInstance()->GetSubsystem<UCrowdyServerObjectSubsystem>();
Objects->Ping([](bool bOk, float RoundTripMs, const FString& Reason)
{
	UE_CLOG(bOk, LogTemp, Log, TEXT("The platform answered in %.0f ms"), RoundTripMs);
});
```

It never opens a connection. With no Server Object connection open it fails at once, and OnDone runs before `Ping` returns, with "No Server Object connection is open". The platform answers at most 60 pings every 10 seconds on a connection and drops the rest without a word, so the SDK refuses more than that itself, with "Too many pings: the platform answers at most 60 every 10 seconds". Ping on a timer of a second or more, not every frame. From Blueprint it is the **Ping Server Objects** node.

## Outcomes

`Outcome` is an `ECrowdyServerCallOutcome`. Every outcome, what it means and what to do about it, and the refusals that come from the server code generated for the type, are on [Troubleshooting](../troubleshooting.md#outcomes).

## Related

- [Read and follow its variables](./read-and-follow-variables.md)
- [Get a Server Object](./get-a-server-object.md#status)
- [Call its functions, from Blueprint](../from-blueprint/call-functions.md): the **Call** node and **Call Server Function**
- [Call a Server Function Library](./call-a-library.md): the next page, a type with no instance to hold
- [Troubleshooting](../troubleshooting.md#outcomes): every outcome, and the refusals from your server code
- [ck-exec operations](/exec/operations): logs, including a crashed call's
