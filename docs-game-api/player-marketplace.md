---
sidebar_position: 26
title: Marketplace
---

# Marketplace

The marketplace supports **five acquisition modes**: free, and four paid
modes (buy, rent, time-limited, cost-limited) funded by the
[player wallet](/management-api/player-billing). Money is strictly a
**payment edge** on the free pipeline — publish, consent, install,
admission, and the kill ladder are byte-identical whether a listing costs
nothing or $9.99. A free listing today behaves exactly as it did before
paid modes existed.

The marketplace turns [player code](player-code) into **discoverable,
acquirable products** inside one app: an author publishes a versioned
listing, a player browses their game's store, acquires it (free or from
their wallet), consents
to its **derived capability summary**, and installs it into a grid they own
(server code) or their client. Acquired code runs under the exact same
runtime as self-authored code — same registry, same host boundary, same
quotas and kill ladder. The marketplace adds *provenance and entitlement*,
never a second execution path.

## Identity model (what everything hangs on)

The **author** is provenance: source access, listing control, and
proceeds. The author has **no residual access** to any buyer's world;
a mod is a program, not a service.

- An installed **server** mod runs **as the installing grid owner**, in
  their grid, on their quota and wallet.
- A **client** mod runs **as the player running it**, in their browser
  sandbox.

## Claim a player-owned chunk grid

Apps with the `self_claim` grid policy can let an ordinary player claim an
unclaimed chunk without giving the game client the studio-only `manage_apps`
permission:

```graphql
mutation ClaimChunk($appId: BigInt!, $chunk: ChunkCoordinatesInput!) {
  claimGridChunk(appId: $appId, chunk: $chunk) {
    gridId
    lowChunk { x y z }
    highChunk { x y z }
    policy
    ownership { ownerKind ownerRef acquiredVia }
    moddable
    effectivePermissionKeys
  }
}
```

The mutation is atomic: it checks the app policy and spatial overlap, creates
the one-chunk grid, assigns the caller as its current owner, and materializes
the caller's build plus tier-entitled player-code keys. A competing claim
returns a conflict and leaves no grid, ownership, or ACL rows behind.

Release only grids created by this self-claim path:

```graphql
mutation {
  releaseClaimedGrid(appId: "2", gridId: "42") { released }
}
```

Only the current owner can release the claim. Studio grids, purchased grids,
and another player's claim fail closed. A successful release removes the
self-claimed grid and makes that chunk claimable again; it does not delete
chunks, voxels, or game-model data in the region.

## Publish

