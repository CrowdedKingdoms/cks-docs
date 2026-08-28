---
sidebar_position: 3
title: Authenticate and assign
---

# Authenticate and assign

## 1. Obtain an app-scoped token (Management API)

Native UDP gameplay uses an **app-scoped token** — a credential confined to one
app. Getting one is two steps: sign in to get your **identity session token**,
then mint an app token from it. Sign in with email + password, a magic link, or a
social provider — the session token it
returns is a *management-plane* credential and is **rejected for gameplay** (Buddy
and the Game API only accept app-scoped tokens). See
**[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)**.

### Sign in

Sign in on the **Management API** GraphQL endpoint to get the identity session
token. Email + password, a magic link, or a social provider — the same three
paths on every environment:

```graphql
mutation Login($loginUserInput: LoginUserInput!) {
  login(loginUserInput: $loginUserInput) {
    token                      # identity SESSION token — management-plane only
    user { userId email gamertag }
  }
}
# variables: { "loginUserInput": { "email": "player@example.com", "password": "..." } }
```

See **[Sign in](/management-api/authentication)** for the magic-link
and social flows.

### Mint an app token

Send `Authorization: Bearer <session token>` and mint a token for the app you are
entering:

```graphql
mutation Enter($appId: BigInt!) {
  mintAppToken(input: { appId: $appId }) {
    token         # 64-character app-scoped token — used directly as 64 octets
    gameTokenId   # numeric id — used in the spatial message tail
    appId
    expiresAt     # app tokens expire (default ~30 min)
    gameApiUrl    # the app's Game API endpoint — assign a Buddy here (step 2)
    gameApiWsUrl
  }
}
```

Free/open apps auto-grant access on first mint; paid apps require an existing
entitlement (else `FORBIDDEN`). Use the returned `token` as the **Bearer on the
Game API** and as the **HMAC key** for UDP spatial messages — **as-is (64 Latin-1
octets), do NOT hex-decode it** (see **[HMAC](/replication-api/hmac)**). Keep
`gameTokenId` for the spatial message tail.

App tokens expire: rotate with `refreshAppToken` before `expiresAt` (send the
current app token as the Bearer) to keep playing the same app, or re-mint.
An expired token makes Buddy drop your session and emit `TOKEN_EXPIRED`.
Switching to a different app mints a fresh per-app token.

## 2. Assign a Buddy server (Game API)

On your app's **`gameApiUrl`**, query:

```graphql
query AssignServer {
  serverWithLeastClients {
    serverId
    ip4
    ip6
    clientPort
    status
    clients
  }
}
```

Request **only fields that exist** on `ServerStatus` (`serverId`, `ip4`, `ip6`,
`clientPort`, `status`, `clients`, `peers`, and the per-second metric fields).
Requesting a non-existent field — for example `peerPort` — makes the **whole query
fail validation**, the resolver never runs, and **your Buddy session is never
installed** (see below). Always check the response for `errors` before proceeding.

### What you get

- **`ip4` / `ip6`** — Buddy host addresses. **Prefer `ip4`** unless you have
  confirmed end-to-end IPv6 connectivity to the Buddy host (see
  [Choosing an address](#choosing-an-address)).
- **`clientPort`** — UDP port for spatial messages (typically `9091`).
- **`status`** — `ReadyForClients`. The selector only returns ready servers; it
  skips any reporting `NearCapacity` or `Full` (a server throttling itself under
  resource overload), so you are always handed a server that can take you.
- **`gameTokenId`** (from the app token in step 1) — still required in spatial
  message tails.

:::caution[The Buddy you get is always in your app's datacenter, or there is none]

The selector is pinned to the datacenter holding your app's data, and it never hands
you one somewhere else. That is deliberate: a remote Buddy would work, in the sense
that every gameplay write would succeed, while each one crossed a WAN. Nothing would
error and nothing would log — you would only see it as latency nobody could attribute.

**The refusal says which of three situations you are in.** Read
`extensions.code`:

- **`WRONG_DATACENTER`** — you called this on a datacenter that does not hold the app.
  It carries `gameApiUrl` and `gameApiWsUrl`; reconnect there and retry. **This is the
  common case**, because the shared origin `ck.<tier-root>` resolves to every
  datacenter, so a client that has not re-discovered lands on the wrong one about half
  the time. CrowdyJS and CrowdyCPP follow it for you.
- **`APP_UNAVAILABLE`** — the app's own datacenter is not serving. No endpoint, on
  purpose. Retry.
- **`NO_LOCAL_BUDDY`** — you are on the right datacenter and it has no healthy Buddy.
  No endpoint, because there is nowhere else to go. Retry and report it; this one
  needs an operator.

In every case, do not reuse a server you cached while connected to a different
datacenter.
:::

:::caution[Use the app token, not the session token]
Call `serverWithLeastClients` with the **app-scoped** token as the Bearer. The
identity session token is rejected on the Game API, and Buddy only installs a
session for a `token_type='app'` token bound to this app — a session/wrong-app
token yields `INVALID_APP_ID` and no session is installed.
:::

:::info[`serverWithLeastClients` installs your session]

This query is not just a lookup. As a side effect, the Game API **registers your
UDP session** with the chosen Buddy (it signs and sends the session-install packet
on your behalf). You do not perform any separate handshake from the client — but it
also means that if this query **errors out**, no session exists, and every UDP
datagram you send afterward is **silently dropped with no reply**.

:::

If your first spatial messages are dropped, confirm the query returned without
`errors`, call `serverWithLeastClients` again, and wait before retrying UDP.

### Choosing an address

A Buddy advertises both an IPv4 (`ip4`) and an IPv6 (`ip6`) address. Use whichever
has a **working network path from your client to the Buddy host** — they are not
interchangeable if one protocol doesn't route end-to-end.

- **Prefer `ip4`.** It is the most broadly reachable and is the recommended default
  for native clients today.
- If you use IPv6, send to the raw `ip6`. If your socket is IPv6 but you want to
  reach the IPv4 host, use the IPv4-mapped form `::ffff:<ip4>`.
- **Symptom of a bad address choice:** your datagrams send without error (UDP is
  fire-and-forget, so a black-holed route reports success) but **nothing ever comes
  back**. If that happens, switch to `ip4`.

## 3. Wait before first UDP message

Session registration is asynchronous. Wait **at least 1.5 seconds** after
`serverWithLeastClients` before sending `ACTOR_UPDATE_REQUEST_2`. Messages sent
too early may be silently dropped.

## 4. Send spatial traffic

Send UDP to **`ip4` or `ip6`** on **`clientPort`** from the assignment response.
Continue with **[Send and receive](/replication-api/send-and-receive)**.

## Reassignment

To move to another Buddy (crash, eviction, load balance):

1. Call `serverWithLeastClients` on the Game API again (same app-scoped token;
   `refreshAppToken` first if it is near `expiresAt`).
2. Wait **~1.5 s** for the session to be ready on the new host.
3. Resume spatial UDP on the new `ip4`/`ip6` and `clientPort`.

A server can also **proactively** ask you to move by sending a `COMMAND_RECONNECT`
(type `22`) when it is shedding load — handle it with the same three steps within
the grace period before it drops your session. See
**[Operations → Load shedding](/replication-api/operations)**.
