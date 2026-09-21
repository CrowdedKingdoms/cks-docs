---
slug: async-actions
sidebar_position: 2
title: Blueprint Async Actions
description: "Every latent Blueprint node the SDK ships, grouped by the page that explains it, with the node's display name and the completion pins it exposes."
---

import SurfaceTable from '@site/src/components/SurfaceTable';

# Blueprint Async Actions

A Blueprint async action is a latent node: it keeps running after the graph moves on and fires one of its own exec pins when it finishes. The SDK ships 102 of them, one C++ class each, and every one is fully covered by the pages below, so this table is a lookup, not a gap list.

## When you come here

You have a node open in the graph and want the page that explains its inputs, or you remember a page and want the exact node name to search for in the palette.

The **Blueprint node** column is the title you see in the Blueprint editor, taken from the factory function's display name. The **C++ factory** column is the static function that creates the action, and the **Class** column is the C++ class behind it; you need those only for a `Cast` or a manual `Activate` call from C++, since the whole point of an async action is that Blueprint drives it. **Completion pins** lists the node's output exec pins in order, so you know which ones to wire before you drop the node.

<SurfaceTable table="async-actions" group="page" />

:::note[Every row above links forward. There is nothing left uncovered in this table.]
Coverage for this group is 102 of 102: every async action class is mentioned on the page its row links to. A class that later stops matching any page (a rename, a page deleted) reopens as a coverage gap, not a silent removal from this table.
:::

## Gotchas

- The node's display name, its factory function and its C++ class name can all differ (`Link Models` is `AddEdge` on `UCrowdyAddEdgeAction`); search the palette by the **Blueprint node** column, not the **Class** column.
- A latent node only fires its completion pins while the graph that called it is still alive. A widget removed from its parent before the call completes never sees the result.
- An async action with no ID pin operates on whatever the node's own inputs named at spawn time; it does not automatically track a Target that changes after the call starts.

## Related

- [Subsystems](./subsystems.md)
- [Delegates](./delegates.md)
- [RPC Events in Blueprint](../runtime/rpc-events-blueprint.md)
- [Game Models overview](../game-models/overview.md)
