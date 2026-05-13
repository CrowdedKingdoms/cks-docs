---
slug: intro
sidebar_position: 1
title: Introduction
---

# Crowded Kingdoms Management UI

This tab hosts the onboarding material from **`cks-management-ui/README.md`**.

The SPA targets **Apollo + React 19** with persisted cache safeguards for volatile marketplace,
catalog, pricing, environment, and quota data. Operators land in `/admin/control-plane/*` guarded
both client-side (`<RoleGate need="operator">`) and via `OperatorGuard` on mutations.

Companion reading: **[Management API docs](/management-api/intro)** and **[Operators](/operators/intro)**.
