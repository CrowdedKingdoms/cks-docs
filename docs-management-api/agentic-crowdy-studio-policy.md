---
sidebar_position: 33
title: Agentic Crowdy Studio policy
---

# Agentic Crowdy Studio app policy

The Management API owns Agentic Crowdy Studio enablement, model/tool/mode/risk
allowlists, hard budget ceilings, privacy and retention policy, app/operator
kills, and sanitized provider usage. The Game API owns execution and must
enforce only a fresh Management policy replica.

:::warning Finalized development rollout
The allowlisted development rollout is deployed in environment release
`v0.1.94` with Management API `v0.1.193-dev`, Game API `v0.19.16`,
CrowdyJS `12.0.0`, and the BWF host. Apps/users outside the explicit rollout
remain fail-closed. This is not production or general availability and does not
authorize unattended real-money actions.
:::

## Policy layers

There are three read models:

| Kind | Owner | Meaning |
|---|---|---|
| `PLATFORM` | platform operator | Global enable/kill, exact model/tool/mode/risk allowlists, and maximum budgets/retention. |
| `APP` | app manager | A narrower app policy. A missing row is disabled, killed, and deny-all. |
| `EFFECTIVE` | derived | Fail-closed platform/app intersection with global and per-app operator kill precedence. |

An app can remove authority or lower limits; it cannot add a platform-disallowed
model/tool/mode/risk, raise a ceiling, lengthen retention, weaken required
approvals, disable ZDR/collection denial, persist provider bodies, or enable
player-wallet debit.

Effective disable/kill precedence is:

1. platform global kill;
2. operator per-app kill;
3. app kill;
4. platform/app enablement; and
5. non-empty platform/app model and mode intersections.

## GraphQL and permissions

| Operation | Permission | Purpose |
|---|---|---|
| `crowdyStudioAgentPolicy(appId)` | app `view_compute_diagnostics` | Stored app row or deny-all projection. |
| `crowdyStudioAgentEffectivePolicy(appId)` | app `view_compute_diagnostics` | Effective clamp and kill state. This does not attest Game API freshness. |
| `crowdyStudioAgentUsage(appId, since, until, limit)` | app `view_compute_diagnostics` | Sanitized exact records plus a full-window aggregate. |
| `setCrowdyStudioAgentPolicy(input)` | app `manage_compute` | Create/patch the app layer and publish a replica notification. |
| `cpCrowdyStudioAgentPlatformPolicy` | operator | Read the platform layer. |
| `cpSetCrowdyStudioAgentPlatformPolicy(input)` | operator | Patch platform policy/global kill. |
| `cpSetCrowdyStudioAgentAppKill(input)` | operator | Publish or release the separate operator kill for one app. |

Every mutation requires `input.idempotencyKey`. Byte-equivalent retries replay
the first result; changed arguments under the same key fail
`IDEMPOTENCY_CONFLICT`. Use `expectedRevision` for optimistic concurrency;
stale writes fail `AGENT_POLICY_REVISION_CONFLICT`.

