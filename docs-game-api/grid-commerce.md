---
sidebar_position: 27
title: Grid commerce
---

# Grid commerce (buying and reselling grids)

Studios can sell **grids** for real money alongside code: a purchase debits
the buyer's [player wallet](/management-api/player-billing) and confers
`grid_ownership` plus a configured set of player-code keys **atomically** —
the buyer is never left paying for nothing or owning nothing.

## Studio catalog

`createGridListing` (Management API, `manage_apps`) creates either:

- a **blueprint** — every sale stamps a *fresh grid* where the buyer stands
  (the listing's `blueprintConfigJson` describes bounds/placement), or
- a **concrete** grid — the sale transfers that specific grid.

Each listing carries the price, the **conferred permission keys** (e.g. the
four player-code keys for a "moddable plot"), an optional per-grid quota
preset, and a **resale policy**:

| Policy | Semantics |
|---|---|
| `no_resale` (default) | The buyer cannot relist the grid |
| `resale_free` | Player resales allowed; no studio cut |
| `resale_with_studio_cut` | Player resales allowed; the studio takes `studioCutBps` |

The catalog replicates to the game store (`gridListings` on the Game API)
for in-game browse.

## Buying

```graphql
mutation {
  purchaseGrid(appId: "1", gridListingId: "..."
               chunkX: 12, chunkY: 0, chunkZ: 34) {   # blueprint stamp point
    gridId
    ownershipAssigned
  }
}
```

The purchase is **two-phase with a compensating refund**: management
charges the wallet and records the order + platform/org split, then the
game side assigns `grid_ownership (acquired_via: 'marketplace')`, grants
the conferred keys, and recomputes the ACL. If ownership application fails
for any reason, the charge is automatically refunded.

In apps whose [grid claim policy](player-marketplace#grid-claim-policies-how-claims-confer-ownership)
is `MARKETPLACE_ONLY`, this is the **only** way players gain grid
ownership — direct claims are refused.

## What travels with a grid (and what doesn't)

- **Installed code does not keep running** across a sale: the P1 transfer
  rule applies — modules disable at commit pending the new owner's consent,
  with state wiped. A grid sale never smuggles running code onto a new
  owner.
- **Code licenses don't travel** by default: acquisitions belong to the
  buyer who made them (`licenseTransferable` on a code listing defaults to
  false). The new grid owner acquires their own licenses.
- A grid **chargeback** transfers title back through the same transfer
  machinery — never a dangling owner (see the
  [commerce incidents runbook](/operators/commerce-incidents)).
