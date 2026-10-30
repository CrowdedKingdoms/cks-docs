---
sidebar_position: 11
title: "Host your game"
slug: host-your-game
---

# Host your game

Crowded Kingdoms does not host games. You build your game into static files and serve
them from a host you choose, and Crowded Kingdoms serves everything the page talks to:
the API, hosted sign-in on Crowdy Studio, Studio's editor and agent, and your server
code on [ck-exec](/exec/intro). Any static host works if it can set response headers.

The canonical guide, with a recipe for each common host, is
[`docs/HOSTING.md` in The Construct](https://github.com/CrowdedKingdoms/the-construct/blob/prod/docs/HOSTING.md).
This page is the short version.

:::info[Crowdy Games is retired]
Until 2026-10-29 Crowded Kingdoms hosted games on Crowdy Games. That site and its
content host are gone on every environment, and the platform's hosting API is switched
off: it answers `CONTENT_HOSTING_DISABLED` or returns nothing. A
game that was published there is hosted the way this page describes. See the
[changelog](/releases/intro#2026-10-29-crowdy-games-retired-host-your-game-yourself).
:::

## What you deploy

`npm run build` writes a static site to `dist/`, and that is all you deploy:

- `index.html` and the game's JavaScript, CSS, WebAssembly and assets;
- `dsh/`, the Crowdy Studio agent's harness (about 13 MB), when your game embeds the
  agent pane (see [Shipping the harness](/crowdyjs/agentic-crowdy-studio#shipping-the-harness));
- `construct-draft-sw.js`, the service worker Studio's game editor previews edits with,
  in a game built on The Construct.

The host serves files and runs no code of yours. Your server code runs on ck-exec.

## The steps

1. **Register your origin and set the launch URL.** In Studio, open your app, then
   **Settings > Sign-in & redirect URIs**. Add your game's origin (for example
   `https://play.example.com`) under **Redirect URIs**, and set **Launch URL** to the
   page players open. In a checkout of The Construct,
   `npm run setup -- --origin https://play.example.com` does both: it registers the
   origin, and sets it as the launch URL when the app has none yet.
2. **Build.** Set `VITE_APP_ID` to your app's id, so players go straight to sign-in, and
   run `npm run build`. For a sub-path such as `https://example.com/my-game/`, build
   with `npx vite build --base=/my-game/`.
3. **Deploy `dist/`** to a static host that sends [the headers](#the-headers) on every
   response and follows the [rules for particular paths](#paths-with-rules-of-their-own).
4. **Check it** the way [How to tell it worked](#how-to-tell-it-worked) describes.
5. **Edit it live.** Studio's **Live code** opens the app's launch URL, so it now opens
   your deployment. See [Local development and Live code](#local-development-and-live-code).

## The headers

Send these on **every** response, whatever the path: HTML, JavaScript, WebAssembly and
worker scripts. A worker script fetched without them breaks isolation for the page that
started it.

| Header | Value | Why |
|---|---|---|
| `Cross-Origin-Opener-Policy` | `same-origin` | With the next header, it makes the page cross-origin isolated. |
| `Cross-Origin-Embedder-Policy` | `credentialless` or `require-corp` | The Construct sends `credentialless`, which loads cross-origin resources without credentials. `require-corp` isolates the page too, but then every cross-origin resource the page loads must opt in with `Cross-Origin-Resource-Policy` or CORS. |
| `Cross-Origin-Resource-Policy` | `same-origin` | Other sites cannot load your files into their pages. |
| `Access-Control-Allow-Origin` | `null` | The [grid program sandbox](#grid-programhtml) is an opaque origin, so its module scripts are requested with `Origin: null` and need this answer. Your files are your public build, so it exposes nothing. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Other origins learn only your origin, never the full address. |
| `X-Content-Type-Options` | `nosniff` | The browser uses the declared content type and never guesses one. |

Then one `Content-Security-Policy` and one `Permissions-Policy` per kind of page:

| Path | `Content-Security-Policy` | `Permissions-Policy` |
|---|---|---|
| `/` and `/index.html` | [the game's](#the-content-security-policy) | `camera=(self), microphone=(self)` |
| `/dsh/*` | [the harness's](#dsh-the-agents-harness) | `camera=(self), microphone=(self)` |
| `/grid-program.html` | [the sandbox's](#grid-programhtml) | `camera=(), microphone=(), geolocation=()` |

`camera=(self), microphone=(self)` lets the page ask for the camera and microphone
(webcam and voice chat) and denies both to anything embedded; some hosts deny them by
default.

:::warning[Never set one policy on every path]
A browser enforces every `Content-Security-Policy` it receives, and many hosts combine
the headers of every rule a path matches. The game's policy on `/*` therefore reaches
`/dsh/` as well, and the agent pane does not start. Set each policy on its own paths.
:::

**Why isolation matters.** A page is cross-origin isolated (`crossOriginIsolated` is
`true`) only when it sends both of the first two headers. CLIENT mods need it: their
sandbox talks to the page through a `SharedArrayBuffer`, which browsers give only to an
isolated page. Without it the game still loads, players can sign in and play, and the
Studio agent still starts, but the CLIENT target is hidden, no grid's CLIENT halves run,
and the agent cannot try the CLIENT mods it drafts.

### The Content-Security-Policy

For a build that dials production (CrowdyJS `latest`), the game's policy is one line:

```text
default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' https://ck.prod.crowdedkingdoms.com wss://ck.prod.crowdedkingdoms.com https://*.prod.crowdedkingdoms.com wss://*.prod.crowdedkingdoms.com; worker-src 'self' blob:; frame-src 'self'; media-src 'self' blob:; manifest-src 'self'
```

- **`connect-src`** allows the API origin, over `https:` and `wss:`, and its tier
  wildcard, `*.prod.crowdedkingdoms.com`. The API hands a client to its app's datacenter
  and then to one API instance, each a host in that zone, and the world hub's ck-exec
  gateway is a `wss:` host there too; the wildcard is what lets those moves work. A
  build that dials another origin (a proxy of your own, say) must allow that origin as
  well.
- **`script-src 'self' 'wasm-unsafe-eval'`** runs your own scripts and lets the SDK
  instantiate WebAssembly. It allows no JavaScript `eval`.
- **`worker-src 'self' blob:`** admits the same-origin workers: Studio's language
  worker, the CLIENT-mod glue worker and the agent's worker.
- **`frame-src 'self'`** lets the page frame the agent pane, `/dsh/index.html`.

The Construct builds this policy in `security-headers.mjs`, and `npm run dev` and
`npm run preview` already send it.

## Paths with rules of their own

### `/dsh/`: the agent's harness

The agent pane frames `/dsh/index.html` (or wherever your embed's `webBase` points) from
your own origin. Every response under `/dsh/` gets the same headers as the rest of the
site, except the Content-Security-Policy, which is the harness's own:

```text
default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob: https://ck.prod.crowdedkingdoms.com wss://ck.prod.crowdedkingdoms.com https://*.prod.crowdedkingdoms.com wss://*.prod.crowdedkingdoms.com; worker-src 'self' blob:; frame-src 'self'; media-src 'self' blob:; manifest-src 'self'
```

The harness's worker compiles module bodies with `new Function` and its page runs a
module system of its own, so `/dsh/` allows `'unsafe-eval'` and the game's pages do not.
Keep the game's policy strict, and do not loosen this one further: the pane's iframe is
same-origin by design, so this policy is what holds it in.

Give `/dsh/` its own rule at whatever serves it. A host or edge function that stamps one
policy on every path sends the game's strict policy on `/dsh/` as well, and the pane
fails with a blank frame and CSP errors in the console.

Files under `/dsh/` that end in `.gz` must reach the browser with **no**
`Content-Encoding` header, because the harness's worker decompresses
`preview/vfs-image.tar.gz` itself. A host that adds `Content-Encoding: gzip` to `.gz`
files needs an exception for them, and only for them.

### Content types and the fallback page

- Serve `.wasm` as `application/wasm`, and JavaScript, worker scripts included, as
  `text/javascript`. Under `X-Content-Type-Options: nosniff` the browser refuses a script
  served as anything else.
- If the host answers paths it cannot find with `index.html` (a single-page-app
  fallback), apply that only to paths **without a file extension**. A missing `.js`,
  `.wasm` or `/dsh/` file should fail as a 404, not arrive as HTML.

### `construct-draft-sw.js`

A game built on The Construct has a service worker beside `index.html`. Studio's game
editor registers it, and only for the game's owner, to preview their uncommitted edits
in the running world. It answers nothing but its own `__draft/` addresses, so the
headers above still cover everything else, and it needs no header of its own. Serve it as
`text/javascript`, do not cache it for long (`Cache-Control: no-cache` is right), and
never let a fallback rewrite replace it with `index.html`.

### `grid-program.html`

A game that runs [JS grid programs](/crowdyjs/grid-programs) frames them in a sandbox
page that has no network at all. Serve `grid-program.html` with its own policy, the
Permissions-Policy in [the table above](#the-headers) and `Referrer-Policy: no-referrer`:

```text
default-src 'none'; base-uri 'none'; object-src 'none'; form-action 'none'; frame-ancestors 'self'; script-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; worker-src 'none'; frame-src 'none'
```

The sandbox's module requests arrive with `Origin: null`, which is what the shared
`Access-Control-Allow-Origin: null` answers. See
[JS grid programs](https://github.com/CrowdedKingdoms/the-construct/blob/prod/docs/MODDING.md#js-grid-programs)
in The Construct's modding guide.

## Sign-in

Players sign in through **hosted sign-in**. Your page sends them to Studio's
`/authorize` with a PKCE challenge, they sign in (or sign up) there, and Studio returns
them to your page with a one-time code, which your page exchanges for an app-scoped
token. Your page never sees a password. In CrowdyJS that is
`client.portal.signIn({ appId, redirectUri })`, then
`client.portal.handleSignInCallback()` when the player is back. See
[Portals & app-scoped tokens](/management-api/portals-and-app-tokens#hosted-sign-in-for-a-game-on-its-own-domain).

Two settings on your app in Studio, under **Settings > Sign-in & redirect URIs**, make
that work:

- **Redirect URIs.** Studio returns a player only to a page whose origin is listed here,
  and the same list is the API's CORS allow-list for your app: a browser page on any
  other origin gets no CORS headers. List every origin you serve the game from, and
  `http://localhost:5175` for the template's dev server (`npm run setup` adds that one).
  The API applies a change within ten seconds.
- **Launch URL.** The page players are sent to when they enter your app, and the page
  Studio's **Live code** opens.

## How to tell it worked

- Open the game and type `crossOriginIsolated` in the browser console. It must print
  `true`. The Construct checks the same thing when it starts, and shows a banner when it
  is not.
- Open Crowdy Studio in the game. The agent pane starts instead of showing a blank
  frame. (The pane appears only for a player the app allows; see
  [What a game needs for mods](/crowdyjs/crowdy-studio-embed#what-a-game-needs-for-mods).)
- Sign in. You come back to your page signed in, with no CORS errors in the console.
- Read the headers from a shell:

```bash
curl -sI https://play.example.com/ | grep -i -E '^(cross-origin|content-security-policy)'
curl -sI https://play.example.com/dsh/index.html | grep -i '^content-security-policy'
curl -sI -H 'Accept-Encoding: gzip, br' https://play.example.com/dsh/preview/vfs-image.tar.gz | grep -i '^content-encoding'
```

The first prints the isolation headers and the game's policy, the second prints the
harness's policy (the one with `'unsafe-eval'`), and the third prints nothing.

## Recipes

[The Construct's guide](https://github.com/CrowdedKingdoms/the-construct/blob/prod/docs/HOSTING.md#recipes)
gives the headers for Netlify, Vercel, Cloudflare Pages, AWS S3 with CloudFront, nginx
and Caddy. GitHub Pages cannot set response headers: the game runs there, but
`crossOriginIsolated` is false, so CLIENT mods are off.

For example, Netlify and Cloudflare Pages read a `_headers` file from the published
directory. Put it in `public/`, and the build copies it into `dist/`. The shared headers
go on `/*`, and each policy goes on exact paths, so no path gets two:

```text
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: credentialless
  Cross-Origin-Resource-Policy: same-origin
  Access-Control-Allow-Origin: null
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff

/
  Content-Security-Policy: <the game's policy>
  Permissions-Policy: camera=(self), microphone=(self)

/index.html
  Content-Security-Policy: <the game's policy>
  Permissions-Policy: camera=(self), microphone=(self)

/dsh/*
  Content-Security-Policy: <the harness's policy>
  Permissions-Policy: camera=(self), microphone=(self)

/grid-program.html
  Content-Security-Policy: <the sandbox's policy>
  Permissions-Policy: camera=(), microphone=(), geolocation=()

/construct-draft-sw.js
  Cache-Control: no-cache
```

Replace each placeholder with the matching line on this page, then fetch
`/dsh/index.html` and check that it carries the harness's policy alone.

## Local development and Live code

`npm run dev` serves the game at `http://localhost:5175` with the same headers as
production, and `npm run preview` serves the production build the same way, so you can
check isolation before you deploy.

Studio's **Live code**, on your app's page in Studio once a repository is bound, opens
the app's launch URL with the app and the project in the address, and the game opens
Crowdy Studio's game editor on that project. Point the launch URL at your deployment to
edit the running game. While you develop, point it at the template's dev server
instead: run `LIVE_DRAFT=1 npm run dev` in a clone of the bound repository, and set the
launch URL to `http://localhost:5175`. The checkout is then the draft, and Vite reloads
what the editor changes. See
[the game editor](/crowdyjs/agentic-crowdy-studio#the-game-editor-a-construct-games-repository).
