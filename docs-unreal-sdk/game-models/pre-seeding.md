---
slug: pre-seeding
sidebar_position: 12
title: Pre-seeding Containers
description: "Create the Game Model rows a map's placed objects will bind before any client asks for them, from the editor scan and the Studio card, or at runtime from the Apply Container Manifest node, and understand app scope against session scope."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Pre-seeding Containers

A level-placed object with a Game Model container binds a server row keyed from its identity. Without pre-seeding, the first client to reach that object creates the row; with it, the rows exist before anyone arrives. The editor scans the map into a manifest, and either Studio applies it at app scope or your game applies it at runtime into a session. Nothing about how a client binds changes; only who creates the row, and when.

:::note[Since 2.14]
Pre-seeding as a whole is new in this version: the manifest scan, the Studio card, the Apply Container Manifest node, the bulk resolve of shared entities, and the per-type `CrowdyScope` and `CrowdyInstantiableBy` metas. The cooked-build identity fix at the end of this page rode in with it.
:::

## When you touch this

A village of lantern posts, a map of camps and chests, anything placed in a level whose state is server truth. Also any session game whose match map has placed containers, because that map's rows must exist inside the session.

## Two scopes

A container type's rows live in one scope, declared on the class, never per object:

| Scope | Rows exist | Declare with |
|---|---|---|
| Session (default) | Inside one Game Session; each session has its own copy under the same key. A match's chests and turrets. | nothing |
| App | For the life of the app, shared by everyone, in and out of any session. A persistent world's landmarks. | `meta = (CrowdyContainer = "Landmark", CrowdyScope = "App")` on the `UCLASS` |

A row's scope is part of its identity and the runtime never crosses scopes: a client inside a session looks only in that session, a client with none looks only in the app, and there is no fallback either way. An app-scoped type's rows are bound with no session id whatever the caller's active session is, while invokes on them still carry the session as context. Server-side enforcement, including the `CONTAINER_TYPE_APP_SCOPED` refusal, is on [Per-type scope](/game-api/game-models#per-type-scope-session-or-app).

Who may create a type's rows is the second per-type meta: `CrowdyInstantiableBy` is `Member` by default, or `Admin`, or `Owner`. It is read only by the schema sync, but it decides how the type can be seeded: bulk seeding, from Studio or from Create Game Session's seed list, needs a type that is `Admin`-instantiable or carries a bind policy. A plain `Member` type falls back to one ensure per row, which needs a player whose token may create it.

## Making an object pre-seedable

The scan lists what the runtime treats as a shared, stable, placed entity: an actor in a saved map with **Net Load On Client** on (the default for a placed actor), a Crowdy Entity Component with **Identity Policy** `Stable` (or an authored binding key) and **Ownership** `Host`, and a container declared on the actor or on a component. `ALanternPost` already is one; see [Entities, Identity, and Ownership](../concepts/entities-identity-ownership.md). A component container is a second row for the same placement, keyed from the actor, the component's class, and its name. An object that needs an authored key implements **Crowdy Binding Key Provider**; [Ensured identity](./ensured-identity.md).

A moved actor keeps its key. A copied, pasted, or duplicated one gets a new placement guid and so a new key; re-scan after editing.

## The manifest asset

The scan writes a **Crowdy Container Manifest** (`UCrowdyContainerManifest`) beside the map, named `<MapName>_ContainerManifest`, and rewrites it only when the rows changed. It holds `MapPackage`, `ScannedAt`, and `Rows`, each an `FCrowdyContainerManifestRow`:

| Field | Meaning |
|---|---|
| `TypeName` | The container type as the server knows it. |
| `BindingKey` | The 32-hex key the runtime ensure asks for. |
| `DisplayName` | The actor label, used only when the row is created. |
| `SourceActor` | The placed actor's path, for the preview and orphan reports. |
| `SourceComponent` | The component's name for a component container, empty for the actor's own row. |

Keep it under version control: it is what the runtime node reads in a cooked build. Three ways to build it, all the same scan: the Studio card's **Scan open map**, the `-run=CrowdyContainerManifest -map=<package>` commandlet in a build pipeline, and the editor scan API from code. If you ever need a key in code, derive it through `FCrowdyContainerManifestKeys` (`ActorNetID`, `KeyForNetID`, `ComponentKey`), the same functions the scan and the runtime use, and never re-implement the digest.

:::warning[Reference the manifest from a class that ships, or it is not cooked.]
An asset nothing references is left out of the package, and the runtime node receives a null manifest. A hard variable or a `TSoftObjectPtr` on the Game Instance, as the example below has, is enough.
:::

## The Studio card

