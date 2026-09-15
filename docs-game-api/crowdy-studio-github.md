---
sidebar_position: 27
title: Connect your GitHub repo to a Studio project
---

# Connect your GitHub repo to a Studio project

A Crowdy Studio project can keep its SERVER and CLIENT source in **a GitHub
repository you own**. While a repository is bound it *is* the project's
working tree: every save Studio makes is a commit on your branch, and every
push you make from your own IDE reaches Studio with one refresh. The
repository is yours; Crowded Kingdoms never hosts it and never holds a
long-lived GitHub credential for you.

**GitHub is never required.** Every project starts in Crowdy Studio with
`source: STUDIO`, and `crowdyStudioProjectCreate` is unchanged. Binding a
repository moves the project to `source: GITHUB`; unbinding moves it back and
keeps the files. Both directions are reversible, and a game that never binds
anything never sees a GitHub field.

GitHub is a **filesystem** for your project. It is not a way to sign in: your
Crowded Kingdoms account is unchanged, and installing the app does not
connect your GitHub identity to it in any other way.

## Lifecycle: STUDIO → bind → GITHUB → unbind

```
 crowdyStudioProjectCreate            crowdyStudioGitHubBind
 ───────────────────────►  STUDIO  ─────────────────────────►  GITHUB
                             ▲                                    │
                             └────────────────────────────────────┘
                                     crowdyStudioGitHubUnbind
```

| State | Where files live | How files are written | How files are read |
|---|---|---|---|
| `STUDIO` | Crowdy Studio, under the project revision | `crowdyStudioProjectSave` / `crowdyStudioProjectSaveFiles` / import | `crowdyStudioProject.files` |
| `GITHUB` | The bound branch; `files` is a **server-maintained mirror** of the rust under the layout roots at `githubSha` | `crowdyStudioGitHubPutFile` / `crowdyStudioGitHubDeleteFile`, each a commit carrying `expectedCommitSha` | `crowdyStudioProject.files` — unchanged — or the `crowdyStudioGitHub*` reads at any commit |

Reading never changes. Monaco, the in-browser agent, `client.crowdyStudio`
and any client that already loads `files` keep working on a bound project
without knowing it is bound. What changes is where writes go:
`crowdyStudioProjectSaveFiles`, `crowdyStudioProjectSave` with file bodies
and `crowdyStudioProjectImportFile` refuse a `GITHUB` project with
`GITHUB_BOUND_USE_CONTENTS`, because the repository — not Studio — is the
truth for its files. Metadata writes (name, grid affinity, module names) are
platform facts, not repository contents, and stay allowed.

`CrowdyStudioProject` and `CrowdyStudioProjectSummary` carry `source`,
`githubOwner`, `githubRepo`, `githubBranch` and `githubSha`; the same values
come back from `crowdyStudioGitHubStatus(appId, projectId)`.

## What the app can and cannot see

Crowded Kingdoms registers one GitHub App per environment (`Crowdy Studio`,
`Crowdy Studio (test)`, `Crowdy Studio (dev)`). When you connect, you
*install* it on your personal account or organization and choose which
repositories it may touch. The app asks for exactly two permissions:

| Permission | Why |
|---|---|
| Read access to **metadata** | List the repositories you granted and their branches |
| Read and write access to **code** (contents) | Read and write files in those repositories |

It requests nothing else — no administration, no members, no webhooks, and no
OAuth on install. The API mints a short-lived installation token per request
and stores no GitHub token of any kind. You can revoke the installation at any
time from **GitHub → Settings → Applications → Installed GitHub Apps**.

Install it on **your own** account or organization. The app cannot be connected
to the Crowded Kingdoms organization itself: an installation there is refused
when you return to the connect page, and no repository access is ever granted
through it.

### If you uninstall

