---
slug: intro
sidebar_position: 1
title: Replication API
---

# Replication API

The **Replication API** is Crowded Kingdoms' authoritative spatial replication
surface over **UDP** (User Datagram Protocol). Game clients that can open raw UDP
sockets authenticate via the **[Management API](/management-api/intro)**, mint an
**app-scoped token** for the app they are entering (`mintAppToken` — see
**[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)**), call
**`serverWithLeastClients`** on the **[Game API](/game-api/intro)** for Buddy
assignment, then exchange replication messages directly with a **Buddy** server.
Buddy authenticates **only** app-scoped tokens; the identity session token that
`login` returns is rejected for gameplay.

**Buddy** is the name of the replication server program—not a separate product.
When platform docs mention Buddy, they mean an instance of that program
running in your environment. The wire protocol, handshake, and operational guides
in this section describe how to speak to Buddy over UDP.

This section documents native UDP integrations—handshake timing, wire payloads,
sequencing, HMAC, and failure modes.

:::note[Browsers and the GraphQL UDP proxy]

Clients that **cannot** open raw UDP sockets (typical browsers) route spatial
traffic through the Game API's GraphQL mutations and WebSocket subscriptions
instead—see the **[GraphQL UDP proxy guide](/game-api/graphql-udp-proxy-api)**.

Both paths share the same Management API identity (`register` / `login`) and the
same **app-scoped token** minted from it (`mintAppToken` or the browser portal
flow); only the transport differs (UDP to Buddy vs. GraphQL through the proxy).

:::

## Quick start

1. **[Getting started](/replication-api/getting-started)** — prerequisites and endpoints
2. **[Authenticate and assign](/replication-api/authenticate-and-assign)** — login, `mintAppToken`, `serverWithLeastClients`, session-ready wait
3. **[Send and receive](/replication-api/send-and-receive)** — first spatial message and notifications
4. **[Wire formats](/replication-api/wire-formats)** and **[HMAC](/replication-api/hmac)** — binary layout reference
5. **[Operations](/replication-api/operations)** — heartbeats, errors, reassignment
6. **[Troubleshooting](/replication-api/troubleshooting)** — "sends succeed but nothing comes back" and other connectivity issues
7. **[Load testing](/replication-api/load-testing)** — simulate real player traffic against your app with the open-source cks-loadtest tool
