---
slug: deploy-with-server-compute
sidebar_position: 6
title: Deploy it with Server Compute
description: Build and deploy a project's Server Object code from the Server Compute page in Crowdy Studio, which types changed since the live version, what a deploy sends and replaces, a deploy built in several parts and server code reused by its digest, adding a Game Kit starter, removing a type, versions and rolling back, switching one type or the whole app off and on, restarting a type and moving running Server Objects to a new deploy, the app's use against its limits, calling a Server Only or Developers Only function as the developer, reading logs and following one call, call activity, the Settings tab, and the same operations from the command line for CI, including generating server code, checking the sign-in, defining a Server Object type from a JSON file, and removing, renaming or restarting types.
---

# Deploy it with Server Compute

:::note
Server Objects run on [ck-exec](/exec/intro).
:::

Once a type's [server code](./write-server-logic.md) is generated and its `logic.rs` written, the server still has to run it. **Server Compute** is the page in [Crowdy Studio](../studio/overview.md) that builds your project's server code on the platform, deploys it to your app, and then lets you watch it work: which version is live, what it logged, how players' calls to each Server Function went, and a switch to stop one type if it misbehaves. There is nothing to install: the build happens on the platform, so no Rust toolchain is needed on your machine.

## Open the page

Open Crowdy Studio (**Tools, Crowdy SDK, Crowdy Studio**) and choose **Server Compute** under **COMPUTE** in its navigation.

It uses the sign-in and the app you already set in Studio: [sign in](../studio/sign-in.md), then pick your app on the [Project page](../studio/projects-and-apps.md). If you are not signed in, or no app is set, the page says so ("Sign in to Crowdy Studio first" or "Set the app in Crowdy Studio first", then "Sign in and choose an app on the Project page.") and shows a **Try Again** button; fix it in Studio and press that.

The header holds the title, the line "Deploy your Server Objects' server code, then watch how players' calls to it go.", a line naming the app and backend ("App 12345 on Dev"), one status badge, and **Refresh**. The badge shows the first of these that applies:

| Badge | Meaning |
|---|---|
| **Budget paused** | The app's Server Compute is paused by billing, so players' calls are refused until it is resumed. Hover it for the reason the platform gives, such as `insufficient_funds` or `spend_cap`. |
| **Switched off** | The app's Server Compute is switched off, so players' calls are refused. A **Switch on** button sits beside the badge. |
| **Nothing deployed** | The app has no active server code yet. |
| **Live: version 7** | Version 7 is the app's active server code. |

