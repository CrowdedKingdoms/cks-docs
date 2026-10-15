---
sidebar_position: 8
title: The economy and its limits
---

# The economy and its limits

The kit's economy is the `player` and `market` starters: each player's items, soft currencies,
progression, crafting, loot and idle production in a hub of their own, and markets where players
buy from vendors, trade on order books and swap with each other. **It lives in hub state, and it
is not a ledger.** That is a deliberate choice, and it decides what you may build on it.

## What "not a ledger" means

- **Balances and items are a hub's state**, kept and persisted the way any hub keeps its state:
  in memory while it runs, and in its snapshots. A hub that restarts comes back from its last
  snapshot, so a change made after it is replayed only if a client sends it again with its
  `action_id`.
- **A transfer is steps, not a transaction.** When two players trade, the market holds what each
  puts up in their own `player` hub, then settles each hold and delivers it to the other, step
  by step. Each step carries a reference the receiving hub answers once, and the market retries a
  step until that hub answers, so goods are never in two places and never in neither. But nothing
  makes the steps one atomic unit: between them, one side may have been delivered while the other
  is still on its way.
- **There is no double-entry book, no audit trail beyond the hubs' logs, and no reconciliation.**
  Nobody can prove afterwards, from a ledger, where a coin went.
- **There is no real money.** Nothing here is connected to payments, payouts or the platform's
  wallets, and nothing should be.

## What it is for

Soft currencies earned in play, items, crafting materials, cosmetic rewards, quest and
achievement rewards, loot from playing, player-to-player trades of game items: an economy whose
worst failure is a few coins or items more or less, set right by a developer with `grant`.

## What it is not for

- **Anything bought with real money, or sold for it**, including premium currencies you sell.
- **Anything a player could lose real value through**, or anything with a legal or tax meaning.
- **Loot paid for with real money.** The `player` hub's loot is seeded with what no client can
  see (the hub's instance, when it started, and a `secret` you can put in its config) and mixed
  with the moment of each roll, so a player cannot work out a roll before paying for it. It is
  still a game's generator, not a certified one.

For those, use a ledger outside the kit.

## How it stays consistent

- **Each player's hub is the only place their goods are**, and only its player reads it. Other
  hubs (a market, a session that pays out) change it through endpoints only the app's hubs and
  developers may call, each answered once by its reference.
- **A change that needed another hub that did not answer is refused `unavailable`** and keeps no
  receipt. The kit's clients send it again with the same `action_id`, and it finishes what it
  began. A hold the market asked for and never heard back about is given back after a minute.
- **Items that do not fit wait in the mail**: what another hub delivers always arrives, and the
  player moves it into their inventory with `takeMail` once they make room.
- **Developers can set things right**: `grant` and `deposit` on a player's hub, from a
  developer's kit, give items and currency; a market's `state` shows the steps still pending and
  how many a hub refused (`stuck`).

## Before you go live

- Decide what each currency is worth, and keep it to the "for" list above.
- Give the `player` type a `secret` in its config, and keep the config out of clients.
- Watch the market's `state` for `stuck` steps, and the hubs' logs for the refusals they record.
- Read the `player` and `market` [module pages](modules/player) for what each endpoint does and
  who may call it.
