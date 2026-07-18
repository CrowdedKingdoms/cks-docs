---
sidebar_position: 8
title: Troubleshooting
---

# Troubleshooting

The most common native-UDP problem is **"my datagrams send fine but I never receive
anything back."** Because UDP is fire-and-forget, a send call succeeds even when the
packet is black-holed or rejected — so silence is the only symptom. Work down this
checklist in order.

## "Data goes out, nothing comes back"

### 1. Did `serverWithLeastClients` actually succeed?

This query **installs your Buddy session** as a side effect — see
[Authenticate and assign](/replication-api/authenticate-and-assign#what-you-get). If
it returns GraphQL `errors`, the resolver never ran and **no session exists**, so
every subsequent UDP datagram is dropped.

A frequent cause is requesting a field that isn't exposed (e.g. `peerPort`), which
fails the whole query. Request only valid fields and log the full response:

```graphql
query { serverWithLeastClients { ip4 ip6 clientPort status clients } }
```

Confirm the response body has **no `errors`** and a server object with
`status: "ReadyForClients"`.

### 2. Did you wait after assignment?

Session install is asynchronous. Wait **≥ 1.5 s** after `serverWithLeastClients`
returns before your first UDP send. Earlier messages are silently dropped. See
[Operations → recommended waits](/replication-api/operations#recommended-waits).

### 3. Are you sending to the right address and port?

- Send to **`ip4`** on **`clientPort`** (typically `9091`). Prefer IPv4 — see
  [Choosing an address](/replication-api/authenticate-and-assign#choosing-an-address).
- A black-holed IPv6 route is a classic cause of "sends succeed, nothing returns."
  If you addressed `ip6`, switch to `ip4`.
- Spatial traffic goes to the **client port**, never the peer port.

### 4. Is your HMAC key correct?

This is the single most common client bug. The token is a **64-character string used
directly as 64 octets** — **do not hex-decode it**. Hex-decoding produces a 32-byte
key and every message fails. See [HMAC](/replication-api/hmac).

```javascript
const key = Buffer.from(token, 'latin1'); // 64 bytes — correct
// const key = Buffer.from(token, 'hex');  // 32 bytes — WRONG, will fail
```

Also confirm:

- `containsAuth = 1` on your first (and every authenticated) message.
- The `gameTokenId` in the message tail matches the one from your **app-scoped
  token** (the `mintAppToken` / `exchangePortalCode` response) — not the identity
  session token from `login` / `register`, which Buddy rejects.
- The HMAC message is `prefix || token_octets` (the token bytes are appended again
  after the header+payload).

### 5. Are you listening on the same socket you send from?

Buddy replies to the **source address/port** of your datagrams. If you send from one
socket and try to receive on a different one (or a different local port), the replies
never reach your handler. Use one socket for both directions, and **accept datagrams
from the Buddy host IP regardless of the exact source** — a server may reply from a
different internal interface than the one you addressed.

### 6. If everything above checks out — it's server-side

If you have a clean `serverWithLeastClients` (no errors, `ReadyForClients`), waited,
are sending HMAC-valid `ACTOR_UPDATE_REQUEST_2` to `ip4:clientPort`, and listening on
the same socket — and still get nothing — the problem is in the environment, not your
client. Report it to your platform contact. Known server-side causes that produce
this exact symptom:

- Buddy's heartbeat is stale (it isn't registered as `ReadyForClients`).
- The game-api process is missing a required secret and can't complete the
  session-install packet.
- A version/routing mismatch between game-api and Buddy.

## Error codes

If you receive a `GENERIC_ERROR_MESSAGE` (type `3`) you are at least getting a reply —
decode the error code and see
[Operations → common error codes](/replication-api/operations#common-error-codes).
`INVALID_TOKEN` (5) almost always means the HMAC key was hex-decoded (step 4).
`INVALID_APP_ID` (18) means the token is for a different app (app-scope mismatch)
or you assigned with the session token — re-mint for the correct app.
`TOKEN_EXPIRED` (32) means your app-scoped token passed its `expiresAt` and Buddy
evicted the session — mint a fresh one (`refreshAppToken` for the same app) and
re-run `serverWithLeastClients`.
`USER_NOT_AUTHENTICATED` (20) means the session isn't installed yet (steps 1–2)
— or the app is **runtime-denied** (suspended / out of wallet funds / over a
spend cap), in which case the server won't authorize the token until the studio
resolves it on the management API. See
[Operations → app suspended or over budget](/replication-api/operations#app-suspended-or-over-budget).

## Browser clients

If you cannot open raw UDP sockets, none of the above applies — use the
**[GraphQL UDP proxy](/game-api/graphql-udp-proxy-api)** instead.
