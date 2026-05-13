---
slug: intro
sidebar_position: 1
title: Introduction
---

# Management API (`cks-management-api`)

NestJS + Apollo GraphQL service for the **management plane**:

- Identity, organizations, RBAC, apps marketplace, app-access tiers, billing, payments,
  quotas, SES email plumbing, environments, Stripe/PayPal webhooks — all land here.

- Colocated **control-plane step runner** (advisory-lock gated) that materializes queued
  change orders into `cp_*` worker tasks consumed by Nest providers.

Companion repo pointers and quick-start snippets are copied alongside as **Upstream
repository README**.

Open **Schema reference** pages (generated during `npm run build`) for exhaustive GraphQL
coverage generated from `schema.gql` beside the Nest sources (`cks-management-api/`).
