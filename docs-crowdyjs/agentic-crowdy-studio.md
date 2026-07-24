---
sidebar_position: 20
title: Agentic Crowdy Studio
---

# Agentic Crowdy Studio

Agentic Crowdy Studio adds a model-assisted **Ask / Build / Play** dock to the
project-first [Crowdy Studio](player-client-mods). The human remains the
authority: the model proposes typed tool calls, while CrowdyJS and the Game API
check the current mode, project, permissions, policy, budget, lease, and any
required approval before an effect can occur.

:::warning Finalized development rollout
Agentic Crowdy Studio is deployed in the tracked development release
`v0.1.94` with CrowdyJS `12.0.0`, Game API `v0.19.16`, Management API
`v0.1.193-dev`, and the Blocks with Friends host. Access remains
policy/permission allowlisted and fail-closed. This is not a production or
general-availability rollout and does not authorize unattended real-money
activity or control outside an explicit Play lease.
:::

## What each mode can do

The player selects the mode. The model cannot change modes, extend a lease, or
approve its own work.

| Mode | Routine model work | Still required |
|---|---|---|
| **Ask** | Read the selected project, diagnostics, runtime history, effective policy, budget, and bounded game observations; explain or propose changes. | App access, `use_studio_agent`, owner-scoped reads, and an enabled effective policy. |
| **Build** | Create or patch bounded project files, autosave, inspect diagnostics, and test the exact saved revision as a **draft**. | Project ownership, target-specific `write_*` permission, `run_*` permission for tests, compile quota, and a short workspace lease. |
| **Play** | Observe and issue supported routine movement, look, inventory, interaction, crafting, mount, combat, chat, or travel commands. | A visible human-granted lease naming the controlled entity, scopes, and expiry; ordinary game authorization still decides every effect. |

Ask is read-only. Build never turns a draft into a live deployment. Play is not
background bot authority: no valid lease means no control.

## Player workflow

1. Open Crowdy Studio on the project and grid you intend to use.
2. Read the first-use provider disclosure. If private source is needed, decide
   whether to share the selected source with OpenRouter and its routed model
   provider.
3. Start in **Ask** and send a bounded request.
4. Review the chat and activity timeline. Tool proposals, approvals, results,
   checkpoints, lease changes, budget changes, and preemption are separate
   durable events—not hidden chat messages.
5. Switch to **Build** for edits. Review the diff and authoritative compiler
   diagnostics, then use **Test draft**.
6. Approve **Deploy live** only after checking the exact project revision,
   target content hashes, module pairing, grid, and `draft=false` summary.
7. Switch to **Play** only when you intend to delegate temporary game control.
   Select the minimum scopes and duration, then keep the lease banner visible.
8. Press **Pause**, **Stop**, or Escape—or simply use normal game input—to take
   control back immediately.

## SDK quickstart

Use the normal CrowdyJS surfaces. `game.crowdyStudioAgent` is the typed,
app-token transport; the controller owns replay, acknowledgements, epochs, and
reconnect. Do not build a raw GraphQL loop or give a model `client.graphql`.

```ts
import {mountCrowdyStudio} from '@crowdedkingdoms/crowdyjs/crowdy-studio';

const studio = await mountCrowdyStudio(studioHost, {
  projectProvider: game.crowdyStudio,
  playerCompute: game.playerCompute,
  playerWallet: identity.playerWallet,
  appId,
  gridId,
  grid,
  workerUrl: playerCodeGlueWorkerUrl,
  onHostCall,
  agent: {
    transport: game.crowdyStudioAgent,
    createSession: {
      appId,
      gridId,
      mode: 'ASK',
      providerDataConsent: userAcceptedProviderDisclosure,
      idempotencyKey: crypto.randomUUID(),
    },
    // Optional for Ask/Build; required before generic Play tools are available.
    playerHost,
  },
});

const unsubscribe = studio.agent?.subscribe((state) => {
  renderConnection(state.connection);
  renderMessages(state.messages, state.streamingText);
  renderToolTimeline(state.tools);
  renderApprovals(state.approvals);
  renderCheckpoints(state.checkpoints);
  renderBudget(state.budget);
});

await studio.agent?.sendMessage('Explain the current compiler diagnostics.');

// On teardown:
unsubscribe?.();
studio.destroy();
```

