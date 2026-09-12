---
sidebar_position: 20
title: Embed Crowdy Studio in your game
---

# Embed Crowdy Studio in your game

CrowdyJS ships the **Crowdy Studio embed kit**: the window chrome that
proved out in Blocks with Friends, packaged as game-agnostic components. A game
no longer hand-rolls a dock, fullscreen fallback, focus trap, context drawer,
or HUD sink around [`mountCrowdyStudio`](player-client-mods#mounting-crowdy-studio) —
it supplies only what is genuinely game-specific:

- **an entry point** — how a player claims/selects an owned grid and opens the
  studio (keybind, HUD button, build menu);
- **input suppression** — pausing gameplay keys while the studio has focus;
- **layout hooks** — reacting to the dock inset so HUDs and the game viewport
  stay clear; and
- (CLIENT-mod games only) the world-read host-call router and player-host
  adapter.

Everything else — panel, splitter, styles, safety chrome, and the glue-worker
packaging — comes from the SDK.

## What the kit provides

From `@crowdedkingdoms/crowdyjs/crowdy-studio`:

- **`createCrowdyStudioEmbed(options)` / `CrowdyStudioEmbed`** — a responsive
  panel that renders a resizable right dock on desktop and a focus-trapped
  fullscreen modal on narrow viewports. It owns Escape/close-key semantics,
  the compact header (title, grid pill, Context drawer, Close), loading and
  retry chrome, and assembles the full `mountCrowdyStudio` call — including
  the in-browser agent pane when the game passes the `dsh` option (CrowdyJS
  16; see [Agentic Crowdy Studio](agentic-crowdy-studio)).
- **`CrowdyStudioEmbedDock`** — the accessible game/studio splitter with
  persisted width (`ck:crowdy-studio:embed:dock-width:v1`), arrow-key/Home/End
  resize, and ARIA value text.
- **`CrowdyStudioTextHud`** — the text-only presentation sink for CLIENT-mod
  `hud_set` payloads plus the drawer HUD preview. Untrusted payloads render as
  text, never HTML.
- **`ensureCrowdyStudioEmbedStyles()`** — injected `ck-crowdy-studio-embed-*`
  styles; games restyle by overriding classes. While docked, the panel sets
  `--ck-game-right-inset` on `document.body` so game HUDs can keep clear of
  the dock.

From `@crowdedkingdoms/crowdyjs/player-host`: `PlayerHostAdapterV1`, the
observation contract the agent's `game_observe` reads. (The `PlayerControlGate`
and `AgentControlBanner` chrome left with the agent orchestrator in 16.0.0; the
in-browser agent only observes and never takes control.)

New package subpath:

