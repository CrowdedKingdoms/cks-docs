---
slug: sessions
sidebar_position: 17
title: Sessions
description: "The Game Model session API: create, find, join, watch, and leave a match, room, or lobby, the host-only actions and the turn, the active session every call falls back to, and every node and struct grouped in one place."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Sessions

A Game Model session is a group of players playing together, as the server records it: your match, room, lobby, or table. The record holds a roster, an admission rule, a seat cap, a host, presence, a turn, and a revision counter, and Game Model state created during play belongs to it. Every Game Model call takes a `SessionId`, and the SDK remembers an active session so most of them can leave it empty. [Sessions and Presence](../concepts/sessions-and-presence.md) is the concept; this page is the Unreal surface, every callable of it.

:::warning[UCrowdyGameSession is not a Game Model session.]
Same word, unrelated type. `UCrowdyGameSession` is this client's own sign-in and connection state: app id, user id, the server it is assigned to. It has no session id and is not truth about any match. Its read-only accessors are on [Authentication](../services/authentication.md). Everything on this page is the other thing: the session other players are in with you.
:::

## When you touch this

A lobby, a matchmaking list, a room code, a turn order, anything whose players and rules the server must agree on. A village night is one session in the Lantern world.

## The lobby flow

Create, then others List, then they Join by id, everyone hears changes on **On Game Session Changed**, the host locks admission when the match starts, and the host Ends it when it is over. Each step is one latent node below.

## The active session

:::danger[Every Game Model call takes a Session Id, and an empty one means the active session.]
The rule, in one place for every call (`UCrowdyGameModelSubsystem::ResolveSessionId`, which every boundary goes through): an explicit non-empty `SessionId` wins; otherwise the active session; otherwise the call is app-global. Create Game Session and Join Game Session make the new session active by default (`bMakeActive`), so after your first Create or Join every later session call, and every container call, targets the same session with the pin left empty. A pre-seeded or level-placed container binds into whichever session is active when its entity registers, so create or join before the match map's entities begin play.
:::

**Set Active Crowdy Session** (`SetActiveSession(SessionId)`), **Get Active Crowdy Session** (`GetActiveSession`), and **Clear Active Crowdy Session** (`ClearActiveSession`) on `UCrowdyGameModelSubsystem` read and change it by hand. A Leave or End of the active session forgets it.

:::note[Since 2.14]
The active session survives a map travel. Create or join in the lobby map, open the match map, and the match map's placed entities register inside that session because it is active before they begin play. On an older SDK the active session was lost on travel; do not rely on the lobby-then-match shape there.
:::

## Create, join, leave, end

All under **Crowdy SDK, Game Model, Sessions and Turns**. Every `Failed` pin carries an `FCrowdyModelFailure` (`FCrowdySessionFailureOutcome`): `Error`, an `ECrowdySessionError` to switch on (`None`, `NotSignedIn`, `NotAllowed`, `Full`, `Locked`, `Closed`, `Ended`, `NotParticipant`, `TargetNotParticipant`, `IncarnationStale`, `HostTermStale`, `Other`), the server's `Code`, and a `Message` for a human.

| Node | Factory | Succeeded carries | Notes |
|---|---|---|---|
| **Create Game Session** | `UCrowdyCreateSessionAction::CreateSession(Name, Options, ParticipantUserIds, bMakeActive, bWatchForChanges, MetadataJson)` | the session, `FCrowdyGameModelSession` (`FCrowdySessionOutcome`) | You are joined and host. |
| **Join Game Session** | `UCrowdyJoinSessionAction::JoinSession(SessionId, bMakeActive, bWatchForChanges, Role, bBindPresenceToMyActor)` | your roster row, `FCrowdyGameModelSessionParticipant` (`FCrowdySessionParticipantOutcome`) | Joining a session you are in reconnects you with a new incarnation. |
| **Leave Game Session** | `UCrowdyLeaveSessionAction::LeaveSession(SessionId, Incarnation)` | your roster row | Stops watching it. `Incarnation` 0 uses the one the SDK remembered. |
| **End Game Session** | `UCrowdyEndSessionAction::EndSession(SessionId, Reason, bRefuseIfHostChanged)` | the session | Host only. Everyone is marked left; `Reason` is `Completed` or `Abandoned` (`ECrowdySessionEndReason`). |

