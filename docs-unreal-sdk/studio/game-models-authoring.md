---
slug: game-models-authoring
sidebar_position: 7
title: Game Models Authoring
description: What the Game Model page in Crowdy Studio does, in the order you use it, and where the things it shows are authored.
---

# Game Models Authoring

The Game Model page is where what you built in your project meets the server: it shows what the server currently holds for your app, what your project would change, and it is the one place a sync or a delete runs from. This page explains the Studio page; the building itself happens in your project, and the [Game Models section](../game-models/overview.md) teaches it.

## What the page is about, in two minutes

Some of your gameplay state must be trusted: hit points, currency, inventory, scores. The SDK keeps that state on the server as **Game Models**, and your Unreal project describes their shape:

- A **Model** is a type of server-side record, declared in your project as a container class (a C++ class or a Blueprint marked as a Game Model class). Its **Attributes** are the values it holds, declared as properties on that class. A **Live model** is one record of that type on the server, belonging to a player, a placed object, or the match.
- An **Effect** is a small server-side function that changes attributes, for example "refuel this lantern by 25". You author it in your project as a **Crowdy Effect** asset, either as a short script or as a node graph, and players trigger it from gameplay. The server runs it and decides.

None of that is authored here. You declare models and attributes in code ([Containers and attributes](../game-models/containers-and-attributes.md)), you write Effects in the effect asset ([Authoring an Effect](../game-models/authoring-effects.md), the [EffectScript reference](../game-models/effect-script.md), or the [Effect Graph](../game-models/effect-graph.md) editor), and then you come to this page to push those definitions to the server and to see how the server's copy compares with yours.

:::tip[Reading order]
If you have not built a Game Model yet, read the [Game Models overview](../game-models/overview.md) first and come back here when you have a container class or an Effect asset to sync. Everything below assumes you have something to push.
:::

:::note[The page needs an account sign-in.]
Its subtitle says so: a session that can mint an app token. An organization token will not do.
:::

## Open the page

Open Crowdy Studio, sign in, select your app on the Project page, then pick **Game Model** in the AUTHORING group of the sidebar.

![The Game Model page: the reconcile strip, the pre-seed strip, and the Models tab with the model list](/img/unreal-sdk/studio-gm-browser.png)

Two buttons sit in the page header:

- **Lint** checks the app's model for problems the server can see: a container bound to a type nobody defined, a function calling one that does not exist, a timer targeting something it may not invoke. Findings go to the log and to the **Issues** tab. An error can quarantine the object it names, so it refuses to run until you write its definition again.
- **Refresh** re-reads the app's models, attributes, functions, automations, features and policy from the server.

## The reconcile strip

Above the tabs, visible from every tab, sit three readiness pills (**App**, **Session channel**, **Schema**) and two buttons.

**Preview changes** is a dry run. It compares every Server Owned attribute on your container classes and every Crowdy Effect asset against the server and reports what a sync would do. Nothing is written.

:::note[Preview compares structurally, not as text.]
A default value, a policy, or a magnitude is compared as canonical JSON: object keys sorted, numbers normalised, arrays kept in order. Reordering the same properties, reformatting a JSON default, or a whitespace change never shows as a change, and a preview that reports one is reporting a real difference. A change of letter case in a value, a policy, or an effect expression (`"alice"` to `"Alice"`, `$Target` to `$target`) is a real difference and does show; a change of case alone in a description does not. Do not expect a cosmetic edit to produce a delta, and do not expect it to hide one either.
:::

**Sync to Server** writes: container types, property definitions, functions, automations, and triggers. It never deletes server state. If an effect needs the app's session channel, the sync creates it for you.

Pressing **Sync to Server** opens a review sheet headed **Send ...?**; there is no separate yes or no dialog. It lists every pending change grouped by kind, in apply order (Models, Attributes, Functions, Automations, Triggers), each row ticked. Untick anything you are not ready to send; whatever the rest needs is added back for you. Read the headline and counts, then press **Send**. A change list that moved under you refuses to send rather than sending something you did not review.

![The Send review sheet opened from Sync to Server, listing the pending changes by kind](/img/unreal-sdk/studio-gm-sync-preview.png)

:::warning[A sync can change which effects and policies the server enforces. The preview shows exactly what changes.]
An SDK update can change what an effect's invoke policy says, for example by adding an ownership or participation requirement to an effect that had none. The change is inert in your project until the next Sync to Server pushes the recomputed policy; a call that worked for months then starts returning "You are not allowed to do that". The review panel counts changes but does not single out an authority change from a cosmetic one. After updating the SDK, open each effect asset and read its **Deploy Payload** panel before you sync: it prints the exact function definition a sync would send, invoke policy included.
:::

Below the reconcile strip is a **Pre-seed containers** strip: scan the open map, preview, and apply the app-scoped rows that map's placed objects need. It belongs with sessions and scopes in the Game Models section. It is authoring work, so the strip hides itself on the Live tab and gives that height to the live list and the values panel.

:::note[Since 2.14]
Pre-seeding and the app scope for containers are new in this version.
:::

## The four tabs

