---
sidebar_position: 4
title: Datacenters and endpoint routing
---

# Datacenters and endpoint routing

Your app's world lives in **one datacenter**. The published API origin resolves to **all
of them**. Getting from the second fact to the first is what this page is about, and it is
two extra lines of client code.

If you take nothing else: **read `gameApiUrl` from `gameClientBootstrap` and use it for
everything afterwards; keep `discoveryUrl` as the way back.**

## Why there is anything to do here

The platform database is PostgreSQL with Citus, distributed on `app_id`. Every row of your
app — chunks, actors, grids, compute state — lives on shards in a single datacenter, and
an app is deliberately placed in one rather than spread across several.

The published origin, `ck.<tier>.cp.cks-env.com`, is a multi-value DNS record over every
datacenter's load balancer. There is no single front door: whichever datacenter DNS hands
you answers your first request. That is intentional, because a single front door is a
single thing to lose.

So your first request is answered correctly by a datacenter that may not hold your data.
Identity, organizations, tokens and app access are **reference tables**, replicated to
every node, so signing in and minting a token work from anywhere. Reading your world does
not — or rather, it works and is slow. Citus will fetch every row across the network and
return the right answer. Nothing errors. Nothing logs. A measured cross-datacenter
statement on this cluster costs **631 ms against 0.008 ms** for a local one.

That is the failure this design removes, and it is worth naming precisely because it does
not look like a failure. It looks like the game being sluggish for some players.

## The three URLs

`gameClientBootstrap` returns all three. They are different things and the difference
matters:

| Field | What it is | Use it for |
|---|---|---|
| `discoveryUrl` | The shared origin, resolving to **every** datacenter | Finding your way back when the others stop answering |
| `gameApiUrl` | **Your app's own datacenter.** Where its shards are | All gameplay traffic |
| `gameApiWsUrl` | The same, for subscriptions and the realtime relay | Realtime |

`discoveryUrl` is the one that is easy to get wrong. It must stay the shared origin —
never `gameApiUrl`, and never a specific instance. A recovery address that dies together
with the thing it exists to replace is not a recovery address, and this is not theoretical:
a client holding only an app token **cannot re-mint**, because minting needs the identity
session it does not have. Without a working `discoveryUrl` such a client has no way to ask
anything for a new endpoint.

## What a client does

```ts
import { createCrowdyClient } from '@crowdedkingdoms/crowdyjs';

// 1. Connect to the published origin. Any datacenter answers.
let client = createCrowdyClient({
  httpUrl: 'https://ck.prod.cp.cks-env.com/graphql',
  wsUrl: 'wss://ck.prod.cp.cks-env.com/graphql',
  managementUrl: 'https://ck.prod.cp.cks-env.com',
  realtime: {
    // The SHARED origin, and it stays that way for the life of the client.
    discoveryUrl: 'https://ck.prod.cp.cks-env.com/graphql',
  },
});

// 2. Ask where this app lives.
const bootstrap = await client.serverStatus.gameClientBootstrap(appId);

// 3. Move onto it, if it is not where you already are.
if (bootstrap.gameApiUrl && bootstrap.gameApiUrl !== currentEndpoint) {
  client = createCrowdyClient({
    httpUrl: bootstrap.gameApiUrl,
    wsUrl: bootstrap.gameApiWsUrl,
    managementUrl: 'https://ck.prod.cp.cks-env.com',
    // Unchanged. This is the point.
    realtime: { discoveryUrl: 'https://ck.prod.cp.cks-env.com/graphql' },
  });
  client.setToken(appToken);
}
```

Requires CrowdyJS **13.9.0 or later**, which builds re-discovery from `discoveryUrl`
itself. On an older build, setting it changes nothing.

## What happens if you skip step 3

Two possibilities, depending on how the environment is configured.

**Nothing visible.** Your queries are answered by a datacenter that does not hold your
shards, correctly and slowly, indefinitely. This is the outcome to be afraid of.

**A refusal naming where to go**, if the environment enforces routing:

```json
{
  "errors": [{
    "message": "App 42 is served from datacenter 'or', not 'va'. Reconnect to https://ck-or.prod.cp.cks-env.com and retry. …",
    "extensions": {
      "code": "WRONG_DATACENTER",
      "gameApiUrl": "https://ck-or.prod.cp.cks-env.com",
      "gameApiWsUrl": "wss://ck-or.prod.cp.cks-env.com",
      "appDatacenter": "or",
      "servedBy": "va"
    }
  }]
}
```

Handle `WRONG_DATACENTER` by reading `extensions.gameApiUrl` and reconnecting — the
endpoint is in the extensions specifically so you do not have to parse the message. A
retry against the same endpoint will fail identically, forever.

Requests that name no app, and the identity surface, are never refused this way: any
datacenter can answer them.

## If your app moves

An operator can move an app to another datacenter. When that happens the endpoint your
client is holding stops being the right one, and there is no push notification.

`gameClientBootstrap` is the answer, and it must be re-read rather than cached for the
life of a session. A client that re-reads it on reconnect follows a move without anyone
intervening. A client that cached the endpoint on first launch stays on the old datacenter
until it is restarted — and if enforcement is on, it starts receiving `WRONG_DATACENTER`
instead.

This is also why testing the re-route with a **fresh** client proves nothing. A fresh
client reads the placement on its first bootstrap and looks correct even if re-discovery
is entirely broken. The case that matters is a client that was already connected when the
app moved.