See the [Management GraphQL reference](reference/graphql-overview) for exact
input fields and the
[downloadable SDL](pathname:///schema/management-api.graphql) for
machine-readable `@requiresPermission` metadata.

## Runtime permission: `use_studio_agent`

Policy enablement is not player permission. The app must separately grant the
runtime key **`use_studio_agent`** through an access tier. It is app-only:
`appliesToApp=true`, `appliesToGrid=false`. The current replica catalog assigns
it bit index **8**; integrations should use the stable key rather than hard-code
the bit.

The key permits entering the agent protocol only. Build still requires the
appropriate `write_server_code`, `write_client_code`, `run_server_code`, and
`run_client_code` permissions plus ownership/admission/quota checks. Play still
requires a human-granted scope lease and ordinary game authorization.

New apps do not receive `use_studio_agent` in their default tier.

## Configure an app safely

1. Confirm that operators have configured finite platform ceilings and exact
   model/tool/mode/risk allowlists.
2. Confirm the target development Game API supports
   `crowdy.studio-agent-policy/1` and fails closed on stale data.
3. Read `crowdyStudioAgentEffectivePolicy`; do not infer effective state from
   the app row alone.
4. Create a narrower app policy. Begin with Ask/read-only tools, one allowlisted
   model, finite turn/session/player-day caps, and private source disabled.
5. Clear the app kill only after reviewing the returned clamped policy.
6. Grant `use_studio_agent` only to a dedicated pilot tier/user set.
7. Verify the Game API has pulled the new platform/app revisions before testing.
8. Expand to Build or Play only after their project/host security gates pass.

Releasing an operator kill does not clear the app kill, enable either layer,
grant `use_studio_agent`, or resume a prior run.

## Model and tool allowlists

Model IDs and `crowdy.agent-tools/1` logical tool names are exact,
case-sensitive replacement lists. Empty means deny all. A selected model must
support the complete requested tool and structured-output parameter set; there
is no fallback to a provider/model that cannot honor the privacy parameters.

The finalized development allowlist uses `openai/gpt-oss-120b` because its
OpenRouter tool endpoint supports the required Zero Data Retention policy.
Model choice and request/token/cost caps remain the strict platform/app
intersection and are platform-funded.

App policy should list only implemented tools needed by the pilot. Game API
intersects policy again with the current mode and host capabilities, so a
policy entry does not promise that a descriptor will be advertised.

Risk classes are:

`READ_ONLY`, `ROUTINE_WRITE`, `WORLD_CONTROL`, `DESTRUCTIVE`,
`TRUST_CONSENT`, `ECONOMIC`, and `IRREVERSIBLE`.

Allowing a high-risk class does not remove its exact human-approval requirement.

## Budgets and funding

Policy has hard limits at three scopes:

- **turn:** provider requests, input/output/reasoning/total tokens, reserved
  provider cost in micro-USD, tool calls/rounds, compiles, wall time, and
  provider-request concurrency;
- **session:** cumulative request/token/cost/tool/compile limits and serialized
  run concurrency; and
- **player UTC day/app:** cumulative player limits plus concurrent sessions and
  app-wide concurrent runs.

The effective value is the minimum of platform and app policy, with ordinary
compile/runtime/API quotas still applied separately. Game API reserves the
worst-case provider cost before contact and reconciles terminal usage. If
terminal provider accounting is unavailable, the reservation remains consumed.

The development pilot always reports `PLATFORM_FUNDED`, payer `PLATFORM`,
`rateCardId: null`, and `walletDebitEnabled: false`. It never debits a player
wallet. These fields are a future billing seam, not permission to charge.

## Privacy and retention

OpenRouter is the development provider gateway. Game API uses its stable
streaming `/api/v1/chat/completions` endpoint, not the Responses beta, and may
route a request to the selected allowlisted model provider. Policy locks:

- Zero Data Retention required;
- provider data collection denied;
- `require_parameters` enabled;
- plugins and unsafe fallback disabled;
- provider request/response bodies not persisted; and
- first-use disclosure/consent required before selected private source is sent.

Parallel/multi-tool provider rounds do not widen policy: Game API rejects or
serializes them locally and validates every tool name/input/output against the
pinned descriptor.

App policy can disable private-source sharing but cannot bypass disclosure. No
provider key, token, header, prompt, source body, private reasoning, credential,
payment data, or payer reference is returned by policy/usage GraphQL.

Hard pilot retention maxima are:

| Data | Maximum |
|---|---|
| Provider HTTP bodies/headers, private reasoning, individual token deltas | Never persisted |
| Coalesced assistant chunks | 24 hours |
| Detailed game observations/browser tool-result bodies | 24 hours |
| Final messages, redacted events, and private checkpoints after close | 30 days |
| Provider generation/token/cost and lease/approval/kill metadata | 90 days |

An app may shorten these values. Extending them requires a new reviewed
contract; a policy patch cannot do it.

## Replica freshness

Policy writes, audit events, and Game API wakeups share the Management
transaction. Notifications are at-least-once and carry revisions; the Game API
pull is authoritative and idempotent.

The `crowdy.studio-agent-policy/1` publication includes `generatedAt`,
`staleAfterSeconds`, platform/app/effective revisions, and the complete nested
effective policy. The pilot stale boundary is 60 seconds. Missing, malformed,
killed, disabled, revision-regressed, or expired policy must disable the agent,
preempt active work, and revoke leases/approvals. A Management effective-policy
query alone is not proof that a Game API replica is fresh.

## Usage visibility

`crowdyStudioAgentUsage` returns newest sanitized records and an aggregate over
the requested bounded window. Dimensions include request count,
prompt/completion/reasoning/cache and provider-native token counts, tool
calls/rounds, draft compiles, wall time, reserved micro-USD, exact decimal-USD
provider/upstream cost, resolved model/provider generation ID when available,
privacy enforcement flags, and pinned policy revisions.

Usage does not include prompts, source, tool bodies, headers, keys, private
reasoning, wallet data, or payment instruments. `RESERVATION_CONSUMED` means
terminal provider accounting was unavailable; it is not a zero-cost result.

For platform activation, kills, secret injection, incident handling, and purge
procedures, see the
[operator runbook](/operators/agentic-crowdy-studio).