The integrated dock already provides mode selection, chat, tool activity,
approval cards, checkpoints, budget, Play lease controls, Pause/Resume, and
Stop. Use `CrowdyStudioAgentController` from
`@crowdedkingdoms/crowdyjs/agent` only when building a custom presentation.

## Tool timeline and checkpoints

The event stream is ordered and durable. A tool can move through `PROPOSED`,
`WAITING_FOR_APPROVAL`, `DISPATCHED`, `RUNNING`, and a terminal status such as
`SUCCEEDED`, `FAILED`, `DENIED`, `TIMED_OUT`, `STALE`, or
`OUTCOME_UNKNOWN`. A final assistant message does not erase the tool history.

Every routine agent project write:

1. checks the expected project revision and workspace lease;
2. creates an immutable private pre-image checkpoint;
3. applies the complete bounded file delta atomically;
4. increments the project revision; and
5. resynchronizes the editor.

A conflict applies no partial delta. A restore first checkpoints the current
revision, requires exact human approval, and creates a new revision; it does not
rewrite history. Checkpoint source remains private to the project owner and app.

## Draft, live, and exact approvals

Autosave changes project source only. **Test draft** compiles and runs the saved
revision under the normal write/run, ownership, admission, quota, and sandbox
checks, with draft world effects confined by the player-compute rules.

The following always require a server-issued, short-lived, single-use approval:

- live deploy or live invoke;
- file delete, lossy rename, archive, checkpoint restore, or conflict
  resolution;
- grid ownership changes;
- trust, consent, admission, capability widening, or mod installation;
- commerce, wallet, checkout, refund, payout, or another economic effect; and
- anything the host or app marks irreversible.

An approval card is bound to one tool call and a canonical `sha256:` argument
hash. It expires, is consumed once, and becomes invalid if the arguments,
descriptor, project revision/content, quote, capability set, grid ownership,
epoch, lease, permission, or context changes. Approval cannot supply a missing
permission or scope.

## Play leases and human takeover

Play scopes are separately selectable:

`observe`, `locomotion`, `interact`, `craft`, `combat`, `communicate`, `travel`,
`grid`, `trust_consent`, and `commerce`.

The pilot protocol permits at most 10 minutes; a game may choose a shorter cap.
There is no silent renewal. The banner must show the holder, controlled entity,
scopes, and live expiry, with Pause and Stop always reachable.

Human keyboard, mouse, pointer, touch, or editor input preempts before that
human event continues. Escape, Stop, death, a modal, project/grid/entity or
permission change, disconnect, hidden page, budget/quota failure, and an
operator kill also clear local movement/look/action intent and revoke control.
Local Stop remains effective when GraphQL is unavailable.

## Bounded observations and commands

A game host exposes typed snapshots, not a renderer, DOM, SDK client, raw UDP,
or generic action callback. An observation has a maximum age and bounded actor,
voxel, inventory, target, and grid summaries. Every planned command refers to
the observation ID, host capability revision, and controlled entity. The host
re-reads current state and rejects stale or changed targets before calling the
same intent service used by human input.

The generic v1 host surface contains capability/observation tools plus exact
movement, look, stop, inventory, interaction, craft, mount, combat, chat, and
travel commands. Unsupported or policy-disabled commands are omitted from the
effective descriptor set; they are not accepted as arbitrary names or payloads.
See [Game integration](/game-api/agentic-crowdy-studio) for the host contract.

## Privacy and OpenRouter disclosure

