---
slug: mods
sidebar_position: 17
title: Mods
description: "What a player's own server code on their land is for, and how to install it, call it, read it and switch it off from your game, with a guestbook on a plot as the example: the nodes, who may do what, each result, and what a mod costs its owner."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Mods

A mod is a player's own server code on a grid they own. It is a Rust crate that the platform builds from source and runs for that one grid. The platform's [mods page](/exec/mods) says how to write one. This page is the Unreal side: **Get Starter**, **Build Mod**, **Deploy Mod**, **Set Mod Enabled**, **List Mods**, **List My Mods**, **Call Mod**, **Get Mod Logs** and **Delete Mod** do each step from your game.

## What a mod is for

A mod is the server rules a player puts on their own land. It keeps its own state across restarts, and any player can call it. So players can add mechanics to their plots without your game shipping new code: your game gives the owner a way to install a mod, and gives visitors a way to call it.

Some mechanics a mod can carry:

- **A guestbook or a visitor counter.** The mod counts who called it and remembers the last visitor, and the count survives restarts. This page builds one below.
- **A plot that rebuilds or animates its own blocks**, such as a windmill that turns or a garden that grows. The mod writes its grid's blocks, for example on a timer. Its writes reach nearby players live, single cells as voxel updates and a whole chunk as one notice; a player who missed one sees it when the chunk is fetched or [reloaded](./voxel-chunks.md#reloading-a-chunk).
- **A sign or a shop counter that answers from the plot's own data**: what is built there, who is standing there now, or a notice its owner keeps in the mod's state.
- **A puzzle whose solution the server checks.** A visitor sends an attempt with **Call Mod**, the mod compares it with the answer it keeps, and only the mod opens the door by writing the blocks. The answer stays on the platform, so a modified client cannot fake a solve.

A mod reads only its own grid's chunks, voxels and actors, and writes only that grid's blocks. It hears the grid's world events, such as actors moving and voxels changing. It cannot call your app's own server code or other mods, and only players call it. It runs as its owner, so it is not trusted game state like a [Server Object](../exec/overview.md): keep HP, inventory and anything a cheat would want in your game's own Server Objects.

A player's land can be a chunk they own through a [chunk claim](./chunk-claims.md).

## What a player needs

Every call is the signed-in player's own, made with their app token. Building needs the `write_server_code` permission in the app. Deploying and deleting need the grid and `write_server_code` on both the player's access tier and the grid. Switching a mod on or off needs the grid and `run_server_code` on both. Switching on also needs the app's code admission. The default access tier does not grant any of these: your app's developers do. The platform's [mods page](/exec/mods#who-may-do-what) has the full table.

A call the player is not allowed to make answers **Denied**, and **Message** names the missing permission.

## The nodes

They live on the **Crowdy Mods** subsystem (`UCrowdyMods`, a Game Instance subsystem), under **Crowdy SDK > Mods**. Your module needs `CrowdyServices` in its Build.cs. Each call is latent: **On Done** or **On Failed** fires once, on the game thread, never inside the call. Nothing is cached, so each call asks the platform again.

| Blueprint | C++ | Does |
|---|---|---|
| **Get Starter** | `UCrowdyMods::GetStarter(TFunction<void(const FCrowdyModStarter&)> OnDone)` | The platform's own starter crate: a **Name** and the **Files** to hand to **Build Mod**. |
| **Build Mod** | `UCrowdyMods::BuildMod(const FString& CrateName, const TArray<FCrowdyModFile>& Files, OnProgress, OnDone)` | Builds one crate and waits for it. **On Progress** fires on each status change, **On Done** once at the end. |
| **Deploy Mod** | `UCrowdyMods::DeployMod(int64 GridId, const FString& Name, const FString& BuildId, OnDone)` | Puts a successful build on one of the player's grids under a name. A new mod starts switched off. |
| **Set Mod Enabled** | `UCrowdyMods::SetModEnabled(int64 GridId, const FString& Name, bool bEnabled, OnDone)` | Switches a mod on or off. |
| **List Mods** | `UCrowdyMods::ListMods(int64 GridId, OnDone)` | Every mod on one grid. |
| **List My Mods** | `UCrowdyMods::ListMyMods(OnDone)` | The signed-in player's mods on every grid of the app. |
| **Call Mod** | `UCrowdyMods::CallMod(int64 GridId, const FString& Name, const FString& Method, const FString& ParamsJson, OnDone)` | Calls one method of a mod with JSON parameters and answers its reply as JSON. |
| **Get Mod Logs** | `UCrowdyMods::GetModLogs(int64 GridId, const FString& Name, int32 Limit, OnDone)` | A mod's latest log lines, oldest first, from the last 24 hours. **Limit** is 1 to 500, or 0 for 100. |
| **Delete Mod** | `UCrowdyMods::DeleteMod(int64 GridId, const FString& Name, OnDone)` | Stops a mod and removes it, with its state and its versions. |

