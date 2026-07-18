---
sidebar_position: 4
title: "03 — Connect & bootstrap"
slug: 03-connect-and-bootstrap
---

# Connect and bootstrap

## Goal

Initialize the game client and open the UDP proxy subscription.

## Steps

1. Authenticate and **mint the app-scoped token** (chapter 2)
2. Call `client.serverStatus.gameClientBootstrap('1')` — version info, UDP status, `me`
3. Call `client.udp.connect()` — opens proxy session to least-loaded Buddy
4. Call `client.udp.subscribe({ ... })` — receive realtime notifications

:::note[Gameplay uses the app-scoped token]
Everything from `gameClientBootstrap` onward is a Game API / realtime call and runs
on the **app-scoped token** minted in [chapter 2](/build-a-game/02-auto-guest-auth),
not the identity session token. `client.udp.connect()` assigns a Buddy via
`serverWithLeastClients` under the hood; an identity session token is rejected
(`APP_TOKEN_REQUIRED` on the realtime subscription, `INVALID_APP_ID` on the
assignment). See [Game API authentication](/game-api/authentication) and
[Authenticate and assign](/replication-api/authenticate-and-assign).
:::

## Subscription types

Subscribe to `udpNotifications` and handle at minimum:

- `ActorUpdateNotification` — remote player positions
- `VoxelUpdateNotification` — painted cells
- `RealtimeConnectionEvent` — connection status
- `GenericErrorResponse` — error codes

See [GraphQL UDP Proxy API](/game-api/graphql-udp-proxy-api).

## Register your actor

Before others receive your updates, send at least one `sendActorUpdate` so the server knows your chunk.

## Exit criteria

- Bootstrap succeeds
- UDP proxy connected
- Event log shows subscription active

Next: [Canvas coordinates](/build-a-game/04-canvas-coordinates)
