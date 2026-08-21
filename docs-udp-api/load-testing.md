---
sidebar_position: 10
title: Load testing
---

# Load testing your game

**[cks-loadtest](https://github.com/CrowdedKingdoms/cks-loadtest)** is an
open-source load tester for games built on the Replication API. It simulates
any number of native game clients that sign in, enter your app, and walk
around the world exchanging actor updates — using exactly the flow documented
in this tab: sign-in, **[mint an app token](/replication-api/authenticate-and-assign)**,
`serverWithLeastClients`, then HMAC-signed `ACTOR_UPDATE_REQUEST_2` traffic
over UDP. Because it drives the same public APIs and wire protocol as your
real clients, its numbers reflect what real players will experience.

It is a lightweight C++ program: a single host drives thousands of simulated
clients. Run it natively on Ubuntu or anywhere Docker runs.

## How it works

```text
Management API           Game API                     UDP
──────────────           ────────                     ─────────────
login / register   ──▶   (per derived account)
mintAppToken       ──▶   app token + gameApiUrl
                         serverWithLeastClients ──▶   session registered
                         ◀── ip4, clientPort
(wait ~1.5 s)
ACTOR_UPDATE_REQUEST_2 ────────────────────────────▶  at LT_UPDATE_HZ
                         ◀── actor notifications, bundles
(tokens auto-refresh before expiresAt; reconnects handled automatically)
```

You supply **one email and password**. The tool derives a deterministic
account per simulated client with plus-addressing — `alice@studio.com`
becomes `alice+lt-0000@studio.com`, `alice+lt-0001@studio.com`, … (pattern
configurable). Accounts are registered on the first run and simply logged in
on later runs, so repeated tests are idempotent. Each simulated client mints
its own app-scoped token, is assigned a server, and sends updates at the
rate you configure while walking a random path near the world origin.

## Set up your game for load testing

The load tester is **tier-agnostic**: it never inspects or manages access
tiers, entitlements, or limits. It mints tokens and sends traffic; making the
simulated accounts *entitled* to your app is the studio's job, the same as
for real players (see
**[Set up a game & entitle players](/management-api/game-setup)**).

1. **Open-by-default apps need no setup.** If your app kept its free default
   tier, every derived account is auto-entitled on its first `mintAppToken`.
2. **Restricted or paid apps must pre-grant access.** `mintAppToken` returns
   `FORBIDDEN` for an unentitled account and the run aborts with the
   account's email. The derived emails are predictable, so grant them ahead
   of time — the repo ships
   [`scripts/grant-access.sh`](https://github.com/CrowdedKingdoms/cks-loadtest/blob/main/scripts/grant-access.sh),
   an owner-side helper that grants every derived account a chosen tier via
   `grantAppAccess` (run the load tester once first so the accounts exist).
3. **The granted tier must carry runtime permissions** — at minimum
   `access`. A permission-less tier mints tokens successfully, but every
   spatial send is rejected with `UNAUTHORIZED` (code 7). See
   **[Operations → Permissions](/replication-api/operations#permissions-always-enforced)**.

:::caution[Load test traffic is real usage]

Simulated clients generate real replication traffic, metered like any other
client traffic. On the **shared environment** this draws down your wallet and
counts toward spend caps — an aggressive test can runtime-deny your own app
(see **[Operations → App suspended or over budget](/replication-api/operations#app-suspended-or-over-budget)**).
Prefer a dev or dedicated environment for sustained load tests, and set spend
caps deliberately before testing on shared infrastructure.

:::

Registration also sends one confirmation email per new account; with the
default plus-addressing pattern they all land in the base inbox on the first
run. Confirmation is not required for the test to run.

## Install and run

Native (Ubuntu 24.04):

```bash
git clone https://github.com/CrowdedKingdoms/cks-loadtest.git && cd cks-loadtest
sudo apt-get install build-essential cmake libcurl4-openssl-dev libssl-dev
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release && cmake --build build -j"$(nproc)"
```

Or with Docker:

```bash
docker build -t cks-loadtest .
```

Configure with CLI flags, `LT_*` environment variables, or a `KEY=VALUE`
file (precedence: CLI > env > file). A minimal run:

```bash
./build/cks-loadtest \
  --email you@studio.com \
  --password 'your-password' \
  --management-api-url https://ck.prod.v7.cks-env.com \
  --app-id 42 \
  --clients 100 --update-hz 10 --duration-sec 300
```

```bash
docker run --rm --env-file loadtest.env cks-loadtest --clients 100
```

Ramp-up, walk speed, replication distance, worker threads, CSV output, and
more are all configurable — see the
[repository README](https://github.com/CrowdedKingdoms/cks-loadtest#key-options)
for the full option table.

## Reading the results

A stats line prints on a fixed interval, and a final summary (latency
histogram, error-code breakdown) prints on exit:

```text
[stats] clients=100/100 tx=1000 pps 192.5 KB/s | rx=7132 dps 7369.9 KB/s notif=37888/s | lat~5.3ms | errs=0 reconnects=0 hmac_fail=0 send_fail=0
```

- **tx** should settle at `clients × update-hz` once the ramp completes. If
  it lags, the load-generating host is saturated — add threads or hosts.
- **notif/s** is the replication fan-out your app produces: with co-located
  clients it grows toward `clients² × update-hz`, bounded by your
  replication `--distance` and decay settings. This is usually the number to
  watch as you scale `--clients`.
- **lat~** is a one-way latency estimate from the server timestamp in each
  notification versus the local clock. It includes clock skew between the
  hosts, so watch its **trend** under load rather than its absolute value.
- **errs** map to the wire protocol's
  **[error codes](/replication-api/operations#common-error-codes)**. A small
  burst of `UNAUTHORIZED` (7) during ramp-up is the permission warm-up
  described in
  **[Operations](/replication-api/operations#permissions-always-enforced)**;
  a persistent stream means an entitlement problem (see setup above).
- **reconnects** count server-initiated moves (`COMMAND_RECONNECT`). The
  tool re-assigns those clients automatically. Rising reconnects with dips
  in `clients` under increasing load is your **capacity signal**: the
  environment is asking clients to spread out. That is the point to note as
  your app's comfortable concurrent-client level for the environment you
  tested.
- **Exit code 3** means traffic was sent but nothing was ever received —
  work through the
  **[troubleshooting checklist](/replication-api/troubleshooting)** (address
  choice, session install, UDP egress).

Add `--csv-out stats.csv` for a machine-readable per-interval log to graph
alongside your own dashboards.
