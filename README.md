# cks-docs

Shared documentation that spans multiple CKS repositories may land here.

For the **monorepo layout** (GraphQL API, management UI, control plane, schema,
releases, sample game), start at the repository root:

- [`README.md`](../README.md) — repository list and an **Agent / contributor map**
  for customer environments, catalog pricing, and migrations.
- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — one-page system overview.
- [`LEARNINGS.md`](../LEARNINGS.md) — durable engineering notes (permissions,
  migrations, Apollo cache, GraphQL pitfalls).

Project-specific details belong in each package’s own `README.md` (for example
`cks-control-plane/README.md` for remote SQL and the poll loop).
