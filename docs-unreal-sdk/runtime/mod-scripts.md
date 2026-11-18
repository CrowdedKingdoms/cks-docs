---
slug: mod-scripts
sidebar_position: 17.5
title: Mod Scripts
description: "Let a plot owner's client code run inside your game for the players standing on the plot: host the scripts, tell the SDK where the player is, ask the player first, and answer the calls only your game can, with a guestbook's sign as the example."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Mod Scripts

A [mod](./mods.md) runs on the platform's servers. A Mod Script is the other half of the same mod: Rust that the platform builds to WebAssembly, and that a player standing in the mod's grid runs on their own machine, inside your game, once they agree. The platform's [client halves page](/exec/client-halves) says how to write one. This page is the Unreal side: **Enter Grid**, **Leave Grid**, **Set Host**, **On Mod Script Prompt** and **Answer Prompt** wire it into your game.

## Plan what a plot's script shows

A Mod Script is how a plot's owner shows something to the visitors of the plot. The script can:

- Show text on a mod HUD.
- Draw shapes that only this player sees.
- Read the player's mouse clicks.
- Read the grid's chunks and the players in it.
- Write a voxel as this player.
- Keep and read the player's own app state.
- Send events to other scripts on this machine.
- Send spatial client events from inside the grid, up to 8 chunks.
- Post to the grid's own channels.

A script reads and writes only inside its grid, and it never acts as anyone but the player who runs it. It runs only on Win64: **Is Available** is false on every other platform. The SDK runs it on background threads with a fuel limit, a watchdog, 32 MiB of memory and per-second call caps. A script whose start, tick or event fails five times in a row, for example by running out of fuel, or that makes more than 1,000 host calls in one second, is stopped and tried again 60 seconds later.

A Mod Script is code from another player, running on your player's machine. The player is asked before it runs, and your game answers each call that touches the world or the screen, so your game decides what a script may do there.

## Wire Mod Scripts into your game

Your game does two things. It tells the SDK where the player is and asks the player, through the **Crowdy Mod Scripts** subsystem (`UCrowdyModScripts`, a world subsystem, under **Crowdy SDK > Mod Scripts**). And it answers the calls only it can, by setting an object that implements **Crowdy Mod Script Host** (`ICrowdyModScriptHost`). Your module needs `CrowdyServices` in its Build.cs.

