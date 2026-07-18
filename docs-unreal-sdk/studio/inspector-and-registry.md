---
slug: inspector-and-registry
sidebar_position: 5
title: Inspector and Registry
---

# Inspector and Registry

This page covers two Crowdy Studio pages you use late in a work session:

- The Inspector, a read-only live view of a running Play in Editor session.
- The Registry, where you rebake Crowdy metadata before cooking.

It also explains the Web Console button for admin surfaces that live outside the editor.

Open Crowdy Studio from Tools, Crowdy SDK, Crowdy Studio, or the Crowded Kingdoms toolbar button. It is a dockable editor tab. Both the Inspector and Registry are native pages inside that tab.

## Inspector

The Inspector shows live state from the current Play in Editor session. It is read-only.

You watch teams, channels, and containers as they change while you play, without adding logging to your own code.

:::note
Start a Play in Editor session first, then open the Inspector page. With no PIE session running, the page has nothing to show.
:::

What you can read here:

- Teams: which teams the local player is in, pulled from the runtime cache. This mirrors what `UCrowdyTeams::GetCachedMyTeams` returns and updates as `OnMyTeamsCacheChanged` fires.
- Channels: the channels the client has joined. The SDK joins every channel referenced by a `CrowdyChannel` event, plus the default session channel `__crowdy_session_<appId>`.
- Containers: the live Crowdy entities and their state during the session.


![Crowdy Studio Inspector page during a Play in Editor session](/img/unreal-sdk/studio-inspector.png)

The Inspector is a viewer. To change teams, channels, or entity state, use the runtime APIs in your game code. See [Teams](/unreal-sdk/services/teams), [Channels](/unreal-sdk/runtime/channels), and [Entities and Spawning](/unreal-sdk/runtime/entities-and-spawning).

:::tip
If the Inspector is empty while you are playing, check that the current map has a map profile and that networking is enabled on it. With no profile, the entity subsystem and replicator do nothing and the session looks dead. See [Map Profiles](/unreal-sdk/runtime/map-profile).
:::

## Registry

The baked registry is `UCrowdyBakedRegistry`, a cooked snapshot of Crowdy metadata stored at `/Game/CrowdySDK/CrowdyBakedRegistry`. The SDK reads this snapshot at runtime.

The snapshot exists because UObject metadata is stripped from cooked builds:

- At edit time the SDK can read metadata directly.
- In a cooked build that metadata is gone, so the runtime reads the baked snapshot instead.

:::warning
Shipped code never calls `HasMetaData`. It reads the baked registry.
:::

The Registry page has a Rebuild button. Pressing it rebakes the snapshot from the current state of your project.


![Crowdy Studio Registry page with the Rebuild button](/img/unreal-sdk/studio-registry.png)

### When to press Rebuild

Press Rebuild after authoring changes that affect Crowdy metadata, and before you cook a build. In practice that means:

- After you add or change a `CrowdyEvent` receiver, its recipient, channel, or other event meta.
- After you change containers or other Crowdy-tagged structs.
- Before you cook or package, so the snapshot matches your latest code.

The cook also re-bakes automatically as part of its hooks, so a packaged build is correct even if you forget. Pressing Rebuild yourself keeps the in-editor snapshot current and lets you verify the bake before a long cook.

:::note
This project uses Diversion for version control. The baked asset is machine-generated and belongs in `.dvignore`, not `.gitignore`. Do not commit it. It is regenerated on rebuild and on cook.
:::

For the full packaging flow, including the registry step, see the [Packaging guide](/unreal-sdk/guides/packaging).

## Web Console

Some surfaces are not authored in the native editor pages. Members, billing, tokens, and secrets are admin surfaces. Crowdy Studio reaches them through the Web Console button.

The button opens an embedded browser pointed at those admin surfaces. It uses single sign-on from the editor token, so you do not sign in again. You sign in once in Crowdy Studio, then the Web Console carries that session.

{/* TODO: replace with real screenshot */}
![Web Console button opening admin surfaces in an embedded browser](/img/unreal-sdk/studio-web-console.png)

Which surface goes where:

- Native pages: game-plane authoring (teams, channels, grids, game models, the Inspector, and the Registry).
- Web Console: account and security administration.

:::note
Token sign-in gives management-only access. It cannot do game-plane authoring such as teams and channels. Sign in with your account (passwordless — magic link or social) when you need full authoring.
:::