On the Game Model page, the **Pre-seed containers** strip: **Scan open map**, a **Scope** picker (App, or one of the app's sessions), **Preview**, **Apply**, and **Details**. Preview reads the rows the server holds in that scope and marks each manifest row: to create, existing, or an orphan, a server row no placement claims. Orphans are reported and left alone; nothing here ever deletes a row.

![The Pre-seed containers strip after a preview: 24 manifest rows, none to create, 24 existing, no orphans](/img/unreal-sdk/studio-seed-card.png)

Studio applies with the app token, so it may create rows of any type, including `Admin`-instantiable ones. This is the place for app-scoped rows and admin-only world types. A type that is `Admin`-instantiable or has a bind policy is seeded in batches, all or nothing per batch; everything else goes through the ensure loop, one row at a time.

## Applying at runtime

A session game seeds the session itself: the client that created it (or the host) applies the map's manifest once, before the match map's objects begin play.

**Apply Container Manifest** (`UCrowdyApplyContainerManifestAction::ApplyContainerManifest(Manifest, SessionId, bAppScope)`, category **Crowdy SDK, Game Model, Containers**): `SessionId` empty means the active session, or the app when none is active; **App Scope** forces the app even while a session is active. `Succeeded` and `Failed` both carry a `Result`, an `FCrowdyApplyManifestResult` (`FCrowdyApplyManifestOutcome`): `Created`, `Existing`, `Failed`, `Unanswered`, `AppScoped` (rows of an app-scoped type, sent with no session whatever the apply named), and `Failures`, a list of `FCrowdyManifestRowFailure` with `TypeName`, `BindingKey`, `Code`, `Message`, and `bRetryable`. Exactly one pin fires, once.

The C++ twin is `UCrowdyGameModelSubsystem::ApplyContainerManifest(Manifest, SessionId, bIgnoreActiveSession, OnDone)`, where `bIgnoreActiveSession` true is what the node's App Scope means.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

The Lantern game instance holds a `TSoftObjectPtr<UCrowdyContainerManifest>` for the village map and applies it at app scope as soon as the connection is up, right before the entities start registering. The visible proof is in the trace: each post then logs its ensure as `existing` instead of `created`.

<CppSnippet id="seed-manifest" />

</TabItem>
<TabItem value="bp" label="Blueprint">

The Game Instance Blueprint needs a `VillageManifest` variable of type Crowdy Container Manifest, set to the scanned asset. At **Event Init**, the **Crowdy SDK Subsystem** getter feeds **Bind Event to On UDP Connection Success**, whose custom event `OnConnected` runs **Apply Container Manifest** with the manifest, `Session Id` empty, and **App Scope** ticked; `Succeeded` carries the `Result` counts.

<Blueprint src="seed-status" title="Event Init, Crowdy SDK Subsystem, Bind Event to On UDP Connection Success, OnConnected, Get VillageManifest, Apply Container Manifest" />

</TabItem>
</Tabs>

:::warning[A session game must create or join its session before the level's entities begin play.]
Otherwise they bind app-scoped rows and the session is empty. The natural shape works: create or join in the lobby map, then open the match map; the active session survives the travel. [Sessions](./sessions.md).
:::

:::warning[bRetryable true is the allowance or the transport; false is the type's policy.]
A retryable failure is safe to apply again, and the rows already created stand, since the apply is not transactional across rows. A non-retryable one means the type's policy refused this caller: seed it from Studio, or give the caller the right. Retrying in a loop will not change the answer. `Unanswered` above zero with no failure means the world was torn down mid-apply; apply again next time.
:::

Pacing: at most 8 rows in flight, a row retried up to 4 times with a doubling wait, and the runner parks when the shared Game API allowance is nearly spent. Every row counts against that allowance: the SDK counts every Game Model call it makes, ensures and reads included, toward the same budget it uses to widen [coalescing](./coalescing.md) windows, so a large apply also delays a coalesced effect. A large apply mid-fight still competes with gameplay for round-trip time, so apply during a loading screen.

The alternative for a session is to seed it at creation: Create Game Session's `SeedFromAppTypeNames` copies an app-scoped type's rows into the new session as it is created. That is a server request with two fields, described on [Sessions](./sessions.md) and [Seeding a session from the app](/game-api/game-models#seeding-a-session-from-the-app).

## What a client does at load

Every shared placed entity binds by bulk resolve: pending entities are grouped by type and session, each group reads the server's rows of that type page by page and binds every key it recognises, misses fall through to a single ensure (the only path that creates a row), and every container bound that way reads its state in one bulk call. A pre-seeded level reads `E ensured` = 0 in the trace.

`crowdy.gamemodel.bulkresolve` (default 1) turns the list path off at 0 and restores one ensure per entity.

:::caution[crowdy.gamemodel.bulkresolve 0 is a diagnostic switch, not a setting to ship.]
If a bind never lands, the cause is almost always a type nobody may create, or a session activated after the level's entities already registered, not the bulk path.
:::

With `crowdy.gamemodel.trace 1` on, the lines to read are `bulk resolve <Type>: listing for N pending entities`, `ensure entity <id> key <key> ... -> container <id> (created|existing)`, `container states: N call(s), M row(s)`, and `manifest apply done: created C, existing E, failed F, unanswered U`. A warning that a manifest `was scanned from <map> but this world is <other>` means the wrong manifest for this level.

## Cooked builds before 2.14

:::note[Since 2.14]
Every cooked build before this version used a path-hash identity for placed objects: the engine releases the per-placement guid before `BeginPlay` in a cooked build, and the SDK used to read it there. A cooked client and the editor derived different keys, so the cooked client always created new rows. If every object logs `ensure ... (created)` in a package but `existing` in the editor, you are on an older SDK; update. Current behaviour reads the guid at registration, before it is released.
:::

## Gotchas

- Scope is per type, in code. Mixing scopes by convenience lets one match's state leak into another.
- Do not scan an unsaved map; the scan skips dirty actors because the key a build cooks is the saved placement.
- The manifest is per map. Applying one map's manifest inside another creates rows nobody will find; the runtime warns but does not refuse.
- A type nobody may create never binds: `Admin`-instantiable without a seed is a level of objects retrying forever.
- Rows are never deleted by any of this. Orphans are a person's decision on the Live tab.

## Related

- [Ensured identity](./ensured-identity.md): the keys these rows are named by.
- [Sessions](./sessions.md): the active session, and seeding one at creation.
- [Game Models authoring](../studio/game-models-authoring.md): the page the card lives on.
- [Ensured containers on the Game API](/game-api/game-models#ensured-containers-atomic-get-or-create): the atomic get-or-create underneath.
- [Packaging](../guides/packaging.md): the cook list and the baked registry.
