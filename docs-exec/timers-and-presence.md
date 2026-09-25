---
sidebar_position: 2
title: Timers, subscriptions and presence
---

# Timers, subscriptions and presence

:::caution Dev-tier preview
Available on the **dev** environment only; see the [overview](intro).
:::

A hub hears about more than calls. Each of these is a method on `Hub` with a default that
does nothing, so a hub implements only what it uses.

| Hook | When |
|---|---|
| `on_timer(ctx, name)` | A timer the hub set is due. |
| `on_topic(ctx, msg)` | Another instance published on a topic this hub subscribes to. |
| `on_session(ctx, player, Session::Joined / Left)` | A player's connection subscribed to this hub's first topic, or left its last one. |
| `on_presence(ctx, &presence)` | Root hub only: players entered or left the app's world, or the count changed. |

These arrive as calls with reserved method names starting with `$`. Players and other
instances cannot call a `$` method, so a hub can trust where these came from.

## Timers

```rust
fn spawn(ctx: &Ctx, _seed: &[u8]) -> Result<Self> {
    ctx.timer_every("tick", 100)?;            // every 100 ms
    Ok(Self::default())
}

fn on_timer(&mut self, ctx: &Ctx, name: &str) -> Result<()> {
    match name {
        "tick" => self.step(ctx),
        "wave" => self.spawn_wave(ctx),
        _ => Ok(()),
    }
}
```

- `ctx.timer_after(name, ms)` runs `on_timer` once; `ctx.timer_every(name, ms)` repeats, first
  one period from now. Setting a name again replaces that timer, so the name is its dedupe key.
  `ctx.cancel_timer(name)` removes it and `ctx.timers()` lists what is pending.
- Timers are kept in the hub's snapshot, so they survive restarts and moves.
- They fire only while the hub runs. One that came due while it was stopped fires **once**
  when it starts again; a repeating timer does not replay the periods it missed, and continues
  one period from then.
- A repeating timer that keeps up stays on its schedule. The shortest period is 10 ms, and a hub
  may have 1,024 timers. Every timer due at the same moment runs in one call, which shares one
  call's fuel and deadline.
- An error returned from `on_timer` is logged; the timer stays as scheduled.

## What keeps a hub running

A hub runs while it is used, then persists and stops once it has been unused for its type's
`evict_after_ms` (five minutes by default). Calls use it, and so does anyone subscribed to its
topics, a player or another hub.

A pending timer keeps an otherwise unused hub running **only while players are in the app**:
connected to an execution host, or in the app's world. When nobody has been in the app for a
type's window, the app's instances of that type stop, however busy they keep each other. They
start again when a player calls or subscribes, and the root hub starts when a player enters the
world.

## Subscriptions between hubs

```rust
ctx.subscribe("arena", &ctx.key, "hp")?;

fn on_topic(&mut self, _ctx: &Ctx, msg: TopicMsg<'_>) -> Result<()> {
    if (msg.node_type, msg.topic) == ("arena", "hp") {
        self.boss_hp = msg.decode::<Hp>()?.hp;
    }
    Ok(())
}
```

A hub may subscribe to a topic of any type its manifest entry lists in `calls`, wherever the
other instance runs. Subscriptions are kept in the snapshot and renewed whenever the hub starts
again; `ctx.unsubscribe` ends one. A hub may hold 256. Spokes do not subscribe.

## Sessions

`on_session` tells a hub when a player's connection subscribes to its first topic on the hub,
and when that connection unsubscribes from its last one or closes. It counts connections, not
players: a player connected twice joins twice.

## Presence

The root hub hears who is in the app's world:

```rust
fn on_presence(&mut self, ctx: &Ctx, p: &Presence) -> Result<()> {
    self.players = p.count;
    for j in &p.joined { self.present.insert(j.player); }
    for l in &p.left { self.present.remove(&l.player); }
    ctx.publish("players", &encode(&self.players)?);
    Ok(())
}
```

- `joined` and `left` list user ids (and the player's actor, when known). They arrive within
  seconds of a player entering or leaving the world.
- `count` is the number of players the realtime servers report for the app. It trails the
  roster when players leave: a player who stops sending is counted until their session ends, a
  few minutes later.
- An event can be lost when the root hub moves. `count` is current in every event, and a
  restarted root hub is told it again within a minute.
- For a player count clients can watch, publish it from `on_presence` as above; players
  subscribe to the root hub's topic.

## Saving now

A hub is snapshotted on its interval. For a change that should not wait (a purchase, a
checkpoint), `ctx.persist_now()` snapshots soon after the current call returns, at most once a
second.

## Coming from game models and automations

| Legacy | ck-exec |
|---|---|
| Compute ticks (`tickHz`) | `ctx.timer_every` |
| Automation schedules (`interval`) | `ctx.timer_every` |
| `gameModelScheduleInvoke`, a function's `timers` effect | `ctx.timer_after` (the name is the dedupe key) |
| `player_joined`, `player_left`, `player_count_changed` | `on_presence` on the root hub |
| `gameModelActivePlayerCount` and its subscription | Publish the count from `on_presence`; clients subscribe |
| `function_invoked`, `property_changed`, `container_created` | The hub knows when it changes; others `ctx.subscribe` to its topics |
| `gameModelSeed` | The type's `seed_b64` in the manifest |

Next: [connect from a game](connect-from-a-game).
