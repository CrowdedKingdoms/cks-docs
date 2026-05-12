# cks-docs

Shared documentation that spans multiple CKS repositories may land here.

For the **monorepo layout** (management API + control plane runner, game API,
management UI, SDK, sample game, release manifests), start at the repository
root:

- [`README.md`](../README.md) — repository list and an **Agent / contributor map**
  for customer environments, catalog pricing, and the genesis migration.
- [`ARCHITECTURE.md`](../ARCHITECTURE.md) — one-page system overview.
- [`LEARNINGS.md`](../LEARNINGS.md) — durable engineering notes (permissions,
  migrations, Apollo cache, GraphQL pitfalls).

Project-specific details belong in each package's own `README.md`:

- `cks-management-api/README.md` — control-plane runner + management surface.
- `cks-game-api/README.md` — runtime / world / replication.
- `cks-management-ui/README.md` — React frontend (incl. `/admin/control-plane/*`).
- `CrowdyJS/README.md` — typed SDK that targets both APIs.
- `cks-control-plane/README.md` — archived; kept for git history only.
