---
sidebar_position: 6
title: Crowdy Studio in a native game
---

# Crowdy Studio in a native game

A native game can dock [Agentic Crowdy Studio](/game-api/agentic-crowdy-studio) beside its
world: the agent edits the player's Studio project, runs draft tests and deploys mods while the
player plays. CrowdyCPP (0.86.0 and later) carries the platform calls such a dock makes, on the
game's app-token client. Every asynchronous call delivers its callback from `game.poll()`, so
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
[`crowdyStudioLiveModding`](/game-api/reference/graphql/operations/queries/crowdy-studio-live-modding),
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

This is [`GET /v1/model/models`](/game-api/agentic-crowdy-studio#get-v1modelmodels) on the
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
  the mod starter when the project has a SERVER half, and creates the project.

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
auto runner = game.createCrowdyStudioModRunner();
crowdy::studio::CrowdyStudioRunHandle run = runner->run(
    {.scope = {appId, gridId}, .projectId = projectId, .expectedRevisionId = revision},
    [](crowdy::studio::CrowdyStudioRunResult result) {
      // result.outcome, and per target: buildLog, diagnostics, digest, version.
    },
    [](const crowdy::studio::CrowdyStudioRunProgress& progress) {
      // progress.step: ReadingProject, CheckingLiveModding, Building, Deploying, ...
    });
```

A run:

1. reads the project, and stops if it is no longer at `expectedRevisionId` (a project bound to a
   GitHub repository can pin `expectedGithubSha` instead);
2. asks the live-modding check first when `checkLiveModding` is set;
3. builds exactly the files it read, the CLIENT half first, so a failed compile deploys nothing;
4. deploys the SERVER half to the grid and switches it on (a project with only a CLIENT half rides
   a mod named after its CLIENT module, deployed from the mod starter);
5. attaches the CLIENT half, and consents to it as its author.

It ends with one outcome:

| Outcome | What happened |
|---|---|
| `Running` | The mod runs on the grid with this revision |
| `CompileFailed` | A build failed; its target carries the build log and the parsed diagnostics |
| `RevisionConflict` | The project moved past the revision the player saved |
| `RateLimited` | Too many builds; try again later |
| `QueueFull` | The build service is busy; try again later |
| `Refused` | The platform refused a step; `result.error->code` says why |
| `Cancelled` | `run.cancel()` stopped it at its next step |
| `Failed` | Anything else, such as a lost connection |

`deployment` chooses a draft test (the default) or a live deploy. Destroying the runner ends its
runs without calling back. The build log is kept to its last 64 KiB.

## Studio's address

A dock opens popups only to Studio's own origin, and sends a player to Studio's wallet when the
model needs funds (`AGENT_FUNDS_NEEDED`). `game.studioOrigin()` derives it
from the game's API origin, and `crowdy::studioWalletUrl` adds the wallet page:

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
