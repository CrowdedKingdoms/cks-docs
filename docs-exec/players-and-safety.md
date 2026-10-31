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
  Spokes hold nothing and are not asked.
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

## Export

`on_player_export(ctx, player)` is the platform's `$export` event: answer what this hub holds
about the player as JSON, or `Value::Null` when it holds nothing.

- At most 1 MiB (`ckx_sdk::limits::MAX_EXPORT_BYTES`); a larger answer is recorded as a failure.
- Every hub that holds state is asked, as for erasure. Not implemented, the hub is recorded as
  such and the export goes on without it.
- It answers a player's request for their data, and it is part of what a
  [safety report](/game-api/safety-reports#what-a-report-preserves) preserves, for the reporter and
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
app ([blocks](/game-api/communication#blocks)). It needs `players.read`, and answers `NotFound`
unless both are players of the app.

**Check it before your code carries one player's words, voice or media to another**: mail,
private messages, a chat line your hub emits for a player, friend requests, trades, duels and
invites. The realtime servers stop everything between two players when either has blocked the
other, but what your code emits has no sending player, so they pass it, block or no block. Tell
the blocked player nothing.

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

`ctx.safety().report` files a [safety report](/game-api/safety-reports) for `reporter` about
`reported`, as the reporter would from your game: an in-game report command, say. It needs the new
scope `safety.write`. Both players must be the app's. `reason` is one of `ChildSafety`,
`Harassment`, `SexualContent`, `Hate`, `SelfHarm`, `Cheating` and `Other`. The app's moderators
review it like any report, with what the safety log recorded around `occurred_at_ms`.

## Age brackets

`ctx.players().get(player)` names a player's age bracket in `age_bracket`: `Under13`,
`From13To15`, `From16To17`, `Adult` or `Unknown`, never their age. `AgeBracket::is_minor()` is true
for the two brackets from 13 to 17, the players the platform holds to minors' defaults: voice and
video off until a parent consents and then contacts only, no direct messages. `None` comes from a
Game API older than v2.60.0, and a bracket this SDK does not know reads as `Unknown`.

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
