---
slug: sdk-surface
sidebar_position: 12
title: SDK Surface Manifest
description: "What sdk-surface.json is, how it stays current, the groups it reports and what each one holds, and how the reference tables and this documentation set's own completeness check both read from it."
---

# SDK Surface Manifest

`sdk-surface.json` is a committed, machine-readable inventory of every reflected symbol the plugin ships: every Blueprint-callable function, delegate, subsystem, struct, enum, setting, console variable, and metadata key, plus a few groups of plain C++ types with no Blueprint exposure at all. Every table elsewhere in this reference section is generated from it. Come here to script against the surface directly, an audit of your own project's usage, a code generation tool, or an agent checking whether a symbol exists before it goes looking through headers, rather than to read a rendered table.

## Where to get it

[`/helpers/unreal-sdk/sdk-surface.json`](pathname:///helpers/unreal-sdk/sdk-surface.json). It ships alongside this site's other machine-readable files and is regenerated as the SDK changes, so a fresh copy always describes a specific SDK release rather than "whatever is newest."

Three fields sit above the groups: `generated`, the export timestamp; `sdk_version`, the SDK release this snapshot describes; and `source_root`, the header directory it was built from. Check `sdk_version` first if something here looks wrong against a copy you pulled yourself.

:::note[If the sdk_version in your own copy does not match this page's, the tables on this site and this page's counts are both describing a different release than yours.]
Regenerate your understanding from the file you have rather than patching around a mismatch; the groups below can gain or lose rows between releases.
:::

## The groups

| Group | What it holds |
| --- | --- |
| `functions` | Blueprint-callable and pure functions, with their owning class, module, category, and display name. |
| `delegates` | Blueprint-assignable dynamic multicast delegates, with their owning class and signature type. |
| `async_actions` | Latent Blueprint nodes: the class, its factory function names (the node's display name is on the matching `functions` entry), and the completion pins it exposes. |
| `subsystems` | Game Instance and World subsystem classes. |
| `structs` | BlueprintType `USTRUCT`s. |
| `enums` | BlueprintType `UENUM`s. |
| `settings` | Properties on the SDK's developer-settings classes, each marked as one you set or one Config Sync writes for you. |
| `cvars` | Console variables, split into trace gates, behavior switches, and one-shot commands. |
| `meta_keys` | The `UFUNCTION`/`UPROPERTY` metadata marker keys: `CrowdyEvent`, `CrowdyState`, `CrowdyContainer`, and the rest. |
| `log_categories` | Log categories with their module and header. The trace-variable pairing on the log categories page is derived from `cvars` by the site's table generator, not stored here. |
| `cpp_types`, `cpp_functions`, `cpp_delegates`, `cpp_macros` | Plain C++ types, methods, delegates, and macros with no Blueprint exposure at all: internal to the plugin, not something a game calls directly. Most of what these four groups report belongs to the vendored networking bridge, the plugin's own wire and JSON helpers, or editor-only tooling. |

The first ten groups are Blueprint's own reflected surface, the one a game actually reaches. The last four exist in the manifest because the export walks the plugin's headers exhaustively, not because a game is meant to build against them.

## How a symbol counts as documented

This documentation set's own completeness check reads every page under the Unreal SDK section and asks, for each symbol in the manifest, whether that symbol's name appears anywhere as a whole word. A row in one of this reference section's generated tables satisfies the check exactly like a paragraph of prose does; the check has no notion of "the one canonical page" for a symbol, only whether it is mentioned somewhere at all.

That also means a name typed once, anywhere, technically counts, so treat the check as a floor, not a guarantee that every symbol got a real explanation. A small number of symbols the manifest reports are deliberately left off every table and every page: internal plumbing behind a documented subsystem, a class the SDK itself has deprecated, editor-only tooling, or a symbol that belongs to a different first-party module riding in the same plugin build rather than to this SDK's own contract. Those are tracked in an exceptions list (`scripts/unreal-surface-allowlist.json` in the documentation repository, not published beside the manifest) alongside the reason, so an absence from this site is either "here, just not in prose" or "excluded, and here is why," never a silent gap.

## Gotchas

- The manifest is exhaustive over the plugin's own headers, with one known exporter gap in this release: two BlueprintType enums with braces inside their bodies (`ECrowdyMessageType`, `ECrowdyErrorCode`) appear only under `cpp_types`, not `enums`. Otherwise a symbol you cannot find in it does not exist in this SDK version; that is an answer, not a reason to grep the source.
- The four raw C++ groups (`cpp_types`, `cpp_functions`, `cpp_delegates`, `cpp_macros`) are not a promise of a stable public API. They are what the export sees, not what the SDK commits to keeping.
- A symbol's presence in the manifest says nothing about whether it is a good idea to use. The exceptions list marks deprecated symbols for exactly this reason.

## Related

- [Subsystems](./subsystems.md), [Async actions](./async-actions.md), [Delegates](./delegates.md), [Console variables](./console-cvars.md), [Project settings](./project-settings.md): the generated tables built from this manifest.
- [RPC metadata keys](./rpc-meta-keys.md), [Crowdy State metadata keys](./state-meta-keys.md), [Game Model metadata keys](./game-model-meta-keys.md): the `meta_keys` group, split by where each key is legal.
- [Log categories](./log-categories.md): the `log_categories` group.
- [Enums](./enums.md): the `enums` group.
