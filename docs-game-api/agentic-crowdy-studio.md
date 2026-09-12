---
sidebar_position: 26
title: Agentic Crowdy Studio and the model endpoint
---

# Agentic Crowdy Studio: the in-browser agent and the metered model endpoint

The Studio agent runs **in the player's browser**. CrowdyJS 16 docks the
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) beside the
Crowdy Studio editor: the harness web UI in a same-origin iframe, its plugin
tree in a Web Worker, and a filesystem whose files are the open Studio project
(the bound GitHub repository when the project has one). The agent edits files,
runs draft tests, takes screenshots and observes the game through the page; it
reaches a model through the Game API's **metered model endpoint**, an
OpenAI-compatible REST proxy in front of the platform's provider key.

The Game API's part is therefore small and entirely server-side: policy, the
model allowlist and rate card, the player's provider-data consent, per-request
reservation and settlement, and who pays. The GraphQL orchestrator that used to
own sessions, runs, events, tool calls, approvals and leases is gone; the 21
`crowdyStudioAgent*` root fields it published were removed with it.

:::warning[Allowlisted, fail-closed]
The agent is enabled per platform and per app through Management policy and
requires the separately granted `use_studio_agent` runtime permission. It is
off by default and does not permit autonomous real-money activity.
:::

## Authority boundary

The model never receives the player's app token, a GraphQL client, DOM access,
a shell or a network of its own. Inside the worker the harness holds the token
in memory to call the model endpoint and the Studio GraphQL as the player; the
token arrives over the page/worker channel, is never written to a seed file,
the worker's filesystem or persistent storage, and no tool exposes it. Every
effect the model asks for runs on the page with the player's own authority
through the same Studio controller methods the human buttons use, and a
**live deploy waits for the player to confirm on the page**.

The Game API remains the final authority on everything: project ownership and
`write_*`/`run_*` permissions, compile and runtime quotas, code admission, and
the spend gates below.

## The metered model endpoint

Two REST routes, authenticated exactly like any SDK call. The bearer is an
**app-scoped token**; the app is the token's app.

```
GET  {apiOrigin}/v1/model/models
POST {apiOrigin}/v1/model/chat/completions
Authorization: Bearer <app token>
```

### `GET /v1/model/models`

The models this caller may use in this app: the app's policy allowlist
intersected with models that carry an **ACTIVE rate card**. A model without a
card is not offered, because it could not be billed. The body is OpenAI's list
shape with the rate card attached:

```json
{
  "object": "list",
  "data": [
    {
      "id": "openai/gpt-oss-120b",
      "object": "model",
      "owned_by": "crowded-kingdoms",
      "name": "openai/gpt-oss-120b",
      "context_window": null,
      "input_modalities": ["text"],
      "pricing_microusd_per_million": {
        "input": 195000,
        "output": 780000,
        "reasoning": 780000,
        "cached_input": 97500
      }
    }
  ]
}
```

### `POST /v1/model/chat/completions`

