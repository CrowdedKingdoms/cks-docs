---
sidebar_position: 9
title: Commerce incidents (money, payouts, fraud)
---

# Commerce incidents: money, payouts, and fraud (T11)

Real-money marketplace commerce (P4b) adds a financial-incident surface on
top of the [player-code kill ladder](/operators/player-code-incidents). The
named T11 (financial-crime) owner is **Michael**. Everything below runs in
Stripe test mode on the builder until the test-environment pass; live keys
never touch the builder.

## The controls at a glance

| Control | Where | Default (D6) |
|---|---|---|
| Platform share | ledger split | 30% of every sale (OQ-3) |
| Org share | `apps.marketplace_org_share_bps` | 0 for BWF; per-app on the remainder |
| Payout delay | `commerce_risk_config.payout_delay_days` | 7 days (pending -> payable) |
| Young-account reserve | `young_reserve_bps` / `reserve_hold_days` | 10% held 90 days (< 60-day-old accounts) |
| Payout minimum | `payout_minimum_cents` | $10 |
| Refund window | `refund_window_days` + void-on-use | 14 days; 3 refunds / buyer / 30 days |
| Velocity | `buyer_orders_per_day` / `listing_sales_per_day` | 20 / 50 (holds, not fails) |

All values are rows in `commerce_risk_config` — tune them, do not hard-code.

## The risk queue

`commerceRiskQueue(appId)` (requires `manage_compute`) lists open flags:

- **`buyer_velocity` / `listing_velocity`** — the order was **held** (not
  settled) and its seller credit is frozen. Release settles it; confirm
  leaves it held.
- **`same_party`** — buyer is the seller, or a member of the selling org
  (self-dealing / laundering shape). Held + frozen.
- **`chargeback`** — a card dispute already clawed the wallet; this is the
  review record.

`decideCommerceRiskFlag(appId, flagId, release)` — **release** settles any
held order and unfreezes the seller's pending credit; **confirm** upholds
the hold (the seller credit stays frozen, the order stays held).

## Chargebacks

In the wallet-funded model the only disputable card charge is a **wallet
top-up**. A `charge.dispute.created` webhook:

1. claws the disputed amount back from the player wallet (allowed to go
   negative — the purchase gate refuses against the lowered balance),
2. raises a platform-scoped `chargeback` risk flag on the buyer.

Acquisition-level revocation on a chargeback is a **review decision** (via
the risk queue), not automatic, because the disputed charge funded the
wallet, not a specific purchase. To reverse a specific fraudulent purchase,
use the order-level refund/clawback path.

Trigger one locally through the Stripe CLI:

```bash
stripe trigger charge.dispute.created
```

The CLI listener (`stripe listen --forward-to localhost:3001/webhooks/stripe`)
delivers it to the local management-api; watch the wallet clawback + flag
land.

## Freezing payouts

A seller under investigation: set `seller_payout_balances.payouts_frozen`
(a `freeze` payout event). Frozen accounts accrue balance but
`requestSellerPayout` refuses (`PAYOUTS_FROZEN`). Unfreeze after review.
Fleet-wide, kill the listing (the [kill ladder](/operators/player-code-incidents))
and de-admit its author/org to stop new sales while payouts are frozen.

## Refunds

`refundPlayerCodeAcquisition` enforces D6 automatically: inside the 14-day
window, void on meaningful use (first install/fetch), capped at 3 per buyer
per 30 days. A successful refund credits the wallet, reverses the ledger
split, claws back the seller balance (netting negative if already paid
out), revokes the acquisition, and drains installs through the standard
path. There is no operator override that ignores void-on-use — that is the
seller's protection.

## Grid purchase failures

A grid purchase charges money management-side, then game-api applies
ownership atomically. If ownership application fails, game-api calls
`refundGridOrder` — the buyer is made whole and never left owning nothing
or paying for nothing. A grid chargeback transfers title back through the
P1 transfer machinery (installed code disabled at commit), never a dangling
owner.

## What is NOT an incident

- Payout aging (pending -> payable over 7 days), reserves on young
  accounts, and below-minimum balances are the controls working.
- A held order awaiting review is the velocity/self-dealing control
  working; it is not a failed purchase.
- `INSUFFICIENT_WALLET_BALANCE` on a purchase is the atomic-refuse guard;
  the player tops up and retries.
