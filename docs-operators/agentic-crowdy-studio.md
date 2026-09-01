---
sidebar_position: 9
title: Agentic Crowdy Studio operations
---

# Agentic Crowdy Studio operations

This runbook covers the finalized Agentic Crowdy Studio development rollout.
Management owns platform/app policy, allowlists, caps, usage, and kills; Game
API owns durable runs and enforcement; CrowdyJS/game hosts own immediate local
takeover.

:::danger No production or real-money autonomy
Do not enable this pilot in production. Do not use it for unattended purchases,
wallet actions, payouts, ownership transfers, or another real-money effect.
Schema availability and passing development tests are not rollout approval.
:::

## Live stack (discover — do not hardcode)

Agentic Crowdy Studio is **allowlisted development** on the current unified
CK API + CrowdyJS 15.x line. The July 2026 `v0.1.94` / CrowdyJS `12.0.0` train
is **historical** (see [Releases](/releases/intro)); it is not the operator
redeploy target.

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
5. current project/grid/target write/run permission, ownership, admission, and
   quota;
6. current mode and implemented descriptor set; and
7. for Play, the host capabilities and a visible human-granted lease.

Any missing, empty, stale, malformed, killed, or denied layer fails closed.
Approvals never create missing authority.

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

- model IDs known to support the complete tool/structured-output parameters;
- implemented logical tool names (never wildcards or prefixes);
- modes needed by the current rollout stage; and
- risk classes already covered by approval/lease tests.

The deployed allowlist uses `openai/gpt-oss-120b` because its OpenRouter tool
endpoint supports the required ZDR posture. Its model and request/token/cost
caps remain exact, finite, and platform-funded. For a new app or future model,
begin with Ask, `READ_ONLY`, and read tools; add Build/Play only after the
workspace, approval, host, and takeover gates below pass.

Set finite hard limits for:

- per-turn requests, input/output/reasoning/total tokens, provider
  micro-USD reservation, tool calls/rounds, draft compiles, wall time, and
  request concurrency;
- per-session cumulative requests/tokens/cost/tools/compiles and run
  concurrency; and
- per-player UTC-day totals, concurrent sessions, and app-wide concurrent runs.

The development pilot is platform-funded. Funding must remain
`PLATFORM_FUNDED`, payer `PLATFORM`, no rate card, and
`walletDebitEnabled=false`. Existing compile/runtime/rate/usage ceilings remain
additional clamps.

## Permission catalog

`use_studio_agent` is separately grantable through app access tiers. It is
app-only (`appliesToApp=true`, `appliesToGrid=false`) and currently maps to
replica permission bit index **8**. Use the key in GraphQL/configuration; reserve
the numeric bit for the synchronized runtime catalog.

Do not add it to open-by-default tiers. Grant it only to explicit development
pilot users. It does not include `write_*`, `run_*`, grid, trust, commerce, or
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

The Game API also needs an explicit enabled flag, provider selection, exact
model allowlist/default, pinned positive model pricing, and durable worker
configuration. Keep environment allowlists at least as strict as Management
policy. CI uses the deterministic fake provider and must never receive the
development credential.

The deployed provider adapter uses OpenRouter's stable streaming
`/api/v1/chat/completions` endpoint, not the Responses beta. It enforces
`require_parameters`, `zdr`, `data_collection: "deny"`, no plugins, and no
unsafe fallback. Multi-tool provider rounds are rejected or serialized
locally, and all tool names, inputs, and outputs remain locally schema
validated. The encrypted provider key remains server-only.

S2S notify/pull and usage-ingest credentials are separate environment-scoped
service credentials. Apply the same write-only injection and redaction rules.

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
- `AGENT_DISABLED`, `AGENT_CONTEXT_STALE`, and policy-validation errors;
- runs that remain non-terminal after a kill; and
- active leases/approvals surviving a policy revision (they must not).

## Usage and cost monitoring

Game API reserves worst-case turn cost before provider contact and sends
terminal sanitized usage to Management through
`crowdy.studio-agent-usage/1`. Read it with `crowdyStudioAgentUsage`.

Track request count, prompt/completion/reasoning/cache and native token counts,
tool calls/rounds, draft compiles, wall time, reserved micro-USD, exact
provider/upstream decimal USD, resolved model, accounting status, privacy flags,
and pinned policy revisions.

`RESERVATION_CONSUMED` means terminal provider accounting was unavailable and
the reservation remains charged against the platform cap. Do not treat missing
provider cost as zero. Compare usage to turn/session/player-day caps and app
concurrency; no app or player may consume another player's isolated budget.

Usage must never contain prompts, source, private reasoning, headers, request
or response bodies, credentials, payment data, payer references, or wallet
debits.