`Options` is an `FCrowdyGameModelCreateSessionOptions`: `MaxParticipants` (0 for no cap), `Admission` (`ECrowdySessionAdmission`: `Open`, `Locked`, `Closed`), `Presence` (`ECrowdySessionPresence`: `Actor` or `None`), `EmptyTimeoutSec` (-1 for the server default of five minutes, 0 for never), `IdempotencyKey`, and the two seed fields below.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The C++ facade on the subsystem takes a completion instead of pins and does not set the active session for you: call `SetActiveSession` in the completion, as `HostNight` and `JoinNight` do, or every later empty-`SessionId` call, the Leave below included, targets the app scope instead of the night; call `WatchSession` if you want the change event. The async nodes do both by default (`Make Active`, `Watch For Changes`). The owning client's pawn creates the night in `HostNight` once it learns it is locally owned, from `HandleOwnershipAssigned` (bound to `OnCrowdyOwnershipAssigned` in `BeginPlay`; a pawn spawned during play registers inside its first possession, after `BeginPlay`), and turns its torch yellow to show it is hosting. The handler and overlap bodies shown here are the part this page adds to `ALanternPlayer`; the lantern drop on [Entities and spawning](../runtime/entities-and-spawning.md), which declares the handler and the bind, and the enlist on [Kits](./kits.md) sit in the same functions.

<CppSnippet id="sess-create" />

Walking up to a lantern post (`NotifyActorBeginOverlap`) joins the night whose id the pawn holds in `NightSessionId`, picked from the lobby list below; `JoinNight` uses the success-only overload, enough when the roster row is not needed, makes the night active, and turns the torch blue.

<CppSnippet id="sess-join" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The pawn Blueprint needs a **Point Light** named `Torch`. At **Event BeginPlay**, **Get Crowdy Entity Component** feeds **Bind Event to On Crowdy Ownership Assigned**, whose `Event` pin is wired to a custom event, `OnOwnershipAssigned`, with the delegate's three parameters; a pawn spawned during play registers inside its first possession, after `BeginPlay`, so the owner answer arrives here. Its `Is Locally Owned` pin feeds a **Branch** (the owner gate: a pooled proxy of this pawn receives the event too, with the pin false), and the true side runs **Create Game Session** with `Name` = `Village Night`; on `Succeeded`, **Set Light Color** on `Torch`. The Join and Leave figures below leave that gate out: put an **Is Crowdy Entity Locally Controlled** branch in front of them too, since a proxy runs the overlaps as well.

<Blueprint src="sess-create" title="Event BeginPlay, Get Crowdy Entity Component, Bind Event to On Crowdy Ownership Assigned, OnOwnershipAssigned, Branch, Create Game Session, Get Torch, Set Light Color" />

**Event ActorBeginOverlap** runs **Join Game Session** with `Session Id` from a `NightSessionId` String variable; `Succeeded` colours the torch.

<Blueprint src="sess-join" title="Event ActorBeginOverlap, Get NightSessionId, Join Game Session, Get Torch, Set Light Color" />

</TabItem>
</Tabs>

