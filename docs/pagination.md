---
sidebar_position: 21
title: Pagination
---

# Pagination

**Prefer Relay cursor connections** (`*Connection` queries) for large lists. The older
offset/limit queries still work but their paging args are deprecated. The field's arguments
and return type in the [published SDL](pathname:///schema/management-api.graphql) are
authoritative for each operation.

## Relay connections (preferred)

Connection queries take `first` (page size, default 50, max 200) and `after` (an opaque
cursor) and return `edges { node cursor }` + `pageInfo`:

```graphql
query Users($after: String) {
  usersConnection(first: 50, after: $after) {
    edges { cursor node { userId gamertag } }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}
```

- Pass the previous page's `pageInfo.endCursor` as `after` to get the next page; stop when
  `pageInfo.hasNextPage` is false.
- Cursors are **opaque** — do not parse or construct them.
- `totalCount` is present when the source computes it (null otherwise; rely on
  `hasNextPage`).

Connections exist for the largest collections — Management API: `usersConnection`,
`appsConnection`, `myCheckoutsConnection`, `checkoutsConnection`, `paymentEventsConnection`,
`walletTransactionsConnection`, `appUserAccessConnection`; Game API:
`voxelUpdateHistoryConnection`, `actorsConnection`, `gameModelEventsConnection`. More are
added over time; the SDL is authoritative.

## Legacy: offset/limit (deprecated args)

The original offset queries remain for back-compat; their `limit`/`offset`/`skip` args are
marked `@deprecated` in the SDL pointing to the connection. New integrations should use the
connections above.

## Page-wrapper shape (preferred, has a total)

List queries that can be large return a `*Page` object with an `items` array and a
`pageInfo`:

```graphql
query Users {
  usersPaginated(query: "ada", limit: 50, offset: 0) {
    items { userId gamertag }
    pageInfo { totalCount limit offset }
  }
}
```

- `limit` — max rows to return. Defaults and caps are stated per field in the SDL
  (commonly **default 50, max 200**). Values above the cap are clamped, not rejected.
- `offset` — rows to skip (0-based). Page `n` (0-based) is `offset = n * limit`.
- `pageInfo.totalCount` — total matching rows, so you can compute the number of pages.

Examples in this shape include the Management API `usersPaginated`, `apps`, `myCheckouts`,
`checkouts`, and `paymentEvents`.

## Raw `limit`/`offset` arrays

Some list fields return a plain array and take `limit`/`offset` without a `totalCount`
(page until you receive fewer than `limit` rows):

```graphql
query Txns { walletTransactions(orgId: "10", limit: 50, offset: 0) { transactionId amountCents } }
```

## Game API `limit`/`skip`

Some Game API world queries use `skip` instead of `offset` and echo the window back in the
response (e.g. `getChunksByDistance`, `listVoxelUpdatesByDistance`). `voxelUpdateHistory`
takes `limit`/`offset` with a per-field default and maximum documented in the SDL.

## Unbounded lists

A few small, naturally-bounded collections (e.g. an org's roles or members) return a
plain array with no pagination arguments. Treat them as complete result sets.

## Notes for clients

- Always read the **field's SDL** for its exact arguments, default, and cap — they vary.
- Prefer the `*Connection` queries; the offset queries' paging args are deprecated (still
  functional during the transition window — see the [changelog](/releases/intro)).
