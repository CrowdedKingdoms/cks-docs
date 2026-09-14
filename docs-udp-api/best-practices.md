---
sidebar_position: 2
title: Best practices
---

# Replication API best practices

Native UDP to Buddy. Browsers should use the
[GraphQL UDP proxy](/game-api/graphql-udp-proxy-api) instead.

## Authenticate, then assign

1. Sign in for an identity session token.
2. Mint an **app-scoped token** for the app (`mintAppToken`). Buddy rejects
   the session token.
3. Call `serverWithLeastClients` **on that app's** `gameApiUrl`.
4. Wait **~1.5 seconds** after assignment before the first spatial send.
5. Sign every datagram with HMAC-SHA256 over the app-scoped token.
   [HMAC](/replication-api/hmac).

Full sequence: [Authenticate and assign](/replication-api/authenticate-and-assign).

## Stay on the session

- Send a heartbeat at least every **4 seconds** while the actor is present,
  and some traffic at least every **60 seconds**.
  [Operations](/replication-api/operations).
- Refresh the app token before `expiresAt`. An expired token yields
  `TOKEN_EXPIRED`; mint/refresh and re-assign.
- On `COMMAND_RECONNECT` (type 22), verify the HMAC and call
  `serverWithLeastClients` again. Do not keep sending to the old host.
- Handle `WRONG_DATACENTER` by reconnecting to `extensions.gameApiUrl`.
  [Datacenter routing](/game-api/datacenter-routing).

## Permissions and silence

- Every spatial message is authorized. The sender needs an active access
  grant whose tier includes the relevant key, and a grid grant on the
  target chunk.
- A failed HMAC or bad token can be **dropped with no NAK**. Do not treat
  silence as ordinary packet loss.
- `UNAUTHORIZED` (code 7) on a brand-new chunk can be transient while
  permissions load; retry for several seconds before re-assigning.

## Gameplay authority

UDP carries **poses and events**. It is not the place to decide damage,
captures, ownership, or team assignment. Those are
[Game Model effects](/game-api/best-practices) (or Compute that invokes
them). The client sends input and presents confirmed Model/Compute results.

## Load testing your integration

Drive the **same public flow** your players use. See
[Load testing](/replication-api/load-testing). Sustained traffic is billed
like real players — test against isolated capacity and set spend caps
before hitting shared production.

## Related

- [Wire formats](/replication-api/wire-formats)
- [Troubleshooting](/replication-api/troubleshooting)
- [Overview best practices](/overview/best-practices)
