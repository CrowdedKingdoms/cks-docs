---
sidebar_position: 2
title: Getting started
---

# Getting started

Use the Replication API when your client can open **raw UDP** sockets (Unreal Engine,
native desktop/mobile, dedicated game servers acting as clients). GraphQL handles
authentication and Buddy assignment; all replication traffic is UDP to Buddy.

## What you need

| Item | Description |
|------|-------------|
| Management API URL | `register` / `login` → identity **session token**; then `mintAppToken` → **app-scoped token** (hex) + `gameTokenId` |
| App ID | Numeric app identifier for your world (passed to `mintAppToken`; also used in spatial message headers) |
| Game API URL | `serverWithLeastClients` — returns Buddy address and registers your session (use the app token; `mintAppToken` returns the app's `gameApiUrl`) |
| UDP capability | Outbound UDP to Buddy `clientPort` (typically `9091`) |

You do **not** need any server-side secrets on the client. The platform registers
your **app-scoped** token with the assigned Buddy when you call
`serverWithLeastClients`. Buddy only accepts a `token_type='app'` token bound to
this app — the identity session token is rejected (see
**[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)**).

## Integration flow

```text
Management API          Game API                    Buddy (UDP)
──────────────          ────────                    ─────────────
register / login  ──▶   (identity session token)
mintAppToken      ──▶   (app-scoped token + gameApiUrl)
                        serverWithLeastClients ──▶  (session registration)
                        ◀── ip4, ip6, clientPort
(wait ~1.5 s)
ACTOR_UPDATE_REQUEST_2 ──────────────────────────▶
                        ◀── notifications (UDP)
(refreshAppToken before expiresAt to keep playing)
```

## Related guides

- **[Authenticate and assign](/replication-api/authenticate-and-assign)** — mutations and query shapes
- **[GraphQL UDP proxy](/game-api/graphql-udp-proxy-api)** — browser / JS path (no raw UDP)
- **[Game API intro](/game-api/intro)** — world GraphQL (`chunks`, `actors`, …)

:::caution[Do not call assignment on Management API]

`serverWithLeastClients` lives on the **Game API** only. The Management API handles
identity, orgs, marketplace, and billing—not Buddy assignment.

:::
