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

Sign-in is passwordless (magic link, social/OIDC, or the dev bypass) and
yields an **identity session token**. There is one API origin — do not set
`managementUrl` (removed in CrowdyCPP 0.20.0 / CrowdyJS 14):

```cpp
#include <crowdy/crowdy.hpp>

using namespace crowdy;

ClientConfig identityCfg;
identityCfg.httpUrl = "https://ck.example.com";
CrowdyClient identity(std::move(identityCfg));

// Dev bypass — development/test servers only; production apps use the
// magic-link or social flows on client.auth().
auto login = identity.auth().devLogin("player@example.com");
```

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
[`examples/walker.cpp`](https://github.com/CrowdedKingdoms/CrowdyCPP/blob/main/examples/walker.cpp)
in the SDK repository; run two instances against the same app and each prints
the other's actor. For the Game Kit equivalent (deploy a blueprint, play with
the runtime helpers), see
[`examples/kit_seed_and_play.cpp`](https://github.com/CrowdedKingdoms/CrowdyCPP/blob/main/examples/kit_seed_and_play.cpp)
and the [Game Kit](/crowdycpp/game-kit) page.
