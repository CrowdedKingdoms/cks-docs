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

Run Fabric. Paper, Spigot, Velocity, and BungeeCord are a different setup. Players connect to
each server's own hostname, and a public server stays `online-mode=true`.

## One server

You need Java 25, Fabric Loader `0.19.5`, a Fabric server for Minecraft Java 26.3, and Fabric API
`0.161.0+26.3`. From the
[mod release](https://github.com/CrowdedKingdoms/cks-minecraft-mod/releases), take
`crowdedkingdoms-server-<version>.jar` and put it in the server's `mods/` folder next to Fabric
API. The other jar on that release, `crowdedkingdoms-<version>.jar`, is the client mod. It belongs
in a player's own `mods` folder. A server that hosts this world does not use it.

1. Accept the [Minecraft EULA](https://aka.ms/MinecraftEULA) in `eula.txt` (`eula=true`). Only the
   account holder may do that.
2. In `server.properties`, set `online-mode=true` and turn the whitelist on. When you create the
   world, set `level-seed=7270301997446181`. That seed is the shared world's terrain. A world
   created with another seed is a different world. Set the seed once, at creation.
3. Turn on org-managed players for your organization and accept the addendum. The server uses an
   org token with `players:mint` and `players:manage`. See
   [Org-managed players](/management-api/org-managed-players).
4. Put the secrets in `config/crowdedkingdoms-server.secrets`, one `KEY=value` a line. The server
   reads the environment first, then this file.
   - `CROWDY_ORG_TOKEN`, the org token.
   - `CROWDY_ID_PEPPER`, 16 or more random characters. Keep it forever. It fixes each player's id.
     Every server of one world uses the same value.
5. In `config/crowdedkingdoms-server.json`, name the production app and organization. The server
   fills the rest in the first time it starts. `origin` has to be set, or a blank one is replaced
   and the app id you wrote is dropped.

```json
{
  "environment": "prod",
  "environments": {
    "prod": {
      "origin": "https://ck.prod.crowdedkingdoms.com",
      "appId": "",
      "orgId": ""
    }
  },
  "geoip": {
    "countryDatabase": "geoip/dbip-country-lite.mmdb"
  }
}
```

Only a whitelisted player gets a Crowded Kingdoms player. Banning a player disables that player.
Pardoning them enables them again. If you vet players some other way, set
`operatorVetsPlayersOutOfBand` to `true` in that same file.

## Age and country

The first time a vetted player joins, a chest menu asks the month and year they were born, before
they get a Crowded Kingdoms player. A player under 13 is disconnected and turned away each time
they return.

Put a country database at `geoip.countryDatabase`, as in the file above. Either
[DB-IP IP to Country Lite](https://db-ip.com/db/download/ip-to-country-lite) (CC BY 4.0; credit
"IP Geolocation by DB-IP", linked to [db-ip.com](https://db-ip.com), where the server is presented)
or MaxMind GeoLite2 Country works. The path is relative to the server folder, or absolute.

Staff commands, which ages can enter, and messages between players who are not friends are in the
mod's [server safety note](https://github.com/CrowdedKingdoms/cks-minecraft-mod/blob/dev/docs/server-safety.md).

## Several servers, one world

Each server is its own process, with its own public hostname, and it stays running. A server that
is asleep cannot take a player the others send. Copy the same secrets, the same seed, and the same
world settings onto every server. The same `CROWDY_ID_PEPPER` and the same
`CROWDY_CLUSTER_SECRET` are required on every server. The cluster secret is 32 or more random
characters. Set `accepts-transfers=true` in `server.properties`.

Point each server at the same cluster file, and give it its own id. `file` is relative to the
server folder:

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

`address` is the hostname and port a vanilla client connects to. East runs the overworld from
chunk x 125, which is block x 2000, upward. A bound you leave out is open. The server marked
`default` runs every chunk the others do not, including the other dimensions. When players use a
public hostname and the servers reach each other on a private address, set `internal_address` on
that server to the private host and port.

Publish that default hostname. A player who walks past the line arrives on the server that runs
those chunks, and keeps their inventory. `/ck cluster` shows which side they are on.