The player must be signed in to the app. Grid ids are 64-bit: keep them as Integer64 in Blueprint and `int64` in C++.

## Example: a guestbook on a plot

The guestbook (`ALanternGuestbook`) stands on a plot its owner claimed. **Plot Grid Id** is the claimed chunk's grid, **Mod Name** is the mod's name on it, a sphere **Trigger** notices who walks in, and a Text Render component named **Sign** shows what the guestbook says. In Blueprint, give your actor an Integer64 variable named **PlotGridId** and a Text Render component named **Sign**.

The platform's starter crate is a greeter, which makes it a ready guestbook. Its name is `grid-mod`, and it has two methods:

- `visit` counts one visit, remembers the caller, and answers a JSON string: `"welcome to grid 7, visitor 3"`.
- `state` answers a JSON object: `grid`, `visits`, `last_visitor` (that player's user id), counts of the world events it heard, and the chunk of the last one.

The starter writes no blocks, so nothing here reloads a chunk.

The owner installs the guestbook once and can switch it off. Visitors sign it, and anyone can read it.

### Install the guestbook

Install from the owner's own menu or button, once. Never build on an overlap: a build takes about half a minute.

**Get Starter** answers the starter's **Name**, which becomes the mod's name, and its **Files**. A crate is a list of files, each a **Path** and its **Content**: `Cargo.toml`, `README.md` and `.rs` files under `src/`, at most 64 files and 2 MB of source. Anything else answers **Refused** before a request is sent.

**Build Mod** sends the crate and then reads its status every 2 seconds. It gives up after 11 minutes with **Failed**. A player has one build at a time. **On Progress** gives the status as it changes: **Queued**, **Building**, then **Succeeded** or **Failed**.

:::caution
A crate that does not compile is not an error. **Build Mod** ends with **Result** **Success** and **Status** **Failed**, and **Log** holds the compiler's output, at most 64 KB with the end kept. Check **Status** before you deploy.
:::

**Deploy Mod** takes the **Build Id** from a successful build. The mod's name is 1 to 48 lowercase letters, digits, `-` or `_`; a grid holds at most 8 mods and a player at most 64. Deploying a new version of a running mod restarts it.

**Set Mod Enabled** with **Enabled** true switches it on. Since Game API v2.66.0 a switched-on mod starts when a player is in its grid, so nothing needs to start it. A call starts it too, which covers the couple of minutes after a platform update in which a player's arrival may not.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`InstallGuestbook` asks for the platform's starter and hands it to `BuildGuestbook`. `bBusy` lets one install, open or close run at a time, so a second press, or a close during a build, cannot be undone by a late answer.

<CppSnippet id="mods-install" />

`BuildGuestbook` remembers the starter's name, builds its files, and shows each status on the sign. A build that did not succeed shows its compiler output, or the message when the call itself failed, and stops there. `EndStep` ends every step the same way: it frees the buttons and shows the outcome.

<CppSnippet id="mods-build" />

A successful build is deployed on the plot's grid, then switched on, and the sign invites visitors in. A refused deploy or switch shows the platform's reason, for example a grid the player cannot write server code to.

<CppSnippet id="mods-deploy" />

</TabItem>
<TabItem value="bp" label="Blueprint">

**InstallGuestbook** calls **Get Starter**, and **On Done** feeds **Name** and **Files** to **Build Mod**. From **On Done** of the build, a **Switch on ECrowdyModBuildStatus** sends only **Succeeded** on to **Deploy Mod**, which takes **PlotGridId**, the starter's **Name** and the build's **Build Id**. **On Done** of the deploy calls **Set Mod Enabled** with **Enabled** true. Wire **On Progress** of the build to the sign's **Set Text** to show the status, and **Failed** on the switch to show **Log**. Handle **On Failed** on each node, and keep a Boolean, as the C++ keeps `bBusy`, so a second press does nothing while an install runs.

<Blueprint src="mods-install" title="InstallGuestbook, Get Starter, Build Mod, Switch on ECrowdyModBuildStatus, Get PlotGridId, Deploy Mod, Set Mod Enabled" />

</TabItem>
</Tabs>

### Sign it when a visitor walks in

A visitor's game calls the mod. It never ran the install, so it knows the grid and the name from the placed guestbook: **Plot Grid Id**, and **Mod Name**, which is `grid-mod` for the starter.

**Call Mod** names the grid, the mod and a method, and sends **Params Json** as the method's argument; an empty **Params Json** sends `{}`. **Reply Json** holds whatever the method returns, as JSON. A string comes back with its quotes, so read it with a JSON reader before you show it.

A switched-off mod answers **Denied**, and a deleted one answers **Not Found**. A mod the app has not admitted stays not running even when it is switched on: [list it](#list-mods-and-read-their-logs) to see whether it runs.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The overlap signs only for this player's own pawn: in a standalone game an AI controller counts as local too, so it also asks **Is Player Controlled**. `bSigned` makes it sign once, so each visitor is counted once, by their own game; a failed call clears it, so the next visit tries again.

<CppSnippet id="mods-enter" />

`SignGuestbook` calls `visit` and puts the welcome on the sign. The reply is the plot owner's text, so the sign shows at most `MaxSignChars` of it. Unreal's JSON reader wants an object or an array at the root, so the string reply is read inside an array. A **Denied** answer means the guestbook is switched off, by its owner or by billing. Reading JSON needs `Json` in your module's Build.cs.

<CppSnippet id="mods-visit" />

</TabItem>
<TabItem value="bp" label="Blueprint">

**SignGuestbook** calls **Call Mod** with **PlotGridId**, **Name** `grid-mod`, **Method** `visit` and **Params Json** `{}`, and **On Done** sets the sign's text to the first 200 characters of **Reply Json**, through **Left**. Call it from **Event ActorBeginOverlap** after a **Cast To Pawn**, **Is Locally Controlled** and **Is Player Controlled**, as the C++ does. The SDK has no Blueprint node that reads JSON, so the sign shows the reply as the mod sent it, quotes included: `"welcome to grid 7, visitor 3"`. Read it in C++ to drop them. **On Failed** with **Result** **Denied** means the guestbook is closed.

<Blueprint src="mods-visit" title="SignGuestbook, Get PlotGridId, Call Mod, Left, Get Sign, To Text (String), Set Text" />

</TabItem>
</Tabs>

### Show the owner who came

`state` answers the guestbook's whole state, and anyone may call it. `ShowGuestbook` reads `visits` and `last_visitor` from the object and shows them on the sign. A user id is 64-bit, so the reply is read with its numbers kept as written; read as a double, a large id would lose its last digits.

<CppSnippet id="mods-state" />

In Blueprint, **Call Mod** with **Method** `state` answers the same object as text in **Reply Json**. Show it as it is, or read it in C++.

### Close the guestbook

**Set Mod Enabled** with **Enabled** false switches the mod off. While it is off, a visitor's **Call Mod** answers **Denied**, and `SignGuestbook` above shows the guestbook closed. `OpenGuestbook` switches it on again. Both wait for an install still running.

<CppSnippet id="mods-close" />

In Blueprint, it is one **Set Mod Enabled** node with **PlotGridId**, the mod's name and **Enabled** false.

## List mods and read their logs

**List Mods** and **List My Mods** answer **Mods**, an array of **Crowdy Mod**. Each has:

| Field | Is |
|---|---|
| **Mod Id**, **Name**, **Grid Id**, **Owner User Id** | Which mod it is and whose. |
| **Version**, **Digest** | The deployed version, and the SHA-256 of its module in hex. |
| **Enabled** | Its owner switched it on. It runs only while this holds and it is not blocked. |
| **Running** | An instance of it runs now. A switched-on mod that is not running starts on a player's arrival in its grid or on a call. |
| **Blocked**, **Blocked Reason** | A switch such as billing's has stopped it, whatever **Enabled** says. The reason says which. |
| **Updated At Ms** | Unix time in milliseconds. |

**Get Mod Logs** answers **Lines**: each has **At Ms**, a **Level** (0 error, 1 warning, 2 info, 3 debug) and the **Text**. When a call fails or a mod does not do what you expect, read its logs first.

## What each result means

| Result | Means |
|---|---|
| **Success** | Done. For **Build Mod** it means the build ran to an end; read **Status**. |
| **Not Signed In** | The player has no app token yet. Nothing was sent. |
| **Denied** | A missing permission, a grid that is not the player's, or a billing switch. **Message** names which. A switched-off mod answers **Denied** to a call. |
| **Not Found** | No such mod, build or grid. A deleted mod answers this to a call. |
| **Refused** | Any other refusal: a name that is not allowed, a limit reached, or a crate this SDK rejects before sending. |
| **Failed** | The request did not complete, or a build did not finish in 11 minutes. |
| **Bad Reply** | The answer was malformed, so nothing from it is returned. |

In Blueprint the nodes report a result other than **Success** on **On Failed**, with **Result** and **Message**.

## What a mod costs

A mod bills its owner's player wallet once their monthly trial is used up, not your app, and an empty wallet or a spend cap switches the owner's mods off, which shows as **Blocked** (see [Who pays for a mod](/exec/mods#who-pays-for-a-mod)).

Each call is one request, except **Build Mod**, which is one request to send the crate and one every 2 seconds to read its status.

## From C++

Every callback runs once on the game thread, unless the game instance ends first. `UCrowdyMods` has fixed limits as constants: `MaxFiles` (64), `MaxSourceBytes` (2 MB), `BuildPollSeconds` (2), `BuildLimitSeconds` (11 minutes), `MaxLogLines` (500) and `DefaultLogLines` (100). The types behind the nodes:

| Type | Is |
|---|---|
| `ECrowdyModResult` | `Success`, `NotSignedIn`, `Denied`, `NotFound`, `Refused`, `Failed`, `BadReply`. Values are only added at the end. |
| `ECrowdyModBuildStatus` | `Queued`, `Building`, `Succeeded`, `Failed`. |
| `FCrowdyModFile` | `Path` and `Content` of one source file. |
| `FCrowdyModStarter` | `Result`, `Name`, `Files` and `Message`. |
| `FCrowdyModBuild` | `Result`, `BuildId`, `Status`, `Log`, `SdkVersion` (the version it compiled against, once it started) and `Message`. |
| `FCrowdyMod` | One mod: `ModId`, `GridId`, `OwnerUserId`, `Name`, `Version`, `Digest`, `bEnabled`, `bRunning`, `bBlocked`, `BlockedReason` and `UpdatedAtMs`. |
| `FCrowdyModInfo` | `Result`, `Mod` and `Message`: the answer to deploying and switching. |
| `FCrowdyModList` | `Result`, `Mods` and `Message`. |
| `FCrowdyModLogs`, `FCrowdyModLogLine` | `Result`, `Lines` and `Message`; a line is `AtMs`, `Level` and `Text`. |
| `FCrowdyModDelete` | `Result`, `bDeleted` and `Message`. |
| `FCrowdyModCall` | `Result`, `ReplyJson` and `Message`. `ReplyJson` is the mod's answer as JSON text, empty unless `Result` is `Success`. |
| `UCrowdyGetModStarter`, `UCrowdyBuildMod`, `UCrowdyDeployMod`, `UCrowdySetModEnabled`, `UCrowdyListMods`, `UCrowdyListMyMods`, `UCrowdyGetModLogs`, `UCrowdyDeleteMod`, `UCrowdyCallMod` | The nodes. C++ calls the subsystem instead. |
| `FCrowdyModBuildAsyncResult`, `FCrowdyModStarterAsyncResult`, `FCrowdyModInfoAsyncResult`, `FCrowdyModListAsyncResult`, `FCrowdyModLogsAsyncResult`, `FCrowdyModDeleteAsyncResult`, `FCrowdyModCallAsyncResult` | The delegate types of the nodes' pins. |