OpenAI chat completions, streaming or not. Forwarded request fields:
`model`, `messages` (roles `system`/`developer`/`user`/`assistant`/`tool`,
text and image parts; `developer` is normalised to `system`), `tools`,
`tool_choice`, `parallel_tool_calls`, `temperature`, `top_p`, `stop`, `seed`,
`response_format`, `frequency_penalty`, `presence_penalty`, `logit_bias`,
`reasoning`, `reasoning_effort`, `stream`, `max_tokens`/`max_completion_tokens`
(capped at the policy's per-turn output ceiling). Provider-routing, identity
and unsupported-modality fields (`provider`, `plugins`, `transforms`, `route`,
`user`, `metadata`, `store`, `stream_options`, `n`, `logprobs`, `modalities`,
`audio`, ...) and anything prefixed `dsh_` or `x_` are dropped silently; any
other unknown field is refused as `AGENT_TOOL_INPUT_INVALID`.

Every request is forwarded with the privacy parameters the platform requires:
`provider.zdr: true`, `data_collection: "deny"`, `allow_fallbacks: false`,
`plugins: []`, and `usage.include: true` so the provider prices the request.
Streams pass through as `text/event-stream`.

### Gates, in order

1. **Policy.** `AgentPolicyService.effective(user, app)` on every request:
   platform and app enabled, no kill switch, and the caller holds
   `use_studio_agent`. Revoking the permission stops the next request even if
   a consent row exists.
2. **Model.** In the allowlist and carrying a rate card; image parts only on
   models the tier marks image-capable.
3. **Consent.** When the app policy requires private-source consent, the
   caller must have recorded `crowdyStudioSetProviderConsent` for this app;
   otherwise `AGENT_SCOPE_DENIED`.
4. **Reservation.** The worst case at the rate card (estimated prompt tokens
   in, the full output cap out) is checked against the per-request ceiling
   and the player-day budget (`AGENT_BUDGET_EXHAUSTED`), then against the
   payer's wallet (`AGENT_FUNDS_NEEDED`, HTTP 402).
5. **Settlement.** When the stream ends the request is charged from the
   provider's usage frame at the rate card and recorded in
   `model_endpoint_usage`. A client that closes its socket does not stop the
   meter: the provider stream is drained to its usage frame for up to 15 s
   with the client gone; if no frame arrives the request is charged from its
   own prompt estimate plus the completion text that did stream, capped at
   the reservation, and the row says `usage_source = ESTIMATED`.

### Who pays

`funding.billingMode` on the platform policy is `PLATFORM_FUNDED` (the pilot
default; nothing is debited) or `METERED`. Under `METERED`, the app policy's
`funding.payerKind` decides:

- **`PLAYER`** (the default): the charge accrues as the `player_model_microusd`
  metric and the hourly player usage billing tick debits the player's wallet.
- **`ORG`**: the app's organization wallet is debited per request, with a
  `wallet_transactions` row of type `agent_usage`. A failed debit is recorded
  on the usage row and retried with exponential backoff up to ten times; an
  exhausted row stays visible with its last error. Only an org **billing
  admin** (`manage_billing`) may switch an app to `ORG`.

### Errors

Errors are OpenAI-style bodies carrying the platform code:

```json
{ "error": { "message": "...", "type": "crowded_kingdoms_error", "code": "AGENT_FUNDS_NEEDED", "retryable": false } }
```

| Code | HTTP | Meaning |
|---|---|---|
| `AGENT_DISABLED`, `AGENT_APP_KILLED`, `AGENT_OPERATOR_KILLED` | 403 | Policy off or killed |
| `AGENT_PERMISSION_DENIED` | 403 | No `use_studio_agent`, or app runtime inactive |
| `AGENT_SCOPE_DENIED` | 403 | Provider-data consent not recorded |
| `AGENT_MODEL_NOT_ALLOWED` | 400 | Model outside the allowlist or without a rate card |
| `AGENT_TOOL_INPUT_INVALID` | 400 | Unsupported field or malformed request |
| `AGENT_BUDGET_EXHAUSTED` | 429 | Per-request ceiling or player-day budget |
| `AGENT_FUNDS_NEEDED` | 402 | Wallet cannot cover the reservation |
| `AGENT_PROVIDER_UNAVAILABLE` | 503 | Provider unreachable, stalled or 5xx (retryable) |
| `AGENT_PROVIDER_POLICY_UNSATISFIED` | 503 | Provider rejected the request or the policy replica is stale |
| `AGENT_PROVIDER_OUTPUT_INVALID` | 502 | Malformed provider body |

## GraphQL companions

Three root fields, all app-token scoped and requiring `use_studio_agent`:

- [`crowdyStudioProviderConsent(appId)`](reference/graphql/operations/queries/crowdy-studio-provider-consent.mdx)
- [`crowdyStudioSetProviderConsent(input)`](reference/graphql/operations/mutations/crowdy-studio-set-provider-consent.mdx)
- [`crowdyStudioModelUsage(appId, limit)`](reference/graphql/operations/queries/crowdy-studio-model-usage.mdx):
  today's request count and charge against the ceiling, the payer, and recent
  requests. Counts and charges only; no prompts or provider bodies exist to
  return.

Policy administration is unchanged:
[`crowdyStudioAgentPolicy`](reference/graphql/operations/queries/crowdy-studio-agent-policy.mdx),
[`setCrowdyStudioAgentPolicy`](reference/graphql/operations/mutations/set-crowdy-studio-agent-policy.mdx)
(now with `funding.payerKind`),
[`crowdyStudioAgentEffectivePolicy`](reference/graphql/operations/queries/crowdy-studio-agent-effective-policy.mdx),
[`crowdyStudioAgentUsage`](reference/graphql/operations/queries/crowdy-studio-agent-usage.mdx),
and the operator roots `cpCrowdyStudioAgentPlatformPolicy`,
`cpSetCrowdyStudioAgentPlatformPolicy`, `cpSetCrowdyStudioAgentAppKill`,
`cpCrowdyStudioAgentCatalog`.

## What a game implements

Nothing server-side. On the page, CrowdyJS's `dsh` mount option and a
`dshHost` with `captureFrame` (a screenshot of the game canvas) and an
observation-only `PlayerHostAdapterV1` for `game_observe`; see
[Crowdy Studio agent in CrowdyJS](/crowdyjs/agentic-crowdy-studio). The
harness artifact is the published `@crowdedkingdoms/crowdy-dsh` npm package,
copied under `/dsh/` of the game origin at build time.

## Data retention

No prompt, tool result, image or provider body is persisted by the platform.
`model_endpoint_usage` keeps counts, the model, the provider generation id and
the charge. `crowdy_agent_sessions`, `crowdy_agent_checkpoints` and
`crowdy_agent_usage` remain for project checkpoints and the Management usage
view and are swept by the agent retention service; the six orchestrator tables
(`runs`, `events`, `tool_calls`, `client_cursors`, `approvals`, `leases`) were
dropped.
