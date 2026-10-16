---
slug: access-members-and-timers
sidebar_position: 3
title: Access, members and timers
description: The settings that make the server enforce who may read a Server Object and who may call each Server Function (Readable By, who receives each variable of a record, the Platform Data settings such as Reads World Data and Changes the World, a type players cannot reach, Callable By, Cooldown, Value Range), give it members (Members From This Object or a Crowdy Team, Max Members, the Join, Leave, Add Member, Remove Member, Make Leader and Set Open for Joining functions, Open for Joining, the leader rules), run timers and player events, and let one type call another (Call other Server Objects, a Server Function Library, or any type with Can Call Any Type) or hear another's messages (Listen To), with what a refused player sees and the names logic.rs gets.
---

# Access, members and timers

:::note
Server Objects run on [ck-exec](/exec/intro).
:::

Some rules are the same in every game: only the players of a team may spend the team's gold, a match starts once and only its leader starts it, a purchase can be made once a minute. You can write each of them in `logic.rs`, or you can set them in the [definition asset](./create-a-type.md) and let the server code the editor generates enforce them before your code runs. Then `logic.rs` holds only the rules that are truly yours.

The settings fall into five groups in the asset's Details tab, each in its own category:

- **Access**: who can read a Server Object, who can call each Server Function, how often, and with what values.
- **Members**: who belongs to a Server Object.
- **Timers & Events**: things the server does on a clock, and when a player arrives or leaves.
- **Can Call** and **Listen To**: the other Server Object types this one's server code may call, or any type with **Can Call Any Type**, and the ones whose messages it listens to; see [Call other Server Objects](#call-other-server-objects) and [Listen to other Server Objects](#listen-to-other-server-objects).

A [Server Function Library](./server-function-libraries.md) has only **Can Call**, **Platform Data** and the function rules **Callable By** (without Members and Leader), **Required Feature** and **Value Range**; the rest of this page is about Server Objects.

