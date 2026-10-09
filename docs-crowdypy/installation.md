---
slug: installation
sidebar_position: 2
title: Installation
---

# Installation

```bash
pip install crowdypy
```

Pre-releases are published as `X.Y.Z.devN` (sandbox) and `X.Y.ZrcN` (release
candidates), so install them with `pip install --pre crowdypy`. Every release's
wheels and sdist are also attached to its
[GitHub Release](https://github.com/CrowdedKingdoms/CrowdyPy/releases), so you can
install one directly: `pip install crowdypy-<version>-<platform>.whl`.

## Python and platforms

| Wheel | Platforms |
|---|---|
| `cp312-abi3` (CPython 3.12, 3.13, 3.14 and later) | Linux x86_64 and aarch64 (manylinux and musllinux), macOS arm64 and x86_64, Windows AMD64 |
| `cp314t` (free-threaded CPython 3.14) | the same platforms |

The native replication core and its crypto are linked into the wheel, so there
is nothing else to install. On free-threaded Python, the native core does not
need the interpreter lock.

## The default origin

Each release carries the API origin it was built for, so
`crowdypy.AsyncCrowdyClient()` with no `http_url` reaches it. A stable release
points at production. A pre-release is built for one of Crowded Kingdoms' internal
environments, which refuse outside accounts; install a stable release, or pass
`http_url=` to choose explicitly.

## Building from source

```bash
git clone https://github.com/CrowdedKingdoms/CrowdyPy && cd CrowdyPy
uv sync          # builds the extension and installs the dev tools
uv run pytest tests/unit
```

You need CMake 4.0 or later, a C++20 compiler and the OpenSSL development
files. The CrowdyCPP sources are vendored in the repository at a pinned
release.