Uninstalling on GitHub takes effect at your next Studio GitHub operation: the
API sees the installation is gone, forgets it, and answers
`GITHUB_NOT_CONNECTED`. A bound project keeps its mirror — the files it had at
`githubSha` — but cannot be written until you connect again and rebind (or
unbind it and carry on in Studio). Deleting your Crowded Kingdoms account
removes the installation record with it (the GitHub side still shows the app
until you uninstall it there).

## Connect

Two places offer the same connect flow; use whichever is open:

- **CK Studio (web):** **Account → Connected apps → GitHub repositories**.
- **Crowdy Studio (editor):** the **GitHub repository** card in the project
  settings pane.

1. Click **Connect GitHub**. A new tab opens on GitHub; pick the account and
   the repositories to grant (start with one). GitHub returns you to a page on
   the Crowded Kingdoms API that says *GitHub connected*.
2. Back in the page you started from, click **Refresh**. It now shows your
   GitHub login (Crowdy Studio) or the repositories you granted (CK Studio).

A connect link is single-use and expires after 15 minutes; if you reuse one you
are asked to click **Connect GitHub** again.

Connecting requires your signed-in identity session (hosted Studio); see
[Which token may call what](#which-token-may-call-what).

## Starting from nothing: create the repository

The Crowdy Studio app holds **installation tokens only**. It can act on
repositories you have granted it and can never create one — that would need
a user token, which Crowded Kingdoms does not mint or store. So the
repository is your own click on GitHub, and both Studio and the in-game card
make it a short one:

1. **Create repository on GitHub.** Studio opens GitHub's new-repository page
   prefilled: your connected login as owner, the project name as the
   repository name (slugged), private. Any prefill GitHub declines simply
   falls back to its default. Create it empty — no README, no `.gitignore` —
   or with either; the first bind commit adds what is missing.
2. **Grant it, if your installation covers selected repositories.**
   `crowdyStudioGitHubStatus.repositorySelection` says `all` or `selected`.
   Under `all` the new repository is granted the moment it exists. Under
   `selected` add it at `installUrl` (GitHub → Settings → Applications →
   Crowdy Studio → Repository access); Studio waits and reminds you.
3. **Bind with `PUSH_PROJECT`.** Studio prefills `owner/repo` the moment the
   repository appears in your granted list and defaults the first commit to
   *Push this project*. That single commit carries `crowdy.json`, a
   `README.md` naming the mod and its layout (only when the branch has none),
   and the project's files.

## Bind a repository

Create the repository on GitHub first (any visibility; empty or with a
default branch) and grant it to the installation — see "Starting from
nothing" above. A bind is **one commit**, and you say which side is the truth
for it with `initial`:

| `initial` | What the commit does | Refused with |
|---|---|---|
| `PUSH_PROJECT` | Commits the project's files into the branch under the layout roots, plus a `crowdy.json` when the branch has none and a `README.md` when the branch has no readme | `GITHUB_REPO_HAS_FILES` — the branch already carries rust under the layout roots |
| `TAKE_REPOSITORY` | Adopts the branch as it is: the project's files are replaced by the rust under the layout roots at branch HEAD | `GITHUB_REPO_EMPTY` — there is nothing under the roots to take |

Start a project in Studio and want it in a fresh repository: `PUSH_PROJECT`.
Have a repository already and want Studio to edit it: `TAKE_REPOSITORY`. The
two are refused rather than merged because the repository and the project
cannot both be the truth on day one.

```graphql
# A Studio project into an empty repository
mutation BindPush {
  crowdyStudioGitHubBind(input: {
    appId: "1"
    projectId: "7b1f7e2c-…"
    owner: "octocat"
    repo: "my-tower-mod"
    branch: "main"          # optional; defaults to the repository's default branch
    initial: PUSH_PROJECT
  }) {
    owner repo branch githubSha
  }
}

# An existing repository becomes the project
mutation BindTake {
  crowdyStudioGitHubBind(input: {
    appId: "1"
    projectId: "7b1f7e2c-…"
    owner: "octocat"
    repo: "my-tower-mod"
    initial: TAKE_REPOSITORY
  }) {
    owner repo branch githubSha
  }
}
```

Binding checks that the project is yours, is not already bound
(`GITHUB_ALREADY_BOUND`), the repository is granted to *your* installation
(`GITHUB_REPO_NOT_GRANTED`), the branch exists, and any `crowdy.json` on it is
valid (`GITHUB_LAYOUT_INVALID`). A `PUSH_PROJECT` of a project that has CLIENT
files into a repository whose `crowdy.json` has no `client` directory is also
`GITHUB_LAYOUT_INVALID`. From then on the card reads `owner/repo@branch`,
`source` is `GITHUB` and `githubSha` is the commit the bind created or adopted.
One project binds to one repository.

The Crowdy Studio editor refuses to bind over unsaved edits and reloads the
project afterwards, because `TAKE_REPOSITORY` replaces its files and every
bind gives it a new `githubSha`.

## Working on a bound project

### Every save is a commit

A write to a bound project is `crowdyStudioGitHubPutFile` (create or update)
or `crowdyStudioGitHubDeleteFile`, one file per call, each a commit on the
bound branch. The write carries **`expectedCommitSha`: the `githubSha` you
read the project at.** The server commits, then advances `githubSha` to the
new commit by compare-and-set; if the project has moved on since you read it,
nothing is committed and you get `GITHUB_STALE_SHA`. Two editors can therefore
never silently interleave. The blob `sha` is optional — the server resolves
it from the tree at `expectedCommitSha` — and when sent it must agree.

```graphql
mutation Save {
  crowdyStudioGitHubPutFile(input: {
    appId: "1"
    projectId: "7b1f7e2c-…"
    path: "server/src/lib.rs"
    content: "use crowdy_compute_sdk::*;\n…"
    message: "studio: update SERVER src/lib.rs"
    expectedCommitSha: "3f2a9c1e0d8b7a6f5e4d3c2b1a0f9e8d7c6b5a49"
  }) {
    path
    sha        # new blob SHA
    commitSha  # the new project githubSha — send it as expectedCommitSha next time
  }
}
```

When the path is a project file under the layout roots (`Cargo.toml` or a
`.rs` under `src/` of a crate), the mirror advances with the commit and every
reader sees the new content on its next load. A path outside the roots — a
README, a workflow, a mesh under `assets/` — still commits and still advances
`githubSha`, but is a repository file, not a project file. `crowdy.json`
cannot be deleted this way (`GITHUB_PATH_INVALID`).

In **CrowdyJS 17**, `client.crowdyStudio.saveProject` does all of this for a
bound project on its own: each changed file becomes its own `PutFile` (or
`DeleteFile`) carrying the current `githubSha`, then metadata is saved as a
plain project save with no file bodies. A stale commit surfaces as the same
revision-conflict error the editor already recovers from. A multi-file save
that races part-way leaves the earlier commits on the branch and the project
describing them; the conflict recovery re-reads and re-applies the remaining
edits against the new commit. The [in-browser agent](agentic-crowdy-studio)
writes the same way.

### A push from somewhere else: refresh

Studio never reads the branch head on its own; it reads the mirror at
`githubSha`. After you push from your IDE, bring the mirror forward:

```graphql
mutation Refresh {
  crowdyStudioGitHubRefresh(input: { appId: "1", projectId: "7b1f7e2c-…" }) {
    githubSha   # now the branch head
  }
}
```

`githubSha` becomes the head commit and the mirror is rebuilt from the rust
under the layout roots there; a no-op when already at head. The Studio card's
**Refresh** button and CrowdyJS's `refreshFromGitHub()` call this. Like bind,
it refuses over unsaved edits and reloads the project afterwards.

### Reading at a commit

`crowdyStudioGitHubTree`, `crowdyStudioGitHubFile` and
`crowdyStudioGitHubLayout` take an optional full 40-hex `commitSha`. Omitted,
they read at `githubSha` — the mirror commit, never the branch head. The tree
answers `{ commitSha, entries }` so a follow-up file read can pin the commit
the paths came from.

## Unbind

`crowdyStudioGitHubUnbind` removes the bind. The project keeps its files —
the mirror at `githubSha` — and is a plain `STUDIO` project again, writable
through the Studio file mutations; nothing on GitHub changes. Bind it again
later with `TAKE_REPOSITORY` to pick the branch back up, or `PUSH_PROJECT`
into a new repository.

## Deploy from a project

`playerComputeDeploy` takes the **project**, not file bodies. The server
resolves the source itself: the project files at their saved revision for a
`STUDIO` project, or the rust under the layout roots at a commit for a
`GITHUB` project. What compiles is exactly what was saved or committed, and a
client never uploads a source map.

```graphql
mutation Deploy {
  playerComputeDeploy(input: {
    appId: "1"
    gridId: "42"
    projectId: "7b1f7e2c-…"
    target: SERVER
    tickHz: 1
    # GITHUB projects only; defaults to the project githubSha. Refused for a STUDIO project.
    # commitSha: "3f2a9c1e0d8b7a6f5e4d3c2b1a0f9e8d7c6b5a49"
  }) {
    versionId versionNo compileStatus
    projectId sourceRevision githubCommitSha
  }
}
```

`PlayerWasmModuleVersion` records `projectId`, `sourceRevision` (STUDIO) or
`githubCommitSha` (GITHUB). A version is pinned to the commit it was fetched
at: a force-push of the bound branch never changes what a deployed version
runs. A `commitSha` on a `STUDIO` project is refused with `GITHUB_NOT_BOUND`;
the SDK/ABI pins are the project's own, not deploy input. See
[Player code](player-code#deploy-player-code) for the rest of the deploy
loop.

## Layout: `crowdy.json`

Where the SERVER and CLIENT crates live in the repository is decided by a
`crowdy.json` at the repository root, resolved **by the server** at a commit:

```json
{ "server": "server", "client": "client", "assets": "assets" }
```

| Key | Meaning | Default |
|---|---|---|
| `server` | Directory of the SERVER `Cargo.toml`; `.` is the repository root | `.` |
| `client` | Directory of the CLIENT `Cargo.toml`, or absent for a server-only project | none |
| `assets` | Prefix visitors may fetch assets from (reserved; nothing serves it yet) | `assets` |

All values are repo-relative directories; `client` and `server` must differ
and `assets` may not be a crate directory. When the file is absent the tree is
consulted once: a `server/Cargo.toml` with no root `Cargo.toml` becomes the
SERVER root and a `client/Cargo.toml` becomes the CLIENT root, so a repository
already in the default full-stack shape needs no file. A `PUSH_PROJECT` bind
writes the file above when the branch has none. Anything else needs the file;
a malformed one is `GITHUB_LAYOUT_INVALID`.

Studio paths are the per-target relative paths a project already uses
(`Cargo.toml`, `src/lib.rs`); repository paths are those joined under the
target's root:

| Studio target | Repository path (default full-stack layout) |
|---|---|
| SERVER `src/lib.rs` | `server/src/lib.rs` |
| CLIENT `src/lib.rs` | `client/src/lib.rs` |

**Clients must not parse `crowdy.json`.** `crowdyStudioGitHubLayout(appId,
projectId, commitSha?)` is the only grammar; it returns `{ commitSha, server,
client, assets, fromFile }`. CrowdyJS 17 and the agent worker read it and no
longer carry a parser of their own.

## Which token may call what

| Field | App token (in-game Studio, the agent worker) | Identity session (hosted Studio) |
|---|---|---|
| `crowdyStudioGitHubStatus` | yes | yes |
| `crowdyStudioGitHubLayout`, `Tree`, `File` | yes | yes |
| `crowdyStudioGitHubPutFile`, `DeleteFile`, `Refresh` | yes | yes |
| `crowdyStudioGitHubConnectUrl`, `Repos` | no | yes |
| `crowdyStudioGitHubBind`, `Unbind` | no | yes |

Every field is scoped to projects the token's user owns, so **a game never
needs an identity session to author against GitHub**: a player connects and
binds once in hosted Studio, and the in-game embed and the agent then read
and write the bound repository with the same app token that plays. A
third-party game must never hold or request an identity session for this.

Every GitHub field is **datacenter-only**: call it on the app's datacenter
endpoint (the one the game plays against), not the shared origin. In CrowdyJS
that is the `client.crowdyStudioGitHub` of the client that adopted the app's
datacenter — the default the Studio embed uses. Commit SHAs are always the
full 40-hex form; abbreviations are refused.

## Limits and errors

| Limit | Meaning |
|---|---|
| 512 KiB per file | Larger files are refused in either direction |
| 2,000 tree entries | Repositories above this are refused at bind and refresh |
| 120 GitHub operations / minute per account | `RATE_LIMITED`; counted across all datacenters; wait a minute |
| 10 s per GitHub call | A hung upstream answers `GITHUB_UPSTREAM`; retry |

| Code | Meaning | What to do |
|---|---|---|
| `GITHUB_NOT_CONFIGURED` | This environment has no GitHub App registered | Nothing GitHub-related works here; every card hides itself |
| `GITHUB_NOT_CONNECTED` | The caller has not installed the Crowdy Studio GitHub App, or uninstalled it | Connect GitHub (identity session) |
| `GITHUB_NOT_BOUND` | The project has no bound repository | Bind one, or use the Studio file mutations |
| `GITHUB_ALREADY_BOUND` | The project already has a bound repository | Unbind before binding another |
| `GITHUB_REPO_NOT_GRANTED` | The repository is not granted to *your* installation | Add it to the installation on GitHub, then bind |
| `GITHUB_REPO_HAS_FILES` | `PUSH_PROJECT` refused: the branch already has rust under the layout roots | Bind with `TAKE_REPOSITORY`, or use an empty branch |
| `GITHUB_REPO_EMPTY` | `TAKE_REPOSITORY` refused: nothing under the layout roots to take | Bind with `PUSH_PROJECT` |
| `GITHUB_LAYOUT_INVALID` | `crowdy.json` on the branch is not a valid layout, or does not fit the project | Fix it on the branch (repo-relative directories; `client` ≠ `server`) and refresh |
| `GITHUB_PATH_INVALID` | A path was rejected: absolute, `..`, `.git/`, control characters, over 256 bytes, or deleting `crowdy.json` | Send a repo-relative path |
| `GITHUB_STALE_SHA` | `expectedCommitSha` (or a blob `sha` you sent) no longer matches the project | Re-read the project, take the new `githubSha`, write again |
| `GITHUB_BOUND_USE_CONTENTS` | A Studio file mutation was called on a `GITHUB` project | Write with `crowdyStudioGitHubPutFile` / `DeleteFile`; CrowdyJS 17 `saveProject` does this for you |
| `GITHUB_UPSTREAM` | GitHub answered 5xx, timed out, or hit a secondary rate limit | Retry shortly |

## For SDK users

CrowdyJS 17 exposes the loop on `client.crowdyStudioGitHub` (`status`,
`connectUrl`, `repos`, `bind` with `initial`, `unbind`, `refresh`, `layout`,
`tree`, `getFile`, `putFile`, `deleteFile`). Reads and writes take only
`{ appId, projectId, path }` plus `expectedCommitSha` on writes; the API
resolves the bound repository, so a client never names one. The Studio
controller's `saveProject` commits automatically on a bound project, and the
settings card offers Connect, Bind (either `initial`), Refresh and Unbind.
Push, Pull, `setAutosave` and the SDK-side `crowdy.json` helpers of 15.11 are
gone — there is nothing left to push or pull, and the layout comes from the
API. See the [CrowdyJS Studio embed](/crowdyjs/crowdy-studio-embed) and the
SDK's migration notes.
