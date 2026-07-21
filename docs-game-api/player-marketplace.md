---
sidebar_position: 26
title: Marketplace (free mode)
---

# Marketplace (free mode)

:::info No money yet
This phase (P4a) ships the **free acquisition mode only**. Every listing is
free; there is **no checkout, no ledger, no revenue split, no payout, no
seller onboarding**. The paid modes (buy, rent, time-limited, cost-limited)
and payouts arrive with the real-money workstream (P4b) as a payment edge on
this exact pipeline — nothing here changes shape when pricing lands.
:::

The marketplace turns [player code](player-code) into **discoverable,
acquirable products** inside one app: an author publishes a versioned
listing, a player browses their game's store, acquires it (free), consents
to its **derived capability summary**, and installs it into a grid they own
(server code) or their client. Acquired code runs under the exact same
runtime as self-authored code — same registry, same host boundary, same
quotas and kill ladder. The marketplace adds *provenance and entitlement*,
never a second execution path.

## Identity model (what everything hangs on)

The **author** is provenance: source access, listing control, and — from
P4b — proceeds. The author has **no residual access** to any buyer's world;
a mod is a program, not a service.

- An installed **server** mod runs **as the installing grid owner**, in
  their grid, on their quota and wallet.
- A **client** mod runs **as the player running it**, in their browser
  sandbox.

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
| `MARKETPLACE_ONLY` | Direct claims refused; ownership arrives only via a grid purchase (P4b) |

`claimGridOwnership(appId, gridId)` executes the policy. On success the
claimer also receives grid grants for whichever player-code keys their tier
already carries — mod rights ride tier keys, and studio
`grid_permission_limits` still cap the result.

## Ownership transfer and delisting

- **Personal ↔ org transfer** (`transferPlayerCodeListing`, Management
  API) is audited and moves listing control and source-access rights (and,
  from P4b, proceeds).
- **Delisting** stops new acquisitions; existing installs keep running
  their pinned versions — buyers keep what they acquired. Deleting an
  author module is refused while a live listing references its versions.
- **Grid transfer safety** is unchanged from P1: a transferred grid
  disables all installed modules at commit pending the new owner's consent,
  with module state wiped.
