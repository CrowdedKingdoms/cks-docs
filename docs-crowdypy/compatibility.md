---
slug: compatibility
sidebar_position: 8
title: Compatibility and parity
---

# Compatibility and parity

## API surface

CrowdyPy follows CrowdyJS at a pinned version and commit, recorded in its
`pyproject.toml`. A strict parity gate fails the build on any CrowdyJS method,
class, export or GraphQL root that CrowdyPy lacks. Each remaining difference
carries a reviewed reason, and the generated
[parity matrix](https://github.com/CrowdedKingdoms/CrowdyPy/blob/prod/docs/parity-matrix.md)
lists them all:

- **Native equivalents.** The same contract, built CrowdyPy's way: the native
  replication client in place of the GraphQL UDP proxy, and Python naming.
- **Browser exclusions.** The DOM, iframe and Web Worker features no Python
  client has, such as the embedded Studio panes.

CrowdyPy also wraps the GraphQL roots that CrowdyCPP sends and CrowdyJS does not,
including email confirmation, usage projections, compute budgets and the Studio
agent's policy.

## Server compatibility

- **The input log** (`client.input_log`, 0.7.0) needs Application API v2.39.0 or later:
  every app read selects `replayLoggingEnabled`, which an older Application API refuses. **From
  0.10.0 the sessions read selects `missingRecords`, so it needs the Application API release
  after v2.40.2**, which also brings the retryable `INPUT_LOG_TEMPORARILY_UNAVAILABLE` /
  `INPUT_LOG_RATE_LIMITED` (`extensions["retryable"]`) and the `logging_off`, `shutdown`,
  `paused` and `unrecorded` end reasons. Cancel a read's task to stop it: that closes the
  request and frees its share of the server's reads. A message's `body` is standard
  base64: `decode_base64` gives the bytes. See
  [Input logging](/replication-api/input-logging).
- **Bans** (`client.channels.ban` / `unban`, `client.teams.ban` / `unban`, 0.11.0) need
  Application API v2.44.0 or later, and the final `4403` close needs ck-exec 0.16 hosts; an older
  host never sends it.
- **Org-managed players** (`client.managed_players`, `portal.adopt_app_token`,
  `portal.exchange_managed_player_assertion`, 0.16.0) need Application API v2.53.0 or later on any
  environment (v2.52.x served them on dev only), and the organization's acceptance of the
  Org-Managed Players Addendum. The addendum fields on `managed_players.settings` and
  `org_legal_acceptance_required_of` are 0.17.0. See
  [Org-managed players](/management-api/org-managed-players).
- **Fleet sessions** (`client.fleet_sessions`, `crowdypy.fleet.AsyncFleetSession` and
  `FleetSession`, `exec.connect_as_server`, and `call_as`, 0.40.0) need Application API
  v2.89.1, replication server v0.50.3, and ck-exec 0.25.0, and Crowded Kingdoms switches them
  on for an organization. See
  [Run your own game servers with a fleet session](/management-api/fleet-sessions#crowdypy).
- **CrowdyPy 0.41.0 needs Application API v2.90.0** for every call that answers an app token:
  `portal.mint_app_token`, `exchange_code`, `refresh`, `exchange_managed_player_assertion`, and
  `sign_in_with_minecraft` select `userId` (`AppTokenResponse.user_id`), and an older
  Application API answers them with a GraphQL validation error. What else 0.41.0 wraps, and
  what each call needs:

  | Call | Needs |
  |---|---|
  | `client.managed_players.delete_many(org_id, external_ids)`, 1 to 100 players a call | Application API v2.90.0 |
  | `fleet.refresh_input()` naming an `ip6` | Application API v2.90.0 |
  | `fleetSessionsEnabled`, `maxFleetSessions`, and `maxFleetPlayers` in `client.managed_players.settings(org_id)` | Application API v2.89.0 |
  | `client.exec.org_compute_ceiling(org_id)` | Application API v2.88.0, and `view_compute_diagnostics` on the organization |
  | The `not_present` and `not_present_ended` handlers | Replication server v0.51.0. An older server never refuses a keepalive, so no report is made |

  Application API v2.90.0 and replication server v0.51.0 have been on every environment since
  November 27, 2026. CrowdyPy 0.41.0 followed on November 28, 2026, and vendors CrowdyCPP
  0.95.0.

  Moving from 0.40.0, your code needs a change in two cases:

  1. It branches on every `FleetCarryOutcome`. Add `TABLE_FULL`
     ([fleet sessions](/management-api/fleet-sessions#crowdypy)).
  2. It passed a fleet session a `silence_timeout_ms` under 4,500. 0.40.0 raised it to 4,500.
     The floor is now 3,000, so the session orders a move sooner.
- The full list of what each release needs from the server is in the repository's
  [compatibility notes](https://github.com/CrowdedKingdoms/CrowdyPy/blob/prod/docs/compatibility.md).

## Native core

The replication client and the World Stores' native session are
[CrowdyCPP](/crowdycpp/intro), vendored at a pinned release. Every release
records its CrowdyCPP and CrowdyJS versions in its migration notes.

## Python

CPython 3.12 or later (`cp312-abi3`), and free-threaded CPython 3.14 (`cp314t`).
CrowdyPy is pre-1.0. Patch releases keep source compatibility, and a new minor
version may change the API, as described in each release's
[migration notes](https://github.com/CrowdedKingdoms/CrowdyPy/blob/prod/MIGRATION.md).
