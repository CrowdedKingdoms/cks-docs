---
sidebar_position: 26
title: Agentic Crowdy Studio
---

# Agentic Crowdy Studio game integration

The Game API is the durable orchestrator for Agentic Crowdy Studio. It owns
owner/app-scoped sessions, runs, ordered events, tool calls, approvals, leases,
project checkpoints, provider usage, and budgets. CrowdyJS owns the browser
controller and typed tool gate; a game implements only the
`crowdy.player-host/1` observation and command boundary.

:::warning Finalized development rollout
The tracked development stack is deployed as environment release `v0.1.94`
(Game API `v0.19.16`, Management API `v0.1.193-dev`, CrowdyJS `12.0.0`, and
the BWF host). It remains policy/permission allowlisted and fail-closed. This is
not production or general availability and does not permit autonomous
real-money activity.
:::

## Authority boundary

The model receives bounded context and immutable tool descriptors. It does not
receive an app token, GraphQL client, CrowdyJS client, DOM driver, raw UDP
sender, renderer object, shell, network client, browser storage, or client-mod
host-call bridge.

An accepted effect follows this path:

1. the Game API validates the exact tool/version, arguments, mode, effective
   Management policy, budget, permissions, context, and approval/lease;
2. a server tool calls an owner-scoped domain service, or a browser tool is
   dispatched to the attached CrowdyJS epoch;
3. the browser validates the descriptor, epoch, context, lease, host revision,
   observation freshness, scope, rate, and execute-once `toolCallId`;
4. the game adapter calls the same typed intent service used by human input;
5. the existing Game API, Game Model, compute, grid, admission, and Replication
   API checks remain final authority.

Client checks are defense in depth. A modified game client cannot grant itself
more platform authority.

## Provider transport

The deployed development adapter streams OpenRouter's stable
`/api/v1/chat/completions` protocol. It does not use the Responses beta. The
allowlisted model is `openai/gpt-oss-120b`, whose tool endpoint supports the
required Zero Data Retention policy.

Every provider request enforces `require_parameters`, `zdr`,
`data_collection: "deny"`, no plugins, and no unsafe fallback. Model/cost/token
caps are the platform/app intersection and remain platform-funded. Provider
multi-tool rounds are rejected or serialized by the Game API; no parallel
provider proposal can race an approval or browser dispatch. Every proposed tool
name, input, and output is validated locally against the pinned descriptor
before it can advance the durable run.

The OpenRouter key is encrypted and injected only into the Game API process. It
is absent from GraphQL, CrowdyJS, BWF, prompts, events, logs, evidence, and
provider bodies retained by the platform.

## Prerequisites

Before exposing the agent in a game:

- use an unexpired app-scoped token for the target app;
- grant the player `use_studio_agent` through an app tier;
- enable a non-killed Management platform/app policy with a non-empty model and
  mode intersection;
- keep the Game API's policy replica fresh;
- require the ordinary selected-project ownership plus `write_server_code`,
  `write_client_code`, `run_server_code`, or `run_client_code` permissions for
  the requested target;
- preserve compile/runtime quotas and code admission;
- implement a host adapter before enabling Play; and
- keep a human-visible Pause/Stop and lease indicator outside model-controlled
  content.

`use_studio_agent` is app-scoped and separately grantable. It never implies
source read/write, runtime, grid, trust, commerce, or game-control authority.
See [Permissions overview](permissions).

## Use the SDK transport

For a browser game, use `game.crowdyStudioAgent` and
`mountCrowdyStudio(..., {agent: ...})`. The SDK performs durable replay,
contiguous acknowledgements, epoch fencing, heartbeat, browser result
continuation, and reconnect. Do not reconstruct that protocol with ad hoc raw
GraphQL.

```ts
import {mountCrowdyStudio} from '@crowdedkingdoms/crowdyjs/crowdy-studio';

const studio = await mountCrowdyStudio(host, {
  projectProvider: game.crowdyStudio,
  playerCompute: game.playerCompute,
  playerWallet: identity.playerWallet,
  appId,
  gridId,
  grid,
  workerUrl,
  onHostCall,
  agent: {
    transport: game.crowdyStudioAgent,
    createSession: {
      appId,
      gridId,
      mode: 'ASK',
      providerDataConsent: playerAcceptedProviderDisclosure,
      idempotencyKey: crypto.randomUUID(),
    },
    playerHost,
    onLocalPreempt: clearVisibleAgentControl,
  },
});
```

