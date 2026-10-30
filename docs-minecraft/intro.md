---
slug: intro
sidebar_position: 1
title: Minecraft server
---

# Minecraft

**NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.**

Made and published by Crowded Kingdom Studios. Contact: hello@crowdedkingdoms.com.

A Fabric server running the Crowded Kingdoms server mod hosts a shared world that vanilla
Minecraft: Java Edition clients join. Players do not install a mod, and they do not make a
Crowded Kingdoms account. The server signs each vetted player in.

## One server

You need Java 25, a Fabric server for Minecraft Java 26.3, Fabric API `0.161.0+26.3`, and the
Crowded Kingdoms server jar in the server's `mods/` folder next to Fabric API.

1. Accept the [Minecraft EULA](https://aka.ms/MinecraftEULA) in `eula.txt` (`eula=true`). Only the
   account holder may do that.
2. In `server.properties`, set `online-mode=true` and turn the whitelist on. On a new world, set
   `level-seed=7270301997446181`. Every server that shares this world uses that seed.
3. Turn on org-managed players for your organization and accept the addendum. The server uses an
   org token with `players:mint` and `players:manage`. See
   [Org-managed players](/management-api/org-managed-players).
4. Put the secrets in `config/crowdedkingdoms-server.secrets`, one `KEY=value` a line. The server
   reads the environment first, then this file.
   - `CROWDY_ORG_TOKEN`, the org token.
   - `CROWDY_ID_PEPPER`, 16 or more random characters. Keep it forever. It fixes each player's id.
5. In `config/crowdedkingdoms-server.json`, set the tier, the app id, and the org id.

Only a whitelisted player gets a Crowded Kingdoms player. Banning a player disables that player.
Pardoning them enables them again.

## Several servers, one world

Each server is its own process, with its own public hostname, and it stays running. Copy the same
secrets, the same seed, and the same world settings onto every server. Add `CROWDY_CLUSTER_SECRET`
to the secrets file: 32 or more random characters, the same value on every server. Set
`accepts-transfers=true` in `server.properties`.

Point each server at the same cluster file, and give it its own id:

```json
"cluster": { "file": "cluster.json", "serverId": "west" }
```

`serverId` is the line that differs. `cluster.json` is the same file everywhere:

```json
{
  "name": "world",
  "margin_blocks": 8,
  "servers": [
    { "id": "west", "address": "west.example.com:25565", "default": true },
    { "id": "east", "address": "east.example.com:25565",
      "ranges": [{ "dimension": "minecraft:overworld", "min_chunk_x": 125 }] }
  ]
}
```

`address` is the hostname players are sent to. East runs the overworld from chunk x 125, which is
block x 2000, upward. A bound you leave out is open. The server marked `default` runs every chunk
the others do not, including the other dimensions.

Publish that default hostname. A player who walks past the line arrives on the server that runs
those chunks, and keeps their inventory. `/ck cluster` shows which side they are on.
