---
slug: studio-dock
sidebar_position: 17.7
title: Studio Dock
description: "The platform calls behind an in-game Studio dock: the agent's boot material, the player's consent, model use and the Allow Live Modding check, the player's Studio projects, and Run Project, which builds one pinned revision and puts it on a grid, with each result."
---

# Studio Dock

A Studio dock is a panel in your game where a player works on their own [mods](./mods.md) and [Mod Scripts](./mod-scripts.md) with the Studio agent: they pick a project, the agent edits it, and the player runs it on their grid. This page is the platform side of such a dock. Your game draws the panel and hosts the agent's page. The SDK makes the calls, and each one answers or refuses plainly.

Every call is the signed-in player's own, made with their app token, and nothing is cached. Each is latent: **On Done** or **On Failed** fires once, on the game thread, never inside the call. Your module needs `CrowdyServices` in its Build.cs. Grid ids are 64-bit: keep them as Integer64 in Blueprint and `int64` in C++.

## Boot the agent

The **Crowdy Studio Agent** subsystem (`UCrowdyStudioAgent`, a Game Instance subsystem) lives under **Crowdy SDK > Studio**.

| Blueprint | C++ | Does |
|---|---|---|
| **Get Agent Boot** | `GetAgentBoot(OnDone)` | What the page hosting the agent needs: **App Id**, **Graph QL Url**, **Model Base Url**, **Connect Origins**, **Studio Origin**, **Wallet Url** and **Models**, the models the app allows, with their prices. It holds no token. It answers **No Model** when no model is available to the app. |
| none | `GetAgentToken()` | The app token to hand to the agent. Empty while signed out. |
| none | `OnAgentTokenChanged` | Fires with the user id and the new token after a token rotation and after each sign-in, and with an empty token on sign-out. |
| **On Agent Boot Changed** | `OnAgentBootChanged` | The SDK's API origin moved, so the boot material is stale. It is noticed when the app token changes and when the boot material is read. |

**Connect Origins** lists every origin the agent may connect to. Put nothing else in the page's connect-src. The token hand-off is C++ only, so no Blueprint graph can read it, and it is never the session token. **Studio Origin** and **Wallet Url** come from the platform. If its links are missing or not https, they come from the Studio the API address implies: `ck.<root>` gives `studio.<root>`, and a local API's Studio is on port 3001. Only https links are handed out (http to this machine works outside a Shipping build). With no Studio address at all, the boot answers **Refused**. **Wallet Url** is where the player adds funds, so open it in their own browser.

## Consent, model use and live modding

| Blueprint | C++ | Does |
|---|---|---|
| **Get Consent Notice** | `GetConsentNotice()` | The SDK's notice text: what reaches the model provider, who pays, and where sessions stay. Show it before asking. |
| **Get Provider Consent** | `GetProviderConsent(OnDone)` | Whether the player consented to provider data use for this app: **Consented** and **Consented At Ms**. |
| **Record Provider Consent** | `RecordProviderConsent(OnDone, bConsented)` | Records the consent after the player saw the notice. **Consented** false takes it back. |
| **Get Model Usage** | `GetModelUsage(OnDone)` | Who pays (**Unknown**, **Player**, **App** or **Platform**), today's requests, today's charge and the day's limit, in millionths of a US dollar. |
| **Authorize Live Modding** | `AuthorizeLiveModding(Action, OnDone)` | Asks the app's Allow Live Modding switch whether a **Draft Test** or a **Live** run may go ahead. **Allowed** is false unless **Result** is **Success**. |

:::warning[Call Authorize Live Modding before every run.]
Only **Authorize Live Modding** checks the app's Allow Live Modding switch. **Run Project**, **Build Client Mod**, **Deploy Client Mod** and the platform's build and deploy calls do not. A **Draft Test** is a real deploy on the player's grid, not a dry run.
:::

A Studio call ends with one of these results; in Blueprint a result other than **Success** arrives on **On Failed**.

| Result | Means |
|---|---|
| **Success** | Done. |
| **Not Signed In** | The player has no app token yet. |
| **Denied** | A missing permission such as `use_studio_agent`, or the app's agent policy. **Message** names which. |
| **Not Found** | No such project or model. |
| **Refused** | Any other refusal, the platform's or the SDK's before sending. |
| **Failed** | The request did not complete, or the platform could not confirm the model provider's policy. Try again. |
| **Bad Reply** | The answer was malformed, so nothing from it is returned. |
| **Not Built** | This SDK version does not carry the call yet, so nothing was sent. |
| **No Model** | **Get Agent Boot** only: no model is available to the app, from its agent policy and the platform's together, so the agent cannot start. The app's operator or the platform fixes it, not the player. |

## Studio projects

The **Crowdy Studio Projects** subsystem (`UCrowdyStudioProjects`, a Game Instance subsystem) reads and creates the player's Studio projects in this app.

| Blueprint | C++ | Does |
|---|---|---|
| **List Studio Projects** | `ListProjects(OnDone)` | The player's projects, newest first, up to 50 a call, archived ones left out. **More** is true when the platform holds others. |
| **Get Studio Project** | `GetProject(ProjectId, OnDone)` | One project read fresh, with its **Files** ordered by target and path. |
| **Create Studio Project** | `CreateProject(Name, Kind, OnDone)` | A new project of that **Kind**, filled from the platform's starters. |