The development rollout sends model requests from the Game API through
OpenRouter's stable streaming **`/api/v1/chat/completions`** endpoint—not the
Responses beta. The allowlisted development model is
`openai/gpt-oss-120b`, selected because its tool endpoint supports Zero Data
Retention. Before private project source can be included, both app policy and
a separate first-use human disclosure/consent decision must allow it.
Declining private source sharing leaves manual Studio and non-source Ask
behavior available where policy permits.

Every request sets `require_parameters`, requires ZDR, sets
`data_collection: "deny"`, disables plugins and unsafe fallback, and uses only
the allowlisted model/caps. Provider multi-tool rounds are rejected or
serialized locally. Proposed tool names, arguments, and returned outputs remain
strictly validated against the pinned local descriptors; provider output never
becomes authority. The provider receives no Crowdy credential, cookie,
authorization header, API key, payment secret, raw browser storage, or
continuous world stream. IDs used for reasoning are replaced with per-run
aliases.

These controls do not mean that selected prompt content stays on the Crowded
Kingdoms server: the disclosed, bounded context is sent to OpenRouter and the
routed model provider for inference. Project source, logs, chat, NPC text, and
tool results are treated as untrusted data and cannot grant authority.

## Validated development evidence

The sanitized `v0.1.94` rollout evidence completed the full path:

- Ask returned its expected exact response.
- Build read a project file with `workspace.file.read`, then
  `workspace.file.patch` created a checkpoint and advanced the source revision.
- The agent-edited source compiled as a draft after adding the ordinary
  platform ABI boilerplate; there is no agent-only compiler bypass.
- Play produced a bounded `game.observe` dispatch/result and dispatched
  `game.control.move`.
- Human input revoked the Play lease and preempted the run. A late success from
  the old context was rejected with `AGENT_CONTEXT_STALE`.
- The deployed BWF bundle, visible takeover banner, and offline/local Stop
  browser gates passed.

Public evidence intentionally omits account identifiers, session/tool IDs,
credentials, content hashes, and provider request/response bodies.

## Budgets, disabled states, and reconnect

The pilot is platform-funded: agent usage never debits the player's wallet.
Hard limits still apply per turn, per session, per player/day, and across app
concurrency for requests, input/output/reasoning tokens, provider cost, tool
rounds, tool calls, wall time, and draft compiles. Existing compile, runtime,
API, and game limits remain independent. A hard cap stops the run.

When the feature, app, model, mode, permission, policy replica, host, or provider
is unavailable, the agent fails closed. Manual Crowdy Studio and human gameplay
remain available. The UI should show the stable error code and safe remediation,
not hide the dock or imply that work is still running.

On disconnect, CrowdyJS clears local control and attaches with a new
`clientEpoch`. It replays durable events, deduplicates by sequence/event ID,
fills gaps from history, and acknowledges only the highest contiguous
sequence. It never replays a browser effect. The human must explicitly resume;
Play always needs a new lease.

Branch on `CrowdyAgentError.code` and `retryable`, not the message. In
particular:

- `AGENT_DISABLED`, `AGENT_PERMISSION_DENIED`, `AGENT_MODEL_NOT_ALLOWED`, and
  `AGENT_OPERATOR_KILLED` need policy or operator action, not automatic retry.
- `AGENT_DISCONNECTED`, `AGENT_PROVIDER_UNAVAILABLE`, and
  `AGENT_RATE_LIMITED` may be retryable, but only after reattach/revalidation.
- `AGENT_CONTEXT_CHANGED`, `AGENT_OBSERVATION_STALE`, and
  `AGENT_CONTROL_TARGET_CHANGED` require a fresh observation or human review.
- `AGENT_TOOL_OUTCOME_UNKNOWN` means an effect may have happened. Inspect
  current project/game state; never blind-retry it.

The complete operation and type shapes are in the
[CrowdyJS GraphQL reference](/crowdyjs/reference/graphql-overview) and
[Game API SDL](pathname:///schema/game-api.graphql).
