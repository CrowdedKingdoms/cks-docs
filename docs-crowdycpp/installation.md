---
slug: installation
sidebar_position: 2
title: Installation
---

# Installation

CrowdyCPP is a CMake project. You can build it standalone, vendor it as a
subdirectory, or install it and consume it with `find_package(CrowdyCPP)`.

## Prerequisites

- A C++20 compiler (GCC, Clang, or MSVC)
- CMake 3.22+
- **libcurl** (default HTTP transport) and **OpenSSL** (HMAC-SHA256)

On Ubuntu:

```bash
sudo apt-get install build-essential cmake libcurl4-openssl-dev libssl-dev
```

The third dependency, **yyjson** (JSON parse/serialize for the GraphQL
layer), is vendored in the repository — nothing to install. All three are
replaceable through interfaces:

| Dependency | Used by | Replaceable via |
|---|---|---|
| libcurl | default HTTP transport | `crowdy::graphql::IHttpTransport` |
| OpenSSL (libcrypto) | HMAC-SHA256 | `crowdy::core::ICrypto` |
| yyjson (vendored) | JSON parse/serialize | internal only, never on the UDP path |

The wire and replication layers depend only on BSD/Winsock sockets and the
`ICrypto` interface — no libcurl, no JSON. This matters when
[wrapping the SDK in an engine](/crowdycpp/engine-integration) that provides
its own HTTP and crypto stacks.

## Clone and build

```bash
git clone https://github.com/CrowdedKingdoms/CrowdyCPP.git
cd CrowdyCPP
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build -j
ctest --test-dir build        # unit tests: no network required
```

### Offline standalone builds

A clean external clone builds **offline**: the GraphQL schema snapshot
(`schema.gql`) and the generated operation/enum code
(`include/crowdy/generated/`) are committed to the repository. You never need
network access, a running API, or any sibling repository to build. (Only SDK
maintainers run the schema-sync and codegen scripts, which refresh the
snapshot from the published SDLs at
[`/schema/management-api.graphql`](pathname:///schema/management-api.graphql)
and [`/schema/game-api.graphql`](pathname:///schema/game-api.graphql).)

### Build options

| Option | Default | Effect |
|---|---|---|
| `CROWDY_WITH_CURL` | `ON` | Build the default libcurl HTTP transport |
| `CROWDY_WITH_OPENSSL` | `ON` | Build the default OpenSSL crypto provider |
| `CROWDY_BUILD_TESTS` | `ON` | Unit tests (`ctest`) |
| `CROWDY_BUILD_E2E` | `ON` | Env-gated end-to-end tests (skipped unless configured) |
| `CROWDY_BUILD_BENCHMARKS` | `ON` | Micro + end-to-end benchmarks |
| `CROWDY_BUILD_EXAMPLES` | `ON` | Example programs (`walker`, `kit_seed_and_play`) |

Turn `CROWDY_WITH_CURL` / `CROWDY_WITH_OPENSSL` off when your integration
injects its own `IHttpTransport` / `ICrypto` implementations.

## Consuming from your project

Install and use the exported package config:

```bash
cmake --build build --target install   # honors CMAKE_INSTALL_PREFIX
```

```cmake
find_package(CrowdyCPP REQUIRED)
target_link_libraries(my_game PRIVATE CrowdyCPP::crowdy)
```

The `CrowdyCPP::crowdy` target is the full client facade (GraphQL domains +
replication + session + kit). Lower layers are exported too — for example a
replication-only integration can link just `CrowdyCPP::crowdy_replication`
and `CrowdyCPP::crowdy_core`.

Alternatively, vendor the repository and use `add_subdirectory(CrowdyCPP)`
with the same target names (unprefixed: `crowdy`, `crowdy_replication`, …).

## Next

Continue with the [Quick start](/crowdycpp/quick-start).
