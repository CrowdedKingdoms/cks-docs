---
slug: shared-boss
sidebar_position: 3
title: Shared boss fight
description: A worked Server Object example in Oakford - one boss every player hits, with its health kept on the server - covering the structs or the asset's own variables, the asset rows (Readable By, Hit's Callable By, Cooldown and Value Range, a Respawn timer), the logic.rs that refuses hits while it is defeated and respawns it, Deploy, the actor and its Crowdy Server Object component, the Blueprint with typed nodes, two players in Play In Editor, switching the type off and on from Server Compute, and what players see when the boss falls.
---

# Shared boss fight

:::note
Server Objects run on [ck-exec](/exec/intro). The tagged v2.17.0 plugin does not have them; see [What's Changed](../../guides/whats-changed.md#unreleased-after-v2170).
:::

The Hollow Giant stalks Oakford's north road. Every player who passes can hit it, and all of them see the same health bar fall. Its health is the kind of number a client must never decide, so it lives on the server as a Server Object: one boss, however many players are hitting it.

This page builds it end to end. It uses what the earlier pages explain one piece at a time: the [definition asset](../create-a-type.md), [access and timers](../access-members-and-timers.md), the [server code](../write-server-logic.md), [Server Compute](../deploy-with-server-compute.md) and the [Blueprint nodes](../from-blueprint/get-a-server-object.md). If you have not made a Server Object before, start with [Tip jar: your first Server Object](./tip-jar.md).

The rules of the fight:

- Every hit takes 1 to 25 health off the boss, whoever lands it.
- A player can hit about four times a second.
- At half health the boss is **Enraged**. At zero it is **Defeated**, and hits are refused.
- Ten seconds after it falls, it comes back at full health.

## What the server keeps

The boss has six values, and every player may see all of them.

| Value | Type | Starts at | What it is |
|---|---|---|---|
| `Health` | Integer | 100 | What is left |
| `MaxHealth` | Integer | 100 | What a full bar is |
| `Phase` | `EBossPhase` | Alive | Alive, Enraged or Defeated |
| `Respawns` | Integer | 0 | How many times it has come back |
| `Hits` | Integer | 0 | Hits accepted, over every life |
| `LastHitBy` | Integer64 | 0 | The user id of the last player to hit it |

You can keep them in structs, as the C++ pages do, or as variables added right in the asset. The server code is the same either way. The structs:

```cpp
UENUM(BlueprintType)
enum class EBossPhase : uint8
{
	Alive,
	Enraged,
	Defeated
};

USTRUCT(BlueprintType)
struct FBossState
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Health = 100;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 MaxHealth = 100;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) EBossPhase Phase = EBossPhase::Alive;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Respawns = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Hits = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int64 LastHitBy = 0;
};

USTRUCT(BlueprintType)
struct FBossHitInputs
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite, meta = (ClampMin = 1, ClampMax = 25)) int32 Damage = 10;
};

USTRUCT(BlueprintType)
struct FBossHitOutputs
{
	GENERATED_BODY()
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Health = 0;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Hits = 0;
};
```

The `ClampMin` and `ClampMax` are the function's [Value Range](../access-members-and-timers.md#value-range), 1 to 25.

With no C++, add the same six as **Variables** in the asset instead, with `Phase` picking your enum (a Blueprint enum works too), and give `Hit` one **Input**, `Damage`, and two **Outputs**, `Health` and `Hits`. Set the range under **Value Range** in the input's Details, **Min** 1 and **Max** 25. The rest of this page says where the two differ.

## The asset

Make a **Crowdy Server Object Definition**, `CSO_Boss`, as on [Create a Server Object type](../create-a-type.md#make-the-asset). With **Type Settings** selected in the Server Object panel, in Details:

| Setting | Value |
|---|---|
| Type Name | `boss` |
| Readable By | **Every Player** |
| State Struct | `FBossState`, if you use structs |

Leave **Members From** on **None**: nobody is seated in a boss, and anyone may hit it. Leave every eye on the variables open, **Visible to Players**.

**Every Player** suits a boss that a whole world fights. With **Members** or **Owner Only** the server tells each watcher that something changed and each one reads the values again, which is slower and means a burst of hits can be seen as fewer, bigger steps. See [Readable By](../access-members-and-timers.md#readable-by).

Add a function, `Hit`:

| Setting | Value |
|---|---|
| Callable By | **Players** |
| Cooldown | 0.25 |
| Inputs | `FBossHitInputs` (**Use Struct**), or one Integer, `Damage`, starting at 10, with a **Value Range** of 1 to 25 |
| Outputs | `FBossHitOutputs` (**Use Struct**), or two Integers, `Health` and `Hits` |

**Cooldown** is per player: one player can hit every quarter second, and another player's hits do not count against them.

Add a timer under **Timers & Events**:

| Setting | Value |
|---|---|
| Name | `Respawn` |
| Runs | **Once After** |
| Time | 10 seconds |
| Start Automatically | **off** |

Its row reads "Respawn: Once After 10 s". Start Automatically is off because the boss starts alive. The server code starts the timer when the boss falls. Save the asset.

## The server code

Click **Generate** in the asset editor's toolbar, which writes `Server/boss/`. `Hit` and `Respawn` both arrive in `logic.rs` as methods that refuse with "not written yet". Replace the file with this:

```rust
use crate::*;
use ckx_sdk::prelude::*;

impl Functions for BossState {
    fn hit(&mut self, ctx: &Ctx, call: &Call<'_>, params: BossHitInputs) -> Result<BossHitOutputs> {
        if self.Phase == BossPhase::Defeated {
            return Err(Error::new("The boss is defeated; wait for it to respawn"));
        }
        self.Health = (self.Health - params.Damage).max(0);
        self.Hits = self.Hits.saturating_add(1);
        self.LastHitBy = call.player().map(|id| id as i64).unwrap_or(0);
        self.Phase = match self.Health {
            0 => BossPhase::Defeated,
            health if health * 2 <= self.MaxHealth => BossPhase::Enraged,
            _ => BossPhase::Alive,
        };
        if self.Health == 0 {
            timers::start(ctx, timers::RESPAWN)?;
        }
        Ok(BossHitOutputs { Health: self.Health, Hits: self.Hits })
    }

    fn respawn(&mut self, _ctx: &Ctx) -> Result<()> {
        // A timer that fires twice, or on a boss that is not down, changes nothing.
        if self.Phase != BossPhase::Defeated {
            return Ok(());
        }
        self.Health = self.MaxHealth;
        self.Phase = BossPhase::Alive;
        self.Respawns += 1;
        Ok(())
    }
}
```

If you added the values in the asset rather than as structs, the generated names are `BossState` (the same), `HitParams` and `HitReply` in place of `BossHitInputs` and `BossHitOutputs`; see [The Rust names](../write-server-logic.md#the-rust-names).

What it does, in the order it does it:

- **It refuses while the boss is defeated.** The function returns an error, so the state is put back exactly as it was and nothing is published. The caller gets the `ServerError` outcome with that message. A second player who hits in the same moment the boss falls gets the refusal too.
- **It clamps at zero.** A 25 at 10 health leaves 0, not -15.
- **It counts the hit and remembers who landed it.** `Hits` goes up by one, over every life of the boss.
- **It sets the phase from what is left.** Half of `MaxHealth` or less is Enraged, and zero is Defeated.
- **At zero it starts `Respawn`.** The timer starts only because this call succeeded. Had the call been refused, no timer would have been armed. If the platform refuses to start the timer, the whole hit is refused instead: the boss keeps its health, nothing is published, and the player sees `ServerError` with "the change was not kept: timer Respawn could not start" and the reason.
- **`respawn` restores full health, but only for a boss that is down.** It runs once, ten seconds after the boss fell, and its changes reach every watcher like a function's do. Called on a boss that is not Defeated, for example by a stale or repeated timer, it does nothing.

Nothing here checks that `Damage` is 1 to 25, that the caller is a player or that they are not hitting too fast. The **Value Range** and **Cooldown** on the asset are enforced before `hit` runs.

## Put it on the server

Open Crowdy Studio and choose **Server Compute**, as on [Open the page](../deploy-with-server-compute.md#open-the-page). The **Overview** tab lists `boss` with the badge **New**. Click **Deploy**, read the dialog, which should say it adds `boss`, and click **Yes**. Wait for "Deployed as version" and a number. See [Deploy](../deploy-with-server-compute.md#deploy).

If you change the asset or the code later, **Generate** and **Deploy** again.

## The actor

The boss is an actor with a **Crowdy Server Object** component: **Definition** `CSO_Boss`. What to set in **Instance Mode** depends on how the boss gets into the level.

- **This Actor**, for a boss you place in the level. The component uses the actor's placement, which is the same on every player's machine, so every player who loads the level meets the same boss. No id to type.
- **Instance Id**, for a boss your game spawns at run time, the usual case for a boss that appears when a fight starts. Type an id such as `boss-1`; every copy with that id, on every machine, is the same boss. Set it before the actor finishes spawning, or call **Rejoin** on the component afterwards. A new id is a new boss, at full health, with nothing saved.
- **From Server Value**, for a boss per match. Point **Source Definition** at the match's Server Object and **Source Variable** at a String such as `MatchId`; the boss follows it, as the guild hall follows its player's team. See [Guild Halls](./guild-halls-and-arenas.md#guild-halls).

For this page, place the actor in the level and use **This Actor**.

Name it `BP_Boss`: in the Content Browser, **Add**, **Blueprint Class**, **Actor**, then open it, click **Add** in the Components panel, choose **Crowdy Server Object**, set **Definition** to `CSO_Boss` and **Instance Mode** to **This Actor**. Drag it into your level.

## The Blueprint

Every node here is a typed node from [The typed nodes](../from-blueprint/get-a-server-object.md#the-typed-nodes), and none needs a **Target**: they use the actor's own component.

**Show the health.** In the Event Graph:

1. Add **On Health Changed (CSO_Boss)** and wire **Event BeginPlay** into its **Bind**.
2. Wire **Changed** to a **Set Percent** on your health bar widget, with **Health** divided by **Get MaxHealth (CSO_Boss)**. The figure converts both to floats first.

<Blueprint src="so-boss-health" title="Event BeginPlay, On Health Changed, Get MaxHealth, divide, Set Percent on HealthBar" />

Pan a Blueprint figure with the right mouse button. Press **Copy nodes**, then Ctrl+V in your own event graph.

3. In the same way, bind **On Phase Changed (CSO_Boss)** from **Event BeginPlay**, and from its **Changed** show the **Phase**: the figure sends it through **Enum to String** into a **Print String**, and a tint on the bar that turns red for Enraged and grey for Defeated works as well.
4. Bind **On Respawns Changed (CSO_Boss)** as well, from the **Then** pin of **On Phase Changed**, and show "It is back." from its **Changed** with a **Print String**.

<Blueprint src="so-boss-phase" title="Event BeginPlay, On Phase Changed, On Respawns Changed, Print String" />

**Changed** runs at once, with the current value, as soon as the object is ready, so the bar is right for a player who arrives in the middle of the fight. A widget with no component can read the same boss through **Find By Asset**, using **Get Health (CSO_Boss)** in its own graph; see [A widget that shows the oil](../from-blueprint/read-and-follow-variables.md#a-widget-that-shows-the-oil), which works the same way.

**Hit it.** Give the actor **Auto Receive Input** on **Player 0**, as in [Tip jar: your first Server Object](./tip-jar.md#tip-from-the-keyboard), then:

1. Add the **F** key event, and from **Pressed** add **Call Hit (CSO_Boss)**.
2. Set its **Damage** pin to 10.
3. From **On Success**, add a **Print String** that builds "Health " and the **Health** output, the boss's health after your hit, with **Build String**. The call also gives **Hits**, the hit count; the figure leaves it unwired.
4. Click the small arrow at the bottom of **Call Hit** to show its **Reason** pin, then from **On Failed** add a **Print String** and wire **Reason** to it.

Compile and save.

<Blueprint src="so-boss-hit" title="F, Call Hit (Damage 10), Build String, Print String on On Success and On Failed" />

## Two players in Play In Editor

1. In **Advanced Settings** under **Multiplayer Options**, set **Number of Players** to 2 and click **Play**. Sign both windows in.
2. Both show a full bar.
3. Press **F** in one window. Its bar drops to 90, and it prints the success line with `Health 90`. The other window's bar drops to 90 too, a moment later.
4. Press **F** in the other window. Both go to 80.
5. Tap **F** in one window faster than four times a second. A hit sooner than that after your last one runs **On Failed** with the **Outcome** Denied and a **Reason** that says how long to wait, such as "Hit can be called again in 1 s". **Retryable** is true for that one, and the boss does not change.
6. Keep hitting from both windows. Below 50 health both windows turn Enraged. At 0 both show Defeated.

While it is defeated, another **F** runs **On Failed** with the **Outcome** ServerError and the **Reason** "The boss is defeated; wait for it to respawn", and **Retryable** is false: calling again will be refused the same way until something changes. Ten seconds after it fell, both windows show a full bar, Alive, and **Respawns** 1. **Hits** is not reset: it counts every hit the boss has taken.

To see the range at work, set **Damage** to 30 or 0. The server refuses it before `hit` runs: **On Failed** gets the **Outcome** ServerError and the **Reason** `bad_params: Damage must be 1 to 25`, **Retryable** is false, and the boss does not change.

## Switch it off and on

Open **Server Compute** and look at the `boss` row on the **Overview** tab while both players are in the fight.

1. Click **Switch off** and confirm "Switch off boss". Its Server Objects are saved and stopped.
2. Press **F** in either window. The call is refused as **Denied**, and nothing changes for either player. Each window keeps showing the last health it had.
3. Click **Switch on**. There is no dialog.
4. Press **F** again. The boss starts again from what was saved, both windows follow it again, and the next hit lands on the same health it had before you switched off. Nothing is lost and nothing has gone back.

If the boss was defeated when you switched it off, its `Respawn` timer is still pending: it fires once after the type is back, and both windows see the boss return.

A switch like this is also the quick way to move a running boss onto code you have just deployed. See [Switching a type or the app off and on](../deploy-with-server-compute.md#switching-a-type-or-the-app-off-and-on).

## What the player sees when the boss falls

The hit that takes it to 0 succeeds for the player who landed it, with `Health` 0. Everyone watching gets one change with `Health` 0 and `Phase` Defeated, and their bars empty together. `LastHitBy` is that player's user id, so the game can name who landed the blow.

From then until the respawn, every hit is refused, from every player, with the same message and not retryable. A game should turn the **F** prompt off on **Defeated** rather than let players fire into it. Ten seconds later the server runs `respawn` and every player gets one change: full health, Alive, `Respawns` up by one.

If something does not behave, turn on [`crowdy.exec.trace`](../troubleshooting.md#seeing-what-a-server-object-is-doing) in both windows. Each accepted hit shows as one applied push with the same epoch and sequence number in both logs, which is the quick way to tell whether the two players really saw the same thing. A dropped connection shows as `exec: connection closed`, then `exec: redial ok` and a re-read.

## Related

- [Tip jar: your first Server Object](./tip-jar.md): the same flow from nothing, with a tip jar
- [Guild halls and arena lobbies](./guild-halls-and-arenas.md): members, a registry and a lobby
- [Access, members and timers](../access-members-and-timers.md): every setting used here
- [Write its server logic](../write-server-logic.md): where `logic.rs` lives and what the generated code does for you
- [Deploy it with Server Compute](../deploy-with-server-compute.md): Deploy, versions and the switch
- [Get a Server Object, from C++](../from-cpp/get-a-server-object.md): the statuses and what a dropped connection does
- [Troubleshooting](../troubleshooting.md#seeing-what-a-server-object-is-doing): `crowdy.exec.trace`