| Blueprint | C++ | Does |
|---|---|---|
| **Is Available** | `UCrowdyModScripts::IsAvailable()` | Whether this build can run scripts: Win64 only. |
| **Enter Grid** | `EnterGrid(int64 ChunkX, int64 ChunkY, int64 ChunkZ)` | The local player stands in this chunk. The SDK asks the platform which grid decides it and what box it covers. Does nothing when **Is Available** is false. |
| **Leave Grid** | `LeaveGrid()` | The player left the grid. Every script of it stops. |
| **Get Grid** | `GetGrid()` | The grid the scripts run in, with its box in chunks. Empty outside a grid. |
| **Set Host** | `SetHost(TScriptInterface<ICrowdyModScriptHost>)` | Sets the object that answers the host calls. |
| **Clear Host** | `ClearHost(Host)` | Clears the host, only if it is the one set. |
| **Answer Prompt** | `AnswerPrompt(int32 PromptId, bool bRun)` | Answers a prompt: run the author's scripts or not. |
| **Get Running** | `GetRunning()` | The scripts running now. |
| **Revoke** | `Revoke(const FString& ModId)` | Stops one script and takes back the player's agreement to it, and the player's trust in its author on the grid. The author's scripts running now keep running; the rest wait for a new yes. |
| **Forget Author** | `ForgetAuthor(int64 AuthorId)` | Stops all of the author's scripts on this grid and takes back the player's trust in the author. Does nothing outside a grid. |
| **Get Script Status** | `GetScriptStatus(int64 GridId, OnDone)` | Where each of the grid's scripts is. See [Read a script's status and log](#read-a-scripts-status-and-log). |
| **Get Script Log** | `GetScriptLog(int64 GridId, const FString& ModId, OnDone)` | A script's last log lines, oldest first, from memory. |

The SDK takes the grid from the platform, never from your call: you pass only the chunk the player stands in. Leaving the grid, signing out, travelling and the world ending stop every script.

## Host the scripts

The host answers the calls a script makes that only your game can answer. The SDK calls each event on the game thread, with values it has already checked against the grid, the player's agreement and the call's limits. It never passes the script's JSON.

A Blueprint shows each one as **Event ShowHud**, **Event DrawOverlay** and so on.

| Event | Does |
|---|---|
| **Show Hud** `(Script, Text)` | Shows the script's text. At most 8 lines and 500 characters; empty text clears it. |
| **Draw Overlay** `(Script, Shapes)` | Replaces the shapes the script draws for this player: at most 64. Positions are in voxel units from the world origin, inside the grid. An empty array clears them. |
| **Read Chunk** `(ChunkX, ChunkY, ChunkZ, Chunk)` | Fills `Chunk` with the 4,096 voxel types (index x + 16y + 256z) and returns true, or returns false when the chunk is not loaded. |
| **List Players** `(Box, Players)` | Fills `Players` with the players in the box, you included. At most 64, and names past 64 characters are cut. |
| **Drain Clicks** `(Clicks)` | Fills `Clicks` with the clicks since the last call. The SDK calls it once a frame while a host is set, and keeps the newest 64 for each script. |
| **Set Voxel** `(Script, Write, Refusal)` | Returns true when the write went into the voxel world's queue. Otherwise returns false and sets `Refusal`. |
| **Clear Script** `(Script)` | Removes what that script showed. Also called for every running script when the host is replaced. |

Each one answers from what your game already holds, never by waiting on the network. Hand back a plain copy of what the voxel world holds: the SDK cannot stop one slow answer in the middle of a frame.

With no host set, the world and input calls are refused, and **Show Hud** and **Draw Overlay** answer that nothing was delivered. **Set Voxel** needs no rate limit of your own: the SDK already holds scripts to 100 writes a second and answers busy at 64 unsent edits.

The guestbook (`ALanternGuestbook`) is an actor on a plot that has a mod with a Mod Script. It implements the host interface, shows the script's text on its sign, and in `BeginPlay` sets itself as the host and binds the prompt. A world has one host and **Leave Grid** stops every script, so the guestbook assumes it is the only one in the level; a game with several plots sets the host once, from its player controller for example, and leaves the grid when the player's chunk is outside **Get Grid**'s box.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`ALanternGuestbook` inherits `ICrowdyModScriptHost`. Its `BeginPlay` sets it as the host of the world's `UCrowdyModScripts` and binds `OnModScriptPrompt`.

<CppSnippet id="modscripts-host" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Open the guestbook Blueprint's **Class Settings** and, under **Interfaces**, use **Implemented Interfaces > Add** to add **Crowdy Mod Script Host**.

![A Blueprint's Class Settings: Implemented Interfaces, under Interfaces, is where Crowdy Mod Script Host is added](/img/unreal-sdk/modscripts-interface.png)

In **Event BeginPlay**, a **Crowdy Mod Scripts** getter feeds **Set Host** with **Self**, then **Bind Event to On Mod Script Prompt** to a custom event `OnModScriptPrompt`. The interface's events appear under **Interfaces** in **My Blueprint**: the rest of this page fills in the ones the guestbook needs.

<Blueprint src="modscripts-host" title="Event BeginPlay, Crowdy Mod Scripts, Self-Reference, Set Host, Bind Event to On Mod Script Prompt, OnModScriptPrompt" />

</TabItem>
</Tabs>

## Enter and leave a grid

**Enter Grid** takes the chunk the local player stands in. Call it when the player walks onto the plot, and **Leave Grid** when they walk off. The SDK looks the chunk up once: naming the same chunk every frame asks once. A failed lookup, for example before sign-in, is asked again only when **Enter Grid** names that chunk 2 seconds or more later, so keep calling it as the player moves rather than once per walk-in. While the player stands in the grid the SDK lists its scripts again every 10 seconds, so a script the owner adds shows up without a second **Enter Grid**.

The guestbook's trigger does this. It reacts only to the local player's own pawn, so another player walking in does nothing here.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The overlap checks that the pawn is the local player's, and that it is player controlled, then enters the grid of the chunk the guestbook stands in. The end of the overlap leaves it.

<CppSnippet id="modscripts-enter" />

</TabItem>
<TabItem value="bp" label="Blueprint">

**Event ActorBeginOverlap** turns the guestbook's location into a chunk with **World to Voxel** and calls **Enter Grid** on the **Crowdy Mod Scripts** getter. **Event ActorEndOverlap** calls **Leave Grid**. These graphs leave out the check that the pawn is the local player's: put a **Cast To Pawn**, **Is Locally Controlled** and **Is Player Controlled** in front, as the C++ tab does, when other players or AI walk past too.

<Blueprint src="modscripts-enter" title="Event ActorBeginOverlap, Crowdy Mod Scripts, Get Actor Location, World to Voxel, Enter Grid" />

<Blueprint src="modscripts-leave" title="Event ActorEndOverlap, Crowdy Mod Scripts, Leave Grid" />

</TabItem>
</Tabs>

## Ask the player

A player's scripts do not run until the player says yes. **On Mod Script Prompt** fires for each author whose scripts the player has not agreed to, each time the player enters the grid and again when the calls those scripts make change. The prompt holds:

| Field | Is |
|---|---|
| **Prompt Id** | The id to hand to **Answer Prompt**. |
| **Grid Id**, **Author Id** | The grid, and its owner, who wrote the scripts. |
| **Scripts** | The names of the scripts a yes runs. |
| **Calls** | Every call those scripts make. |
| **Groups** | The calls in groups for a short question: State, World Read, World Write, Meta, Egress, Present and Input. |
| **Not Offered** | The calls the scripts ask for that your game refuses. With no host set when the prompt fires, the world and input calls are listed here too: set the host first. |

Show the player who is asking and what for, then call **Answer Prompt** with **Run**. **Run** true trusts the author on this grid for those calls. **Run** false declines for as long as the player stays in the grid: they are asked again the next time they enter it, or sooner if the scripts' calls change. If the prompt goes stale, for example because the player left, **On Mod Script Prompt Withdrawn** fires with its id: close your question.

A prompt is your game's own user interface. The guestbook skips the dialog: a **Run Plot Scripts** setting on it decides the answer. In C++ its sign also says what was asked.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The handler writes the question on the sign, how many scripts the plot's owner asks to run, and answers it from the guestbook's **Run Plot Scripts** setting.

<CppSnippet id="modscripts-prompt" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The custom event `OnModScriptPrompt` has a **Prompt** pin. **Break Crowdy Mod Script Prompt** gives its **Prompt Id**, and **Answer Prompt** takes it with the guestbook's **Run Plot Scripts**. The same break gives **Author Id**, **Scripts** and **Calls** for the question your game shows.

<Blueprint src="modscripts-prompt" title="OnModScriptPrompt, Crowdy Mod Scripts, Break Crowdy Mod Script Prompt, Get bRunPlotScripts, Answer Prompt" />

</TabItem>
</Tabs>

A yes is kept: the next time the player enters this author's grid, the scripts start with no question. Take it back with **Revoke** for one script, or **Forget Author** for all of the author's scripts on the grid. A refusal from the platform, such as a revoke it would not take, arrives on **On Mod Script Error** with a **Mod Id**, a **Code** and a **Message**, and the script it was for stops as **Unconsented** until the player enters the grid again.

## Show what a script says

**On Mod Script Started** fires when a script starts, and **On Mod Script Stopped** when it stops, each with the script: its **Mod Id**, **Name**, **Author Id**, **Grid Id**, **Version**, the **Calls** it may make, and its **Digest**, the SHA-256 of the module it runs (64 lowercase hex digits; the SDK runs no bytes that hash to anything else), so your game can show which build is running. **On Mod Script Stopped** also carries why it stopped, in the table below. A script that fails to start fires **On Mod Script Stopped** with **Failed** and no **On Mod Script Started** before it.

The guestbook's script writes who signed lately. **Show Hud** puts that text on the sign, and **Clear Script** takes it down when the script stops.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The guestbook's `ShowHud` puts the text on the sign. Its `ClearScript` clears it, so a stopped script leaves no text behind.

<CppSnippet id="modscripts-hud" />

A C++ host overrides the events it answers; one it leaves alone answers nothing. The guestbook spells the other five out anyway: no clicks, no chunk, no players, no voxel write and no shapes.

<CppSnippet id="modscripts-rest" />

</TabItem>
<TabItem value="bp" label="Blueprint">

Add **Event ShowHud** from the interface: it sets the sign's text to the first 200 characters of **Text**. Add **Event ClearScript**: it sets the sign's text to an empty text.

<Blueprint src="modscripts-hud" title="Event ShowHud, Left, Get Sign, Set Text, To Text (String)" />

<Blueprint src="modscripts-clear" title="Event ClearScript, Get Empty Text, Get Sign, Set Text" />

</TabItem>
</Tabs>

A script that is stopped and that comes back, for example after a change of code, runs under a new **Generation**. A host that keeps what each script showed keys it by **Mod Id**, and stops showing it on **Clear Script**.

## Check which calls your game answers

A script names each call it makes, and the SDK answers it or refuses it:

| Call | Answered by |
|---|---|
| `grid_info`, `clock`, `emit_event`, `grid_permission_check` | The SDK alone. |
| `user_state_get`, `user_state_set`, `emit_spatial`, `emit_channel` | The SDK, through the platform, as the player. |
| `pointer_clicks`, `chunk_get`, `voxels_list`, `actors_list`, `actors_list_radius`, `voxel_set`, `hud_set`, `overlay_draw` | Your host. |

`emit_spatial` sends only the `client_event` and `server_event` kinds: an actor or text send is refused. `emit_channel` posts only to the grid's own channels, at most 1,024 bytes. `grid_permission_check` answers the four code permissions, for the local player only. Any other call, such as `avatar_state_get` or `emit_event_to`, a script makes is refused as not offered, and a script that asks for one shows it in **Not Offered** on the prompt.

## Read a script's status and log

A dock or a debug panel can ask where the grid's scripts are. Both calls answer once on the game thread, never inside the call, and answer **Not In Grid** unless the grid id is the one the player stands in. They answer **Failed** when the Mod Script runtime is not running. In C++ the callback runs even after the world ends, so capture weakly.

**Get Script Status** answers **Scripts**, every script the grid lists, agreed to or not. Each has the **Script**, a **State** (**Running**, **Stopped**, **Erred** or **Circuit Open**), a **Stop Reason** that means something only when **State** is **Stopped** (the table below), and a **Message**.

**Get Script Log** takes a grid id and a **Mod Id** and answers the script's last 200 log lines, oldest first: each has **At Ms**, a **Level** (0 error, 1 warning, 2 info, 3 debug) and the **Text**. The lines are kept in memory only, never saved, and they outlive each run of the script, so a crash's last lines stay readable. **Dropped Lines** counts the lines lost before the read: those the script logged too fast to keep and those that fell out of the 200. The answer also names the script (**Name**) and its author (**Author Id**).

:::caution[A script's log lines are its author's text.]
A reader that passes them on, such as to a model, should read only the logs of authors it trusts.
:::

Reading the log through this call does not put the lines in the game's log: that is what `crowdy.modscripts.trace 1` does, as described below.

## Read why a script stopped

| Reason | Means |
|---|---|
| **Removed** | The grid no longer serves the script, or listing the grid's scripts was refused or failed three times in a row. |
| **Changed** | Its code, permissions or tick changed. It is asked about again only when its calls changed; otherwise it restarts. |
| **Unconsented** | The player took their agreement back somewhere else, or the platform refused an agreement call. |
| **Revoked** | The player took it back here, through **Revoke** or **Forget Author**. |
| **Left Grid** | The player left its grid. |
| **Stopped** | Sign-out, a change of player, travel or the world ending. |
| **Circuit Open** | Its start, tick or event failed five times in a row, for example out of fuel, or it made more than 1,000 host calls in one second. It starts again after 60 seconds. |
| **Failed** | Fetching, checking or starting it failed. It is tried again later while the player stays in the grid. |

A script's own log lines are its author's text, so they stay out of the game's log. To read them while you test a plot, run `crowdy.modscripts.trace 1` in the console: each kept line (up to 20 a second per script, cut at 1,000 characters) then appears under `LogCrowdyModScripts` with the script's name, along with a count of the lines dropped over that limit.

:::warning[Install the host before the player enters a grid.]
A script that starts with no host set cannot read the world or show anything: its world and input calls are refused and its HUD and overlay calls answer delivered false. Set the host in `BeginPlay`, before the first **Enter Grid**.
:::

:::caution[Answer a host call from state you already hold.]
A host event runs on the game thread inside the frame. Read the chunk you already loaded, copy it, and return. A call that waits on the network or a disk freezes the game.
:::

:::caution[Ship the Wasmtime notices with every Win64 game.]
The runtime that runs scripts is Wasmtime, under Apache-2.0 with the LLVM exception. Every Win64 build of the plugin links it, whether or not your game uses Mod Scripts, so ship its licence and notices in your game's notices: `Plugins/CrowdySDK/Source/CrowdyModScriptRuntime/ThirdParty/Wasmtime/LICENSE` and `THIRD-PARTY-NOTICES.txt`.
:::

## Use the types from C++

Every event and delegate fires on the game thread. `UCrowdyModScripts::ListSeconds` (10) is how often the grid's scripts are listed again. The types behind the nodes:

| Type | Is |
|---|---|
| `UCrowdyModScripts` | The world subsystem. |
| `ICrowdyModScriptHost`, `UCrowdyModScriptHost` | The host interface, and its `UInterface`. Its methods `ShowHud`, `DrawOverlay`, `ReadChunk`, `ListPlayers`, `DrainClicks`, `SetVoxel` and `ClearScript` are each a `BlueprintNativeEvent`: a C++ host overrides `ShowHud_Implementation` and the rest, and the SDK calls them through `Execute_ShowHud` and so on. |
| `FCrowdyModScriptGrid` | `GridId` and the box in chunks: `LowChunkX`, `LowChunkY`, `LowChunkZ`, `HighChunkX`, `HighChunkY`, `HighChunkZ`. |
| `FCrowdyModScript` | A running script: `ModId`, `Name`, `AuthorId`, `GridId`, `Version`, `Generation`, `Calls` and `Digest`. |
| `UCrowdyGetScriptStatus`, `UCrowdyGetScriptLog`, `FCrowdyModScriptStatusAsyncResult`, `FCrowdyModScriptLogAsyncResult` | The two read nodes and the delegate types of their pins. |
| `FCrowdyModScriptStatusList`, `FCrowdyModScriptStatus`, `FCrowdyModScriptLog`, `FCrowdyModScriptLogLine` | The answers to the two reads. `FCrowdyModScriptStatusList` has `Result`, `GridId`, `Scripts` and `Message`; a status is `Script`, `State`, `StopReason` and `Message`. A log has `Result`, `ModId`, `Name`, `AuthorId`, `Lines`, `DroppedLines` and `Message`; a line is `AtMs`, `Level` and `Text`. |
| `ECrowdyModScriptReadResult`, `ECrowdyModScriptState` | `Success`, `NotInGrid`, `Failed`, `NotBuilt`; and `Running`, `Stopped`, `Erred`, `CircuitOpen`. |
| `FCrowdyModScriptPrompt` | `PromptId`, `GridId`, `AuthorId`, `Scripts`, `Calls`, `Groups` and `NotOffered`. |
| `FCrowdyModScriptError` | `ModId`, `Code` and `Message`. |
| `ECrowdyModScriptGroup` | `State`, `WorldRead`, `WorldWrite`, `Meta`, `Egress`, `Present`, `Input`. |
| `ECrowdyModScriptStop` | `Removed`, `Changed`, `Unconsented`, `Revoked`, `LeftGrid`, `Stopped`, `CircuitOpen`, `Failed`. |
| `FCrowdyModScriptClicks`, `FCrowdyModScriptClick` | The clicks since the last drain. `Buttons`, the buttons held now as a mask (1 left, 2 right, 4 middle), and the held times. Each click has `bDown`, `Button` (0 left, 1 middle, 2 right: not the mask's values), `AtMs` in Unix milliseconds, `HeldMs` on a release only, and `X`, `Y`, which run from -1 to 1 across the game viewport, +Y up. |
| `FCrowdyModScriptChunk`, `FCrowdyModScriptCellState` | `Types` (4,096) and `States`: a cell's `X`, `Y`, `Z` and its state in base64. |
| `FCrowdyModScriptPlayer` | `ActorId` (32 hex digits), `bSelf`, `Name`, `Location` in voxels, `Yaw`, `Pitch` in degrees and `Program`. |
| `FCrowdyModScriptShape`, `ECrowdyModScriptShapeKind` | `Id` (at most 32 characters, unique in its script), `Kind` (`Box`, `Sphere`, `Cylinder`, `Capsule`, `Plane`), `Location`, `Rotation`, `Size` (0.04 to 8 voxels on each axis), `Color`, `Opacity`, `bVisible` and `bUnlit`. |
| `FOnCrowdyModScriptPrompt`, `FOnCrowdyModScriptPromptWithdrawn`, `FOnCrowdyModScriptStarted`, `FOnCrowdyModScriptStopped`, `FOnCrowdyModScriptError` | The delegate types of the subsystem's events. |