## Kill precedence

Kills are policy, not UI state:

1. **Human local Stop/Escape/input** clears browser intent immediately, even
   when GraphQL is unavailable.
2. **Operator per-app kill** isolates one app and takes precedence over its
   policy.
3. **Platform global kill** stops the pilot across every app.
4. **App kill/disable** lets an app manager keep their app closed but cannot
   override an operator or global kill.

A kill must preempt active runs, cancel provider streaming, revoke workspace
and Play leases, revoke unconsumed approvals, fence pending browser dispatches,
and append durable safe reason events. It must not silently resume after the
kill is released.

## Final rollout evidence

Sanitized live evidence for the July 2026 (`v0.1.94`) train passed:

- Ask returned the expected exact response.
- Build executed `workspace.file.read`; a checkpointed
  `workspace.file.patch` advanced the source revision.
- The agent-edited source compiled as a draft after the ordinary platform ABI
  boilerplate was added.
- Play completed a bounded `game.observe` dispatch/result and dispatched
  `game.control.move`.
- Human input revoked the lease and preempted the run. A late success was
  rejected with `AGENT_CONTEXT_STALE`.
- The deployed BWF bundle, visible takeover UI, and offline/local Stop browser
  gates passed.

Evidence and public incident notes must omit account identifiers, run/session/
tool IDs, tokens, content hashes, secret values, and provider request/response
bodies.

## Incident / kill procedure

For an app-scoped incident:

1. Tell affected users to press Stop; local control clears before the network
   round trip.
2. Publish `cpSetCrowdyStudioAgentAppKill(killed: true)` with a stable safe
   reason code, idempotency key, and current expected app-policy revision.
3. If scope is uncertain, publish the platform global kill instead. Prefer
   over-stopping to leaving unknown control active.
4. Verify Management effective policy reports killed and a newer revision.
5. Verify every serving Game API has pulled that revision within the freshness
   window and reports no surviving active provider stream, dispatch, lease, or
   unconsumed approval for the scope.
6. Verify BWF/other hosts show human control and their external Stop remains
   enabled. A disconnected host must already have cleared intent locally.
7. Preserve sanitized policy audit, run/event/tool hashes, lease/approval/epoch
   metadata, provider generation/usage dimensions, and relevant canonical
   domain records. Do not copy prompts/source/provider bodies into incident
   notes.
8. If provider credential exposure is suspected, keep the global kill active,
   rotate the provider credential in the approved secret manager, roll the Game
   API tasks, and verify old credentials no longer work without recording either
   value.
9. Fix and test the narrow cause with the fake provider and adversarial
   reconnect/takeover suite.
10. Release the narrowest kill only after policy freshness and preemption
    evidence pass. Releasing a kill does not enable an app or resume a session;
    humans must explicitly resume and grant a new Play lease.

If a browser tool reports `AGENT_TOOL_OUTCOME_UNKNOWN`, inspect authoritative
project/game/domain state before any compensating action. Never retry the
original effect automatically.

## Retention and purge

Hard development-pilot maxima:

| Data | Maximum retention |
|---|---|
| Provider HTTP bodies/headers, private reasoning, individual token deltas | 0; never persisted |
| Coalesced assistant chunks | 24 hours |
| Detailed observations/browser tool-result bodies | 24 hours |
| Final messages, redacted events/tool records, private checkpoints | Session life plus 30 days after close |
| Generation/model/token/cost and approval/lease/epoch/kill metadata | 90 days |

App policy may shorten these periods. Closing a session revokes it immediately
and starts cleanup without deleting canonical project/runtime/commerce records.
Game API retention sweeps continue while agent execution is disabled.

For a valid security hold, export only the necessary sanitized records to the
existing operator audit/hold system with explicit owner and scope. Do not
silently extend agent-table retention or retain provider bodies that were never
permitted to be stored.

## Expansion / redeployment checklist

The July 2026 (`v0.1.94`) development train passed this gate. For a new app,
environment, model, or later manifest, keep the relevant kill enabled until all
are true:

- compatible Management, Game API, CrowdyJS 12, and game-host builds are in the
  selected development environment;
- the nested policy contract and usage ingest pass fixture checks;
- policy pull freshness and kill preemption are observed across replicas;
- no secret reaches browser/build/log/evidence artifacts;
- `use_studio_agent` is limited to explicit pilot tiers;
- finite platform/app caps and exact allowlists are in place;
- Ask/Build draft, checkpoint, conflict, approval, reconnect, and retention
  tests pass;
- Play host bounds, shared intents, stale-target rejection, input/death/offline
  takeover, and offline Stop tests pass; and
- production and real-money autonomous actions remain out of scope.
