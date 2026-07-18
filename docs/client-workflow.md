---
slug: client-workflow
sidebar_position: 2
title: Client Workflow
---

# Client Workflow

To play a game, a player's client authenticates on the Management API to get an **identity session token**, then lists the games available. When a player selects a game, the client mints an **app-scoped token** for that app — `mintAppToken` for a native/same-origin client, or the OAuth2 Authorization-Code + PKCE portal flow when the game runs at a different origin from your hub/Overworld. The session token is management-plane only and is rejected for gameplay; the app-scoped token is the credential the client uses against that app's Game API (it carries the app's `gameApiUrl`/`gameApiWsUrl`) to register with a Buddy server and play. App tokens are short-lived (~30 min) — refresh them with `refreshAppToken` to keep playing. See **[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)**.

Our SDKs abstract this process. When initializing an SDK you provide the Management API you are using, usually https://api.crowdedkingdoms.com for our production environment; identity stays on a hub client, and a per-game client drives gameplay with its app-scoped token (`client.portal`). See **[CrowdyJS](/crowdyjs/intro)** for browsers and **[Native & non-browser clients](/management-api/native-clients)** for Unreal/Unity, desktop, console, mobile, and custom native clients.