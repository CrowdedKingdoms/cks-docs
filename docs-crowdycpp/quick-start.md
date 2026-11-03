---
slug: quick-start
sidebar_position: 3
title: Quick start
---

# Quick start

This walkthrough takes a native client from sign-in to a moving actor in a
shared world. It follows the platform's standard flow — the same one the
[Replication API guide](/replication-api/authenticate-and-assign) documents —
with CrowdyCPP handling the mechanics.

The steps:

1. Sign in with an **identity client** (session token, same GraphQL origin).
2. Mint an **app-scoped token** and build a **per-game client**.
3. Connect the **native replication client** (server assignment + UDP).
4. Drive a **world session** from your game loop.

## 1. Identity client and sign-in

Sign-in is `auth().login(email, password)` or `registerUser(...)`, a magic link,
or social/OIDC, and yields an **identity session token**. (`devLogin` was removed
in CrowdyCPP 0.26.0 / CrowdyJS 15.0.0, along with the tier-side bypass.) There is one API origin — do not set
`managementUrl` (removed in CrowdyCPP 0.20.0 / CrowdyJS 14):

```cpp
#include <crowdy/crowdy.hpp>

using namespace crowdy;

ClientConfig identityCfg;
identityCfg.httpUrl = "https://ck.example.com";
CrowdyClient identity(std::move(identityCfg));

// Dev bypass — development/test servers only; production apps use the
// magic-link or social flows on client.auth().
auto login = identity.auth().login("player@example.com", password);
```

