---
sidebar_position: 6
title: Crowdy Studio in a native game
---

# Crowdy Studio in a native game

A native game can dock [Agentic Crowdy Studio](/application-api/agentic-crowdy-studio) beside its
world: the agent edits the player's Studio project, runs draft tests and deploys mods while the
player plays. CrowdyCPP carries the platform calls such a dock makes, on the game's app-token
client: 0.86.0 the calls below, and 0.87.0 the project's revision on every build, the platform's
CLIENT half starter and Studio's address from the platform. Every asynchronous call delivers its callback from `game.poll()`, so
nothing here blocks the game thread.

```cpp
#include <crowdy/crowdy.hpp>
#include <crowdy/studio/mod_runner.hpp>
#include <crowdy/studio/starter_projects.hpp>
#include <crowdy/studio_origin.hpp>
```

## The live-modding check

An app decides whether its players may change it live ("Allow Live Modding"). Builds, deploys
and switching a mod on do not check that setting, so a dock asks before the agent's draft test or
live deploy:

```cpp
using crowdy::domains::CrowdyStudioLiveModdingAction;

game.crowdyStudioAgent().liveModdingAsync(
    appId, CrowdyStudioLiveModdingAction::DraftTest,
    [](crowdy::graphql::GraphQLOutcome out) {
      // out.data is true when the app allows it; otherwise errors[0].code says why.
    });
```

`liveModding(appId, action)` is the blocking form. It wraps
[`crowdyStudioLiveModding`](/application-api/reference/graphql/operations/queries/crowdy-studio-live-modding),
whose actions are `draft_test` and `deploy_live`. A refusal is a GraphQL error with one of these
codes:

| Code | Meaning |
|---|---|
| `AGENT_SCOPE_DENIED` | An action other than the two, or a token for another app |
| `AGENT_PERMISSION_DENIED` | The player lacks `use_studio_agent`, or the app's runtime is inactive |
| `AGENT_DISABLED` | The agent is off for the platform or the app, or the app switched it off |
| `AGENT_OPERATOR_KILLED` | Crowded Kingdoms switched it off |
| `AGENT_PROVIDER_POLICY_UNSATISFIED` | The policy could not be confirmed; try again later |

## The model list

The harness boots with the models the player may use in this app:

```cpp
game.crowdyStudioAgent().modelsAsync(appId, [](crowdy::domains::CrowdyStudioModelList list) {
  if (list.ok()) {
    for (const auto& model : list.models) {
      // model.id, model.name, model.contextWindow (unset when unknown),
      // model.inputModalities, model.pricingMicrousdPerMillion.input / output / ...
    }
  } else if (list.error) {
    // list.httpStatus, list.error->code, list.error->message, list.error->retryable
  }
});
```

