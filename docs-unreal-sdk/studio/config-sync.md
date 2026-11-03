---
slug: config-sync
sidebar_position: 4
title: Config Sync
description: What Config Sync writes into your project, which settings it owns versus the ones you edit, where they land on disk, and how to list apps, create one and sync from the command line, along with the command line's operations for access features, teams, channels and grids.
---

# Config Sync

Config Sync writes the selected app's ids and endpoints into your project's settings, so connecting a game to an app is one button instead of copying ids and URLs by hand. It lives on the Project page's **Configuration** tab.

:::caution[If you never run it, the SDK has no app id or Game API URLs to connect with, and nothing replicates.]
:::

## Run a sync

1. Open Crowdy Studio, [sign in](./sign-in.md), and pick **Project** in the sidebar.
2. Select the app the project should talk to.
3. Open the **Configuration** tab under the app's details. It shows every value the sync would write. A value that differs from what the project holds is drawn in gold with the current value on a "was" line beneath it, and a badge beside the tab strip reads **IN SYNC** or **N TO CHANGE**.
4. Read the diff, then press **Sync to project**.

![The Configuration tab with a pending change: gold values, the N TO CHANGE badge, and the Sync to project button](/img/unreal-sdk/studio-config-sync.png)

The rows are **App ID**, **Org ID**, **Game API HTTP URL**, **Game API WS URL**, and a read-only **Shared origin**, which comes from the backend selector on the Sign In page rather than from the app.

:::tip[A running Play in Editor session picks the change up without a restart.]
Sync pushes the new values into any running PIE or standalone session; a fresh Play always reads them. The **Connection** tab works differently: its UDP knobs and its Server Object timeouts are written the moment you change them, with no Sync button. The UDP knobs reach a running session at once; the Server Object timeouts apply from the next Play.
:::

## Sync from the command line

For a script or a coding agent, the same steps run without the editor window. [Sign in](./sign-in.md) to Crowdy Studio on the machine once; the commands use that sign-in, and no token goes on the command line:

```text
UnrealEditor-Cmd.exe Oakford.uproject -run=CrowdyStudio -op=apps
```

| Operation | What it does |
|---|---|
| `-op=apps` | Reads, and changes nothing. The account's organizations and their apps, each with its id, name, slug, datacenter, status and whether it is archived; the datacenters an app can be placed in; who is signed in; and the project's current Network settings. |
| `-op=createapp -org=<id> -name="My Game" -slug=my-game -datacenter=<code> [-description="..."] -yes` | Creates an app, as the Create app sheet on the Project page does, and prints the new app's id. The organization must be one of the account's, and the datacenter one of the codes `-op=apps` lists, written with the same capitals. The datacenter cannot be changed later. |
| `-op=sync -app=<id> -yes` | Writes the app's id, its organization and its game endpoints into `Config/DefaultGame.ini`, exactly what **Sync to project** writes. `Environment` and the shared origin stay as they are. An app the project is already synced to succeeds without `-yes` and changes nothing. A write that fails, for example because the file is read only, fails the operation. |
| `-op=registry [-class=<substring>] [-norebuild] [-out=<file>]` | Rebuilds the baked registry, then prints every entity class's CrowdyEvents (recipient, decay, distance) and CrowdyState properties (owner-only, manual dirty, heartbeat, OnRep) as JSON. `-class=` keeps only the classes whose path contains the text; `-norebuild` reads the saved registry as it is. It needs no sign-in. It needs `-yes` only when the project has no registry asset yet and the rebuild would create it. See [Inspector and Registry](./inspector-and-registry.md). |

`createapp` and `sync` only say what they would do, and exit with code 1, until you pass `-yes`. Add `-out=<file>` to get the result as JSON. The sign-in token is never printed.

`sync -yes` refuses while an Unreal Editor is running, since the editor holds its own copy of the settings and would write it over the synced app. Close the editor first, or pass `-editoropen` to write anyway.

A typical run on a new project:

```text
UnrealEditor-Cmd.exe Oakford.uproject -run=CrowdyStudio -op=apps -out=Saved/apps.json
UnrealEditor-Cmd.exe Oakford.uproject -run=CrowdyStudio -op=createapp -org=1234 -name="Oakford" -slug=oakford -datacenter=<code> -yes
UnrealEditor-Cmd.exe Oakford.uproject -run=CrowdyStudio -op=sync -app=<the new id> -yes
```

