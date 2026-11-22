---
slug: player-safety
sidebar_position: 4.7
title: Player Safety
description: "A player's own controls in your app: who hears and sees them, contacts, blocks, a parent's consent, and reports to the app's moderators."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Player Safety

Player safety is a player's own controls in your app: who hears and sees them, their contacts, who they have blocked, a parent's consent to voice or video, and reports to the app's moderators. The realtime servers enforce all of it, so nothing here relies on your client behaving, and a change reaches the player's live sessions within a second. What the platform does with these settings is on [Voice, video, contacts and blocks](/application-api/communication).

## When you touch this

When your game offers voice, video or text between players. It needs a settings screen, a way to block and report wherever players meet, and controls that match what the player may do. Without one, a player still has the platform's defaults, but no way to change them.

## The nodes

Everything lives on the **Crowdy Safety** subsystem (`UCrowdySafety`, a Game Instance subsystem), and every call needs the player signed in to the app. In Blueprint each call is a latent node with **On Success** and **On Error** pins. In C++ each call takes a success delegate and an `FOnSafetyError`.

| Blueprint | C++ | Does |
|---|---|---|
| **Get Communication Settings** | `GetCommunicationSettings(OnSuccess, OnError)` | Reads the player's settings as a **Crowdy Communication Settings**. |
| **Set Communication Setting** | `SetCommunicationSetting(Setting, Scope, OnSuccess, OnError)` | Stores one of the player's four choices and leaves the others. Answers with the settings as they now stand. |
| **Request Parental Consent** | `RequestParentalConsent(Feature, ParentEmail, OnSuccess, OnError)` | Asks a parent about **Voice** or **Video**, and says whether an email went. Three requests an hour. |
| **Get Contacts** | `GetContacts(OnSuccess, OnError)` | The player's contacts as **Crowdy Player Contact** rows: **User Id**, and **Accepted** once both sides have agreed. |
| **Get Contact Requests** | `GetContactRequests(OnSuccess, OnError)` | Requests waiting in both directions, as **Crowdy Contact Request** rows: **User Id**, and **Incoming** when the other player asked. |
| **Request Contact** | `RequestContact(UserId, OnSuccess, OnError)` | Asks another player to be a contact. Answers with a **Crowdy Player Contact**, already **Accepted** if they had asked first. |
| **Accept Contact** | `AcceptContact(UserId, OnSuccess, OnError)` | Accepts a request. |
| **Remove Contact** | `RemoveContact(UserId, OnSuccess, OnError)` | Removes a contact, or declines a request. |
| **Get Blocks** | `GetBlocks(OnSuccess, OnError)` | The players this player has blocked, as **Crowdy Player Block** rows. |
| **Block Player** | `BlockPlayer(UserId, OnSuccess, OnError)` | Blocks a player. It works both ways, and the other player is not told. |
| **Unblock Player** | `UnblockPlayer(UserId, OnSuccess, OnError)` | Removes a block. |
| **File Report** | `FileReport(ReportedUserId, Reason, Details, ReportedActorUuid, OccurredAt, OnSuccess, OnError)` | Reports a player to this app's moderators. **Details**, **Reported Actor Uuid** and **Occurred At** are optional. |

In C++ the success delegates are `FOnCommunicationSettings`, `FOnConsentRequested`, `FOnPlayerContact`, `FOnPlayerContacts`, `FOnContactRequests`, `FOnPlayerBlocks` and `FOnSafetyDone`. A Blueprint node belongs to `UCrowdySafety_CommunicationSettings`, `UCrowdySafety_RequestParentalConsent`, `UCrowdySafety_RequestContact`, `UCrowdySafety_GetContacts`, `UCrowdySafety_GetContactRequests`, `UCrowdySafety_GetBlocks` or `UCrowdySafety_Command`, and its pins are `FCommunicationSettingsAsyncResult`, `FConsentRequestAsyncResult`, `FContactRequestAsyncResult`, `FPlayerContactsAsyncResult`, `FContactRequestsAsyncResult`, `FPlayerBlocksAsyncResult` and `FSafetyCommandAsyncResult`.

**Set Communication Setting** names a **Crowdy Communication Setting** and a **Crowdy Communication Scope**: **Off**, **Contacts** or **Everyone**. A consent request names a **Crowdy Consent Feature** and answers a **Crowdy Consent Status**: only **Requested** sent an email, while **Already Granted** and **Not Required** sent nothing. A report names a **Crowdy Safety Report Reason**.

