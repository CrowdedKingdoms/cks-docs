---
slug: voxel-chunks
sidebar_position: 15
title: Voxel Chunks
description: "Fetch the platform's voxel chunks or keep a live voxel world around your players, read each voxel's type and state, edit voxels with every edit confirmed or taken back, place cells in your level and draw them: the nodes, what a chunk holds, how its axes map onto Unreal, failures, and what it costs."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Voxel Chunks

The platform stores a voxel world for every app: chunks of 16 by 16 by 16 cells. Mods, Server Objects, the Game API and other SDKs write them. **Fetch Chunks Around** and **Fetch Chunk** bring chunks into Unreal, decoded and ready to place, so your game can draw them, collide with them, count them or read the data a block carries.

## When you touch this

When your game shows blocks the platform holds: a build area, what a mod built, the cells another client painted. A fetch is a one-off copy. When players build together and should see each other's blocks as they are placed, use the **Crowdy Voxel World** instead (see [Keeping a live world](#keeping-a-live-world)): it keeps the chunks around your players loaded, merges everyone's edits as they happen, and sends your player's own.

## The nodes

The fetches live on the **Crowdy Voxels** subsystem (`UCrowdyVoxels`, a Game Instance subsystem). The helpers are on **Crowdy Voxel Library** (`UCrowdyVoxelLibrary`) and work with no game instance. All of them are under **Crowdy SDK > Voxels**. Your module needs `CrowdyServices` in its Build.cs.

| Blueprint | C++ | Does |
|---|---|---|
| **Fetch Chunks Around** | `UCrowdyVoxels::FetchChunksAround(int64 ChunkX, int64 ChunkY, int64 ChunkZ, int32 Range, TFunction<void(const FCrowdyChunkFetch&)> OnDone)` | Every chunk the platform stores within Range of a chunk. Latent: **On Fetched** or **On Failed** fires once. |
| **Fetch Chunk** | `UCrowdyVoxels::FetchChunk(int64 ChunkX, int64 ChunkY, int64 ChunkZ, TFunction<void(const FCrowdyChunkFetch&)> OnDone)` | One chunk, whether or not the platform stores it. Latent, like the one above. |
| **Get Voxel** | `UCrowdyVoxelLibrary::GetVoxel(const FCrowdyVoxelChunk& Chunk, FIntVector Position)` | The voxel at one position, with its type and state. |
| **Get Filled Voxels** | `UCrowdyVoxelLibrary::GetFilledVoxels(const FCrowdyVoxelChunk& Chunk)` | Every voxel of a chunk whose type is not 0, with its position, type and state. |
| **Get Chunk Origin** | `UCrowdyVoxelLibrary::GetChunkOrigin(WorldContextObject, ChunkX, ChunkY, ChunkZ)` | The chunk's minimum corner in your level. |
| **Get Voxel Size** | `UCrowdyVoxelLibrary::GetVoxelSize(WorldContextObject)` | The edge of one cell in world units: the chunk size over 16, 100 by default. |
| **World To Voxel** | `UCrowdyVoxelLibrary::WorldToVoxel(WorldContextObject, Location, ChunkX, ChunkY, ChunkZ, Position)` | The chunk a world location is in, and its cell there, each axis 0 to 15. |
| **Voxel To World** | `UCrowdyVoxelLibrary::VoxelToWorld(WorldContextObject, ChunkX, ChunkY, ChunkZ, Position)` | The centre of a cell in your level. |

The player must be signed in to the app. Fetching needs no permission key: any player of the app can read its chunks.

## How far a fetch reaches

**Range** counts chunks on every axis from the chunk you name, so 1 fetches a cube of 3 chunks on a side (27 chunks) and 2 fetches 5 on a side (125). It runs from 1 to 8, the platform's range; a value outside is clamped. **Fetch Chunks Around** leaves out a chunk the platform does not store, so an empty area answers **On Fetched** with no chunks. **Fetch Chunk** always answers its one chunk: one the platform does not store comes back empty, with **Stored** false.

