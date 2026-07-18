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

## Realtime (UDP) cost model

The realtime path is **best-effort UDP** and is governed by a spatial fan-out model
rather than a request quota:

- Each spatial message carries a `distance` (0–8 chunks, Chebyshev) and a `decayRate`
  (0–5) that together bound how far and how often it replicates to nearby clients. Choose
  the smallest `distance` and an appropriate `decayRate` for your gameplay to limit
  amplification. See [Wire formats](/replication-api/wire-formats) for the decay
  algorithms.
- The server coalesces outbound messages into bundles (~1 ms window), so a client should
  expect batched delivery and parse `MESSAGE_BUNDLE`s.
- `sequenceNumber` is a `uint8` that wraps at 255 and is **correlation only** — it is not
  a flow-control or idempotency mechanism.

## Quotas (a different concept)

Per-org/app **usage quotas** (e.g. metered service limits) are a billing/entitlement
concept, not a transport rate limit. Query the effective quota for a metric with the
Management API `effectiveQuota`, and see the metered-billing guides. Exceeding a quota
surfaces as a quota error on the affected operation, not as a transport 429.
