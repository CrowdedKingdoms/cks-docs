---
slug: log-categories
sidebar_position: 11
title: Log Categories
description: "Every LogCrowdy<X> category the SDK ships, which module owns it, which crowdy.<area>.trace CVar (if any) gates its informational lines, and which categories are absent from a packaged build."
---

import SurfaceTable from '@site/src/components/SurfaceTable';

# Log Categories

The SDK logs under 11 `LogCrowdy<X>` categories, one or more per module. Two knobs control what you see:
the category's own log verbosity, which is native Unreal and free, and the paired `crowdy.<area>.trace`
CVar, which is a one-line switch for that area's extra informational stream. The two are independent: a
trace CVar gates SDK trace lines that print at `Log` verbosity, and `Log <Category> Verbose` reveals the
engine-style lower-level lines the module also emits. Raising verbosity never turns a trace gate on; turn
on both when you need the full picture for one area.

## When you land here

You want to raise verbosity on a category by name, or you are trying to work out why a category's lines
never show up in a packaged build.

## Reading the table

A row badged **Editor only** belongs to a module that is not in a cooked build. `LogCrowdyEditor` and
`LogCrowdyStudio` are editor-module categories, present only in the editor process. `LogCrowdyNodes`
belongs to an `UncookedOnly` module: present in the editor and in an uncooked `-game` launch, absent from
every cooked build, Development or Shipping alike.

<SurfaceTable
  table="log-categories"
  includeEditor
  notes={{LogCrowdyReplication: "Entity tracking, actor pool churn, and Crowdy State replication all log under this plain category rather than one of their own; narrow with the trace CVar before you read it."}}
/>

```text
Log LogCrowdyRPC Verbose
```

For a problem that happens before the console is available, pin the verbosity in `DefaultEngine.ini`:

```ini
[Core.Log]
LogCrowdyReplication=Verbose
```

:::note[Warnings and errors are never gated behind a trace CVar.]
They always print under their module's category regardless of the trace setting. Turning a trace CVar off
only silences the extra informational lines.
:::

:::warning[Never log a bearer token or other secret material.]
`crowdy.studio.trace`'s own logging never includes the bearer token; follow the same rule for any logging
you add around SDK calls.
:::

`CKSharedTypes` has no active logging of its own; do not go looking for a `LogCrowdyShared` category, it
does not exist.

## Gotchas

- `LogCrowdyNodes`, `LogCrowdyEditor`, and `LogCrowdyStudio` are the three categories badged **Editor
  only** above. None is in a cooked build; `LogCrowdyNodes` is additionally present in an uncooked `-game`
  launch, where the other two are not.
- `LogCrowdyCpp` has no paired trace CVar. Its only diagnostic is running `crowdy.cpp.selftest`.
- A category with two or more paired trace CVars (`LogCrowdyNet`, `LogCrowdyReplication`, `LogCrowdyRPC`,
  `LogCrowdyServices`) mixes those areas' lines together; narrow with the trace CVar first, then read the
  category. The two `.scopes` CVars are Insights CPU scopes and write no log line, so they pair with no
  category.
- Set a category back to its default verbosity when you are done; leaving several at `Verbose` adds volume
  that makes the next real problem harder to spot.

## Related

- [Console variables](./console-cvars.md): the `crowdy.<area>.trace` CVars this page's pairing points at.
- [Testing locally](../guides/testing-locally.md): the workflow that replaces the old debugging and
  logging guide.
- [Project settings](./project-settings.md): the settings classes alongside this CVar and log surface.