Only artifact **hashes** and derived metadata are published; source never
leaves the author's module versions (there is no moderation override — see
[source privacy](player-code#source-privacy)).

```graphql
mutation {
  publishPlayerCode(input: {
    appId: "1"
    name: "Visitor greeter"
    licenseMode: OPEN_SOURCE      # or CLOSED (default)
    # ownerOrgId: "5"             # org-owned code (DN-9); needs manage_compute
  }) { listingId }
}
```

```graphql
mutation {
  publishPlayerCodeVersion(input: {
    appId: "1"
    listingId: "..."
    moduleVersionIds: ["..."]     # your compiled module versions
    openSource: true              # irreversible per version
  }) { versionId capabilityHash }
}
```

Versions are **immutable**; an update is a new version with new artifact
hashes. A version that packages both server and client module versions is a
**bundle** (see below). Publishing under `ownerOrgId` makes the **org** the
owner: org members read source per org RBAC, and the org is what a studio
allow-list can admit wholesale.

## Capability summary (the trust control)

Every published version carries a capability summary **derived from the
compiled artifact** — imported host functions, capability groups
(model/state/world_read/world_write/egress/present), presentation hooks,
trigger kinds, invoke contracts, and egress budgets. It is never
self-declared. Installers consent to its **hash**; a newer version whose
summary **widens** carries a different hash, so stale consents fail closed
and re-consent is always explicit.

## Acquire → consent → install

```graphql
mutation { acquirePlayerCode(appId: "1", listingId: "...") { acquisitionId } }
```

A free acquisition writes the same entitlement row a paid one will; it is
idempotent and retained forever (uninstalls never delete it). In
`allow_list` apps an unadmitted listing is **acquirable but uninstallable**
until the studio admits the listing, its author, or its org.

```graphql
mutation {
  installPlayerCode(
    appId: "1"
    acquisitionId: "..."
    consentCapabilityHash: "..."  # echo the version's capabilityHash
    gridId: "42"                  # a grid YOU own (server/bundled listings)
  ) { installId pinnedVersionId }
}
```

Installs **pin** their version; updating to a newer version is a new
explicit consent, never automatic. Server halves register through the same
registry as self-authored modules with provenance pointing at the listing.
`uninstallPlayerCode` removes instances, attachments, and fetch rights but
keeps the acquisition.

## Pricing and license lifecycles (paid modes)

Authors price a listing **after** publishing it (`setListingPricing`,
Management API; author-only — curation can reject a listing but never
reprice it). Non-free modes require completed
[seller onboarding](#selling--payouts).

| Mode | You get | Lifecycle |
|---|---|---|
| `FREE` | Perpetual entitlement | none |
| `BUY` | Perpetual license | none (idempotent re-buy) |
| `RENT` | `rentIntervalDays` of access | `expiresAt`; renewable |
| `TIME_LIMITED` | A single `windowDays` window | `expiresAt`; extendable |
| `COST_LIMITED` | `unitBudget` compute units | `unitsConsumed` advances; top up to extend |

A paid acquisition is only **live** while its terms hold. Past `expiresAt`
(or once `unitsConsumed >= unitBudget`) the install **drains at the
scheduler gate and both artifact ACLs fail closed** — the module stops
running and clients can no longer fetch its bytes. Consent is retained, so
renewing resumes without a re-consent:

```graphql
mutation { renewPlayerCodeAcquisition(appId: "1", acquisitionId: "...") { expiresAt } }
mutation { topUpPlayerCodeAcquisition(appId: "1", acquisitionId: "...") { unitBudget unitsConsumed } }
```

Cost-limited metering slices the **existing** per-player usage rollup by
install provenance (a marketplace install owns its module instances); there
is no per-invoke micro-billing, and exhaustion is eventually-consistent on
the same cadence as the wallet gate.

## Buying and refunds

`acquirePlayerCode` on a paid listing **debits your wallet** — there is no
checkout redirect in the purchase path; fund the wallet first (top-up via
`createCheckout` purpose `PLAYER_WALLET_TOPUP`). An insufficient balance
**refuses atomically** (`INSUFFICIENT_WALLET_BALANCE`): no order, no debit,
no partial state.

**In-client top-up.** A game can offer the top-up in-game without shipping
an identity session: an app-scoped gameplay token may call `createCheckout`
**only** for `PLAYER_WALLET_TOPUP` (and read its own `playerWalletBalance`).
Redirect the player to the returned `externalUrl` (Stripe's hosted card
page — no card data touches the game), and refresh the balance on return;
the `checkout.session.completed` webhook credits the wallet. Blocks with
Friends wires this as the Store tab's "Top up" presets.

Each sale splits three ways at order time: the platform takes 30%, the app
org takes its configured share of the remainder
(`setAppMarketplaceOrgShare`, basis points, default 0), and the seller gets
the rest. Splits always sum to the price paid.

Refunds (`refundPlayerCodeAcquisition`) follow fixed rules: within **14
days**, **void on meaningful use** (the first install or client fetch), and
capped at **3 per buyer per 30 days**. A refund credits your wallet,
reverses the ledger split, claws back the seller's balance, revokes the
acquisition, and drains installs.

## Selling & payouts

Sellers (players, or orgs for org-owned listings) onboard **Stripe Connect**
before pricing anything above free — KYC lives with Stripe; the platform
stores only an account reference. Onboarding and payout management render
**inside the platform UI** via Stripe's embedded components: create an
Account Session, initialize Connect.js with the returned publishable key +
client secret, and mount `account-onboarding` (KYC), `payouts`, and
`balances` in your page — no redirect to a Stripe-hosted site. Client
secrets are short-lived; pass the mutation as Connect.js's
`fetchClientSecret` callback so sessions refresh automatically. The
hosted-link flow (`beginSellerOnboarding`) remains as a fallback.

`createSellerAccountSession` is callable with an app-scoped gameplay token
(it only ever mints the **caller's own** account session), so the seller
dashboard mounts **in-game** — Blocks with Friends opens it from a "Sell &
payouts" panel. Because Connect.js loads a cross-origin script, the page must
be cross-origin isolated (COOP `same-origin` + COEP `credentialless`), the
same headers a game needs for client-mod execution. The org variant
(`createOrgSellerAccountSession`) and every payout-moving mutation
(`requestSellerPayout`, `spendPayoutBalanceToWallet`) stay identity-session
only.

```graphql
mutation { createSellerAccountSession(country: "US") {   # embedded components (primary)
  clientSecret publishableKey accountRef onboardingComplete } }
mutation { beginSellerOnboarding(country: "US") { status onboardingUrl } }  # hosted fallback
query { mySellerPayoutBalance { pendingCents payableCents reservedCents } }
mutation { requestSellerPayout }                      # aged balance -> Stripe transfer
mutation { spendPayoutBalanceToWallet(amountCents: 500) }  # earn-to-mod
```

Sale proceeds age **7 days** from pending to payable; young seller accounts
(< 60 days from first sale) carry a **10% reserve held 90 days**; payouts
have a **$10 minimum**. `spendPayoutBalanceToWallet` (earn-to-mod) skips the
provider round-trip entirely — earnings can fund your own compute without a
bank account. In regions Stripe Connect does not support, onboarding
reports `unavailableReason` honestly; earn-to-mod still works.

Fraud controls (T11): buyer/listing velocity caps **hold** orders for
studio review (`commerceRiskQueue` / `decideCommerceRiskFlag`,
`manage_compute`); self-dealing (buying your own listing, or a listing of
an org you belong to) freezes the payout clock pending review; card
disputes on wallet top-ups claw back the wallet and flag the buyer. See the
[commerce incidents runbook](/operators/commerce-incidents).

## Bundles and grid-attached client mods

A bundled listing (server + client halves) installed into a grid also
creates a **grid client attachment**: players present in that grid can
discover it (`gridClientMods`), read its capability summary, and **consent
individually** (`consentGridClientMod`) before their browser may fetch and
run it (`playerCodeClientArtifact`). This is how grid owners offer client
compute to visitors — for example a client half that relays actor updates
into the grid's server compute or model, giving the grid push-style
presence without any platform change.

Visitor fetches are fail-closed on **all** of: an active attachment, the
player's consent matching the pinned version's exact capability hash,
presence in the grid, `run_client_code`, and admission. Acquirers with a
live install fetch through the same query without the presence factor.

## Admission at scale

The [admission system](player-code#code-admission-studio-censorship) is the
curation spine. Studio tooling on the Management API:

- `appCodeAdmissionQueue(appId)` — every listing joined with its allow-list
  standing (`ADMITTED` / `PENDING` / `REVOKED`) and which subject admitted
  it (code, author, or org).
- `admitAppCode` / `revokeAppCodeAdmission` — admit one listing, one
  author, or a whole org (wholesale admission is the org-owned-code
  payoff). De-admission drains running installs through the same path as a
  permission revocation.

## Listing kill (the fleet-wide switch)

Killing a **listing** stops every install fleet-wide within a scheduler
pass; killing an **install** is just uninstalling it. The listing kill has
two halves that pair:

- runtime: `playerComputeSetSwitch(appId, scope: "listing", listingRef:
  "<listing UUID>", disabled: true)` (Game API, `manage_compute`),
- catalog: `setPlayerCodeListingStatus(..., status: KILLED)` (Management
  API) so the store stops offering it.

Quota state is retained; releasing the switch resumes normally.

## Grid claim policies (how claims confer ownership)

Each app chooses how a player claim confers `grid_ownership`
(`setAppGridClaimPolicy`, Management API):

| Policy | Semantics |
|---|---|
| `SELF_CLAIM` | The claim alone assigns ownership (server-authorized; the default) |
| `APPROVAL` | Claims create requests; designated approvers (or staff with `manage_compute`) accept via `decideGridClaim` |
| `INVITE` | Ownership only against a standing `issueGridClaimInvite` invite |
| `MARKETPLACE_ONLY` | Direct claims refused; ownership arrives only via a [grid purchase](grid-commerce) |

`claimGridOwnership(appId, gridId)` executes the policy. On success the
claimer also receives grid grants for whichever player-code keys their tier
already carries — mod rights ride tier keys, and studio
`grid_permission_limits` still cap the result.

## Ownership transfer and delisting

- **Personal ↔ org transfer** (`transferPlayerCodeListing`, Management
  API) is audited and moves listing control, source-access rights, and
  future proceeds.
- **Delisting** stops new acquisitions; existing installs keep running
  their pinned versions — buyers keep what they acquired. Deleting an
  author module is refused while a live listing references its versions.
- **Grid transfer safety** is unchanged from P1: a transferred grid
  disables all installed modules at commit pending the new owner's consent,
  with module state wiped.