**Models.** What is in this app's schema, where each piece came from, and what a sync would change. A search box, a source filter (**All**, **In code**, **Only on server**), the model list, and a detail panel with the selected model's Attributes, Functions, Automations, and Live sections. A **Mark for deletion** button under the list marks the selected row.

**Live.** What is running right now, read straight from the server, so it is live even outside Play. Columns: **Name**, **Id**, **Owner**, **Session**, **Binding**. Filter by type name and session id. Actions: Refresh, Copy id, **Delete live model**, **Delete all of this model**, **Delete all in app**, and a Stop button while a purge runs.

Select a live model and the panel under the list fills with what it holds, one row per attribute: the attribute's name, its value, what it holds, and the attribute's description where the model gives one. Numbers read as numbers, flags as yes or no, and a structure as its own JSON rather than as the word "object". An attribute the model declares that this live model has no value for is listed too, reading **not set**, so the panel is the model's vocabulary and not only the keys that happen to be stored. Drag the handle between the list and the panel to give either one more room.

The search box above the panel matches attribute names and values, so typing a number finds whichever attribute holds it. **Copy value** puts the highlighted attribute's value on the clipboard whole, however long it is; **Copy values** puts every value on it as indented JSON. **Internal** adds the keys the runtime keeps for itself, such as the revision counter that drives collection change pings.

:::note[Live deletes are immediate and have no undo.]
**Delete all of this model** and **Delete all in app** page through the server until nothing is left. They are not limited to what the current filters show.
:::

**Advanced.** Hand-editing of server state that has no counterpart in your project: features, policy, bulk seeding, kit deployment, and the like. It holds the older controls behind a banner and never gains a new feature.

**Issues.** Enabled once Lint has found something; lists its errors and warnings. Its tooltip tells you whether Lint has never run, came back clean, or found N errors and M warnings.

## Provenance and drift marks

After **Preview changes** has run, the model list carries two kinds of mark, always a glyph plus a word, never colour alone.

**Source** (provenance), a glyph in the gutter: a filled dot for code-synced, a half dot for code-not-pushed, a hollow ring for code-drifted, a small square for server-only, a short bar for kit-owned, and nothing until a preview has run.

**Status** (drift), a trailing word on the rows that need one: **Not on server yet**, **Changed in code**, **Only on server**, **Needs a fix**, **Cannot be checked**. A healthy app shows a plain list with an empty Status column.

Press **What do these marks mean?** on the reconcile strip for the legend. Until a preview has run, the list says "Not checked against the project yet".

![The Models tab after Preview changes: provenance glyphs and drift words on the rows that differ](/img/unreal-sdk/studio-gm-drift.png)

## Staged deletes

Marking is free: **Mark for deletion** on a model row, or on an attribute, function, or automation row inside the detail panel, reads nothing and deletes nothing. Two bulk buttons in the header mark many at once: **Mark everything only on the server**, and the more destructive **Mark everything (code-backed too, returns on next Sync)**.

:::note[A row that comes from your code cannot be marked from the Models tab.]
Deleting it on the server would only be undone by the next sync, so the control is disabled and the row says why, with an Open button to the owning class or asset. If you really want it gone from the server for now, the Advanced tab has **Delete on server (recreated by the next Sync)**.
:::

Press **Review N deletions** to open the review panel. It first runs a pre-flight that counts the live models of each marked model (the only read the whole flow does), then lists findings by severity:

- **Blocker**: a refusal Studio can predict exactly, such as live instances of a model or functions bound to it.
- **Caution**: will succeed but breaks something.
- **Info**: a documented, intended cascade.

The commit sheet shows the headline, the app, the counts, a blocked reason when the deletion cannot run, and an acknowledgement checkbox when the worst finding is a Caution. The **Delete** button cannot be triggered by Enter. The walk is sequential and stops on the first failure, showing the exact remainder; pressing Delete again finishes it, and an already-gone item reads as success.

:::caution[Deleting an Attribute orphans its stored values and every expression that names it.]
The server refuses nothing and cascades nothing for an attribute delete. Studio's pre-flight is the only guard, so read the findings before you press Delete.
:::

## Gotchas

- Preview before you look at the marks. Source and Status are unknown until a preview has run.
- Sync never deletes. Deletes are the separate, staged flow above.
- Lint and Sync are different checks. Lint finds what the server sees as broken; Preview finds what your project would change.
- The Live tab's bulk deletes ignore the filters. Read the confirmation counts.
- The values panel shows what your token may see. The server filters an attribute out by its visibility, and a filtered attribute reads as **not set** where the model declares it and is simply absent where it does not.
- **not set** and **none** are different answers. The first is an attribute with no stored value; the second is a value the live model stores as null.

## Related

- [Authoring an Effect](../game-models/authoring-effects.md), [EffectScript](../game-models/effect-script.md) and the [Effect Graph](../game-models/effect-graph.md): writing the Effects a sync pushes.
- [Containers and attributes](../game-models/containers-and-attributes.md): declaring the models and attributes a sync pushes.
- [Game Models overview](../game-models/overview.md): declaring models and reading them at runtime.
- [The Two Planes](../concepts/two-planes.md): why the schema lives on the server.
