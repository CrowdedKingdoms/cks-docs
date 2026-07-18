---
slug: intro
sidebar_position: 1
title: Introduction
---

# CrowdyCPP SDK

**CrowdyCPP** is the official portable C++ SDK for Crowded Kingdoms:
[github.com/CrowdedKingdoms/CrowdyCPP](https://github.com/CrowdedKingdoms/CrowdyCPP).
It gives native games typed clients for authentication, the
[Management API](/management-api/intro) and [Game API](/game-api/intro)
GraphQL surfaces, and — unlike the browser-first
[CrowdyJS](/crowdyjs/intro) SDK — a **native UDP replication client** that
speaks the [Replication API](/replication-api/intro) wire protocol directly
to the replication servers.

## The transport stance

The single most important thing to understand about CrowdyCPP:

> **Replication is always native UDP, direct to the replication server.**

CrowdyJS routes realtime traffic through the Game API's
[GraphQL UDP proxy](/game-api/graphql-udp-proxy-api) because browsers cannot
open raw UDP sockets. CrowdyCPP has no such constraint: it opens a UDP socket
and implements the [wire formats](/replication-api/wire-formats) and
[HMAC scheme](/replication-api/hmac) natively, with zero-copy binary framing
and no GraphQL proxy in the hot path. There is no proxy mode in CrowdyCPP —
if your client runs in a browser, use CrowdyJS instead.

Everything else mirrors CrowdyJS: the same domains, the same
[two-token model](/management-api/portals-and-app-tokens), and the same error
codes, so the platform docs and examples translate directly between the two
SDKs. See [Compatibility and parity](/crowdycpp/compatibility) for the
coverage guarantees.

## Design pillars

- **Portable.** Standard C++20 and CMake on Linux, Windows, and macOS. No
  engine types, no framework assumptions.
- **Zero-copy, zero-allocation hot path.** After connect, the steady-state
  replication path performs no heap allocation (pooled datagram buffers), no
  copies on parse (payloads are spans into the receive buffer until you copy
  them), and no exceptions.
- **Pluggable platform interfaces.** Every platform dependency — HTTP,
  crypto, clock, logging, allocation — sits behind a small interface you can
  replace with your own implementation.
- **Engine-wrappable.** Usable directly by a native game, and equally
  designed to be wrapped by engine-specific SDKs such as the official
  [Crowdy Unreal SDK](/unreal-sdk/intro). See
  [Engine integration](/crowdycpp/engine-integration).

## How to read this section

Work through it in order the first time:

1. [Installation](/crowdycpp/installation) — clone, build, and consume the
   library from CMake.
2. [Quick start](/crowdycpp/quick-start) — sign in, mint an app token,
   connect, and walk an actor around.
3. [Replication client](/crowdycpp/replication-client) — the native UDP
   connection: assignment, signed sends, verified receives, lifecycle.
4. [World session](/crowdycpp/world-session) — SDK-managed game state: your
   actor's send loop, the remote-actor registry, the chunk cache, inboxes.
5. [Game Kit](/crowdycpp/game-kit) — blueprint builders and runtime kits for
   inventory, economy, combat, and the other genre layers.
6. [Engine integration](/crowdycpp/engine-integration) — wrapping CrowdyCPP
   in Unreal and other engines.
7. [Compatibility and parity](/crowdycpp/compatibility) — server
   compatibility notes, CrowdyJS parity, and versioning.