- **`@crowdedkingdoms/crowdyjs/player-glue-worker`** — the self-starting,
  tokenless CLIENT-mod glue worker entry. Bundle it as a same-origin module
  worker (for example Vite's `?worker&url`) instead of copying a worker
  wrapper into the game.

:::info[Choosing SERVER-only or SERVER + CLIENT]
CLIENT-target mods run untrusted player code in the visitor's browser. The platform admits
them for any app whose access tier grants `write_client_code` / `run_client_code`; whether
your game offers them is your decision. A SERVER-only embed (below) omits `workerUrl`,
`onHostCall`, `hud` and `playerHost` and forces `CLIENT: { canWrite: false, canRun: false }`,
which hides every client-run affordance. The full SERVER + CLIENT integration — same-origin
glue worker, an allowlisted host-call router, the text HUD, the visitor trust lifecycle, and
the cross-origin-isolation headers it all depends on — is implemented and documented in the
public starter [The Construct](https://github.com/CrowdedKingdoms/the-construct)
(`docs/MODDING.md`), which ships it on by default with a build switch.
:::

## Minimal SERVER-only embed (the reverse-tower-defense pattern)

The smallest complete integration is one module: claim the chunk the player is
standing on, then toggle the embed with SERVER-only permissions. This is the
pattern piloted in reverse-tower-defense ("Tower Assault").

Create the embed once at startup. Only the studio/compute/wallet services are
exposed and there is no `dsh` option, so this game has no agent pane:

```ts
import {
  createCrowdyStudioEmbed,
  type CrowdyStudioEmbedContext,
} from '@crowdedkingdoms/crowdyjs/crowdy-studio';

const embed = createCrowdyStudioEmbed({
  client: {
    get crowdyStudio() { return network.sdk.crowdyStudio; },
    get playerCompute() { return network.sdk.playerCompute; },
    get playerWallet() { return network.sdk.playerWallet; },
  },
  appId: () => network.currentAppId(),
  gameName: 'Tower Assault',
  closeKeyCode: 'KeyL',
  onClosed: () => refreshLauncherButton(),
});
```

Claim the player's current chunk with the platform
[`claimGridChunk` mutation](player-client-mods) (the same game-API surface
Blocks with Friends uses), then open the studio with SERVER-only permissions
derived from the claim's `effectivePermissionKeys`:

```ts
const claimed = await network.sdk.marketplace.claimGridChunk({ appId, chunk });

const context: CrowdyStudioEmbedContext = {
  gridId: String(claimed.gridId),
  grid: { low: claimed.lowChunk, high: claimed.highChunk },
  targetPermissions: {
    SERVER: {
      canWrite: claimed.effectivePermissionKeys.includes('write_server_code'),
      canRun: claimed.effectivePermissionKeys.includes('run_server_code'),
    },
    // D13: never enabled outside BWF, even when the claim grants the keys.
    CLIENT: { canWrite: false, canRun: false },
  },
  permissionsNote:
    'This game runs SERVER mods only; CLIENT mods are disabled while the ' +
    'platform client-mod security gates clear.',
};

embed.toggle(context);
```

That is the whole loop: the panel handles create project → edit (Monaco with
the local Rust language worker) → **Test draft** → **Deploy live** → Runs and
Logs against the ordinary player-compute API. The server-code permission keys
come from the player's app access tier, so the claim result is authoritative —
no game-side permission logic.

### Bundler note (Vite)

The studio's Monaco/language workers are created with
`new Worker(new URL(...), import.meta.url)` inside the SDK. Two Vite settings
keep them working:

```ts
export default defineConfig({
  worker: {
    // The studio language worker code-splits; iife workers cannot.
    format: 'es',
  },
  optimizeDeps: {
    // Pre-bundling would inline the SDK into .vite/deps and break the
    // worker URL resolution in dev. The @codingame pair must also stay
    // un-bundled so the VS Code service overrides register against the
    // same module instance the editor API reads from (a pre-bundled copy
    // fails with "…is not supported. You are using a feature without
    // registering the corresponding service override" and the studio
    // falls back to the basic editor).
    exclude: [
      '@crowdedkingdoms/crowdyjs',
      '@codingame/monaco-vscode-editor-api',
      '@codingame/monaco-vscode-api',
    ],
    include: [
      '@crowdedkingdoms/crowdyjs > vscode-jsonrpc',
      '@crowdedkingdoms/crowdyjs > vscode-languageserver-protocol',
      '@crowdedkingdoms/crowdyjs > vscode-languageserver-types',
    ],
  },
});
```

If the workers still cannot load, the embed degrades to the file-aware
textarea workspace rather than failing; deploys remain authoritative
server-side either way.

## Full-featured embed (the Blocks with Friends reference)

Blocks with Friends consumes the same kit with every optional surface enabled.
The additional wiring, all game-supplied:

```ts
import {
  CrowdyStudioEmbed,
  CrowdyStudioTextHud,
} from '@crowdedkingdoms/crowdyjs/crowdy-studio';
import glueWorkerAssetUrl from '@crowdedkingdoms/crowdyjs/player-glue-worker?worker&url';

const hud = new CrowdyStudioTextHud();

const studio = new CrowdyStudioEmbed({
  client: game, // crowdyStudio, crowdyStudioGitHub, playerWallet
  appId,
  gameName: 'Blocks with Friends',
  dsh: {
    graphql: game.graphql,
    webBase: `${import.meta.env.BASE_URL}dsh/`, // @crowdedkingdoms/crowdy-dsh dist/dsh-web, copied at build
    graphqlUrl: game.graphqlEndpoint,
    apiOrigin: new URL(game.graphqlEndpoint).origin,
    getToken: () => game.getToken(),
    persistScope: `bwf/${appId}/${playerUuid}`,
  },
  suppressGameplayInput: () => lockPlayerInput(),
  onLayoutChange: () => relayoutHud(),
});

studio.open({
  gridId,
  grid,
  targetPermissions, // authoritative effective grid keys, both targets
  workerUrl: glueWorkerAssetUrl, // CLIENT mods: BWF only, per D13
  onHostCall: (call) => routeClientHostCall(call), // owner-lawful world reads
  hud,
  playerHost: bwfPlayerHostAdapter, // observe only -> game_observe
  dshHost: {
    captureFrame: async () => {
      renderer.render(scene, camera); // or preserveDrawingBuffer: true
      return renderer.domElement;
    },
  },
});
```

The two-layer CLIENT sandbox, presentation hooks, and deploy loop are
unchanged from [Crowdy Studio & player client mods](player-client-mods); the
agent pane is described in [Agentic Crowdy Studio](agentic-crowdy-studio). The
kit is chrome — it grants no authority. Deploys, drafts and invokes are
authorized server-side exactly as before, and a live deploy the agent asks for
waits for the player to confirm in the pane.

## GitHub repository card (15.11+)

When the client is a full `CrowdyClient`, the embed passes
`client.crowdyStudioGitHub` to the Studio controller and the settings pane
grows a **GitHub repository** card: Connect, Bind `owner/repo@branch`, Unbind,
Push, Pull, Refresh, and an **Also push autosaves to GitHub** toggle that is
off by default. The card hides itself when the environment has no GitHub App.
Connect and Bind need the modder's identity session (hosted Studio); the
in-game panel can push and pull a repository that is already bound. Nothing
GitHub-related is stored in the browser. See
[Connect your GitHub repo to a Studio project](/game-api/crowdy-studio-github).

## Styling and layout contract

- All kit chrome uses `ck-crowdy-studio-embed-*` classes (the agent pane uses
  `ck-crowdy-studio-dsh-*`); override them in game CSS to restyle.
- While docked, the panel maintains `--ck-game-right-inset` on
  `document.body`. Use `var(--ck-game-right-inset, 0px)` in HUD/viewport
  rules so layouts are correct whether or not the studio is open.
- The dock width persists per browser under
  `ck:crowdy-studio:embed:dock-width:v1`.
- Below the fullscreen breakpoint the panel becomes a focus-trapped modal;
  `suppressGameplayInput` is invoked in both presentations.
