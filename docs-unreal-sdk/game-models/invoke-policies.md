---
slug: invoke-policies
sidebar_position: 9
title: Invoke Policies
description: "How a Game Model function decides who may call it: the require lines on the effect, the gate the compiler infers when you write none, and why an empty policy clears the server's rather than leaving it alone."
---

# Invoke Policies

Every Game Model function carries an invoke policy, a small boolean tree the server evaluates before the function runs. You author it on the effect asset as `require` lines, or as the equivalent gate on the graph front end; the compiler lowers it to JSON and the schema sync sends it. There is no runtime call that sets a policy, and there is no setting that turns enforcement off for a player, your own account included.

## When you touch this

Whenever a function must not be callable by everyone: only the owner refuels their lantern, only the host locks the room, only the player whose turn it is may move. Also whenever you delete a `require` line, because of the rule at the end of this page.

## Authoring a gate

A `require` line is a boolean expression. A bare keyword lowers to a structured server leaf; anything else lowers to a `condition` the server evaluates against `self`, the call's parameters, and the injected system parameters. The keywords:

| Write | Server leaf | Meaning |
|---|---|---|
| `owner` | `owner_of_self` | The caller owns the target container. |
| `my_turn` | `is_current_turn` | It is the caller's turn in the Game Model session. |
| `host` | `is_host` | The caller is the app's **elected** host. Not the Game Model session host. [Host election](../services/host-election.md) and [Host discovery](/game-api/host-discovery). |
| `participant` | `is_participant` | The caller is a joined participant of a **Game Model session** the invoke names. Not "in the match" by any other meaning. |
| `automation` | `is_automation` | The caller is the server's own automation. |
| `anyone` | an always-true `condition` | Any signed-in player. Say it explicitly when you mean it; it is never the default. |

`is_participant` is true only when all three hold: the app has an **active** Game Model session, the caller is a **joined** participant of that session, and the invoke carries that session's id (`SessionId` on the call, or `self.sessionId` on the target row). A missing session id is **false**. Create Game Session and Join Game Session are what produce that record; [Sessions](./sessions.md).

:::danger[Four things are called a session. Only a Game Model session satisfies `is_participant`.]
The **login / identity session** is who signed in (`UCrowdyGameSession`). The **UDP session channel** (`__crowdy_session_<appId>`) is a transport every client of the app joins. **Crowdy Teams** membership is a persistent group with roles. A **Game Model session** is the roster Create / Join write. Joining a team, sitting in the match, or riding the session channel does not make `is_participant` true. [Sessions and Presence](../concepts/sessions-and-presence.md) keeps the four apart.
:::

