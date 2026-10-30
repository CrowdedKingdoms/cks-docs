---
sidebar_position: 32
title: Hosting on Crowdy Games (retired)
---

# Hosting on Crowdy Games (retired)

Crowdy Games, the site where Crowded Kingdoms hosted developers' browser games, was
retired on **2026-10-29** on every environment, together with its content host.
Crowded Kingdoms no longer hosts games. Build yours and serve it from a static host of
your own, as [Host your game](/build-a-game/host-your-game) describes.

The hosting API is switched off on every environment. Its mutations
(`claimGameHosting`, `beginGamePublish`, `completeGamePublish`, `abandonGamePublish`
and `setHostedGameEnabled`) and the `hostedGamePublishes` query answer
`CONTENT_HOSTING_DISABLED`, and its other queries (`hostedGame`, `hostedGames` and
`myHostedGames`) return `null` or an empty list. The fields are still in the schema, so a
client that calls them gets that answer rather than a validation error.

If your game was published there:

- **Serve the build yourself.** The headers the platform's edge used to send for you are
  now your host's to send; see [The headers](/build-a-game/host-your-game#the-headers).
- **Register your own origin.** Add it under the app's redirect URIs in Studio
  (**Settings > Sign-in & redirect URIs**). That list is where hosted sign-in may return
  a player and the API's CORS allow-list for the app. The Crowdy Games addresses that
  publishing registered lead nowhere now, and you can remove them.
- **Set the launch URL** to your deployment, on the same card. It is where players enter
  your app and what Studio's **Live code** opens.

Sign-in itself is unchanged: `client.portal.signIn` sends the player to Studio's
`/authorize`, and `client.portal.handleSignInCallback` finishes on your page. See
[Portals & app-scoped tokens](/management-api/portals-and-app-tokens).
