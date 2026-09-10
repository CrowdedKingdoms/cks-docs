---
sidebar_position: 27
title: Connect your GitHub repo to a Studio project
---

# Connect your GitHub repo to a Studio project

A Crowdy Studio project can keep its SERVER and CLIENT source in **a GitHub
repository you own**. Edit in Studio and push, or edit in your own IDE and
pull — the repository is yours; Crowded Kingdoms never hosts it and never
holds a long-lived GitHub credential for you.

GitHub is a **filesystem** for your project. It is not a way to sign in: your
Crowded Kingdoms account is unchanged, and installing the app does not
connect your GitHub identity to it in any other way.

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
`GITHUB_NOT_CONNECTED`. Your bound projects keep their Studio files; connect
again and rebind to resume. Deleting your Crowded Kingdoms account removes the
installation record with it (the GitHub side still shows the app until you
uninstall it there).

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

Connecting requires your signed-in identity session (hosted Studio). The
in-game Studio panel can read and write a repository you already bound but
cannot connect or bind on its own.

## Bind a repository

Create the repository on GitHub first (any visibility, with a default branch)
and grant it to the installation. Then either:

- in **CK Studio**, open the app → **GitHub** tab, pick the repository from the
  list next to your project, optionally type a branch, and click **Bind**; or
- in **Crowdy Studio**, enter `owner/repo` or `owner/repo@branch` in the card
  and click **Bind**.

Binding checks that:

- the project is yours;
- the repository is granted to *your* installation;
- the branch exists.

The card then reads `owner/repo@branch`. One project binds to one repository;
**Unbind** (either place) removes the link and leaves your Studio files
untouched.

## Layout

Studio's two targets map onto directories in the repository:

| Studio target | Repository path |
|---|---|
| SERVER `src/lib.rs` | `server/src/lib.rs` |
| CLIENT `src/lib.rs` | `client/src/lib.rs` |

A `crowdy.json` at the repository root can override the roots:

```json
{ "server": "server", "client": "client" }
```

Without it, Studio infers the layout from existing `server/` and `client/`
directories, and treats the repository root as the SERVER tree when there is
neither. The first push of a full-stack project writes the file above.
`README.md`, `LICENSE`, `.gitignore`, `.github/`, `target/`, `node_modules/`
and `.git/` are never pulled into Studio.

## Push and pull

- **Push to GitHub** writes the project's current files to the bound branch,
  skipping any file whose content already matches. Each file is one commit,
  `studio: update SERVER src/lib.rs`.
- **Pull from GitHub** reads the branch and overlays it onto the project,
  then saves once. Pull refuses while you have unsaved edits; save first. A
  pull never pushes anything back.
- Files you deleted on GitHub stay in Studio until you delete them there too;
  the card lists them so nothing disappears silently.

If someone else changed a file since Studio last read it, the write is
refused with `GITHUB_STALE_SHA`; pull, then push again.

## Autosave push (opt-in)

By default Studio autosave writes only to Crowded Kingdoms. Turn on **Also
push autosaves to GitHub** in the Crowdy Studio card (or **Push on autosave**
on the CK Studio GitHub tab) to have every successful autosave push
the changed files as well. This is a per-project setting and it is **off**
until you turn it on. Turn it off any time; unbinding turns it off too.

## Limits and errors

| Limit / code | Meaning |
|---|---|
| 512 KiB per file | Larger files are refused in either direction |
| 2,000 files | Repositories above this are refused at bind |
| 120 GitHub operations / minute per account | `RATE_LIMITED`; counted across all datacenters; wait a minute |
| `GITHUB_NOT_CONNECTED` | Connect GitHub first, or connect again if you uninstalled the app |
| `GITHUB_NOT_BOUND` | Bind a repository to this project first |
| `GITHUB_REPO_NOT_GRANTED` | Add the repository to your installation on GitHub, then bind |
| `GITHUB_PATH_INVALID` | Paths are repo-relative; no `..`, no `.git/` |
| `GITHUB_STALE_SHA` | The file changed on GitHub since it was read; pull, then push |
| `GITHUB_UPSTREAM` | GitHub was unreachable or rate-limited; retry shortly |
| `GITHUB_NOT_CONFIGURED` | This environment has no GitHub App registered |

## For SDK users

CrowdyJS 15.11 exposes the same loop on `client.crowdyStudioGitHub`
(`status`, `connectUrl`, `repos`, `bind`, `unbind`, `setAutosave`, `tree`,
`getFile`, `putFile`). Reads and writes take only `{ appId, projectId, path }`;
the API resolves the bound repository, so a client never names one. See
the [CrowdyJS Studio embed](/crowdyjs/crowdy-studio-embed) for the card.