`feature("premium")`, `grid_permission("access")`, and `group_permission(42)` are the argument-carrying leaves; their arguments must be literals. `&&`, `||`, and `!` become `and`, `or`, and `not`. The full vocabulary and how the server evaluates each leaf are on [Authority: deciding who may invoke a function](/game-api/game-models#authority-deciding-who-may-invoke-a-function); this page only covers what the Unreal author writes.

Multiple `require` lines combine with `and`, so adding a line only ever narrows access. One line lowers to that leaf bare; two or more lower to an `and` node.

The `Refuel` function from [Functions and return values](./functions-and-return-values.md), first with no gate authored, then with an explicit one. Both are the `EffectScript` body of the asset; the graph front end expresses the same thing as entries in the effect's `Requires` array (`FCrowdyEffectRequireSpec`, kind `Keyword` or `Comparison`, `ECrowdyEffectRequireKind`), each keyword drawn from `ECrowdyEffectPolicyKeyword`. There is no Blueprint node graph for this: it is authored in the script or the Details panel. The full `require` syntax is on [EffectScript](./effect-script.md#require).

```text
# No require line: the compiler infers owner_of_self,
# because the body writes only self.
self.fuel += $amount + fn:MaxFuelBonus()
return self.fuel
```

```text
# Explicit: the lantern's owner, and only while it is not full.
require owner
require self.fuel < 100
self.fuel += $amount + fn:MaxFuelBonus()
return self.fuel
```

The second body emits:

```json
{"type":"and","rules":[{"type":"owner_of_self"},{"type":"condition","expression":"self.fuel < 100"}]}
```

This is the `InvokePolicyJson` field of the compiled function (`FCrowdyGameModelFunctionInput::InvokePolicyJson`); the effect asset's **Deploy Payload** panel prints it, and [Game Models authoring](../studio/game-models-authoring.md) says why to read it before every sync.

## No require is not no gate

When a body has no `require` line at all, the compiler infers a gate rather than leaving the function open:

| Body | Inferred policy |
|---|---|
| Writes only `self.<attr>` | `owner_of_self` |
| Reads or writes `source.<attr>` or `ref(...)` anywhere | `is_participant` |
| `CallableFrom` is Other effects only, not automation-invocable | none: there is no caller to gate |
| `CallableFrom` is Other effects only and automation-invocable | `is_automation` |

The default keys on whether the effect crosses entities, not on which container it writes: `self.hp -= source.str` writes self but reads source, so it is cross-entity and gates `is_participant`.

:::warning[A freshly authored function is never open by accident.]
No `require` line means the inferred gate above, not "anyone". If you want a function every signed-in player may call on any container, say `require anyone` and read the emitted policy back in the Deploy Payload panel. `require participant` is not a synonym for anyone: it still needs a Game Model session and a `sessionId` on the invoke.
:::

:::danger[A cross-entity body with no `require` infers `is_participant`. No Game Model session means every player call fails.]
If the Effect body reads `source.` / `ref(...)` (or any other entity) and you did not write `require owner` or `require host`, Unreal emits `is_participant`. A player-facing Effect of that shape in an app that never calls Create or Join Game Session **always** lands on `Failed` for players. Opt out with `require anyone` plus the conditions you actually mean, **or** create and join a Game Model session and pass `SessionId`. The asset's **Deploy Payload** panel prints the inferred leaf; that is what the server will evaluate, not the `require` lines you meant to write later.
:::

An authored `require` is added to the inferred gate with `and`, unless what you wrote already constrains the caller on every path (`require owner`, `require host`), in which case the inferred gate is dropped so a deliberate `require host` is not also gated on ownership. A `require` that only tests values (`self.fuel < 100`, `$damage > 0`) never loosens who may call: it is added to the inferred gate. So `require self.fuel < 100` alone still carries `owner_of_self`; the explicit body above is what you write when you want to see both.

## An empty policy clears the server's policy

:::danger[The sync always ships the policy the asset lowers now; an empty one is sent as an explicit null that clears the server's.]
The server never keeps a policy the asset stopped lowering, so "no policy" is never "no gate" by accident and never the old gate by memory. Deleting the `require` lines on a player-callable function does not clear anything: the sync replaces the old policy with the inferred gate (`owner_of_self` or `is_participant`). Switching a function to `Other effects only` without Run Automatically is the shape that lowers no policy at all; the sync then sends null and the server removes whatever gate the function had, because a helper reachable only from other effects has no caller to gate. Read the Deploy Payload's policy before every sync of an existing function, and write the gate you mean.
:::

For a brand-new function this is harmless: there is nothing to clear, and the inferred default applies. The hazard is editing an existing function into the internal, non-automation shape, whose null policy clears the gate it used to have.

## Where enforcement lives

The policy applies to everyone, app admins included; there is no app-level switch that exempts a player account, so a call your own account makes is gated exactly as a stranger's. The Game API page describes a deliberate skip for admin tooling; it needs a permission a shipped client never holds.

A refused `require` rolls the whole invoke back before any assignment runs and lands on the caller's `Failed` pin. The pin's `ErrorMessage` is a player-safe sentence, not the require leaf; the leaf is on `gameModelEvents`. [Functions and return values](./functions-and-return-values.md).

## Gotchas

- A `require` is lowered to the policy, not to a runtime branch. A failing one refuses the call; it does not skip a line.
- A `condition` leaf may read `self`, the call's parameters, and the injected system parameters.
- The graph front end and the text body lower to the same JSON. Switching between them is a UI choice.
- A sync ships whatever policy is authored at that moment. The review sheet counts changes but does not single out an authority change; read the Deploy Payload panel after an SDK update. [Game Models authoring](../studio/game-models-authoring.md).
- Kit functions carry their own policies chosen from the preset's authority dropdowns, which are a friendlier face on the same grammar. [Kits](./kits.md).
- `host` is the elected app host. The Game Model session host is a different fact; [Sessions](./sessions.md) and [The Host Is a Convention](../concepts/host-is-a-convention.md).
- Inferred `is_participant` plus no Game Model session is a permanent player denial, not a bind race. Read the Deploy Payload before you debug health or team assignment.

## Related

- [Functions and return values](./functions-and-return-values.md): `CallableFrom`, the internal scope, and what a refusal looks like to the caller.
- [Applying an effect from C++](./effects-cpp.md): the asset the `require` lines live on.
- [Game Models authoring](../studio/game-models-authoring.md): the sync that ships the policy.
- [Authority on the Game API](/game-api/game-models#authority-deciding-who-may-invoke-a-function): the leaf vocabulary and evaluation rules.
