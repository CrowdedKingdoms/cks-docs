---
sidebar_position: 31.5
title: Game servers and fleet sessions
---

# Run your own game servers with a fleet session

A fleet session is one realtime session that your game server holds for itself. The server
*carries* the players who are on it: it sends and receives for each of them on that one
session. One hub connection does the same for your app's [hubs](/exec/intro). When a player
moves to another of your servers, that server starts to carry the player with one small
message and makes no Application API call.

This guide is for an organization that runs its own game servers and signs its players in as
[org-managed players](/management-api/org-managed-players). A game that runs on a player's
device keeps using that player's own session and needs nothing here.

:::note[What is switched on]
Fleet sessions need Application API v2.89.1, realtime servers v0.50.3, and ck-exec 0.25.0.
All three are in production since November 26, 2026. Crowded Kingdoms switches fleet sessions
on for one organization at a time
([below](#what-you-need-before-the-first-session)). CrowdyCPP 0.94.1, CrowdyJS 18.40.0, and
CrowdyPy 0.40.0 carry them. CrowdyCPP 0.95.0, CrowdyJS 18.41.0, and CrowdyPy 0.41.0 add what
Application API v2.90.0 and realtime servers v0.51.0 brought. A server written in another
language calls the Application API
and speaks the
[wire formats](/replication-api/wire-formats#fleet-sessions-messages-49-to-53) itself.
:::

## One session for each game server carries that server's players

Without a fleet session, a game server signs each player in, opens a realtime session for that
player, and opens a hub connection for that player. A game made of many servers repeats all
three each time a player moves to the next server. If 3,000 players each cross between
servers about every 40 seconds, that is 75 sign-ins a second for as long as anyone plays.

We measured the same load with fleet sessions on November 26, 2026, on Crowded Kingdoms'
internal dev environment: 100 fleet sessions carried 3,000 players for 30 minutes. The players
made 135,106 crossings in those 30 minutes, 75 a second. None was lost, and no crossing called
the Application API. A carry was answered in 36 ms at the median and in 50 ms at the 99th
percentile.

We measured twice that crowd on November 27, 2026, on the same environment, with realtime
servers v0.51.0 on three servers: 200 fleet sessions carried 6,000 players for 15 minutes. The
players made 135,095 crossings in those 15 minutes, 150 a second. None was lost, and a carry was
answered in 36 ms at the median and in 57 ms at the 99th percentile. The 3,000-player load,
run again that day on v0.51.0, made 135,092 crossings in its 30 minutes, 75 a second, and none
was lost.
No larger crowd, and no faster rate of crossing, has been measured.

With a fleet session:

- **A player signs in once**, when they join the game (`mintManagedPlayerToken`, as for any
  managed player). The answer carries the player's `userId` (Application API v2.90.0), so your
  server needs no `me` call to learn who it signed in.
- **Each game server opens one session** when it starts, and carries the players on it.
- **A crossing is one message to the realtime servers.** A crossing is a player moving from
  one of your servers to another: the server the player arrives on carries them, and the
  server they left is told.

The platform still decides everything by the player a message names. A carried player keeps
what a player with their own session has:

- **Actors.** A message under an actor is accepted only when the carried player it names owns
  that actor.
- **Permissions.** The player's own access tier decides spatial access, voice, video, text,
  and direct messages, and their grid permissions decide voxel edits.
- **Blocks, age rules, and communication settings**, checked for the sender and for each
  receiver ([Voice, video, contacts and blocks](/application-api/communication)).
- **Speaker lists.** Each carried player has their own
  ([`CLIENT_MEDIA_SPEAKERS`](/replication-api/wire-formats#speaker-lists-client_media_speakers-47)).
- **The input log and the safety log** record the carried player as the author.
- **The idle timeout.** A carried player who sends no gameplay input for the app's idle timeout
  is released. The session stays.
- **The send rate.** Each carried player has the budget a session has: 500 messages a second,
  with bursts to 1,000. One player's flood does not spend another's budget.

## What you need before the first session

1. **Org-managed players switched on, and the addendum accepted.** See
   [Org-managed players](/management-api/org-managed-players).
2. **Fleet sessions switched on for your organization.** Crowded Kingdoms does this. Write to
   hello@crowdedkingdoms.com with your organization, the app, how many game servers you run,
   and how many players one server holds. `orgManagedPlayerSettings(orgId)` then reports
   `fleetSessionsEnabled`, `maxFleetSessions`, and `maxFleetPlayers`.
   [What your organization can change](/overview/organization-limits#crowded-kingdoms-switches-fleet-sessions-on-and-sets-how-many-you-hold)
   lists every setting Crowded Kingdoms holds for an organization and what to send for each.
3. **An org token with the scope `fleet:session`.** Create it with an org admin's session:

   ```graphql
   mutation {
     createOrgToken(input: {
       orgId: "<your org id>"
       label: "game servers"
       scopes: ["players:mint", "fleet:session"]
     }) { orgTokenId token }
   }
   ```

   `players:mint` lets the same token sign your players in. `appIds` limits the token to some
   of your apps. The secret starts with `cko_` and is shown once.

## Keep both tokens on your servers

Your server holds two secrets: the org token you created above, and the *fleet token* that
`openFleetSession` answers for each session. The fleet token is the key your server signs that
session's messages with.

:::warning[An org token and a fleet token never leave servers you run]
Put neither in a game client, a web page, or anything a player can download. A fleet token
signs for every player its session carries, and an org token signs your players in.
:::

- **The org token** opens, refreshes, and closes fleet sessions and connects your server to
  your app's hubs. The Application API refuses an org token sent with an `Origin` header
  (`ORG_TOKEN_NOT_ALLOWED`), so a browser cannot use one.
- **The fleet token** signs one session's messages. The Application API does not accept it as a
  bearer, so it signs nobody in and cannot renew itself.
- **A player's app token** comes from that player's sign-in: your server calls
  `mintManagedPlayerToken` after your own sign-in succeeds, as it does for any managed player.
  The game server that carries the player holds the token. At a crossing, send it to the
  next server over a link between your own servers that you authenticate and encrypt.
- **Refresh and close work only with the org token that opened the session.** Another org token
  of the same organization gets `NOT_FOUND` from `refreshFleetSession` and `false` from
  `closeFleetSession`.
- **Revoking an org token ends everything it opened:** its fleet sessions and its hub
  connections. `revokeOrgToken(orgTokenId, endSessions: true)` also ends the sign-ins it made.
- **Never log the answers of `openFleetSession`, `refreshFleetSession`, or
  `execConnectAsServer`.** The first two hold the fleet token, and the third holds a hub
  connect token. The hub connect token travels in the WebSocket URL's query string, as a
  player's does, so keep that URL out of your logs too. It lasts a minute, and your server
  asks for a new one at each reconnect.

**What a leaked fleet token is worth.** Whoever holds it can send as the players that session
already carries, in one app, until the session expires (24 hours at most, because only the org
token renews it) or you revoke the org token that opened it. They cannot carry another player
without that player's own token, cannot sign anyone in, and cannot reach another app or
organization.

## The life of a session, from open to close

```
Game server 1               Application API          Realtime servers         Game server 2
     |-- openFleetSession ------->|                         |                       |
     |<- fleet token, server -----|                         |                       |
     |-- CLIENT_CAPABILITIES (29) ------------------------->|                       |
     |        a player joins      |                         |                       |
     |-- mintManagedPlayerToken ->|                         |                       |
     |<- the player's app token --|                         |                       |
     |-- FLEET_CARRY (49) --------------------------------->|                       |
     |<- FLEET_CARRY_RESULT (51), status 0 -----------------|                       |
     |-- the player's messages, signed with the fleet token>|                       |
     |        the player crosses to server 2                |                       |
     |-- the player's app token, over your own link ------------------------------->|
     |                            |                         |<--- FLEET_CARRY (49) -|
     |                            |                         |-- FLEET_CARRY_RESULT >|
     |<- FLEET_RELEASED (52), reason 1 ---------------------|                       |
```

### Open a session when the server starts

Call `openFleetSession(input: { appId })` with the org token, on the app's own Application API
address (`applicationApiUrl`). The answer is the fleet token (64 characters), its
`gameTokenId`, `expiresAt` (24 hours away), `maxPlayers`, and the realtime server to connect
to. Open one session for each game server.

Then send [`CLIENT_CAPABILITIES`](/replication-api/wire-formats#signed-bundles--message_bundle_signed-30-and-client_capabilities-29)
(29) to that server's `clientPort`, signed with the fleet token and carrying the session's own
`gameTokenId`. That first signed datagram binds the session to your address. Advertise
`BUNDLE_SIGNED` and `BOUND_CONTROL` in it: a refusal of a send then arrives verified, and the
realtime server acknowledges each capabilities message, which is how your server knows the
session is alive ([below](#what-ends-a-session-and-what-ends-a-carry)). Connect your UDP
socket to the realtime server's address, so the operating system drops datagrams from anywhere
else. The SDKs do.

### Carry each player who arrives

Send `FLEET_CARRY` (49) with the player's `gameTokenId`, the time, and a proof made with the
player's token: an HMAC-SHA256 keyed with the player's 64-character token over the fleet
session's `gameTokenId`, the player's `gameTokenId`, and the time. The realtime servers answer
`FLEET_CARRY_RESULT` (51):

| Status | Meaning | What to do |
|---|---|---|
| 0 | Carried. The answer carries the player's user id. | Start sending for the player. |
| 1 | No live token by that id, or the token is for another app. | Send the carry once more about 250 ms later, with a new time and proof. If the answer is 1 again, sign the player in again, or refresh their token, then carry. |
| 2 | The player belongs to another organization. | You cannot carry this player. |
| 3 | The proof failed, the time is more than 30 seconds from the realtime server's, or the message was a replay. | Check your server's clock, then send a new carry. |
| 4 | The session already carries as many players as it may. | Open a second session, or ask for a higher `maxFleetPlayers`. |

A carry can go unanswered: the realtime servers drop a session's carries past 64 a second,
and a carry can go unanswered for other reasons too. Send it again with a new time and a new
proof until the result arrives. The SDKs do.

### Send and receive for the players you carry

**Sending.** Each message is the message that player's own session would send, with two
differences in the tail: the game token ID is the carried player's, and the HMAC is keyed with
the fleet token. A message costs no more bytes than it does on a player's own session. A
message that names a player the session does not carry is answered `UNAUTHORIZED`.

**Receiving.** The session is sent each message once:

- **State** (actor updates and departures, voxel edits, server events, and chunk changes)
  arrives as the plain notification when at least one carried player may receive it. Apply it
  once, however many of your players can see it.
- **Communications** (spatial voice, text, and video, direct messages, channel messages, and
  channel audio) arrive inside `FLEET_DELIVERY` (53), which lists the carried players who may
  receive the message. Deliver it to those players and no others. A block, a player under 18, a
  speaker list, or a missing permission takes a player off the list.
- **A player's events and app-defined spatial messages** are checked for each receiver too.
  When every carried player in range may receive one, it arrives plain. When only some may, it
  arrives inside a `FLEET_DELIVERY` that lists them.
- **Your own players' state does not come back.** A game server already simulates its own
  players. Set capability bit 3 (`FLEET_OWN_STATE`) if you want it. Two things come back with
  the bit off: a voxel edit the session sent, and the departure of one of its own players'
  actors.

Voice and video do not keep a carried player present. Each player needs gameplay input within
the app's idle timeout, and an idle actor needs a heartbeat, as on a player's own session.

**A heartbeat keeps an actor present only where the player may enter** (realtime servers
v0.51.0). A carried player's heartbeat is judged for that player, as their actor update is.
Where the player has no `access`, every heartbeat for the actor is answered `UNAUTHORIZED`
inside the session's signed bundle. The player is not present there, the session is sent
nothing of the place for that player, and the session still carries the player. Keep sending
at the same cadence, never faster, and do not treat the player as present. A refused heartbeat
is not gameplay input for the idle timeout and is not counted as data in. After access is
granted, the next heartbeat is admitted within about 6 seconds. If your players only stand
where they may enter, your server has nothing to change. The session's own keep-alive is not
held to `access`. See
[the keepalive rule](/replication-api/wire-formats#a-keepalive-is-accepted-only-where-the-actors-update-would-be).

### A player crosses to another of your servers

The server the player leaves stops sending for the player, then sends the player's app token
to the next server over your own link. The next server sends `FLEET_CARRY`. The newest carry
wins, so the player is never carried by two sessions.

- **The server the player left learns it in two ways.** It is sent `FLEET_RELEASED` (52) with
  reason 1, once. That message can be lost, and it can arrive up to about 6 seconds late. The
  sign to rely on is the refusal of its next send for the player (`UNAUTHORIZED`).
- **Stop sending before you hand the player off.** For a few milliseconds after a crossing,
  and rarely for up to about 5 seconds, the realtime servers can still accept the previous
  session's sends for the player.
- **The server the player arrived on treats state for that player as stale.** Just after the
  carry, it can receive a few state updates for the player that the previous session sent a
  moment before. Your server is the authority on the players it carries.

### Refresh each carried player's token

A player's app token lasts 30 minutes today. The server that holds it refreshes it before its
`expiresAt` (`refreshAppToken`), which answers a new token and a new `gameTokenId`.

1. Send `FLEET_CARRY` with the new token.
2. From that moment, name the new `gameTokenId` on every send for the player. A send that
   names the new id and arrives before the carry takes effect waits for it.
3. Once the new carry takes effect, a send that still names the old id is answered
   `UNAUTHORIZED`.

The carry made with the old token stands until the new one takes effect, so there is no gap,
and the player keeps their actors and their idle clock. A carried player whose token expires
with no new carry is released with reason 2 at the expiry, and a send that lands just before
it is answered `TOKEN_EXPIRED`.

### Refresh before the session expires

Call `refreshFleetSession(input: { appId, gameTokenId, currentServer })` with the org token
that opened the session. The token and its `gameTokenId` stay the same, and `expiresAt` moves
to 24 hours from the call. Name the realtime server the session is connected to in
`currentServer`, by the address the session connected to and its `clientPort`, and the session
stays there while that server still serves the app. Give `ip4` or `ip6`, exactly one: both, or
neither, is refused `BAD_REQUEST`. `ip6` needs Application API v2.90.0; before it,
`currentServer` took an IPv4 address only. Its carries stand, so send no `FLEET_CARRY`. Send
`CLIENT_CAPABILITIES` at once after every refresh: the realtime server sends the session
nothing until it hears from it again.

The checks of `openFleetSession` run again at every refresh, so a refresh is refused once one
of them no longer holds.

### Move when a realtime server asks

A realtime server that is shedding load sends the session
[`COMMAND_RECONNECT`](/replication-api/wire-formats#server-load-shedding--command_reconnect)
(22, or 44 in its bound form), signed with the fleet token. Call `refreshFleetSession` without
`currentServer`. The answer names another realtime server. Connect there, send
`CLIENT_CAPABILITIES`, and carry every player again with a new time and proof: the new server
holds no carry, and it answers 51 for each. The server the session left sends no
`FLEET_RELEASED` for those players.

### Close when the server stops

Call `closeFleetSession(input: { appId, gameTokenId })` with the org token that opened the
session. The players it carried are released, their actors leave as they do when a player's
own session ends, and the session stops counting toward your organization's limit. When one
player leaves the game while the server keeps running, send `FLEET_RELEASE` (50) for that
player. `FLEET_RELEASE` has no answer, so a lost one leaves the carry in place until the player
is carried elsewhere or goes idle.

## An SDK does the same steps for you

CrowdyCPP 0.94.1, CrowdyJS 18.40.0, and CrowdyPy 0.40.0 carry fleet sessions. Each takes the
org token as the client's bearer for the Application API calls, signs every message with the
fleet token, and sends an unanswered carry again. Each sends the session's capabilities every
15 seconds and calls a refresh due after 45 seconds without an acknowledgement. Each drops
and counts a notification that names another app than the session's, and one that nothing
signed.

CrowdyCPP 0.95.0, CrowdyJS 18.41.0, and CrowdyPy 0.41.0 report a carried player's refused
keepalive once, and name the session's server by `ip4` or `ip6` at a refresh. CrowdyCPP
0.95.0 and CrowdyPy 0.41.0 also refuse a carry for a new player once the session's table is
full, as CrowdyJS does. The notes under each SDK say how.

### CrowdyCPP

`client.admin().fleetSessions()` wraps the three Application API calls,
`crowdy::replication::FleetSession` is the session on the wire, and
`client.exec().connectAsServer()` opens the server's hub connection.

```cpp
#include <crowdy/crowdy.hpp>

using namespace crowdy::replication;

// A client for this server. Its bearer is your org token (scope fleet:session).
crowdy::CrowdyClient api(crowdy::ClientConfig{.httpUrl = applicationApiUrl});
api.setToken(orgToken);
auto& sessions = api.admin().fleetSessions();

// Open: the fleet token, its id, and the realtime server.
auto opened = sessions.open(appId);
FleetSession fleet(crowdy::domains::fleetConfigOf(opened).value(), crowdy::core::opensslCrypto());

FleetHandlers handlers;
handlers.actorUpdate = [&](const SpatialNotification& n, FleetRecipients) {
  world.apply(n);  // state arrives once, for the session
};
handlers.text = [&](const SpatialNotification& n, FleetRecipients recipients) {
  for (std::int64_t player : recipients.players()) chat.deliver(player, n);  // these players only
};
handlers.released = [&](const FleetReleased& r) {
  // CarriedElsewhere (a crossing), SignInEnded, or Idle.
  players.remove(r.playerGameTokenId);
};
fleet.setHandlers(std::move(handlers));
fleet.open();

// A player arrived on this server. The token and its id are the player's app token's.
fleet.carry({playerToken, playerGameTokenId}, [&](const FleetCarryResult& r) {
  if (r.carried()) players.add(r.playerGameTokenId, r.userId);
});

// Every tick:
fleet.poll();                                      // handlers and carry results fire here
fleet.sendActorUpdate(playerGameTokenId, update);  // each send names the carried player first

// The player left the game:
fleet.release(playerGameTokenId);

// From your loop: keep the session, and follow it to another realtime server.
if (fleet.refreshDue())
  crowdy::domains::applyFleetRefresh(fleet, sessions.refresh(fleet));

// The server's own hub connection, and a call for one player (by user id):
auto hub = api.exec().connectAsServer(appId);
hub->callAs(playerUserId, "player", key, "report", args, onReply);

// The server stops:
sessions.close(fleet);
fleet.close();
```

- **`carry`** sends `FLEET_CARRY` again every 250 ms, each time with a new time and proof,
  until its result arrives, and ends `TimedOut` after 5 seconds (`FleetConfig::carryResendMs`,
  `carryTimeoutMs`). The session paces its carries at 50 a second after a burst
  (`carriesPerSecond`, `carryBurst`), under the 64 a second the realtime servers accept. The
  result is `Carried` with the player's user id, or `NoLiveToken` (1), `OtherOrganization`
  (2), `ProofRefused` (3), or `NoRoom` (4). After you refresh a player's token, call `carry`
  with the new one. Once that carry is confirmed it replaces the entry the same user had.
- **The session's table has a limit** (0.95.0). `FleetSession::tableLimit()` is `maxPlayers`
  and 32 more rows (`kFleetTableMargin`). A carry for a new player while the table is full
  ends `FleetCarryStatus::TableFull` at the next `poll()`, with nothing sent, and
  `stats().carriesRefusedTableFull` counts it. A carry for a player the table already holds,
  and one whose `replaces` names a player it holds, are never refused this way. Release the
  players who left, or open another session. A `switch` over `FleetCarryStatus` without a
  `default` needs the new case. `fleetConfigOf` sets `FleetConfig::maxPlayers` from the open's
  answer, and `applyFleetRefresh` takes a refresh's (`setMaxPlayers`).
- **Every send of `Connection`** has a `FleetSession` form that takes the carried player's
  `gameTokenId` first, `setSpeakers` included. A send for a player the session does not carry
  returns `Errc::NotCarried` and puts nothing on the wire.
- **`FleetHandlers`** are `Connection`'s handlers with a `FleetRecipients` last.
  `recipients.forSession()` is true for a notification that arrived plain. Otherwise
  `recipients.players()` lists the carried players who may receive it, at most 32.
- **`refreshDue()`** is true once half of the token's 24 hours have passed, at once after a
  realtime server tells the session to move (`moveOrdered()`), and after 45 seconds without an
  acknowledgement of the session's capabilities (`FleetConfig::transport.watchdogSilenceMs`).
  `sessions.refresh(fleet)` names the server the session is on, or no server after a move
  order. `applyFleetRefresh` moves the session when the answer names another server, and the
  session then carries its players again. A refresh that answers `NOT_FOUND` means the session
  ended: open a new one. The SDK makes no Application API call on its own.
- **A refresh names the address the session connected to** (0.95.0): the server's `ip4`, or
  its `ip6` when it has no `ip4` or when `FleetConfig::transport.preferIpv6` is set. Through
  0.94.1 it sent the `ip4` whatever the session used. Naming an `ip6` needs Application API
  v2.90.0. `FleetSession::refreshInput()` returns what `refresh` sends, for a game server with
  an HTTP client of its own, and `replication::fleetCurrentServer(server)` makes the
  `FleetCurrentServer` from a session answer's server. The session also reaches a server
  that has an `ip6` alone (`replication::connectAddress`).
- **The silence timeout fires at every value** (0.95.0). Through 0.94.1 a
  `watchdogSilenceMs` from 3,000 to about 3,300 never fired. Every value from 3,000 up now
  fires between the timeout and one capabilities interval later.
- **A refused keepalive is reported once** (0.95.0, realtime servers v0.51.0). Where a carried
  player has no `access`, every keepalive for the player's actor
  (`FleetSession::sendHeartbeat(player, ...)`) is answered `UNAUTHORIZED`.
  `FleetHandlers::notPresent` is called once for the player, the actor, and the place, with
  an `ActorNotPresent` (`uuid`, `chunk`, `sequence`, `verified`, `playerGameTokenId`), and
  `FleetHandlers::notPresentEnded` once when that ends: `Accepted`, `Moved`, or `Stopped`.
  `FleetSession::notPresent(player, uuid)` reads the report while it stands. A keepalive's
  `UNAUTHORIZED` no longer reaches `FleetHandlers::sendRefused`: read it from `notPresent`.
  The session reports only a refusal that verified, the carry stands, and the session carries
  nobody again because of it. Keep the keepalives at the same rate.
- **`fleet.stats()`** counts what the session dropped: `wrongApp` for a notification that names
  another app, and `unsignedNotifications` for one that nothing signed. Neither reaches a
  handler.
- **`fleet.setFleetOwnState(true)`** asks for the state your own carried players sent.
- **Refusals** of the Application API calls are GraphQL errors. `crowdy/graphql/errors.hpp`
  reads them: `orgTokenRequiredOf`, `fleetSessionLimitOf`, `fleetSessionNotFoundOf`, and
  `platformBusyOf` (with `retryAfterMs`).
- **Threads** are `Connection`'s: `poll()` on the game thread, sends from any thread.

### CrowdyJS

The session is `FleetSession`, from the entry point `@crowdedkingdoms/crowdyjs/fleet`. That
entry point is for Node: it opens a UDP socket, which a page cannot do. `client.fleetSessions`
wraps the three Application API calls and `client.exec.connectAsServer` opens the hub
connection. The SDK refuses these org-token calls in a browser page.

```ts
import { createCrowdyClient } from '@crowdedkingdoms/crowdyjs';
import { FleetSession } from '@crowdedkingdoms/crowdyjs/fleet';

// A client for this server. Its bearer is your org token (scope fleet:session).
// Give it no tokenStore: the org token stays where your server keeps its secrets.
const api = createCrowdyClient({ httpUrl: applicationApiUrl });
api.setToken(process.env.CK_ORG_TOKEN);

const fleet = new FleetSession({
  session: await api.fleetSessions.open(appId), // one session for each game server
  handlers: {
    actorUpdate: (n) => world.apply(n), // state arrives once, for the session
    text: (n, players) => players?.forEach((p) => chat.deliver(p, n)), // these players only
    released: (r) => roster.remove(r.playerGameTokenId), // the platform ended a carry
  },
});
await fleet.connect();

// A player arrived on this server. `player` is the app token your server minted for them
// (mintManagedPlayerToken): its token and its gameTokenId.
const carry = await fleet.carry({ token: player.token, gameTokenId: player.gameTokenId });
if (carry.carried) {
  await fleet.sendActorUpdate(player.gameTokenId, { chunk, uuid, state });
}

// You refreshed the player's app token: carry them again, naming the id they had.
await fleet.carry({ token: fresh.token, gameTokenId: fresh.gameTokenId, replaces: player.gameTokenId });

// The player left the game:
await fleet.release(fresh.gameTokenId);

// From your loop: keep the session, and follow it to another realtime server.
if (fleet.refreshDue()) {
  await fleet.applyRefresh(await api.fleetSessions.refresh(fleet.refreshInput()));
}

// The server's own hub connection, and a call for one player (by user id):
const hubs = await api.exec.connectAsServer(appId);
await hubs.callAs(carry.userId, 'player', playerKey, 'report', { x, y, z });

// The server stops:
await api.fleetSessions.close({ appId: fleet.appId, gameTokenId: fleet.gameTokenId });
fleet.close();
```

- **`fleet.carry`** resolves with how the carry ended. `carried` is true when the session
  carries the player, and `userId` is then the player's user id. The session sends an
  unanswered carry again with a new time and proof, sends a carry answered "no live token"
  once more 250 ms later, and paces its carries under the 64 a second the realtime servers
  accept.
- **`replaces`** carries a player again with a refreshed token and no gap. The player stays
  carried throughout, and the session names the new `gameTokenId` on the player's sends from
  the moment it sends the new carry. Use the new id once the promise resolves `carried`.
- **Each send of `client.udp`** has a `FleetSession` form that takes the carried player's
  `gameTokenId` first, `setSpeakers` included. A send for a player the session does not carry
  rejects with `FleetNotCarriedError` and puts nothing on the wire.
- **Each handler's second argument** is the list of carried players who may receive the
  notification, at most 32, or `null` for a notification that arrived plain.
- **`refreshDue()`** is true once half of the session's 24 hours have passed, at once after a
  realtime server tells the session to move or releases it, and after 45 seconds without an
  acknowledgement of the session's capabilities (`silenceTimeoutMs`). `refreshInput()` is the
  input for `client.fleetSessions.refresh`: it names the server the session is on, or no
  server after a move order. `applyRefresh` takes the answer, and after a move the session
  carries its players again. A refresh that answers `NOT_FOUND` means the session ended: open
  a new one. `FleetSession` makes no Application API call on its own.
- **`fleet.stats()`** counts what the session dropped: `wrongApp` for a notification that names
  another app, and `unsigned` for one that nothing signed. Neither reaches a handler.
- **`fleetOwnState: true`**, or `fleet.setFleetOwnState(true)`, asks for the state your own
  carried players sent.
- **A refused keepalive is reported once** (CrowdyJS 18.41.0, realtime servers v0.51.0). The
  session sends a keepalive every 2 seconds for each actor, and keeps that rate when one is
  refused. Where a carried player has no `access`, the session calls `notPresent(report)`
  once for the player, the actor, and the place, and `notPresentEnded(report, end)` once when
  that ends: `accepted`, `moved`, or `stopped`. `genericError` still receives every refusal,
  with a third argument `keepalive`. `fleet.notPresent(player, uuid)` reads the report, and
  `fleet.stats()` adds `keepalivesRefused` and `notPresentReports`. A session that sends more
  than about 85 messages a second makes no report, because the one-byte sequence number no
  longer names one send, and `keepalivesRefused` still counts.
- **`refreshInput()` names the address the session connected to** (18.41.0): the server's
  `ip4`, or its `ip6` when it has no `ip4`. Naming an `ip6` needs Application API v2.90.0.
  Through 18.40.1 a session that connected over `ip6` named no server.
- **On any connection that is not a server's, `callAs` is refused locally** with `Denied`, and
  nothing is sent. On Node before 22, pass `{ WebSocket }` from the `ws` package to
  `connectAsServer`, as for `connect`.

### CrowdyPy

The session is `AsyncFleetSession` for asyncio, or `FleetSession` for a loop that calls
`poll()` every tick, both from `crowdypy.fleet`. It is CrowdyCPP's session, bound as a
player's connection is: its network thread verifies every frame with the fleet token before
Python sees it. `client.fleet_sessions` wraps the three Application API calls on the async
client and on the blocking one.

```python
import os
import crowdypy
from crowdypy.fleet import AsyncFleetSession, FleetPlayerToken

# A client for this server, holding the org token. Give it no token_store.
api = crowdypy.AsyncCrowdyClient()
api.set_token(os.environ["CK_ORG_TOKEN"])

fleet = AsyncFleetSession(
    await api.fleet_sessions.open(app_id),
    handlers={
        "actor_update": lambda n, players: world.apply(n),    # once for the session
        "text": lambda n, players: chat.deliver(players, n),  # only these players
        "released": lambda r: roster.remove(r.player_game_token_id),
    },
)
await fleet.connect()

# A player joined: `minted` is the answer of mintManagedPlayerToken.
carry = await fleet.carry(minted)
if carry.carried:
    fleet.send_actor_update(carry.player_game_token_id, chunk, uuid, state)

# The same player with a refreshed token (the answer of refreshAppToken): no release, no gap.
await fleet.carry(
    FleetPlayerToken(new_token, new_game_token_id, replaces=carry.player_game_token_id)
)

# In your loop.
if fleet.refresh_due():
    fleet.apply_refresh(await api.fleet_sessions.refresh(fleet.refresh_input()))

# The server stops.
await api.fleet_sessions.close({"appId": fleet.app_id, "gameTokenId": fleet.game_token_id})
await fleet.close()
```

- **A carry's result** is `carry.carried`, or `carry.status` for a refusal. `carry_nowait`
  starts a carry, and the `carry_result` handler receives how it ended.
- **A send for a player the session does not carry** raises `FleetNotCarriedError`, and
  nothing is sent.
- **The hub connection** is `await api.exec.connect_as_server(app_id)`, with `call` for the
  server and `call_as(user_id, ...)` for a player.
- **Refusals from the Application API** have readers: `org_token_required_of`,
  `fleet_session_limit_of`, `fleet_session_not_found_of`, and `platform_busy_of`.
- **The org-token calls are refused locally** on a player's platform (a browser build, iOS,
  or Android), before anything is sent.
- **The session's table has a limit** (0.41.0). `fleet.table_limit` is `max_players` and 32
  more rows (`TABLE_MARGIN`). A carry for a new player past it ends
  `FleetCarryOutcome.TABLE_FULL` with nothing sent, and `fleet.stats()` counts it in
  `carries_refused_table_full`. Release the players who left, or open another session. Code
  that branches on every `FleetCarryOutcome` needs the new case.
- **`refresh_input()` names the address the session connected to** (0.41.0): the server's
  `ip4`, or its `ip6` for a server with no `ip4` and for a session made with `prefer_ipv6`.
  0.40.0 named no server when the server had no `ip4`. Naming an `ip6` needs Application API
  v2.90.0.
- **The silence timeout goes down to 3,000 ms** (`MIN_SILENCE_TIMEOUT_MS`, 0.41.0). 0.40.0
  raised a shorter `silence_timeout_ms` to 4,500.
- **A refused keepalive is reported once** (0.41.0, realtime servers v0.51.0). Where a carried
  player has no `access`, the `not_present` handler is called once with an `ActorNotPresent`
  (`uuid`, `chunk`, `sequence`, `verified`, `player_game_token_id`), and `not_present_ended`
  once when that ends, with `accepted`, `moved`, or `stopped`. `fleet.not_present(player,
  uuid)` returns the report that stands. `fleet.stats()` adds `keepalives_refused` and
  `not_present_reports`. Keep the keepalives at the same rate.

## Each session has a known limit, and you grow by adding servers

| Limit | Value | Who can change it |
|---|---|---|
| Players one session carries at once (`maxFleetPlayers`) | 256 | Crowded Kingdoms, 1 to 1,024 for your organization |
| Sessions your organization holds at once, over all its apps (`maxFleetSessions`) | 512 | Crowded Kingdoms, 1 to 65,536 for your organization |
| Carries a session may send | 64 a second, with a burst of `maxPlayers` + 32 | Fixed |
| How long a session lasts | 24 hours from when it was opened or last refreshed | Fixed |
| Messages for one carried player | 500 a second, with bursts to 1,000 | Fixed |
| Carried players listed in one `FLEET_DELIVERY` | 32; more are split over several | Fixed |
| The time in a carry's proof | Within 30 seconds of the server's | Fixed |

Nothing is sized by your organization's total. Each game server opens its own session, so more
players means more servers, and the defaults carry 131,072 players at once (512 sessions of
256). Your sessions spread over the realtime servers, and carried players on different
realtime servers see each other as players with their own sessions do. A carry past
`maxPlayers` is refused with status 4, and a carry past the rate is dropped unanswered. To
raise either number, write to hello@crowdedkingdoms.com.
[What your organization can change](/overview/organization-limits#crowded-kingdoms-switches-fleet-sessions-on-and-sets-how-many-you-hold)
says what to send. `maxPlayers` in the answer of an open or a refresh is the number that
applies to that session.

With fleet sessions, these are the calls a game still makes to the Application API:

- one `openFleetSession` for each game server at start, and one `refreshFleetSession` a day;
- one `mintManagedPlayerToken` for each player when they join;
- one `refreshAppToken` for each lifetime of a player's app token, 30 minutes today.

The token refresh is the only one of these that grows with the players online: 3,000 players
make 3,000 refreshes in 1,800 seconds, which is under 2 a second.

## What ends a session, and what ends a carry

**A session ends:**

- at once, when you call `closeFleetSession`, when you revoke the org token that opened it,
  and when fleet sessions or org-managed players are switched off for your organization;
- at once, from Application API v2.90.0, when the app is archived (`archiveApp`), and when your
  organization is frozen or closed. Your game servers' hub connections end with the sessions.
  Before v2.90.0 these took up to five minutes;
- within five minutes, when the org token that opened it expires, or the app moves to another
  organization;
- at `expiresAt`, 24 hours after it was opened or last refreshed.

When a session ends, its carries end with it and no `FLEET_RELEASED` is sent. Each player's
actors leave as they do when a player's own session ends.

**Your server learns that a session ended in two ways.** The first is a signed message. The
realtime server sends the session
[`COMMAND_SESSION_RELEASED`](/replication-api/wire-formats#session-released--command_session_released-28)
(28, or 45 in its bound form), signed with the fleet token, once:

| Reason | Meaning |
|---|---|
| 0 | The session was closed through the Application API, its org token was revoked, or fleet sessions were switched off. |
| 1 | The realtime server heard nothing from the session for too long. |
| 2 | The fleet token expired. |
| 3, 4 | The realtime server is shedding load, or it is moving the session. |

The second is silence, because that one message can be lost. Advertise `BOUND_CONTROL` in the
session's capabilities. The realtime server then answers each capabilities message of a live
session with a signed `CONTROL_BOUND_ACK` (46), and it never answers an ended session's. Send
`CLIENT_CAPABILITIES` every 15 seconds, and treat 45 seconds without an acknowledgement as the
session being gone.

In both cases call `refreshFleetSession`. When it answers a server, connect there, send
`CLIENT_CAPABILITIES` at once, and carry every player again: a server that released the
session holds no carry. When it answers `NOT_FOUND`, the session is over: open a new one and
carry your players again.

**A carry ends** when you send `FLEET_RELEASE`, or when the realtime servers send
`FLEET_RELEASED` (52) with one of three reasons:

| Reason | Meaning | What to do |
|---|---|---|
| 1 | Another session carries the player: a crossing. | Stop sending for the player. |
| 2 | The player's sign-in ended: you ended their sessions, disabled or deleted the player, their account was blocked, or their token expired and no carry with a live token followed. | Sign the player in again if they may still play. |
| 5 | The player sent no gameplay input for the app's idle timeout (15 minutes unless the app sets its own). | Carry the player again when they act. |

`FLEET_RELEASED` is sent once, so it can be lost, and it can arrive up to about 6 seconds
late. It can also be a replay: a 51, 52, or 53 is signed with the fleet token and carries
nothing that marks it as new, so a captured `FLEET_RELEASED` that is sent again verifies again.
When a release arrives for a player who is still on your server, carry the player again. The
realtime server answers that carry, and its answer says where the player stands.

## Why a send is refused, and what your server does

A refusal is a `GENERIC_ERROR_MESSAGE`: three bytes, `[3][seq][code]`. It names no player. Its
sequence number is one byte that the whole session shares, so match it to your recent sends.

- **To a session that advertised `BUNDLE_SIGNED`**, a refusal arrives inside the session's
  signed bundle and is verified like everything else in it.
- **To a session that did not**, a refusal arrives alone and unsigned. Treat it as a hint:
  stop sending for the player whose send it matches, then carry the player again or check the
  player's access through the Application API.

`UNAUTHORIZED` (7) has these causes, and the refusal does not say which one applies:

| Why the send was refused | What your server does |
|---|---|
| It names the player's previous `gameTokenId` after a carry with a refreshed token took effect. | Name the new `gameTokenId`. |
| The session no longer carries the player: you released them, they went idle, their sign-in ended, or another session carries them. | Carry the player again if your server should still serve them. |
| The player lacks a permission the message needs: access to the app, voice, video, text, direct messages, or voxel edits. | Grant the permission, or stop sending that kind of message for the player. |
| The permissions for that part of the world were still loading after 2 seconds, or too many sends were waiting for them. | Send again. |
| The actor belongs to another player. | Send for an actor only under the player who owns it. |
| The platform could not confirm whose actor it is within 2 seconds. | Send again. |
| A communication rule refuses the message: a direct message from a player under 18, or a kind of communication that is switched off. | Nothing. The message is not delivered. |
| The player's access to the app is suspended or ended. | Stop serving the player. |
| The message is a heartbeat for an actor in a place where the player has no `access` (realtime servers v0.51.0). Every heartbeat there is answered. | Keep the cadence, never faster. Do not treat the player as present there. Grant `access`, or move the actor to a place the player may enter. |
| The message went under the session's own `gameTokenId` and is not one of its four kinds. | Send it under a carried player's `gameTokenId`. |

Three outcomes of a send are not `UNAUTHORIZED`:

- **A player over their send rate** gets no answer. The message is dropped.
- **A player whose token expired** gets `TOKEN_EXPIRED` (32), and `FLEET_RELEASED` with reason 2
  follows.
- **A paused app** gets `APP_PAUSED` (33).

While a player's access is suspended or ended, the realtime servers also deliver nothing for
that player. State for your other players still arrives plain, and a plain notification does
not say which of your players it is not for.

## One hub connection serves the whole server

`execConnectAsServer(appId, nodeType, key)`, with the same org token, connects your game server
to your app's [hubs](/exec/intro) as itself. One connection serves the whole server. Its plain
calls are the server's own, and a `call-as` frame makes a call for one player. A hub sees both
as `Caller::Org`, and decides what a server may do.
[Your organization's game servers](/exec/operations#your-organizations-game-servers) has the
frame, the caller, and the limits.

## A carried player is billed as a connected player

Nothing new is on the rate card, and you still pay for bytes. There is no charge for a
player or for a carry: the number of players a session carries only sets how many of its bytes
fall in the first [rate band](/management-api/shared-environment#data-out-for-a-fleet-session).

- **Data in** is what the session sends.
- **Data out** is what the session is sent. For each fleet session and minute, the first
  165,000 bytes for each carried player-minute (one player carried for one minute) are charged
  at the first band's rate and the rest at the second band's. A session that carries 40
  players for a whole minute has 6,600,000 bytes in the first band (40 × 165,000).
- **Allowances and spend caps** count bytes as before.

Usage appears in your account a minute or two after it happens, and a fleet session's minute
is priced as a whole.

A fleet session is sent a shared update once where 40 sessions were each sent a copy, and it
is not sent its own players' state, so it is billed for fewer bytes. The rates are on the
[pricing page](https://crowdedkingdoms.com/pricing.html).

## Four Application API calls take the org token

All four take an org token with the scope `fleet:session` as the bearer
(`Authorization: Bearer cko_...`), from your server, on the app's own Application API address.

| Mutation | Input | Answer |
|---|---|---|
| [`openFleetSession`](/management-api/reference/graphql/operations/mutations/open-fleet-session) | `input: { appId }` | `FleetSession`: `token`, `gameTokenId`, `appId`, `expiresAt`, `maxPlayers`, `server { ip4 ip6 clientPort }` |
| [`refreshFleetSession`](/management-api/reference/graphql/operations/mutations/refresh-fleet-session) | `input: { appId, gameTokenId, currentServer: { ip4, clientPort } }`, or `ip6` in place of `ip4` (Application API v2.90.0); `currentServer` is optional, and takes exactly one address | `FleetSession`: the same `token` and `gameTokenId`, a new `expiresAt`, and the server to be on |
| [`closeFleetSession`](/management-api/reference/graphql/operations/mutations/close-fleet-session) | `input: { appId, gameTokenId }` | `true` when a session was ended; `false` when there was none by that id for this org token |
| [`execConnectAsServer`](/application-api/reference/graphql/operations/mutations/exec-connect-as-server) | `appId`, and optionally `nodeType` and `key` | `gatewayUrl`, `token` (good for 60 seconds and one socket), `host`, `expiresAt` |

```graphql
mutation {
  openFleetSession(input: { appId: "<your app id>" }) {
    token
    gameTokenId
    appId
    expiresAt
    maxPlayers
    server { ip4 ip6 clientPort }
  }
}
```

| `extensions.code` | When | What to do |
|---|---|---|
| `ORG_TOKEN_REQUIRED` | The bearer is not an org token. 403. | Call from your server with an org token. |
| `ORG_TOKEN_NOT_ALLOWED` | The request carries an `Origin` header. 403. | Call from your server. A browser cannot use an org token. |
| `FORBIDDEN` | Fleet sessions or org-managed players are not switched on for your organization, the org token lacks `fleet:session`, the app is another organization's, or the app is archived. | Ask Crowded Kingdoms to switch fleet sessions on, or use a token with the scope. |
| `SCOPE_MISSING` | The app is outside the org token's app list. | Use a token whose `appIds` include the app. |
| `FLEET_SESSION_LIMIT` | `openFleetSession`: your organization holds as many sessions as it may (`maxFleetSessions`). 403. | Close the sessions of servers that have stopped, or ask for a higher number. Do not retry until one has closed. |
| `NOT_FOUND` | `refreshFleetSession`: the session expired, was closed, or was opened with another org token. `openFleetSession`: no such app. 404. | Open a new session. |
| `ORG_LEGAL_ACCEPTANCE_REQUIRED` | Your organization has not accepted the current Org-Managed Players Addendum. | An admin accepts it in Studio. Do not retry. |
| `PLATFORM_BUSY` | The platform could not start the work in time. 503, with `extensions.retryAfterMs`. | Wait `retryAfterMs`, then send the same call again. |

`openFleetSession` and `refreshFleetSession` place the session as `serverWithLeastClients`
places a player, so its datacenter answers apply to them: see
[Datacenter routing](/application-api/datacenter-routing). `execConnectAsServer` answers
`BAD_REQUEST` for a `nodeType` that is not 1 to 64 letters, digits, `-`, or `_`, and for a
`key` longer than 256 characters. [Error codes](/overview/error-codes) lists every code.

## What a fleet session does not do

- **It does not change a player who runs their own client.** A player with their own session
  sees carried players as any other actors, and carried players see them the same way.
- **It sends only for players it carries.** Under its own `gameTokenId` a session sends its
  capabilities, carries, releases, and a keep-alive. It has no voxel writes of its own, no
  direct message to a player elsewhere in the app, and no channel of its own.
- **It does not name the player a refusal was for.** An `UNAUTHORIZED` answer carries the
  one-byte sequence number of the send, which the whole session shares. Match it to your
  recent sends, and see [why a send is refused](#why-a-send-is-refused-and-what-your-server-does).
- **It does not keep its carries across a move.** After the session connects to another
  realtime server, carry every player again.
- **It does not raise your app's compute limit.** Hubs your server places count toward your
  organization's limit ([call limits](/exec/operations#call-limits)).
