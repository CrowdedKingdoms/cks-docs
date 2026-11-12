---
slug: deprecated
sidebar_position: 7
title: Deprecated in 2.25
description: "Every node, setting, property, recipient and asset the Unreal SDK deprecates after 2.24.0, what replaces each, and where each is still documented: the elected host and its nodes, Host Override, the Host recipient, Ownership and Mode on the entity component, the ownership-taking subsystem registration, the component's Send Event, and the Crowdy Actor Management Config asset."
---

# Deprecated in 2.25

The items in the tables after the first still exist in this release, except that **Elected Host (Deprecated)** elects nobody. Each item warns when you compile it, or is hidden from menus so new
work does not pick it up, and is removed in a later release, which will say so first. Every other page in these docs
teaches only the current way; where a page still describes a deprecated item, it does so in a section called
**Deprecated** at its end.

To find what your project uses, run the searches in the plugin's `MIGRATION.md` (section "Blueprint assets") over your
`Content` and `Plugins` folders, and build your C++ with the new version: each deprecated symbol names its replacement
in the compiler warning.

## Removed after 2.25.0

These were deprecated in 2.25 and are gone. A project that still uses one fails to compile in C++ and shows a broken node in a Blueprint. [What's Changed](./whats-changed.md) has the steps.

| Removed | Use instead | Documented |
|---|---|---|
| **Get Host User ID**, **Is Host Set**, **Crowdy Get Host ID**, `UCrowdyHostSubsystem::GetHostID` | **Get Leader User ID** on **Get Crowdy Leader Subsystem** (0 means no Leader) | [The Leader](../runtime/leader.md) |
| **Is Host** | **Is Local Leader** | [The Leader](../runtime/leader.md) |
| **On Host Elected** | **On Leader Changed**, which gives user ids, not entity ids | [The Leader](../runtime/leader.md#follow-the-leader) |
| **Is Crowdy Entity Host**, **Is Crowdy Entity Host (Server)**, `CheckEntityIsHost` | **Is Local Leader**; anything that must be enforced belongs in a Server Object | [The Leader](../runtime/leader.md) |
| **Crowdy Has Authority**, **Switch Crowdy Has Authority** | **Is Local Leader**; for a gate on a write to an entity or subsystem you own, **Switch Is Crowdy Entity Locally Owned** on that entity | [The Leader](../runtime/leader.md#checking-who-writes-an-entity) |
| **Is Crowdy Entity Locally Controlled** | **Is Crowdy Entity Locally Owned** | [The Leader](../runtime/leader.md#checking-who-writes-an-entity) |
| `UCrowdyHostSubsystem` (**Crowdy Host Subsystem**) and the setting `HostPollIntervalSeconds` | The Leader subsystem. Nothing polls for a host, so the setting has nothing to set. | [The Leader](../runtime/leader.md) |

## Who writes shared state

| Deprecated | Use instead | Documented |
|---|---|---|
| **Leader Source** set to **Elected Host (Deprecated)** | **Server Object**, the default: a Leader chosen by a Server Object type the SDK deploys. Deploy your server code once and restart its root. Elected Host elects nobody now: the Leader subsystem does not start and no client writes a World entity or a replicated subsystem. | [The Leader](../runtime/leader.md), [Deprecated](../runtime/leader.md#deprecated) |
| **Get Host ID** on the game session and the entity subsystem | **Get Leader User ID** on **Get Crowdy Leader Subsystem** (0 means no Leader) | [The Leader](../runtime/leader.md) |
| **On Host ID Updated** | **On Leader Changed**, which gives user ids, not entity ids | [The Leader](../runtime/leader.md) |
| Marking Crowdy State dirty on an entity you do not own (the host push) | Write state on the client that owns the entity, or keep it in a Server Object | [Crowdy State](../runtime/crowdy-state.md#deprecated) |

## The entity component

| Deprecated | Use instead | Documented |
|---|---|---|
| **Ownership** (`Local Client`, `Host`), **Get Ownership** | **Owned By** (`Auto`, `Player`, `World`, `Leader`), **Get Owned By**. Local Client is Player, Host is Auto. | [Entity component](../runtime/entity-component.md#settings) |
| **Mode** (`Static`, `Dynamic`), **Get Mode** | **Replicate Movement** (`Auto`, `On`, `Off`), **Replicates Movement**. Dynamic is On, Static is Off. | [Continuous state](../runtime/continuous-state.md), [Entity component](../runtime/entity-component.md#deprecated) |
| **Host Override**, **Get Host Override Policy** | No replacement. Under Server Object an owner drops every host-sourced update, so it has nothing to refuse; state that must be protected belongs in a Server Object. | [Entity component](../runtime/entity-component.md#deprecated) |
| **Send Event** on the component, `ECrowdyEventScope` | **Send Crowdy Event** with a Recipient: Everyone is Spatial Multicast, Owner Only is Owning Client | [Recipients and Routing](../runtime/recipients-and-routing.md) |

## Events and ownership

| Deprecated | Use instead | Documented |
|---|---|---|
| The **Host** recipient (`CrowdyRecipient="Host"`) | **Owning Client**, which reaches whichever client writes the entity, or a Server Function | [Recipients and Routing](../runtime/recipients-and-routing.md#deprecated) |
| **Grant Ownership To Host** | No direct replacement: keep the state in a Server Object, or make the entity **Owned By** **Leader**, which refuses grants | [Ownership transfer](../runtime/ownership-transfer.md#deprecated) |

## Replicated subsystems

| Deprecated | Use instead | Documented |
|---|---|---|
| **Register Replicated Subsystem** with its Ownership pin | **Register Crowdy Replicated Subsystem** | [Replicated subsystems](../runtime/replicated-subsystems.md) |
| An override of `GetReplicatedOwnership()` | Nothing: the bases no longer call it, and a replicated subsystem is always written by its Leader | [Replicated subsystems](../runtime/replicated-subsystems.md#deprecated) |

## Assets

| Deprecated | Use instead | Documented |
|---|---|---|
| The **Crowdy Actor Management Config** data asset | Set the same values on a map profile; nothing read the asset at runtime | [Map profiles](../runtime/map-profile.md#deprecated) |

## Related

- [What's Changed](./whats-changed.md): what changed in each release and what to do about it.
- [The Leader](../runtime/leader.md): who writes shared state now.
