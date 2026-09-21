---
slug: game-model-meta-keys
sidebar_position: 8
title: Game Model Metadata Keys
description: "The metadata that binds a UCLASS to a Game Model container and a UPROPERTY to one of its attributes on the server-authoritative truth plane."
---

import SurfaceTable from '@site/src/components/SurfaceTable';

# Game Model Metadata Keys

This page lists the metadata that declares a Game Model container type and its attributes on the
server-authoritative truth plane. A property lives in exactly one plane, so a variable is either
`CrowdyState` or `CrowdyModel`, never both. See [Game Models overview](/unreal-sdk/game-models/overview) for
the plane itself.

Come here for the exact key names, their accepted values and defaults, and where each one is legal: a
`UCLASS`, a `UPROPERTY`, or a struct.

:::note[A variable marked `CrowdyModel` and one marked `CrowdyState` on the same property are mutually
exclusive. Hand-written C++ that carries both is rejected at discovery, and Blueprint's unified "Crowdy
Replication" dropdown never lets you set both at once.]
:::

## Every name in the header

One header declares every Game Model key, plus two asset-registry tags the editor writes and two reserved
server names. The **Where** column says which is which; the sections below explain the authorable ones.

<SurfaceTable
  table="meta-keys"
  filter="owner=CrowdyGameModelMetaKeys"
  columns={["key", "symbol", "header"]}
  notes={{
    CrowdyContainer: "UCLASS, required",
    CrowdyScope: "UCLASS",
    CrowdyInstantiableBy: "UCLASS",
    CrowdyPullOnStart: "UCLASS",
    CrowdyContainerTest: "UCLASS, SDK test marker",
    CrowdyTestFixture: "UCLASS, SDK test marker",
    CrowdyModel: "UPROPERTY, required on each attribute",
    CrowdyKey: "UPROPERTY",
    CrowdyVisibility: "UPROPERTY",
    CrowdyScan: "Asset-registry tag, written by the editor on save, never authored",
    CrowdyContainerType: "Asset-registry tag, written by the editor on save, never authored",
    "__crowdy_netid": "Reserved server key",
    "crowdy_rev": "Reserved server key",
    "__crowdy_touch_": "Reserved function-name prefix"
  }}
  notesLabel="Where"
/>

## UCLASS keys

These go on the container class itself, the `UCLASS(meta=(...))` line.

`CrowdyContainer` takes the container type name as its value (`meta=(CrowdyContainer="LanternFuel")`) and is
required; it is the marker and the name in one. The name is what this class maps to on the server. Legal
place: `UCLASS` only.

`CrowdyScope` takes `"Session"` (default) or `"App"` and controls where rows of this type live. It is baked
for cooked builds. A Blueprint-only container type cannot declare this key: the Blueprint compile hook
stamps only the container tag and pull-on-start, so an app-scoped container needs a C++ base class.

`CrowdyInstantiableBy` takes `"Member"` (default), `"Admin"`, or `"Owner"` and says who may create rows of
this type on the server. It is read only by the Studio schema sync, never by the runtime client.

`CrowdyPullOnStart` overrides the default fetch behavior. Absent, the container fetches its server state
once as soon as it binds; the only value that changes anything is `"False"`. It is read through the baked
registry in cooked builds, the same as `CrowdyScope`.

`CrowdyContainerTest` and `CrowdyTestFixture` are both key-only markers with no value. `CrowdyContainerTest`
flags a test-only container fixture, which the Studio schema sync's class gather skips so a fixture never
reaches a live app on "Sync Schema from Code." `CrowdyTestFixture` flags an SDK test fixture class, filtered
out of the heartbeat advisory and the registry baker's sweep.

## UPROPERTY keys

These go on an individual attribute, the `UPROPERTY(meta=(...))` line.

`CrowdyModel` takes no value and is required on every server-authoritative attribute ("Server Owned" in the
Blueprint dropdown). Legal place: `UPROPERTY` only, never `UCLASS`.

`CrowdyKey` overrides the server property key that would otherwise be the lowercased property name. It lets
you keep a server key stable across a Blueprint rename, or deliberately author a same-key collision that the
discovery duplicate-key guard then rejects.

`CrowdyVisibility` takes `"public"` (default), `"owner"`, or `"hidden"`. It is consumed by the schema sync's
property definition only; the runtime cache and `OnRep` path do not read it.

The OnRep key is shared with the view plane rather than duplicated here: a Game Model attribute's notify
function is named with `CrowdyOnRep`, the same key, the same header, and the same parameterless
`ProcessEvent(nullptr)` mechanism as [Crowdy State's `CrowdyOnRep`](./state-meta-keys.md). There is no
Game-Model-specific OnRep key.

Game Models have no heartbeat key of their own. Durable, late-join state is the server's job here, not a
keyframe re-send, so `CrowdyHeartbeat` stays a Crowdy State key; see
[state metadata keys](./state-meta-keys.md).

:::warning[`CrowdyContainer` and the attribute-level keys above are read live only in the editor. A cooked
build strips this metadata, and a packaged runtime reads the baked attribute table instead. Never call
`HasMetaData` at runtime for Game Model routing.]
:::

:::warning[An empty `CrowdyKey` override is ignored, not honored as "no server key." The property falls back
to its lowercased name, so `meta=(CrowdyKey="")` does not do what it looks like.]
:::

:::warning[A `CrowdyModel` attribute whose resolved key is `crowdy_rev` is a collision the schema sync
reports as an error, because `crowdy_rev` is reserved (see below).]
:::

## Asset-registry tags

`CrowdyScan` and `CrowdyContainerType` are not metadata you author. The editor writes both onto a Blueprint
asset's registry tags on save (`CrowdyScan` records that the asset has been described; `CrowdyContainerType`
names the container type its compiled class declares, if any), and the Studio schema scan reads them so it
can answer for an asset without loading it. Nothing in your code sets or reads either.

## Other keys in the same header

`CrowdyEntity`, declared beside the universal `CrowdyEvent` marker in a different header, is unrelated to
Game Models: it stamps a `UCLASS` whose component list contains a `UCrowdyEntityComponent`, marking it as an
entity type. See [Entities, identity, and ownership](/unreal-sdk/concepts/entities-identity-ownership)
rather than looking for it here. The same header's `CrowdyPersistent` and `CrowdySingleton` struct tags
belong to the deprecated persistence subsystem, not to Game Models; see the Persistence section of
[What's Changed](../guides/whats-changed.md#persistence).

## Reserved names

Three names are not authorable meta key values; they are constants the runtime already uses, and an
authored key or function should never collide with them.

`__crowdy_netid` is reserved and unused by the runtime today. It is kept reserved anyway so no authored key
can collide with it later.

`crowdy_rev` is the reserved server property key that every collection touch bumps. See the third warning
above for what happens when a `CrowdyKey` override resolves to it by accident.

`__crowdy_touch_` is the reserved prefix of the per-type function the SDK provisions to bump `crowdy_rev`
after a collection edge changes; one exists per container type. Do not name a function of your own with
that prefix.

## Gotchas

- A property is either `CrowdyState` or `CrowdyModel`. There is no third state, and no property is both.
- `CrowdyKey` lets you author a duplicate key on purpose, which the discovery guard then rejects; an empty
  override is not a way to opt out of having a server key.
- `CrowdyScope` and `CrowdyInstantiableBy` are new in 2.14.0; a project on 2.13.0 or earlier does not have
  them.

## Related

- [Game Models overview](/unreal-sdk/game-models/overview)
- [Containers and attributes](/unreal-sdk/game-models/containers-and-attributes)
- [State metadata keys](./state-meta-keys.md)
- [RPC metadata keys](./rpc-meta-keys.md)
