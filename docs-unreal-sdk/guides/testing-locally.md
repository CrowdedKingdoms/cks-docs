---
slug: testing-locally
sidebar_position: 2
title: Testing Locally
description: "How to exercise RPC and Crowdy State replication with a single Play in Editor client using the loopback console variables, how to set up a genuine two-client PIE session and its account caveats, the per-area trace console variables worth reaching for first, and a short debugging loop."
---

# Testing Locally

Most replication paths need two clients to see anything: one that sends, one that receives. Two console
variables let you exercise the send and receive halves of RPC and Crowdy State on a single Play in Editor
client, so you do not need a second window for most day-to-day iteration. This page covers those two
switches, when you do need genuine two-client PIE and how to set it up without a false result, and the
trace console variables you reach for once loopback confirms the send side but the far end still looks
wrong.

## When you come here

You are iterating on an RPC handler or a Crowdy State property and want to confirm the send and receive
code paths without launching a second client, you are about to test something that only shows up with two
real players (host election, ownership, targeted delivery), or something replicated is not showing up and
you need to see where the SDK stopped.

## Single-client RPC loopback

```text
crowdy.rpc.loopback 1
```

With loopback on, a CrowdyEvent you send is also delivered back to your own receive path, once. This
confirms, with a single client, that the send site fires, the call serializes, and the receiving
`Name_Implementation` runs. A call made from inside the replayed body sends normally but does not loop back
again, so loopback cannot cascade into a second delivery of its own output.

:::warning[Loopback is for single-client testing only.]
Turn it off before testing real two-client routing, or the extra self-delivery masks routing problems.

```text
crowdy.rpc.loopback 0
```
:::

## Single-client Crowdy State loopback

Crowdy State loopback cannot replay a delta onto the same actor the way RPC loopback replays a call, because
the ownership gate drops a non-host-sourced delta for an entity the client already owns outright, and even
if it did not, decoding onto the same live actor would report zero changed properties and never fire
`OnRep`. So instead of replaying onto the sender, it mirrors.

```text
crowdy.state.loopback 1
```

With loopback on, a state delta you send for an owned entity is also decoded onto a lazily spawned local
mirror: a second instance of the same class, in the `RemoteProxy` role, with its own distinct NetID. The
mirror's `OnRep` and change delegates fire exactly as a real peer's would, so you can confirm a property
change reaches a receiver without a second client. Off by default; when it is off, nothing about normal
replication changes.

:::note[The mirror always logs its delivery as `(targeted)`, even for a delta that actually went out spatially or as a keyframe.]
This is a cosmetic label in the trace log only: `DispatchStateDelta` never gates its behavior on that flag.
Do not read the trace log's delivery-kind label as fact while state loopback is on.
:::

The mirror requires the entity's `OwnerID` to stay invalid and its role to stay `RemoteProxy`; that is how
the SDK tells the mirror apart from the real owned entity so the two do not collide. You do not configure
this yourself, it explains why a mirror exists at all rather than a same-actor replay.

## Two-PIE-client setup

The loopback switches cover the common case. Some things only show up with two real clients: which one gets
elected host, an ownership transfer, a targeted or spatial send that must reach one client and not the
other.

:::caution[Two PIE clients need two distinct real accounts.]
Identity is deterministic from the signed-in account. One account signed in twice, in two PIE windows,
conflates into a single player and a single NetID, so the two windows do not reproduce two-client behavior
at all. This is a silent wrong result, not a crash: sign each window in with a different account.
:::

Each PIE instance now isolates its own session automatically, so one window does not overwrite another
window's saved sign-in. The only setup left to do by hand is signing the two windows into two different
accounts.

Run the two clients as separate processes: in Editor Preferences, under Play, uncheck "Run Under One
Process." Besides matching how a packaged build actually runs, it keeps any per-process editor systems
(runtime generation, audio devices) from being shared between the two worlds.

Once both clients are running, confirm the setup actually worked before you trust anything else you see:
each client should report a different local player identity, and exactly one client should be the elected
host.

## Trace console variables

Each SDK area exposes a `crowdy.<area>.trace` console variable that adds informational logging for that
area; warnings and errors print regardless. The four you will reach for first while testing locally:

- `crowdy.rpc.trace`: every CrowdyEvent send and receive, the function, entity, addressing, and whether it
  was owned or delegated.
- `crowdy.state.trace`: owned-entity diffing, delta emission, and datagram sizes.
- `crowdy.entity.trace`: registry add and remove, event routing and dispatch, actor tracking.
- `crowdy.net.trace`: the UDP transport underneath both: socket open and close, sends and receives, worker
  pool and buffer pool churn.

The full table, every trace and behavior console variable the SDK ships, is on
[Console variables](../reference/console-cvars.md). The category each module logs under, and which trace
console variable pairs with it, is on [Log categories](../reference/log-categories.md).

:::tip[Turn a trace back off once you have your answer.]
Informational trace lines add log volume and a small per-frame cost while they are on.
`crowdy.serialize.scopes` and `crowdy.state.scopes` are worth calling out specifically: each adds a nested
CPU trace scope around every message decode, at the cost of an extra pair of timestamps per message. Leave
both off unless you are reading that specific timing.
:::

## A short debugging loop

1. Turn on the trace that matches the area you suspect: `crowdy.rpc.trace` for a call that never arrives,
   `crowdy.state.trace` for a property that never updates, `crowdy.entity.trace` if replication looks dead
   everywhere at once.
2. Reproduce the problem.
3. Read the log from the moment of the action. The trace lines show what the SDK decided and where it
   stopped.
4. Turn the trace back off.

If nothing traces at all and replication looks completely inactive on a map, that is usually a map profile
whose asset did not load, or one with networking off, not a logging problem; the warning names the asset.
See [Map profile](../runtime/map-profile.md) before you dig further into traces.

## Gotchas

- `crowdy.rpc.loopback` replays a call once and does not cascade; a call made from inside the replayed body
  sends normally.
- `crowdy.state.loopback` mirrors onto a second local entity instead of replaying onto the sender, because
  the ownership gate and the zero-changed-properties problem rule out a same-actor replay.
- The state loopback mirror's trace always says `(targeted)`; that is a label, not the delta's real delivery
  kind.
- One account in two PIE windows produces two windows that look like they are testing two clients while
  actually sharing one identity. Confirm two distinct local player identities before you trust a two-client
  result.
- `crowdy.serialize.scopes` and `crowdy.state.scopes` cost real per-message overhead while on; they are not
  free background logging.

## Related

- [Console variables](../reference/console-cvars.md): the full table of trace and behavior console
  variables.
- [Log categories](../reference/log-categories.md): each module's log category and its trace console
  variable.
- [Crowdy State](../runtime/crowdy-state.md): the concepts behind the deltas state loopback mirrors.
- [Troubleshooting](./troubleshooting.md): symptom-to-cause table for problems that are not a testing-setup
  question.
