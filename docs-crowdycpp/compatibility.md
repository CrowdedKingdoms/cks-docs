---
slug: compatibility
sidebar_position: 8
title: Compatibility and parity
---

# Compatibility and parity

## Server compatibility

CrowdyCPP targets the current platform APIs and degrades gracefully on older
deployments:

- **`userAppState` round-trip.** Older Application API builds stored the base64
  `state` input verbatim and re-encoded on read, so reads returned
  base64(base64(bytes)); newer builds round-trip symmetrically. Decode
  defensively if you must read rows written through an old server.
- **The input log** (`inputLog()`, 0.59.0) needs Application API v2.39.0 or later: every
  app read selects `replayLoggingEnabled`, which an older Application API refuses. **From
  0.62.0 the sessions read selects `missingRecords`, so it needs the Application API release
  after v2.40.2**, which also brings the retryable `INPUT_LOG_TEMPORARILY_UNAVAILABLE` /
  `INPUT_LOG_RATE_LIMITED` (`graphql::inputLogReadRetryable`) and the `logging_off`,
  `shutdown`, `paused` and `unrecorded` end reasons. Each read takes a
  `graphql::CancelToken` (CrowdyJS's `signal`), which ends a read nobody will see
  while the client's timeout still applies. A message's `body` is standard base64:
  `crowdy::core::base64Decode` (`crowdy/core/base64.hpp`) gives the bytes. See
  [Input logging](/replication-api/input-logging).
- **Org-managed players** (`admin().managedPlayers()`, `portal().adoptAppToken`,
  `portal().exchangeManagedPlayerAssertion`, 0.68.0) need Application API v2.53.0 or later on any
  environment (v2.52.x served them on dev only), and the organization's acceptance of the
  Org-Managed Players Addendum. The addendum fields on `managedPlayers().settings()` and
  `graphql::orgLegalAcceptanceRequiredOf` are 0.69.0. See
  [Org-managed players](/management-api/org-managed-players).
- **Fleet sessions** (`admin().fleetSessions()`, `replication::FleetSession`,
  `exec().connectAsServer`, and `ExecConnection::callAs`, 0.94.1) need Application API v2.89.1,
  replication server v0.50.3, and ck-exec 0.25.0, and Crowded Kingdoms switches them on for
  an organization. See
  [Run your own game servers with a fleet session](/management-api/fleet-sessions).
- **CrowdyCPP 0.95.0 needs Application API v2.90.0** for every call that answers an app
  token: `portal().mintAppToken`, `refresh`, `exchangeCode`, `completeEntry`,
  `exchangeManagedPlayerAssertion`, and `signInWithMinecraft` select
  `AppTokenResponse::userId`, which an earlier Application API refuses. Through 0.94.1 those
  calls needed v2.85.0. What else 0.95.0 wraps, and what each call needs:

  | Call | Needs |
  |---|---|
  | `admin().managedPlayers().removeMany(orgId, externalIds)`, up to 100 players a call | Application API v2.90.0 |
  | `fleetSessions().refresh(session)` naming an `ip6` | Application API v2.90.0. Naming an `ip4` works with v2.89.0 |
  | `fleetSessionsEnabled`, `maxFleetSessions`, and `maxFleetPlayers` on `managedPlayers().settings(orgId)` | Application API v2.89.0 |
  | `exec().orgComputeCeiling(orgId)` | Application API v2.88.0, and `view_compute_diagnostics` on the organization |
  | `Handlers::notPresent`, `FleetHandlers::notPresent`, and `WorldSessionConfig::onNotPresent` | Replication server v0.51.0. An older server never refuses a keepalive, so the report is never made |

  Application API v2.90.0 and replication server v0.51.0 have been on every environment since
  November 27, 2026. 0.95.0 works with replication server v0.50.3 and later.

  Moving from 0.94.1, your code needs a change in six cases:

  1. It sends a `Connection` notifications from a server of your own that does not sign them.
     Sign them, or set `Config::verifyNotifications = false`
     ([receive path](/crowdycpp/replication-client#receive-path)).
  2. It set `Config::refreshLeadMs = 0` and relied on the connection to reassign on
     `TOKEN_EXPIRED`. Call `connection.requestReassignment()` from `Handlers::genericError`
     when the code is `TokenExpired`, after your own token refresh.
  3. It expects one `pump()` to read everything that is waiting. Call `pump()` until it
     returns less than 1,024.
  4. It switches over `FleetCarryStatus` without a `default`. Add `TableFull`
     ([fleet sessions](/management-api/fleet-sessions#crowdycpp)).
  5. It reads a carried player's refused keepalive from `FleetHandlers::sendRefused`. Read it
     from `FleetHandlers::notPresent`.
  6. It counts on `WorldSession::errors()` holding every refused keepalive. It now holds the
     first one of each report ([world session](/crowdycpp/world-session)).

## CrowdyJS parity

CrowdyCPP mirrors [CrowdyJS](/crowdyjs/intro) — same domains, same
[two-token model](/management-api/portals-and-app-tokens), same error codes —
and the SDK repository verifies that claim mechanically with a generated
[parity matrix](https://github.com/CrowdedKingdoms/CrowdyCPP/blob/prod/docs/parity-matrix.md).
The guarantees:

- **Full GraphQL root-field coverage for clients.** Every non-deprecated
  Management API and Application API root field that a player, a developer or an org
  admin can call is covered by a typed method. Fields only a super-admin or a
  platform operator can call are deliberately not wrapped (since 0.51.0): the
  SDK is for normal clients. The other waived family is the **udp-proxy
  surface** (`connectUdpProxy`, the proxy `send*` mutations, the
  `udpNotifications` subscription): that is the browser proxy path, and
  CrowdyCPP replicates natively over UDP instead — each proxy send has a native
  wire-message counterpart.
- **CrowdyJS method parity.** Every CrowdyJS class/method maps to a C++
  counterpart, with a handful of documented waivers where the platform
  differs (browser storage helpers, subscription-style `on()` registration —
  the C++ session is tick-driven with handlers on the connection).

The matrix is regenerated after any surface change; **missing methods: 0,
missing root fields: 0**, with every exclusion above listed and its reason
given, is the maintained invariant.

## Testing your integration

CrowdyCPP ships an extensive **black-box end-to-end suite** you can point at
any deployment you can sign in to (production, or your own local stack) to validate an integration
end to end. It provisions like a real integrator through the public
Management API — sign in, ensure an access tier, grant access — with no
privileged or database access, and it drives replication over the **native
UDP** path, so it exercises the exact shipping client. Coverage spans the
replication surface (fan-out, distance/decay, negative auth, cross-app
isolation, cross-server, soak), the world-data and management surfaces, the
[WorldSession](/crowdycpp/world-session) data structures, and the kit's
social layer. See
[`tests/e2e/`](https://github.com/CrowdedKingdoms/CrowdyCPP/tree/prod/tests/e2e)
(configure with `CROWDY_E2E_*` environment variables) and the
[coverage matrix](https://github.com/CrowdedKingdoms/CrowdyCPP/blob/prod/docs/e2e-coverage.md),
which accounts for every scenario in the platform's other e2e suites. The
suites double as runnable, real-world usage examples for each surface.

## Versioning

Each environment has its own releases, tagged in the
[repository](https://github.com/CrowdedKingdoms/CrowdyCPP) as `dev/vX.Y.Z`,
`test/vX.Y.Z` and `prod/vX.Y.Z`; build against the newest tag of the
environment your game runs on. Until 1.0, a minor release may change the source
or the ABI, and a patch release keeps both: read the SDK's `MIGRATION.md` and
rebuild when you move between minors. The CMake package config enforces
`SameMinorVersion` compatibility for `find_package(CrowdyCPP)` consumers, so a
request for `0.95` accepts a newer `0.95.x` and no `0.96.x`. Consumer-facing platform changes land in
the [changelog](/releases/intro); the committed schema snapshot ties each SDK
release to a known Management + Application API surface.
