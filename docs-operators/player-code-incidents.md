---
sidebar_position: 8
title: Player-code incidents (kill ladder)
---

# Player-code incidents: the kill ladder and hostile-listing triage

Player code (server mods in owned grids, client mods in browsers, and — from
P4a — marketplace listings) is stopped through **policy rows the scheduler
already consults**, never ad-hoc process surgery. Every switch stops
execution on the next scheduler pass (bounded seconds), retains quota
state, and releases cleanly.

## The ladder (narrowest first)

| Scope | Stops | How |
|---|---|---|
| module | one module | `playerComputeSetEnabled(..., enabled: false)` |
| install | one marketplace install | `uninstallPlayerCode` (the installer) or the module-level disable |
| player | everything a player owns runs in the app | `playerComputeSetSwitch(scope: "player", scopeRef: userId)` |
| grid | everything in one grid | `playerComputeSetSwitch(scope: "grid", scopeRef: gridId)` |
| **listing** | **every install of a marketplace listing, fleet-wide (P4a)** | `playerComputeSetSwitch(scope: "listing", listingRef: listingUuid)` |
| app | all player compute in the app | `playerComputeSetSwitch(scope: "app")` |

All switch writes require the org `manage_compute` permission (operator org
tokens qualify); active switches are listed by `playerComputeSwitches`.
Releasing (`disabled: false`) resumes normally — quota windows were never
reset, so a killed abuser does not get a fresh budget.

## Hostile-listing triage (T8)

A "hostile listing" report (griefing buyers, quota-draining installs,
capability-summary complaints) walks this order:

1. **Stop the bleeding — runtime kill, fleet-wide.**
   `playerComputeSetSwitch(appId, scope: "listing", listingRef: "<uuid>",
   disabled: true, reason: "...")` on the Game API. Every install stops on
   the next pass; the self-authored path and other listings are untouched.
2. **Stop distribution — catalog kill.**
   `setPlayerCodeListingStatus(appId, listingId, status: KILLED)` on the
   Management API (audited). The store stops offering it; acquisitions stay
   for audit.
3. **De-admit if the app curates.** In `allow_list` apps, revoke the
   admission (`revokeAppCodeAdmission`) so the subject cannot re-enter via
   a new version; consider whether the **author** or **org** subject should
   also be revoked.
4. **Evidence, not source.** Moderation works from runs/logs
   (`playerComputeRuns`), usage rollups, and the **derived capability
   summary** on the listing version. There is **no source read** for
   closed listings — no operator break-glass exists by design (OQ-1);
   do not look for one.
5. **Scope the blast radius.** An installed server mod ran as each
   *installing owner* in their own grid on their own wallet — harm is
   confined to consenting buyers. Check `appPlayerCodeAcquisitions` for
   the affected set if buyer outreach is needed.
6. **Release deliberately.** If the report is cleared, release the runtime
   switch and (owner action) relist. A killed catalog status is terminal
   for the listing owner; only studio staff set it.

## Related

- Wallet/quota exhaustion pauses are **not incidents**: they are the P2
  gate working (`PLAYER_WALLET_EMPTY` / `PLAYER_SPEND_CAP` /
  `PLAYER_QUOTA_EXHAUSTED` reasons on `playerComputeUsage`).
- Grid transfers disable installed modules at commit pending new-owner
  consent — a "my mods stopped after buying a grid" report is the safety
  path, not a failure.
- Admission mechanics and the studio queue:
  [Marketplace (free mode)](/game-api/player-marketplace).
