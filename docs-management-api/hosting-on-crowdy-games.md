---
sidebar_position: 32
title: Hosting on Crowdy Games
---

# Hosting your game on Crowdy Games

You can host your browser game on **Crowdy Games**, the platform's public games
host, instead of running a static host yourself (ck-api v2.1, CrowdyJS 17.1).
Players reach it at

```
https://<games host>/<slug>/
```

and it runs from an origin of its own:

```
https://<slug>.<content host>
```

The two hosts are the tier's (production: `crowdy.games` and
`crowdedcontent.com`); the API returns both for your game
(`HostedGame.launchUrl`, `HostedGame.contentOrigin`), so nothing in your code
needs to spell them.

## The short version

From a checkout of [The Construct](https://github.com/CrowdedKingdoms/the-construct)
(or any game built on CrowdyJS):

```sh
CONSTRUCT_EMAIL=you@example.com CONSTRUCT_PASSWORD=... npm run publish
# -> Play it at: https://crowdy.games/<slug>/
```

That signs in with **your** account, claims a slug for your app, builds, and
uploads `dist/`. The URL works immediately. In Studio, the app's **Settings**
page shows the claim, the play URL and the publish history.

## What actually happens

Four GraphQL operations, all requiring an **identity session** with
`manage_apps` on the app (an app-scoped token is refused — a game's own bundle
can never publish a replacement for itself):

1. **`claimGameHosting(input: { appId, slug? })`** — claims the slug (default:
   your app's slug). Idempotent; a different slug *moves* the game. Registers
   `https://<games host>/<slug>/` and `https://<slug>.<content host>` as the
   app's redirect URIs (which is also the CORS allow-list) and sets the app's
   `launchUrl`.
2. **`beginGamePublish(input: { slug, files })`** — the full manifest of the
   built bundle: every file with its `path`, `size` and lower-case hex
   `sha256`. The manifest is validated as a whole (`HOSTED_MANIFEST_INVALID`
   names every problem) and one **presigned PUT URL per file** comes back,
   with the exact headers each upload must carry. S3 refuses a body whose
   digest differs from the header.
3. Upload every file (`PUT`, with those headers). Concurrency is yours.
4. **`completeGamePublish(slug, publishId)`** — verifies every stored object
   against the manifest (`HOSTED_PUBLISH_INCOMPLETE` names what is missing),
   promotes the staging area to the live prefix, removes objects the previous
   publish left behind, records the publish `LIVE` and invalidates the CDN.
   `abandonGamePublish` gives up a staging publish.

`@crowdedkingdoms/crowdyjs/hosting` exports `publishDirectory(client, { dir,
slug })`, which does steps 2–4 for a directory in Node; `client.hosting` wraps
each operation. See [CrowdyJS → Hosting](/crowdyjs/hosting).

## Slugs

The slug is your game's path on the games host **and** its host label on the
content domain, so it is a **DNS label**: lower-case letters, digits and
hyphens, 1–63 characters, not starting or ending with a hyphen. It is **global
on the tier**, claimed first-come. First-party game names and infrastructure
words are reserved. `HOSTED_SLUG_UNAVAILABLE` tells you which rule you hit;
pass another with `--slug`.

## What your bundle can rely on

The platform's edge serves your origin the same headers
[The Construct's `docs/HOSTING.md`](https://github.com/CrowdedKingdoms/the-construct/blob/prod/docs/HOSTING.md)
asks a self-hoster to serve, so a bundle that works self-hosted works here:

- `Cross-Origin-Opener-Policy: same-origin`,
  `Cross-Origin-Embedder-Policy: credentialless`, and the shell delegates the
  `cross-origin-isolated` feature — `crossOriginIsolated` is `true` inside the
  frame, so Crowdy Studio CLIENT mods run.
- A Content-Security-Policy whose `connect-src` is the tier's API zone (and
  nothing else), `script-src 'self' 'wasm-unsafe-eval'`, `frame-ancestors`
  the games host only. `/dsh/*` gets the relaxed harness policy with
  `frame-ancestors 'self'` plus the games host.
- `Permissions-Policy: camera=(self), microphone=(self)`, delegated by the
  shell.
- Content types are decided by the platform from the file extension;
  `index.html` is served `no-cache`, content-hashed assets `immutable`.

Your origin is yours: `localStorage`, IndexedDB, service workers and
`BroadcastChannel`s are per game.

## Sign-in under the shell

The page at `https://<games host>/<slug>/` is a first-party **shell**: a thin
chrome bar and a sandboxed iframe of your origin. Hosted sign-in is the flow
you already use (`portal.signIn` → Studio `/authorize` →
`portal.handleSignInCallback`); inside the shell CrowdyJS's `EmbeddedHost`
bridge makes two adjustments for you:

- your frame cannot navigate the tab (no `allow-top-navigation`), so the SDK
  asks the shell to navigate — and the shell honours exactly one destination,
  the tier's Studio `/authorize`;
- the `redirect_uri` is the shell page (your registered return leg); the shell
  relays the returned `?code=&state=` into your frame, where
  `handleSignInCallback` runs unchanged.

The PKCE verifier never leaves your origin and the shell never holds a token.
Nothing changes in your code.

## Listing, disabling, taking down

- **Publishing is self-serve and immediate.** Being **listed** in the Overworld
  lobby (and Studio's marketplace) is an operator's decision.
- You can **disable** your game (`setHostedGameEnabled`); players see a "disabled
  by its developer" page. Enable it again the same way.
- An operator can **take a game down**: the shell refuses it and you can
  neither publish nor re-enable until it is restored (`HOSTED_GAME_TAKEN_DOWN`).
  Contact `hello@crowdedkingdoms.com`.

## Quotas

2,000 files and 250 MB per publish, 60 MB per file, 10 publishes an hour per
app. A Construct 0.6 build is about 130 files and 23 MB. Abandoned staging
uploads expire on their own after two days.

## Which tier

You publish to the tier your SDK dials: a CrowdyJS `latest` install publishes to
production Crowdy Games; a `@dev` install to the dev tier. A tier that does not
host third-party games answers `CONTENT_HOSTING_DISABLED`.

## Reads for a page

Two fields are public: `hostedGame(slug)` (what the shell asks) and
`hostedGames` (the live, listed games — what the lobby shows). `myHostedGames`
and `hostedGamePublishes(slug)` need your session.