After you change any of these, [generate the server code](./write-server-logic.md#after-you-change-the-definition) and deploy it again, since the server enforces them.

Two examples in Oakford's world use every group; see [Guild halls and arena lobbies](./examples/guild-halls-and-arenas.md).

## Access

### Readable By

**Readable By** is on the type: select **Type Settings** in the Server Object panel. It says who can read the variables that are [Visible to Players](./create-a-type.md#the-details-tab) and is told when they change.

| Choice | Who reads the variables |
|---|---|
| **Every Player** | Any player. |
| **Owner Only** | The one player who owns it. Its Instance Id is that player's user id. See [Owner Only types](./from-cpp/get-a-server-object.md#owner-only-types). |
| **Members** | The members of the Server Object. Anyone can still see who the members are and whether joining is open, so a player who is not a member can find it and join. **Members** needs **Members From**. |

With **Members** or **Owner Only** the server does not send a change's values to everyone. It tells the watchers that something changed, and each reads the values again. That is fine for a team of five; for a big group, use **Every Player**. See [Large groups](#large-groups).

### Callable By

**Callable By** is on each function, in its Details.

| Choice | Who may call it |
|---|---|
| **Players** | Any player. |
| **Members** | A player who is a member of this Server Object. |
| **Leader** | The leader of this Server Object. |
| **Server Only** | No player. Only other server code and developer tools. |
| **Developers Only** | Only developer tools, such as [Call as Developer](./deploy-with-server-compute.md#call-a-function-as-the-developer); no player and no other server code. |

Other server code and developer tools may call every function whatever it says, except a Developers Only one, which only developer tools reach. **Members** and **Leader** need **Members From**. The check is made on the server, so a modified game client cannot get around it.

### Required Feature

**Required Feature**, beside **Callable By**, names a feature key the caller's access tier must grant, such as `vip`. Define features and grant them to tiers on the [Access page](../studio/overview.md#the-access-page) in Crowdy Studio. A player whose tier does not grant it is refused before your code runs, with the outcome `Denied`, not retryable, and the reason "needs the vip feature". A refused call does not start the **Cooldown**. Leave it empty for no check.

It checks players only, like **Callable By**: other server code and developer tools are let through. A key is 1 to 64 letters, digits, underscores, hyphens and dots, matched exactly, capitals included. A **Server Only** or **Developers Only** function has no player to check, so a Required Feature there does nothing: the function shows a warning under it ("Cooldown and Required Feature have no effect here: they limit only players' calls, and only developer tools or server code may call this function.") and Deploy lists it ("village_beacon Refill: Required Feature has no effect, since only players are checked."). A type with a Required Feature on a function that players may call asks the platform for the `players.read` scope when it is deployed; nothing else is needed.

### Cooldown

**Cooldown**, in seconds, sits beside **Callable By**. It is how long one player waits between two calls of that function that succeeded; 0 means no wait. A call inside the wait is refused, and the refusal is retryable: "Feed can be called again in 4 s". A call that failed does not start the wait. Each player has their own wait, and the server remembers the last calls of up to 10,000 players per function. Only players wait: on a **Server Only** or **Developers Only** function a Cooldown does nothing, and the function shows the same warning as for a Required Feature, which Deploy lists as "village_beacon Refill: Cooldown has no effect, since only players' calls are limited."

### Value Range

**Value Range** limits a number a caller sends. Select an **Input** of a number type in the function's Details and fill in the two boxes under **Value Range**, **Min** and **Max**, both optional. A call with a number outside them is refused before your code runs: `bad_params: Amount must be 1 to 100`.

![guild_hall's Deposit: Callable By Members, Cooldown 2 s, and the Amount input's Value Range of 1 to 100](/img/unreal-sdk/server-object-function-rules.png)

For an input taken from a struct, set the range on the struct's field with `meta = (ClampMin = 1, ClampMax = 100)`; the two ways read the same. The range is read when the server code is generated, so generate and deploy again after changing it. Only number inputs can have one.

### Only One Instance

**Only One Instance** is on the type, in **Access**, beside **Readable By**. Tick it for one shared instance for every player, like a registry or a world event: a list of the world's open arenas, the day's festival. Nothing picks an instance, so no Instance Id is needed anywhere.

- In Blueprint, the [typed nodes](./from-blueprint/get-a-server-object.md#where-the-object-comes-from) for the asset need neither a **Target** nor a **Find By Asset** choice. Place the node and use it. A **Crowdy Server Object** component with the asset joins the one object whatever its **Instance Mode** says.
- From C++, acquire it with any Instance Id, or an empty one; the subsystem uses the one object.
- The generated server code refuses a call for any other instance with `denied`, so a stray tool cannot make a second one.
- It cannot be combined with **Readable By** set to **Owner Only**, whose Instance Id is each player's user id, or with **Members From** set to **Crowdy Team**, whose Instance Id is the team id. The asset says so when you save it.

Ticking or clearing it changes which object players reach, so generate and deploy the type again. Data saved under the old Instance Id is not moved to the new one. A [Server Function Library](./server-function-libraries.md) is reached the same way, with no Instance Id, and never needs this setting.

### Who receives a variable of a record

In a type whose **Holds** is **A Record per Entity**, each variable has its own audience instead of the single **Visible to Players** switch. Select the variable and set **Visible to Players** in its Details:

| Choice | Who receives it |
|---|---|
| **Server Only** | Nobody. It never leaves the server. |
| **Everyone** | Every player who watches the object. |
| **Owner Only** | The player who owns the record's entity. |
| **Team Only** | Players whose own record in the same object has the same team, or who are on the record's Crowdy Team, as **Team From** says. |

The record's owner and team are set by server code, not by a variable. A player who owns no record, or no matching team, receives the Everyone variables only; the others read as their defaults and never raise a change. Everyone values arrive in the server's batches. Owner Only and Team Only values are fetched when the server says they changed, at most once a second for each object, so they arrive a moment later. See [Who receives a value](./keep-a-record-per-entity.md#who-receives-a-value).

**Readable By** must be **Every Player** for such a type, and **Members From** must be **None**: who sees what is decided per variable.

### Platform data

The **Platform Data** category says what the type's server code may read and change outside its own Server Objects: players, the world and grids. Deploy asks the platform for a permission (a scope) for each setting you tick, and the platform refuses the server code's calls into anything else with `Denied`. All are off by default; tick only what the code uses.

| Setting | C++ | Scope | Lets the server code |
|---|---|---|---|
| **Reads Players** | `bReadsPlayers` | `players.read` | Read a player's name, the features their access tier grants, their group membership and permissions, and their app state. |
| **Changes Players' App State** | `bWritesPlayerState` | `players.write` | Replace a player's app state. |
| **Reads World Data** | `bReadsWorld` | `world.read` | Read a chunk, the voxels written into it, and which actors are in or near it. |
| **Changes the World** | `bWritesWorld` | `world.write` | Write voxels and a chunk's state. |
| **Reads Grids** | `bReadsGrids` | `grids.read` | Find the grid over a chunk, read a grid and its owner, and check a player's permission on it. |
| **Manages Grids** | `bManagesGrids` | `grids.write` | Create and delete grids, give a group keys on one, and open one to every player. |
| **Grants Grid Permissions** | `bGrantsGridPermissions` | `permissions.write` | Grant and revoke a player's permissions on the app's grids. |
| **Reads Players' Access** | `bReadsAccess` | `access.read` | Read a player's access to the app: status, tier, expiry and suspension. |
| **Manages Players' Access** | `bManagesAccess` | `access.write` | Grant, revoke and suspend a player's access to the app. |

**Manages Grids** and **Manages Players' Access** give the server code what an app admin can do in Crowdy Studio over grids and players' access, for your app only; tick them only on the types that need them.

Crowdy Team members, records whose **Team From** is **Crowdy Team** and a **Required Feature** on a function players may call ask for `players.read` on their own, so **Reads Players** changes nothing for such a type. The box then shows ticked and greyed, and its tooltip names why, for example "Needed because Members From is Crowdy Team; Required Feature is set on Feed, so deploy asks for players.read whatever this says." (a Required Feature on a Developers Only or Server Only function does not count). The calls themselves are on the platform's [World and platform data](/exec/world-and-platform-data) page.

Before it sends anything, Deploy looks through the type's server code for calls into these, and lists each one whose setting is off, such as "village_beacon: its server code calls world().set_voxels(), which needs world.write; turn on Changes the World or the platform refuses that call". It is a hint, not a check: it sees a call written as `ctx.world().set_voxels(...)`, but not one made through a variable that holds `ctx.world()` or through `ctx.node`. It ignores code inside Rust raw strings and inside `#[cfg(test)]` items (tests), so a call there raises no hint. A changed setting takes a deploy, like changed code.

### A type players cannot reach

A type whose functions are all **Server Only**, with no variable **Visible to Players**, **Holds** set to **One Set of Variables**, **Members From** set to **None**, no message with **Players Can Listen** ticked, and neither **On Player Joined** nor **On Player Left**, gives players nothing to do. (A type that holds a record per entity always reaches players: each record carries its entity, owner and team.) Deploy tells the platform to keep players out of it altogether, so only other server code and developer tools reach its Server Objects, and Server Compute describes it as "closed to players". Acquiring one in a game is refused at once, with "`<Type Name>` is closed to players: only server code and developer tools reach it". Give the type any of those and the next deploy opens it to players again.

## Members

**Members From** is on the type. It decides who belongs to the Server Object.

| Choice | Members are |
|---|---|
| **None** | Nobody. There are no members, and saving refuses **Members** in **Readable By** and **Members** or **Leader** in **Callable By**. |
| **This Object** | Players the Server Object keeps itself. Players **Join** and **Leave**. |
| **Crowdy Team** | The members of a [Crowdy Team](../services/teams.md) whose id is the Server Object's Instance Id. |

### This Object

The Server Object keeps its members, their order of joining, its leader and whether joining is open, and saves them with its variables. Set:

- **Max Members**: the most members it takes. It is 100 unless you change it. 0 means no limit, and needs **Show Members to Players** off.
- **Show Members to Players**: on by default. Players can read who the members are. Turn it off for a large group: players then get only the number of members, and **Max Members** may be 0 or any size. With it on, **Max Members** must be 1 to 4,096.
- **Remove Members Who Leave**: on by default. A member who leaves the game, once their last connection to the Server Object closes, stops being a member. Turn it off to keep a member listed while they are away. When a Server Object restarts (switched off and on, or moved), the platform does not tell it about players whose connection closed while it was stopped, so see [Players who left while it was stopped](#players-who-left-while-it-was-stopped) below.

The panel's **Built-in** section then lists six functions, greyed out, each with its inputs as a function row shows them, such as **Add Member (Player)**: you cannot edit or delete them, and you cannot make a function of your own with the same name. They work like any Server Function: call them from Blueprint with **Make Inputs** and **Call Server Function**, or from C++ with `Call`.

![arena_match: the greyed Built-in functions, Readable By Members, Members From This Object, Max Members 8 and one Timer](/img/unreal-sdk/server-object-members.png)

| Function | Inputs | Who may call it | What it does |
|---|---|---|---|
| **Join** | none | Any player | Adds the caller. Refused with "It is full" at **Max Members** and "It is not open for joining" while joining is closed. A player who is already a member succeeds. |
| **Leave** | none | Any player | Removes the caller. A player who is not a member succeeds. |
| **Add Member** | `Player` (Integer64) | Server code only | Adds that player, with the same limits as Join. |
| **Remove Member** | `Player` | The leader, or server code | Removes that player. |
| **Make Leader** | `Player` | The leader, or server code | Makes that member the leader. Refused for a player who is not a member. |
| **Set Open for Joining** | `bOpen` (Boolean) | The leader, or server code | Opens or closes joining. |

The inputs of **Add Member**, **Remove Member** and **Make Leader** are the struct `FCrowdyServerMemberInputs`, whose one field is `Player`. The input of **Set Open for Joining** is `FCrowdyServerOpenInputs`, whose one field is `bOpen`.

**Add Member** exists so that one type can seat players in another, as a registry does; see [Guild Halls](./examples/guild-halls-and-arenas.md#guild-halls). You can also call it by hand as the developer, with the play button on its row in the Built-in list; see [Call a function as the developer](./deploy-with-server-compute.md#call-a-function-as-the-developer).

The inputs of **Add Member**, **Remove Member** and **Make Leader** are the struct `FCrowdyServerMemberInputs`, whose one field is `Player`. The input of **Set Open for Joining** is `FCrowdyServerOpenInputs`, whose one field is `bOpen`.

### The leader

- The first member to join is the leader.
- When the leader leaves or is removed, the member who has been a member longest becomes the leader.
- An object with no members has no leader.
- **Make Leader** hands the lead to another member.

### Open for joining

A Server Object with members kept by itself also has **Open For Joining**, which starts true. While it is false, **Join** and **Add Member** are refused. The leader closes it with **Set Open for Joining**, and your code closes it with `members::set_open(false)`, for example when a match starts. It opens again by itself when the last member leaves, so nobody can close an empty object for good. Everyone can read it, and a registry reads it to skip a match that has already started.

### What a player who is not a member sees

With **Readable By** on **Members**, a player who is not a member can still acquire the Server Object. They read the member count, the leader, **Open For Joining** and, with **Show Members to Players** on, the list of members, so they can decide to join. The variables stay at their defaults, **Is Member** is false, and any function whose **Callable By** is **Members** or **Leader** is refused. With **Show Members to Players** off they see the count, not the list. After a successful **Join** the game reads again and they see everything.

### Crowdy Team

With **Crowdy Team**, the platform's teams own joining, roles and the size of the team. The Server Object keeps no members. Players join and leave through the **Teams** nodes ([Create Team, Join Team, Request to Join Team, Leave Team](../services/teams.md)); the Server Object asks the platform who belongs.

- The Instance Id is the team's id, written in digits. Anything else is refused, as is **Crowdy Team** with **Readable By** on **Owner Only**.
- **Members** means the team's members.
- **Leader** means a member who can manage the team, which the team's leader role can.
- The six built-in functions do not exist, and there are no `Members`, `MemberCount`, `Leader` or `OpenForJoining` variables. **Is Member** and **Is Leader** work as they do for This Object.
- If the platform cannot answer who a player is, the call is refused: "membership could not be checked", with the reason after it.

Give an actor the Server Object of the player's team with the component's **Player's Team** mode; see [Add the component](./from-blueprint/get-a-server-object.md#add-the-component).

## Timers and events

Under **Timers & Events**, a **Timer** is something your Server Object does on a clock, each with:

- **Name**: what it is called. Not empty, unique, and not the name of a function.
- **Runs**: **Every**, which runs again and again, **Time** apart; **Once After**, which runs once, **Time** after it starts; or **On Schedule**, which runs at the times a **Cron** expression names. In C++ this is the enum `ECrowdyServerTimerRepeat`, with the values `Every`, `After` and `Schedule`.
- **Time**: in seconds, at least 0.01. Not shown for **On Schedule**.
- **Cron** and **UTC Offset**: for **On Schedule** only. **Cron** has five fields (minute, hour, day of month, month, day of week), or six with seconds first, or is one of `@hourly`, `@daily`, `@weekly`, `@monthly` and `@yearly`; `0 */6 * * *` is every six hours, on the hour. Times are UTC; **UTC Offset** reads them that many minutes ahead of UTC, from -840 to 840, with no daylight saving: 60 runs `0 9 * * *` at 09:00 in UTC+1. Saving checks each field against its range (an hour of 25 is refused, naming the field), with the syntax in [Timers and presence](/exec/timers-and-presence#cron-schedules).
- **Start Automatically**: on by default. It starts when the Server Object first starts. With it off, your code starts it.

Each timer's row is titled with its name and when it runs, such as "Respawn: Once After 10 s".

A schedule runs on the platform's own clock. Each time it fires, the generated code arms its next run before your function is called, so an error in your function does not end the schedule. A run that came due while the Server Object was stopped runs once when it starts again; the other missed runs are skipped.

Changing a timer's **Runs** reaches instances that are already running too, once they start on the new code: a deploy does not restart them, so that is when they next start, or at once if you press **Restart** on the type in Server Compute (see [Restarting a type](./deploy-with-server-compute.md#restarting-a-type)). Each Server Object saves its timers' Runs with its values, and when it starts after a deploy that changed one, a timer that was still pending is armed again under the new Runs. The Server Object arms the changed timer without stopping it first, so if arming fails the timer keeps its old schedule, and the server log says "timer EndMatch keeps any old schedule: the changed one could not be armed: " followed by the error. A timer you did not change keeps its clock. A timer that had stopped, or a Once After that already ran, stays so. A timer with **Start Automatically** that you add later starts in running instances as well, and a timer you remove or rename stops under its old name. A changed timer starts its new Runs from that moment, so a pending Once After waits its full new time. Server code generated by an earlier SDK did not save the Runs, so the first deploy of code generated by this one re-arms nothing; every deploy after it does.

Each timer is a function in `logic.rs`, named after it in snake case, so a timer named `EndMatch` is `end_match`. It changes the variables the same way a Server Function does, and its changes reach the watchers.

```rust
fn end_match(&mut self, _ctx: &Ctx) -> Result<()> {
    self.Phase = "Ended".into();
    Ok(())
}
```

Each timer's name is also a constant in the `timers` module, its function's name in capitals: `EndMatch` is `timers::END_MATCH`, which holds `"EndMatch"`. Start and stop one from your code with `timers::start(ctx, timers::END_MATCH)` and `timers::stop(ctx, timers::END_MATCH)`. Use the constant rather than typing the name: the name is matched exactly, capitals included, so `"end_match"` or a misspelling is only refused when the code runs, while a misspelt constant does not compile. A timer whose constant would be `QUEUED` is refused when you generate, since the timers code uses that name itself. Start uses the period set in the asset. Inside a Server Function they take effect only when that function succeeds. If the platform refuses a timer the function starts, the whole call is refused: nothing it changed is kept or published, any timer it already started in that call is cancelled, and the player sees `ServerError` with a reason such as `the change was not kept: timer EndMatch could not start: <reason>`.

The two **Events** are tick-boxes, **On Player Joined** and **On Player Left**. Each adds a function to `logic.rs`, `on_player_joined` and `on_player_left`, which get the player's user id. They count a player's connections to the Server Object, not its members. A player who opens the Server Object twice counts once: the first open runs `on_player_joined` and the last close runs `on_player_left`. When **Remove Members Who Leave** is on, the member is removed first and then `on_player_left` runs; it runs even when the player was never a member.

### Players who left while it was stopped

When a Server Object restarts, whether it was switched off and on or moved, the platform does not tell it about players whose connection closed while it was stopped. The generated code keeps the connection counts it restored as unconfirmed. Right after the restart it tells the players watching to read again, and any call from a player confirms them. A player who is not heard from within two minutes is treated as having left: **Remove Members Who Leave** removes them, and `on_player_left` runs. A player who reconnects within that time just continues, and `on_player_joined` does not run again.

## Call other Server Objects

**Can Call**, in the **Can Call** category, is a list of other Server Object definitions. Each is a type this one's server code may call, from `logic.rs`. Add the definition assets of the types, never the type's own. The types deploy together, so the callee is there when the caller runs.

Each function of a listed type becomes a typed function in `logic.rs`, under `calls::<type>::<function>`. It takes the `Ctx`, the callee's Instance Id and its inputs, and returns its outputs:

```rust
let hall = format!("hall-{}", self.Halls);
calls::guild_hall::add_member(ctx, &hall, &calls::guild_hall::MemberInputs { Player: player })?;
```

A call from server code is not stopped by **Callable By**, so this is also how a **Server Only** function gets called. When the call fails, its error comes back to your code with the type and function in front, "guild_hall.add_member failed: It is full". Return it with `?` and the caller's player sees it as the reason their call failed. What the callee already changed stays changed even if your function then fails.

The first call to an instance that is just starting, such as a new match, can take longer than a call is allowed, and fails with "call deadline passed" although the callee may still finish it. A function that is safe to repeat, like **Add Member**, can simply be called again once:

```rust
let inputs = calls::guild_hall::MemberInputs { Player: player };
calls::guild_hall::add_member(ctx, &hall, &inputs).or_else(|_| calls::guild_hall::add_member(ctx, &hall, &inputs))?;
```

### Call a library

A [Server Function Library](./server-function-libraries.md) can be listed under **Can Call** like any other type. It has no Instance Id, so its typed helpers take no key:

```rust
let loot = calls::loot_roller::roll_loot(ctx, &calls::loot_roller::LootRollInputs { Seed: 7, Tier: 1 })?;
```

Everything else is as above, and a call to a library that has been idle can take over a second; see [A call to a library from server code fails](./troubleshooting.md#a-call-to-a-library-from-server-code-fails). A library can list types under **Can Call** too, and calls them with their keys; see [A library that changes a Server Object](./write-server-logic.md#a-library-that-changes-a-server-object).

### Call any type

**Can Call Any Type**, a check-box in the **Can Call** category of any type, lets the type's server code call and listen to every type in the app, including types added later. Deploy then writes `"calls": ["*"]` for the type in place of the names. It keeps the list: **Can Call** and **Listen To** still decide which types get typed helpers in `logic.rs`, so the types you name keep their `calls::<type>::<function>` functions, and **Listen To** keeps its handlers.

For a type that is not in the list, there is one more function, `calls::any`. It is made only when **Can Call Any Type** is on. It calls a type by its Type Name, with a payload you encode yourself, and returns the reply bytes undecoded:

```rust
#[derive(Serialize)]
struct Roll {
    Seed: i64,
    Tier: i32,
}

#[derive(Deserialize, Default)]
#[serde(default)]
struct Rolled {
    Item: String,
}

let payload = encode(&Roll { Seed: 7, Tier: 1 })?;
let reply = calls::any(ctx, "loot_roller", "", "roll_loot", &payload).map_err(|error| Error::new(&format!("loot_roller.roll_loot failed: {error}")))?;
let loot: Rolled = decode(&reply)?;
```

The arguments are the type's Type Name, the Instance Id (empty for a [Server Function Library](./server-function-libraries.md)), the function's **Server Name** and the encoded inputs. A function with no inputs takes `&[0x80]`. You write the structs for the inputs and the reply yourself, with the field names the type has on the server, since only the listed types get them generated.

Use it when the type to call is not known when you write the code, for example a plug-in type another team deploys. Otherwise list the types: a typed helper checks the name and the inputs when the crate builds, while `calls::any` finds a wrong name only when it runs, as a call that fails with "app N has no node type". Deploy does not check that the type exists.

## Listen to other Server Objects

**Listen To**, in the **Listen To** category, is a list of other Server Object definitions, the way **Can Call** is. Each is a type whose [messages](./create-a-type.md#server-messages) this one's server code hears. Add the definition assets of the types, never the type's own. Checks and naming are those of Can Call.

- **Each listened type is also callable.** **Listen To** adds its types to the ones the server code may call, so the `calls::<type>::<function>` functions above exist for them too; there is no need to list a type in both.
- **Every message of the listened type is heard**, including those with **Players Can Listen** off: that setting is what tells a type's messages apart from the ones players hear, and a Server Object type is not a player.
- **Hearing is chosen in server code.** The setting only makes the messages available. The code starts listening to one Server Object of the listened type, by its Instance Id, with a `listen::<type>::<message>` function, and handles what it hears in a function the generator adds, `on_<type>_<message>`; see [Listen to a message](./write-server-logic.md#listen-to-a-message).

A Server Object can have up to 256 listens at once, and each one takes effect only when the function that made it succeeds. Messages are not replayed: one sent while the listener is not running is missed.

## What a refused player sees

A refused call reaches the caller's `OnDone`, or **On Failed** in Blueprint, with its **Outcome** and **Reason**. See [Troubleshooting](./troubleshooting.md#outcomes).

| Why | Outcome | Reason |
|---|---|---|
| **Server Only** function | Denied | players may not call this function |
| **Developers Only** function | Denied | only developer tools may call this function |
| **Members** function, caller not a member | Denied | only members may call Deposit |
| **Leader** function, caller not the leader | Denied | only the leader may call StartMatch |
| Owner Only, not the owner | Denied | only the owner may use this Server Object |
| Team membership could not be checked | Denied | membership could not be checked, and the reason |
| **Cooldown** not over | Denied, **Retryable** | Feed can be called again in 4 s |
| The game's server, or this type, is switched off or paused | Paused, **Retryable** | The server is switched off or paused, so it refused the call to Feed: `village_beacon` is switched off in app 123 |
| **Value Range** | ServerError | `bad_params: Amount must be 1 to 100` |
| Join refused | ServerError | It is full, or It is not open for joining |

Denied is not retryable except for a cooldown: calling again will be refused the same way until something changes. A cooldown is retryable, and the number of seconds is rounded up.

## Large groups

A guild of hundreds or a match of thousands works, with care:

- Set **Readable By** to **Every Player** and **Show Members to Players** off, with **Max Members** as high as you need or 0. Players are then sent the member count, the leader and whether joining is open along with each change, and nobody re-reads. With **Members** or **Owner Only**, every change to a large group makes every member read again.
- With the list hidden, **Is Member** and **Is Leader** follow the player's own **Join** and **Leave** and the next read, not a list.
- Keep busy per-player actions, such as every player's score or purse, off the one shared object. Every call on one Server Object goes through that one object, and every player watching it is told of each change. For a handful of players, give each an [Owner Only](./from-cpp/get-a-server-object.md#owner-only-types) object for them, and let the shared one hold what the group shares. For many players, prefer one shared object that holds a record per player (or per area, match or team) over one object per player; see [Keep a record per entity](./keep-a-record-per-entity.md).
- Know the platform's limit on running Server Objects per app. An app with no funds can run 16 at once, within 1 GB of memory; a funded app can run 16,384, within 64 GB. Past the limit nothing new starts, and calls to an object that is not running come back **Unavailable**. One object per player runs into it quickly.

## Checks when you save

Saving refuses the asset, and lists every problem at once, when:

- **Members** or **Leader** is used in **Callable By**, or **Readable By** is **Members**, and **Members From** is **None**.
- A function of your own has the name of a built-in one while **Members From** is **This Object**.
- **Max Members** is below 0, or is 0 or above 4,096 while **Show Members to Players** is on.
- A **Value Range** has a minimum above its maximum, or is on an input that is not a number.
- A timer's name is empty, is used twice, is not a usable name once written in snake case, or is a function's name, or is `crowdy_flush` (the name a record type uses to send its changes) or `crowdy_sessions` (the name the generated code uses to keep track of connected players) in snake case, or its **Time** is under 0.01 seconds.
- **Can Call** or **Listen To** has an empty entry, the type itself, or a type without a Type Name.
- **Listen To** names a Server Function Library ("loot_roller is a Server Function Library and sends no messages."). Put it under **Can Call** instead.
- **Members From** is **Crowdy Team** and **Readable By** is **Owner Only**.
- **Only One Instance** is ticked with **Readable By** on **Owner Only**, or with **Members From** on **Crowdy Team**.
- **Holds** is **A Record per Entity** and **Readable By** is not **Every Player** ("needs Readable By Every Player; make the variables others must not see Owner Only or Team Only"), or **Members From** is not **None** ("cannot use Members From; each record carries its own owner and team"), or a function is named `changes`.
- A variable is Owner Only or Team Only but is not a field of the State or not Visible to Players, or is both ("'Gold' is both Owner Only and Team Only; choose one").
- **Max Records**, **Send Changes Every**, **Area Size** or **Areas Followed Around a Player** is outside its range ("Max Records is 5000; it must be from 1 to 4096").

## For logic.rs

The generated server code gives `logic.rs` these, when the definition uses the setting.

| Name | What it does |
|---|---|
| `members::list()` | The members' user ids, in the order they joined. This Object only. |
| `members::leader()` | The leader's user id, if any. |
| `members::is_member(player)` | Whether a player is a member. |
| `members::is_open()` | Whether joining is open. |
| `members::set_open(open)` | Opens or closes joining. |
| `members::add(player)` | Adds a member, and errors when full or closed. The first member leads. |
| `members::remove(player)` | Removes a member. |
| `members::make_leader(player)` | Makes a member the leader, and errors for a player who is not one. |
| `members::is_member_of_team(ctx, player)` | Whether a player is in the team. Crowdy Team only. |
| `timers::start(ctx, timers::END_MATCH)`, `timers::stop(ctx, timers::END_MATCH)` | Starts or stops a timer with the asset's period. |
| `timers::END_MATCH` | A timer's name, one constant per timer. |
| `calls::<type>::<function>(ctx, key, &inputs)` | Calls a function of a Can Call or Listen To type and returns its outputs. For a Server Function Library there is no `key`. |
| `calls::any(ctx, node_type, key, method, &payload)` | With Can Call Any Type: calls any type by its Type Name with an encoded payload, and returns the reply bytes. |
| `messages::send_boss_defeated(&payload)`, `messages::BOSS_DEFEATED` | Sends one of the type's messages, and the message's topic as a constant; one of each per message. |
| `listen::<type>::<message>(ctx, key)`, `listen::<type>::stop_<message>(ctx, key)` | Starts or stops listening to a message of one Server Object of a Listen To type. |

The `members` functions change the Server Object's own members, so a function that fails leaves them as they were, like its variables.

## Related

- [Create a Server Object type](./create-a-type.md): the type's other settings and the asset editor
- [Relate Server Objects to each other](./relate-server-objects.md): which of these settings to use for one-to-one, one-to-many and many-to-many relations
- [Guild halls and arena lobbies](./examples/guild-halls-and-arenas.md): a registry of teams of five, and a lobby with a leader and a timer
- [Write its server logic](./write-server-logic.md): what the generated code does for you, and where `logic.rs` goes
- [Server messages](./create-a-type.md#server-messages): the messages a Listen To type hears
- [Make a Server Function Library](./server-function-libraries.md): a type with functions and no instance, which any Can Call list can name
- [Troubleshooting](./troubleshooting.md#outcomes): outcomes and refusals
- [Read and follow its variables, from Blueprint](./from-blueprint/read-and-follow-variables.md#by-name): **Get Members**, **Is Member** and **Is Leader**
- [Get a Server Object, from Blueprint](./from-blueprint/get-a-server-object.md#add-the-component): the component's **Player's Team** and **From Server Value** modes
- [Teams](../services/teams.md): the platform's teams, for **Crowdy Team**