A project has a **Project Id**, **Name**, **Source** (**Studio**, or **GitHub** when a bound repository is the working tree), **Kind**, **Server Module**, **Client Module**, **Grid Id** (0 when none) and **Revision**. The revision is an opaque token that changes whenever the source does: hand it back as it is. For a GitHub project it is the revision joined to the commit as `revision@sha`. A file has a **Target**, a **Path** (`Cargo.toml`, `README.md` or a Rust file under `src/`), its **Content** and its own **Revision**.

**Kind** says which halves the project has: **Server** (a server mod only), **Client** (a Mod Script only, riding the platform's starter mod), **Paired** (both, which run only together) or **Independent** (both, either of which may run alone).

**Create Studio Project** names the modules from **Name**: the server module is its lowercase slug, and the client module is the slug plus `-client`, so a client module never shares a name with a server mod. A name with no ASCII letters or digits is refused. In C++ an overload takes the module names too: 1 to 48 lowercase letters, digits, `-` and `_`, different from each other. Every half the kind has needs a name, and a name for a half it does not have is refused.

The server half starts from the platform's starter, and the client half from its client starter, with the package named for the client module. If the platform does not serve the client starter, the SDK uses its own copy of the same crate. If the platform refuses a starter, or it does not arrive, the create fails with the platform's reason.

## Run a project

**Run Project** builds one revision of a project and puts it on one of the player's grids. Pass the revision your panel showed the player as **Expected Revision**. It, **Get Project Status** and the two pieces below need Game API v2.73.0; an older one refuses them with `GRAPHQL_VALIDATION_FAILED`.

| Blueprint | C++ | Does |
|---|---|---|
| **Run Project** | `RunProject(GridId, ProjectId, ExpectedRevision, Mode, OnDone)` | Builds and deploys exactly that revision on the grid. |
| none | `RunProject(GridId, ProjectId, ExpectedRevision, Mode, ExpectedServerModule, ExpectedClientModule, OnDone)` | The same, and answers **Revision Changed** before building when the project's server or client module name is not the one given, since those names pick the mods the run overwrites. An empty name is not checked. |
| **Get Project Status** | `GetProjectStatus(GridId, ProjectId, OnDone)` | Where each half of the project is on the grid. |

A run goes in this order:

1. The client half is built first, so a build that fails publishes nothing.
2. The server half is built, deployed and switched on.
3. The client half is attached to its mod, and consented to as its author.

A client-only project rides a mod named for its client module. That mod is deployed from the platform's starter when the grid has none, and the run is refused when it exists and is switched off.

The run is pinned. An empty **Expected Revision**, a grid id below 1 and a signed-out player are refused before anything is sent. If the saved revision, or in the C++ overload a module name, is not the one you passed, the answer is **Revision Changed** and nothing was built. A GitHub project's revision includes its commit. Each build a run sends names the project and revision, so the mod and its client half read back with that **Studio Project Id** and **Studio Revision**. One run per app runs at a time: a second answers **Busy**. A run keeps to its grid and to the player and app it started for. If either changes, it answers **Failed** and sends nothing more, though a step it already sent may still complete on the grid.

**Result** is **Success** when the run went to its end. A crate that does not compile is still **Success**, with that half's **Phase** at **Build Failed**, so read the phases. The answer holds:

| Field | Is |
|---|---|
| **Mode**, **Grid Id**, **Project Id** | What the run was for. |
| **Revision** | The revision built, always the one asked for. |
| **Targets** | Each half the project has, server first: **Target**, **Phase**, **Module**, **Mod Id**, **Digest**, **Version**, **Running Revision**, **Saved Revision** and **Message**. |
| **Build Log** | The compiler's output for every half built, at most 64 KB each with the end kept. |
| **Diagnostics** | Messages about project files, such as compiler errors: **Target**, **Source** (**rustc**, **Local** or **Runtime**), **Path**, **Line**, **Column**, **End Line**, **End Column** (0 when there is no end), **Severity**, **Message** and **Code**. Lines and columns count from 1. |

A half's **Phase** is **Not Started**, **Building**, **Build Failed**, **Deploying**, **Deploy Failed**, **Deployed** or **Running**. **Deployed** means it is deployed but not running now, and **Message** says why.

**Get Project Status** reads the platform back every time, so it needs no earlier run. It answers **Run In Flight** (a run of this project is still going), and the same targets. **Saved Revision** is the project's saved revision when it was read. **Running Revision** differs by half:

- Server: the revision the platform says its mod was built from. It is empty when the mod was built from another project or from none.
- Client: the revision a run deployed since this game started. It shows only while the platform still serves that run's digest, since the platform names no revision for a client half.

A GitHub project's older revision reads as the platform's number alone, without its commit.

### The pieces of a run

**Build Client Mod** builds one client crate and waits for it, as **Build Mod** does, with the same limits. **Deploy Client Mod** attaches a successful client build as a mod's client half on one of the player's grids; the mod must exist. Both are building blocks with no run lock, no pinned revision and no Allow Live Modding check. A dock uses **Run Project** instead.

### Run results

[Mods](./mods.md#what-each-result-means) lists the mod results. Two more come with a run:

| Result | Means |
|---|---|
| **Busy** | Another run for this app is still going, or the platform is already building one for this player. Try again once it ends. |
| **Revision Changed** | The project's saved revision or module names are not the ones asked for, so nothing was built. |

## Grid channels and script logs

**List Grid Channels** (`UCrowdyClaims::ListGridChannels(GridId, OnDone)`, under **Crowdy SDK > Claims**) answers the channels a grid owns, oldest first. A grid id of 0 or less is refused without sending. A row that is not one of the grid's own fails the whole list as **Bad Reply**. It answers with the [Chunk Claims](./chunk-claims.md#what-each-result-means) results.

**Get Script Status** and **Get Script Log** read the [Mod Scripts](./mod-scripts.md#read-a-scripts-status-and-log) running for the player. Both answer **Not In Grid** unless the grid is the one the player stands in.

## From C++

Each C++ callback runs once on the game thread. If the game instance ends first it does not run, and a step a run already sent may still complete. The types behind the calls:

| Type | Is |
|---|---|
| `FCrowdyStudioAgentBoot`, `FCrowdyStudioConsent`, `FCrowdyStudioModelUsage`, `FCrowdyStudioLiveModding` | The agent's answers. Each holds a `Result` (`ECrowdyStudioResult`) and a `Message`. |
| `FCrowdyStudioModel` | One model the agent may use: `ModelId`, `Name`, `ContextWindow` (tokens, 0 when not given), `InputModalities`, and its prices in millionths of a US dollar per million tokens: `InputMicroUsdPerMillion`, `OutputMicroUsdPerMillion`, `ReasoningMicroUsdPerMillion` and `CachedInputMicroUsdPerMillion` (0 when not given). |
| `FCrowdyStudioProject` | One project: `ProjectId`, `Name`, `Source`, `Revision`, `Kind`, `ServerModule`, `ClientModule`, `UpdatedAtMs`, `GitHubSha`, `GitHubRef` and `GridId`. |
| `FCrowdyStudioProjectFile` | One file: `Target`, `Path`, `Content` and `Revision`. |
| `FCrowdyStudioProjectList`, `FCrowdyStudioProjectInfo` | The answers to list, and to get and create. |
| `ECrowdyStudioRunMode`, `ECrowdyStudioTarget` | `DraftTest` or `Live`; `Server` or `Client`. |
| `ECrowdyStudioPayer`, `ECrowdyStudioProjectKind`, `ECrowdyStudioProjectSource` | The enums described above. |
| `FCrowdyModRun`, `FCrowdyModProjectStatus` | The answers to a run and a status read, each with an `ECrowdyModResult`. |
| `FCrowdyModRunTarget`, `ECrowdyModRunPhase` | One half of a run, and its phase: `NotStarted`, `Building`, `BuildFailed`, `Deploying`, `DeployFailed`, `Deployed`, `Running`. |
| `FCrowdyModDiagnostic`, `ECrowdyModDiagnosticSeverity`, `ECrowdyModDiagnosticSource` | One message about a project file; the severity is `Error`, `Warning`, `Info` or `Hint`, and the source is `Rustc`, `Local` or `Runtime`. |
| `FCrowdyModClient`, `FCrowdyModClientInfo` | A mod's client half on a grid, and the answer to **Deploy Client Mod**. A client half has `ModId`, `GridId`, `Name`, `OwnerUserId`, `ClientVersion`, `Digest`, `SizeBytes`, `CapabilitySummaryJson`, `CapabilityHash`, `TickIntervalMs`, `UpdatedAtMs`, and the `StudioProjectId` and `StudioRevision` it was built from (empty when its build named none). |
| `UCrowdyGetAgentBoot`, `UCrowdyGetProviderConsent`, `UCrowdyRecordProviderConsent`, `UCrowdyGetModelUsage`, `UCrowdyAuthorizeLiveModding`, `UCrowdyListStudioProjects`, `UCrowdyGetStudioProject`, `UCrowdyCreateStudioProject`, `UCrowdyBuildClientMod`, `UCrowdyDeployClientMod`, `UCrowdyRunProject`, `UCrowdyGetProjectStatus` | The nodes. C++ calls the subsystems instead. |
| `FCrowdyStudioBootAsyncResult`, `FCrowdyStudioConsentAsyncResult`, `FCrowdyStudioUsageAsyncResult`, `FCrowdyStudioLiveModdingAsyncResult`, `FCrowdyStudioProjectAsyncResult`, `FCrowdyStudioProjectListAsyncResult`, `FCrowdyModClientInfoAsyncResult`, `FCrowdyModRunAsyncResult`, `FCrowdyModProjectStatusAsyncResult` | The delegate types of the nodes' pins. |
| `FOnCrowdyAgentTokenChanged`, `FOnCrowdyAgentBootChanged` | The delegate types of `OnAgentTokenChanged` (C++ only) and `OnAgentBootChanged`. |
