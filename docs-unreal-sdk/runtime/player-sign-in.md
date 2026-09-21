---
slug: player-sign-in
sidebar_position: 0
title: Player Sign-in
description: "The smallest sign-in that gets a player onto the wire: one call from the Game Instance in C++, or one small widget in Blueprint. Everything else about accounts and tokens is on the Authentication page."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Player Sign-in

Nothing replicates until a player is signed in. Once sign-in succeeds the SDK opens the realtime connection itself, so this is the one step every page in this section assumes has already happened. This page shows the most basic way to do it and nothing more.

## When you touch this

Once per project, at startup, before any entity, event, property, or Game Model read.

## Sign in with a password

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The Game Instance signs in from `Init`: bind **On Login** and **On UDP Connection Success** on the Crowdy SDK Subsystem, then call `Login` with an email and password read from `Config/DefaultGame.ini`. The first handler reports the sign-in; the second fires when the connection is up.

<CppSnippet id="qs-login" />

Make it the project's Game Instance under **Project Settings, Maps & Modes, Game Instance Class**, and give it a test account in `Config/DefaultGame.ini` (`YourModule` is your game module's name):

```ini
[/Script/YourModule.LanternGameInstance]
Email=you@example.com
Password=your-test-password
```

:::caution[A test account belongs in a config file or a pin default, never in shipped code.]
:::

</TabItem>
<TabItem value="bp" label="Blueprint">

Create a Widget Blueprint with two **Editable Text Box** widgets and a **Button**, and two String variables, `Email` and `Password`, each set from its box's **On Text Committed**. The button's **On Clicked** calls a custom event `SignIn`, whose graph reads the two variables into the latent **Login** node and removes the widget from its parent on `On Success`. Add the widget to the viewport from your Game Instance or level Blueprint at startup.

<Blueprint src="signin-widget" title="SignIn, Get Email, Get Password, Login, Remove from Parent" />

</TabItem>
</Tabs>

:::warning[Never print, log, or store the token in the result.]
The `Result` a success carries holds the player's `UserID` and a token the SDK already keeps for you. The SDK's own **On Login** event on the Crowdy SDK Subsystem carries a message and no credential, on purpose; keep anything you put on screen the same way.
:::

If this machine signed in before, restore instead of asking: call `RestoreSession` first and show the widget only on its error path, as [Authentication](../services/authentication.md#restore-a-saved-session) shows; the connection then comes up exactly as after a `Login`.

**Success signal.** The log reads `Login ok`, then `Connected to the app`. From then on `Get UDP Connection State` on the subsystem reads connected, and the rest of the Runtime section applies. Start replicating your pawn only from that moment: **On UDP Connection Success** fires once the server has assigned this client and its readiness wait has elapsed, an update sent earlier is not held for it, and the [Quickstart](../quickstart.md#1-make-your-player-a-crowdy-entity) spawns the pawn from the connected handler for that reason.

## Related

- [Authentication](../services/authentication.md): register, magic link, social sign-in, restoring a saved session, sign-out, and the events.
- [Quickstart](../quickstart.md): this step in the context of one complete lantern, and the pawn that makes the signed-in player present.
- [Connection and reconnect](./connection-and-reconnect.md): what the SDK does once the sign-in succeeds.
