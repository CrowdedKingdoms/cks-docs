---
slug: player-names
sidebar_position: 1.5
title: Player Names
description: "Read a player's public name by User ID for a nametag, read up to 100 at once for a roster, and let the signed-in player choose their own, with the Name Taken refusal, in C++ and Blueprint."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Player Names

Every account has a public name: a **gamertag**, and a **disambiguation** that makes the pair unique, so two players can share a gamertag as long as their disambiguations differ. A game reads names by User ID, the `int64` it already has for every player, and the signed-in player can choose their own. A player who has never chosen a name reads an empty gamertag.

## When you touch this

When you draw a nametag over a player, list the members of a team or a match, or add a Choose Your Name step to the first launch.

## The surface

`UCrowdyPlayers` (Game Instance subsystem, **Crowdy Players**, category **Crowdy SDK, Players**) has three calls, each also a latent node. Names arrive as `FCrowdyPlayerProfile`: `UserID`, `Gamertag`, `Disambiguation`. A failure carries an `FCrowdyAccountError` (`Code`, `Message`) and the `Message`, the same error the [account settings](./authentication.md#account-settings) calls use.

| Blueprint (C++) | What it does |
|---|---|
| **Get Player Name** (`GetPlayerName(UserID, OnResult, OnError)`) | One player's name. A User ID with no player fails with **Not Found**. |
| **Get Player Names** (`GetPlayerNames(UserIDs, OnResult, OnError)`) | Up to 100 players' names in one call (`UCrowdyPlayers::MaxProfilesPerCall`); more fails at once without a request, and none answers an empty list. Unknown User IDs are left out of the answer, so match the rows by `UserID`, not by position. |
| **Set Player Name** (`SetPlayerName(Gamertag, Disambiguation, OnResult, OnError)`) | Renames the signed-in player and answers the new name. A pair another player has fails with **Name Taken**. A gamertag is at most 64 characters, a disambiguation at most 128. |

The C++ calls answer on `FOnPlayerProfileRead` (one profile), `FOnPlayerProfilesRead` (an array) and `FOnPlayersError`. The nodes are `UCrowdyPlayers_GetPlayerName`, `UCrowdyPlayers_GetPlayerNames` and `UCrowdyPlayers_SetPlayerName`, whose pins are `FPlayerProfileAsyncResult` (`Profile`, `Error`, `Message`) and, for the batch, `FPlayerProfilesAsyncResult` (`Profiles`, `Error`, `Message`).

All three need a signed-in player. Any player may read any other player's name, and nothing else about them.

## Show a nametag

When a player appears, read their name by User ID and put the gamertag on their nametag.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="players-nametag" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A custom event `OnPlayerAppeared` with a `UserID` parameter runs **Get Player Name**; **On Success** breaks the `Profile` and prints its `Gamertag`.

<Blueprint src="players-nametag" title="OnPlayerAppeared, Get Player Name, Gamertag" />

</TabItem>
</Tabs>

For a roster, collect the User IDs and make one **Get Player Names** call rather than one call per player.

## Let the player choose a name

A Choose Your Name screen on the first launch calls **Set Player Name** with the two fields. When the pair is taken, ask for another disambiguation.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

<CppSnippet id="players-rename" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A custom event `OnChooseNamePressed` runs **Set Player Name**. **On Error** breaks the `Error`, compares its `Code` with **Name Taken**, and only on a match prints the hint.

<Blueprint src="players-rename" title="OnChooseNamePressed, Set Player Name, Name Taken" />

</TabItem>
</Tabs>

## Gotchas

- Names are not live: read again when you need a current one, for example when a player joins a team or a match.
- The pair is the unique handle. Show both where players must tell two names apart, such as a friends list.
- A player's own name is read with their own User ID, from `UCrowdyGameSession::GetUserID()`.
- Crowdy Studio's [Account page](../studio/sign-in.md#your-account) sets your own name as the developer.

## Related

- [Authentication](./authentication.md): signing in, and the account settings that share this page's error type.
- [Teams](./teams.md): the member lists a roster names.
