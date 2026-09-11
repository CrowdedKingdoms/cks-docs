---
sidebar_position: 9
title: Agentic Crowdy Studio operations
---

# Agentic Crowdy Studio operations

This runbook covers Agentic Crowdy Studio as shipped on 2026-09-11: the agent
is the DeepSeek Harness running in the player's browser (CrowdyJS 16), and the
Game API meters its model traffic through `POST /v1/model/chat/completions`.
Management owns platform/app policy, allowlists, caps, who pays, usage and
kills; the Game API enforces them per request and settles the charge; the
player's browser owns the agent itself, and a live deploy waits for the player
to confirm on the page.

:::danger[Metered spend, no real-money autonomy]
Under `billingMode: METERED` every model request debits a wallet: the player's
by default, the app's org wallet when its billing admin elected that. The agent
cannot make purchases, wallet actions, payouts or ownership transfers; it edits
project files and runs draft tests, and only the player can confirm a live
deploy. Schema availability and passing tests are not rollout approval.
:::

## Live stack (discover — do not hardcode)

Agentic Crowdy Studio is **allowlisted** on the current unified CK API +
CrowdyJS 16 line. The server orchestrator (CrowdyJS 12-15, the
`crowdyStudioAgent*` session/run/lease roots) is **historical** (see
[Releases](/releases/intro)); deploying the current ck-api removes it, and a
game still pinned to CrowdyJS 15.x loses its agent dock on that tier until it
re-pins.

Before expanding allowlists or diagnosing drift, derive what is actually
running:

```bash
# ck-api / Buddy / studio / control-plane per tier
infra-control-plane/scripts/ops/deployed-versions.sh

# CrowdyJS npm dist-tags (latest / @dev / @test)
npm view @crowdedkingdoms/crowdyjs dist-tags
```

Do not infer a supported release from an intermediary ingest record or from
version numbers copied out of this page.

## Control hierarchy

Effective authority is the strict intersection of:

1. platform enablement, global kill, exact model/tool/mode/risk allowlists, and
   hard ceilings;
2. the operator per-app kill;
3. app enablement/kill, narrower allowlists, caps, privacy, and retention;
4. player `use_studio_agent`;
5. the player's provider-data consent for the app (when the app policy
   requires it);
6. the per-request reservation against the per-request ceiling, the
   player-day budget and the payer's wallet; and
7. current project/grid/target write/run permission, ownership, admission, and
   quota for anything the agent does through the Studio page.

Any missing, empty, stale, malformed, killed, or denied layer fails closed.
The page-side confirmation of a live deploy never creates missing authority.

## Management policy operations

Operator-only:

- `cpCrowdyStudioAgentPlatformPolicy` — read global policy/kill;
- `cpSetCrowdyStudioAgentPlatformPolicy` — patch platform allowlists, caps,
  privacy/retention clamp, enablement, or global kill; and
- `cpSetCrowdyStudioAgentAppKill` — publish/release an operator kill for one app.

App managers use:

- `crowdyStudioAgentPolicy` and `crowdyStudioAgentEffectivePolicy`;
- `setCrowdyStudioAgentPolicy` (`manage_compute`); and
- `crowdyStudioAgentUsage` (`view_compute_diagnostics`).

Every policy mutation needs an idempotency key and should use
`expectedRevision`. Omitted fields remain unchanged; supplied app values are
clamped to platform values. Read the returned policy instead of assuming the
requested patch was accepted unchanged.

The exact shapes and machine-readable permissions are in the
[Management GraphQL reference](/management-api/reference/graphql-overview).

## Platform allowlists and development caps

Keep platform lists exact and minimal:

- model IDs known to support tool calling and the required ZDR posture at
  the provider, each with an ACTIVE rate card; and
- the `funding` block: `billingMode` (`PLATFORM_FUNDED` or `METERED`) and
  `walletDebitEnabled`.

The tool and mode allowlists and risk classes remain on the policy contract
for the catalog and the Management UI, but the in-browser harness's tools are
fixed by its preset (file read/edit, draft test, screenshot, observe, project
switch, and a live deploy the player confirms); the Game API does not execute
tools any more.

Set finite hard limits for:

- per-request output tokens and provider micro-USD reservation (the
  per-turn `turnLimits`), which bound one `POST /v1/model/chat/completions`;
- per-player-day requests and micro-USD (`playerDayLimits`).

`PLATFORM_FUNDED` (the pilot default) debits nobody and needs no rate card on
the wallet side, though a model still needs one to be offered. `METERED` with
`walletDebitEnabled: true` bills the payer named by each app's
`funding.payerKind` (`PLAYER` by default, `ORG` when the app's billing admin
elected it). Existing compile/runtime/rate/usage ceilings remain additional
clamps.

## Permission catalog

