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

On an app that admits players under 18 the input log is required, and is called the
**[safety log](#the-safety-log)**.

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

### Voice and video

An app that records can leave its players' voice or video out of the recording and keep
everything else. Each medium has its own switch, and both are on (`true`) by default:

- `replayLoggingRecordsVoice`: proximity voice (`sendAudioPacket`) and channel voice
  (`sendChannelAudio`);
- `replayLoggingRecordsVideo`: webcam video (`sendVideoPacket`).

```graphql
mutation TextOnly($appId: BigInt!) {
  updateApp(appId: $appId, input: { replayLoggingRecordsVoice: false, replayLoggingRecordsVideo: false }) {
    replayLoggingRecordsVoice
    replayLoggingRecordsVideo
    recording { voice video }
  }
}
```

- `replayLoggingRecordsMedia`, the older switch, sets both, and reads `true` while either is on.
  In Crowdy Studio it is the **Record voice and video** switch under **Replay logging**. An
  explicit voice or video switch in the same update wins for its medium. (Game API v2.60.0.)
- **Until the replication servers record the two separately** (the release after v0.42.0),
  either switch on records both media. `App.recording` reports what is really recorded, so a
  medium reads as recorded while either switch is on.

A change takes effect shortly after you make it and deletes nothing already recorded. Voice and
video are usually most of what an app records, so leaving them out also cuts what recording costs.

**Tell your players first.** Recorded inputs can contain personal data: chat, voice and
video (unless you leave them out), as well as movement and actions. Before you turn recording on, give your players any
notice, and get any consent, that the law where they live requires.

## The safety log

On an app that admits players under 18, the input log is the **safety log**: the evidence a
[safety report](/game-api/safety-reports) is reviewed with. An app admits players under 18 when
its [minimum age](/management-api/age-and-territory#minimum-ages) is under 18. Until Crowded
Kingdoms opens to players 13 and over, no app does; from the opening, every app does unless it set
`minPlayerAge` to 18.

:::info[What is switched on]

- **Live** (Game API v2.60.0): the requirement below, the separate voice and video switches,
  `App.recording`, moderators' reads, and the copies reports preserve.
- **Being built:** on an app that admits players under 18, only moderators read other players'
  records, and every read of a player's own records is audited too.

:::

- **It stays on.** On such an app, turning replay logging off is refused `SAFETY_LOG_REQUIRED`;
  raise the app's minimum age to 18 first. While it is off, a player under 18 is refused a token
  in the app, also `SAFETY_LOG_REQUIRED`. Adults are not.
- **What it records** is what this page describes: every message a player's client sends, text
  chat, channel messages and direct messages included. Voice and video are recorded only where the
  app's admins leave them on, each on its own ([Voice and video](#voice-and-video)).
- **The notice and the indicator.** While the app records voice or video, your game tells players
  before they speak or appear on camera, and shows them while it records. This is required.
  `App.recording` says what is recorded now; read it with the player's app-scoped token:

  ```graphql
  query Recording($appId: BigInt!) { app(appId: $appId) { recording { enabled voice video } } }
  ```

  `enabled` is the safety log itself, which always includes text; `voice` and `video` are each
  medium.
- **Who reads it.** A player reads the records of their own sessions, which hold only what their
  client sent. An app admin (`manage_apps`) reads every session. A moderator (`moderate_safety`)
  reads only the sessions an open or escalated report covers. Every read of another player's
  records is audited. Being built: on an app that admits players under 18, only moderators read
  other players' records, and only those a report covers, while app admins keep full reads on
  apps for adults; and a player's reads of their own records are audited too.
- **How long.** The input log's [retention](#retention), 7 days. A report copies the records
  around it into a secure store until it is resolved, or for a year after a CyberTipline report
  ([What a report preserves](/game-api/safety-reports#what-a-report-preserves)).
- **Who pays.** The app's organization, as for any input log ([Billing](#billing)). Turning it on
  needs a funded wallet or a billing exemption (`INPUT_LOG_FUNDS_NEEDED`), and when the wallet can
  no longer pay, the whole app pauses, adults included (`APP_PAUSED`): nothing runs unrecorded.

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
records about 50 to 110 bytes a second, roughly 30 to 67 MB held at the 7-day retention, plus
about a third of their actor state's size a second, because the SDKs send a keyframe of the
state every 3 seconds.

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
  reconnects to another server, where the same session continues and its end is replaced.
- `paused`: recording paused because the app's logging setting could not be confirmed. The
  player sees nothing; a later record reopens the session.
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
`manage_apps` on the app sees every session and can filter by player. A moderator
(`moderate_safety`) reads the inputs of the sessions an open or escalated safety report covers,
which the report lists (`SafetyReport.sessions`), and no others. Each read of another player's
session is audited. On an app that admits players under 18 this is changing: see
[who reads the safety log](#the-safety-log).

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
never reached the log (an overloaded server or a broker outage): 0 when the recording is
complete as far as it is known, null on a session recorded before the count existed. A lost
end of a recording cannot be counted, because nothing after it reaches the log; such a session
closes as `unrecorded`. `filter` narrows the list: `userId` (another
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
most 64). Without `manage_apps`, another player's session answers `NOT_FOUND`, unless a
moderator reads one a report covers.

**Keep paging while `pageInfo.hasNextPage` is true**, not while `endCursor` is set. A page of
inputs can hold fewer than `first` inputs, or none, when it reached the server's time or scan
limit for one request; its `endCursor` still moves the next page on, so pass it as `after`
(and keep the previous cursor if one comes back null). A short page is not the end of the
session.

**Reads can ask you to retry.** Each server runs one read per user, and two per app and per
organization, at a time. A read over that share waits for an earlier one within its own
few-second deadline, and answers `INPUT_LOG_RATE_LIMITED` if the wait runs out (or leaves too
little of the deadline to read in); `INPUT_LOG_TEMPORARILY_UNAVAILABLE` means the log cannot be
read right now. Both carry `extensions.retryable`; wait a moment and retry with the same cursor,
a bounded number of times, and nothing is skipped. A read over HTTP whose request is closed
stops and frees its share at once, so abort a read nobody will see, say when the user opens
another session: with CrowdyJS 18.9.0, pass `signal` in the options of `inputLog.messages`
(below). Read one session per request: an operation may select `inputLogMessages` only once.

A cursor belongs to the session it came from: a cursor from another session, or a malformed
one, is `BAD_USER_INPUT`.

### With an SDK

```ts
// CrowdyJS 18.9.0+, on the app-scoped client
import { CrowdyGraphQLError, decodeBase64 } from '@crowdedkingdoms/crowdyjs';

const RETRY = new Set(['INPUT_LOG_TEMPORARILY_UNAVAILABLE', 'INPUT_LOG_RATE_LIMITED']);
const MAX_RETRIES = 8; // in a row, about half a minute of back-off; then give up
const sessions = await game.inputLog.sessions(appId, { first: 20 });
const session = sessions.edges[0].node;
const reading = new AbortController(); // reading.abort() when the user moves on
let after: string | undefined;
for (let backoffMs = 250, retries = 0; ; ) {
  let page;
  try {
    page = await game.inputLog.messages(appId, session.gameTokenId, {
      first: 200,
      after,
      signal: reading.signal,
    });
  } catch (err) {
    if (!(err instanceof CrowdyGraphQLError) || !RETRY.has(String(err.code))) throw err;
    if (++retries > MAX_RETRIES) throw err;
    await new Promise((r) => setTimeout(r, backoffMs));
    backoffMs = Math.min(backoffMs * 2, 5_000);
    continue; // the same cursor
  }
  backoffMs = 250;
  retries = 0;
  for (const { node } of page.edges) replay(node.messageType, decodeBase64(node.body));
  if (!page.pageInfo.hasNextPage) break;
  after = page.pageInfo.endCursor ?? after;
}
```

CrowdyCPP 0.59.0 has `client.inputLog().sessions` / `messages` (each with an `Async`
twin; `crowdy::core::base64Decode` decodes a body), and CrowdyPy 0.7.0 has
`client.input_log.sessions` / `messages` (`decode_base64`). CrowdyCPP 0.62.0 and CrowdyPy
0.10.0 select `missingRecords` and port the rest of this page's reading rules: in C++,
`graphql::inputLogReadRetryable` names the two retryable codes and a `graphql::CancelToken`
overload of each read plays the part of `signal`; in Python, cancelling a read's task closes its
request.

## Retention

Inputs are kept for the input-log retention published on the
[pricing page](https://crowdedkingdoms.com/pricing.html), currently **7 days**, and are
then deleted. The store deletes in hourly segments, so an input can stay readable for up to
about an hour past the retention. A session can stay listed for up to two days after its
inputs are gone; its inputs then read as an empty page with no next page.

Each app's inputs are stored in the app's datacenter. If CK moves an app to another
datacenter, the sessions recorded before the move stay listed (their `datacenter` says
where), and their inputs stay in the previous datacenter until their retention ends,
neither readable nor billed: read from the app's new datacenter they answer an empty page with
no next page.

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
| `SAFETY_LOG_REQUIRED` | `updateApp` was asked to turn replay logging off on an app that admits players under 18, or a player under 18 asked for a token in an app whose safety log is off. Keep it on, or raise the app's minimum age to 18 first. 403. See [the safety log](#the-safety-log). |
| `INPUT_LOG_UNAVAILABLE` | Input logging is not available on this deployment, or the deployment cannot read its log. Do not retry. 503. |
| `INPUT_LOG_TEMPORARILY_UNAVAILABLE` | `inputLogMessages` could not read the log just now (its readers were busy, or the store was briefly unreachable). Retryable: retry shortly with the same cursor; nothing is lost. 503. |
| `INPUT_LOG_RATE_LIMITED` | An earlier `inputLogMessages` read was still running when this one's wait ran out, or freed its share with too little of this read's deadline left to read: each server runs one read per user, and two per app and per organization, at a time. Retryable: retry shortly with the same cursor. 429. |
| `INPUT_LOG_READ_ABORTED` | An `inputLogMessages` read stopped because its HTTP request closed (you aborted it). Nobody receives this answer: your request has already ended with your own abort. It shows in usage figures as a client error. 499. |
| `FORBIDDEN` | `inputLogSessions` was asked for another player's sessions without `manage_apps`. |
| `NOT_FOUND` | `inputLogMessages` was asked for a session that is not yours, without `manage_apps` (or, for a moderator, one no open or escalated report covers), or that does not exist. |
| `BAD_USER_INPUT` | `inputLogMessages` was given a malformed cursor or one from another session; a connection cursor points past 10,000,000 rows; or a filter is out of range. (`inputLogSessions` treats a malformed cursor as the first page.) |

All error codes are on [Error codes](/overview/error-codes).