| Blueprint | C++ |
|---|---|
| **Crowdy Communication Settings** | `FCrowdyCommunicationSettings` |
| **Crowdy Communication Choices** | `FCrowdyCommunicationChoices` |
| **Crowdy Communication Setting** | `ECrowdyCommunicationSetting` |
| **Crowdy Communication Scope** | `ECrowdyCommunicationScope` |
| **Crowdy Consent Feature** | `ECrowdyConsentFeature` |
| **Crowdy Consent Status** | `ECrowdyConsentStatus` |
| **Crowdy Safety Report Reason** | `ECrowdySafetyReportReason` |
| **Crowdy Player Contact** | `FCrowdyPlayerContact` |
| **Crowdy Contact Request** | `FCrowdyContactRequest` |
| **Crowdy Player Block** | `FCrowdyPlayerBlock` |
| **Crowdy Safety Error** | `FCrowdySafetyError`, with `ECrowdySafetyErrorCode` |
| **Crowdy App Recording** | `FCrowdyAppRecording` |

## Reading what a player may do

**Crowdy Communication Settings** holds **Voice Send**, **Voice Receive**, **Video Send** and **Video Receive**, the scopes that apply right now, and **Choices**, a **Crowdy Communication Choices** with what the player chose. Show **Choices** on a settings screen: policy may hold what applies below them, and a choice the player has not made reads **Everyone**. **Voice Allowed** and **Video Allowed** are the most each may be now, **Is Minor** says whether the under-18 rules apply, and **Voice Consent** and **Video Consent** say whether a parent has agreed.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`ReadVoiceSettings` asks for the settings, and the handler darkens the torch while voice is off.

<CppSnippet id="safety-settings" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Event BeginPlay calls **Get Communication Settings**. On Success breaks the settings and darkens the torch when **Voice Send** is **Off**.

<Blueprint src="safety-settings" title="Event BeginPlay, Get Communication Settings, Break Crowdy Communication Settings, Equal, Branch, Set Intensity" />

</TabItem>
</Tabs>

## Blocking a player

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`BlockVillager` blocks a player by their user id. The torch turns white when the block lands and red when it is refused.

<CppSnippet id="safety-block" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A custom event, **BlockVillager** with a **Player Id**, calls **Block Player**. On Success turns the torch white and On Error turns it red.

<Blueprint src="safety-block" title="BlockVillager, Block Player, Set Light Color, Set Light Color" />

</TabItem>
</Tabs>

## What a block covers

A block stops voice, video, text, direct messages, channel messages and a player's events between the two players, both ways. Blocking also removes every contact and request between them, and unblocking does not bring them back.

