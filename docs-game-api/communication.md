---
sidebar_position: 14.5
title: Voice, video, contacts and blocks
---

# Voice, video, contacts and blocks

In each app, every player has settings for whom their voice and video reach and whose they hear
and see, a contacts list, and a block list. The realtime servers enforce them on the sending side
and the receiving side, for every client, modified or not. Players under 18 get stricter defaults:
voice and video stay off until a parent consents, and then reach contacts only; direct messages
stay off.

:::info[What is switched on]

- **Live** (Game API v2.60.0 to v2.61.1 and replication server v0.43.0): the settings, contacts,
  blocks and parental consent fields on this page, and the realtime servers that enforce them on
  both sides. Players under 18, and so the minors' defaults, since 2026-11-04.
- **Not yet in production: parental consent.** Kids Web Services is connected in production but
  is not live there until its review is complete, and refuses requests until then:
  `requestParentalConsent` answers `PARENTAL_CONSENT_UNAVAILABLE` with `extensions.reason`
  `provider_refused` (`not_configured` until 2026-11-06), so a player under 18 cannot turn voice
  or video on there yet.

:::

## Scopes

Each player has four settings per app, each `OFF`, `CONTACTS` or `EVERYONE`:

| Setting | Decides |
|---|---|
| `voiceSend` | whom the player's voice reaches |
| `voiceReceive` | whose voice the player hears |
| `videoSend` | whom the player's webcam video reaches |
| `videoReceive` | whose video the player sees |

- `EVERYONE` admits anyone your app's own rules let through: permissions, distance, channels.
- `CONTACTS` admits only the player's accepted [contacts](#contacts) in the app.
- `OFF` admits nobody. A send with the send setting `OFF` is refused `UNAUTHORIZED`.

Both sides must agree: A's voice reaches B only when A's `voiceSend` admits B and B's
`voiceReceive` admits A. Channel voice follows the voice settings in the same way. Text, channel
messages and direct messages have no settings: they follow the permission keys and blocks.

**What a player chooses, and what applies.** The settings the realtime servers apply are the
player's choices capped by policy:

