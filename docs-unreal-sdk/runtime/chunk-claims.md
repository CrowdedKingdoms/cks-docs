---
slug: chunk-claims
sidebar_position: 16
title: Chunk Claims
description: "Let players claim a chunk of the voxel world as their own, give it back, find who has claimed what, and check whether a player may build in a chunk: the nodes, what a claim grants, each result, and what a search costs."
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Chunk Claims

A player can claim one chunk of the voxel world at a time, as often as you let them. A claimed chunk is theirs: only they can build in it, and it stays theirs until they give it back. **Claim Chunk**, **Release Claim** and **Find Claims** do this from Unreal, and **Can Edit Chunk** and **Get Grid Permissions** tell you whether a player may build in a chunk.

## When you touch this

When your game gives players land: a plot to build on, a base, a stall. The claim is the platform's own record, so other players' edits in a claimed chunk are refused whatever their client does. Pair it with the [Crowdy Voxel World](./voxel-chunks.md#keeping-a-live-world) to let the owner build there.

## The nodes

They live on the **Crowdy Claims** subsystem (`UCrowdyClaims`, a Game Instance subsystem), under **Crowdy SDK > Claims**. Your module needs `CrowdyServices` in its Build.cs. Each is latent: **On Done** or **On Failed** fires once, never inside the call.

| Blueprint | C++ | Does |
|---|---|---|
| **Claim Chunk** | `UCrowdyClaims::ClaimChunk(int64 ChunkX, int64 ChunkY, int64 ChunkZ, TFunction<void(const FCrowdyChunkClaim&)> OnDone)` | Claims one chunk for the signed-in player. **On Done** gives the new claim's **Grid Id**. |
| **Release Claim** | `UCrowdyClaims::ReleaseClaim(int64 GridId, TFunction<void(const FCrowdyClaimRelease&)> OnDone)` | Gives one of the player's claims back. The chunk's voxels stay; the chunk is claimable again. |
| **Find Claims** | `UCrowdyClaims::FindClaims(int64 LowX, int64 LowY, int64 LowZ, int64 HighX, int64 HighY, int64 HighZ, TFunction<void(const FCrowdyClaimSearch&)> OnDone)` | Every claim inside a box of chunks, corners included, in grid id order: its chunk, its owner's user id, and whether the signed-in player owns it. |
| **Can Edit Chunk** | `UCrowdyClaims::CanEditChunk(int64 ChunkX, int64 ChunkY, int64 ChunkZ, TFunction<void(const FCrowdyChunkEditCheck&)> OnDone)` | Whether the signed-in player may edit voxels in one chunk, and the grid that decides. |
| **Get Grid Permissions** | `UCrowdyClaims::GetGridPermissions(int64 ChunkX, int64 ChunkY, int64 ChunkZ, TFunction<void(const FCrowdyGridPermissions&)> OnDone)` | Every grid covering one chunk, with the player's own permission keys on each. |

The Blueprint nodes are the async actions `UCrowdyClaimChunk`, `UCrowdyReleaseClaim`, `UCrowdyFindClaims`, `UCrowdyCanEditChunk` and `UCrowdyGetGridPermissions`; C++ calls the subsystem instead. Each node's **On Done** and **On Failed** pins share one delegate: `FCrowdyClaimAsyncResult` (**Claim Chunk** and **Release Claim**: `GridId`, `Result`, `Message`), `FCrowdyClaimSearchAsyncResult` (**Find Claims**: `Claims`, `Result`, `Message`), `FCrowdyChunkEditAsyncResult` (**Can Edit Chunk**: `bCanEdit`, `GridId`, `Result`, `Message`) and `FCrowdyGridPermissionsAsyncResult` (**Get Grid Permissions**: `Grids`, `Result`, `Message`).

Two structs carry the lists. `FCrowdyChunkClaimInfo` is one claim in a **Find Claims** answer: `GridId`, `ChunkX`, `ChunkY`, `ChunkZ`, `OwnerUserId` (all `int64`) and `bOwnedByMe`. `FCrowdyGridPermissionRow` is one grid in a **Get Grid Permissions** answer: `GridId`, its chunk box as `LowChunkX`, `LowChunkY`, `LowChunkZ`, `HighChunkX`, `HighChunkY`, `HighChunkZ` (all `int64`), `PermissionKeys` (the player's own) and `bDecidesEdits`.

**List Grid Channels** (`UCrowdyClaims::ListGridChannels(int64 GridId, TFunction<void(const FCrowdyGridChannels&)> OnDone)`) answers the channels a grid owns, oldest first, in **Channels**; the list is empty when the grid has none. A **Grid Id** of 0 or less is **Refused** without sending, and a row that is not one of the grid's own fails the whole list as **Bad Reply**. Its node is `UCrowdyListGridChannels` with `FCrowdyGridChannelsAsyncResult` (`Channels`, `Result`, `Message`). It takes a grid id you already hold, such as a claim's.

Chunk coordinates are the ones the SDK places actors in; **World To Voxel** on the [Voxel Chunks](./voxel-chunks.md#the-nodes) page turns a location into its chunk. The player must be signed in to the app.

## What a claim is

- A claim covers exactly one chunk and belongs to the player who made it. Nothing else names a claim: it is a grid on the platform, and **Grid Id** is its id.
- Only wilderness can be claimed: a chunk no grid covers but the app's world grid. A chunk inside a plot, a zone or someone's claim is refused.
- The app's claim policy must be **Self Claim**, the default. You set it in Crowdy Studio.
- The owner may build in the chunk, talk on voice there and teleport into it; the code and video keys come with a claim only where the player's tier already has them. Everyone else is refused building there, however open the land around it is.
- The platform names no limit on claims per player. If your game wants one, keep your own count, for example in a Server Object.

## What each result means

| Result | Means |
|---|---|
| **Success** | Done. **Claim Chunk** answers the new **Grid Id**; **Find Claims** answers its list, empty when the box holds no claim. |
| **Not Signed In** | The player has no app token yet. Nothing was sent. |
| **Not Claimable** | The chunk is inside another grid: a plot, a zone, or someone's claim. |
| **Already Claimed** | The chunk is already claimed. The platform answers this or **Not Claimable** for a claimed chunk, so treat the two the same. |
| **Refused** | Any other refusal, such as a claim policy other than Self Claim, two players claiming at once, or a release of a grid that is not the player's. **Message** names the platform's code. |
| **Failed** | The request did not complete, or the box was too large. |
| **Bad Reply** | The answer was malformed, so nothing from it is used. |

## Finding claims

**Find Claims** reads the grids over the box once, then the owner of each grid that covers a single chunk, one request each, and keeps those whose owner claimed them. The world grid, plots and grids with no owner are not claims and are left out. If any read fails, the whole search answers that failure, never part of a list.

The box holds at most 4,096 chunks (16 on each side, or any other shape that size). Search once for the whole area your level shows, not once per chunk: a level of 20 claim pads is one search, not 20.

Nothing pushes a claim to other players. Search again when your player arrives somewhere or when it matters, for example when they step onto a plot.

## Checking whether a player can build

An edit in a chunk is allowed when the player holds `update_voxel_data` on the grid that decides that chunk. **Can Edit Chunk** answers whether they do, so a build tool can switch itself off before the platform refuses an edit. **Get Grid Permissions** answers with the detail: every grid over the chunk and the player's own permission keys on each. Both need Application API v2.67.0, which every tier has.

- The deciding grid is the smallest grid covering the chunk, the lower grid id when two are the same size. **Grid Id** names it, and **Can Edit** is true when the player holds `update_voxel_data` there.
- A chunk no grid covers answers **Success** with **Can Edit** false and **Grid Id** 0: the platform refuses every edit there.
- The answer is advice. It cannot see the player's access tier, which must also grant `update_voxel_data`, or a closed wilderness, which refuses a chunk that only the world grid covers. The platform still decides each edit, so keep handling a refused edit.
- **Get Grid Permissions** lists the deciding grid first, then the rest by smallest box and lowest id. Each grid has its chunk box, the player's own unexpired permission keys, and **Decides Edits**, true on the deciding grid. Nobody else's keys are returned.

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

`CheckPlot` asks about the workshop's chunk and lights the bench when the keeper may build there. It does nothing when the platform did not answer.

<CppSnippet id="claims-can-edit" />

</TabItem>
<TabItem value="bp" label="Blueprint">

**CheckPlot** finds the workshop's chunk with **World To Voxel** and calls **Can Edit Chunk**. From **On Done**, **Set Visibility** on the **Bench** light takes **Can Edit**. Handle **On Failed** to learn why nothing was answered.

<Blueprint src="claims-can-edit" title="CheckPlot, Get Actor Location, World To Voxel, Can Edit Chunk, Get Bench, Set Visibility" />

</TabItem>
</Tabs>

<Tabs groupId="lang">
<TabItem value="cpp" label="C++">

```cpp
#include "Subsystem/CrowdyClaims.h"

void AMyPlot::TryClaim()
{
    UCrowdyClaims* Claims = GetGameInstance()->GetSubsystem<UCrowdyClaims>();
    TWeakObjectPtr<AMyPlot> WeakThis(this);
    Claims->ClaimChunk(ChunkX, ChunkY, ChunkZ, [WeakThis](const FCrowdyChunkClaim& Claim)
    {
        AMyPlot* Self = WeakThis.Get();
        if (!Self)
        {
            return;
        }
        if (Claim.Result == ECrowdyClaimResult::Success)
        {
            Self->ShowOwned(Claim.GridId);
            return;
        }
        Self->ShowReason(Claim.Result, Claim.Message);
    });
}
```

</TabItem>
<TabItem value="bp" label="Blueprint">

Call **Claim Chunk** with the plot's chunk. From **On Done**, keep **Grid Id** and show the plot as the player's own. From **On Failed**, switch on **Result**: **Already Claimed** and **Not Claimable** both mean someone else holds it.

</TabItem>
</Tabs>

## What it costs

- **Claim Chunk**, **Release Claim**, **Can Edit Chunk** and **Get Grid Permissions** are one request each.
- **Find Claims** is one request for the box plus one per single-chunk grid in it. Nothing is cached, so each call asks again.