Beside the badge a small line shows how much of the app's room the Server Objects use in this datacenter, for example "3 of 16 Server Objects · 192 of 1,024 MB": how many are placed against the app's limit, and the memory they reserve (each reserves its type's **Memory per Instance**, see [Server Limits](./create-a-type.md#every-setting)) against the app's memory limit. Both limits come from your organization's funding: an app with no funds can run 16 Server Objects at once within 1 GB, a funded app 16,384 within 64 GB. Past either, no new Server Object starts until some stop, and a call to one that is not running is answered **Unavailable** with the platform's reason. Each running instance of a [Server Function Library](./server-function-libraries.md#scaling) counts as one. The line is missing when the platform does not report it.

Hover a badge for a one-line explanation. **Refresh** reads the app's status, versions, logs and activity again and checks the project's Server Object types. If you change the app in Studio, the header line adds "The project's app has changed since; press Refresh to show it."

The page has five tabs: **Overview**, **Versions**, **Logs**, **Activity** and **Settings**. Building, deploying, making a version active and switching on or off need your organization's `manage_compute` permission; reading needs `view_compute_diagnostics`. A problem from the platform, such as a missing permission, is written in red under the tab it came from, for example "Could not read the app's status: ..."; a busy server is retried for you first.

## Overview

The left side lists every definition asset in the project, sorted by Type Name, then any type that is on the server but no longer in the project, each with its Type Name and **one badge**. **Search types** narrows the list by name, and the tabs above it filter it: **All**, **To deploy** (types that are new, changed, running code not recorded here, or removed) and **Problems** (types whose code cannot be built, or with a Server Object the platform holds back). Click a type to show it on the right; the first type is shown when the page opens.

The right side shows the selected type: its Type Name (hover it to see its asset), its badge, the running switch and a **...** menu, then the type's description, if its [definition](./create-a-type.md#every-setting) has one, and a small line with how many functions it has, how many variables are visible to players ("2 variables visible to players"), who can read it ("readable by every player", "readable by its members", "only its owner can read it", or "closed to players: only server code and developer tools reach it" for [a type players cannot reach](./access-members-and-timers.md#a-type-players-cannot-reach)) and, once the Activity numbers are in, how many calls it had over the Activity tab's period, for example "1.2k calls in the last hour", and how many of its Server Objects are running or starting now ("2 running"). The parts are separated by dots. A [Server Function Library](./server-function-libraries.md) says "Server Function Library" first, and in place of the variables and who can read it says how many instances it runs, "1 to 4 instances" for a Min Instances of 1 and a Max Instances of 4, or "4 instances" when the two are equal. When the platform will not place one of the type's Server Objects, for example after it crashed again and again, a red line under it says which and why: "village is held back: ...". Last, a box says what the badge means for this type, such as "Not live yet. Deploy to add it." or "Changed since version 7: server code. Deploy to make it live."

![The Server Compute page: the deploy strip under the tabs with Add starter and Deploy starter pack, five of the project's Server Object types on the left, and the selected type's details on the right](/img/unreal-sdk/server-compute-overview.png)

The badge is the first of these that applies. What stops the type's server code from being built comes first:

| Badge | Meaning |
|---|---|
| Needs generating | There is no folder for the type yet, `logic.rs` is missing, or the type uses [My Own File](./write-server-logic.md#use-your-own-logic-file) and no file is chosen or the file is missing. The reason is written under the Type Name. |
| Out of date | The definition or a struct it uses changed since the code was generated. Regenerate it with **Generate**. The reason names the file and the first line that differs, for example `... no longer matches the definition (line 7: the file has "...", Generate writes "..."); regenerate it with Generate Server Code`; a long line is cut after 80 characters. |
| Problem | The definition fails its checks, or its Type Name is `root`, the name of the platform's top-level type ("root is the name of the platform's root Server Object type; choose another Type Name"), or starts with `ck_staged_`, which is kept for the stand-ins of [a deploy in parts](#a-deploy-in-parts) ("Type Names starting ck_staged_ are kept for the stand-ins a deploy in parts stores its builds with; choose another Type Name"). The reason is written under the Type Name. |

Once the type's code is fine, the badge says how the type compares with the version that is live now:

| Badge | Meaning |
|---|---|
| No changes | The live version runs this code with these settings. Hover: "Live in version 7 exactly as it is here". |
| Changed | The live version runs another revision of the code, or other settings. Hover: "Changed since version 7: server code, save interval. Deploy to make it live." It can list server code, save interval, idle timeout, platform data (the [Platform Data](./access-members-and-timers.md#platform-data) settings), player access (whether [players can reach the type](./access-members-and-timers.md#a-type-players-cannot-reach)), server limits (the [Server Limits](./create-a-type.md#every-setting) settings), kind (the type is a Server Object live and a [Server Function Library](./server-function-libraries.md#switch-kind) here, or the reverse), scaling (a library's [Scaling](./server-function-libraries.md#scaling) settings), and, for a [Game Kit starter](./use-game-kit-starters.md#change-a-starter), config and parent. Limits are compared the way the platform applies them: a value out of range counts as the nearest value in range, and a limit written as a string in a manifest from another tool is read as a number, so such a manifest no longer shows "server limits" as changed on every check. |
| New | The live version does not run this type: "Not live yet. Deploy to add it." |
| Live code unknown | The live version runs code this project has no record of, for example deployed from another copy of the project. "Deploying replaces it." See [What a deploy records](./write-server-logic.md#what-a-deploy-records). |
| Ready | The type's server code is fine, but it has not been compared yet, because the app's versions have not been read (you are not signed in, or the read failed). Press **Refresh**. |

A type that the live version runs and the project no longer has is listed with a **Removed** badge ("On the server, not in this project"); selected, it shows its name, the running switch, and the line "On the server, not in this project. Your next deploy removes it." A project with no types left can still deploy: the deploy sends the Crowdy SDK's own root alone (see [Deploy](#deploy)), which removes every type from the server.

The definition asset's editor shows the same state for its type in the status readout at the right of its toolbar, with **Changed since version 7** and **Not deployed yet** in place of Changed and New; see [The asset editor](./create-a-type.md#the-asset-editor). Its **Deploy** dropdown has an **Open Server Compute** entry that brings you to this page.

The page does not regenerate code for you. Regenerate from the Content Browser or the asset, then open the tab again or press **Refresh**. With no definition assets it says "No Server Object types yet." and "Create a Server Object Definition asset to add one."

Once the app's status is known, a type the live version runs also says **Running** or **Switched off**, with a **Switch off** or **Switch on** button (see [Switching a type or the app off and on](#switching-a-type-or-the-app-off-and-on)), and a running one has a **Restart** button before it (see [Restarting a type](#restarting-a-type)). A type that is not live yet has nothing to switch, so it shows neither.

### Remove a type

The **...** menu on a type has two entries. **Open definition** opens the type's definition asset. **Remove from project...** takes the type out of the project: it deletes the definition asset and, when the folder is the type's own, its `Server/<Type Name>/` folder. It is disabled while another operation runs, and it asks first, in a dialog titled "Remove village_beacon":

> Remove village_beacon from this project?
>
> This deletes its definition /Game/Beacon/CSO_VillageBeacon and its Server Code folder Server/village_beacon.
>
> village_beacon keeps running on the server (App 12345 on Dev) until your next deploy, which removes it.

The confirm changes with the situation:

- **What it deletes.** Everything in the type's `Server/<Type Name>/` folder goes with it: `logic.rs`, the generated files and `revisions.json`, so the type's revision history goes too. Get them back from version control if you need them. A logic file of your own that lives outside that folder is never touched.
- **What it leaves, and why.** The folder is left alone, and the dialog says "This deletes its definition ... only." followed by the reason, when deleting it could hurt something else: "Another definition has the same Type Name and so the same Server Code folder, which is left as it is."; "Its Type Name is not a valid one, so its Server Code folder may be another type's; it is left as it is."; "Its Server Code folder is not directly inside the project's Server folder, so it is left as it is."; "It has no Server Code folder."; "Its Server Code folder holds server code the Crowdy SDK did not generate, so it is left as it is."; or "Its Server Code folder is, or holds, a link to somewhere else, and deleting it could delete what the link points to; it is left as it is, so delete it by hand." A folder that could not be deleted is reported in red under the tab: "Removed village_beacon's definition, but could not delete its Server Code folder Server/village_beacon. Delete it by hand."
- **Unsaved code edits.** If the type's code has edits you have not saved, the dialog lists the files: "Its unsaved code edits are lost:".
- **What it does on the server: nothing yet.** A type that is live keeps running, with players calling it, until your next deploy, which no longer includes it and removes it (the deploy's confirm says "It removes village_beacon, which this project does not have; their Server Objects stop."). Until then it shows as a **Removed** row, where you can still switch it off. The deploy stops its Server Objects and keeps their saved state, and the type's switch goes with it: a later deploy that adds a type of the same name starts those Server Objects from what they saved, switched on. A type that was never deployed ("New") says "village_beacon is not live on the server (App 12345 on Dev), so nothing changes there."
- **The last type.** Removing the project's last type is no different: the next deploy sends the Crowdy SDK's root alone and removes the type from the server. To stop players' calls to it before then, use **Switch off** on this page.

After you confirm, the editor's own delete runs, with its usual check of what still refers to the definition, for example a Blueprint slot holding it; it may ask again, and if you cancel there nothing else happens. If the row went stale (the asset moved, or its Type Name changed since the list was read) nothing is removed and the page says "/Game/Beacon/CSO_VillageBeacon is no longer the definition of village_beacon, so nothing was removed. The list is read again; try once more from it."

For a build server or a script, `-op=removetype` does the same from the command line; see [From the command line](#from-the-command-line).

### Deploy

**Deploy** sits in the page's title row, beside **Refresh**, so it stays in reach however long the list of types grows. It shows how many types the deploy adds, changes or removes ("Deploy 3"), reads **Up to date** when there is nothing to deploy, and **Working...** while an operation runs. Under the tabs, a strip holds the status line, **Add starter** (see [Use the Game Kit starters](./use-game-kit-starters.md#add-a-starter)) and **Deploy starter pack**; before anything is known it says "Deploy builds every type's server code on the server and makes it the app's live version. Players use it at once."

**Generate** sits between **Refresh** and **Deploy**. It reads "Generate 3" while 3 types are out of date or have no server code yet, and it is enabled only then, and only while no other operation runs. Game Kit starters are not counted, and neither are types that need you, such as a [My Own File](./write-server-logic.md#use-your-own-logic-file) type with no Logic File. Its tooltip reads "Generates the server code of every type that is out of date or has none yet, asking what a single Generate asks, then saves the definitions it changed." It generates those types one after another through the same Generate as a definition's own button, so it asks each question that Generate asks (see [Generate it](./write-server-logic.md#generate-it)), and a cancel stops the run. It then saves the definitions it changed, refreshes, and shows a notice of what was written and what was not, and why.

**Deploy is offered only when something changed.** Once every type's code is fine and the live version is known, the status line says what a deploy would do, and **Deploy** is enabled only if there is something to do:

- "Since version 7: 1 changed, 1 new. Deploying sends the project's 2 types." Any of "changed", "new", "running code not recorded here" (the live version runs something this project has no record of) and "removed" can appear, each with its count.
- "Nothing changed since version 7." **Deploy** reads **Up to date** and cannot be pressed.
- "Nothing is deployed yet. Deploying sends the project's 2 types." for an app with no active version.
- "Ready to deploy 2 Server Object types." when the live version could not be compared, for example because it has not been read yet; press **Refresh**.
- "This project has no Server Object types, so deploying sends only the Crowdy SDK's root (Players Online)." when the project has no types. A project like that can still deploy: the root goes alone, and any type the app ran before is removed.

A change you have just deployed keeps its "Deployed as version 8." line until something changes again, then the summary takes over. A failed or half-recorded deploy keeps its message until the next deploy. **Deploy** is disabled while any type is not fine, and the line says what to do: "Fix the 1 type marked Problem first." or "Generate Server Code for 1 type first (right-click the definition in the Content Browser)."; two definitions with one Type Name show "Two Server Object types are named village_beacon (...) and (...); each needs its own Type Name". A type whose `Server/<Type Name>/` folder holds a crate the SDK did not generate is marked **Problem** with "... holds server code the Crowdy SDK did not generate; choose another Type Name, or move that folder" (see [Generate it](./write-server-logic.md#generate-it)). It is also disabled while another operation runs. The same rules apply to the **Deploy** button in a definition asset editor's toolbar.

**Deploy** asks first, in a dialog titled Deploy. The first sentence is always there, then one sentence for each kind of change that applies, naming the types, with what it removes first:

> Deploying replaces the active server code of App 12345 on Dev with this project's 2 Server Object types.
>
> It removes tip_jar, which this project does not have; their Server Objects stop. Their saved state is kept and is used again if you deploy them again.
>
> It adds lantern.
>
> It changes village_beacon (server code, save interval).

A type whose kind changes also gets a sentence of its own, "loot_roller changes from Server Object to Server Function Library: its saved data is kept, unused, and comes back if it becomes a Server Object again." or, the other way, "loot_roller changes from Server Function Library to Server Object: it starts from the saved data it had as a Server Object, if any."

A project with no Server Object types gets "Deploying replaces the active server code of App 12345 on Dev. This project has no Server Object types, so only the Crowdy SDK's root (Players Online) is deployed." as its first sentence. The other one is "It replaces live code this project has no record of in village_beacon." When what the app runs now could not be read, the dialog says "What the app runs now could not be read, so what this changes is not known." instead. Read the list before you answer Yes: it is the difference between what you have here and what players are running.

"It removes" names every type the live version runs that this project does not have, however it got there: a type you removed from the project, one deployed from another copy of the project, or server code deployed another way, such as a crate written by hand and deployed with the platform's API. Deploy cannot send such code, so answering Yes takes it offline. If your app runs code like that, deploy it the same way you deployed it before, not from this page.

If any server code file has edits you have not saved in the asset editor's Server Code tab, the dialog adds:

> 1 Server Code file has unsaved edits; Deploy sends the saved files.

and lists the file names. Answer No, save them, and deploy again if you meant to send them.

When the server code of some types is exactly what an earlier deploy to this app sent, the dialog adds "The server code of lantern, village_beacon is as it was deployed before, so it is not built again." When the deploy is built in parts, it adds "The server code is built in 2 parts. Each part but the last is first stored by a version that runs what runs now, so the version history gains 1 more version."; see [A deploy in parts](#a-deploy-in-parts).

If the server code calls into platform data its definition does not ask for, the dialog adds "Check before deploying:" and one line for each, such as:

> village_beacon: its server code calls world().set_voxels(), which needs world.write; turn on Changes the World or the platform refuses that call

Answer No, tick the setting in the definition, and deploy again; see [Platform data](./access-members-and-timers.md#platform-data). The check ignores code inside Rust raw strings and inside `#[cfg(test)]` items, so a call that only appears there is not listed.

The same list holds a function that cannot use what it sets: a **Developers Only** or **Server Only** function with a **Cooldown** or a **Required Feature** gets "village_beacon Refill: Cooldown has no effect, since only players' calls are limited." or "village_beacon Refill: Required Feature has no effect, since only players are checked." Only players are limited and checked, so clear the setting, or let players call the function. See [Cooldown](./access-members-and-timers.md#cooldown).

Confirm, and Studio sends the platform:

- the server code of **every** Server Object type in the project, exactly as it is on disk under `Server/<Type Name>/` (a type whose Code Source is My Own File sends that file as its `logic.rs`), and
- a crate named `root` that the SDK generates for you from `CSO_PlayersOnline` in its own content. It is the top-level type every Server Object type sits under on the platform. It keeps one variable, the number of players in the app's world, which **Get Players Online** reads (see [How many players are online](./from-blueprint/read-and-follow-variables.md#how-many-players-are-online)), and you never edit it. An app whose root an older Crowdy SDK deployed keeps no count, and Server Compute offers a deploy until you make one. The root is not shown as a row, but it is tracked like a type: once a deploy from this SDK has recorded it, a later Crowdy SDK whose root code differs makes Server Compute offer a deploy again. An app whose root was deployed by an earlier SDK is compared only after your next deploy. A project with no Server Object types deploys the root alone. A project with the Game Kit's `world` starter does not send this crate: `world` is the root instead, and every other type runs under it; see [The world becomes the app's root](./use-game-kit-starters.md#the-world-becomes-the-apps-root).

together with an entry for each type saying whether players may reach it and what platform data its server code may use, and giving its **Save Interval Seconds** and **Idle Timeout Seconds** from the definition (the platform's [manifest](/exec/intro#the-manifest)). A Server Function Library's entry is `"kind": "spoke"` with its **Min Instances**, **Max Instances** (only when above Min Instances) and **Parallel Calls per Instance** as `replicas`, `max_replicas` and `concurrency`, and no save interval or idle timeout; a type with **Can Call Any Type** lists `"calls": ["*"]`.

A deploy replaces the app's active server code as a whole; it does not add to it. That is why every type goes together: a type left out of a deploy is a type the app no longer has in its active code, until a deploy or a version that includes it is active. That is also how [removing a type](#remove-a-type) takes effect. For the example world, a project with `CSO_VillageBeacon` and a `CSO_Lantern` sends `village_beacon`, `lantern` and `root` in one deploy, even when only the beacon's `logic.rs` changed. Only the beacon is built, though: see [Server code that is not built again](#server-code-that-is-not-built-again).

The status line follows the build: "Sending the server code...", "Waiting for a builder... 4 s", "Building on the server... 12 s", "Deploying...", and finally the line below. A deploy built in parts says which part it is on, "Part 1 of 2: building on the server... 12 s", and one with nothing to build goes straight to "Deploying...".

> Deployed as version 7.

Once the deploy succeeds, Studio also records what it sent in each type's `Server/<Type Name>/revisions.json`, and the Crowdy SDK's root in `Server/root/revisions.json`, which is how the page tells you next time what changed; see [What a deploy records](./write-server-logic.md#what-a-deploy-records). If a record cannot be written the deploy still stands, and the line says so in the warning color: "Deployed as version 7. Its record could not be saved, so its changes cannot be compared: ..." Commit each `revisions.json` with the crate, and `Server/root/revisions.json` too.

A **Build output** button appears once a build has output, and opens it in a read-only box. A failed build deploys nothing: the line says "The build failed. See the build output below." and the box opens by itself, usually with a compiler error in a `logic.rs`. Only one operation runs at a time; the buttons are disabled until it ends.

Each type's server code, its crate, may have at most 64 files and 2 MB of source; the [builds page](/exec/builds#limits) has the platform's full list. A project with a crate over either shows the reason on the status line, such as "village_beacon's server code has 70 files; each type's server code can have at most 64" or "village_beacon's server code is 2.10 MB; one build takes at most 2 MB of source", and **Deploy** stays disabled. A deploy with more crates or more source than one build takes is not refused for it: it is [built in parts](#a-deploy-in-parts).

A running Server Object keeps its old code until it next starts; see [Operations](/exec/operations#instances-and-versions). So after a deploy that changed a type, the card reads the app's Server Objects, and when some of a changed type are still running it adds a line and two buttons:

> 3 running Server Objects of village_beacon still run the previous version until they stop when idle. Move them to the new version now?

**Move now** restarts those types (see [Restarting a type](#restarting-a-type)) without asking again; **Leave them** dismisses the line, and they move when they next start. Which Server Objects ran the previous version is decided from the Server Objects read as the deploy was sent, by their epoch, not from your computer's clock, so a clock that is off does not hide or add any.

### Server code that is not built again

A type's server code is not built again when its files are exactly those of a revision in its `revisions.json` that this app already holds, because one of the app's versions ran it. The deploy names that module by its digest instead, and the confirm says "The server code of lantern is as it was deployed before, so it is not built again." So a deploy that changed one type's code builds that one crate, a change of settings alone, such as a save interval, builds none, and a deploy with nothing to build sends no build at all. This needs the app's versions, so when they could not be read every crate is built. **Deploy** on the page always reuses what it can. To build every type's server code again, including types whose code did not change, so they pick up the platform's current SDK and toolchain, open the drop-down arrow beside **Deploy** and pick **Rebuild All and Deploy**. It is available even when there is nothing to deploy, and it asks to confirm first. The command line's `-op=deploy -rebuild` does the same, and both follow one rule.

### A deploy in parts

The platform builds at most 16 crates and 2 MB of source at a time. A deploy with more, such as a project with many types or with the [Game Kit starters](./use-game-kit-starters.md), is built in several parts, in order, each at most 16 crates and 2 MB. It still becomes one version, and what players run changes once:

1. **Every part is built first.** A part that fails deploys nothing, and nothing on the app changes.
2. **Each part but the last is stored.** The platform keeps a build's modules only once a version has used them, so each of those parts is deployed in a staging version: the types that run now, unchanged, plus a stand-in type for each of its crates, named `ck_staged_` and the crate's name, which nothing calls and players cannot reach. The version that was active is then made active again at once. Before the first of these, the versions are read again, and if the app's active version changed since the deploy started, it stops: "The app's active version is version 9, not version 8 as when the deploy started, so nothing was deployed; refresh, then deploy again".
3. **The deploy itself** names the stored and reused modules by their digest, with the last part's build, and its version runs no stand-in.

So the [Versions](#versions) tab gains one version per extra part, before the deploy's own. The confirm says how many parts there are and how many more versions they add. On an app with nothing deployed there is nothing to make active again, so a staging version stays active until the deploy.

If storing a part fails, the line says "Built, but storing the builds failed: " followed by the platform's words and what is active now, such as "Version 8 is active again, as before the deploy." A deploy in parts needs to know what runs now, so when the app's versions could not be read it refuses before building anything: "This deploy is built in parts, each first stored by a version that runs what runs now, and what runs now could not be read; refresh, then deploy again".

### Deploy starter pack

**Deploy starter pack** builds and deploys the platform's example types instead of your project, after asking:

> Deploying the starter pack replaces the active server code of App 12345 on Dev with the platform's example Server Object types.
>
> It removes village_beacon, lantern, which the active version runs, unless the starter pack has a type of the same name; that type then takes over its saved Server Objects. Their saved state is kept and is used again if you deploy them again.

The second sentence names what the live version runs, the SDK's `root` left out, and is missing when nothing is live. When what the app runs could not be read, it says "What the app runs now could not be read, so what this removes is not known." instead.

It is meant for trying the platform out on an empty app. It replaces your project's server code just as **Deploy** replaces the previous code, so do not press it on an app your game uses; if you do, make the earlier version active again on the Versions tab. See [Starter packs](/exec/builds#starter-packs).

## Versions

Every deploy makes a new version. The **Versions** tab lists them newest first: "Version 7", an **Active** badge on the live one, and a line such as "3 h ago by Ada, 2 types" (hover it for the exact time). Under it, a second line says what that deploy changed from the version before it, for example "Since version 6: village_beacon changed", or "Since version 6: lantern added" and "lantern removed" when a type came or went, several joined by dots. A deploy that changed nothing says "Same server code as version 6". Hover it: "The types whose server code or settings differ from the version before it". The platform reports each version's types, so this works for versions anyone deployed, from any copy of the project; the oldest version has no line, and neither does one whose code cannot be compared with the one before because the platform has no build digest for it. With nothing deployed the tab says "Nothing deployed yet." and "Deploy from the Overview tab."

**Make active** on any other version asks first, in a dialog titled "Make version 6 active":

> Makes version 6 the active server code of App 12345 on Dev.

That is a rollback: if version 7 has a bug, make 6 active and players get the earlier code, while you fix `logic.rs` and deploy again. It changes no Server Object's saved values. As with a deploy, a running Server Object moves to the code when it next starts, and the Server Objects of a type the older version lacks are stopped with their saved state kept. That type's switch goes too, so a type you switched off comes back switched on when a later version runs it again. Rolling back to a version older than a definition change can leave Server Objects saved in a newer shape; read [Changing a type later](./create-a-type.md#changing-a-type-later) before you go back across one.

## Switching a type or the app off and on

Each type the live version runs has a **Switch off** button on the Overview tab, beside its name when selected, or **Switch on** once the type is off. Use it when one type is causing trouble and you want it quiet while the rest of the app carries on. Switching off asks first, in a dialog titled "Switch off village_beacon":

> Players' calls to village_beacon in App 12345 on Dev are refused until it is switched on again. Its Server Objects are saved and stopped.

Switching on asks nothing. While a type is off, calls to it are refused and reach the client as the `Paused` outcome, which is retryable (see [Troubleshooting](./troubleshooting.md#outcomes)), and nothing of that type runs. Switch it on and its Server Objects start again, from what was saved, the next time a call reaches them. It is not the same as removing the type in a deploy: the code stays and the type stays live. To move running Server Objects onto newly deployed code, use **Restart** instead, which refuses no calls. The buttons are disabled until the app's status has loaded and while another operation runs.

When the whole app is switched off, the header badge says so and its **Switch on** button, after asking "Players can call the Server Functions of App 12345 on Dev again.", lets players call the app again. The page cannot switch the whole app off; see [the kill switch](/exec/operations#the-kill-switch) for that.

## Restarting a type

**Restart** on a running type moves its running Server Objects to the live version now. It asks first, in a dialog titled Restart:

> Move village_beacon's running Server Objects on App 12345 on Dev to version 8 now?
>
> Each is saved and stopped, and starts again on version 8 at its next call. Players watching one see it read again; a call that arrives while it stops may be answered Unavailable.

Nothing is refused while it happens and no state is lost: each Server Object is saved first and starts again from what was saved. Players watching one see its values read again on the new start, the way they do after a reconnect. The deploy line then says how many it stopped, for example "3 running Server Objects stopped; each starts again on the active version at its next call." Use it after a deploy, from the **Move now** button the deploy strip offers, or whenever a fix should reach Server Objects that are running now rather than when they next stop. From the command line, `-op=restart` with no `-type` restarts every type that still has an instance on older code; see [From the command line](#from-the-command-line).

## Call a function as the developer

A [Server Only or Developers Only](./create-a-type.md#callable-by) function has no player to call it, so you run it by hand from the definition asset: select the function in the Server Object panel, and in its Details press **Call as Developer...**. A window titled "Call as Developer" opens with:

- **Instance Id**, the Server Object to call, such as `boss-1`. A type that is **Owner Only** takes its owner's user id, and a type with **Only One Instance** always calls its one Server Object, whatever is typed. It is needed otherwise.
- the function's inputs, starting from their default values, to fill in;
- **Call**, and under it the answer: "Ok" and the outputs as JSON, such as `{"total":7}`, or the outcome and the reason, such as "Denied: only members may call Deposit". If the connection itself is refused it says why, for example "Unavailable: could not connect as the developer: start failed: denied: an owner-only Server Object's Instance Id is its owner's user id".

The built-in member functions that only server code may call, such as **Add Member** when **Members From** is **This Object**, can be called this way too. They sit greyed out in the **Built-in** list of the Members panel, and a play button beside the row ("Call as Developer: runs this function on a live Server Object as you, the app's developer") opens the same window.

The call goes to the live app with your Crowdy Studio sign-in, as you: the server code sees `Caller::Developer` with your user id, not a player, and whatever it changes stays changed. It starts the Server Object if it is not running. If the function's inputs change in the definition while the window is open, **Call** says so; close the window and open it again.

## Logs

The **Logs** tab shows the lines your server code writes with `ctx.log`. For the beacon:

```rust
ctx.log(Level::Info, &format!("fed {} oil, now {}", params.Oil, self.Oil));
```

Filter by type (type a name in the "All types" box and press Enter) and by level: **All**, **Info**, **Warnings** or **Errors**. Lines come newest first, 100 at a time; **Load older** at the bottom pages back. Each line has a colored dot (hover for Error, Warning, Info or Debug), its text, and a small line such as "3 min ago, village_beacon, 42": when, the type, and the Instance Id. Hover it for the exact time. The platform keeps lines for 24 hours; with none to show the tab says "No log lines match." and "Lines are kept for 24 hours."

A **flow** is the platform's name for one call and everything it causes. **Show this call** on a line shows only the lines of that call, and a **One call** chip appears beside the level choices; its x shows every call again. That is how you follow one `FeedBeacon` from a player's request through the beacon's own lines. Lines written outside a call, such as when a Server Object starts or stops, have no flow and no button. The limits on how many lines a call and an app may log are on [Operations](/exec/operations#following-one-call).

## Activity

The **Activity** tab shows "How players' calls to each Server Function went, busiest first." for the **Last hour**, **Last day** or **Last week**. Each Server Function gets a card, for example `village_beacon.FeedBeacon`:

- how many calls: "1.2k calls in the last hour" (or "1 call in the last hour"),
- "no failures", or "94% succeeded",
- "usually answers in 12 ms (slowest 1.4 s)",
- and a badge for each kind of problem there was: **N server errors** (your code answered with an error, or the call failed on the server), **N timed out** (a call past its **Time per Call** also restarts that Server Object from its last save, so see [Server Limits](./create-a-type.md#every-setting)), **N refused** (the caller was not allowed) and **N busy** (the server was busy; the caller may try again). Hover a badge for what it counts.

If `FeedBeacon` is slow or refusing, this is where it shows. With no calls it says "No calls yet in this period." The numbers come from [Calls per endpoint](/exec/operations#calls-per-endpoint) on the platform.

## Settings

The **Settings** tab holds Server Compute's settings for this project: "Server Compute's settings for this project. They are saved with the project, so everyone working on it shares them." It has one card so far, **Revisions**, with one setting.

**Revisions to keep** is how many deployed revisions of each type's server code the project keeps, to view, compare or restore in the definition asset editor's [Server Code tab](./write-server-logic.md#view-compare-and-restore-an-earlier-deploy). It is a number from 3 to 50 and starts at 5. The hint under it reads "Per type, how many deployed revisions of its server code the project keeps to view, compare or restore (3 to 50). Saved in Config/DefaultEditor.ini; keeping fewer takes effect at the next deploy." The number is changed when you press Enter or leave the box.

The setting is saved to `Config/DefaultEditor.ini` in your project, not to your own editor preferences, so commit that file and your team shares one value. If the file cannot be written the page says "Could not save to Config/DefaultEditor.ini, so the change lasts only until the editor closes. Check that the file can be written, for example that it is not read-only." Check the file out first if your version control keeps it read only. Each type's history is `Server/<Type Name>/revisions.json`, which holds every kept revision's files in full, so a higher number makes it bigger; lowering the number trims each type the next time it is deployed.

## From the command line

For a build server or a script, the same operations run without the editor window:

```text
UnrealEditor-Cmd.exe Oakford.uproject -run=CrowdyServerCompute -op=deploy -yes
```

It uses Crowdy Studio's saved sign-in and app, so sign in and pick the app in the editor once on that machine first. There is no token to pass on the command line.

| Operation | What it does |
|---|---|
| `-op=status` | The app's active version, whether the app is switched off, which types are switched off, whether its budget is paused and why, and its Server Objects and reserved memory against its limits (`instances`, `instanceLimit`, `reservedMb`, `maxReservedMb`). |
| `-op=whoami` | Whether the machine is ready: `signedIn`, `scope` (`session` for a Studio sign-in, `organizationToken` for an organization token), `userId`, `appId`, `orgId` and `environment`. No token is read into the output. Without a sign-in it fails with "Sign in to Crowdy Studio on this machine", and without an app with "Choose the app in Crowdy Studio and press Sync"; both can be in one message. |
| `-op=versions` | The versions, newest first. |
| `-op=changes` | Which types differ from the live version, like the badges on the Overview tab, and whether a deploy would change anything. Read only. |
| `-op=deploy -yes` | Assembles the project, builds what changed, in [parts](#a-deploy-in-parts) when it needs more than one build, waits, deploys it, and records what it sent in each type's `revisions.json`, like **Deploy**. `-batch=N` puts at most N crates in a build, 1 to 16 (16 unless given). `-rebuild` builds every crate instead of [reusing](#server-code-that-is-not-built-again) what the app already holds, as **Rebuild All and Deploy** does. See [The deploy's result](#the-deploys-result). |
| `-op=starters -yes` | Builds and deploys the starter pack, like **Deploy starter pack**. It takes `-batch=N` too. |
| `-op=addstarter -starter=session` | Adds a Game Kit starter, and the starters it needs, to the project, like **Add starter**: their crates under `Server/` and their definitions under `/Game/ServerObjects/GameKit/`. `-starter=` is one of the seventeen: `world`, `matchmaker`, `session`, `leaderboard`, `player`, `market`, `npcs`, `minigame`, `tactics`, `director`, `instance`, `territory`, `zone`, `deck`, `arena`, `race` or `ball`. `-config=` sets the named starter's **Config**, as JSON or `@` and a file, like `-inputs=`. The result's `added` lists them. See [Use the Game Kit starters](./use-game-kit-starters.md#add-a-starter). |
| `-op=removestarter -starter=world -yes` | Removes a Game Kit starter from the project with every starter that runs under it or calls it: their definitions, their `Server/` folders with any edits, and the **Game Kit World** setting when it named one. The result's `removed` lists them. See [Remove starters](./use-game-kit-starters.md#remove-starters). |
| `-op=generate [-type=village_beacon] [-yes]` | Generates server code, like **Generate** (see [Generate it](./write-server-logic.md#generate-it)). Without `-type` it generates every type that is out of date or has no server code. A type that needs you (a My Own File type with no Logic File, or a missing one) and a type with a problem are listed under `skipped` and do not fail the run. With `-type`, it generates that one type even when it is up to date; an unknown name fails and lists the types. A question a single Generate would ask refuses that type, and the question is the reason, unless you pass `-yes`. `-yes` answers only the safe questions: keep the old List value names on the server, move the old Type Name folder to the new one (not when the type's own Logic File is inside it), and add empty versions of the missing functions. It never accepts dropping values that saved instances hold, rewriting `lib.rs` lines it would remove, or a move when both folders exist. See [The generate result](#the-generate-result). |
| `-op=exporttype`, `-op=newtype`, `-op=edittype` | Read a type's settings as a file, create a type from one, and change a type from one. See [Define a type from a file](#define-a-type-from-a-file). |
| `-op=removetype -type=village_beacon [-yes]` | Removes an ordinary type the way **Remove from project...** does (see [Remove a type](#remove-a-type)). It refuses a Game Kit starter (use `-op=removestarter`), a definition outside `/Game/`, and a definition that other assets use, naming them. A redirector that is still in use is named too: "fix up redirectors in the Content Browser first". It deletes the definition asset and then, only if the asset is really gone, the type's Server Code folder when the SDK generated it, any unused redirectors to the asset, and the type's Game Kit World and Actor Starters settings. Without `-yes` it says what it would remove, changes nothing and exits 1. |
| `-op=renametype -type=village_beacon -to=/Game/Beacon/CSO_Beacon [-yes]` | Moves or renames the definition asset the way the Content Browser does, which leaves a redirector. The type's Server Code folder follows it, and its Game Kit settings move with it. The Type Name does not change: a changed Type Name is a new type, which `-op=edittype` refuses. It refuses a definition or a target outside `/Game/`, and a target that is taken. Without `-yes` it says what it would do and changes nothing. |
| `-op=activate -version=6 -yes` | Makes version 6 the active one, like **Make active**. |
| `-op=disable -type=village_beacon -yes` | Switches one type off. |
| `-op=enable -type=village_beacon -yes` | Switches it on. Without `-type`, `-op=enable -yes` switches the whole app back on, as the app's **Switch on** does. `-op=disable` still needs `-type`: switching the whole app off stays an action of the page. |
| `-op=restart -type=village_beacon -yes` | Moves its running Server Objects to the active version, like **Restart**; the result's `stopped` says how many. |
| `-op=restart [-yes]` | With no `-type`, restarts every type that has an instance running code older than the active version. Each instance is compared with the version that was active when it started, and an instance that started within a minute of the deploy counts as old too. It stops every running or starting instance of those types, the ones already on the active version included. Without `-yes` it lists each such type's instances that it would stop (Instance Id, phase and age), changes nothing and exits 1. After a rollback (`-op=activate` to an older version) it refuses and asks for `-type=`. |
| `-op=call -type=village_beacon -fn=Refill -key=village -yes` | Calls a Server Only or Developers Only function as the developer, like **Call as Developer**. `-inputs=` gives its inputs as JSON, or `-inputs=@inputs.json` from a file, since a shell mangles quotes (a relative path is read from the folder the command runs in; a path with a space goes in quotes with its `@`, as in `-inputs="@C:\My Game\inputs.json"`, or with the quotes after the `@`, as in `-inputs=@"C:\My Game\inputs.json"`, where the whole path is read; `-config=` and `-bundle=` take the same forms); missing inputs keep their defaults, and a name the function has no input for is refused rather than ignored. `-key=` is needed unless the type has Only One Instance. `-fn=` finds a function by name, the built-in ones such as `AddMember` included, and the Developers Only functions of a [Game Kit starter](./use-game-kit-starters.md#functions-only-a-developer-calls), such as the matchmaker's `Configure`. It also calls a starter's read-only player functions as the developer, today the npcs starter's `state`. A 64-bit integer above 9007199254740991 must be written as a string, for example `{"Player": "9007199254740993"}`; a larger number written without quotes is refused with "... is above 9007199254740991; write it as a string, for example "9007199254740993"." The result gives `status`, `message` and `reply`, the outputs as JSON. A Game Kit starter's function that takes a `Ref`, such as the player's **Grant**, gets a fresh one when `-inputs=` leaves it out, and the result gives it as `ref`. |
| `-op=grant -player=101910912345678 -bundle=@reward.json -yes` | Gives one player in-game soft currency and items through the [player starter](./use-game-kit-starters.md#functions-only-a-developer-calls)'s **Grant**, never real money. `-bundle=` is an `FCrowdyKitBundle` as JSON or `@` and a file, such as `{"Currency": {"gold": 100}, "Items": {"wood": 5}}`; `-xp=N` adds experience; `-ref=R` sends a `Ref` of your own, else a fresh one is made; `-type=` names the player starter when its Type Name is not `player`. The result gives `ref`, `status`, `message` and `reply`, what the grant earned the player. |
| `-op=deposit -player=101910912345678 -bundle=@restore.json -yes` | Puts soft currency and items into one player's hub through **Deposit**, counting nothing toward quests or achievements, such as to give back what a bug took. It takes `-bundle=`, `-ref=` and `-type=` as `grant` does. |
| `-op=instances` | Every Server Object the platform has placed: its type, Instance Id, phase (`idle`, `starting`, `running` or `stopping`), epoch, `heldBack` when the platform will not place it, with the reason, and `orphaned`, true for one whose type the active version no longer deploys (a deploy or a rollback dropped the type and stopped it; it keeps its saved state). |
| `-op=logs` | Recent log lines. Optional `-type=`, `-flow=` and `-limit=`. `-level=all`, `info`, `warnings` or `errors` filters by level, like the Logs tab's choices. `-before=<id>` pages back: pass the previous page's `nextBefore`. |
| `-op=stats` | Call counts per Server Function. Optional `-type=`. `-window=hour`, `day` or `week` picks the period, like the Activity tab's. |
| `-op=batch -ops=<file>` | Runs the operations in a file, one per line, in this one editor start. See [Several operations in one start](#several-operations-in-one-start). |

`-yes` stands in for the confirmation the page asks. `deploy`, `starters`, `activate`, `disable`, `enable`, `restart`, `call`, `grant` and `deposit` replace, switch, restart or run the app's live server code, so without `-yes` they refuse with "This changes the app's live server code or what it holds; pass -yes to confirm." and send nothing. The read-only operations (`status`, `versions`, `changes`, `instances`, `logs`, `stats`) do not need it. `addstarter` changes only the project and needs neither `-yes` nor a sign-in. `removestarter` changes only the project too, but deletes the starters' code with any edits, so without `-yes` it names what it would remove and refuses, for example "This deletes session, matchmaker, world: their definitions and server code, edits included; pass -yes to confirm." An unknown `-op` is refused with the list of operations. `generate` and `newtype` change only the project and need no `-yes`; `edittype`, `removetype` and `renametype` change it only with `-yes`.

**Close the Unreal Editor first.** An operation that writes the project (`generate`, `newtype`, `edittype` with `-yes`, `addstarter`, `removestarter`, `removetype` and `renametype` with `-yes`) refuses while an Unreal Editor is running: "An Unreal Editor is running. Close it first: it holds this project's Server Object types in memory and would save its own copy over what this op writes. Pass -editoropen to write anyway." `-editoropen` writes anyway.

**A read-only `Config/DefaultGame.ini`.** The Game Kit World and Game Kit Actor Starters settings live in that file. When `removetype`, `renametype`, `addstarter` or `removestarter`, or **Remove from project...** on the page, would change them and the file is read-only, as a file checked in to source control can be, it refuses before changing anything: "...DefaultGame.ini is read-only (checked in?), and this changes the Game Kit settings it holds; make it writable, then run again; nothing was changed". The engine would otherwise keep the change in memory only and lose it when the editor closes.

The command's exit code is its own result: 0 when the operation succeeded and 1 when it did not, whatever else the editor logs. It writes one line per step to the log under `LogCrowdyExec`. Add `-out=<file>` to also get the result as one JSON object: `op`, `ok`, `error` and `errorCode` (both empty when it succeeded), and the fields of that operation. A CI job can read it:

```text
UnrealEditor-Cmd.exe Oakford.uproject -run=CrowdyServerCompute -op=deploy -yes -out=Saved/deploy.json
```

A job that runs `-op=deploy` without `-yes` fails with exit code 1 and deploys nothing, so add it once you are sure the job should replace the app's server code.

`-op=deploy` refuses, as the page does, when a type's server code is not ready (it needs generating, is out of date, or has a problem), and says why. Regenerate and commit the server code before the job runs; a `Server/` folder that no longer matches its definition asset fails the job instead of deploying old code. Unlike the page, the command knows nothing about unsaved edits in an open editor; it sends what is on disk. It also does not check whether anything changed: it deploys what is on disk every time, as a new version, even when every crate is reused and nothing is built, so ask `-op=changes` first if the job should skip a deploy that would change nothing.

### Several operations in one start

Starting the editor takes most of the time of a short operation. `-op=batch` runs several in one start:

```text
UnrealEditor-Cmd.exe Oakford.uproject -run=CrowdyServerCompute -op=batch -ops=Saved/ops.txt
```

Each line of the file is the complete argument list one run of that operation would take. Blank lines and lines that start with `#` are skipped:

```text
# read first
-op=status -out=Saved/status.json
-op=changes -out=Saved/changes.json
-op=call -type=leaderboard -fn=Submit -key=weekly -inputs="@Saved/score.json" -yes -out=Saved/submit.json
```

The operations run in order. Each one connects on its own, has its own time limit, and writes its own `-out` file exactly as it would alone. The batch stops at the first operation that fails, and the operations after it write nothing; put `-batchcontinue` on a line to go on after that line fails. The exit code is 1 if any operation failed and 0 otherwise. The log has one line per operation, such as "Server Compute batch: 2/3 -op=changes ok". A line cannot be `-op=batch`, and a file with such a line, or with no operations, runs nothing.

### The deploy's result

`-op=deploy` logs what it builds and what it reuses, such as "building 3 pieces of server code in 1 build; 15 unchanged, named by their digest", then each build as it goes ("build 1 of 2: ... queued", "build ... succeeded against ckx-sdk 0.12.1 after 41 s"), "every build succeeded; deploying", and "deployed as version 9, now the app's active server code", which names the staging versions after it when there were any. With `-out=<file>` the JSON result adds:

| Field | What it holds |
|---|---|
| `version` | The version the deploy made. |
| `builds` | Every build sent, in order, each with `buildId`, `buildStatus`, `buildLog`, `sdkVersion` and its `artifacts`. Empty when nothing was built. |
| `buildId`, `buildStatus`, `buildLog`, `sdkVersion` | The last build's, as before builds were split. `sdkVersion` is the `ckx-sdk` version the platform compiled the server code against, whatever version the crates name. |
| `reused` | Each crate that was not built again: `crate` and the `digest` it was named by. |
| `artifacts` | Every crate's module in this deploy, built or reused: `crate`, `digest` and `sizeBytes`. |
| `stagedVersions` | The staging versions a [deploy in parts](#a-deploy-in-parts) made, oldest first. Empty for a deploy in one part. |
| `restoredVersion` | The version made active again after the last staging version, or 0 when none was. |

A failed deploy fills the same fields as far as it got, and its `error` says what is active now, for example "... Version 8 is active again, as before the deploy." A build that failed gives "The build ... failed, so nothing was deployed; its log is above and in buildLog".

### Changes and records

`-op=changes` compares the project with the live version the way the page does, without changing anything or needing `-yes`. It logs one line per type, for example `village_beacon: changed (server code, save interval), live revision 2`, and a last line saying `nothing changed`, `a deploy would change what runs` or `not ready to deploy; see problems`. With `-out=<file>` the JSON result adds:

| Field | What it holds |
|---|---|
| `liveVersion` | The live version's number, or 0 when nothing is live. |
| `types` | One row per type in the project, then one for each type on the server that the project no longer has: `type` (the Type Name), `change`, `what` and `liveRevision`. |
| `change` | `unchanged`, `changed`, `new`, `unknown` (the live version runs code this project has no record of), `removed` (on the server, not in the project) or `not_compared` (the type's server code is not ready). |
| `what` | For a changed type, what differs: any of `server code`, `save interval`, `idle timeout`, `platform data`, `player access`, `server limits`, `kind`, `scaling`, and for a Game Kit starter `config` and `parent`. Otherwise empty. |
| `liveRevision` | Where the revision the live version runs sits in the type's `revisions.json`, counting from 0 for the newest, or null when there is none. |
| `problems` | Why the project cannot be deployed yet, one sentence each, as the page shows them. Empty when it can. |
| `warnings` | What may go wrong after a deploy without stopping it, one sentence each, such as platform data the server code calls into without asking for it. `-op=deploy` writes them too, and both log each as a `warning:` line. |
| `ready` | True when `problems` is empty. |
| `hasChanges` | True when a deploy would change what runs (a type is `new`, `changed`, `unknown` or `removed`), and also when `ready` is false, since a type whose code is not ready differs from what a deploy would send once it is. |

A job that should deploy only when something changed can run `-op=changes`, stop when `hasChanges` is false, and otherwise run `-op=deploy -yes`.

`-op=deploy` writes each type's `revisions.json` after the deploy succeeds and logs "recorded the deployed revision of 2 types". A record that cannot be written does not fail the job: the deploy stands, the log warns "the deploy record was not saved for ...", and the JSON result lists each one under `recordErrors` (an empty list when all were saved). A job that builds the project's server code in CI should commit the changed `revisions.json` files afterwards, so the next `-op=changes` and everyone's Overview tab agree with what is live. `-op=starters` records nothing.

### The generate result

`-op=generate` logs one line per type. With `-out=<file>` the JSON result adds:

| Field | What it holds |
|---|---|
| `generated` | The types it generated. |
| `refused` | The types it did not generate because a question a single Generate would ask was not answered by `-yes`: `type` and `reason`, the question itself. |
| `skipped` | The types it left alone because they need you (a My Own File type with no Logic File, or a missing one) or have a problem. These do not fail the run. |
| `notes` | Other lines about what the run did or did not do. |
| `saved` | The definitions it saved. Generating can change a definition, for example by adding List Value Names entries. |
| `logicGaps` | Per type, what `logic.rs` still needs: `logicFile` (the file), `missing` (functions to write), `leftover` (functions the file defines that the type no longer has) and `stubsAdded` (empty versions it added). |

The exit code is 1 if anything was refused or the save failed. A job can generate, then read `logicGaps` to see which functions to write next.

### Define a type from a file

A Server Object type is a definition asset you normally fill in with the Details panel. From the command line you write the same settings as a JSON file, a **spec**, and create or change the type from it. `-op=exporttype` shows what a spec looks like.

A spec holds the settings the Details panel shows, under their C++ property names: `TypeName`, `Functions`, `bOnlyOneInstance`, `StateForm`, `StateList` and so on, exactly as `-op=exporttype` writes them. What the bake rebuilds on its own, such as the baked field tables, is not in a spec.

- **Keys are matched with their capitals.** `typename` is not `TypeName`.
- **An enum is its value name** as the editor writes it, such as `"List"` for a StateForm or `"Every"` for a timer. A struct or enum asset is its path, such as `/Script/MyGame.MyState`, and `null` is none.
- **`CanCall` and `ListenTo` are Type Names,** not asset paths.
- **A 64-bit integer is a string,** such as `"9007199254740993"`.
- **A List is an array of variables.** `StateList`, `ParamsList`, `ReplyList` and `PayloadList` each hold objects with `Name`, `Type`, `TypeObject` (for Enum, Struct and object kinds), `Containers` (at most 2), `KeyType` and `KeyTypeObject` (for a map), `Id`, `MetaData` and `Default`. `ClampMin` and `ClampMax` in `MetaData` are a variable's Value Range.

A spec is refused whole, and nothing changes, when it has any problem: an unknown or wrongly capitalised key, a value of the wrong kind or outside its range, a path that does not load, control characters in a name or text, a Logic File outside the project or not a `.rs` file, or a problem the bake finds. Every problem is listed in `errors` of the result, not only the first.

For example, a tip jar with a Total and the last tipper, both visible to players, an `AddTip` function and a timer, saved as `tip_jar.json`:

```json
{
  "TypeName": "tip_jar",
  "bOnlyOneInstance": true,
  "StateForm": "List",
  "StateList": [
    { "Name": "Total", "Type": "Int64" },
    { "Name": "LastTipper", "Type": "String" }
  ],
  "WatchedFields": ["Total", "LastTipper"],
  "Functions": [
    {
      "Name": "AddTip",
      "ParamsForm": "List",
      "ParamsList": [
        { "Name": "Amount", "Type": "Int32", "MetaData": { "ClampMin": "1", "ClampMax": "100" } }
      ],
      "ReplyForm": "List",
      "ReplyList": [
        { "Name": "Total", "Type": "Int64" }
      ]
    }
  ],
  "Timers": [
    { "Name": "Hourly", "Repeat": "Every", "Seconds": 3600 }
  ]
}
```

Create the type, then generate its server code:

```text
UnrealEditor-Cmd.exe Oakford.uproject -run=CrowdyServerCompute -op=newtype -spec=@tip_jar.json
UnrealEditor-Cmd.exe Oakford.uproject -run=CrowdyServerCompute -op=generate -type=tip_jar
```

The operations:

| Operation | What it does |
|---|---|
| `-op=exporttype [-type=T] [-spec=<file>]` | Reads the type's settings. The spec is under `definition` in the `-out` result; with `-spec=<file>` it also writes the bare spec to that file. Without `-type` it exports a new type's defaults, as a template to fill in. |
| `-op=newtype -spec=<json or @file> [-path=/Game/...]` | Creates a definition asset `CSO_<Type Name in PascalCase>`, so `tip_jar` becomes `CSO_TipJar`, in `-path` (`/Game/ServerObjects` unless given; it must start with `/Game/`). A setting the spec leaves out keeps its default. It refuses a Type Name that any type in the project already has, in any capitals, and a Code Source of Game Kit Starter: add a starter with `-op=addstarter`. When another type already holds the asset name (`tip__jar` and `tip_jar` both make `CSO_TipJar`), the refusal names that type and suggests `-path=` to put the new asset somewhere else. |
| `-op=edittype -type=T -spec=<json or @file> [-yes]` | Replaces the type's settings with the spec's. The spec must hold every top-level setting, so start from `-op=exporttype`; a partial spec cannot empty `Functions` by leaving it out. Settings inside a nested object may be left out. Without `-yes` it changes nothing: it reports `changed` (what would differ) and `renamedListValues`, and exits 1, except that a spec identical to the type succeeds with `changed` empty. With `-yes` it saves the definition, and if the save fails it puts the type back as it was. |

`edittype` refuses a changed Type Name, because to the server a new name is a new type (see [After you change the definition](./write-server-logic.md#after-you-change-the-definition)), and a switch to or from a Code Source of Game Kit Starter. `newtype`, and `edittype` with `-yes`, write the project, so they refuse while an editor runs, as described above. The next step after either is `-op=generate -type=T`.

## Be careful on a shared app

A deploy replaces the app's active server code for every player and every teammate on that app at once, and there is no separate step to try it first: the staging versions of [a deploy in parts](#a-deploy-in-parts) run what was already live and are not a preview. Use an app of your own for experiments, keep `Server/` in version control so a deploy can be repeated, and know how to make the previous version active before you deploy.

## Related

- [Write its server logic](./write-server-logic.md)
- [Create a Server Object type](./create-a-type.md)
- [Use the Game Kit starters](./use-game-kit-starters.md): Add starter, world as the root, and removing starters
- [Call its functions, from Blueprint](./from-blueprint/call-functions.md) and [from C++](./from-cpp/call-functions.md)
- [Troubleshooting](./troubleshooting.md): outcomes, refusals and `crowdy.exec.trace`
- [Unreal and ck-exec names](./unreal-and-ck-exec-names.md)
- [Crowdy Studio](../studio/overview.md)
- [Builds and starter packs](/exec/builds) and [Operations](/exec/operations) on the platform