The [Server Compute](../exec/deploy-with-server-compute.md#from-the-command-line) operations then use the app you synced; its `-op=whoami` checks the sign-in and the app.

The command line never changes which app Crowdy Studio opens on in the editor.

### Access, teams, channels and grids

The same commandlet does what the Access, Teams, Channels and Grid pages do, so a script can set up an app without the editor window. Every operation below follows the same rules:

- It runs against `-app=<id>`, or against the app the project is synced to when you leave `-app` out. The result says which app it used.
- It needs `-yes` to change anything. Without it, it says what it would do, changes nothing and exits with code 1.
- When nothing would change, it succeeds and the result says `changed:false`.
- After a write it reads the result back from the server to check it, and fails if the server does not hold what was written.
- A list of values is written with commas and no spaces: `-keys=a,b`. Quotes are not needed (the engine drops them from a value with no spaces). A list with a space after a comma, `-keys=a, b`, is refused rather than cut short.

**Access.** See [The Access page](./overview.md#the-access-page). A feature key is 1 to 64 letters, digits, `_`, `-` and `.`.

| Operation | What it does |
|---|---|
| `-op=features` | Reads, and changes nothing. The app's feature keys. |
| `-op=definefeature -key=<key> [-description="..."] -yes` | Defines a feature key, like **Define feature**. |
| `-op=grantfeature -tier=<id> -key=<key> -yes` | Grants the feature to an access tier, like **Grant**. The key must be defined first. Needs `manage_apps`. |
| `-op=revokefeature -tier=<id> -key=<key> -yes` | Takes it away again, like **Revoke**. The same rules. |

**Teams and channels.** See [Teams and Channels](./teams-and-channels.md#from-the-command-line). These need a sign-in with your account, not an organization token. `-kind=` is `team` or `channel`, `-group=` the team's or channel's id, and `-user=` a user id.

| Operation | What it does |
|---|---|
| `-op=teams`, `-op=channels` | Read the app's teams or channels. |
| `-op=groupdetail -kind=team -group=<id>` | Reads one team or channel, with its members and their roles. |
| `-op=createteam -name="Oakford Guild" [-description="..."] [-policy=<policy>] -yes` | Creates a team. `-policy=` is `open`, `request`, `invite` or `admin`. |
| `-op=createchannel -name=oakford-chat [-description="..."] [-policy=<policy>] [-memberscansend=<true or false>] -yes` | Creates a channel. |
| `-op=updategroup -kind= -group= [-name=] [-description=] [-policy=] -yes` | Changes a team or channel. |
| `-op=deletegroup -kind= -group= -yes` | Deletes it, with its members and roles. This cannot be undone. |
| `-op=addmember`, `-op=removemember` with `-kind= -group= -user= -yes` | Adds a user to a team or channel, or removes them. |
| `-op=setroles -kind= -group= -user= -roles=1,2 -yes` | Sets a member's roles by role id. `-noroles` in place of `-roles=` clears them. |
| `-op=createrole -kind= -group= -name= [-perms=manage_members,invite_members] [-rank=] -yes` | Creates a custom role. A team role can grant `manage_group`, `manage_members`, `manage_roles` and `invite_members`; a channel role can also grant `send_messages`, which decides who may post. `-op=updaterole` and `-op=deleterole` change and delete one. |
| `-op=setteampolicy`, `-op=setchannelpolicy` | Write the app-wide policy, like **Set Policy**. They take `-creation=` (`admin`, `member` or `anyone`), `-membership=`, `-maxmembers=` and `-maxgroupsperuser=`, all optional, and `-yes`. 0 for a maximum means unlimited. |

Creating a team or channel whose name already exists succeeds with `changed:false` when the existing one matches what you asked for, and fails naming the differences when it does not.

**Grids.** See [Grids](./grids.md#from-the-command-line). Corners and regions are chunk coordinates written `x,y,z`, with no spaces.

| Operation | What it does |
|---|---|
| `-op=grids -low=x,y,z -high=x,y,z [-user=]` | Reads the grids a region touches, like **Scan for grids**. |
| `-op=creategrid -corner1=x,y,z -corner2=x,y,z -yes` | Creates a grid, like **Create grid**. A grid cannot be deleted from the command line. |
| `-op=grantgrid -grid= -user= -keys=a,b -yes` | Grants permission keys on a grid to a user. Give `-group=` and an optional `-role=` in place of `-user=` to grant them to a team or channel; the group must be one of the app's teams or channels. |
| `-op=revokegrid -grid= -user= -keys=a,b -yes` | Takes keys away again, with `-group=` in place of `-user=` for a group. `-all` in place of `-keys=` takes all of them. Checked by reading the keys back. |
| `-op=gridlimits -grid= -keys=a,b -yes` | Sets the grid's permission whitelist. `-nolimit` in place of `-keys=` removes the limit. |
| `-op=gridgrants -grid= -group=` | Reads a group's grants on a grid. |
| `-op=gridpermissions -grid= [-user=]` | Reads the permissions a user has on a grid. |

## What Config Sync writes, and what you own

All of it lands on one settings class, `UCrowdySDKDeveloperSettings`, which you can see under **Project Settings, Plugins, Crowdy SDK**. The network fields are shown there read-only.

![Project Settings, Plugins, Crowdy SDK after a sync: the network fields filled in and greyed out](/img/unreal-sdk/dev-settings-after-sync.png)

**Written by Crowdy Studio** (category Network; read-only in Project Settings):

| Property | Written from |
|---|---|
| `Environment` | The backend selector on the Sign In page. |
| `DiscoveryUrl` | The shared origin, used when the backend is Custom. |
| `AppID` | The selected app. |
| `OrgId` | The selected app's organization. |
| `GameApiHttpUrl` | The app's own routing. |
| `GameApiWsUrl` | The same endpoint with a WebSocket scheme. |
| `UDPProtocol` | The Connection tab. |
| `UDPTimeoutSeconds` | The Connection tab (6 to 120 seconds). |
| `HostPollIntervalSeconds` | The Connection tab (1 to 60 seconds). |
| `ServerObjectCallTimeoutSeconds` | The Connection tab, under Server Objects, as **Call Timeout** (11 to 120 seconds, default 20). |
| `ServerObjectOpenTimeoutSeconds` | The Connection tab, under Server Objects, as **Open Timeout** (1 to 60 seconds, default 10). |

Under a **Server Objects** heading, the Connection tab holds two timeouts for [Server Object](../exec/overview.md) connections:

- **Call Timeout** is how long a Server Object call waits for the platform's answer before it fails with a `Timeout`. It runs from 11 to 120 seconds, 20 by default, and stays above the longest **Time per Call** a type may have (10 seconds), so a call the server is allowed to finish is not given up on. A **Call** node's **Timeout** can shorten it for one call; see [Give up sooner](../exec/from-blueprint/call-functions.md#give-up-sooner).
- **Open Timeout** is how long opening the Server Object connection waits before the attempt fails, from 1 to 60 seconds, 10 by default.

Both apply from the next Play, and to the editor's developer connections. A dropped Server Object connection is always reopened, and has no setting.

**Owned by you** (editable in Project Settings):

| Property | What it does |
|---|---|
| `MapProfiles`, `DefaultProfile` | Per-map SDK configuration and the fallback when a map has no entry. See [Map profiles](../runtime/map-profile.md). |
| `BakedRegistry` | The cooked snapshot of Crowdy metadata. See [Inspector and Registry](./inspector-and-registry.md). |
| `PreloadedEntityClasses` | Entity classes to preload so a class nobody has spawned yet can still resolve off the wire. |
| `IDOverrides`, `ClassIDOverrides` | Populate only when the log reports a type id hash collision. |

:::warning[Never hand-type the network settings.]
They are read-only in Project Settings on purpose, so that Crowdy Studio is the one source of truth. A value pasted into `DefaultGame.ini` by hand is overwritten by the next sync, and a project whose settings drift from its app fails to connect with no obvious error.
:::

### The runtime setters

The same goes for the two runtime setters on `UCrowdySDKSubsystem`: `SetDiscoveryUrl` stores a shared origin for this session and is read only when `Environment` is Custom (it warns otherwise), and `SetGameApiUrl` stores one Game API HTTP endpoint for this session, an address that is normally resolved from the origin rather than typed. `ReloadEndpointsFromSettings` is deprecated and does nothing, so remove it from your graphs and code; it is kept only so existing call sites still compile: the API client re-reads both endpoints from the settings on every call, so a sync already reaches a running session.

`RequestVersionInfo` asks the server for its version before or after sign-in and answers on `OnVersionInfo` (`FOnVersionInfo`, two `FGameVersion` parameters: the server's version and, in `ClientVersion`, the minimum client version it still accepts). Both arrive as zeroes when the query fails.

## Where the settings land

The class is `Config=Game`, so the values are written to `Config/DefaultGame.ini` under:

```ini
[/Script/CrowdyReplication.CrowdySDKDeveloperSettings]
```

Commit that file as usual; it holds ids and URLs, not secrets.

## When to sync again

The **N TO CHANGE** badge tells you. It goes non-zero whenever the values the selected app would write differ from what the project holds: you selected a different app, changed the backend selector, or the app's endpoints moved. Press **Sync to project** again. Updating the plugin does not require a sync: the values live in `DefaultGame.ini` and the badge stays **IN SYNC**. Sync again only when the badge says so.

:::warning[Config Sync does not decide what a map does; the map profile does.]
Config Sync points the project at an app. A map with no [map profile](../runtime/map-profile.md) of its own runs on the SDK's shipped default; a `MapProfiles` row or `DefaultProfile` naming an asset that fails to load resolves to no profile, and on that map the entity subsystem, the auto replicator, and the actor manager do nothing, so replication looks dead even though the connection is fine. The warning in the log names the asset.
:::

## The Setup Wizard

If you prefer a guided path, the **Setup Wizard** page walks through the same steps in order: sign in, pick an organization and app, run the sync. Studio lands on it after you sign in. Once you know the flow, the Project page does each step directly.

## Gotchas

- The Configuration tab writes on **Sync to project**. The Connection tab writes on every edit.
- The shared origin is not per app. Change it on the Sign In page's backend selector, then sync.
- A PIE session that was already running picks up a sync; a packaged build needs the new `DefaultGame.ini` cooked in.
- An organization token is enough to run Config Sync. It is not enough to author teams, channels, or grids, from the pages or from the command line.
- A Studio sign-in with an organization token is cleared only when the server rejects the token. A network error no longer signs you out.

## Related

- [Projects and Apps](./projects-and-apps.md): picking and creating the app.
- [Map profiles](../runtime/map-profile.md): the second half of "make replication work".
- [Project settings reference](../reference/project-settings.md): every property on the settings class.
