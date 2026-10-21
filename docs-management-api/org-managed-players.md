---
sidebar_position: 31
title: Org-managed players
---

# Org-managed players

If your studio already runs its own player accounts, your players should not have to type a
Crowded Kingdoms password inside your game. With **org-managed players**, your organization
vouches for its own players and Crowded Kingdoms gives each one its own app token. Your players
never see a Crowded Kingdoms sign-in, and Crowded Kingdoms holds no email address or password
for them.

There are two ways to vouch for a player, and both end in the same place:

| | Your server calls Crowded Kingdoms? | You hold |
|---|---|---|
| **Org token** | Yes: it calls `mintManagedPlayerToken` for each sign-in | an org token with the `players:mint` scope, on your server only |
| **Signed assertion** | No: your sign-in service only signs; the player's device calls `exchangeManagedPlayerAssertion` | a signing key whose public half you registered |

Either way, the result is an ordinary app-scoped gameplay token for one of your apps (see
[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)). The player's device
plays with it exactly as with any other: the Game API, realtime and replication do not treat it
differently.

## What a managed player is

- **One of your organization's players.** It is identified by the id your system knows it by
  (`externalId`, unique within your organization). The first sign-in creates it, and the same
  `externalId` is always the same player.
- **Plays only your organization's apps.** A token for another organization's app is refused.
- **Has no email, password, session or wallet.** It cannot sign in to Studio or call the
  session-only Management API fields, and the wallet fields answer `MANAGED_PLAYER_NOT_ALLOWED`.