:::caution
Only a chunk write (`updateChunk`, for example from a world generator or a chunk write-back) stores a chunk. Blocks placed only by single-voxel writes, such as a mod's or a hub's `set_voxels`, `updateVoxel` or a realtime voxel update, in a chunk nobody has stored do not come back from either of these two nodes: they return neither the chunk nor its edits until the chunk is stored. The live world and [Fetch Chunks In Box](#fetching-a-box) read those edits, so a chunk that has only edits loads with them.
:::

## What a chunk holds

The platform keeps two things for a chunk: a grid of 4,096 one-byte types, and a log of edits made to single voxels (a player's edit, a mod's writes, a Server Object's). An edit has a position and a type, each any signed 16-bit value, and up to 1,024 bytes of state your game gives meaning to. Each **Crowdy Voxel Chunk** in an answer has both, already combined:

| Field | Is |
|---|---|
| **X**, **Y**, **Z** | The chunk's coordinates, 64-bit. |
| **Grid** | 4,096 block types, one byte each, at index x + 16 * y + 256 * z with each of x, y and z from 0 to 15, with every edit applied that fits a cell and a byte. 0 is empty. |
| **Edits** | The chunk's per-voxel entries: the states stored with it and every recorded edit, one per position, sorted by position (z, then y, then x). Where the platform lists a position twice, the later entry is kept. This includes the voxels the grid cannot hold: a position outside 0 to 15, or a type outside 0 to 255. |
| **Stored** | True when a chunk write has stored this chunk (see the caution above). False on a chunk that the live world or Fetch Chunks In Box returned for its edits alone, over an empty grid. |
| **Edits Truncated** | True when the platform cut the edits it sent, so the chunk is incomplete. The platform applies at most 65,536 edits for **Fetch Chunk**, and 262,144 across one request of **Fetch Chunks Around**, so a heavily edited neighbourhood is cut sooner than one chunk alone would be. The SDK has no node yet for reading the rest of a chunk's edit log. |

You never apply edits yourself. Use **Get Voxel** for one position and **Get Filled Voxels** for all of them: both take an edit over the grid, return the edit's state, and include the voxels the grid cannot hold. A grid cell whose edit has a type wider than a byte reads 0 in **Grid**, so read it through the helpers, not the grid alone.

Each **Crowdy Voxel** has a **Position** (in the chunk's own X, Y and Z), a **Type** and its **State** bytes, empty when it has none. In Blueprint, **State** is a byte array; decode anything structured in C++. Types mean whatever your game decides. Keep one table from type to look that you use everywhere; a game on 16 by 16 by 16 chunks with up to 255 block types never needs anything outside the grid.

## Where a cell is in your level

Chunk (x, y, z) is the chunk the SDK puts an actor in when it stands at that spot, so voxels and players agree on where they are. A voxel's position is Unreal X, Y and Z, z up, with no axis swapped. Its centre is:

**Get Chunk Origin** + (position + 0.5) * **Get Voxel Size**

which is what **Voxel To World** returns. At the default chunk size of 1600 units a cell is 100 units, and cell (1, 2, 3) of chunk (0, 0, 0) is centred at (150, 250, 350). **World To Voxel** goes the other way, from a location to its chunk and cell.

:::note
Content built where y is up, such as the web Construct's starter mods, has its height along Unreal +Y here. The data is the same; draw it as it is, or author for z up.
:::

## Fetching and drawing

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`ShowBlocksAround` fetches the chunks within two of the lantern's chunk. `AddChunkBlocks` adds one cube instance per filled voxel of a chunk to an Instanced Static Mesh component, all in one call.

<CppSnippet id="voxel-chunks-read" />

</TabItem>
<TabItem value="bp" label="Blueprint">

A custom event, **ShowBlocksAround**, finds the lantern's chunk with **World To Voxel** and calls **Fetch Chunks Around** with **Range** 2. **On Fetched** clears the cubes drawn last time with **Clear Instances**, then loops over the chunks and hands each to **Add Chunk Blocks**, the C++ function above.

<Blueprint src="voxel-chunks-read" title="ShowBlocksAround, Get Actor Location, World To Voxel, Fetch Chunks Around, Clear Instances, For Each Loop, Add Chunk Blocks" />

:::caution
Do not loop over every cell in Blueprint. A For Each Loop evaluates the pure node that feeds its Array, such as **Get Filled Voxels**, again on every pass, so a solid chunk costs thousands of scans and can trip the engine's runaway-loop limit. Do the per-cell work in one C++ function, as **Add Chunk Blocks** does.
:::

</TabItem>
</Tabs>

## Fetching a box

**Fetch Chunks Around** reads a cube. For any other shape, such as one layer of chunks or a long strip, ask for the box itself with `UCrowdyVoxels::FetchChunksInBox(Corner, OppositeCorner, OnDone, Cancelled)`. It is C++ only; there is no Blueprint node.

- Both corners are included, in either order, and the box holds at most 4,913 chunks (17 on a side). A larger box answers **Failed**.
- A chunk the platform never stored but holds edits for comes back with **Stored** false and those edits over an empty grid. A chunk with neither is left out.
- `Cancelled` is an optional shared bool. Once it is true nothing more is asked for and `OnDone` never runs, so a read for an area the player has left costs no more requests.

`ShowBlocksInSlab` fetches one layer of 9 by 9 chunks around the lantern and draws it as above. Each call cancels the read before it through `SlabRead`, and so does `EndPlay`, so a slab the lantern has left never redraws.

<CppSnippet id="voxel-chunks-box" />

## Keeping a live world

The **Crowdy Voxel World** (`UCrowdyVoxelWorld`) is a World subsystem: one per level, under **Crowdy SDK > Voxels**. Tell it which actors to follow and it keeps the chunks around them loaded, applies other players' edits as they arrive, and shows your player's own edits at once while it sends them.

| Blueprint | C++ | Does |
|---|---|---|
| **Follow** | `Follow(AActor* Actor, int32 Range)` | Keeps every chunk within Range (1 to 7) of the actor's chunk loaded and unloads what falls past Range + 1. Several followed actors load the union. Call it any time, even before sign-in. |
| **Stop Following** | `StopFollowing(AActor* Actor)` | A destroyed actor stops being followed by itself. |
| **Is Chunk Loaded**, **Is Chunk Live** | `IsChunkLoaded(X, Y, Z)`, `IsChunkLive(X, Y, Z)` | Live means loaded, within 8 chunks of your player's actor, and fetched again after the connection settled, so other players' edits there reach you as they happen. |
| **Is Chunk In Reach** | `IsChunkInReach(X, Y, Z)` | True when the chunk is within 8 chunks of your player's own chunk on every axis, loaded or not, so an edit there reaches the players near it as it happens. False until your player's chunk is known. |
| **Get Voxel** | `GetVoxel(X, Y, Z, Position)` | What your player sees at a cell: their own edit still waiting for its answer, else the confirmed voxel. |
| **Find Chunk** | `FindChunk(X, Y, Z, Chunk)` | A copy of a loaded chunk as your player sees it. It copies the whole chunk, so read single cells with **Get Voxel**. |
| **Set Voxel**, **Set Voxels** | `SetVoxel(const FCrowdyVoxelWrite&)`, `SetVoxels(...)` | Shows the edit at once, sends it, and returns its edit id (never 0). |
| (C++ only) | `ForEachFilledVoxel(X, Y, Z, Visit)` | Calls Visit for every cell of a loaded chunk with a type of 1 to 255, in index order, with no copy. Use it to build or rebuild a chunk's cubes. |
| (C++ only) | `ForEachLoadedChunk(Visit)` | Calls Visit for every chunk loaded now, so a renderer that starts after chunks have loaded can draw them; later loads arrive as **On Chunk Loaded**. |

Its events, each on the game thread:

| Event | Fires |
|---|---|
| **On Chunk Loaded**, **On Chunk Unloaded** (`OnChunkLoaded`, `OnChunkUnloaded`, each an `FOnCrowdyVoxelChunk` with `ChunkX`, `ChunkY`, `ChunkZ`) | Once per chunk as it comes and goes. A chunk's first contents arrive here, not through **On Chunk Changed**, so draw on both. |
| **On Chunk Changed** (`OnChunkChanged`, an `FOnCrowdyVoxelChunkChanged`: X, Y, Z, Positions) | At most once a frame per chunk, naming every cell whose value as your player sees it changed, whoever changed it. Redraw that chunk, or only those cells. |
| **On Edit Done** (`OnEditDone`, an `FOnCrowdyVoxelEditDone`: Edit Id, Write, Result, Message) | Exactly once per edit id, never inside the **Set Voxel** call. |

When a hub or a mod writes a whole chunk, the platform tells the clients near it, and the world fetches the chunk again by itself, at most once a frame. **On Chunk Changed** then names the cells that differ and **On Chunk Loaded** does not fire a second time.

### An edit's life

1. **Set Voxel** checks the write. A chunk that is not loaded, a position or type wider than 16 bits, or state over 1,024 bytes ends it **Failed**; no realtime connection ends it **Not Signed In**. Either way nothing is shown or sent.
2. Otherwise the cell shows the new value at once and **On Chunk Changed** names it, even when the value is the same as before.
3. The edit is sent: at most 100 a second, so voice, movement and video keep room under the platform's 500 messages a second per player. A long **Set Voxels** queues the rest, already shown.
4. **On Edit Done** reports how it ended, always after the **On Chunk Changed** that showed it:

| Result | Means | The cell then shows |
|---|---|---|
| **Ok** | The platform applied it and said so. | The edit, now confirmed. |
| **Refused** | The platform refused it, usually because your player may not build there; the message names the code. | The newest value anyone else committed, never a value saved from before your edit. The chunk is fetched again to settle it. |
| **No Answer** | Nothing came back within a second, or the connection dropped while it waited. The platform may have applied it or not. | Whatever a fresh fetch of the chunk says, which settles it either way. |
| **Not Signed In** | The connection dropped before it was sent. | The value before it, unchanged. |

Your player's edits to one cell are answered one by one, and the newest waiting one is what **Get Voxel** shows. An edit that is refused or unanswered is put back after its **On Edit Done**, so a listener sees the reason first and the cell change after.

:::caution
A live edit reaches only players within 8 chunks of the player who made it; everyone else sees it the next time they fetch that chunk. So a player may edit a chunk far away: **Set Voxel** sends it and **On Edit Done** says **Ok**, but players already near that chunk keep the old cell until they fetch it again. To allow only edits that nearby players see live, check **Is Chunk In Reach** before **Set Voxel**. A chunk loaded further than 8 chunks from your own player stays as it was fetched until it comes back within reach, when the world fetches it again. A player's first edit in a chunk the platform never stored survives a reload: the world reads the chunk's recorded edits along with it.
:::

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`BuildAround` binds the world's events and follows the lantern at range 1. A chunk's first contents arrive as **On Chunk Loaded**, not **On Chunk Changed**, so it binds that too, and **On Chunk Unloaded** redraws a chunk as empty. `RedrawChunk` rebuilds one chunk's cubes from `ForEachFilledVoxel`, each chunk in its own Instanced Static Mesh component so a change touches only its own chunk. `PlaceBlock` sets a cell of the lantern's chunk, and `HandleEditDone` logs why an edit did not land.

<CppSnippet id="voxel-world-live" />

</TabItem>
<TabItem value="bp" label="Blueprint">

**BuildAround** gets the **Crowdy Voxel World**, binds **On Chunk Loaded** and **On Chunk Unloaded** to one event that calls **Redraw Chunk** (the C++ function above), binds **On Chunk Changed** the same way, and binds **On Edit Done** to print the message when **Result** is not **Ok**. Then it calls **Follow** with **Self** and **Range** 1.

<Blueprint src="voxel-world-live" title="BuildAround, Crowdy Voxel World, Bind Event to On Chunk Loaded, Bind Event to On Chunk Unloaded, OnChunkLoadedOrUnloaded, Redraw Chunk, Bind Event to On Chunk Changed, OnBlocksChanged, Redraw Chunk, Bind Event to On Edit Done, OnEditDone, Equal, Branch, Print String, Follow" />

**PlaceBlock** finds the lantern's chunk with **World To Voxel**, makes a **Crowdy Voxel** with the cell and type, wraps it in a **Crowdy Voxel Write** with that chunk, and calls **Set Voxel**.

<Blueprint src="voxel-world-place" title="PlaceBlock, Crowdy Voxel World, Get Actor Location, World To Voxel, Make Crowdy Voxel, Make Crowdy Voxel Write, Set Voxel" />

</TabItem>
</Tabs>

### What the live world costs

- **Loading** reads each missing chunk once, as boxes of at most one page (32 chunks), several read side by side. Crossing into a new chunk reads only the new slab; a loaded chunk is read again only after a reconnect, when it comes back within reach, when the platform replaces it as a whole, or to settle an edit.
- **Each live edit** is applied where it lands, in the chunk's grid and its sorted edits. **Get Voxel** is a lookup; with your own edits waiting it also checks those, which stay few at 100 a second.
- **Memory** is a full chunk per loaded chunk: 4 KiB of grid plus its edits. Range 7 loads up to 3,375 chunks, about 14 MB before edits; follow the smallest range you draw.
- **On Chunk Changed** builds one array per changed chunk per frame; bind it only where you redraw.

### Reloading a chunk

A mod's and a hub's writes reach players near the chunk live: single-cell writes arrive as voxel updates, and a whole-chunk write as one notice, after which the world fetches the chunk again (see above). Live events can be lost, and a player farther away gets an edit only from the next fetch, so the world can still hold an older copy. **Reload Chunk** (`UCrowdyVoxelWorld::ReloadChunk(ChunkX, ChunkY, ChunkZ, OnDone)`, under **Crowdy SDK > Voxels**) fetches one loaded chunk again and merges it the way every fetch is merged, under your player's own waiting edits. Use it after you know a mod or a hub wrote the chunk, for example when a [mod](./mods.md#what-a-mod-is-for) that builds on its plot says so in a call's reply, or when a player asks for a refresh.

It is latent: **On Done** or **On Failed** fires once, on a later frame, never inside the call.

- **On Done** fires when a fetch that began after your call has merged. **On Chunk Changed** has already named every cell it changed, so a redraw bound to it has run by then. A chunk that did not change fires nothing there.
- **On Failed** fires when the chunk is not loaded, the connection dropped, the fetch failed, or no fetch completed within 30 seconds. In C++ the callback gets a result other than **Ok** and a **Message**. A chunk that is not loaded is not loaded by this call: [Follow](#keeping-a-live-world) an actor near it first.
- If the world ends first, neither pin fires and the callback is dropped without running.

A mod that writes on a timer may write after your fetch has been read. Reload again when the mod tells you it wrote, rather than once at the start.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`ReloadPlot` finds the workshop's chunk with **World To Voxel** and reloads it, so the plot shows every block written there even if the live world missed one. It logs the reason when a reload does not happen.

<CppSnippet id="reload-chunk" />

</TabItem>
<TabItem value="bp" label="Blueprint">

**ReloadPlot** finds the workshop's chunk with **World To Voxel** and calls **Reload Chunk**. **On Failed** prints **Message**. **On Chunk Changed**, bound in **BuildAround** above, redraws what changed.

<Blueprint src="reload-chunk" title="ReloadPlot, Get Actor Location, World To Voxel, Reload Chunk, Print String" />

</TabItem>
</Tabs>

It costs one chunk fetch, the same as one chunk of a **Fetch Chunk**.

## When a fetch fails

**On Failed** gives the result and a message. Nothing from a failed fetch is returned.

| Result | Means |
|---|---|
| **Not Signed In** | The player has no app token yet. Fetch after sign-in completes. |
| **Refused** | The platform answered with an error; the message starts with its code. |
| **Failed** | The request did not complete: no connection, a timeout, the app changed while it was in flight, or a box of more than 4,913 chunks. |
| **Bad Reply** | The answer held something the platform never sends: a malformed chunk or state, an answer nested too deeply for the SDK's JSON guard, a position or type wider than 16 bits, state over 1,024 bytes, more chunks than were asked for, or a different chunk than **Fetch Chunk** asked for. None of it is returned. |

A fetch that cannot start (no token, no API client) answers before the call returns.

A chunk that appears on two pages of a fetch is kept once. A chunk first stored while a fetch runs may still be missing from its answer; fetch again for it.

## What it costs

- **One request per 32 chunks.** A fetch of range 2 is up to four requests, one after another, and answers once with all of them. Range 8 can be over a hundred; fetch the smallest range that covers what you draw. **Fetch Chunk** is one request.
- **Each answer is handled on the game thread** when it arrives: parsed, checked, and decoded into chunks without building an Unreal JSON tree. Measured on a desktop CPU with made-up data, a whole fetch of 125 dense chunks took about 2 ms with no edits, about 26 ms with 256 recorded edits per chunk (2.7 MB of answer), and about 87 ms when each of those edits also carried 64 bytes of state (5.4 MB). One chunk at the platform's limit of 65,536 edits took about 110 ms, and the worst single page, 32 chunks carrying 262,144 edits between them (16.7 MB), about 0.45 seconds. Decoding grows in step with the number of edits, between 0.1 and 0.4 microseconds each; most of the rest is parsing the answer.
- **Edits cost the most,** and state more than type alone: each edit with state keeps its own copy of its bytes.
- **Fetch Chunk downloads its chunk's LOD data and chunk state,** which it does not return, so a chunk with LODs costs far more bandwidth than its voxels. **Fetch Chunks Around**, Fetch Chunks In Box and the live world select only each chunk's coordinates, voxels and states.
- **Get Voxel** searches the sorted edits, so it is cheap at any count. **Get Filled Voxels** allocates one array per chunk; for a large area, read **Grid** directly in C++ and skip the 0 bytes, then add the voxels in **Edits** the grid cannot hold.
- **The Blueprint nodes copy their chunks** into their output pins. C++ callers get them by reference.

## From C++

`FetchChunksAround`, `FetchChunksInBox` and `FetchChunk` run `OnDone` once on the game thread, unless the game instance ends first, and before they return when the fetch cannot start. `UCrowdyVoxels::PageSize` (32) is the chunks one request asks for. The types behind the nodes:

| Type | Is |
|---|---|
| `FCrowdyVoxelChunk` | `X`, `Y`, `Z` (`int64`), `Grid` (`TArray<uint8>`, 4,096), `Edits` (`TArray<FCrowdyVoxel>`, sorted by position; the helpers rely on that order and on `Grid` agreeing with it, so treat a fetched chunk as a read-only snapshot and fetch again for a fresh one), `bStored` and `bEditsTruncated` (`bool`). |
| `FCrowdyVoxel` | `Position` (`FIntVector`, each axis a 16-bit value), `Type` (`int32`, a 16-bit value) and `State` (`TArray<uint8>`, up to 1,024 bytes). Writable from Blueprint, so a write can be made there. |
| `FCrowdyVoxelWrite` | `ChunkX`, `ChunkY`, `ChunkZ` (`int64`) and `Voxel` (`FCrowdyVoxel`): one edit for **Set Voxel**. |
| `FCrowdyChunkFetch` | `Result`, `Chunks` (in the platform's order; exactly one from `FetchChunk`) and `Message`. |
| `ECrowdyVoxelResult` | `Ok`, `NotSignedIn`, `Refused`, `Failed`, `BadReply`, `NoAnswer` (an edit only). |
| `UCrowdyVoxelWorld` | The live world. `EditsPerSecond` (100), `AnswerTimeoutSeconds` (1), `SettleSeconds` (5) and `LiveReach` (8) are its fixed numbers. |
| `UCrowdyFetchChunksAround`, `UCrowdyFetchChunk` | The two nodes. C++ calls the subsystem instead. |
| `UCrowdyReloadChunk` | The **Reload Chunk** node; C++ calls `UCrowdyVoxelWorld::ReloadChunk`. Its pins use `FCrowdyVoxelReloadAsyncResult` (`Result`, `Message`). |
| `FCrowdyChunksFetchedAsyncResult`, `FCrowdyChunkFetchedAsyncResult` | The delegate types of the nodes' pins: `Chunks` or `Chunk`, `Result` and `Message`. |
