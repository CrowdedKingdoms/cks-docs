---
slug: intro
sidebar_position: 1
title: UDP / Buddy APIs
---

# UDP API

This section will document native **Buddy** UDP sockets (path A integrations) —
handshake payloads, sequencing, authoritative replication payloads, telemetry, failure
modes, plus operational notes for provisioning Buddy servers (`cks-udp-api` lives in its
own repository today).

Ownership: **Michael** / platform team until the markdown spec lands here.

:::note GraphQL UDP proxy reminder

Browsers route spatial traffic via GraphQL mutations + websocket subscriptions —
documented alongside the **[GraphQL UDP proxy guide](/game-api/graphql-udp-proxy-api)** tab.

:::
