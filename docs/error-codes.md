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
| `UNAUTHENTICATED` | No bearer token, or it is invalid/expired. | For Management API calls, sign in again (passwordless: magic link, social, or `devLogin`) for the **session token** — see [Sign in (passwordless)](/management-api/authentication). For the **Game API + realtime subscriptions**, send an **app-scoped token** (`mintAppToken` / portal flow) as the Bearer (and in the ws `connection_init` payload) — the session token is rejected there. |
| `FORBIDDEN` | Authenticated, but the token lacks the required permission for this field. | Each operation's description and its `@requiresPermission` directive name the permission; `extensions.requiredPermission` carries the key. Use a token/role that holds it. |
| `SCOPE_MISSING` | The token is scoped to a different org/app than the request targets. | Use a token minted for the requested org/app, or a full-scope org token. |
| `BAD_USER_INPUT` | An argument failed validation (wrong type, out of range, missing required field). | Check the argument descriptions in the SDL; `BigInt` must be a string, enums must be exact names. |
| `BAD_REQUEST` | The request was rejected by the resolver (e.g. a disabled feature, a precondition not met). | Read `message`; it states the precondition. |
| `GRAPHQL_VALIDATION_FAILED` | The query/mutation document is invalid against the schema. | Validate against the [published SDL](pathname:///schema/management-api.graphql) or introspection. |
| `NOT_FOUND` | The referenced entity does not exist or is not visible to you. | Verify the ID and that your token can see it. |
| `CONFLICT` | The request conflicts with current state (incl. an idempotency key still processing). | Refetch and retry if appropriate. |
| `IDEMPOTENCY_CONFLICT` | An `idempotencyKey` was reused with **different** request parameters. | Use a new key, or resend the byte-identical request to replay the first result. See [pagination/idempotency notes](/overview/for-ai-agents#agent-gotchas). |
| `RATE_LIMITED` | A rate/usage limit was exceeded. | Back off and retry with exponential backoff. |
| `INTERNAL_SERVER_ERROR` | Unexpected server error. | Safe to retry idempotent reads; do **not** blind-retry non-idempotent mutations (send an `idempotencyKey` instead). |

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

### When code you wrote fails: `blame`, `retryable` and the fault codes

Three entry points run code the platform did not write — `gameModelInvoke`,
`computeInvoke` and `playerComputeInvoke`. A failure on one of them is answered with a
fault: a stable `code`, a **`blame`**, and a **`retryable`** flag. Nothing else comes
back. The engine's own error text, the sandbox's fault kind, the failing expression and
any internal identifiers stay on the server, where the app's developer reads them in
`gameModelEvents` and `computeModuleRuns`.

That is deliberate, and the reason is worth stating: the caller of these operations is
usually a **player**, not the developer. A player shown `Evaluation timed out` learns
nothing they can act on, and the game that displayed it has put the platform's words on
its own screen. **Blame attribution is the platform's job; presentation is yours.**

`blame` answers the one question a client cannot answer for itself:

| `extensions.blame` | Meaning | What a game should usually do |
|---|---|---|
| `PLATFORM` | Ours. The app's code may not have run at all. | Retry when `retryable`; otherwise say something went wrong on our side. |
| `AUTHOR` | The app's own code or configuration. Repeating the call gets the same answer. | Do not retry. Show your own wording for "that did not work". |
| `BUDGET` | A metered allowance for the app or the caller is spent. Nothing is broken. | Back off. `retryable` says whether the allowance returns on its own. |

`retryable` is about the **caller's** options, not about how long a fix takes: an open
breaker is retryable because it closes itself after a cooldown, while a spent plan
allowance is not, even though neither is a bug.

| `extensions.code` | `blame` | Meaning |
|---|---|---|
| `USER_CODE_ERROR` | `AUTHOR` | The app's own code failed while running. |
| `USER_CODE_TOO_SLOW` | `AUTHOR` | It ran past the time it is allowed. |
| `USER_CODE_LIMIT_EXCEEDED` | `AUTHOR` | It exceeded a per-call ceiling (gas, fuel, memory, depth, database operations, response size). |
| `INVALID_REQUEST` | `AUTHOR` | The arguments did not satisfy the function's declared contract. |
| `NOT_ALLOWED` | `AUTHOR` | An invoke policy or permission refused this caller. |
| `NOT_FOUND` | `AUTHOR` | The named function, module or export does not exist for this app. |
| `PLATFORM_BUSY` | `PLATFORM` | We could not start the work in time. The app's code never ran. Retry. |
| `PLATFORM_ERROR` | `PLATFORM` | A platform failure. Retrying is reasonable. |
| `TEMPORARILY_DISABLED` | either | A breaker is open, or an operator switch is off. `blame` distinguishes them. |
| `BUDGET_EXCEEDED` | `BUDGET` | A per-minute allowance is spent; it returns on the next window. |
| `RATE_LIMITED` | `BUDGET` | This caller is asking too often. `extensions.retryAfterMs` when known. |
| `QUOTA_EXHAUSTED` | `BUDGET` | A metered allowance is spent and does not return on its own. |
| `WRONG_DATACENTER` | `PLATFORM` | This app is served elsewhere. `extensions.gameApiUrl` names where; move and retry. |
| `APP_UNAVAILABLE` | `PLATFORM` | The app's datacenter has no instance able to serve. **No endpoint is named, on purpose** — do not fall back to a cached one, it is in the datacenter that is down. |

**`gameModelInvoke` reports a gameplay verdict in band, not as an error.** An authority
denial or an evaluation failure is a verdict, so the mutation succeeds and the result
carries `success: false` with a `fault { code blame retryable }` object. It also carries
the event id and any writes that did apply, which is why it is not thrown. `computeInvoke`
and `playerComputeInvoke` have no result to return on failure and therefore throw, with
the same three values in `extensions`.

**A `PLATFORM`-blamed refusal is the exception, and `gameModelInvoke` throws it.** When
the platform declines to *start* the work — no connection available, or a
[contended property](/game-api/game-models#concurrency-two-players-writing-the-same-property)
whose lock could not be taken in time — there is no result to report in band: the whole
transaction rolled back and no event row was written, deliberately, so that a refusal we
issued cannot trip the app's own circuit breaker. So handle both carriers on this field:
`success: false` with a `fault`, and a thrown error whose `extensions` carry the same
`blame` and `retryable`. Branching on those two is what stays correct; they are the
contract, and a refusal that is ours is always `blame: PLATFORM` with `retryable: true`.

In CrowdyJS, `playerFaultOf(errorOrResult)` reads both carriers and returns one
`{ code, blame, retryable }`, and a thrown fault arrives as `CrowdyUserCodeFaultError`
(a subclass of `CrowdyGraphQLError`, so existing handlers keep working).

```json
{
  "errors": [
    {
      "message": "The service is busy. Please try again in a moment.",
      "path": ["computeInvoke"],
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

`GmInvokeResult.errorMessage` still exists and is **deprecated**. It now carries a
platform-authored sentence matching `fault` rather than the engine's text, so it is safe
to show a player as-is — but prefer `fault` and your own wording.

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
or invalid HMAC, an unknown token, or an unparseable packet is dropped without a NAK.
**Do not treat silence as a network black hole.** If you sent an authenticated message
and receive neither a notification nor a `GENERIC_ERROR_MESSAGE`, re-check the HMAC and
token before assuming packet loss. (This does not apply to the GraphQL UDP-proxy path,
which authenticates at connect time.) See [Troubleshooting](/replication-api/troubleshooting).
