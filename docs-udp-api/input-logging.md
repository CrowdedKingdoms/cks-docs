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
not recorded, and neither are GraphQL queries and mutations, with one exception: the realtime
messages a browser game sends through the Game API's realtime proxy (`sendActorUpdate` and the
other proxy sends) reach the replication server as client messages, and are recorded like any
other.

**Recording is best-effort.** An outage or an overload can leave a gap in a recording; each
session reports how many of its inputs were accepted but never recorded
([`missingRecords`](#read-it)).

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
with `INPUT_LOG_FUNDS_NEEDED` unless your organization's wallet can spend at least the
projected cost of keeping one retention period of the app's recent traffic, or your
organization is exempt from billing. The refusal's `extensions.requiredMicrousd` and
`spendableMicrousd` say how much is needed and how much the wallet can spend (in millionths of
a dollar). An app with no recent traffic needs a spendable balance above zero.

Recording starts shortly after you turn it on and stops shortly after you turn it off.
Turning it off deletes nothing already recorded: those inputs stay readable, and **go on being
billed**, until their [retention](#retention) ends.

**Tell your players first.** Recorded inputs can contain personal data: chat, voice and
video, as well as movement and actions. Before you turn recording on, give your players any
notice, and get any consent, that the law where they live requires.

## What is recorded

Each recorded input is one client message, as the client sent it:

- **The message bytes**, from its type byte up to its authentication tail. The tail is not
  part of the recorded body: the 32-byte HMAC, the 8-byte game token id and the 1-byte
  sequence ([HMAC](/replication-api/hmac)). The game token and the sequence byte are recorded
  as their own fields.
- **When it arrived**, to the microsecond, and the user and game token it was sent with.
- **Its message type and sequence byte**, whether it arrived inside a `MESSAGE_BUNDLE`, and
  whether its type is one accepted without a signature.
- For spatial messages, **the chunk and the actor uuid**; for channel messages, **the
  channel**.

**Every message the server accepts is recorded, keep-alives included.** The actor heartbeat
(type 26) and the capabilities message (type 29) are accepted messages, so they are recorded
and billed like any other: with the SDKs' defaults, a connected player who does nothing
records about 50 to 110 bytes a second, roughly 30 to 65 MB held at the 7-day retention.

A message the server refused at its checks is not recorded: a bad signature, an expired
token, a rate limit, a chunk the player may not act in, a channel they are not a member of or
may not send to. **One exception:** a voxel edit that passed the session and permission
checks is recorded, and billed, even when it is then not applied, because a more specific
grid's rule refuses it or the state-size cap does. A replay sees it refused again.

A **session** is one game token's inputs: it starts with the first recorded input and ends
when the token's session ends. Its end reason is one of these:

- What the client saw: `expired`, `revoked`, `reconnect` (the player connected again on a new
  token) or `released`.
- `logging_off`: you turned replay logging off while the session was open. The player's game
  goes on; only the recording stops.
- `shutdown`: the replication server recording the session stopped (a deploy). The client
  reconnects to another server, and that is a new session.
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
        missingRecords
        messageTypes
      }
    }
    pageInfo { hasNextPage endCursor }
    totalCount
  }
}
```

`missingRecords` counts the session's inputs that the replication server accepted but that
never reached the log (a full queue, or a broker outage): 0 for a complete session, null on a
session recorded before the count existed. `filter` narrows the list: `userId` (another
player's needs `manage_apps`, and is `FORBIDDEN` without it), `from` / `to`, and
`messageType` (sessions containing that type).

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

`body` is the message in standard base64. `filter` takes `from` / `to` and `messageTypes` (at
most 64). Without `manage_apps`, another player's session answers `NOT_FOUND`.

**Keep paging while `pageInfo.hasNextPage` is true**, not while `endCursor` is set. A page of
inputs can hold fewer than `first` inputs, or none, when it reached the server's time or scan
limit for one request; its `endCursor` still moves the next page on, so pass it as `after`
(and keep the previous cursor if one comes back null). A short page is not the end of the
session.

**Reads can ask you to retry.** `inputLogMessages` answers `INPUT_LOG_TEMPORARILY_UNAVAILABLE`
when the log cannot be read right now, and `INPUT_LOG_RATE_LIMITED` while another read of
yours is running: one read per user and two per app run at a time. Both carry
`extensions.retryable`; wait a moment and retry with the same cursor, and nothing is skipped.
Read one session per request: an operation may select `inputLogMessages` only once.

A cursor belongs to the session it came from: a cursor from another session, or a malformed
one, is `BAD_USER_INPUT`.

### With an SDK

```ts
// CrowdyJS 18.8.0+, on the app-scoped client
import { CrowdyGraphQLError, decodeBase64 } from '@crowdedkingdoms/crowdyjs';

