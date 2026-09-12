---
sidebar_position: 21
title: Agentic Crowdy Studio
---

# Agentic Crowdy Studio: the in-browser agent pane

CrowdyJS **16** docks an AI agent beside the [Crowdy Studio](player-client-mods)
editor. The agent is the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
running **entirely in the player's browser**: the stock harness web UI in a
same-origin iframe, its plugin tree in a Web Worker, and a filesystem whose
files are the open Studio project (the bound GitHub repository when the
project has one). It reaches a model through the Game API's
[metered model endpoint](/game-api/agentic-crowdy-studio) with the player's
own app token, so usage is priced per request at the app's rate card and
billed to the player's wallet by default (or the app's org wallet when its
billing admin chose that).

The human remains the authority. The model edits files and runs draft tests
through the page; a live deploy waits for the player to confirm in the pane;
the model has no shell, no network of its own, and only observes the game.

:::warning[Allowlisted, fail-closed]
The pane appears only when the app's Management policy enables the agent and
the player holds `use_studio_agent`. Model usage is metered; the pane shows
today's spend against the policy ceiling and who pays.
:::

:::info[CrowdyJS 15 and earlier]
The Ask / Build / Play dock, `client.crowdyStudioAgent`, the `agent` mount
option, `PlayerControlGate`, `AgentControlBanner` and the lease manager were
removed in 16.0.0 together with the server orchestrator they drove. See the
[migration notes](https://github.com/CrowdedKingdoms/CrowdyJS/blob/dev/MIGRATION.md).
:::

## What the agent can do

| Tool | What happens | Where |
|---|---|---|
| `read_file`, `write_file`, `edit_file`, `read_image`, search | On the project mount `/dsh/workspace/{server,client}`; writes commit to GitHub when bound and mirror to Studio, otherwise save through Studio | Worker |
| `draft_test` | Compiles and runs the exact saved revision as a draft; returns diagnostics, the build log and a screenshot after the client module loads | Page, via the Studio controller |
| `deploy_live` | Asks the player on the page (**Deploy live** / **Not now**); only an approval runs the deploy | Page |
| `screenshot` | Captures the game canvas the host provides, downscaled and PNG-encoded, into `captures/` | Page |
| `game_observe` | The host's `PlayerHostAdapterV1.observe()`; observation only, there is no command dispatch | Page |
| `runtime_status`, `client_logs`, `project_list/open/create` | Read-only Studio state, or a project switch the page performs | Page |

Everything the model asks for runs on the page with the player's browser
authority, through the same controller methods the human buttons use.

## Player workflow

1. Open Crowdy Studio on the project and grid you intend to use; the Agent
   pane docks beside the editor.
2. The first time, read the provider-data notice (your project source, your
   messages and any screenshots you share go to a model provider through
   Crowded Kingdoms under zero-data-retention routing) and click **I
   understand, start the agent**. This records `crowdyStudioSetProviderConsent`
   for the app.
3. Talk to the agent in the harness UI. Use **Screenshot** in the pane header
   to share what you see; click **Fix with AI** on any compiler diagnostic in
   the Problems panel to queue it as a prompt.
4. The agent edits files and runs `draft_test`; the editor reloads changed
   files as they land.
5. When the agent asks to deploy live, the pane shows **Deploy live** /
   **Not now**. Nothing ships until you click the first; the prompt declines
   itself after a minute.
6. The spend line reads `Today: $x of $y · n requests · paid by your wallet`
   (or `the app's wallet`). **Add funds** links to Studio's wallet.

## SDK quickstart

```ts
import { createCrowdyStudioEmbed } from '@crowdedkingdoms/crowdyjs/crowdy-studio';

const studio = createCrowdyStudioEmbed({
  client: game,                               // CrowdyClient (crowdyStudio, crowdyStudioGitHub, playerWallet)
  appId,
  dsh: {
    graphql: game.graphql,
    webBase: `${import.meta.env.BASE_URL}dsh/`, // where dist/dsh-web is served
    graphqlUrl: game.graphqlEndpoint,
    apiOrigin: new URL(game.graphqlEndpoint).origin,
    getToken: () => game.getToken(),
    persistScope: `${appId}/${playerId}`,     // per player: OPFS session restore key
    studioOrigin: 'https://studio.crowdedkingdoms.com',
  },
});

// Per open: what the model may see.
studio.toggle({
  gridId,
  targetPermissions,
  playerHost,                                 // PlayerHostAdapterV1 (observe only) -> game_observe
  dshHost: {
    captureFrame: () => renderer.domElement,  // screenshot tool + auto-capture after draft tests
    describeView: () => hud.summary(),
    clientLogs: () => modLogs.tail(200),
  },
});
```

`captureFrame` may return a canvas, `ImageBitmap` or `Blob`. For a WebGL
canvas, either construct the renderer with `preserveDrawingBuffer: true` or
render one frame synchronously before returning it; otherwise the capture is
blank.

### Shipping the harness

The harness is the published **`@crowdedkingdoms/crowdy-dsh`** npm package.
Its `dist/dsh-web/` (web client, worker, packed plugin image, `BUILD.json`,
MIT notices, ~13 MB) must be served from the **game's own origin**, under the
path you pass as `webBase`. The usual arrangement is a devDependency plus a
`prebuild`/`predev` script that copies `dist/dsh-web` into a gitignored
`public/dsh/`:

```json
{
  "devDependencies": { "@crowdedkingdoms/crowdy-dsh": "0.2.0-dev.1" },
  "scripts": { "predev": "node scripts/copy-dsh-web.mjs", "prebuild": "node scripts/copy-dsh-web.mjs" }
}
```

Pin it exactly like the SDK and keep its CrowdyJS major equal to the SDK's;
the harness build refuses to bundle a different major. `BUILD.json` says which
harness tag and CrowdyJS the artifact carries.

### Headers

The host document must allow the iframe (`frame-src 'self'`) and serve the
harness path with `script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:`,
`connect-src 'self' blob:` (plus the API origin), `worker-src 'self' blob:`
and `frame-ancestors 'self'`. The game page's own policy stays strict. One
serving detail: `preview/vfs-image.tar.gz` must reach the browser with **no**
`Content-Encoding` header; the worker inflates it itself.

The iframe is same-origin by design (`BroadcastChannel` and OPFS are
origin-scoped), so its `sandbox="allow-scripts allow-same-origin"` does not
isolate it from the page; the CSP on the harness path is the control. Serving
the harness from its own origin is a tracked follow-up.

## Where the token goes

The harness worker needs the player's app token to call the model endpoint
and the Studio GraphQL as the player. It is sent over the page/worker channel
(`page.hello`, refreshed by `page.token`), held in the worker's memory, and
never written to a seed file, the worker's virtual filesystem or OPFS. The
model has no tool that reads the environment, and the Crowdy filesystem
backend serves only the project mount, so `read_file` cannot reach it either.
Every frame on the channel carries a per-boot nonce; frames without it are
dropped.

## Custom chrome

`@crowdedkingdoms/crowdyjs/crowdy-dsh` exports the pieces: `CrowdyStudioDshPane`
(the default pane), `StudioDshBridge` (the page half of the bridge, with a
`confirmLiveDeploy` hook), `CrowdyStudioDshTransport` (`models`, `consent`,
`setConsent`, `usage`) and the bridge protocol types.
`@crowdedkingdoms/crowdyjs/player-host` keeps `PlayerHostAdapterV1`, its
schemas and the error / preemption vocabulary.

## Budgets, disabled states, errors

Spend is metered per request at the app's rate card against a per-request
ceiling and a player-day budget; the wallet (player or org) must cover each
request's worst-case reservation. When the feature, app, model, permission,
policy replica or provider is unavailable the agent fails closed and the pane
shows the platform error code (`AGENT_DISABLED`, `AGENT_PERMISSION_DENIED`,
`AGENT_SCOPE_DENIED`, `AGENT_MODEL_NOT_ALLOWED`, `AGENT_BUDGET_EXHAUSTED`,
`AGENT_FUNDS_NEEDED`, `AGENT_PROVIDER_UNAVAILABLE`, ...). Manual Crowdy Studio
and human gameplay remain available.

The GraphQL companions are
[`crowdyStudioProviderConsent`](reference/graphql/operations/queries/crowdy-studio-provider-consent.mdx),
[`crowdyStudioSetProviderConsent`](reference/graphql/operations/mutations/crowdy-studio-set-provider-consent.mdx)
and [`crowdyStudioModelUsage`](reference/graphql/operations/queries/crowdy-studio-model-usage.mdx);
the REST endpoint is described with the
[Game API](/game-api/agentic-crowdy-studio).