- **Voice has a lighter control too.** **Set Voice Speaker Muted** and **Set Voice Speaker Volume** quiet one player's voice for this client only, by user id, and the other player is not affected. Nothing is enforced and nothing else is stopped, so a block is still the stronger control. See [Mute or turn down one player](./voice-chat.md#mute-or-turn-down-one-player).
- **Movement, actor state and voxel edits still pass,** so both players go on seeing the same world.
- **What your app's own server code sends is not filtered.** A hub that relays one player's words to another checks the block first: see [blocks in Server Objects](/exec/players-and-safety#blocks).

## Reporting a player

Filing a report keeps both players' recordings from 15 minutes before **Occurred At**, so pass when it happened, in UTC. A report filed from a menu some time later would otherwise miss the incident: left at its default, or in the future, **Occurred At** is now. Pass the reported player's actor id as **Reported Actor Uuid** when you have it. What moderators see is on [Safety reports and moderation](/application-api/safety-reports).

## Find out who a player is

A remote player's actor id is not a user id, and **Block Player** and **File Report** both need a user id. **Resolve Actor Owner** asks the platform which user it has registered an actor id to. Use it beside anything a remote player shows you, such as a nearby chat line, a video frame or a spawned pawn, to get the user id for a block or report button.

Only a player's own entity id resolves; ids your game gives other actors answer **Unknown**. From a video frame, pass its `SenderUUID`.

At each sign-in, before its realtime connection opens, the SDK creates the player's own actor record for the session's actor id at chunk (0,0,0), so other clients can resolve it. The connection opens once that create has answered: made, already the player's, or given up. Until then, and while signed out, **Request UDP Access** and the SDK's reconnects open nothing. A failure is retried up to three times, 10 seconds apart, then logged as a warning, so a create that keeps failing delays the connection by about 20 seconds plus the time its attempts take. When another player's record already holds the id, the SDK takes a fresh id and re-keys, up to three times, then warns.

The SDK deletes only records this client made:

- the previous id's record, once the new one exists;
- the current record at sign-out (the server session ends once that delete answers or 2 seconds have passed);
- at a sign-in as another user over a live one, the previous user's record, first.

A record the server reports as existing without saying it is the player's is used but never deleted. The SDK never lists or deletes any other record, so another device's live record, your game's own records and a record left by a crash all stay. Any actor record that names a user answers with that user, whoever made it. A call to `createActor` with the player's entity id answers `ACTOR_EXISTS`, since the SDK has made the record.

`UCrowdyActorOwners` is a game instance subsystem; `ResolveActorOwner(ActorId, OnResolved)` answers once (an `FOnActorOwnerResolved`) with an `FCrowdyActorOwner` holding `Result` (an `ECrowdyActorOwnerResult`: `Confirmed`, `Unknown` or `Failed`), `UserId` and `Message`, and C++ also has a lambda overload. The Blueprint node (`UCrowdyActorOwners_ResolveActorOwner`) has the pins **On Confirmed**, **On Unknown** and **On Failed**, each an `FActorOwnerAsyncResult` carrying the same struct. The Blueprint node always answers on a later tick, so asking again from a pin does not recurse. The C++ call answers inside the call for an unset id or an answer it already holds, and on a later tick otherwise.

| Result | Means |
|---|---|
| **Confirmed** | The platform's record registers this id to `UserId`. |
| **Unknown** | No record ties this id to a user, or the id is not set. Name no one for it. |
| **Failed** | The platform could not be asked. Ask again later. |

:::warning[Confirmed says whose record holds the id, not who sent a message under it.]
**Confirmed** says whose record holds the id; it does not prove that player sent a given message. Use it to offer **Block** and **Report** to the player; do not use it to decide who may do something. Anything that must be trusted belongs in a Server Object. See [Actor state](/application-api/actor-state).
:::

An **Unknown** answer is remembered for 10 seconds, at most 1,024 of them. A **Confirmed** answer is kept until the player signs out. A **Failed** answer is not kept. Asks made in one tick are batched, 50 ids per request, and an id already being asked is not asked twice.

The lantern village's `NameRemoteKeeper(RemoteActorId)` resolves a remote keeper's actor id and, on **Confirmed**, stores the user id in `RemoteKeeperUserId`, ready for a block or report button.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="actor-owner" />

</TabItem>
<TabItem value="bp" label="Blueprint">


A custom event `NameRemoteKeeper` with an `Actor Id` calls **Resolve Actor Owner**; **On Confirmed** breaks the **Crowdy Actor Owner** pin and sets `RemoteKeeperUserId` from `User Id`.

<Blueprint src="actor-owner" title="NameRemoteKeeper, Resolve Actor Owner, Break Crowdy Actor Owner, Set RemoteKeeperUserId" />

</TabItem>
</Tabs>

## What your game shows

- Do not offer a microphone or camera while **Voice Send** or **Video Send** is **Off**: those sends are refused.
- When a medium is off for a player with **Is Minor** set, say that a parent's consent turns it on, without naming an age, and offer **Request Parental Consent**. With consent, the most it can be is **Contacts**.
- Put **Block** and **Report** beside each other wherever players meet, and list blocked players with an unblock. For a player you only know by actor id, ask **Resolve Actor Owner** first.
- **Show the recording notice and indicator** while the app records voice or video. This one is required: see the next section.

## Telling players when the app records

While your app's safety log records voice or video, your game tells players before they speak or appear on camera, and shows them while it records. This is required: see [the safety log](/replication-api/input-logging#the-safety-log). The app's admins decide what is recorded, so read it rather than assume it.

The SDK reads it when the player connects and when their token refreshes:

| Blueprint | C++ | Does |
|---|---|---|
| **On Recording State Changed** | `OnRecordingStateChanged` (`FOnRecordingStateChanged`) | Fires with a **Crowdy App Recording** on the first read and when what the app records changes. |
| **Get Recording State** | `GetRecordingState()` | What the app records, as last read. Check it when you bind, since the first read may already have landed. |
| **Refresh Recording State** | `RefreshRecordingState()` | Reads it again now. |

**Crowdy App Recording** holds **Enabled**, the safety log itself, which always includes text, and **Voice** and **Video**. **Known** is false until a read has landed, and a failed read leaves it so: that means not known, not "not recording", so hold the microphone and camera until it is true, or call **Refresh Recording State**. If voice is recorded, the microphone is open and nothing is bound to **On Recording State Changed**, the SDK logs a warning once. It does not draw the notice for you, because it cannot know your game's screens, and it does not stop the player's voice.

## Refusals

**On Error** gives a **Crowdy Safety Error**, with the server's own **Message** and a **Code**:

| Code | Means |
|---|---|
| **Consent Unavailable** | Consent cannot be asked, and nothing was sent. **Reason** says why: `not_configured` (no consent service yet, do not retry), `provider_refused` (a parent's other address may work) or `provider_unavailable` (retry shortly). |
| **Limit Reached** | 100 waiting requests, 1,000 contacts or 1,000 blocks in one app. |
| **Rate Limited** | Too many requests, such as a fourth consent request in an hour. |
| **Network Error** | The call never got an answer. |
| **Server Error** | Anything else. |
