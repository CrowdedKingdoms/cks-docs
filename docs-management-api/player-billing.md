---
slug: player-billing
sidebar_position: 32
title: Player wallets & billing
---

# Player wallets & billing

Players who run [player code](/game-api/player-code) are first-class billing
customers. Each player has **one platform-scoped wallet** that funds their
grid compute across every org and app they play in. Player money is entirely
**out-of-band from org billing**: a player's runaway ticker, empty wallet, or
refund never appears on an org's bill and never trips the org's runtime gate.

Server-side player compute, player automations, and player compiles are
metered per player — attributed to the **grid owner** the code executed as,
never its author. Client-side execution runs on the player's own hardware and
is not billed (client *compiles* are metered; they consume platform CPU).

## The wallet

All wallet operations are viewer-scoped — a caller manages only their own
wallet, with no org permission involved:

- `playerWalletBalance` — the caller's wallet, created empty on first access.
- `playerWalletTransactions` — the ledger: top-ups, hourly usage debits,
  auto-recharges, refunds, adjustments.
- `createCheckout` with purpose `PLAYER_WALLET_TOPUP` — fund the wallet
  through the ordinary hosted checkout (Stripe/PayPal). Only `amountCents`
  is required.
- `playerAutoBilling` / `setPlayerAutoBilling` — off-session auto-recharge
  from a vaulted card, with a per-period ceiling. The player gate tries an
  auto-recharge before ever denying for funds.

## Hourly usage billing

Player usage bills on closed clock hours, exactly like org shared-usage
billing: minute counters ship from the game runtime, the biller prices the
hour's overage above the **player free allowance** at the **player rate
card**, and debits the wallet once per `(player, app, hour)` — the charge
ledger is idempotent.

Each posted charge (`playerUsageCharges`) splits two components the player
always sees separately:

- `platformCents` — the platform base price (same compute-unit formula and
  fuel-divisor lineage as studio modules).
- `markupCents` — the studio's configured markup for that app, if any.

The per-metric snapshot on the charge records used/free/billable quantities
for compute units, automation units, and compile dimensions.

A small per-player hourly free allowance means trying player code never
requires funding a wallet first — usage within the allowance charges nothing
and keeps an empty wallet fully active.

## Spend caps and the player gate

The effective limit on a player's spend is
`min(developer policy, player self-cap, wallet balance)`:

- `playerSpendCaps` / `setPlayerSpendCap` — self-set daily/monthly ceilings,
  globally or per app. Hitting a cap denies with `PLAYER_SPEND_CAP`.
- The **player gate** (`playerRuntimeStates`) mirrors the app runtime gate at
  `(player, app)` scope: `active`, `grace` (a one-evaluation warning), or
  `denied` with a typed reason. An exhausted wallet past grace denies with
  `PLAYER_WALLET_EMPTY`.

A non-active gate pauses **that player's mods only** — their session and
ordinary play are untouched, and no other player or the org is affected. The
gate state replica-syncs to the game runtime, where the scheduler drains the
player's modules within one pass and resumes them when the gate clears.

## Studio configuration and visibility

Studio-facing controls (org permissions in parentheses):

| Surface | Purpose |
|---|---|
| `playerWasmPolicies` / `setPlayerWasmPolicy` / `deletePlayerWasmPolicy` (`manage_compute`) | Per-player/cohort clamps at `app_default`, `tier`, `grid`, or `user` scope: module counts, tick/fuel/memory/egress budgets, `unitsPerHour`/`unitsPerDay` quotas, `maxCompilesPerHour`, container-create caps |
| `playerRateMarkup` / `setPlayerRateMarkup` (`view_billing` / `manage_billing`) | Markup in basis points on the platform base price — the studio's usage-revenue stream, always shown to players as a separate component |
| `appPlayerUsage` (`view_compute_diagnostics`) | Per-player usage aggregate: top spenders, quota utilization, compiles, cents charged |
| `appPlayerMarkupAccrued` (`view_billing`) | Total markup income accrued (paid out via the marketplace payout ledger when it ships) |
| `playerComputeSetSwitch` / `playerComputeSwitches` (Game API) | The kill ladder: immediate stop at player/grid/app scope, quota state retained |

Management is authoritative for the player policy table; changes
replica-sync to the game runtime, where every knob is additionally clamped
by the app's studio compute policy — a player policy can only tighten.