Omit `agent` to retain the manual Crowdy Studio experience. Omit `playerHost`
only when Play must remain unavailable.

## Implement `PlayerHostAdapterV1`

Import the public host types from
`@crowdedkingdoms/crowdyjs/player-host`:

```ts
import type {
  CrowdyAgentPreemptionReason,
} from '@crowdedkingdoms/crowdyjs/agent';
import type {
  GameCommandResultV1,
  GameCommandV1,
  GameObservationV1,
  ObserveRequestV1,
  PlayerHostAdapterV1,
  PlayerHostCapabilitiesV1,
  ValidatedGateV1,
} from '@crowdedkingdoms/crowdyjs/player-host';

class MyPlayerHost implements PlayerHostAdapterV1 {
  readonly contractVersion = 'crowdy.player-host/1' as const;

  capabilities(): Promise<PlayerHostCapabilitiesV1> {
    return currentBoundedCapabilities();
  }

  observe(request: ObserveRequestV1): Promise<GameObservationV1> {
    return buildBoundedSnapshot(request);
  }

  dispatch(
    command: GameCommandV1,
    gate: ValidatedGateV1,
  ): Promise<GameCommandResultV1> {
    return routeThroughSharedHumanIntentServices(command, gate);
  }

  clearAgentIntent(reason: CrowdyAgentPreemptionReason): void {
    movement.zero();
    look.zero();
    actions.cancelPending(reason);
  }
}
```

The adapter must not add a generic method name/payload escape hatch. Extensions
use reviewed `game.extension.<game>.*` descriptors with the same bounded schema,
risk, approval, scope, and idempotency rules, and remain disabled until app
policy explicitly allows them.

## Bounded observations

`capabilities()` advertises an opaque revision, current controlled entity,
supported exact command kinds, per-command scope/risk/approval/rate, and
observation bounds.

`observe()` returns a snapshot with:

- `observationId`, capability revision, controlled entity, `observedAt`, and
  `expiresAt`;
- bounded player/entity pose, velocity, look, vitals, and death state;
- optional bounded target, inventory/craftability, grid, nearby actor, and voxel
  summaries; and
- modal, text-focus, and human-input state.

An observation is evidence, not authority. Before dispatch, re-read the current
entity, target, item/container, recipe, grid/permissions, modal/death state, and
host revision. Reject stale evidence with `AGENT_OBSERVATION_STALE` and changed
targets with `AGENT_CONTROL_TARGET_CHANGED`.

Do not send continuous pose streams, full chunk dumps, unbounded logs, hidden
inventories, renderer internals, credentials, or unrelated player data.

## Generic command surface

The v1 minimum is exact and closed:

| Tool | Command | Routine Play scope |
|---|---|---|
| `game.control.move`, `game.control.look` | `MOVE`, `LOOK` | `locomotion` |
| `game.control.stop` | `STOP` | none; always safety-allowed |
| `game.inventory.select`, `.consume`, `.transfer` | inventory commands | `interact` |
| `game.interact` | `MINE`, `PLACE`, `USE`, `FISH`, `NPC_TALK` | `interact` |
| `game.craft` | bounded recipe/quantity | `craft` |
| `game.mount` | mount/dismount | `locomotion` |
| `game.combat.attack` | primary/secondary attack | `combat` |
| `game.chat.send` | bounded local/group text | `communicate` |
| `game.travel.teleport` | an advertised destination reference | `travel` |

`game.capabilities.get` and `game.observe` complete the 14-tool generic host
surface. The effective Game API registry also includes supported
Studio/project/diagnostic/runtime tools. A name can appear only when the Game
API implementation, current mode, model/tool/risk policy, host capabilities,
and permissions all allow it.

Return `SUCCEEDED`, `FAILED`, `DENIED`, or `OUTCOME_UNKNOWN`. If an effect may
have happened but its result cannot be recovered, return `OUTCOME_UNKNOWN`;
neither CrowdyJS nor the Game API will repeat it.

## Draft/live project boundary

Build project writes use a 30-second workspace lease, expected project revision,
bounded atomic file changes, and a private pre-image checkpoint. CrowdyJS
renews the lease every 10 seconds only while the project/epoch/context remains
unchanged and connected. Human editor input revokes it.