:::warning[Presence is the player's actor. A client that never spawns one is expired after 60 seconds.]
`Options.Presence` is where you pick. A headless client, a bot, or a menu-only flow needs `None`, or it is silently dropped from the roster with `PresenceExpired`. The rule itself is on [Sessions and Presence](../concepts/sessions-and-presence.md).
:::

:::warning[A seed list is refused wholesale, and SeededContainerCount is on the Create response only.]
`SeedFromAppTypeNames` lists container types whose app-scoped rows are copied into the new session as it is created, with `SeedInitialState` (`ECrowdySessionSeedState`: `Defaults` or `App`) saying what the copies start with. If any listed type is not admin-instantiable, has no bind policy, or is itself app-scoped, the whole Create fails; nothing is skipped. The count comes back as `SeededContainerCount` with `bHasSeededContainerCount` true on that response and never on a later read; do not poll it. That is the entire Unreal surface of session seeding: a request with two fields, not a feature with a UI. Mechanics and caps are on [Seeding a session from the app](/game-api/game-models#seeding-a-session-from-the-app).
:::

:::note[Since 2.14]
`SeedFromAppTypeNames` and `SeedInitialState` on Create Game Session are new in this version.
:::

:::warning[Leave needs the incarnation this subsystem remembered, or one you pass.]
Your Create or Join on this subsystem recorded it, so `Incarnation` 0 is right for the client that joined. A different window or a fresh launch never joined on this subsystem, so its Leave fails locally before reaching the server unless it passes an incarnation read from a snapshot. **Get Remembered Session Incarnation** (`GetRememberedSessionIncarnation(SessionId)`) reads what is remembered.
:::

## Queries

| Node | Factory | Succeeded carries |
|---|---|---|
| **Get Game Session** | `UCrowdyGetSessionAction::GetSession(SessionId)` | `FCrowdyGameModelSession`: host, seat count, admission, turn. |
| **List Game Sessions** | `UCrowdyListSessionsAction::ListSessions(Status, Admission, HostUserId, Limit)` | a `TArray<FCrowdyGameModelSession>` (`FCrowdySessionsOutcome`). Filters `ECrowdySessionStatusFilter` (`Active` by default, `Any`, `Completed`, `Abandoned`) and `ECrowdySessionAdmissionFilter` (`Any`, `Open`, `Locked`, `Closed`); `HostUserId` 0 is any host, `Limit` 0 the server's page. Nothing pushes a new session to a client: refresh to see it. |
| **Get Game Session Snapshot** | `UCrowdyGetSessionSnapshotAction::GetSessionSnapshot(SessionId)` | `FCrowdyGameModelSessionSnapshot` (`FCrowdySessionSnapshotOutcome`): `Session`, `Participants`, `Revision`. The resync read. |
| **Get Game Session Events** | `UCrowdyGetSessionEventsAction::GetSessionEvents(SessionId, AfterRevision, Limit)` | a `TArray<FCrowdyGameModelSessionEvent>` (`FCrowdySessionEventsOutcome`): the change log after a revision, 0 for all of it. |

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`RefreshNightSessions` on the game instance lists the active, open nights into an `OpenNights` array a lobby widget reads; a player picks one and the pawn joins it above.

<CppSnippet id="sess-query" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The same query as the C++ block: a custom event `RefreshNight` runs **List Game Sessions** with `Admission` = `Open` (`Status` stays `Active`); on `Succeeded`, **Is Not Empty** over `Sessions` drives **Set Visibility** on `Torch`, so the torch shows while there is an open night to join. The pawn Blueprint needs the `Torch` component. In C++, a handler bound to the array-carrying `Succeeded` pins takes the array as `const TArray<T>&` (by value on 2.14.0 and earlier; see [What's Changed](../guides/whats-changed.md#2026-09-22-sdk-v2150)).

<Blueprint src="sess-query" title="RefreshNight, List Game Sessions, IS NOT EMPTY, Get Torch, Set Visibility" />

</TabItem>
</Tabs>

## Host actions and the turn

| Node | Factory | Who |
|---|---|---|
| **Set Game Session Admission** | `UCrowdySetSessionAdmissionAction::SetSessionAdmission(Admission, SessionId, bRefuseIfHostChanged)` | Host. `Open` lets anyone in, `Locked` lets only players already in reconnect (lock when the match starts), `Closed` lets nobody in. |
| **Transfer Game Session Host** | `UCrowdyTransferSessionHostAction::TransferSessionHost(ToUserId, SessionId, bRefuseIfHostChanged)` | Host. `ToUserId` is an `int64` of a current participant. |
| **Set Game Session Turn** | `UCrowdySetSessionTurnAction::SetSessionTurn(UserId, SessionId, bClearTurn, bRefuseIfHostChanged)` | The turn holder, the host, or an app admin. The returned session carries the new turn holder. |

All three and End return the session on `Succeeded` (`FCrowdySessionOutcome`).

:::warning[HostTermStale is the guard working, not a bug.]
By default (`bRefuseIfHostChanged`, an advanced pin) a host action sends the host term this client last read, and the server refuses with `HostTermStale` if the host changed since, so a replaced host never acts by mistake. Re-read the session with Get Game Session or the snapshot and retry. Do not reach for `bRefuseIfHostChanged` off as the fix; in C++ the equivalents are `UseKnownHostTerm` and `SkipHostTermCheck`. **Get Known Session Host Term** (`GetKnownSessionHostTerm(SessionId)`) reads what this client last saw.
:::

## Hearing about changes

**On Game Session Changed** (`OnSessionChanged`, `FCrowdyOnSessionChanged`) on the subsystem fires on the game thread for every change this client hears about, with an `FCrowdyGameModelSessionEvent`: `SessionId`, `Revision`, `Kind` (`ECrowdySessionEventKind`: `Created`, `ParticipantJoined`, `ParticipantRejoined`, `ParticipantLeft`, `ParticipantExpired`, `HostChanged`, `AdmissionChanged`, `TurnChanged`, `Ended`, `Unknown`), `bIsCue`, `UserId`, `HostUserId`, `PreviousHostUserId`, `Admission`, and the advanced detail fields. Create and Join watch the session for you (`bWatchForChanges`); **Watch Game Session** (`WatchSession(SessionId, AfterRevision)`) and **Unwatch Game Session** (`UnwatchSession(SessionId)`) do it by hand, with `AfterRevision` -1 starting from now and a held revision replaying everything after it.

:::warning[The same revision can arrive twice. Dedupe by Revision, not by Kind.]
A cue on the app's session channel carries no detail (`bIsCue` true, `PayloadJson` empty) and the watched stream carries the full event, and both feed the delegate. A gap, seeing N then N+2, means pull **Get Game Session Snapshot** again.
:::

:::caution[Watch, Unwatch, and Get Last Session Failure each exist twice in the palette.]
Once as a static `UCrowdyGameModel` node with a World Context pin and no target, and once as an instance node on `UCrowdyGameModelSubsystem` behind **Get Game Model Subsystem**. Either works; pick one per graph.
:::

## Leaving

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

Stepping away from the post is leaving the night: `NotifyActorEndOverlap` calls `LeaveNight`, which leaves the active session (the one `HostNight` or `JoinNight` set with `SetActiveSession`) with `Incarnation` 0 and puts the torch out on the answer.

<CppSnippet id="sess-leave" />

</TabItem>
<TabItem value="bp" label="Blueprint">

**Event ActorEndOverlap** runs **Leave Game Session** with `Session Id` empty; `Succeeded` sets `Torch`'s intensity to 0.

<Blueprint src="sess-leave" title="Event ActorEndOverlap, Leave Game Session, Get Torch, Set Intensity" />

</TabItem>
</Tabs>

## Pure helpers

On `UCrowdyGameModel`, each resolving the subsystem from the World Context:

| Node | Function | One line |
|---|---|---|
| **Get Local User Id** | `GetLocalUserId` | The signed-in user's `int64` id, 0 when signed out. |
| **Is My Turn** | `IsMyTurn(Session)` | The turn holder is the local user. A client-side gate; the server's `is_current_turn` policy is the enforcement. |
| **Is Session Host** | `IsSessionHost(Session)` | The host is the local user. Client-side gate for showing host controls. |
| **Is Session Joinable** | `IsSessionJoinable(Session)` | Active, open, and a free seat. Decides whether to show a Join button; the server is the judge. |
| **Get Last Session Failure** | `GetLastSessionFailure`, or `GetLastFailure` on the subsystem | The last refused session call as an `FCrowdyModelFailure`, for a `Failed` pin you left unwired. |

## The session struct

`FCrowdyGameModelSession` carries `SessionId`, `Name`, `Status` (`ECrowdySessionStatus`: `Active`, `Completed`, `Abandoned`, `Unknown`), `CreatedByUserId`, `CurrentTurnUserId` with `bHasCurrentTurn`, `Admission`, `MaxParticipants` with `bHasMaxParticipants`, `ParticipantCount`, `HostUserId` with `bHasHost`, `Presence`, `EndReason`, the seed count pair, and the advanced `HostTerm`, `Revision`, `MetadataJson`, `CreatedAt`, `EndedAt`. A roster row, `FCrowdyGameModelSessionParticipant`, carries `SessionId`, `UserId`, `Role`, `State` (`ECrowdySessionParticipantState`: `Joined`, `Left`, `Unknown`), `LeftReason` (`ECrowdySessionLeftReason`: `None`, `Left`, `PresenceExpired`, `SessionEnded`, `Kicked`, `Unknown`), and the advanced `Incarnation`, `ActorUuid`, `JoinedAt`, `LeftAt`.

## Gotchas

- Sessions are truth-plane. Whose turn it is and who hosts are never [Crowdy State](../runtime/crowdy-state.md) properties.
- The session host here is a server fact. The elected host of the view plane is a different thing, and `is_host` on an invoke policy is that elected host, not this session host; [The Host Is a Convention](../concepts/host-is-a-convention.md) and [Invoke policies](./invoke-policies.md).
- `is_participant` is this session: an active Create / Join record, a joined roster row, and a `SessionId` on the invoke. Teams, the login session, and the UDP session channel do not satisfy it.
- A session nobody has been in for the empty timeout is ended by the server with `EmptyTimeout`.
- `Role` on Join is a free label your game gives the player, empty for the server's default.
- Session creation policy, admission semantics, and the event log are server behaviour: [Sessions, ownership, and turns](/game-api/game-models#sessions-ownership-and-turns).

## Related

- [Sessions and Presence](../concepts/sessions-and-presence.md): the lifecycle and the presence rule.
- [Pre-seeding](./pre-seeding.md): the app-scoped rows a seed list copies from, and applying a manifest into a session.
- [Collections](./collections.md): free containers, which take the same `SessionId` rule.
- [Change pings and pull](./change-pings-and-pull.md): the same cue-then-pull pattern, for containers.
- [Authentication](../services/authentication.md): `UCrowdyGameSession`, the other "session".