`use_studio_agent` is separately grantable through app access tiers. It is
app-only (`appliesToApp=true`, `appliesToGrid=false`) and currently maps to
replica permission bit index **8**. Use the key in GraphQL/configuration; reserve
the numeric bit for the synchronized runtime catalog.

Do not add it to open-by-default tiers. Grant it only to explicit development
users of apps that enable the agent. It does not include `write_*`, `run_*`, grid, trust, commerce, or
operator permission.

## Secret injection

The provider credential is named `OPENROUTER_API_KEY`. Store its value only in
the approved platform secret manager and inject it into the enabled Game API
process. Never place or copy the value into:

- Management policy rows, GraphQL variables/results, S2S policy payloads, or
  usage records;
- source, `.env` examples, manifests, images, browser bundles, CrowdyJS, BWF,
  workers, screenshots, fixtures, tests, or documentation;
- prompts, tool/event payloads, logs, traces, exception text, or incident chat.

Disabled Game API environments must not require the provider key. The browser
contains no provider client and receives no credential.

The Game API also needs an explicit enabled flag, provider selection, the
exact model allowlist, and an **ACTIVE rate card** for every model offered:
a model without a card is not listed by `GET /v1/model/models` because it
could not be billed. Keep environment allowlists at least as strict as
Management policy. CI never receives the credential.

The model endpoint forwards to OpenRouter's stable streaming
`/api/v1/chat/completions` with `zdr: true`, `data_collection: "deny"`,
`allow_fallbacks: false`, no plugins and `usage.include`. The request is
narrowed to the accepted OpenAI fields; harness-specific `dsh_*`/`x_*` fields
are dropped. The encrypted provider key remains server-only; the browser
holds only the player's app token.

S2S notify/pull credentials are separate environment-scoped service
credentials. Apply the same write-only injection and redaction rules.

## Policy publication and freshness

A policy mutation writes the policy, sanitized audit event, and replica-outbox
wakeup in one Management transaction. Delivery is at-least-once:

1. Management notifies Game API that the
   `crowdy_studio_agent_policy` revision changed.
2. Game API pulls the complete nested
   `crowdy.studio-agent-policy/1` publication.
3. Game API validates app/environment scope, schema, generated time, and
   monotonic platform/app/effective revisions.
4. Game API derives expiry from `generatedAt + staleAfterSeconds`, refreshes
   before expiry, and pins revisions into new/resumed runs.

The development stale boundary is 60 seconds. Missing, malformed, expired, or
revision-regressed policy is equivalent to disabled. A wakeup alone is not
policy, and a Management effective read is not proof of runtime freshness.

Monitor:

- replica-outbox delivery failures/backlog;
- Game API policy pull age and revision against Management;
- `AGENT_DISABLED`, `AGENT_PROVIDER_POLICY_UNSATISFIED` (stale replica) and
  policy-validation errors on `/v1/model/*`; and
- a `payerKind` change reaching the runtime within the 60 s stale boundary
  (the next request after the boundary must settle against the new payer).

## Usage, cost and who pays

The Game API reserves the worst case at the rate card before contacting the
provider and settles when the stream ends, one `model_endpoint_usage` row per
request: payer, status, requested/resolved model, token counts, provider cost,
the rate-carded `charge_microusd`, and `usage_source`:

- `PROVIDER`: priced from the provider's usage frame (normal);
- `ESTIMATED`: the client closed before the frame arrived (or the provider
  sent none), so the row was charged from the request's prompt estimate plus
  the completion text that streamed, capped at the reservation. A rising
  share of `ESTIMATED` rows is a client or provider problem to look at, not
  free tokens;
- `NONE`: the request failed before any charge.

Who is debited follows `funding`: platform `billingMode` (`PLATFORM_FUNDED`
debits nobody; `METERED` debits the payer) and the app's `payerKind`:

- `PLAYER` (default): the charge accrues as `player_model_microusd` and the
  hourly player usage billing tick debits the player's wallet; requests are
  refused with `AGENT_FUNDS_NEEDED` when the balance cannot cover the
  reservation plus unbilled usage.
- `ORG`: the org wallet is debited per request (`wallet_transactions` type
  `agent_usage`). A failed debit is retried by the reconciler every 30 s with
  exponential backoff, ten attempts; a row whose attempts are exhausted keeps
  `last_debit_error` and `billed_cents IS NULL`. **Alert on rows past the
  tenth attempt**; they are owed money the ledger has not recorded. Only
  `manage_billing` may set `ORG`.

Read the player-facing view with `crowdyStudioModelUsage` (today's count and
charge against the ceiling, payer, recent rows) and the Management view with
`crowdyStudioAgentUsage`. Usage never contains prompts, source, provider
bodies, credentials or payment data.