- **Its mods are paid by your organization**, and only in apps where you switch that on (see
  [Mods](#mods-paid-by-your-organization)).

A Crowded Kingdoms operator turns org-managed players on for your organization and sets its
limits. Your org admins with the `manage_players` permission (any `admin` holds it) see them on
the **Players** tab of your organization in Studio, or read them with `orgManagedPlayerSettings`.

## Before the first sign-in: accept the addendum

An admin of your organization accepts the
[Org-Managed Players Addendum](https://crowdedkingdoms.com/managed-players-addendum.html) once,
in Studio: your organization's **Players** tab, **Terms**. It supplements the API Terms for the
players you sign in yourself: your organization provides the terms its players play under,
answers for their age and conduct, keeps its org tokens and signing keys secure, and pays for
everything they use.

Until your organization has accepted the current version, every sign-in (both options), every
refresh of a managed player's token and `provisionManagedPlayers` answer
`ORG_LEGAL_ACCEPTANCE_REQUIRED`. Neither the player nor your server can fix that: tell the
player sign-in is unavailable and do not retry. Reading, renaming, disabling, signing out and
deleting your players keep working.

Only an admin of your organization accepts, by your organization's own grant: Crowded Kingdoms
staff cannot accept it for you. Studio offers the acceptance to whoever may make it. In GraphQL,
`orgManagedPlayerSettings` reports `termsVersion`, `termsUrl`, `termsAccepted`, the latest
acceptance and `viewerMayAcceptTerms`, and `acceptManagedPlayerTerms(orgId, version)` records
it with an admin's session; a version that is not the current one answers `CONFLICT`. The SDKs
do not wrap the acceptance. If the addendum is revised in a way you must accept again, its
version changes, `termsAccepted` turns false, and sign-ins stop until an admin accepts the new
version.

## Option 1: an org token from your server

1. **Create an org token** in Studio (your organization's **API Credentials** tab), ticking
   **Sign players in** (`players:mint`), and optionally limiting it to some of your apps. Or
   call `createOrgToken(input: { orgId, scopes: ["players:mint"], appIds: [...] })` with an org
   admin's session. The secret starts with `cko_` and is shown once.
2. **Keep it on your server.** It signs in any of your players. The API refuses an org token
   sent with an `Origin` header, so a browser cannot use it even by accident, and the SDKs'
   `adoptAppToken` refuses one.
3. **After your own sign-in succeeds, mint the player's token** and send the result to the
   player's device:

```ts
// Your server
const res = await fetch('https://ck.prod.crowdedkingdoms.com/graphql', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: `Bearer ${process.env.CK_ORG_TOKEN}`,
  },
  body: JSON.stringify({
    query: `mutation ($i: MintManagedPlayerTokenInput!) {
      mintManagedPlayerToken(input: $i) {
        token gameTokenId appId expiresAt gameApiUrl gameApiWsUrl discoveryUrl launchUrl
      }
    }`,
    variables: {
      i: { appId: APP_ID, externalId: account.id, gamertag: account.displayName },
    },
  }),
});
const { data, errors } = await res.json();
// send data.mintManagedPlayerToken to the player's device
```

4. **On the device**, adopt the token and play:

```ts
import { createCrowdyClient } from '@crowdedkingdoms/crowdyjs';

const access = await fetch('/api/crowded-kingdoms/token').then((r) => r.json());
const game = createCrowdyClient({ httpUrl: access.gameApiUrl, wsUrl: access.gameApiWsUrl });
game.portal.adoptAppToken(access);
```

CrowdyCPP: `client.portal().adoptAppToken(response)`. CrowdyPy:
`client.set_app_token(client.portal.adopt_app_token(response))`.

`externalId` should be your own stable account id, not an email address: 1 to 256 characters,
no control characters. `gamertag` (at most 64 characters) is set when the player is created;
rename it later with `updateManagedPlayer`.

## Option 2: a signed assertion

Your sign-in service signs a short JSON Web Signature (a JWS) for the player, and the player's
device trades it for its app token. Your server never calls Crowded Kingdoms.

1. **Register the public key**, in Studio (your organization's **Players** tab) or with
   `registerOrgSigningKey` (an org admin's session, `manage_players`):

```graphql
mutation {
  registerOrgSigningKey(input: {
    orgId: "<your org id>"
    kid: "signin-2026-10"
    algorithm: "EdDSA"
    publicJwk: "{\"kty\":\"OKP\",\"crv\":\"Ed25519\",\"x\":\"...\"}"
    issuer: "https://signin.example.com"
  }) { keyId kid }
}
```

   `algorithm` is `EdDSA` (Ed25519), `ES256` (P-256) or `RS256` (RSA, 2048 bits or more).
   Register the **public** key only; a JWK with private members is refused. `appIds` limits the
   key to some of your apps, and `audience` replaces the default audience when your identity
   provider sets its own.

2. **Sign an assertion per sign-in.** The header names the `alg` and the `kid`; the claims are:

| Claim | Value |
|---|---|
| `iss` | the issuer you registered |
| `aud` | `ck:app:<appId>` (or the audience you registered) |
| `sub` | the player's id in your system (becomes its `externalId`) |
| `iat`, `exp` | issued-at and expiry, Unix seconds; `exp` at most 300 seconds after `iat` |
| `jti` | a fresh unique id: each assertion works once |
| `gamertag` | optional; used when the player is created |

```ts
// Your sign-in service (Node), with an Ed25519 key
import { sign } from 'node:crypto';

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = b64url(JSON.stringify({ alg: 'EdDSA', kid: 'signin-2026-10', typ: 'JWT' }));
const claims = b64url(JSON.stringify({
  iss: 'https://signin.example.com', aud: `ck:app:${APP_ID}`, sub: account.id,
  iat: now, exp: now + 120, jti: crypto.randomUUID(),
}));
const assertion = `${header}.${claims}.${b64url(sign(null, Buffer.from(`${header}.${claims}`), privateKey))}`;
```

   For `ES256`, sign with `sha256` and `dsaEncoding: 'ieee-p1363'` (the JWS form, not DER).

3. **On the device**, trade it:

```ts
const access = await game.portal.exchangeManagedPlayerAssertion({ appId: APP_ID, assertion });
```

   `exchangeManagedPlayerAssertion` needs no token. A refusal is `ASSERTION_REJECTED` with the
   failed check in `extensions.reason` (`assertionRejectedOf(err)?.reason` in CrowdyJS):
   `malformed`, `algorithm`, `unknown_key`, `app_scope`, `signature`, `issuer`, `audience`,
   `subject`, `expired`, `not_yet_valid`, `lifetime` or `replayed`. Resending the same
   assertion never succeeds; sign a new one.

## Sessions, refresh and signing out

Each sign-in lasts `sessionTtlSeconds` (default and maximum: your organization's settings,
24 hours and 7 days unless an operator changed them). Until then the device refreshes its app
token as usual (`refreshGameplayToken` in CrowdyJS, `refreshAppToken` in GraphQL); after it, the
refresh is refused and the device asks you for a new sign-in. A refresh is also refused, with
`ORG_LEGAL_ACCEPTANCE_REQUIRED`, while your organization has not accepted the current addendum.

To stop a player:

- `endManagedPlayerSessions(orgId, externalId)` signs it out everywhere now; it can sign in
  again.
- `updateManagedPlayer(input: { orgId, externalId, disabled: true })` signs it out and refuses
  its sign-ins until you enable it again.
- `deleteManagedPlayer(orgId, externalId)` removes it. The `externalId` is free again, so a
  later sign-in with it creates a new player.
- Revoking an org token with `revokeOrgToken(orgTokenId, endSessions: true)` also ends every
  session that token signed in.

## Administering your players

With an org admin's session (`manage_players`), or from your server with an org token holding
`players:manage`:

| Field | What it does |
|---|---|
| `managedPlayers(orgId, search, first, after)` | your players in creation order, 50 a page (at most 200); `search` matches the start of an `externalId` or a gamertag |
| `managedPlayer(orgId, externalId)` | one player, or null |
| `provisionManagedPlayers(input: { orgId, players })` | create up to 500 players ahead of their first sign-in; existing ones are left as they are |
| `updateManagedPlayer` | rename, disable or enable |
| `endManagedPlayerSessions`, `deleteManagedPlayer` | as above |

`orgManagedPlayerSettings`, `orgSigningKeys` and the key fields take an org admin's session.

**Before a launch, provision your players.** Creating a player is a write every Crowded Kingdoms
datacenter takes part in, so first sign-ins one at a time are slow in bulk;
`provisionManagedPlayers` creates up to 500 in one write.

## Mods paid by your organization

A managed player has no wallet, so its mods are your organization's to pay for, and only where
you allow it: an org admin with `manage_billing` switches it on per app (Studio: the app's
**Usage & Billing** tab; GraphQL: `setAppManagedPlayerMods(appId, enabled)`, read back as
`App.managedPlayerModsEnabled`).

- **On:** your managed players can make and run mods, save Crowdy Studio projects and use the
  Studio agent in that app. Their mods' compute, their project and library storage and their
  agent use are billed to your organization's wallet.
- **Off** (the default): all of that is refused with `MANAGED_PLAYER_NOT_ALLOWED`, and their
  running mods are switched off. Players with their own Crowded Kingdoms accounts are not
  affected; they pay for their own mods.

## Limits

| Limit | Default |
|---|---|
| Players per organization | 100,000 |
| Sign-ins per minute per organization (both options) | 600 |
| Sign-in length | 24 hours, at most 7 days |
| Assertion lifetime | at most 300 seconds |
| Assertion exchanges per client IP | 120 a minute |
| Players per `provisionManagedPlayers` call | 500 |

A Crowded Kingdoms operator can change your organization's first three. Over the player cap,
sign-ins of new players answer `MANAGED_PLAYER_LIMIT`.

## Errors

| `extensions.code` | When |
|---|---|
| `FEATURE_DISABLED` | Org-managed players are not available here. |
| `ORG_LEGAL_ACCEPTANCE_REQUIRED` | Your organization has not accepted the current Org-Managed Players Addendum; an admin of it does, in Studio. Sign-ins, refreshes and provisioning answer it. |
| `ORG_TOKEN_REQUIRED` | `mintManagedPlayerToken` was called without an org token. |
| `ORG_TOKEN_NOT_ALLOWED` | An org token was sent to a field it cannot call, or from a browser (an `Origin` header). |
| `FORBIDDEN` | Org-managed players are not switched on for your organization (an operator does that), the org token lacks the scope, or the app is another organization's. |
| `SCOPE_MISSING` | The app is outside the org token's app list. |
| `ASSERTION_REJECTED` | The assertion failed the check named in `extensions.reason`. 401. |
| `MANAGED_PLAYER_LIMIT` | Your organization is at its player cap. |
| `MANAGED_PLAYER_NOT_ALLOWED` | A managed player asked for a wallet, or for mods where your organization has not switched them on. |
| `ACCOUNT_BLOCKED` | The player is disabled. |

See [Error codes](/overview/error-codes) for every code.
