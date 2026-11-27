---
sidebar_position: 4.5
title: Players' data, blocks and reports
---

# Players' data, blocks and reports

Four things in `ckx-sdk` 0.13.0 concern what your code holds about players and how it treats
them (ck-exec 0.20.0, compute toolchain v1.16.0, dev kit 0.6.0):

- **[Erasure](#erasure)**: when a player's account is deleted, every hub that holds state hears it,
  and deletes or anonymizes what it holds about them.
- **[Export](#export)**: when Crowded Kingdoms answers a player's request for their data, or a
  safety report preserves evidence, every hub says what it holds about them.
- **[Blocks](#blocks)**: before your code carries one player's words to another, it checks that
  neither has blocked the other.
- **[Reports](#reports)** and **[age brackets](#age-brackets)**: your code files a safety report for
  a player, and reads whether a player is a minor.

## Erasure

```rust
use std::collections::BTreeMap;
use ckx_sdk::prelude::*;
use ckx_sdk::serde_json::{json, Value};

#[derive(Default, Serialize, Deserialize)]
struct Guild {
    members: BTreeMap<u64, Member>, // keyed by player id
    notes: Vec<Note>,               // what players wrote, with who wrote it
}

#[derive(Serialize, Deserialize)]
struct Member { rank: u8, joined_at_ms: u64 }

#[derive(Serialize, Deserialize)]
struct Note { by: u64, text: String }

impl Hub for Guild {
    // spawn, load, persist and handle as usual …

    fn on_player_erased(&mut self, _ctx: &Ctx, player: u64) -> Result<()> {
        self.members.remove(&player);
        self.notes.retain(|n| n.by != player);
        Ok(())
    }

    fn on_player_export(&mut self, _ctx: &Ctx, player: u64) -> Result<Value> {
        let Some(m) = self.members.get(&player) else { return Ok(Value::Null) };
        let notes: Vec<&str> = self.notes.iter().filter(|n| n.by == player).map(|n| n.text.as_str()).collect();
        Ok(json!({ "rank": m.rank, "joined_at_ms": m.joined_at_ms, "notes": notes }))
    }
}
```

`on_player_erased(ctx, player)` is the platform's `$erase` event: the player's account is being
erased, so delete or anonymize everything this hub holds about them. Only the platform sends it.

- **Every hub of the app that holds state hears it**, [mods](mods) included: running instances,
  and stopped ones with a snapshot, which the platform starts for the event and stops after.
  Spokes hold nothing and are not asked. From ck-exec 0.26.0, a stopped hub whose state was
  last stored more than ten minutes before the player's account was created is not started
  for that player: it cannot hold anything of them.
- **A hub may hear it for many players, one after the other** (ck-exec 0.26.0). The platform
  asks a hub about every deleted player it has not yet answered for in one visit: the hook
  runs once for each player, and one snapshot is stored after the last. Keep the hook cheap
  when the hub holds nothing of the player.
- **Done means stored.** The hub counts as erased once a snapshot taken after the hook returned
  `Ok` is stored. An error is recorded, and the erasure asks again later; so may a retry after a
  failure elsewhere, so the hook must be safe to run twice.
- **Instances keyed by the player's id** (of any type but a mod's) are then deleted, snapshot and
  all. A hub that holds only the player's own state, keyed by their id, needs no hook.
- **Paused, switched off or over budget, it still runs.** A deletion is a legal duty, so it does
  not wait for the app's billing, its switches or a mod's: such a hub is started for the event
  alone (no player reaches it, no timer fires, its realtime events are dropped), stops once it
  answered, and Crowded Kingdoms bears that cost.
- **Not implemented,** the default, answers "not implemented". That is recorded and does not hold
  the erasure up, and **whatever the hub holds about the player stays**. Implement the hook in
  every hub that keeps anything about players other than in instances keyed by their id. A hub
  built with an `ckx-sdk` older than 0.13.0 answers the same way.
- A legal hold on the account defers the erasure until it is released.

### An erasure finishes whatever the number of hubs and players

From ck-exec 0.26.0 the platform records each erasure and carries it on until it is done. It
asks an app's hubs about a set of deleted players in one pass, and after an interruption it
carries on where it stopped, with the hubs still to ask. Before 0.26.0 each deleted player was
one request that began again when it ran out of time, so in an app with a hub for each player
the erasures of thousands of players did not finish.

Measured on Crowded Kingdoms' internal dev environment, with Application API v2.90.0 and
ck-exec 0.26.0, in an app with a hub for each player: 6,000 players were deleted in 33 seconds
with 60 [`deleteManagedPlayers`](/management-api/org-managed-players#sessions-refresh-and-signing-out)
calls, and their erasure in the app's hubs finished 4 minutes later. How long an erasure
takes depends on how many hubs hold state and on what your hooks do, so plan on no fixed time.

An erasure does not wait for room either: a hub started to be asked does not count toward
your app's or your organization's [instance and memory limits](operations#call-limits).

### An erasure is complete only when every hub with stored state has been asked

The platform cannot tell what a hub's stored state holds without running the hub's code. Two
things stop it from asking, and each keeps the erasure of **every** deleted player of that app
open, for as long as it lasts:

- **Stored state of a node type that the active version no longer has.** No code of the app
  reads that state, so nothing can say whether a player is in it. `execInstances(appId)` lists
  those hubs with `orphaned: true`
  ([instances and versions](operations#instances-and-versions)).
- **A hub whose stored state your deployed code cannot load.** Its start fails, so it cannot
  be asked. A call to it is answered `Unavailable` with `start failed:` and the hub's address
  ([call limits](operations#call-limits)).

Both end when you deploy:

- **For a dropped type**, deploy a version that has the type again. With `on_player_erased`,
  its hubs are asked and the erasures go on at once. A type whose code has no hook answers
  "not implemented", which holds no erasure up and leaves what those hubs hold in place.
- **For state that does not load**, deploy code whose `load` reads that state.

**Before you drop a node type that held player data:**

1. Assume its hubs still have stored state. A hub that saved state keeps it after it stops,
   and that state has no expiry. `execInstances(appId)` lists the app's instances.
2. Keep the type in your manifest, with an `on_player_erased` that deletes or anonymizes what
   the hub holds. The type can stop serving players: what has to stay is its `load`, its
   `persist`, and the hook.
3. Keep `load` able to read the state your earlier versions stored.

## Export

`on_player_export(ctx, player)` is the platform's `$export` event: answer what this hub holds
about the player as JSON, or `Value::Null` when it holds nothing.

- At most 1 MiB (`ckx_sdk::limits::MAX_EXPORT_BYTES`); a larger answer is recorded as a failure.
- Every hub that holds state is asked, as for erasure. Not implemented, the hub is recorded as
  such and the export goes on without it.
- It answers a player's request for their data, and it is part of what a
  [safety report](/application-api/safety-reports#what-a-report-preserves) preserves, for the reporter and
  for the reported player.

### Testing them

`ckx_sdk::testing::TestHub` sends both, as the platform does (`ckx-sdk` 0.13.0, dev kit 0.6.0):

```rust
#[test]
fn a_member_is_forgotten() {
    let mut hub = TestHub::<Guild>::spawn("guild", "g1").unwrap();
    hub.call(Caller::Player(7), "join", &[]).unwrap();
    assert_ne!(hub.export(7).unwrap(), Value::Null);
    hub.erase(7).unwrap(); // $erase, then the snapshot the platform stores
    assert_eq!(hub.export(7).unwrap(), Value::Null);
}
```

A hub without the hook answers `AppError` "not implemented: …".

## Blocks

```rust
fn send_mail(&mut self, ctx: &Ctx, from: u64, to: u64, text: String) -> Result<()> {
    if ctx.players().blocked(from, to)? {
        return Ok(()); // drop it quietly, as the realtime servers do
    }
    self.mailbox.entry(to).or_default().push(Mail { from, text });
    Ok(())
}
```

`ctx.players().blocked(player, other)` is true when either player has blocked the other in this
app ([blocks](/application-api/communication#blocks)). It needs `players.read`, and answers `NotFound`
unless both are players of the app.

**Check it before your code carries one player's words, voice or media to another**: mail,
private messages, a chat line your hub emits for a player, friend requests, trades, duels and
invites. The realtime servers stop communication between two players when either has blocked the
other (movement and world edits still pass, so both see the same world), but what your code emits
has no sending player, so they pass it, block or no block. Tell the blocked player nothing.

**Never pass one player's direct message to a minor as your hub's own.** The realtime servers drop
a player's direct message to a player under 18, and pass what your code sends, so a hub that
forwards a private message would deliver what the platform refuses. Read the recipient's
[age bracket](#age-brackets) first.

## Reports

```rust
let filed = ctx.safety().report(&SafetyReport {
    reporter,
    reported,
    reported_actor: None,                  // or the reported player's 32-character actor id
    reason: ReportReason::Harassment,
    details: text,                         // at most 1,000 characters
    occurred_at_ms: ctx.now_ms(),
})?;
// filed.report_id is what moderators know it by
```

`ctx.safety().report` files a [safety report](/application-api/safety-reports) for `reporter` about
`reported`, as the reporter would from your game: an in-game report command, say. It needs the new
scope `safety.write`. Both players must be the app's. `reason` is one of `ChildSafety`,
`Harassment`, `SexualContent`, `Hate`, `SelfHarm`, `Cheating` and `Other`. The app's moderators
review it like any report, with what the safety log recorded around `occurred_at_ms`.

## Age brackets

`ctx.players().get(player)` names a player's age bracket in `age_bracket`: `Under13`,
`From13To15`, `From16To17`, `Adult` or `Unknown`, never their age. `AgeBracket::is_minor()` is true
for the two brackets from 13 to 17, the players the platform holds to minors' defaults: voice and
video off until a parent consents and then contacts only, no direct messages. `None` comes from a
Application API older than v2.60.0, and a bracket this SDK does not know reads as `Unknown`.

Treat a minor the way the platform does in what your code adds: no private messages or mail
between a minor and players who are not their contacts, and nothing meant for adults.

## Scopes

| Scope | Adds |
|---|---|
| `players.read` | `players.blocked`, and `age_bracket` on `players.get` |
| `safety.write` | `safety.report` (new in ck-exec 0.20.0) |

Declare them in the [manifest](intro#the-manifest). Mods hold neither: a mod reads no player data
and files no report.

`ctx.node("players.blocked", …)` and `ctx.node("safety.report", …)` take the JSON bodies
`{ "player", "other" }` and `{ "reporter", "reported", "reported_actor", "reason", "details",
"occurred_at" }`, with ids as decimal strings, `reason` in lower case (`child_safety`, …) and
`occurred_at` an RFC 3339 time, for code that does not use the typed calls.
