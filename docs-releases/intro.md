---
slug: intro
sidebar_position: 1
title: Introduction
---

# Release workflow

Customer **environment versions** are expressed as YAML manifests under the monorepo `releases/`
folder. The in-process control plane ingests them into `cks_environment_versions` on the shared
Postgres so studios can pick a known-good combination of Buddy, GraphQL, Citus, DNS, etc.

This section mirrors the authoring guide shipped next to those YAML files plus the high-level
notes from `cks-project-root/README.md § Environment Release Versions`.

Continue to **[Environment manifest authoring](/releases/manifests)** for schemas, ingestion commands,
validation tips, and the component matrix.
