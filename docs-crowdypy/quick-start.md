---
slug: quick-start
sidebar_position: 3
title: Quick start
---

# Quick start

```python
import asyncio

import crowdypy

API = "https://ck.prod.crowdedkingdoms.com"


async def main() -> None:
    # The identity client: sign-in, account and studio calls, minting.
    async with crowdypy.AsyncCrowdyClient(http_url=API) as identity:
        await identity.auth.login("player@example.com", "correct-horse-battery")
        if not await identity.auth.player_legal_acceptance():
            # Only after the player ticked both boxes: this records their agreement.
            await identity.auth.record_player_consents(
                accept_legal=True, attest_age_of_majority=True
            )
        minted = await identity.portal.mint_app_token("42")

    # The game client: one per app, at the app's own datacenter.
    async with crowdypy.AsyncCrowdyClient(
        http_url=minted.game_api_url or API, discovery_url=minted.discovery_url
    ) as game:
        game.set_app_token(minted)
        await game.udp.connect(minted)  # assign a server, open the UDP socket
        print(await game.users.me())


asyncio.run(main())
```

Without an event loop, `crowdypy.sync.CrowdyClient` has the same methods
without `await`.

## Two tokens, two clients

1. Signing in yields an **identity session token**, for account, studio
   administration and minting. It is not accepted for gameplay.
2. Gameplay needs a short-lived **app token** per app
   (`portal.mint_app_token(app_id)`), which is also the HMAC key for native
   UDP. `client.refresh_gameplay_token()` refreshes it, and concurrent callers
   share one refresh. A live UDP connection keeps its replication server
   across the refresh.

   **The terms and age of majority** (CrowdyPy 0.6.0). No app token is issued
   until the player has agreed to the current required legal documents and
   attested that they are at least 18, or the age of majority where they live if
   that is higher; until then minting raises `LEGAL_ACCEPTANCE_REQUIRED`
   (`crowdypy.is_legal_acceptance_required_error`). Show your own two checkboxes,
   linking each document, then call `auth.record_player_consents` as above.
   `auth.register(..., accept_legal=True, attest_age_of_majority=True)` creates
   an account that starts accepted. See
   [Terms and age of majority](/management-api/portals-and-app-tokens#terms-and-age-of-majority).
3. Build one identity client and one client per game. The game client points
   at the app's datacenter (`game_api_url`), and `discovery_url` lets it find
   the app again if that instance stops answering.

Persist sessions with `crowdypy.FileTokenStore`:
`FileTokenStore.session_path(directory, api_origin)` names the identity session
file, and `FileTokenStore.app_path(directory, app_id)` an app token's.

CrowdyPy sends no `Origin` header, so direct sign-in (`auth.login`,
`auth.register`) is available to it. A game running in a browser on its own
domain signs players in through the hosted `/authorize` page instead, using
CrowdyJS.

## Errors

Every error is a `crowdypy.CrowdyError`. A GraphQL refusal is a
`CrowdyGraphQLError` carrying the server's stable `code`
(`error.code == "FORBIDDEN"`) and its `extensions`. HTTP, network and timeout
failures have their own classes. A `WRONG_DATACENTER` refusal moves the client
to the app's datacenter and retries once, without your code doing anything.
