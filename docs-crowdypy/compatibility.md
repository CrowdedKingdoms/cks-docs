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
[parity matrix](https://github.com/CrowdedKingdoms/CrowdyPy/blob/dev/docs/parity-matrix.md)
lists them all:

- **Native equivalents.** The same contract, built CrowdyPy's way: the native
  replication client in place of the GraphQL UDP proxy, and Python naming.
- **Browser exclusions.** The DOM, iframe and Web Worker features no Python
  client has, such as the embedded Studio panes.

CrowdyPy also wraps the GraphQL roots that CrowdyCPP sends and CrowdyJS does not,
including email confirmation, usage projections, compute budgets and the Studio
agent's policy.

## Server compatibility

- **The input log** (`client.input_log`, 0.7.0) needs Game API v2.39.0 or later:
  every app read selects `replayLoggingEnabled`, which an older Game API refuses. **From
  0.10.0 the sessions read selects `missingRecords`, so it needs the Game API release
  after v2.40.2**, which also brings the retryable `INPUT_LOG_TEMPORARILY_UNAVAILABLE` /
  `INPUT_LOG_RATE_LIMITED` (`extensions["retryable"]`) and the `logging_off`, `shutdown`,
  `paused` and `unrecorded` end reasons. Cancel a read's task to stop it: that closes the
  request and frees its share of the server's reads. A message's `body` is standard
  base64: `decode_base64` gives the bytes. See
  [Input logging](/replication-api/input-logging).
- **Bans** (`client.channels.ban` / `unban`, `client.teams.ban` / `unban`, 0.11.0) need
  Game API v2.44.0 or later, and the final `4403` close needs ck-exec 0.16 hosts; an older
  host never sends it.
- **Org-managed players** (`client.managed_players`, `portal.adopt_app_token`,
  `portal.exchange_managed_player_assertion`, 0.16.0) need Game API v2.53.0 or later on any
  environment (v2.52.x served them on dev only), and the organization's acceptance of the
  Org-Managed Players Addendum. The addendum fields on `managed_players.settings` and
  `org_legal_acceptance_required_of` are 0.17.0. See
  [Org-managed players](/management-api/org-managed-players).
- The full list of what each release needs from the server is in the repository's
  [compatibility notes](https://github.com/CrowdedKingdoms/CrowdyPy/blob/dev/docs/compatibility.md).

## Native core

The replication client and the World Stores' native session are
[CrowdyCPP](/crowdycpp/intro), vendored at a pinned release. Every release
records its CrowdyCPP and CrowdyJS versions in its migration notes.

## Python

CPython 3.12 or later (`cp312-abi3`), and free-threaded CPython 3.14 (`cp314t`).
CrowdyPy is pre-1.0. Patch releases keep source compatibility, and a new minor
version may change the API, as described in each release's
[migration notes](https://github.com/CrowdedKingdoms/CrowdyPy/blob/dev/MIGRATION.md).
