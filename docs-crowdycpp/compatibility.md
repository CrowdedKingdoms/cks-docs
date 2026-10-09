---
slug: compatibility
sidebar_position: 8
title: Compatibility and parity
---

# Compatibility and parity

## Server compatibility

CrowdyCPP targets the current platform APIs and degrades gracefully on older
deployments:

- **`userAppState` round-trip.** Older Game API builds stored the base64
  `state` input verbatim and re-encoded on read, so reads returned
  base64(base64(bytes)); newer builds round-trip symmetrically. Decode
  defensively if you must read rows written through an old server.

## CrowdyJS parity

CrowdyCPP mirrors [CrowdyJS](/crowdyjs/intro) — same domains, same
[two-token model](/management-api/portals-and-app-tokens), same error codes —
and the SDK repository verifies that claim mechanically with a generated
[parity matrix](https://github.com/CrowdedKingdoms/CrowdyCPP/blob/prod/docs/parity-matrix.md).
The guarantees:

- **Full GraphQL root-field coverage for clients.** Every non-deprecated
  Management API and Game API root field that a player, a developer or an org
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
environment your game runs on. The CMake
package config enforces `SameMajorVersion` compatibility for
`find_package(CrowdyCPP)` consumers. Consumer-facing platform changes land in
the [changelog](/releases/intro); the committed schema snapshot ties each SDK
release to a known Management + Game API surface.
