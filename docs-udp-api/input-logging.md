---
sidebar_position: 7
title: Input logging
---

# Input logging

An app can record the inputs its players' clients send. With **replay logging** on,
every client message the replication servers accept for the app is recorded with the time
it arrived, the player who sent it and the session it belongs to. You read the recording
back through the Game API: a player can read the inputs they sent, and your studio can read
every input sent to the app.

Only what clients send is recorded. The traffic the servers fan out to other players is
not recorded, and neither are GraphQL calls.

## Turn it on

Replay logging is **off** for every app until you turn it on ("No replication logging").
An org member with `manage_apps` turns it on in Crowdy Studio (the app's **Settings**,
**Replay logging**) or with `updateApp`:

```graphql
mutation EnableReplayLogging($appId: BigInt!) {
  updateApp(appId: $appId, input: { replayLoggingEnabled: true }) {
    appId
    replayLoggingEnabled
  }
}
```

Stored input logs are billed (see [Billing](#billing)), so turning logging on is refused
with `INPUT_LOG_FUNDS_NEEDED` unless your organization's wallet has a spendable balance or
your organization is exempt from billing. Recording starts shortly after you turn it on and
stops shortly after you turn it off. Turning it off deletes nothing already recorded: those
inputs stay readable, and billed, until their [retention](#retention) ends.

**Tell your players first.** Recorded inputs can contain personal data: chat, voice and
video, as well as movement and actions. Before you turn recording on, give your players any
notice, and get any consent, that the law where they live requires.

## What is recorded

Each recorded input is one client message, as the client sent it:

- **The message bytes**, from its type byte up to its authentication tail. The tail (the
  HMAC and its key index, see [HMAC](/replication-api/hmac)) is not recorded.
- **When it arrived**, to the microsecond, and the user and game token it was sent with.
- **Its message type and sequence byte**, whether it arrived inside a `MESSAGE_BUNDLE`, and
  whether its type is one accepted without a signature.
- For spatial messages, **the chunk and the actor uuid**; for channel messages, **the
  channel**.

Only messages the server accepted are recorded. A message it refused (a bad signature, an
expired token, a rate limit, a chunk the player may not act in, a channel they are not a
member of) is not.

A **session** is one game token's inputs: it starts with the first recorded input and ends
when the token's session ends. Its end reason is one of these:

- What the client saw: `expired`, `revoked`, `reconnect` (the player connected again on a new
  token) or `released`.
- `logging_off`: you turned replay logging off while the session was open. The player's game
  goes on; only the recording stops.
- `unrecorded`: the end itself was not recorded, so the session was closed at its last input
  once an hour had passed without one.

A session that records again after it ended, because you turned logging back on or its inputs
resumed, reopens: `endedAt` and `endReason` return to null.

## Read it

Both queries are game plane. Send them with an **app-scoped token** for the app (see
[Authenticate and assign](/replication-api/authenticate-and-assign)), to the app's own
datacenter ([Datacenter routing](/game-api/datacenter-routing); the SDKs follow a
`WRONG_DATACENTER` refusal for you). An identity session token is refused.

**Who sees what.** A player sees only their own sessions and inputs. A holder of
`manage_apps` on the app sees every session and can filter by player.

List the recorded sessions, newest first:

```graphql
query RecordedSessions($appId: BigInt!, $after: String) {
  inputLogSessions(appId: $appId, first: 50, after: $after) {
    edges {
      node {
        gameTokenId
        userId
        startedAt
        lastSeenAt
        endedAt
        endReason
        messageCount
        byteCount
        messageTypes
      }
    }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}
```

`filter` narrows the list: `userId` (another player's needs `manage_apps`, and is
`FORBIDDEN` without it), `from` / `to`, and `messageType` (sessions containing that type).

Read one session's inputs, oldest first:

```graphql
query RecordedInputs($appId: BigInt!, $gameTokenId: BigInt!, $after: String) {
  inputLogMessages(appId: $appId, gameTokenId: $gameTokenId, first: 200, after: $after) {
    edges {
      node {
        receivedAt
        messageType
        seq
        sizeBytes
        body
        chunkX
        chunkY
        chunkZ
        actorUuid
        channelId
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

`body` is the message in base64. `filter` takes `from` / `to` and `messageTypes` (at most
64). Without `manage_apps`, another player's session answers `NOT_FOUND`.

**Keep paging while `pageInfo.hasNextPage` is true.** A page of inputs can hold fewer than
`first` inputs, or none, when it reached the server's time or scan limit for one request.
Pass `pageInfo.endCursor` as `after` for the next page. A short page is not the end of the
session.

### With an SDK

```ts
// CrowdyJS 18.6.0+, on the app-scoped client
const sessions = await game.inputLog.sessions(appId, { first: 20 });
const session = sessions.edges[0].node;
let after: string | undefined;
for (;;) {
  const page = await game.inputLog.messages(appId, session.gameTokenId, { first: 200, after });
  for (const { node } of page.edges) replay(node.messageType, decodeBase64(node.body));
  if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break;
  after = page.pageInfo.endCursor;
}
```

CrowdyCPP 0.59.0 has `client.inputLog().sessions` / `messages` (each with an `Async`
twin), and CrowdyPy 0.7.0 has `client.input_log.sessions` / `messages`.

## Retention

Inputs are kept for the input-log retention published on the
[pricing page](https://crowdedkingdoms.com/pricing.html), currently **7 days**, and are
then deleted. A session can stay listed for up to two days after its inputs are gone; its
inputs then read as an empty page with no next page.

Each app's inputs are stored in the app's datacenter.

## Billing

Stored input logs are a metered line on the rate card (`input_log_storage_byte_hours`),
priced per GB-month, with **no free allowance**. Each input counts at its `sizeBytes`, a
fixed record header plus the message, before compression and replication, and each byte is
billed for exactly the retention: 1 GB recorded is 168 GB-hours, 0.23 GB-month. The rate is
on the rate card in your account and on the
[pricing page](https://crowdedkingdoms.com/pricing.html). `appUsageSummary` reports an
app's byte-hours and the bytes it holds now; the full basis is in
[Shared environment](/management-api/shared-environment).

## Errors

| Code | Meaning |
|---|---|
| `INPUT_LOG_FUNDS_NEEDED` | `updateApp` was asked to turn replay logging on, and the organization's wallet has no spendable balance (and the organization is not exempt from billing). Fund the wallet, then try again. 402. |
| `INPUT_LOG_UNAVAILABLE` | Input logging is not available on this deployment, or `inputLogMessages` cannot read the log right now. The `remediation` says which: retry the second shortly with the same cursor. 503. |
| `FORBIDDEN` | `inputLogSessions` was asked for another player's sessions without `manage_apps`. |
| `NOT_FOUND` | `inputLogMessages` was asked for a session that is not yours, without `manage_apps`, or that does not exist. |
| `BAD_USER_INPUT` | A cursor from another session or query, or a filter out of range. |

All error codes are on [Error codes](/overview/error-codes).
