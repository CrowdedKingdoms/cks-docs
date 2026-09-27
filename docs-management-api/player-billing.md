---
slug: player-billing
sidebar_position: 32
title: Player wallets & billing
---

# Player wallets & billing

Players are first-class billing customers. Each player has **one
platform-scoped wallet** that funds their usage across every org and app they
play in. Player money is entirely **out-of-band from org billing**: a player's
empty wallet or refund never appears on an org's bill and never trips the
org's runtime gate.

Player usage is metered per player: client-mod *compiles*, which consume
platform CPU (client-side execution runs on the player's own hardware and is
not billed), and the [Studio agent's](/game-api/agentic-crowdy-studio#who-pays)
requests when the app bills the player. A player's [mods](/exec/mods) on
ck-exec are recorded but not billed during the preview.

## The wallet

All wallet operations are viewer-scoped — a caller manages only their own
wallet, with no org permission involved:

- `playerWalletBalance` — the caller's wallet, created empty on first access.
- `playerWalletTransactions` — the ledger: top-ups, hourly usage debits,
  auto-recharges, refunds, and adjustments. Historical `purchase` /
  `payout_credit` rows may still appear; paid marketplace sales are off
  the public API.
- `createCheckout` with purpose `PLAYER_WALLET_TOPUP` — fund the wallet
  through the ordinary hosted checkout (Stripe/PayPal). Only `amountCents`
  is required. The wallet pays for **usage**, not store listings.
- `beginPlayerCardSetup` — vault a card on the wallet (a Stripe SetupIntent
  the browser confirms), enabling auto-recharge.
- `playerAutoBilling` / `setPlayerAutoBilling` — off-session auto-recharge
  from a vaulted card, with a per-period ceiling. The player gate tries an
  auto-recharge before ever denying for funds.

## Hourly usage billing

Player usage bills on closed clock hours, exactly like org shared-usage
billing: minute counters ship from the game runtime, the biller prices the
hour's usage above the **monthly trial budget** at the **player rate card**,
and debits the wallet once per `(player, app, hour)` — the charge ledger is
idempotent.

Each posted charge (`playerUsageCharges`) splits two components the player
always sees separately:

- `platformCents` — the platform base price at the player rate card.
- `markupCents` — the studio's configured markup for that app, if any.

The per-metric snapshot on the charge records used/free/billable quantities
for each metered dimension.

## The free trial

Every player gets a **monthly trial budget of 250,000 compute units in each
app**, reset on the first of each UTC month. Usage inside the trial charges
nothing and keeps an empty wallet fully active.

There is **no hourly free allowance**: a monthly budget lets a player
experiment freely and asks sustained use to pay.

Charges below one cent are **carried forward** rather than rounded up, so a
player running something tiny is billed what they actually used over the month
instead of a rounded-up cent every hour.

## Spend caps and the player gate

The effective limit on a player's spend is
`min(developer policy, player self-cap, wallet balance)`:

- `playerSpendCaps` / `setPlayerSpendCap` — self-set daily/monthly ceilings,
  globally or per app. Hitting a cap denies with `PLAYER_SPEND_CAP`.
- The **player gate** (`playerRuntimeStates`) mirrors the app runtime gate at
  `(player, app)` scope: `active`, `grace` (a one-evaluation warning), or
  `denied` with a typed reason. An exhausted wallet past grace denies with
  `PLAYER_WALLET_EMPTY`.

A non-active gate refuses **that player's own** metered work, such as a
client-mod compile — their session and ordinary play are untouched, and no
other player or the org is affected. Crowdy Studio shows the typed reason
(`PLAYER_WALLET_EMPTY`, `PLAYER_SPEND_CAP`, …) on its usage meter.

Auto-recharge honours the threshold you set: with billable usage in the last
two hours and a balance at or below `lowWaterThresholdCents`, the saved card is
charged `rechargeAmountCents` before the balance can reach zero. Sub-cent usage
is carried forward in micro-cents and charged once it reaches a whole cent, and
a refund of a top-up (`refund`) or a card dispute (`adjustment`) leaves the
wallet the same way it arrived.

## Studio configuration and visibility

Studio-facing controls (org permissions in parentheses):

| Surface | Purpose |
|---|---|
| `playerRateMarkup` / `setPlayerRateMarkup` (`view_billing` / `manage_billing`) | Markup in basis points on the platform base price — the studio's usage-revenue stream, always shown to players as a separate component |
| `appPlayerUsage` (`view_compute_diagnostics`) | Per-player usage aggregate: top spenders, quota utilization, compiles, cents charged |
| `appPlayerMarkupAccrued` (`view_billing`) | Total markup income earned. Each charge's markup is **credited to the organization wallet in the same transaction as the player's debit**, and appears in the org ledger as `markup_payout` — so this total and the money in the wallet cannot drift apart |
| `execModSetSwitch` / `execModSwitches` (Game API, `manage_compute`) | The kill ladder for players' [mods](/exec/mods#for-the-apps-developers): one mod, a player's, a grid's, a listing's installs, or every mod in the app |
