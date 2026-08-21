---
sidebar_position: 2
title: SDK guide
slug: readme
---

# CrowdyJS SDK

Browser-first SDK for Crowded Kingdoms game clients. CrowdyJS wraps the
Management API identity surface and the Game API world / GraphQL UDP-proxy
surface behind typed clients. As of **v15**, `client.auth` signs in with
**`login` / `register`** (email + password), magic link, or social/OIDC, and
returns an **identity session token** for the Management API, while gameplay uses
a short-lived **app-scoped token** minted with `client.portal` — see
[Authentication: session vs app-scoped
tokens](#authentication-session-vs-app-scoped-tokens). Native UDP to Buddy servers
uses the [Replication API](/replication-api/intro) directly, not CrowdyJS.

CrowdyJS **12.0.0** includes the
[Agentic Crowdy Studio](agentic-crowdy-studio) development contract, deployed
in tracked dev release `v0.1.94`. The app-token
`client.crowdyStudioAgent` transport and integrated Ask/Build/Play dock provide
durable events, exact approvals, checkpoints, scoped Play leases, and reconnect
fencing. Access remains allowlisted; this is not production availability.

## Install

```bash
npm install @crowdedkingdoms/crowdyjs
```

CrowdyJS targets browsers by default and uses native `fetch`, `WebSocket`,
`crypto`, `btoa`, and `atob`. Node tools can use the SDK if they provide
browser-compatible globals for realtime connections.

## One endpoint, two token types

The SDK talks to **one** GraphQL base URL, configured as `httpUrl` (and `wsUrl` for
realtime). What separates the surfaces is the token, not the host:

| Sub-client | Token | Use |
|---|---|---|
| `client.auth`, `client.users`, `client.apps`, `client.platform` | identity session | Identity (`login`/`register`, `requestLoginLink`/`completeLoginLink`, `socialLoginStart`/`socialLoginComplete`, `availableLoginProviders`, `myIdentities`/`linkIdentity`/`unlinkIdentity`, `logout`, `me`, `updateGamertag`), app routing reads (`apps.routeFor`), and public platform config (`platform.config`). |
| `client.chunks`, `client.voxels`, `client.actors`, `client.avatars`, `client.teleport`, `client.state`, `client.host`, `client.serverStatus`, `client.channels`, `client.teams`, `client.gameModel`, `client.udp` | app-scoped | World data, avatars, channels & teams, game models (incl. [automations](automations) and [model-driven notifications](model-notifications)), the GraphQL UDP proxy subscription, and game-client bootstrap. `client.host` covers host election (`get` / `amIHost`) and `heartbeat` — see [Host discovery](/game-api/host-discovery). |

Each client has one `AuthState`, so you still build **two clients**: an identity client
holding the session token, and a per-game client holding that app's app-scoped token —
see [Authentication: session vs app-scoped tokens](#authentication-session-vs-app-scoped-tokens).

The two clients need not share a URL. An app lives in one datacenter, so `mintAppToken`
returns the `gameApiUrl` / `gameApiWsUrl` for that app, and the per-game client should
use them.

:::note[Upgrading from v13 or earlier]
`managementUrl`, `managementGraphqlEndpoint` and the `client.management` escape hatch
were removed when the separate management server was retired. Point `httpUrl` at the
API and delete the `managementUrl` line; use `client.graphql` where you used
`client.management`.
:::

### Full sub-client surface

As of v6 (completed in v6.1), CrowdyJS wraps the **full** public API
surface — every non-deprecated root field has a typed method, with Relay
`*Connection` cursor-pagination variants alongside the legacy offset lists. (v7
then made gameplay require an app-scoped token — see [Authentication: session vs
app-scoped tokens](#authentication-session-vs-app-scoped-tokens).) The surfaces
are namespaced by audience:

| Audience | Sub-clients | Notes |
|---|---|---|
| **Game-client** (browser-safe) | `auth`, `users`, `udp`, `world(...)`, `chunks`, `voxels`, `actors`, `avatars`, `state`, `teleport`, `host`, `channels`, `teams`, `gameModel`, `serverStatus`, `playerCompute`, `crowdyStudio`, `crowdyStudioAgent` | Safe to drive from an untrusted browser with the documented token and server policy. `auth`/`users` use the identity **session token**; world, Studio, agent, and realtime surfaces require an **app-scoped token**. Agent model access remains server-side and separately requires `use_studio_agent`. |
| **Studio-admin** (token whose user holds `manage_apps`) | `organizations`, `apps`, `appAccess`, `billing`, `payments`, `quotas`, `usage`, `sharedEnvironment`, `gameApps` ([grids](grids)) — also grouped under `client.admin.*` | Privileged org/app administration. Requires a user with the `manage_apps` permission (or an org token). Not end-user-safe — see the note below. Dedicated `environments` were removed in v13. |
| **Operator** (`is_operator`) | `client.operator` | Platform compute ceilings only. Infrastructure (change orders, secrets, releases) lives in the separate infra-control-plane service, not this SDK. |

The SDK never relaxes server-side authorization — exposing an operation just
gives you a typed wrapper; the caller still needs the right token and permission.

:::note[Studio-admin is about who you authenticate as, not where the code runs]
The studio-admin surfaces have exactly one extra gate: the caller must be a
logged-in user who holds `manage_apps` on the org. The management-surface
operations use the **identity session token** sign-in returns — there is no separate "admin
token" type. (The one Game API studio-admin surface, `gameApps` ([grids](grids)),
runs on the Game API and so needs an **app-scoped token** for the target app — a
studio admin can `mintAppToken` for their own app even without player
entitlement.) So you **can** drive them from a browser — for example your studio's
own admin tool, where an admin signs in — which is exactly how the Crowded
Kingdoms management UI works. "Not in an untrusted browser" is a
*credential-safety* rule:
don't embed a privileged admin (or org) token in the public game client you ship
to untrusted end users. A trusted admin context — a studio backend **or** an
admin-only / authenticated web app — is fine.
:::

### Dev tier example

For integration testing on the shared dev tier (current game env **`dev1`**), see **[Dev tier (client integration)](/management-ui/dev-tier)**. Minimal CrowdyJS config:

```ts
createCrowdyClient({
  httpUrl: 'https://api.dev.crowdedkingdoms.com/graphql',
  wsUrl: 'wss://api.dev.crowdedkingdoms.com/graphql',
  tokenStore: new BrowserLocalStorageTokenStore(),
});
```

This single client covers identity and routing reads. For gameplay you still mint an app-scoped token and drive the world surfaces from a per-game client — see [Authentication: session vs app-scoped tokens](#authentication-session-vs-app-scoped-tokens) and [Dev tier (client integration)](/management-ui/dev-tier).

Register at [https://app.dev.crowdedkingdoms.com/register](https://app.dev.crowdedkingdoms.com/register) — no shared admin account required.

**Tutorial:** [Build a collaborative canvas game](/build-a-game/intro) — step-by-step guide with live demo chapters using the config above.

## Authentication: session vs app-scoped tokens

CrowdyJS uses two kinds of token and **gameplay does not accept the session
token** (see [Portals & app-scoped tokens](/management-api/portals-and-app-tokens)):

- **Identity session token** — returned by any `client.auth` sign-in (`login`,
  `register`, `completeLoginLink`, or `socialLoginComplete`) and stored on the
  client automatically. A management-plane credential (account, studio admin) and
  the **only** thing that can mint app tokens. It is **rejected for gameplay** (the
  Game API and the realtime/UDP surface reject it).
- **App-scoped gameplay token** — short-lived (~30 min), confined to one app, and
  the Bearer for that app's Game API + realtime surface. Refresh or re-portal
  before it expires.

Sign-in uses `client.auth.login` / `client.auth.register`, or a magic link, or
social/OIDC. See [Sign-in with `client.auth`](#sign-in-with-clientauth) below.

`client.portal` wraps minting, the browser handoff, **and consent**:

- `portal.mintAppToken(appId)` — native / same-origin: mint directly from the
  session token. Returns an `AppTokenResponse` (`token`, `gameApiUrl`,
  `gameApiWsUrl`, `expiresAt`, …); it is **not** stored on the calling client.
- `portal.beginEntry(...)` → `portal.handleAuthorizeRequest()` →
  `portal.completeEntry()` — the OAuth2 Authorization-Code + PKCE flow for a game
  on a **different** origin (the session token never leaves the Overworld). For an
  **untrusted** app, `handleAuthorizeRequest` throws `PortalConsentRequiredError`
  until the user approves (pass `{ grantConsent: true }` once they do); **trusted**
  apps such as the Overworld (app 1) skip consent.
- `portal.getConsent(appId)`, `portal.authorizeApp(appId)`,
  `portal.myAuthorizedApps()`, `portal.revokeAppAuthorization(appId)` — the consent
  screen + "connected apps" management. App owners register client settings
  (redirect-URI allow-list, client type, launch URL) with
  `portal.setAppClientSettings({ appId, redirectUris, clientType, launchUrl })`.
- `portal.refresh()` — silent same-app token rotation before expiry.

Use the **two-client pattern**: an identity client on the Overworld/hub origin
holding the session token, and a separate per-game client holding the app token.
They never share a token store:

```ts
// Identity client (Overworld origin) — holds the session token.
const identity = createCrowdyClient({
  httpUrl: 'https://api.example.com/graphql',
  tokenStore: new BrowserLocalStorageTokenStore('crowdyjs:session'),
});
// Sign in (stores the session token). Email + password here; magic link and
// social are the other two paths and behave the same from this point on.
await identity.auth.login({ email: 'player@example.com', password });

// Native / same-origin: mint an app token, then build the per-game client.
const appToken = await identity.portal.mintAppToken(appId);
const game = createCrowdyClient({
  httpUrl: appToken.gameApiUrl!,
  wsUrl: appToken.gameApiWsUrl!,
  tokenStore: new BrowserLocalStorageTokenStore('crowdyjs:app:' + appId),
});
game.setToken(appToken.token);
// Drive gameplay through `game`; rotate with `game.portal.refresh()` before expiry.
```

See [Portals & app-scoped tokens](/management-api/portals-and-app-tokens) for the
full mint / PKCE / refresh narrative and [Game API →
Authentication](/game-api/authentication).

### Sign-in with `client.auth`

**`client.auth.login(email, password)` and `client.auth.register(...)` are the
primary path** as of 15.0.0. Magic link and social/OIDC remain. Each returns an
`AuthResponse` and stores the session token on the identity client.

> Until 15.0.0 this SDK was passwordless and these pages said `login` and
> `register` did **not exist**. They do. The `devLogin` bypass they also
> advertised has been removed from the SDK and from every tier.

```ts
// Magic link: request, then complete with the token from the emailed URL.
await identity.auth.requestLoginLink({
  email: 'player@example.com',
  redirectUri: 'https://app.example.com/auth/callback',
});
// The token arrives ONLY by email -- there is no way to read it out of the
// response. An automated caller should register an account instead.
await identity.auth.completeLoginLink(tokenFromLink);

// Social / OIDC: drive your buttons from the enabled providers.
const providers = await identity.auth.availableLoginProviders(); // e.g. ['google']
const { authorizeUrl, state } = await identity.auth.socialLoginStart(
  'google',
  'https://app.example.com/auth/google/callback',
);
window.location.assign(authorizeUrl); // …provider redirects back with ?code & ?state
await identity.auth.socialLoginComplete({ provider: 'google', code, state });

// Email + password: the path that needs neither an inbox nor a browser.
await identity.auth.register({ email: 'player@example.com', password }); // new account
await identity.auth.login({ email: 'player@example.com', password });    // existing one
```

An account can link multiple sign-in methods: `identity.auth.myIdentities()`,
`identity.auth.linkIdentity({ provider, code, state })`, and
`identity.auth.unlinkIdentity(identityId)` (which refuses to remove your last sign-in
method). See [Sign in (passwordless)](/management-api/authentication) for the full
model.

## Quick start

```ts
import {
  BrowserLocalStorageTokenStore,
  createCrowdyClient,
} from '@crowdedkingdoms/crowdyjs';

const apiUrl = 'https://api.example.com/graphql';
const appId = '1';

// Identity client: restore or sign in (passwordless) for the identity session token.
const identity = createCrowdyClient({
  httpUrl: apiUrl,
  tokenStore: new BrowserLocalStorageTokenStore('crowdyjs:session'),
});

await identity.session.restore();
if (!identity.session.getToken()) {
  // Sign in. Email + password shown; magic link and social are the other paths.
  // See #sign-in-with-clientauth-passwordless.
  await identity.auth.login({ email: 'player@example.com', password });
}

// Mint an app-scoped token, then build a per-game client that holds it.
const appToken = await identity.portal.mintAppToken(appId);

const game = createCrowdyClient({
  httpUrl: appToken.gameApiUrl!,
  wsUrl: appToken.gameApiWsUrl!,
  tokenStore: new BrowserLocalStorageTokenStore('crowdyjs:app:' + appId),
  realtime: {
    retryAttempts: 8,
    waitTimeoutMs: 5000,
  },
});
game.setToken(appToken.token);

// gameClientBootstrap needs the app-scoped token, so it runs on the per-game client.
const bootstrap = await game.serverStatus.gameClientBootstrap(appId);
console.log(bootstrap.versionInfo.minimumClientVersion);
```

Note that the per-game client uses the URLs the mint returned, not `apiUrl`: those name the datacenter holding the app. The identity client can stay on the shared origin.

## Game loop lifecycle

1. On the identity client, sign in with `identity.auth.login()` / `register()` / `completeLoginLink()` / `socialLoginComplete()`, or `identity.session.restore()`.
2. Mint an app-scoped token for the target app — `identity.portal.mintAppToken(appId)` (same-origin/native) or the PKCE portal flow for a different origin — and build a per-game client that holds it (`game.setToken(appToken.token)`). See [Authentication: session vs app-scoped tokens](#authentication-session-vs-app-scoped-tokens).
3. Subscribe to UDP proxy notifications with `game.udp.subscribe(handlers, appId)` (or `game.world(appId).subscribe(handlers)`). The `appId` is **required** — the Game API scopes each realtime session to one app.
4. Join a chunk by sending an initial actor update.
5. Send actor, voxel, text, audio, and client-event updates through `game.udp` or `game.world(appId)` helpers.
6. Call `game.udp.disconnect()` when leaving the world, then `game.close()` when disposing the client. Rotate the app token with `game.portal.refresh()` before it expires.

## Realtime notifications

`subscribe` takes the handlers **and a required `appId`**, and the session must be
opened with that app's **app-scoped token**: an identity session token is rejected
with `APP_TOKEN_REQUIRED`, and a token minted for a different app with
`APP_SCOPE_MISMATCH`. The Game API also fences `udpNotifications` by app and
rejects an app-agnostic subscription with a `RealtimeConnectionEvent`
(`code: 'APP_ID_REQUIRED'`); the SDK sends the app in the WebSocket
`connection_init` payload. Run one per-game client per app (each holding that
app's token) when a player is in multiple apps at once.

```ts
const appId = '1';

const unsubscribe = client.udp.subscribe(
  {
    actorUpdate: (event) => {
      console.log(event.uuid, event.state);
    },
    singleActorMessage: (event) => {
      // A direct actor-to-actor message addressed to you (payload is base64).
      console.log(event.uuid, event.payload);
    },
    genericError: (event) => {
      console.warn(event.sequenceNumber, event.errorCode);
    },
    connectionEvent: (event) => {
      // e.g. APP_ID_REQUIRED (no appId), APP_TOKEN_REQUIRED (session token used),
      // or APP_SCOPE_MISMATCH (token minted for a different app).
      console.warn(event.code, event.message);
    },
    error: (error) => {
      console.error(error.code, error.message);
    },
  },
  appId,
);

client.realtime.onStatus((status) => {
  console.log('realtime:', status);
});
```

`client.world(appId).subscribe(handlers)` is a convenience wrapper that passes
its `appId` for you.

The SDK uses the `graphql-transport-ws` protocol, reconnects with backoff, re-reads the current token before reconnecting, and resubscribes to the UDP notifications subscription. It does **not** rotate an expiring app token for you — call `game.portal.refresh()` before the token's `expiresAt` to keep the same-app session alive (see [Portals & app-scoped tokens](/management-api/portals-and-app-tokens)).

## Raw UDP sends

```ts
const response = await client.udp.sendActorUpdateAndWait({
  appId: '1',
  chunk: { x: '0', y: '0', z: '0' },
  uuid: '0123456789abcdef0123456789abcdef',
  state: 'AA==',
  distance: 8,
  decayRate: 1,
});

console.log(response.__typename, response.sequenceNumber);
```

The `AndWait` variants allocate a `sequenceNumber` when missing and wait for a matching notification or `GenericErrorResponse`.

To message a single actor directly (delivered only to that actor, not broadcast), use `sendSingleActorMessage`. It is fire-and-forget -- the sender gets no echo, so there is no `AndWait` variant:

```ts
await client.udp.sendSingleActorMessage({
  appId: '1',
  chunk: { x: '7', y: '1', z: '2' }, // the TARGET actor's current chunk
  targetUuid: '0123456789abcdef0123456789abcdef',
  payload: 'aGVsbG8=', // base64 payload
});
```

## Permissions

The realtime server always enforces permissions. A player can only act in your
world if they have **app access** (an entitlement / access tier) and the target
chunk is inside a **grid** where they hold the right key (`access`,
`update_voxel_data`, `use_voice_chat`). New apps are **open by default** — a
default tier and a world-spanning grant are created automatically, and giving a
player app access grants them everything everywhere — so basic play and building
work with no extra setup. Owners add restrictions (safe zones, plot ownership) via
the Game API.

When a player lacks permission, the server replies with a `GenericErrorResponse`
(an `UNAUTHORIZED` error code) rather than delivering the action; your
`genericError` handler (and any `*AndWait` promise rejection) surfaces it:

```ts
client.udp.subscribe(
  {
    genericError: (e) => {
      if (e.errorCode === 7 /* UNAUTHORIZED */) {
        // player isn't entitled / lacks grid permission for that chunk
      }
    },
  },
  appId,
);
```

See **[Game API → Permissions overview](/game-api/permissions)** for tiers,
grids, and how to grant or restrict access.

## World helpers

```ts
const world = client.world('1');
const actor = world.actor();

await actor.join({ x: '0', y: '0', z: '0' });
await actor.sendState('AA==');
await actor.sendText('hello nearby players');

// Direct message to one other actor (supply its UUID + current chunk):
await actor.sendToActor('0123456789abcdef0123456789abcdef', 'aGVsbG8=', {
  x: '7',
  y: '1',
  z: '2',
});
```

## Errors

- `CrowdyHttpError`
- `CrowdyGraphQLError`
- `CrowdyNetworkError`
- `CrowdyTimeoutError`
- `CrowdyRealtimeError`
- `CrowdyProtocolError`
- `PortalConsentRequiredError` — thrown by `client.portal.handleAuthorizeRequest` when an **untrusted** app needs the user's consent before a portal code can be minted. It carries `appId` and `appName`; show a consent screen, then retry with `{ grantConsent: true }`.

`CrowdyGraphQLError` preserves GraphQL errors, including `path` and `extensions.code`.

Driving the Game API or realtime surface with an identity session token instead of an app-scoped token fails with the realtime `RealtimeConnectionEvent` codes `APP_TOKEN_REQUIRED` / `APP_SCOPE_MISMATCH`; an app token whose TTL elapsed mid-session yields the `UdpErrorCode` `TOKEN_EXPIRED`. Minting a portal code for an untrusted app without consent surfaces as `PortalConsentRequiredError` (or a `FORBIDDEN`/`CONSENT_REQUIRED` GraphQL error when calling the API directly). See [Error codes](/overview/error-codes).

## Low-level GraphQL access

```ts
import { VersionInfoDocument } from '@crowdedkingdoms/crowdyjs/generated';

const data = await client.graphql.request(VersionInfoDocument);
```

Prefer the typed sub-clients for everyday use — including the studio-admin
surfaces (`client.organizations`, `client.billing`, `client.quotas`,
`client.environments`, …, grouped under `client.admin.*`) and `client.operator`.
The escape hatch above is only for brand-new server fields not yet wrapped. See
the [Management API schema reference](/management-api/reference/graphql-overview)
for the underlying operations.

## Schema reference

Generated operation types ship with the npm package. Platform GraphQL shapes are documented under **[CrowdyJS GraphQL reference](/crowdyjs/reference/graphql-overview)** and the Management / Game API schema tabs.
