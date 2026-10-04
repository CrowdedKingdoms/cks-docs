---
slug: intro
sidebar_position: 1
title: Introduction
---

# CrowdyPy SDK

**CrowdyPy** is the official Python SDK for Crowded Kingdoms:
[github.com/CrowdedKingdoms/CrowdyPy](https://github.com/CrowdedKingdoms/CrowdyPy).
It covers the same surface as [CrowdyJS](/crowdyjs/intro), with Python names
(`mintAppToken` is `mint_app_token`). Its realtime path is the
[CrowdyCPP](/crowdycpp/intro) native replication client, compiled into the wheel.

## The transport stance

> **Replication is native UDP, and Python never touches a datagram.**

Receiving, [HMAC](/replication-api/hmac) verification and decoding happen on
CrowdyCPP's network thread, which never takes the interpreter lock. Python gets
one batch object per poll, and its columns are zero-copy views. Sends release
the interpreter lock, and a batch of sends releases it once. An asyncio loop is
woken through a socket rather than by polling. On the same machine, a
200-entity batch costs about as much per entity as CrowdyCPP's own send path,
and Python takes in about two million verified notifications a second.

## Design pillars

- **Async first, blocking too.** `crowdypy.AsyncCrowdyClient` is the asyncio
  client. `crowdypy.sync.CrowdyClient` has the same methods without `await`.
- **The whole CrowdyJS surface.** Every domain, the World Stores, the Game Kit,
  the ck-exec gateway, GraphQL subscriptions and the headless Crowdy Studio.
  See [Compatibility and parity](/crowdypy/compatibility).
- **One wheel per platform.** It is a `cp312-abi3` wheel for CPython 3.12 and
  later, with a free-threaded build for 3.14t. The native core and its crypto
  are linked in, with nothing else to install.
- **The same model as every SDK.** The
  [two-token model](/management-api/portals-and-app-tokens), the error codes
  and the wire formats are the same, so the platform docs translate directly.

## How to read this section

1. [Installation](/crowdypy/installation): wheels, Python versions and building
   from source.
2. [Quick start](/crowdypy/quick-start): sign in, mint an app token, connect.
3. [Replication](/crowdypy/replication): sends, notifications and batches over
   native UDP.
4. [World Stores](/crowdypy/world-stores): the SDK-managed game state.
5. [Studio and player host](/crowdypy/studio): headless Crowdy Studio and the
   player-host observation contract.
6. [Best practices](/crowdypy/best-practices) and
   [Compatibility and parity](/crowdypy/compatibility).
