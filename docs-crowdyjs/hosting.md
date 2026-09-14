---
sidebar_position: 6
title: Hosting on Crowdy Games
---

# Hosting on Crowdy Games

CrowdyJS 17.1 wraps the platform's third-party hosting surface (ck-api v2.1) and
carries the one runtime piece a hosted game needs: the shell bridge. The concept
and the rules are in [Management API → Hosting on Crowdy Games](/management-api/hosting-on-crowdy-games);
this page is the SDK surface.

## `client.hosting`

| Method | Needs | Does |
|---|---|---|
| `game(slug)` | nothing (public) | The hosted game record, or `null`. |
| `listed()` | nothing (public) | LIVE and LISTED games — the lobby's list. |
| `mine()` | session | The hosted games you can manage. |
| `publishes(slug, limit?)` | session + `manage_apps` | Publish history, newest first. |
| `claim({ appId, slug? })` | session + `manage_apps` | Claim (or move) the slug; registers the shell page and the content origin as redirect URIs; sets `launchUrl`. |
| `beginPublish({ slug, files })` | session + `manage_apps` | Declare the manifest; one presigned `PUT` per file. |
| `completePublish(slug, publishId)` | session + `manage_apps` | Verify, promote, record LIVE, invalidate. |
| `abandonPublish(slug, publishId)` | session + `manage_apps` | Give up a staging publish. |
| `setEnabled(slug, enabled)` | session + `manage_apps` | Your own on/off switch. |
| `all()`, `setListing`, `takeDown` | operator | The operator's switches. |

Every mutation is **identity-session only**: a game's own app token is refused,
so a bundle can never publish a replacement for itself. Sign in from Node with
`client.auth.login` (a browser page cannot do this, by design).

## `publishDirectory` (Node)

```ts
import { createCrowdyClient } from '@crowdedkingdoms/crowdyjs';
import { publishDirectory } from '@crowdedkingdoms/crowdyjs/hosting';

const client = createCrowdyClient();
await client.auth.login({ email, password });
const game = await client.hosting.claim({ appId, slug: 'my-game' });
const result = await publishDirectory(client, {
  dir: 'dist',
  slug: game.slug,
  onFile: (path, ok, done, total) => console.log(`${done}/${total} ${path}${ok ? '' : ' FAILED'}`),
});
console.log(result.game.launchUrl);
```

It hashes every file, calls `beginPublish`, uploads with bounded concurrency and
a retry per file (`uploadPublishFiles`, exported from the root for browser
tools), and calls `completePublish`; a failed upload abandons the publish so
nothing is left half-staged. `manifestForDirectory(dir)` is the hashing step on
its own.

## `EmbeddedHost` — sign-in under the shell

A hosted game runs inside the first-party shell's iframe, on its own origin. Two
things about that change hosted sign-in, and the SDK handles both:

1. The frame cannot navigate the tab, and Studio refuses to be framed. So
   `portal.signIn` asks the shell to navigate (`crowdyjs:navigate`); the shell
   honours exactly the tier's Studio `/authorize`.
2. The `redirect_uri` is the shell's page, not the frame's. The shell tells the
   game its return URL in `crowdyjs:host-hello`; Studio sends the code back to
   the shell, which moves `?code=&state=` onto the iframe's `src`, and
   `portal.handleSignInCallback` runs exactly as it does self-hosted.

`createCrowdyClient` constructs the bridge in a browser (`client.embeddedHost`);
`portal.signIn` asks it with a bounded hello (1.5 s) and falls back to the
ordinary top-level flow when nobody answers — a self-hosted game, or one embedded
in somebody's blog, behaves as before. `createCrowdyClient({ embeddedHost: false })`
or `signIn({ embedded: false })` opts out; `portal.embeddedHostInfo()` tells you
whether a shell is present.

The bridge accepts a hello only from `window.parent`, only naming a return URL on
the hello's own https origin, and posts `navigate` only to that origin. The PKCE
verifier stays in your origin's `sessionStorage`; the shell never holds a token.

## Error codes

| Code | Meaning |
|---|---|
| `CONTENT_HOSTING_DISABLED` | The tier has no content CDN; self-host or publish elsewhere. |
| `HOSTED_SLUG_UNAVAILABLE` | Not a DNS label, reserved, or claimed by another app. |
| `HOSTED_MANIFEST_INVALID` | A path, type, size or count rule failed; the message lists each. |
| `HOSTED_PUBLISH_INCOMPLETE` | Objects missing or differing at completion. Upload and retry, or abandon. |
| `HOSTED_GAME_TAKEN_DOWN` | An operator took the game down. |
