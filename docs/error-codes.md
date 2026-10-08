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
| `HOSTED_SIGN_IN_REQUIRED` | A direct sign-in mutation (`login`, `register`, magic link, social, reset…) was called from a browser origin that is not first-party (Studio only; the Crowdy Games host is NOT first-party). 403. | Use hosted sign-in: `client.portal.signIn({ appId, redirectUri })` then `client.portal.handleSignInCallback()`; register your origin under the app's redirect URIs in Studio. Non-browser clients (no `Origin` header) are unaffected. |
| `LEGAL_ACCEPTANCE_REQUIRED` | The player has not stored the current required legal documents (Game Terms, API Terms, SDK Developer Terms, Free Tier and Billing Basis, Overworld Privacy Policy) and the age-of-majority attestation, so `mintAppToken`, `createPortalAuthorizationCode` and `refreshAppToken` issue no gameplay token. Also a browser `register` without both `acceptLegal` and `attestAgeOfMajority` true, before any account exists. 403. ck-api v2.35.0. | A browser game sends the player back through hosted sign-in (`/authorize` asks for both); retrying a refresh cannot succeed. A native client shows its own two checkboxes, linking each document, then calls `recordPlayerConsents(acceptLegal: true, attestAgeOfMajority: true)` with the session token. `playerLegalAcceptance` says whether that is still needed. See [Terms and age of majority](/management-api/portals-and-app-tokens#terms-and-age-of-majority). |
| `CSRF_REQUIRED` | The request authenticated with the Studio `ck_session` cookie but did not send `X-CSRF-Token`. 403. Bearer-only clients never see this. | Send the readable `ck_csrf` cookie value as `X-CSRF-Token`, or send `Authorization: Bearer` instead. |
| `CSRF_MISMATCH` | `X-CSRF-Token` does not match any presented `ck_csrf`. 403. Duplicate cookies (parent-zone leftover + tier cookie) are accepted when the header matches either one (ck-api v1.98.0). | Refresh to pick up a new CSRF cookie, or send `Authorization: Bearer`. |
| `COOKIE_AUTH_ORIGIN_REFUSED` | A cookie session was offered from a browser origin that is not first-party. 403. | From a customer origin, use a Bearer app token from hosted `/authorize`. Do not send `ck_session`. |
| `INVALID_CURRENT_PASSWORD` | `changePassword` was given the wrong current password. | Ask again, or offer `requestPasswordReset`. The session is valid — do not sign the user out. |
| `RATE_LIMITED` | A rate/usage limit was exceeded. | Back off and retry with exponential backoff. |
| `CONTENT_HOSTING_DISABLED` | Third-party hosting is not configured on this tier (no content CDN). 503. | Host the build yourself ([The Construct HOSTING.md](https://github.com/CrowdedKingdoms/the-construct/blob/prod/docs/HOSTING.md)) or publish on a tier that hosts. |
| `HOSTED_SLUG_UNAVAILABLE` | The hosting slug is not a DNS label, is reserved (a first-party game or infrastructure name), or is claimed by another app. 409. | Pick another: lower-case letters, digits and hyphens, 1-63 characters, no leading or trailing hyphen. `npm run publish -- --slug <name>`. |
| `HOSTED_MANIFEST_INVALID` | The publish manifest was refused: a path escapes the bundle, a refused file type, over the file-count or size caps, or no `index.html` at the root. 400. | The message lists every problem; fix the build output and publish again. |
| `HOSTED_PUBLISH_INCOMPLETE` | `completeGamePublish` found staged objects missing or differing from the manifest. 409. | Upload every presigned URL (the message names the paths) and complete again, or `abandonGamePublish` and start over. |
| `HOSTED_GAME_TAKEN_DOWN` | An operator took this hosted game down; publishing and re-enabling are refused. 403. | Contact hello@crowdedkingdoms.com. |
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
message carries the marker. Resolve it on the Overworld by checking
`portalConsent(appId) { consentRequired }` and recording approval with `authorizeApp(input:{ appId })`
before retrying. **Trusted apps** (the Overworld is app 1) skip consent entirely. CrowdyJS
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
| `UNAUTHORIZED` | Missing the runtime/grid permission for this action. | May be **transient** on first entry to a new region while grid permissions load — retry shortly; otherwise obtain the permission. |
| `GAME_TOKEN_WRONG_SIZE` | The token is not the expected length. | Send the exact 64-character **app-scoped** token from `mintAppToken` / `exchangePortalCode` (no trimming/re-encoding). |
| `INVALID_REQUEST` | The message was malformed or failed validation. | Check the message shape / arguments. |
| `INVALID_APP_ID` | `appId` was missing, zero, or invalid — **or** the token is not scoped to the packet's app (app-scoped token confinement). | Supply a valid `appId`, and use the token minted for that app. |
| `USER_NOT_AUTHENTICATED` | No session on the server for this client. | Open the UDP proxy (`connectUdpProxy`) or complete the native token handshake first. |
| `TOKEN_EXPIRED` | The app-scoped gameplay token's TTL elapsed mid-session. | Refresh the app token (same app: `refreshAppToken`) before it lapses, or re-portal through the Overworld for a fresh one, then re-authorize the session. |

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
| `APP_TOKEN_REQUIRED` | The subscription presented an identity session token, not an app-scoped gameplay token. | Obtain a token scoped to this app (portal in via the Overworld, or `mintAppToken`) and use it for gameplay. |
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