This is [`GET /v1/model/models`](/application-api/agentic-crowdy-studio#get-v1modelmodels) on the
client's own transports, with its app token, timeout and response limit. `models(appId)` is the
blocking form, and both take `RequestOptions` with a `CancelToken`. The list keeps at most 1,024
models. It refuses only with the policy's codes above (HTTP 403) and
`AGENT_PROVIDER_POLICY_UNSATISFIED` (HTTP 503). When the game fetched the list with its own HTTP
stack, `crowdyStudioModelListFrom(outcome)` reads the answer.

## Starter projects

`crowdy/studio/starter_projects.hpp` makes the same starter projects CrowdyJS makes:

- `crowdyStudioClientStarterFiles(moduleName)` is the CLIENT half starter, a
  [`crowdy-client-sdk`](/exec/client-halves) crate that logs, keeps a tick count and shows it on
  the HUD.
- `createCrowdyStudioStarterProject(options)` lays out a new project: its module names come from
  the project's name (`weather-hud-server`, `weather-hud-client`), its SERVER half from the mod
  starter (`game.exec().modStarter(appId)`), its CLIENT half from the starter above.
- `createCrowdyStudioStarterProjectAsync(game.exec(), game.crowdyStudio(), options, done)` fetches
  the mod starter when the project has a SERVER half and, from 0.87.0, the platform's CLIENT half
  starter (`game.exec().modClientStarter(appId)`) when it has a CLIENT half, then creates the
  project. Where the platform cannot serve the CLIENT half starter yet, the SDK's copy, the same
  crate, is used.

```cpp
crowdy::studio::createCrowdyStudioStarterProjectAsync(
    game.exec(), game.crowdyStudio(),
    {.appId = appId, .gridId = gridId, .name = "Weather HUD",
     .kind = crowdy::studio::CrowdyStudioProjectKind::FullStack},
    [](crowdy::graphql::GraphQLOutcome out, crowdy::studio::CrowdyStudioProject project) {
      // project.projectId and project.revisionId on success; out.errors otherwise.
    });
```

## Draft tests and live deploys

`CrowdyStudioModRunner` runs a draft test or a live deploy of one saved revision of a project:

```cpp
auto runner = game.createCrowdyStudioModRunner(appToken);
crowdy::studio::CrowdyStudioRunHandle run = runner->run(
    {.scope = {appId, gridId}, .projectId = projectId, .expectedRevisionId = revision,
     .expectedServerModuleName = serverModule, .expectedClientModuleName = clientModule},
    [](crowdy::studio::CrowdyStudioRunResult result) {
      // result.outcome, and per target: state, buildLog, diagnostics, digest, version,
      // modId, enabled, running, blocked.
    },
    [](const crowdy::studio::CrowdyStudioRunProgress& progress) {
      // progress.step: ReadingProject, CheckingLiveModding, Building, Deploying, ...
    });
```

From CrowdyCPP 0.93.0, `createCrowdyStudioModRunner(appToken)` makes a runner whose requests carry
that app token, whatever token your game installs on `game` between calls. It starts at `game`'s
endpoint, follows a datacenter move on its own, and takes a new token when yours rotates:
`runner->setAppToken(newToken)`. `createCrowdyStudioModRunner()` without a token uses `game`'s own
session.

A run:

1. reads the project, and stops if it is no longer at `expectedRevisionId` (a project bound to a
   GitHub repository can pin `expectedGithubSha` instead), or if its module names are no longer
   `expectedServerModuleName` or `expectedClientModuleName` when you set them;
2. asks the live-modding check first when `checkLiveModding` is set;
3. builds exactly the files it read, the CLIENT half first, so a failed compile deploys nothing;
4. deploys the SERVER half to the grid and switches it on (a project with only a CLIENT half rides
   a mod named after its CLIENT module, deployed from the mod starter);
5. attaches the CLIENT half, and consents to it as its author.

From 0.87.0 every build names the project and the revision it read, so the mod and its CLIENT
half report which saved revision the grid runs (`studioProjectId`, `studioRevision` in
`game.exec().mods(appId, gridId)`; see [which Studio revision a mod
runs](/exec/mods#which-studio-revision-a-mod-runs)).

A read that gets no answer, an HTTP 5xx or 429 that is not the API's answer, or `PLATFORM_BUSY`
does not end a run (from 0.93.0). The run polls a build's status again, counting the miss toward
`pollLimit`, and gives the project, live-modding, mod-listing, and mod-starter reads one more try.
It never repeats a build, deploy, switch-on, attach, or consent call.

It ends with one outcome:

| Outcome | What happened |
|---|---|
| `Running` | The mod is switched on with this revision, and nothing blocks it |
| `Blocked` | Every step went through, but the mod is blocked; the target's `blocked` says why |
| `CompileFailed` | A build failed; its target carries the build log and the parsed diagnostics |
| `RevisionConflict` | The project moved past the revision or the module names the player saw |
| `RateLimited` | Too many builds; try again later |
| `QueueFull` | The build service is busy; try again later |
| `Refused` | The platform refused a step; `result.error->code` says why |
| `Cancelled` | `run.cancel()` stopped it at its next step |
| `Failed` | Anything else: a connection that stayed down, a build that outran `pollLimit`, or an exception inside the run |

A mod is blocked by a switch of the app's kill ladder, the app's own switch, its budget, or the
owner's access. A blocked run still attaches and consents to the CLIENT half, so once the block
clears both halves are this run's.

Whatever the outcome, each target's `state` says what the platform holds for it: `NotStarted`,
`Building`, `BuildFailed`, `Built`, `Deployed`, or `SwitchedOn` for the SERVER half, and `Attached`
or `Consented` for the CLIENT half. `modId`, `enabled`, `running`, and `blocked` describe the mod the
target is or rides; a mod just switched on may report `running` as false for a moment.

`deployment` chooses a draft test (the default) or a live deploy. Every run calls `onDone` exactly
once, as `Failed` if something inside it throws, your `onProgress` included. Destroying the runner
ends its runs without calling back. The build log is kept to its last 64 KiB.

## Studio's address

A dock opens popups only to Studio's own origin, and sends a player to Studio's wallet when the
model needs funds (`AGENT_FUNDS_NEEDED`). From 0.87.0 the platform answers both:

```cpp
const crowdy::CrowdyStudioLinks links = game.crowdyStudio().links();  // origin, walletUrl
```

`game.studioOrigin()` derives the same from the game's API origin without asking, and
`crowdy::studioWalletUrl` adds the wallet page:

```cpp
const std::string studio = game.studioOrigin();          // https://studio.prod.crowdedkingdoms.com
const std::string wallet = crowdy::studioWalletUrl(studio); // .../account/wallet
```

`crowdy::studioOriginFor(apiOrigin)` does the same for any API origin you configured, and answers
nothing for a host that follows no Crowded Kingdoms convention. Pass it the origin your game was
configured with, never a URL from a player or a page.

## Build diagnostics

`crowdy::studio::parseRustcDiagnostics(log, target)` turns a build log into diagnostics with a
file, line, column and severity, as CrowdyJS does. It reads each line once, in linear time, so a long log
line is safe on a game thread's small stack.