**Then the age and the terms** (ck-api v2.35.0 and v2.60.0, CrowdyCPP 0.57.0 and 0.75.0). No
gameplay token is issued until the player has agreed to the current required legal
documents and, until Crowded Kingdoms opens to players 13 and over, attested that they are at
least 18, or the age of majority where they live if that is higher; the mint in step 2 answers
`LEGAL_ACCEPTANCE_REQUIRED` until then. Show your own checkboxes, linking each document
(`auth().playerLegalDocuments()`, and the app's own `auth().appRequiredDocuments(appId)`), and
record the player's answer with the session token:

```cpp
if (!identity.auth().playerLegalAcceptance(appId)) {
  // Only after the player ticked the boxes: this records their agreement.
  domains::PlayerConsents consents;
  consents.acceptLegal = true;
  consents.attestAgeOfMajority = true;  // ignored once the platform asks for a birth date
  consents.appId = appId;               // the app's own documents too
  identity.auth().recordPlayerConsents(consents);
}
```

An account with no age (`users().me()` reports `ageBracket` `"unknown"`) gives its birth date and
country once, from a [neutral age screen](/management-api/age-and-territory#the-age-screen), with
`auth().recordPlayerAge(PlayerAgeInput{birthDate, country, parentalConfirmation})`;
`auth().registerUser(RegisterUserInput)` takes the same answers at sign-up. The gate's refusals
read with `graphql::territoryNotSupportedOf`, `ageRequiredOf`, `ageRequirementNotMetOf` (it
surfaces no age), `legalAcceptanceRequiredOf` (with `missingDocuments`) and `safetyLogRequiredOf`.
See [Terms, age and country](/management-api/portals-and-app-tokens#terms-age-and-country).

## 2. App token and per-game client

Gameplay requires a short-lived **app-scoped token** per app. Mint one and
build a second client pointed at the app's Game API endpoint (the mint result
tells you where that is — never hard-code it):

```cpp
auto minted = identity.portal().mintAppToken(appId);

ClientConfig gameCfg;
gameCfg.httpUrl = minted.gameApiUrl;
gameCfg.discoveryUrl = minted.discoveryUrl;  // shared origin if the instance dies
CrowdyClient game(std::move(gameCfg));
game.setToken(minted.token);
```

This is the platform's **two-client pattern**: one identity client (session
token) for account and studio work, one client per game (app token) for all
world and UDP calls. See
[Portals & app-scoped tokens](/management-api/portals-and-app-tokens).

**Or start the session from the token in one call** (CrowdyCPP 0.75.0), whichever way the game
got it: a mint, a portal exchange, an organization's sign-in of its own player handed to the
device, or `signInWithMinecraft`. `crowdy::startGameSession` builds the per-game client on the
token's endpoints, stores the token, and opens the replication connection of step 3, waiting until
it is connected:

```cpp
#include <crowdy/game_session.hpp>

crowdy::GameSessionOptions options;
crowdy::GameSession session = crowdy::startGameSession(minted, std::move(options));
if (!session.ok()) { /* session.status says why */ }
crowdy::CrowdyClient& game = *session.client;  // the app token's calls
auto conn = session.connection;                 // build the WorldSession of step 4 on it
```

With the app token, `game.safety()` holds the player's own controls (voice and video settings,
a parent's consent, contacts, blocks and `fileReport`, each with an `Async` twin) and
`game.admin().apps().recording(appId)` what the safety log records, for the notice and the
indicator; a moderator's identity client uses `client.moderation()`. See
[Voice, video, contacts and blocks](/game-api/communication) and
[Safety reports and moderation](/game-api/safety-reports).

## 3. Connect the native replication client

`connect` asks the Game API for a replication-server assignment (which also
installs your UDP session server-side), opens the socket, and waits for
session-ready:

```cpp
replication::Config rc;
rc.appId = std::strtoll(appId.c_str(), nullptr, 10);
rc.token.token = minted.token;                 // 64-octet token = HMAC key
rc.token.gameTokenId = minted.gameTokenId;
rc.token.expiresAtEpochMs =
    core::parseIso8601Millis(minted.expiresAt.data(), minted.expiresAt.size());

auto conn = game.replication().connect(rc);
while (conn->state() != replication::ConnState::Connected) {
  conn->poll();
  std::this_thread::sleep_for(std::chrono::milliseconds(50));
}
```

By default the SDK owns one network thread and you drain notifications with
`poll()` from your game thread. Token refresh and reconnect commands are
handled automatically — see [Replication client](/crowdycpp/replication-client)
for the details and the thread-free manual-pump mode.

## 4. Join the world and tick

`WorldSession` layers SDK-managed game state over the connection: your actor
with a fixed-Hz send loop, a remote-actor registry, a chunk cache, and
message inboxes. Call `tick()` once per frame:

```cpp
session::WorldSessionConfig sc;
sc.appId = appId;
session::WorldSession world(conn, &game, sc);

world.actors().onJoin([](const session::RemoteActor& actor) {
  std::printf("+ actor joined\n");
});
world.actors().onLeave([](const session::RemoteActor& actor) {
  std::printf("- actor left\n");
});

// Join at chunk (0,0,0) with an initial state payload. UnrealPose is the
// 88-byte layout shared with the Unreal SDK; any byte layout works.
session::UnrealPose pose;
world.join({0, 0, 0},
           Bytes(reinterpret_cast<const std::uint8_t*>(&pose), sizeof(pose)));

double t = 0;
while (running) {
  t += 0.05;
  pose.positionX = 100.0 * std::cos(t);
  pose.positionY = 100.0 * std::sin(t);
  world.self().setState(
      Bytes(reinterpret_cast<const std::uint8_t*>(&pose), sizeof(pose)));
  world.tick();   // polls the connection, drives the send loop, reaps stale actors
  std::this_thread::sleep_for(std::chrono::milliseconds(50));
}

world.dispose();
```

`setState` only marks the state dirty; the session's send loop dedupes
unchanged states, sends keyframes periodically, and falls back to cheap
heartbeats while you idle — see [World session](/crowdycpp/world-session).

The complete program is
[`examples/walker.cpp`](https://github.com/CrowdedKingdoms/CrowdyCPP/blob/prod/examples/walker.cpp)
in the SDK repository; run two instances against the same app and each prints
the other's actor. To call your app's server code from the same client, see
[connect from a game](/exec/connect-from-a-game#crowdycpp).
