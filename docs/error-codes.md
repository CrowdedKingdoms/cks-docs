---
sidebar_position: 20
title: Error codes
---

# Error codes

A single reference for every error an integrator can receive, with remediation. There
are two channels: **GraphQL errors** (Management API and Game API) and **realtime/UDP
errors** (the Game API UDP-proxy and the native Replication API).

## GraphQL errors

GraphQL responses carry errors in the top-level `errors` array. Each entry has a
`message`, a `path`, and an `extensions` object you can branch on programmatically. Beyond
`code`, errors carry an `extensions.remediation` hint and — for permission failures — an
`extensions.requiredPermission`:

```json
{
  "errors": [
    {
      "message": "Missing org permission 'manage_billing'",
      "path": ["setAppBudget"],
      "extensions": {
        "code": "FORBIDDEN",
        "httpStatus": 403,
        "requiredPermission": "manage_billing",
        "remediation": "Your token lacks the permission this operation requires. The field description (and its @requiresPermission directive) names the required permission; use a token/role that holds it."
      }
    }
  ],
  "data": null
}
```

| `extensions.code` | Meaning | Remediation |
|---|---|---|
| `UNAUTHENTICATED` | No bearer token, or it is invalid/expired. | For Management API calls, sign in again (password, magic link, or social) for the **session token** — see [Sign in](/management-api/authentication). For the **Game API + realtime subscriptions**, send an **app-scoped token** (`mintAppToken` / portal flow) as the Bearer (and in the ws `connection_init` payload) — the session token is rejected there. |
| `FORBIDDEN` | Authenticated, but the token lacks the required permission for this field. | Each operation's description and its `@requiresPermission` directive name the permission; `extensions.requiredPermission` carries the key. Use a token/role that holds it. |
| `SCOPE_MISSING` | The token is scoped to a different org/app than the request targets. | Use a token minted for the requested org/app, or a full-scope org token. |
| `BAD_USER_INPUT` | An argument failed validation (wrong type, out of range, missing required field). | Check the argument descriptions in the SDL; `BigInt` must be a string, enums must be exact names. |
| `BAD_REQUEST` | The request was rejected by the resolver (e.g. a disabled feature, a precondition not met). | Read `message`; it states the precondition. |
| `GRAPHQL_VALIDATION_FAILED` | The query/mutation document is invalid against the schema. | Validate against the [published SDL](pathname:///schema/management-api.graphql) or introspection. |
| `NOT_FOUND` | The referenced entity does not exist or is not visible to you. | Verify the ID and that your token can see it. |
| `CONFLICT` | The request conflicts with current state (incl. an idempotency key still processing). | Refetch and retry if appropriate. |
| `IDEMPOTENCY_CONFLICT` | An `idempotencyKey` was reused with **different** request parameters. | Use a new key, or resend the byte-identical request to replay the first result. See [pagination/idempotency notes](/overview/for-ai-agents#agent-gotchas). |
| `EMAIL_ALREADY_REGISTERED` | `register` was called for an address that already has an account. The password was attached pending email confirmation and **no session was issued**. | Routine, not a fault. Have the user follow the emailed link, or sign in with their existing method. Do not retry the registration. |
| `PASSWORD_ALREADY_SET` | `setInitialPassword` on an account that already has a password. | Use `changePassword` (which verifies the current one), or `requestPasswordReset`. The session is valid — do not sign the user out. |
| `PASSWORD_NOT_SET` | `changePassword` on an account with no password to change. | Use `setInitialPassword`, which needs only the session. The session is valid — do not sign the user out. |
| `PASSWORD_PWNED` | `register` or `setInitialPassword` used a password that appears in a public breach list (Have I Been Pwned). 403. | Choose a different password. The server sends only a SHA-1 prefix (k-anonymity); the password never leaves the API. A HIBP outage fails open so registration is not blocked. |
| `HOSTED_SIGN_IN_REQUIRED` | A direct sign-in mutation (`login`, `register`, magic link, social, reset…) was called from a browser origin that is not first-party (Studio is the only first-party origin). 403. | Use hosted sign-in: `client.portal.signIn({ appId, redirectUri })` then `client.portal.handleSignInCallback()`; register your origin under the app's redirect URIs in Studio. Non-browser clients (no `Origin` header) are unaffected. |
| `LEGAL_ACCEPTANCE_REQUIRED` | The player has not stored the documents now required, so `mintAppToken`, `createPortalAuthorizationCode` and `refreshAppToken` issue no gameplay token: the platform's (`playerLegalDocuments`; until Crowded Kingdoms opens to players 13 and over, the Game Terms, API Terms, SDK Developer Terms, Free Tier and Billing Basis and Overworld Privacy Policy, with the age-of-majority attestation) or the app's own (`appRequiredDocuments`). From Game API v2.60.0, `extensions.missingDocuments` lists them as `[{ documentId, version, appId }]`, `appId` null for a platform document. Also a browser `register` without `acceptLegal` (and, until the opening, `attestAgeOfMajority`) true, before any account exists; and, from the opening, creating or administering an organization before the developer documents are accepted. 403. ck-api v2.35.0. | Show the missing documents, then record them with `recordPlayerConsents(acceptLegal: true, appId)` and the session token (with `attestAgeOfMajority: true` until the opening); a developer uses `recordDeveloperConsents`. A browser game sends the player back through hosted sign-in. Retrying cannot succeed. See [Legal documents](/management-api/legal-documents). |
| `AGE_REQUIRED` | The player's age is not known: a gameplay token for an account with no age once Crowded Kingdoms has opened to players 13 and over (until then such an account gets `LEGAL_ACCEPTANCE_REQUIRED`), a browser `register` without `birthDate` from that opening, or a managed player signed in without `ageYears` from it. Also a developer with no age, for the developer documents and organizations. 403. Game API v2.60.0. | Ask the player's birth date and country (and, under 18, whether a parent or guardian agreed) as [the age screen](/management-api/age-and-territory#the-age-screen) describes, then `recordPlayerAge` with the session token. An organization signs its managed player in with `ageYears` and `country`. Do not retry the mint until then. |
| `AGE_REQUIREMENT_NOT_MET` | The player is under 13, or younger than the strictest of the platform's minimum (18 until the opening, then 13), the app's (`minPlayerAge`) and their country's. At sign-up, at every mint and refresh, and at a managed player's sign-in. Also a developer under 18, for the developer documents and organizations. 403. Game API v2.60.0. It carries `extensions.minimumAge` and `extensions.ageBracket` for now; both are being removed, so that no refusal names an age. | Tell the player they cannot play this game, naming no age, and do not show either extension. Do not retry, and do not offer to change the date. See [Age, country and who may play](/management-api/age-and-territory). |
| `TERRITORY_NOT_SUPPORTED` | Crowded Kingdoms does not offer its services in the player's country (`extensions.country`): the one they gave, the one their connection comes from, or the one their organization asserted. At sign-up, at every mint and refresh, and at a managed player's sign-in, for every player, adults included. 403. Game API v2.60.0. `territoryPolicies` lists the countries. | Tell the player Crowded Kingdoms is not available where they are. Do not retry. See [Countries](/management-api/age-and-territory#countries). |
| `ACCESS_REVOKED` | The app revoked this player's access (`revokeAppAccess`), so `mintAppToken`, `refreshAppToken` and `exchangePortalCode` (hosted sign-in) issue no gameplay token for it. 403. ck-api v2.40. Since the release after v2.43.1 the player's live sessions in the app end too, and their other calls into the app answer this code (see [Revoking and suspending](/management-api/game-setup#revoking-suspending-and-banning)). | Tell the player they no longer have access to this game. Do not retry, and do not offer a purchase: the studio decided. |
| `ACCESS_SUSPENDED` | The app suspended this player's access until a time (`suspendAppAccess`, or the app's own server code). `extensions.suspendedUntil` (ISO-8601) says when it lifts. 403. ck-api v2.40. Since the release after v2.43.1 it is also the answer to the player's other calls into the app while it runs. | Tell the player when they can return. Signing in works again by itself at `suspendedUntil`. |
| `ACCESS_NOT_GRANTED` | The player holds no access to an app that has no free default tier and has granted them none (or their grant expired, or the app is archived). 403. ck-api v2.40. | Show how your game grants access. Studio admins of the app may mint without access. |
| `ACCOUNT_BLOCKED` | A Crowded Kingdoms platform operator blocked this account, on every app. Every request it makes is refused with this code, and so is signing in (after the password check). `extensions.blockedUntil` (ISO-8601) says when a timed block lapses; it is null for a block with no end. 403. Game API v2.44.0. | Tell the player their account is blocked, and when it lifts if `blockedUntil` is set. Do not retry, and do not sign them out and in again: it will not help. They contact support otherwise. |
| `GROUP_MEMBER_BANNED` | The channel or team banned this user (`banChannelMember`, `banTeamMember`), so joining it, requesting to join and being added or invited are refused until a manager lifts the ban. 403. The Game API release after v2.43.1. | Tell the player they cannot join. Only someone with the group's `manage_members` permission can lift it (`unbanChannelMember`, `unbanTeamMember`); do not retry. |
| `ACTOR_EXISTS` | `createActor` was given a uuid this app already has; a uuid is unique within an app. `extensions.ownedByCaller` says whether the existing actor is yours. 409. ck-api v2.40. | If `ownedByCaller` is true, keep using that actor (`updateActor` / `updateActorState`); otherwise pick another uuid. |
| `APP_PAUSED` | The app's runtime gate is not active (its organization has no funds, it reached a spend cap, its subscription lapsed, or it is over its compute budget), so the realtime proxy will not connect it, and `execConnect` refuses it the same way. `extensions.reason` is `insufficient_funds`, `spend_cap`, `subscription_lapsed` or `compute_budget`. 403. ck-api v2.40; `execConnect` uses this code instead of `FORBIDDEN` for a paused app. | Tell the player this world is paused. Signing in still works and reports `runtimeGate`; it resumes within a minute of the owner fixing the cause. See [what "access denied" means](/management-api/shared-environment#what-access-denied-means). |
| `APP_DISABLED` | `execConnect` was asked for an app whose server code is switched off entirely. 403. A bad token stays `FORBIDDEN`. | It stays refused until a developer turns the app on (`execSetEnabled`). |
| `TYPE_DISABLED` | `execConnect` was asked to place a node type that is switched off. The message names the type. 403. | It stays refused until a developer turns that type on. |
| `TIER_ACCESS_REQUIRED` | The request reached one of Crowded Kingdoms' internal environments (`dev` or `test`) with an account that may not use it. They are open to Crowded Kingdoms staff and approved partners only: a new account outside that list is refused before it exists, and an existing one may sign in, read `me` and `myTierAccess`, and sign out, nothing else. An org token is refused this way only when none of its organization's members may use the environment; an organization whose managed players are switched off gets `FORBIDDEN` instead. 403. Production never returns it. | Build against production ([Connecting game clients](/management-ui/client-integration)). If the message says the email is not verified, follow the confirmation link (`resendConfirmationEmail` sends a new one). Do not retry. |
| `FEATURE_DISABLED` | The feature is not available on this environment. 403. | Do not retry. |
| `ORG_TOKEN_REQUIRED` | `mintManagedPlayerToken` was called without an org token. 403. | Call it from your organization's server with an org token holding `players:mint`. See [Org-managed players](/management-api/org-managed-players). |
| `ORG_TOKEN_NOT_ALLOWED` | An org token was sent to a field outside the managed-player fields, or from a browser (the request carries an `Origin` header). 403. | Keep org tokens on your server and use them only for the managed-player fields; a player's device uses the app token you mint for it. |
| `ASSERTION_REJECTED` | `exchangeManagedPlayerAssertion` refused your organization's signed assertion; `extensions.reason` names the check (`malformed`, `algorithm`, `unknown_key`, `app_scope`, `signature`, `issuer`, `audience`, `subject`, `expired`, `not_yet_valid`, `lifetime`, `replayed`). 401. | Sign a new assertion (never resend one) with a registered key: `iss` and `aud` as registered, `exp` at most 300 seconds after `iat`, a fresh `jti`. See [Org-managed players](/management-api/org-managed-players#option-2-a-signed-assertion). |
| `MINECRAFT_VERIFICATION_FAILED` | `signInWithMinecraft`, open only to Crowded Kingdoms' own apps, could not confirm the Minecraft account: `extensions.reason` is `malformed`, `forged`, `expired`, `not_joined` or `replayed`. 401. Game API v2.60.0. | Ask `minecraftChallenge` for a new server id, join it through Mojang's session service as the account signed in to the game, and sign in within two minutes. Never resend a server id. |
| `MINECRAFT_VERIFICATION_UNAVAILABLE` | Mojang's session service did not answer, so the Minecraft account could not be confirmed and the player is not signed in. 503, `extensions.retryable`. Game API v2.60.0. | Wait a few seconds, then start again from `minecraftChallenge`. |
| `MANAGED_PLAYER_LIMIT` | Your organization is at its org-managed player cap. 403. | Delete players you no longer need, or ask Crowded Kingdoms to raise the cap. |
| `ORG_LEGAL_ACCEPTANCE_REQUIRED` | The player's organization has not accepted the current Org-Managed Players Addendum, so it signs no player in and their tokens do not refresh. 403. | Neither the player nor the organization's server can fix it: an admin of the organization accepts it in Studio (the organization's Players tab). Do not retry. |
| `MANAGED_PLAYER_NOT_ALLOWED` | An org-managed player asked for something it cannot have: a wallet, or mods, Crowdy Studio writes or the Studio agent in an app whose organization has not switched its managed players' mods on. 403. | The organization switches mods on per app (`setAppManagedPlayerMods`, `manage_billing`) and pays for them; a managed player never has a wallet. |
| `LEGAL_HOLD` | `deleteManagedPlayer` was asked to delete a player that a legal hold covers (one on the player, or on its organization). Since Game API v2.60.0 an open or escalated safety report about the player sets one first. 409. | Disable the player instead (`updateManagedPlayer` with `disabled: true`): that ends its access and keeps its data. A Crowded Kingdoms operator releases the hold, and resolving the report releases a report's. Do not retry. |
| `SAFETY_LOG_REQUIRED` | An app that admits players under 18 (its minimum age is under 18) must keep its safety log, the input log, on: `updateApp` was asked to turn `replayLoggingEnabled` off there, or a player under 18 asked for a token in an app whose safety log is off. 403. Game API v2.60.0. | A player: tell them the game cannot admit them yet. An admin: keep replay logging on, or raise the app's `minPlayerAge` to 18 first. Do not retry. See [the safety log](/replication-api/input-logging#the-safety-log). |
| `PARENTAL_CONSENT_UNAVAILABLE` | `requestParentalConsent` on a deployment where the parental consent service (Kids Web Services) is not configured, so voice and video stay off for players under 18. 503. Game API v2.60.0. | Tell the player it is not available. Do not retry. |
| `SOCIAL_LIMIT_REACHED` | The player has as many contacts (1,000), waiting contact requests (100) or blocks (1,000) in the app as allowed; the message names which. 409. Game API v2.60.0. | Remove some (`removeContact`, `unblockPlayer`), then try again. See [Voice, video, contacts and blocks](/game-api/communication). |
| `INPUT_LOG_FUNDS_NEEDED` | `updateApp` was asked to turn replay logging on (`replayLoggingEnabled: true`) and the organization's wallet cannot spend the projected cost of keeping one retention period of the app's recent traffic; stored input logs are billed and have no free allowance. `extensions.requiredMicrousd` and `spendableMicrousd` say how much is needed and how much can be spent. A billing-exempt organization is not refused. 402. | Fund the organization wallet to at least `requiredMicrousd`, then turn it on again. See [Input logging](/replication-api/input-logging#turn-it-on). |
| `INPUT_LOG_UNAVAILABLE` | `inputLogSessions` or `inputLogMessages` was called on a deployment where input logging is not available, or that cannot read its log. 503. | Nothing to retry against that deployment. (A Game API before the release after v2.40.2 also answered this, retryable, when it could not read the log right now; that is `INPUT_LOG_TEMPORARILY_UNAVAILABLE` now.) See [Input logging](/replication-api/input-logging). |
| `INPUT_LOG_TEMPORARILY_UNAVAILABLE` | `inputLogMessages` could not read the log just now: its readers were busy, or the store was briefly unreachable. `extensions.retryable` is true. 503. | Retry shortly with the same cursor; nothing is lost. `inputLogSessions` does not read the log and still answers. See [Input logging](/replication-api/input-logging#read-it). |
| `INPUT_LOG_RATE_LIMITED` | An earlier `inputLogMessages` read was still running when this one's wait ran out: each server runs one read per user, and two per app and per organization, at a time, and a read over that share waits for an earlier one within its few-second deadline first. `extensions.retryable` is true. 429. | Retry shortly with the same cursor. Read one session per request: an operation may select `inputLogMessages` only once. See [Input logging](/replication-api/input-logging#read-it). |
| `INPUT_LOG_READ_ABORTED` | An `inputLogMessages` read stopped because its HTTP request closed before the answer was written (the client aborted it). 499. | Nothing to handle: the request has already ended with the client's own abort. It counts as a client error in usage figures, not a server fault. |
| `CSRF_REQUIRED` | The request authenticated with the Studio `ck_session` cookie but did not send `X-CSRF-Token`. 403. Bearer-only clients never see this. | Send the readable `ck_csrf` cookie value as `X-CSRF-Token`, or send `Authorization: Bearer` instead. |
| `CSRF_MISMATCH` | `X-CSRF-Token` does not match any presented `ck_csrf`. 403. Duplicate cookies (parent-zone leftover + tier cookie) are accepted when the header matches either one (ck-api v1.98.0). | Refresh to pick up a new CSRF cookie, or send `Authorization: Bearer`. |
| `COOKIE_AUTH_ORIGIN_REFUSED` | A cookie session was offered from a browser origin that is not first-party. 403. | From a customer origin, use a Bearer app token from hosted `/authorize`. Do not send `ck_session`. |
| `INVALID_CURRENT_PASSWORD` | `changePassword` was given the wrong current password. | Ask again, or offer `requestPasswordReset`. The session is valid — do not sign the user out. |
| `RATE_LIMITED` | A rate/usage limit was exceeded. | Back off and retry with exponential backoff. |
| `CONTENT_HOSTING_DISABLED` | A hosting mutation (`claimGameHosting`, `beginGamePublish`, `completeGamePublish`, `abandonGamePublish`, `setHostedGameEnabled`) was called. Crowdy Games hosting was retired on 2026-10-29, and every environment answers this code. 503. | Do not retry. Host the build yourself: see [Host your game](/build-a-game/host-your-game). |
| `HOSTED_SLUG_UNAVAILABLE` | **Retired** with Crowdy Games hosting on 2026-10-29; the hosting API answers `CONTENT_HOSTING_DISABLED` instead. It meant the hosting slug was not a DNS label, was reserved, or was claimed by another app. 409. | — |
| `HOSTED_MANIFEST_INVALID` | **Retired** with Crowdy Games hosting on 2026-10-29. It meant the publish manifest was refused. 400. | — |
| `HOSTED_PUBLISH_INCOMPLETE` | **Retired** with Crowdy Games hosting on 2026-10-29. It meant `completeGamePublish` found staged files missing or different from the manifest. 409. | — |
| `HOSTED_GAME_TAKEN_DOWN` | **Retired** with Crowdy Games hosting on 2026-10-29. It meant an operator had taken the hosted game down. 403. | — |
| `WRONG_DATACENTER` | This app is served from another datacenter. `extensions.gameApiUrl` names where. | Reconnect to `extensions.gameApiUrl` and retry. See [Datacenter routing](/game-api/datacenter-routing). |
| `APP_UNAVAILABLE` | The app's datacenter has no instance able to serve. **No endpoint is named, on purpose** — do not fall back to a cached one, it is in the datacenter that is down. | Retry. See [Datacenter routing](/game-api/datacenter-routing). |
| `NO_LOCAL_BUDDY` | You are **on** the app's own datacenter and it has no healthy UDP server. **No endpoint is named, because there is nowhere else to go** — a Buddy elsewhere would make every gameplay write cross a WAN, invisibly, because each write still succeeds. If you called `serverWithLeastClients` on the *wrong* datacenter you get `WRONG_DATACENTER` instead, with an endpoint to move to. | Retry, and report it: this one needs an operator. |
| `PLATFORM_BUSY` | We could not **start** the work in time. 503, with `blame: PLATFORM` and `retryable: true`. Your request did not run. | Retry with backoff; see [below](#platform_busy-we-could-not-start-the-work). |
| `INTERNAL_SERVER_ERROR` | Unexpected server error. | Safe to retry idempotent reads; do **not** blind-retry non-idempotent mutations (send an `idempotencyKey` instead). |

:::caution[Codes changed in ck-api v1.60.0 — check the tier before you branch]

Until v1.60.0, **only four HTTP statuses reached you as a distinct code** (400, 401,
403, 422). Everything else — every `NOT_FOUND`, every `CONFLICT` — arrived as
`INTERNAL_SERVER_ERROR` with the real status in `extensions.httpStatus`. That is fixed,
and the four password/registration codes above are new in the same release.

Two consequences if you are writing a client today:

- **Against an older tier, branch on `extensions.httpStatus`**, which was always correct,
  or on the message. `extensions.code` was not usable for these.
- **The three `changePassword`/`setInitialPassword` refusals used to arrive as
  `UNAUTHENTICATED`**, which is also what an expired session looks like. A client that
  signs the user out on `UNAUTHENTICATED` was signing them out for mistyping a password.
  None of the new codes means the session is bad.

`CROWDY_STUDIO_REVISION_CONFLICT` is a related trap that was never a mapping bug: it is
its own code, **not** `CONFLICT` with a detail message. Branch on the exact string.
:::

**`requiredPermission` and the directive.** Permission-gated fields carry a machine-readable
`@requiresPermission(scope:, permission:, scopeArg:)` directive in the SDL/introspection, so
an agent can plan calls without parsing prose. On a `FORBIDDEN`/`SCOPE_MISSING` error,
`extensions.requiredPermission` echoes the missing key.

**Idempotency.** Economy-sensitive and destructive mutations accept an optional
`idempotencyKey` (on the `input` object or as a top-level argument). Replaying with the same
key and identical parameters returns the first result instead of re-applying; a different
payload under the same key returns `IDEMPOTENCY_CONFLICT`. Keys expire after 24h.

**Partial failures:** GraphQL can return both `data` and `errors` in one response — a
nullable field may resolve to `null` with a corresponding `errors` entry while the rest
of `data` is populated. Always inspect `errors` even when `data` is present.

### `PLATFORM_BUSY`: we could not start the work

Any operation can be refused with `PLATFORM_BUSY` when the API could not get a database
connection in time. The error carries **`blame: PLATFORM`** and **`retryable: true`**, the
HTTP status is 503, and the message is "The service is busy. Please try again in a
moment." It says nothing about your request or your code: the operation did not run.

```json
{
  "errors": [
    {
      "message": "The service is busy. Please try again in a moment.",
      "path": ["gameClientBootstrap"],
      "extensions": {
        "code": "PLATFORM_BUSY",
        "blame": "PLATFORM",
        "retryable": true,
        "remediation": "Ours, not the app's: the work could not be STARTED in time."
      }
    }
  ],
  "data": null
}
```

A pool timeout while the API looks up the caller's token is this code too. That is not
`UNAUTHENTICATED`: the token was not rejected, so do not sign the player out.

In CrowdyJS, an error that carries `blame` arrives as `CrowdyUserCodeFaultError` (a
subclass of `CrowdyGraphQLError`, so existing handlers keep working), and
`playerFaultOf(error)` returns its `{ code, blame, retryable }`.

#### Retrying `PLATFORM_BUSY`

`PLATFORM_BUSY` means we were busy. It says nothing about your request or your code,
and the same call will usually succeed a moment later. Retry it:

1. If `extensions.retryAfterMs` is present, wait that long.
2. Otherwise wait about 100–200 ms, with random jitter so many clients do not retry
   in step.
3. Double the wait on each further `PLATFORM_BUSY`, and stop after three retries.
   Show the player the message, or your own wording, only after that.
4. Send the **same** request id on every attempt. A game that tags hits with a
   request id and rejects duplicates, as a damage handler should, then applies a
   retried hit at most once.

Retry only when `retryable` is true. `RATE_LIMITED` is not this: it means the caller is
sending too often, so slow down rather than retry sooner.

### Code on ck-exec

Code your app runs on [ck-exec](/exec/intro) does not answer through GraphQL errors: a call
to a hub or spoke gets a status in the gateway's reply (`AppError`, `Busy`, `Denied`, …).
See [the wire protocol](/exec/intro#the-wire-protocol) for the statuses and which of them
are safe to retry.

### Agentic Crowdy Studio stable errors

Agent failures use stable `AGENT_*` codes both at the GraphQL boundary and
inside typed run/tool events. `message` is safe explanatory text; branch on
`code` plus `retryable`, and use `remediation` / `requiredScope` when present.

| Codes | Meaning and action |
|---|---|
| `AGENT_DISABLED`, `AGENT_OPERATOR_KILLED`, `AGENT_PERMISSION_DENIED`, `AGENT_SCOPE_DENIED`, `AGENT_MODEL_NOT_ALLOWED` | Policy or authority does not allow the operation. Do not retry until an authorized human/operator changes the relevant state. |
| `AGENT_DISCONNECTED`, `AGENT_CLIENT_REATTACHED`, `AGENT_CLIENT_EPOCH_STALE`, `AGENT_EVENT_GAP` | Local control is already cleared. Attach a fresh epoch, replay/fill durable history, then require explicit human resume; Play needs a new lease. |
| `AGENT_CONTEXT_CHANGED`, `AGENT_CONTEXT_STALE`, `AGENT_HOST_CAPABILITY_CHANGED`, `AGENT_OBSERVATION_STALE`, `AGENT_CONTROL_TARGET_CHANGED`, `CROWDY_STUDIO_REVISION_CONFLICT` | Refetch the project/game/host context. Never apply an old approval, lease, observation, or revision. |
| `AGENT_APPROVAL_REQUIRED`, `AGENT_APPROVAL_MISMATCH`, `AGENT_APPROVAL_EXPIRED`, `AGENT_APPROVAL_DENIED`, `AGENT_APPROVAL_REVOKED` | Show the exact current safe summary/hash or return control to the human. Never approve automatically. |
| `AGENT_LEASE_REQUIRED`, `AGENT_LEASE_EXPIRED`, `AGENT_LEASE_REVOKED`, `AGENT_LEASE_SCOPE_MISSING` | No valid control scope exists. Stop intent; only a human can grant a new Play lease. |
| `AGENT_BUDGET_EXHAUSTED`, `AGENT_QUOTA_EXHAUSTED`, `AGENT_RATE_LIMITED`, `AGENT_PROVIDER_UNAVAILABLE` | Stop the current run. Retry only when `retryable` and after current budget/quota/policy revalidation. |
| `AGENT_TOOL_UNKNOWN`, `AGENT_TOOL_VERSION_UNSUPPORTED`, `AGENT_TOOL_INPUT_INVALID`, `AGENT_TOOL_OUTPUT_INVALID`, `AGENT_TOOL_FAILED`, `AGENT_TOOL_TIMEOUT` | Treat the exact descriptor/schema as authoritative. Do not invent fallback tools or raw API calls. |
| `AGENT_TOOL_OUTCOME_UNKNOWN` | The effect may have happened. Inspect authoritative state and do not blind-retry. |

See [Agentic Crowdy Studio](/crowdyjs/agentic-crowdy-studio) for reconnect,
approval, checkpoint, budget, and human-takeover semantics.

### Consent

The portal browser handoff has a consent gate for **untrusted** apps. Minting a portal
authorization code (`createPortalAuthorizationCode`) for an untrusted app the user has not
authorized fails with a `FORBIDDEN` error whose **message is prefixed `CONSENT_REQUIRED`**:

```json
{
  "errors": [
    {
      "message": "CONSENT_REQUIRED: the user has not authorized this app. Call authorizeApp first.",
      "path": ["createPortalAuthorizationCode"],
      "extensions": { "code": "FORBIDDEN", "httpStatus": 403 }
    }
  ],
  "data": null
}
```

`CONSENT_REQUIRED` is **not** a distinct `extensions.code` — it is a `FORBIDDEN` whose
message carries the marker. Resolve it on the identity origin that holds the session (for a
browser game, Studio's hosted `/authorize` does this) by checking
`portalConsent(appId) { consentRequired }` and recording approval with `authorizeApp(input:{ appId })`
before retrying. **Trusted apps** (the identity hub, app 1) skip consent entirely. CrowdyJS
detects this proactively: `client.portal.handleAuthorizeRequest` throws
`PortalConsentRequiredError` (pass `grantConsent: true` to approve). The requested
`redirectUri` must also be in the app's `redirectUris` allow-list, or the call is rejected
(`BAD_REQUEST`). See [Portals & app-scoped tokens](/management-api/portals-and-app-tokens#consent-and-the-oauth-client-registry).

## Realtime / UDP errors

The Game API UDP-proxy surfaces server-side spatial errors **asynchronously** on the
`udpNotifications` subscription, not as GraphQL errors. A spatial-send mutation returning
`true` only means the datagram was accepted for sending.

### `GenericErrorResponse.errorCode` (`UdpErrorCode`)

Correlate to the request that caused it by `sequenceNumber`.

| Code | Meaning | Remediation |
|---|---|---|
| `NO_ERROR` | Success. | — |
| `UNKNOWN_ERROR` | Unspecified server error. | Retry; report if persistent. |
| `INVALID_TOKEN` | The token is malformed, revoked, or not a valid app-scoped gameplay token. | Mint a fresh app-scoped token (`mintAppToken` / `exchangePortalCode`, or `refreshAppToken` for the same app); the identity session token is not valid here. |
| `APP_NOT_FOUND` | No app matches the supplied `appId`. | Verify `appId`. |
| `UNAUTHORIZED` | Missing the runtime/grid permission for this action. From the replication server release after v0.42.0, also a send the communication rules refuse: voice or video whose send setting is `OFF`, a direct message from a player under 18, or a send under an actor id that belongs to another player. | From replication server v0.42.0 a first message into a new region waits for its permissions instead of being refused, so this means the permission is missing, or could not be confirmed within about two seconds: retry once, then obtain the permission. Older servers could send it transiently on first entry to a region. A send the communication rules refuse stays refused until the player's settings change: see [Voice, video, contacts and blocks](/game-api/communication#what-the-realtime-servers-do). |
| `GAME_TOKEN_WRONG_SIZE` | The token is not the expected length. | Send the exact 64-character **app-scoped** token from `mintAppToken` / `exchangePortalCode` (no trimming/re-encoding). |
| `INVALID_REQUEST` | The message was malformed or failed validation. | Check the message shape / arguments. |
| `INVALID_APP_ID` | `appId` was missing, zero, or invalid — **or** the token is not scoped to the packet's app (app-scoped token confinement). | Supply a valid `appId`, and use the token minted for that app. |
| `USER_NOT_AUTHENTICATED` | No session on the server for this client. | Open the UDP proxy (`connectUdpProxy`) or complete the native token handshake first. |
| `TOKEN_EXPIRED` | The app-scoped gameplay token's TTL elapsed mid-session. | Refresh the app token (same app: `refreshAppToken`) before it lapses, or sign the player in again for a fresh one, then re-authorize the session. |
| `APP_PAUSED` (33) | The app's runtime gate is not active (no funds, a spend cap, a lapsed subscription), so nothing is delivered for it. Sent in answer to a send, at most once every few seconds per session. Replication v0.37.0. | Tell the player the world is paused; `gameClientBootstrap.runtimeGate` (or the mint's `runtimeGate`) carries the reason. The server re-checks with backoff and serves the session again once the owner fixes it, without a reconnect. |

The full enum (including login-validation codes that never appear on the UDP wire) is in
the [Game API SDL](pathname:///schema/game-api.graphql) as `UdpErrorCode`, each value documented.
The native-UDP view of these codes is in [Operations](/replication-api/operations) and
[Wire formats](/replication-api/wire-formats).

### `RealtimeConnectionEvent.code`

Emitted when the realtime session itself cannot be established (distinct from a
per-message error):

| Code | Meaning | Remediation |
|---|---|---|
| `AUTH_REQUIRED` | The subscription opened without a valid bearer token. | Send the token in the `connection_init` payload. |
| `APP_ID_REQUIRED` | The subscription was app-agnostic. | Scope the subscription to one `appId` (run one client per app). |
| `APP_TOKEN_REQUIRED` | The subscription presented an identity session token, not an app-scoped gameplay token. | Obtain a token scoped to this app (hosted sign-in or the portal flow, or `mintAppToken`) and use it for gameplay. |
| `APP_SCOPE_MISMATCH` | The token is scoped to a different app than the subscription's `appId`. | Use the token minted for the app you are subscribing to. |
| `UDP_PROXY_CONNECTION_FAILED` | The server could not open the upstream UDP proxy session. | Inspect `retryable`; back off and retry if `true`. |

### Native UDP: silent drops

On the **native** Replication API, some failures produce **no reply at all** — a missing
or invalid HMAC, an **unsigned** client message (`containsAuth = 0`, refused since
replication server v0.28.0), an unknown token, an unparseable packet, or a message past
the per-session **send-rate limit** (see [Rate limits](/overview/rate-limits)) is dropped
without a NAK. **Do not treat silence as a network black hole.** If you sent an
authenticated message and receive neither a notification nor a `GENERIC_ERROR_MESSAGE`,
re-check the HMAC and token, then your send rate, before assuming packet loss. (This does not apply to the GraphQL UDP-proxy path,
which authenticates at connect time.) See [Troubleshooting](/replication-api/troubleshooting).

**Deliveries are dropped silently too**, on both paths, from the replication server release after
v0.42.0: nothing reaches a player from someone either of them has blocked; voice, video, text or a
direct message does not reach a player who lacks the permission key for it; voice and video do not
reach a player whose settings do not admit the sender; and a direct message does not reach a
player under 18. The sender is told nothing. See
[Voice, video, contacts and blocks](/game-api/communication#what-the-realtime-servers-do).