const RETRY = new Set(['INPUT_LOG_TEMPORARILY_UNAVAILABLE', 'INPUT_LOG_RATE_LIMITED']);
const sessions = await game.inputLog.sessions(appId, { first: 20 });
const session = sessions.edges[0].node;
let after: string | undefined;
for (let backoffMs = 250; ; ) {
  let page;
  try {
    page = await game.inputLog.messages(appId, session.gameTokenId, { first: 200, after });
  } catch (err) {
    if (!(err instanceof CrowdyGraphQLError) || !RETRY.has(String(err.code))) throw err;
    await new Promise((r) => setTimeout(r, backoffMs));
    backoffMs = Math.min(backoffMs * 2, 5_000);
    continue; // the same cursor
  }
  backoffMs = 250;
  for (const { node } of page.edges) replay(node.messageType, decodeBase64(node.body));
  if (!page.pageInfo.hasNextPage) break;
  after = page.pageInfo.endCursor ?? after;
}
```

CrowdyCPP 0.59.0 has `client.inputLog().sessions` / `messages` (each with an `Async`
twin; `crowdy::core::base64Decode` decodes a body), and CrowdyPy 0.7.0 has
`client.input_log.sessions` / `messages` (`decode_base64`).

## Retention

Inputs are kept for the input-log retention published on the
[pricing page](https://crowdedkingdoms.com/pricing.html), currently **7 days**, and are
then deleted. The store deletes in hourly segments, so an input can stay readable for up to
about an hour past the retention. A session can stay listed for up to two days after its
inputs are gone; its inputs then read as an empty page with no next page.

Each app's inputs are stored in the app's datacenter. If CK moves an app to another
datacenter, the sessions recorded before the move stay listed (their `datacenter` says
where), and their inputs stay in the previous datacenter, and billed, until their retention
ends; read from the app's new datacenter they answer an empty page with no next page.

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
| `INPUT_LOG_FUNDS_NEEDED` | `updateApp` was asked to turn replay logging on, and the organization's wallet cannot spend the projected cost of keeping one retention period of the app's recent traffic (and the organization is not exempt from billing). `extensions.requiredMicrousd` and `spendableMicrousd` say how much. Fund the wallet, then try again. 402. |
| `INPUT_LOG_UNAVAILABLE` | Input logging is not available on this deployment. 503. |
| `INPUT_LOG_TEMPORARILY_UNAVAILABLE` | `inputLogMessages` could not read the log just now (its readers were busy, or the store was briefly unreachable). Retryable: retry shortly with the same cursor; nothing is lost. 503. |
| `INPUT_LOG_RATE_LIMITED` | Another `inputLogMessages` read of yours is running: one read per user and two per app run at a time. Retryable: wait for it, then retry with the same cursor. 429. |
| `FORBIDDEN` | `inputLogSessions` was asked for another player's sessions without `manage_apps`. |
| `NOT_FOUND` | `inputLogMessages` was asked for a session that is not yours, without `manage_apps`, or that does not exist. |
| `BAD_USER_INPUT` | `inputLogMessages` was given a malformed cursor or one from another session; a connection cursor points past 10,000,000 rows; or a filter is out of range. (`inputLogSessions` treats a malformed cursor as the first page.) |

All error codes are on [Error codes](/overview/error-codes).