`runtime.test_draft` is routine Build work only when all target write/run
permissions and compile quota allow it. It never enables live runtime.
Agent-authored source uses the same platform SDK ABI exports/boilerplate and
the same authoritative compiler as human-authored source; there is no
agent-specific compile path or bypass.
`runtime.deploy_live` and a LIVE `runtime.invoke` always require a single-use
approval bound to the saved revision, complete project content/module hash,
exact target plan, pairing, grid, and live flag. `runtime.stop` is an
idempotent all-project safety action.

## Immediate human takeover

Install capture-phase keyboard, mouse, pointer, touch, pagehide/offline, and
visibility handling around the game input layer. On human input:

1. synchronously clear movement, look, and pending action intent;
2. revoke the local lease gate before allowing normal human handling;
3. notify the durable controller best-effort; and
4. never cancel or synthesize the human event.

Also preempt on Escape, Stop, death, permission/grid/project/context changes,
controlled-entity changes, disconnect, stale heartbeat, quota/budget failure,
or operator kill. Local Stop must work when the Game API or provider is down.

## Disabled and unavailable behavior

Fail closed and keep human controls/manual Studio usable:

- global/app/operator kill, disabled policy, missing or stale policy replica:
  `AGENT_DISABLED` or `AGENT_OPERATOR_KILLED`;
- missing `use_studio_agent` or ordinary target authority:
  `AGENT_PERMISSION_DENIED` / `AGENT_SCOPE_DENIED`;
- disallowed model/mode/tool/risk: the session or descriptor request is denied;
- no compatible host: Ask/Build may remain available, but Play tools are
  omitted and `AGENT_HOST_UNAVAILABLE` is safe to show;
- provider or budget failure: stop the run and preserve project/game state; and
- ambiguous browser effect: show `AGENT_TOOL_OUTCOME_UNKNOWN` and require
  inspection rather than retry.

Do not hide an active lease merely because the dock failed. Keep the external
control banner and offline Stop available until local authority is cleared.

## Reconnect and event handling

The event subscription is ordered and at-least-once. Apply only the next
contiguous decimal-string sequence, deduplicate sequence/event IDs, fill gaps
with history, and acknowledge only the highest contiguous sequence.

A fresh attach allocates a newer `clientEpoch`, fences the old browser, revokes
its Play/workspace leases, and marks pending browser calls stale. Reconnect may
replay facts, never effects. Require explicit resume after context validation;
Play always requires a newly granted lease.

All mutations require idempotency keys. Server writes deduplicate by key and
arguments; browser dispatch deduplicates by `toolCallId`. Provider retries do
not imply tool retries.

## Underlying GraphQL contract

CrowdyJS wraps these Game API roots:

- queries: `crowdyStudioAgentSession`, `crowdyStudioAgentSessions`,
  `crowdyStudioAgentHistory`, `crowdyStudioAgentToolDescriptors`, and
  `crowdyStudioAgentBudget`;
- mutations: `crowdyStudioAgentCreateSession`, `AttachClient`, `SetMode`,
  `AcknowledgeEvents`, `Heartbeat`, `SendMessage`, `ApproveTool`, `RejectTool`,
  `ToolResult`, `GrantLease`, `RevokeLease`, `Pause`, `Resume`, `CancelRun`,
  and `CloseSession`, all with the `crowdyStudioAgent` prefix; and
- subscription: `crowdyStudioAgentEvents`.

Use the [generated GraphQL reference](reference/graphql-overview) for exact
inputs, outputs, descriptions, permission metadata, and stable errors. The
downloadable [Game API SDL](pathname:///schema/game-api.graphql) is generated
from the same exact schema.

## Blocks with Friends reference host

The BWF adapter is deployed in development release `v0.1.94`. It provides the
bounded observation builder, exact command router, synchronous player-control
gate, and accessible game-canvas lease banner. Its snapshots expire after 1.5
seconds and cap nearby actors at 64 and voxels at 128. Commands route through
shared human intent services; routine server-refereed mob combat is supported,
while PvP and high-risk grid/trust/commerce actions remain unadvertised.

Sanitized live evidence exercised `game.observe`, `game.control.move`, and
human-input takeover. Human input revoked the lease and preempted the run; a
late browser success from the old context was rejected with
`AGENT_CONTEXT_STALE`. The deployed bundle plus visible and offline/local Stop
browser gates passed. Evidence contains no account/session identifiers,
credentials, hashes, or provider bodies.