## Kill precedence

Kills are policy, not UI state:

1. **Human local Stop/Escape/input** clears browser intent immediately, even
   when GraphQL is unavailable.
2. **Operator per-app kill** isolates one app and takes precedence over its
   policy.
3. **Platform global kill** stops the pilot across every app.
4. **App kill/disable** lets an app manager keep their app closed but cannot
   override an operator or global kill.

A kill takes effect on the **next** model request (`AGENT_OPERATOR_KILLED` /
`AGENT_APP_KILLED` from `/v1/model/*` once the runtime's policy replica
refreshes, within 60 s). An in-flight provider stream completes and is
settled; nothing else the harness does spends money. The harness keeps running
in the player's browser with no model behind it until the pane is closed; it
does not silently resume model traffic after the kill is released without the
player sending another message.

## Rollout evidence (2026-09-11 local loop)

The in-browser train was proven end to end on a local tier before the PRs
went up: hosted sign-in, the-construct's Studio opens on a claimed chunk, the
agent pane boots from `/dsh/`, a screenshot reaches the harness, a prompt
completes a turn through `POST /v1/model/chat/completions`, the usage row
records `payerKind: PLAYER` and `status: COMPLETED`, the hourly tick debits the
player wallet, and after `setCrowdyStudioAgentPolicy(funding.payerKind: ORG)`
the next turn debits the org wallet. The July 2026 orchestrator evidence is
historical.

Evidence and public incident notes must omit account identifiers, usage ids,
tokens, content hashes, secret values, and provider request/response bodies.

## Incident / kill procedure

For an app-scoped incident:

1. Publish `cpSetCrowdyStudioAgentAppKill(killed: true)` with a stable safe
   reason code, idempotency key, and current expected app-policy revision.
2. If scope is uncertain, publish the platform global kill instead. Prefer
   over-stopping to leaving unknown spend active.
3. Verify Management effective policy reports killed and a newer revision.
4. Verify every serving Game API has pulled that revision within the 60 s
   freshness window: `/v1/model/*` for the scope answers
   `AGENT_APP_KILLED` / `AGENT_OPERATOR_KILLED`, and no new
   `model_endpoint_usage` rows appear for it after the boundary.
5. Preserve sanitized policy audit, usage rows (counts and charges), wallet
   transactions of type `agent_usage`, and relevant canonical domain records.
   Do not copy prompts, source or provider bodies into incident notes (none
   are stored; do not create them).
6. If provider credential exposure is suspected, keep the global kill active,
   rotate the provider credential in the approved secret manager, roll the Game
   API tasks, and verify old credentials no longer work without recording either
   value.
7. If a wallet was charged wrongly, the ledger is the source of truth: reverse
   through the ordinary wallet credit path, and reconcile against
   `model_endpoint_usage.billed_cents` / `wallet_debit_transaction_id`.
8. Release the narrowest kill only after policy freshness evidence passes.
   Releasing a kill does not resume anything: the player's next message is the
   first request that spends.

## Retention and purge

| Data | Maximum retention |
|---|---|
| Provider HTTP bodies/headers, prompts, tool results, screenshots, private reasoning | 0; never persisted by the platform |
| `model_endpoint_usage` (payer, model, token counts, charge, generation id) | 90 days, then the player-billing retention window |
| `model_endpoint_consents` | Kept; revocation sets `revoked_at` |
| Project checkpoints (`crowdy_agent_checkpoints`) | Per app policy; swept by the agent retention service |

The harness's own conversation state lives in the player's browser (OPFS,
scoped per player) and never reaches the platform. App policy may shorten the
platform periods. Retention sweeps continue while the agent is disabled.

For a valid security hold, export only the necessary sanitized records to the
existing operator audit/hold system with explicit owner and scope.

## Expansion / redeployment checklist

For a new app, environment, model, or later release, keep the relevant kill
enabled until all are true:

- the Game API carrying the model endpoint, CrowdyJS 16, the matching
  `@crowdedkingdoms/crowdy-dsh` artifact and the game's pins are deployed
  together on the selected tier, in that order (ck-api first; the six
  orchestrator tables are dropped by a separate `--allow-contract` schema
  order afterwards);
- every offered model has an ACTIVE rate card and the platform `funding`
  is the intended `billingMode`;
- policy pull freshness and kill effect are observed across replicas;
- no secret reaches browser/build/log/evidence artifacts, and the harness
  artifact carries no tier host, builder path or telemetry endpoint
  (`BUILD.json` names its inputs);
- `use_studio_agent` is limited to explicit tiers;
- finite platform/app caps and exact allowlists are in place;
- the local e2e loop (pane boots, screenshot, metered turn, player debit,
  org-pays toggle) passes; and
- production and real-money autonomous actions remain out of scope.
