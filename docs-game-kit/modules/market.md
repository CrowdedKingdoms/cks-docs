---
sidebar_position: 15
title: Markets
---

# Markets

A market, keyed by its name (`town`, `harbor`): vendors with fixed prices whose stock restocks on
a schedule and limits what one player buys between restocks; an order book for each item it
lists, matched at price-time priority at the resting order's price; and trades between two
players, who each offer a bundle and accept the last offers. It holds nothing itself. What a
player puts up waits in a hold in their own [player hub](player), and the market moves each fill
or accepted trade between the two hubs as steps each answers once, retrying until it hears back.
It is [not a ledger](../economy).

**Starter:** crate `market`, node type `market` (it calls `player`), keyed by name. **Modules:**
`kit.shops.at(key)`, `kit.market.at(key)` and `kit.trades.at(key)` in CrowdyJS and CrowdyPy;
`shops()`, `market()` and `trades()` `.at(key)` in CrowdyCPP.

## Endpoints

| Endpoint | Who | What |
|---|---|---|
| `vendors`, `book { item }`, `state` | anyone | Vendors and their stock; an item's bids and asks; the market |
| `buy { vendor, item, count }`, `sell { vendor, item, count }` | players | Pays and gets together, in the player's hub: `insufficient` (gold or stock), `limit` (per player), `full`, `forbidden` (it does not buy them) |
| `order { item, side, price, count }` | players | Holds a buy's `price * count` or a sell's items, then matches: `insufficient`, `limit` (open orders), `not_found` (no book) |
| `cancel { order }`, `orders` | the order's player | What it still holds comes back; the caller's open orders |
| `trade { with }`, `offer { trade, bundle }`, `accept { trade }`, `decline { trade }`, `trades` | the two players | An offer is held at once and clears both acceptances; both accepting the last offers settles it; `finished`, `not_ready`, `forbidden` |

A change that needs a player's hub that did not answer is refused `unavailable`; the kit's
clients send it again with its `action_id`, and the market asks again by the same reference, so
the change runs once (the same `action_id` with other arguments is refused `conflict`). A hold the
market never heard back about is given back after a minute, and a resend after that is a new
change. A market's key is at most 48 bytes.

## Topics

`market`: snapshots of the vendors' stock, each book's best prices and last trade, open trades
and pending steps, at most once a second; `changed` messages naming the players whose orders or
trades moved (`what`: `orders`, `trades`).

## Config

`vendors` (each `id`, `offers` with `item`, `price`, `stock`, `per_player`, `buys_for`, and a
`restock` cron), `book_items` and the `book_currency` they trade in, `orders_max` (20 a player),
`trade_ms` (how long a trade stays open), and `player_type` (`player`).

## CrowdyJS

```ts
const shop = kit.shops.at('town');
await shop.buy('smith', 'sword');
const book = kit.market.at('town');
await book.order({ item: 'ore', side: 'sell', price: 4, count: 10 });
const desk = kit.trades.at('town');
const trade = await desk.open(friendId);
await desk.offer(trade, { currency: { gold: 30 } });
await desk.accept(trade); // settles once the friend accepts the same offers
```

## CrowdyCPP

```cpp
kit->shops().at("town").buy("smith", "sword", std::nullopt, [](crowdy::kit::KitReply r) {
  if (r.code() == "limit") showSoldOut();
});
kit->market().at("town").order({"ore", "sell", 4, 10}, [](crowdy::kit::KitReply) {});
game.poll();
```

## CrowdyPy

```python
await kit.shops.at("town").buy("smith", "sword")
await kit.market.at("town").order(item="ore", side="sell", price=4, count=10)
desk = kit.trades.at("town")
trade = await desk.open(friend_id)
await desk.offer(trade, {"currency": {"gold": 30}})
```
