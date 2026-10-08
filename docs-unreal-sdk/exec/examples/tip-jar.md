---
slug: tip-jar
sidebar_position: 1
title: "Tip jar: your first Server Object"
description: Build a shared tip jar from nothing with only the editor and Blueprints, step by step. Make the Server Object asset with a Total variable and a Tip function, paste its few lines of server code, Generate and Deploy, then add a component to an actor, follow On Total Changed with Print String, call Tip from a key press, and watch two players see the same total rise.
---

# Tip jar: your first Server Object

:::note
Server Objects run on [ck-exec](/exec/intro). The tagged v2.17.0 plugin does not have them; see [What's Changed](../../guides/whats-changed.md#unreleased-after-v2170).
:::

This page builds the village square's tip jar. Every villager can drop a coin in, and everyone sees the same running total. The total is worth keeping on the server, so nobody can tip a thousand coins from a modified client. You use only the editor and Blueprints; the one piece of code is a few lines of Rust that you paste.

Before you start you need:

- a project with the Crowdy SDK, on the **Dev** backend, where your players can sign in (see [Player sign-in](../../runtime/player-sign-in.md));
- Crowdy Studio signed in to your app, for the Deploy step (see [Server Compute](../deploy-with-server-compute.md#open-the-page)).

## Make the Server Object

1. In the Content Browser, click **Add**, then **Crowdy**.
2. Pick **Server Object**. The new asset is named `CSO_NewServerObject`.
3. Rename it `CSO_TipJar` and double-click it. The asset editor opens.
4. In the **Variables** section of the **Server Object** panel, click **+**.
5. In **Details**, set **Variable Name** to `Total`.
6. Leave its type on **Integer** and its **Default Value** on 0.
7. Leave the eye at the end of the `Total` row open, so it is **Visible to Players**.
8. In the **Functions** section, click **+**.
9. In **Details**, set **Name** to `Tip`.
10. Leave **Callable By** on **Players**.
11. In the **Inputs** header, click **+**, and rename the new `NewParam` to `Amount`. Leave it an Integer.
12. In the **Outputs** header, click **+**, and rename the new `NewParam` to `Total`. Leave it an Integer.
13. Select **Type Settings**, the first row of the **Server Object** panel.
14. In **Details**, set **Type Name** to `tip_jar`, or click **Use tip_jar** beside it.
15. Click **Save**.

The panel now shows the variable `Total` with an open eye, and the function `Tip` with `(Amount) returns Total` beside it. The [definition asset page](../create-a-type.md) explains every setting.

## Write what Tip does

1. In the asset editor's toolbar, click **Generate**. It writes the server code under `Server/tip_jar/` in your project.
2. Open the **Server Code** tab. It shows `logic.rs`, where Tip refuses with "not written yet".
3. Click in the code, press **Ctrl+A** to select it all, and paste this over it:

   ```rust
   use crate::*;
   use ckx_sdk::prelude::*;

   impl Functions for TipJarState {
       fn tip(&mut self, _ctx: &Ctx, _call: &Call<'_>, params: TipParams) -> Result<TipReply> {
           if params.Amount < 1 || params.Amount > 100 {
               return Err(Error::new("a tip is 1 to 100 coins"));
           }
           self.Total = self.Total.saturating_add(params.Amount);
           Ok(TipReply { Total: self.Total })
       }
   }
   ```

4. Click **Save** on the tab.

Tip adds the amount to `Total` and answers with the new total. It refuses a tip of 0 or of a thousand, and the server checks that, not the game. [Write its server logic](../write-server-logic.md) says what each line does.

## Put it on the server

1. In the asset editor's toolbar, click **Deploy**. It sends every Server Object type in the project, and asks first.
2. Read the dialog, which should say it adds `tip_jar`, and click **Yes**.
3. Wait for the status line to say "Deployed as version" and a number.

Deploy builds the code on the server and makes it live for your app at once. If it fails, the build output opens, usually with a mistake in the pasted code. The [Server Compute](../deploy-with-server-compute.md#deploy) page has the rest.

## Make the actor

1. In the Content Browser, click **Add**, then **Blueprint Class**, then **Actor**.
2. Name it `BP_TipJar` and double-click it.
3. In the Components panel, click **Add** and choose **Crowdy Server Object**.
4. With the component selected, in **Details**, under **Server Object**, set **Definition** to `CSO_TipJar`.
5. Leave **Instance Mode** on **Instance Id**.
6. Set **Instance Id** to `lobby`.

Every `BP_TipJar` with the Instance Id `lobby`, on every player's machine, now shares one tip jar. A different id is a different jar.

## Show the total

1. Open the **Event Graph**.
2. Right-click in the graph, type `Total`, and choose **On Total Changed (CSO_TipJar)** under **Server Objects**.
3. Drag from **Event BeginPlay**'s execution pin to the **Bind** pin of the new node.
4. Drag from the node's **Changed** pin, type `Print String` and choose it.
5. Drag from the **Total** pin of the node to **In String** of Print String. The editor adds the conversion from Integer to String.

<Blueprint src="so-tipjar-total" title="Event BeginPlay, On Total Changed, Print String" />

Pan a Blueprint figure with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

The node runs **Changed** once as soon as the jar is ready, with the current total, and again after every change. You wired **Bind** once and there is nothing to unbind.

## Tip from the keyboard

1. Click **Class Defaults** in the toolbar.
2. In **Details**, under **Input**, set **Auto Receive Input** to **Player 0**, so this actor hears the local player's keys.
3. Back in the **Event Graph**, right-click, type `T`, and choose the **T** key event under **Input, Keyboard Events**.
4. Drag from its **Pressed** pin, type `Tip`, and choose **Call Tip (CSO_TipJar)**.
5. Set its **Amount** pin to 1.
6. Drag from **On Success**, type `Print String`, and choose it.
7. Drag from the **Total** output pin of Call Tip to its **In String**.
8. Click the small arrow at the bottom of **Call Tip** to show its **Reason** pin. Drag from **On Failed**, add another **Print String**, and drag **Reason** to its **In String**.
9. Click **Compile**, then **Save**.

<Blueprint src="so-tipjar-tip" title="T, Call Tip (Amount 1), Print String on On Success and On Failed" />

Neither node needs a **Target** wired: they use this actor's own component. **On Success** runs when the server has added the coin, with the new total. **On Failed** runs with the reason if the server refused, or could not be reached. The [Blueprint page](../from-blueprint/call-functions.md#the-call-node) says what **Outcome** and **Retryable** tell you.

## Play it with two players

1. Drag `BP_TipJar` from the Content Browser into your level.
2. Open the dropdown beside the Play button, choose **Advanced Settings**, and under **Multiplayer Options** set **Number of Players** to 2.
3. Click **Play**. Both windows are players of your app, so each has to be signed in the way your game signs players in.
4. Watch the two screens. Each prints the jar's total, `0` the first time, as soon as the jar is ready.
5. Click in one window and press **T**.
6. The window you pressed in prints `1` twice, once from **On Success** and once from **Changed**. The other window prints `1` once, from **Changed**.
7. Press **T** in the other window, and both print `2`.

Both windows read the one jar on the server, and **On Total Changed** told each of them. The total is not kept anywhere in your Blueprint; the server holds it.

## Where to go next

- Next: [a shared boss](./shared-boss.md). Many players hit one boss, the server refuses hits while it is defeated and brings it back on a timer, and you switch the type off and on from Server Compute to watch everyone recover.
- Make a second variable, such as `LastTipper` as a String, keep its eye open, and use **On LastTipper Changed** the same way. Add it to `logic.rs` and Deploy again. After any change to the asset, **Generate** and **Deploy** again; see [After you change the definition](../write-server-logic.md#after-you-change-the-definition).
- Let only a leader call a function, with **Callable By** set to **Leader**: [Access, members and timers](../access-members-and-timers.md).
- If the whole game should share one jar, with no Instance Id to choose, tick **Only One Instance** in the asset: [Only One Instance](../access-members-and-timers.md#only-one-instance).
- For a widget that shows the total with no actor, use **Find By Asset**: [Where the object comes from](../from-blueprint/get-a-server-object.md#where-the-object-comes-from).
