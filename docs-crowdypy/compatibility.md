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
  every app read selects `replayLoggingEnabled`, which an older Game API refuses. The
  retryable `INPUT_LOG_TEMPORARILY_UNAVAILABLE` / `INPUT_LOG_RATE_LIMITED` and the
  `logging_off` / `shutdown` end reasons come with the Game API release after v2.40.2.
  A message's `body` is standard base64: `decode_base64` gives the bytes. See
  [Input logging](/replication-api/input-logging).
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
