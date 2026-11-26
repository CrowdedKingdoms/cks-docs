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
Fleet sessions need Application API v2.89.1, realtime servers v0.50.0, and ck-exec 0.25.0.
**Not yet in production.** Crowded Kingdoms switches them on for one organization at a time
([below](#what-you-need-before-the-first-session)). CrowdyCPP and CrowdyJS carry them in
releases that are still to come, and CrowdyPy follows. A server written in another language
calls the Application API and speaks the
[wire formats](/replication-api/wire-formats#fleet-sessions-messages-49-to-53) itself.
:::

## One session for each game server carries that server's players

Without a fleet session, a game server signs each player in, opens a realtime session for that
player, and opens a hub connection for that player. A game made of many servers repeats all
three each time a player moves to the next server. If 3,000 players each cross between
servers about every 40 seconds, that is 75 sign-ins a second for as long as anyone plays.

With a fleet session:

- **A player signs in once**, when they join the game (`mintManagedPlayerToken`, as for any
  managed player).
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
`gameTokenId`. That first signed datagram binds the session to your address. Connect your UDP
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
| 1 | No live token by that id, or the token is for another app. | Sign the player in again, or refresh their token, then carry. |
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
  players. Set capability bit 3 (`FLEET_OWN_STATE`) if you want it.

Voice and video do not keep a carried player present. Each player needs gameplay input within
the app's idle timeout, and an idle actor needs a heartbeat, as on a player's own session.

### A player crosses to another of your servers

The server the player leaves sends the player's app token to the next server over your own
link. The next server sends `FLEET_CARRY`. From the moment that carry is accepted, only the new
session's messages for the player are accepted, and the session that carried the player before
is sent `FLEET_RELEASED` (52) with reason 1. The newest carry wins, so the player is never
carried by two sessions.

The server that holds a player's app token refreshes it before its `expiresAt`
(`refreshAppToken`) and then carries the player again with the new token and its
`gameTokenId`. The new carry replaces the old one without a gap.

### Refresh before the session expires

Call `refreshFleetSession(input: { appId, gameTokenId, currentServer })` with the org token
that opened the session. The token and its `gameTokenId` stay the same, and `expiresAt` moves
to 24 hours from the call. Name the realtime server the session is connected to in
`currentServer`, by its IPv4 address (`ip4`) and its `clientPort`, and the session stays there
while that server still serves the app. Its
carries stand: send `CLIENT_CAPABILITIES` again and no `FLEET_CARRY`.

The checks of `openFleetSession` run again at every refresh, so a session stops within a day
of fleet sessions being switched off for your organization.

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

Both SDKs take the org token as the client's bearer for the Application API calls, sign every
message with the fleet token, and send an unanswered carry again.

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
  with the new one.
- **Every send of `Connection`** has a `FleetSession` form that takes the carried player's
  `gameTokenId` first, `setSpeakers` included. A send for a player the session does not carry
  returns `Errc::NotCarried` and puts nothing on the wire.
- **`FleetHandlers`** are `Connection`'s handlers with a `FleetRecipients` last.
  `recipients.forSession()` is true for a notification that arrived plain. Otherwise
  `recipients.players()` lists the carried players who may receive it, at most 32.
- **`refreshDue()`** is true once half of the token's 24 hours have passed, and at once after
  a realtime server tells the session to move (`moveOrdered()`). `sessions.refresh(fleet)`
  names the server the session is on, or no server after a move order. `applyFleetRefresh`
  moves the session when the answer names another server, and the session then carries its
  players again. The SDK makes no Application API call on its own.
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

// The player left the game:
await fleet.release(player.gameTokenId);

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
  unanswered carry again with a new time and proof, and paces its carries under the 64 a
  second the realtime servers accept.
- **Each send of `client.udp`** has a `FleetSession` form that takes the carried player's
  `gameTokenId` first, `setSpeakers` included. A send for a player the session does not carry
  rejects with `FleetNotCarriedError` and puts nothing on the wire.
- **Each handler's second argument** is the list of carried players who may receive the
  notification, at most 32, or `null` for a notification that arrived plain.
- **`refreshDue()`** is true once half of the session's 24 hours have passed, and at once
  after a realtime server tells the session to move. `refreshInput()` is the input for
  `client.fleetSessions.refresh`: it names the server the session is on, or no server after a
  move order. `applyRefresh` takes the answer, and after a move the session carries its
  players again. `FleetSession` makes no Application API call on its own.
- **`fleetOwnState: true`**, or `fleet.setFleetOwnState(true)`, asks for the state your own
  carried players sent.
- **On any connection that is not a server's, `callAs` is refused locally** with `Denied`, and
  nothing is sent. On Node before 22, pass `{ WebSocket }` from the `ws` package to
  `connectAsServer`, as for `connect`.

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
raise either number, write to hello@crowdedkingdoms.com. `maxPlayers` in the answer of an open
or a refresh is the number that applies to that session.

With fleet sessions, these are the calls a game still makes to the Application API:

- one `openFleetSession` for each game server at start, and a `refreshFleetSession` before
  each expiry;
- one `mintManagedPlayerToken` for each player when they join;
- one `refreshAppToken` for each player before that player's app token expires.

## What ends a session, and what ends a carry

**A session ends:**

- at once, when you call `closeFleetSession`, when you revoke the org token that opened it,
  and when fleet sessions or org-managed players are switched off for your organization;
- within five minutes, when the org token that opened it expires, the app is archived or moves
  to another organization, or your organization is no longer active;
- at `expiresAt`, 24 hours after it was opened or last refreshed.

When a session ends, its carries end with it and no `FLEET_RELEASED` is sent. Each player's
actors leave as they do when a player's own session ends.

**A carry ends** when you send `FLEET_RELEASE`, or when the realtime servers send
`FLEET_RELEASED` (52) with one of three reasons:

| Reason | Meaning | What to do |
|---|---|---|
| 1 | Another session carries the player: a crossing. | Stop sending for the player. |
| 2 | The player's sign-in ended: you ended their sessions, disabled or deleted the player, their account was blocked, or the sign-in's length ran out and no carry with a live token followed. | Sign the player in again if they may still play. |
| 5 | The player sent no gameplay input for the app's idle timeout (15 minutes unless the app sets its own). | Carry the player again when they act. |

## Treat a refusal or a release as a prompt to check

- **A player whose access is suspended or ended.** The realtime servers deliver nothing for
  that player, and they answer your sends for that player `UNAUTHORIZED`. Stop serving the
  player when you see that answer. State for your other players still arrives plain, and a
  plain notification does not say which of your players it is not for.
- **A release can be a replay.** A 51, 52, or 53 is signed with the fleet token and carries
  nothing that marks it as new, so a captured `FLEET_RELEASED` that is sent again verifies
  again. When
  a release arrives for a player who is still on your server, carry the player again. The
  realtime server answers that carry, and its answer says where the player stands.
- **An error frame outside a signed bundle carries no HMAC.** Treat a
  `GENERIC_ERROR_MESSAGE` (`[3][seq][code]`) that arrives that way as a hint: stop sending for
  the player whose send it matches, then carry the player again or check the player's access
  through the Application API.

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
| [`refreshFleetSession`](/management-api/reference/graphql/operations/mutations/refresh-fleet-session) | `input: { appId, gameTokenId, currentServer: { ip4, clientPort } }`; `currentServer` is optional, and `ip4` is an IPv4 address | `FleetSession`: the same `token` and `gameTokenId`, a new `expiresAt`, and the server to be on |
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
  recent sends, and [check before you act](#treat-a-refusal-or-a-release-as-a-prompt-to-check).
- **It does not keep its carries across a move.** After the session connects to another
  realtime server, carry every player again.
- **It does not raise your app's compute limit.** Hubs your server places count toward your
  organization's limit ([call limits](/exec/operations#call-limits)).