- **18 and over:** the choice. `EVERYONE` until the player chooses otherwise.
- **Under 18:** each medium is `OFF` until a parent has consented to it in this app
  ([below](#parental-consent-for-voice-and-video)), and then the choice, at most `CONTACTS`.

So a player can only ever lower what policy allows. A choice above the cap is kept, and applies up
to the cap: a player under 18 who chose `EVERYONE` gets `CONTACTS` once a parent consents.

## Contacts

Contacts are mutual and per app: an accepted contact is in both players' lists. One player asks,
and the other accepts. If both ask, they become contacts at once. Contacts are what `CONTACTS`
admits.

## Blocks

A block stops communication between two players in the app, in both directions, while it stands:
voice, video, text, direct messages, channel messages and voice, a player's events and the
app-defined messages one player sends another. Movement, avatar and actor state and voxel edits
still pass, so both players go on seeing the same world. Either player's block is enough. The
blocked player is not told, and gets no error when something they send is dropped. Blocking also
removes every contact and request between the two, and unblocking does not bring them back.

What your app's own code sends (a hub's realtime events and channel messages, the Game API's
notices) has no sending player and is not filtered by blocks. A hub that carries one player's
words to another checks the block first: see [`players.blocked`](/exec/players-and-safety#blocks).
Muting a player stays on the device.

## Direct messages and players under 18

A player under 18 holds no `use_direct_messages`: their direct message is refused `UNAUTHORIZED`,
and a direct message from a player to them is dropped. A direct message your app's code sends
passes, so a hub must never pass one player's direct message to a minor as its own
([players' data, blocks and reports](/exec/players-and-safety#blocks)).

## What the realtime servers do

From replication server v0.43.0:

| What | The sender gets |
|---|---|
| Voice or video with the matching send setting `OFF` | `UNAUTHORIZED` (error 7) |
| A direct message from a player under 18 | `UNAUTHORIZED` |
| Any send under an actor id that belongs to another player | `UNAUTHORIZED` |
| Communication between two players when either has blocked the other: voice, video, text, direct messages, channel messages and voice, a player's events and app-defined messages | nothing: dropped |
| Voice, video, text or a direct message to a player who lacks `use_voice_chat`, `use_video_chat`, `use_text_chat` or `use_direct_messages` in the app | nothing: dropped for that player |
| Voice or video that the two players' settings do not admit | nothing: dropped for that player |
| A direct message from a player to a player under 18 | nothing: dropped |

- **Receiving needs the permission key too.** Before v0.43.0 only the sender's keys were checked,
  so a tier without `use_voice_chat` still heard voice. Now that player hears none. Check your
  tiers ([Permissions](permissions)).
- **A player under 18's settings never go above `CONTACTS`**, whatever is stored.
- **An actor belongs to its player.** A send under an actor id that another player created, or that
  another player is using, is refused.
- **What passes:** what your app's code and the platform send (they have no sending player), and a
  player's own traffic to their own sessions.
- **Changes apply within a second** to the live sessions of every player they concern, both
  players for a contact or a block, without a reconnect. A change of the player's access tier
  applies when their token is next refreshed.

## The API

All of these take the player's app-scoped token for the app, sent to the app's own datacenter
(`gameApiUrl`).

```graphql
query Settings($appId: BigInt!) {
  myCommSettings(appId: $appId) {
    isMinor
    voiceSend voiceReceive videoSend videoReceive   # what applies now
    choices { voiceSend voiceReceive videoSend videoReceive }
    voiceAllowed videoAllowed                       # the most each may be now
    voiceConsent videoConsent                       # a parent consented, in this app
  }
}

mutation OnlyContactsHearMe($appId: BigInt!) {
  setMyCommSettings(appId: $appId, input: { voiceSend: CONTACTS }) { voiceSend voiceAllowed }
}
```

`setMyCommSettings` changes only the fields it is given. `null` in `choices` means the player has
not chosen, which is `EVERYONE`.

| Field | What it does |
|---|---|
| `requestContact(appId, userId)` | Asks another player of the app. Answers `ACCEPTED` at once if they had asked first, else `PENDING`. Refused `BAD_REQUEST` while the caller has blocked them. |
| `acceptContact(appId, userId)` | Accepts their request; `NOT_FOUND` if they have not asked. |
| `removeContact(appId, userId)` | Removes a contact, declines their request or cancels your own. `false` when there was nothing. |
| `myContacts(appId)` | Accepted contacts, most recent first. |
| `contactRequests(appId)` | Waiting requests: `INCOMING` ones first, then `OUTGOING`. |
| `blockPlayer(appId, userId)` | Blocks them. Blocking again changes nothing. |
| `unblockPlayer(appId, userId)` | Lifts your block. `false` when there was none. |
| `myBlocks(appId)` | The players you blocked, most recent first. |

- The other player must be one of the app's players: `NOT_FOUND` otherwise.
- A request to a player who blocked the caller answers `PENDING`, and nothing is stored.
- Each player may have, per app, 100 waiting requests, 1,000 contacts and 1,000 blocks; past that,
  `SOCIAL_LIMIT_REACHED` (409), with the message naming which.
- The lists carry user ids. Show names with `playerProfiles(userIds)`.

## Parental consent for voice and video

A player under 18 asks a parent or guardian to allow one medium, `VOICE` or `VIDEO`, in this app.
Kids Web Services, a parental consent service run by Epic Games, emails the parent, and once the
parent consents the medium opens, up to `CONTACTS`, within a second.

```graphql
mutation AskParent($appId: BigInt!, $email: String!) {
  requestParentalConsent(appId: $appId, feature: VOICE, parentEmail: $email) { status }
}
```

- `status` is `REQUESTED` (the email went out), `ALREADY_GRANTED` (nothing sent) or `NOT_REQUIRED`
  (the player is 18 or over; nothing sent).
- The parent's address goes to Kids Web Services and is not stored by Crowded Kingdoms.
- Consent is per app and per medium. `voiceConsent` and `videoConsent` in `myCommSettings` say
  whether it is given. When a parent withdraws it, through Kids Web Services or by writing to
  Crowded Kingdoms, the medium turns off again within a second.
- `PARENTAL_CONSENT_UNAVAILABLE` (503) when consent cannot be asked; voice and video then stay off
  for the player, and nothing was sent. `extensions.reason` says why (Game API v2.61.1):
  `not_configured`, the deployment has no consent service: do not retry; `provider_refused`, the
  service refused the request (an address it does not accept; in production, every request until
  Kids Web Services is live there): elsewhere a parent's other address may work;
  `provider_unavailable`, the service did not answer: retry shortly.
- `RATE_LIMITED` after three requests in an hour.

## What your game shows

For a game that offers voice, video or chat:

- **The settings**, per medium, from `myCommSettings`. When a medium is off for a player under 18,
  say that a parent's consent turns it on, without naming an age, and offer the request.
- **Controls that match**: do not offer a microphone or a camera whose send setting is `OFF`, since
  its sends are refused.
- **Contacts:** the requests waiting in both directions, with accept, decline and remove.
- **Block**, wherever players meet, and the list of blocked players with unblock.
- **A report option**, beside block: [Safety reports and moderation](safety-reports).
- **The recording notice and indicator**, when the app's safety log records voice or video:
  [the safety log](/replication-api/input-logging#the-safety-log). This one is required.

## In the SDKs

The player's own controls, with the app token: CrowdyJS 18.25.0 `client.safety` (`commSettings`,
`setCommSettings`, `requestParentalConsent`, `contacts`, `contactRequests`, `requestContact`,
`acceptContact`, `removeContact`, `blocks`, `block`, `unblock`); CrowdyCPP 0.76.0
`client.safety()`, the same names, each with an `Async` twin; CrowdyPy 0.24.0 `client.safety`,
in snake case (`comm_settings`, `set_comm_settings`, `request_parental_consent`, …). The refusals
read with `socialLimitReachedOf` and `parentalConsentUnavailableOf`, which gives the `reason`
(`social_limit_reached_of` and `parental_consent_unavailable_of` in CrowdyPy;
`graphql::parentalConsentUnavailableOf` in CrowdyCPP).

## Errors

| Code | When |
|---|---|
| `UNAUTHORIZED` (UDP error 7) | A send the rules above refuse. |
| `SOCIAL_LIMIT_REACHED` | 409: the player has as many contacts, waiting requests or blocks in the app as allowed. Remove some first. |
| `PARENTAL_CONSENT_UNAVAILABLE` | 503: consent cannot be asked now; `extensions.reason` is `not_configured`, `provider_refused` or `provider_unavailable` (above). Do not retry in a loop. |
| `RATE_LIMITED` | 429: a fourth parental consent request within an hour. |
| `NOT_FOUND` | The other player is not one of the app's players, or (`acceptContact`) has not asked. |
| `BAD_REQUEST` | A contact request to a player the caller has blocked. |

All codes are on [Error codes](/overview/error-codes).
