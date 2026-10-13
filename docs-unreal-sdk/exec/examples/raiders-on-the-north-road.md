---
slug: raiders-on-the-north-road
sidebar_position: 4
title: Raiders on the north road
description: A worked Server Object example in Oakford - a raider warband with a record for each raider - covering the asset (Holds A Record per Entity, Everyone, Owner Only, Team Only and Server Only variables, Reads World Data, Area Size 2), the logic.rs with a census of the raiders standing in an area, Hire and a skirmish timer, Deploy, the raider actor and the player's Crowdy Server Object components in This Actor's Area mode, the Blueprint with typed nodes, and two players in Play In Editor seeing different values of the same raider.
---

# Raiders on the north road

:::note
Server Objects run on [ck-exec](/exec/intro). Records per entity are new in v2.19.0; see [What's Changed](../../guides/whats-changed.md#2026-10-12-sdk-v2190).
:::

A warband camps on Oakford's north road, a short walk from the Hollow Giant. There are far too many raiders for a Server Object each, so the warband is one Server Object per patch of road with a record for every raider in it. Every player sees how hurt each raider is. A player can hire a raider, and then only that player sees what the raider carries. Raiders belong to one of two bands, and a player who hires a raider learns where that band hides.

This page builds it end to end. It uses [Keep a record per entity](../keep-a-record-per-entity.md), which explains each setting, and the pages that earlier examples use: the [definition asset](../create-a-type.md), the [server code](../write-server-logic.md), [Server Compute](../deploy-with-server-compute.md) and the [Blueprint nodes](../from-blueprint/get-a-server-object.md). If you have not made a Server Object before, start with [Tip jar: your first Server Object](./tip-jar.md).

The rules of the road:

- Each raider has 40 health and loses 5 every 5 seconds to the skirmishes on the road. A raider at 0 health retreats, and comes back at full health a moment later.
- A player can hire one raider at a time by pressing a key. The server picks the first raider nobody has hired.
- A hired raider collects loot every 5 seconds, and only its player sees the loot.
- Raiders belong to the ravens or the wolves. Each band has a hideout. A player who has hired a raider of a band can see that band's hideout, and nobody else can.

## What the server keeps

Each raider has a record with four values.

| Value | Type | Starts at | Who receives it |
|---|---|---|---|
| `Health` | Integer | 40 | Everyone |
| `Loot` | Integer | 0 | Owner Only: the player who hired the raider |
| `Hideout` | String | empty | Team Only: players who have hired a raider of the same band |
| `Greed` | Integer | 2 | Nobody (Server Only): how much loot a hired raider collects at each skirmish |

Besides these, every record has an owner, the player who hired the raider or 0, and a team, `ravens` or `wolves`. The server code sets them. They are not variables of the type.

Add the four as **Variables** in the asset, as the [tip jar](./tip-jar.md) does. With a struct instead, `FRaiderState` has the same four members, and the server code is the same.

## The asset

Make a **Crowdy Server Object Definition**, `CSO_Raider`, as on [Create a Server Object type](../create-a-type.md#make-the-asset). With **Type Settings** selected, in Details:

| Setting | Value |
|---|---|
| Type Name | `raider` |
| Holds | **A Record per Entity** |
| Readable By | **Every Player** |
| Reads World Data | On |
| Area Size | 2 |

Leave **Max Records** at 2048, **Send Changes Every** at 250 ms, **Areas Followed Around a Player** at 1 and **Team From** on **This Object's Records**. Leave **Members From** on **None**; a record type cannot have members.

**Reads World Data** is on because the server code asks which raiders stand in the area. **Area Size** is 2 because the census reads every chunk of the area, and a small area keeps that to four chunks. With a larger one, the same code just reads more.

Add the variables. For each, select it in the Server Object panel and, in Details, set **Visible to Players**:

| Variable | Type | Default | Visible to Players |
|---|---|---|---|
| `Health` | Integer | 40 | **Everyone** |
| `Loot` | Integer | 0 | **Owner Only** |
| `Hideout` | String | empty | **Team Only** |
| `Greed` | Integer | 2 | **Server Only** |

Add a function, `Hire`:

| Setting | Value |
|---|---|
| Callable By | **Players** |
| Cooldown | 1 |
| Inputs | none |
| Outputs | none |

Add two timers under **Timers & Events**:

| Name | Runs | Time | Start Automatically |
|---|---|---|---|
| `Census` | **Every** | 2 seconds | On |
| `Skirmish` | **Every** | 5 seconds | On |

Their rows read "Census: Every 2 s" and "Skirmish: Every 5 s". Save the asset.

## The server code

Click **Generate** in the asset editor's toolbar, which writes `Server/raider/`. Replace `logic.rs` with this:

```rust
use crate::*;
use ckx_sdk::prelude::*;
use std::collections::BTreeSet;

const FULL_ANSWER: usize = 200;

fn area_origin(key: &str) -> Option<(i64, i64)> {
    let (x, y) = key.split_once(',')?;
    Some((x.parse::<i64>().ok()? * AREA_SIZE, y.parse::<i64>().ok()? * AREA_SIZE))
}

impl Functions for Records {
    fn hire(&mut self, _ctx: &Ctx, call: &Call<'_>) -> Result<()> {
        let player = call.player()?;
        let free = self.ids().find(|id| self.owner(id) == Some(0)).map(str::to_string);
        let Some(id) = free else {
            return Err(Error::new("every raider here is hired"));
        };
        self.set_owner(&id, player)
    }

    fn census(&mut self, ctx: &Ctx) -> Result<()> {
        let Some((x, y)) = area_origin(&ctx.key) else { return Ok(()) };
        let mut found = BTreeSet::new();
        let mut full = false;
        for cx in x..x + AREA_SIZE {
            for cy in y..y + AREA_SIZE {
                let Ok(actors) = ctx.world().actors(ChunkPos::new(cx, cy, 0)) else { return Ok(()) };
                full |= actors.len() >= FULL_ANSWER;
                found.extend(actors.into_iter().filter(|actor| actor.player.is_none()).map(|actor| actor.uuid));
            }
        }
        if !full {
            let gone: Vec<String> = self.ids().filter(|id| !found.contains(*id)).map(str::to_string).collect();
            for id in gone {
                self.remove(&id);
            }
        }
        for id in found {
            if self.get(&id).is_some() {
                continue;
            }
            let (team, hideout) = if self.len() % 2 == 0 { ("ravens", "the old mill") } else { ("wolves", "the quarry") };
            let raider = RaiderState { Hideout: hideout.to_string(), ..Default::default() };
            if self.insert(&id, 0, team, raider).is_err() {
                break;
            }
        }
        Ok(())
    }

    fn skirmish(&mut self, _ctx: &Ctx) -> Result<()> {
        let ids: Vec<String> = self.ids().map(str::to_string).collect();
        for id in ids {
            let hired = self.owner(&id).is_some_and(|owner| owner != 0);
            let Some(raider) = self.get_mut(&id) else { continue };
            raider.Health -= 5;
            if hired {
                raider.Loot += raider.Greed;
            }
            if raider.Health <= 0 {
                self.remove(&id);
            }
        }
        Ok(())
    }
}
```

If you used a struct, `RaiderState` is the struct's name without its `F`; see [The Rust names](../write-server-logic.md#the-rust-names).

What it does:

- **`hire` gives the caller the first raider nobody owns.** `set_owner` makes the caller its owner. The raider keeps its band as its team, so the caller is now on that band's team. If every raider is hired the call is refused with that message.
- **`census` makes a record for each raider standing in the area.** It reads each of the area's four chunks at ground level, collects the actors no player owns, and adds a record, owned by nobody, for each one it does not have. Raiders alternate between the two bands as they are added. It removes the records of raiders that left the area, unless a chunk's answer was full: one call answers at most 200 actors, so a full answer may be missing some, and removing a record for it would remove a raider who is still there.
- **`skirmish` wounds every raider and pays the hired ones.** A hired raider adds `Greed` to its `Loot`. A raider at 0 health is removed, and with it the hire; the next census adds a new record for the same raider, at full health and owned by nobody.
- **The ids are the raiders' entity ids.** The census call reports each actor's `uuid`, and that is the id the raider's own actor uses to find its record.

Nothing here checks who may hire. **Callable By** and **Cooldown** on the asset do that before `hire` runs.

## Put it on the server

Open Crowdy Studio and choose **Server Compute**, as on [Open the page](../deploy-with-server-compute.md#open-the-page). The **Overview** tab lists `raider` with the badge **New**. Click **Deploy**, read the dialog, which should say it adds `raider`, and click **Yes**. Wait for "Deployed as version" and a number. See [Deploy](../deploy-with-server-compute.md#deploy). The type asks for the `world.read` permission, since **Reads World Data** is on.

## The actors

Two actors use the type.

**The raider.** `BP_Raider` is a Crowdy entity, so it has a **Crowdy Entity** component; see [Entities and Spawning](../../runtime/entities-and-spawning.md). Its id is the id of its record. Add a **Crowdy Server Object** component, set **Definition** to `CSO_Raider` and **Instance Mode** to **This Actor's Area**. The component reads the raider's own record and follows the raider as it walks from one area into the next. Add a health bar widget, with a Progress Bar variable named `HealthBar`. Spawn the warband from your game mode with **Spawn Crowdy Entity** and the class `BP_Raider`, on the road.

**The player.** Give the player's pawn a **Crowdy Server Object** component too, with **Definition** `CSO_Raider` and **Instance Mode** **This Actor's Area**. The pawn is a Crowdy entity already, and its own area is where **Hire** is called. The census skips actors that belong to a player, so the pawn has no record of its own and the component's variables stay at their defaults. The pawn is only here to reach the area's object. Give it **Auto Receive Input** on **Player 0**, as in [Tip jar: your first Server Object](./tip-jar.md#tip-from-the-keyboard).

## The Blueprint

Every node here is a typed node from [The typed nodes](../from-blueprint/get-a-server-object.md#the-typed-nodes), and none needs a **Target**: each uses its own actor's component.

**Show the health.** In `BP_Raider`'s Event Graph:

1. Add **On Health Changed (CSO_Raider)** and wire **Event BeginPlay** into its **Bind**.
2. Wire **Changed** to a **Set Percent** on `HealthBar`, with **Health** divided by 40.

<Blueprint src="so-raider-health" title="Event BeginPlay, On Health Changed, divide by 40, Set Percent on HealthBar" />

Pan a Blueprint figure with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

**Show what only some players see.** In the same graph:

1. Bind **On Loot Changed (CSO_Raider)** from **Event BeginPlay**, and from its **Changed** print the **Loot** with a **Print String**.
2. Bind **On Hideout Changed (CSO_Raider)** from the **Then** pin of **On Loot Changed**, and from its **Changed** print the **Hideout**.

<Blueprint src="so-raider-private" title="Event BeginPlay, On Loot Changed, On Hideout Changed, Print String" />

**Changed** runs at once with the current value, so each of these prints once when the raider appears. A player who may not see a value gets its default, so `Loot` prints 0 and `Hideout` prints an empty line for everyone but the raider's owner and the band's players. The value never changes for them afterwards.

**Hire a raider.** In the player pawn's Event Graph:

1. Add the **H** key event, and from **Pressed** add **Call Hire (CSO_Raider)**.
2. Click the small arrow at the bottom of **Call Hire** to show its **Reason** pin, then from **On Failed** add a **Print String** and wire **Reason** to it.

<Blueprint src="so-raider-hire" title="H, Call Hire (CSO_Raider), Print String on On Failed with the Reason" />

Compile and save both Blueprints.

## Two players in Play In Editor

1. In **Advanced Settings** under **Multiplayer Options**, set **Number of Players** to 2 and click **Play**. Sign both windows in, and spawn the warband from the first.
2. Within a few seconds both windows show the same raiders with full bars. A raider's bar falls a fifth of the way every 5 seconds, in both windows.
3. Press **H** in the first window. The server gives that player the first raider nobody owns. Within a second or so, on that raider, the first window prints `Loot` 2, then 4, then 6, one step every 5 seconds. The second window does not print them: it sees the same raider with `Loot` still 0.
4. In the first window, the raiders of the hired raider's band print their `Hideout`, "the old mill" for the ravens or "the quarry" for the wolves. The second window prints an empty line for all of them.
5. Press **H** in the second window. It gets the next free raider. Its own loot now climbs in the second window only, and the second window now sees the hideout of the raiders of that raider's band, which may be the same band or the other one.
6. Press **H** twice within a second. The second press runs **On Failed** with the **Outcome** Denied and a **Reason** such as "Hire can be called again in 1 s".
7. Wait. A raider at 0 health retreats, and a hired raider that retreats is lost: its player's loot stops, and, if it was their only raider, the hideout of its band goes back to an empty line. A moment later the raider is back at full health, owned by nobody. Press **H** to hire again.

A team is the team of a record the player owns *in the same area's object*. A player who walks into the next area is on no team there until they hire a raider there. To keep a band's secrets across areas, set **Team From** to **Crowdy Team**; see [Who receives a value](../keep-a-record-per-entity.md#who-receives-a-value).

If something does not behave, turn on [`crowdy.exec.trace`](../troubleshooting.md#seeing-what-a-server-object-is-doing) in both windows. Each batch of Everyone values shows as one applied push in both logs, and each fetch of the Owner Only and Team Only values as one read in the owner's or the team's log only.

## Related

- [Keep a record per entity](../keep-a-record-per-entity.md): every setting this page uses, and how values reach players
- [Shared boss fight](./shared-boss.md): one Server Object everyone hits, beside the Hollow Giant
- [Access, members and timers](../access-members-and-timers.md): Callable By, Cooldown and timers
- [Write its server logic](../write-server-logic.md): where `logic.rs` lives and what the generated code does for you
- [Deploy it with Server Compute](../deploy-with-server-compute.md): Deploy, versions and the switch
- [Troubleshooting](../troubleshooting.md#a-value-is-not-what-you-expect): when a value is not what you expect
