---
sidebar_position: 22
title: Rate limits and query cost
---

# Rate limits and query cost

## Current status

The public GraphQL APIs do **not** currently enforce a published per-key rate limit, and
they do **not** return rate-limit headers or an `extensions.cost` budget on responses.
There is no documented max query depth or complexity today. If and when limits are
introduced, they will be documented here and announced in the
[changelog](/releases/intro) before enforcement.

This does not mean "unlimited" — treat the platform as a shared service and design for
back-pressure:

- **Back off on errors.** On `INTERNAL_SERVER_ERROR` or a transport failure, retry with
  exponential backoff and jitter. Do **not** tight-loop retry.
- **Do not blind-retry economy mutations.** `createCheckout` and similar mutations are
  not idempotent yet, so an aggressive retry can double-create. See
  [Error codes](/overview/error-codes).
- **Batch reads** with pagination (see [Pagination](/overview/pagination)) instead of
  many tiny requests.

### The one GraphQL limit that is enforced: `gameModelInvoke`

`gameModelInvoke` is bounded at **120 invocations per 10 seconds per (player, app)**,
a fixed window shared across every API replica. It is sized so that a client that
waits for each response can never reach it (a serial caller is held to about 4 per
second by the per-call ceiling); hitting it means at least three invocations in
flight at once, sustained — a loop, a retry storm, or a duplicate-delivery bug.
The refusal is `RATE_LIMIT_EXCEEDED` and counts admitted and policy-denied
invocations alike. Nothing else on the game-model surface is rate limited today:
`gameModelEnsureContainer`, `gameModelSeed`, `gameModelContainers` and
`gameModelContainerState` carry no per-call quota, so a bulk level load is bounded
by page size (see [Game models](/game-api/game-models#reading-state-and-the-graph))
rather than by a rate.

## Realtime (UDP) cost model

The realtime path is **best-effort UDP** and is governed by a spatial fan-out model
rather than a request quota:

- Each spatial message carries a `distance` (0–8 chunks, Chebyshev) and a `decayRate`
  (0–5) that together bound how far and how often it replicates to nearby clients. Choose
  the smallest `distance` and an appropriate `decayRate` for your gameplay to limit
  amplification. See [Wire formats](/replication-api/wire-formats) for the decay
  algorithms.
- The server coalesces outbound messages into bundles (~1 ms window), so a client should
  expect batched delivery and parse `MESSAGE_BUNDLE`s. Clients may coalesce the same way
  (replication server v0.27.0+; the SDKs do it by default): several requests in one
  datagram are charged once for the datagram's wire bytes and counted once per accepted
  message.
- `sequenceNumber` is a `uint8` that wraps at 255 and is **correlation only** — it is not
  a flow-control or idempotency mechanism.
- **Per-session send-rate limit (replication server v0.28.0+).** Each authenticated
  session may send a sustained **500 messages/second** with bursts up to **1,000**
  (a token bucket per session; every member of a `MESSAGE_BUNDLE` counts as one).
  Messages beyond that are **dropped silently** — no `GENERIC_ERROR_MESSAGE`, because a
  reply would let a flooder amplify — so if your client sends bursts well above real
  gameplay rates (voice ~50/s, video ≤60/s, actor updates ~20/s) and sees gaps, check
  your send rate before suspecting the network. The limit is spent only by messages
  that already passed session and HMAC checks; unauthenticated traffic cannot consume
  a real session's budget.

## Quotas (a different concept)

Per-org/app **usage quotas** (e.g. metered service limits) are a billing/entitlement
concept, not a transport rate limit. Query the effective quota for a metric with the
Management API `effectiveQuota`, and see
[Shared environment & billing](/management-api/shared-environment#free-tier).
Exceeding a quota surfaces as a quota error on the affected operation, not as a
transport 429.

One shaping cap does behave like a rate limit and is worth knowing about: an
unfunded free app's egress is soft-capped at roughly **1 MB/s**. Funding the org
wallet or enabling auto-billing lifts it — buying a capacity reservation does
not. Once an organization can be charged, CK does not rate-limit its egress, and
spend is bounded by the caps you set rather than by a throughput ceiling.
