---
slug: intro
sidebar_position: 1
title: Minecraft server (in beta)
---

# Minecraft server (in beta)

**NOT AN OFFICIAL MINECRAFT PRODUCT. NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.**

One Minecraft world runs on many servers. Each server owns a part of the map and runs the players
connected to it, and the mobs and blocks on that ground. Crowded Kingdoms draws the rest of the
crowd as avatars on the client, the people on another server and the others sharing the world, so
a crowd can stand close together on that ground. Walk into the next server's part of the map and
the vanilla game connects you there.

Made and published by Crowded Kingdom Studios. Contact: hello@crowdedkingdoms.com.

A Fabric server running the Crowded Kingdoms server mod hosts a shared world that vanilla
Minecraft: Java Edition clients join. Players do not install a mod, and they do not make a
Crowded Kingdoms account. The server signs each vetted player in.

This is a beta. The mod runs one shared world, and that world has one seed. A host-chosen world
is the part still to come.

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
   world, set `level-seed=7270301997446181`. That seed is the shared world's terrain, and it is the
   current limit of this beta. A world created with another seed is a different world, and this
   server stays out of the shared world. Set the seed once, at creation.
3. Turn on org-managed players for your organization and accept the addendum. See
   [Org-managed players](/management-api/org-managed-players). Create the org token in Studio, on
   the organization's **API Credentials** tab. Tick **Sign players in** (`players:mint`) and
   include `players:manage`. The token is shown once, and it starts with `cko_`. It is
   `CROWDY_ORG_TOKEN` below.
4. Put the secrets in `config/crowdedkingdoms-server.secrets`, one `KEY=value` a line. The server
   reads the environment first, then this file.
   - `CROWDY_ORG_TOKEN`, the token from Studio.
   - `CROWDY_ID_PEPPER`, a string you generate and then keep. Sixteen or more random characters.
     The same value forever, and the same value on every server of this world. It fixes each
     player's id. `openssl rand -base64 32` prints one.
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
  },
  "directMessages": {
    "nonFriendsUnder18": false,
    "nonFriendsAdults": true
  }
}
```

Only a whitelisted player gets a Crowded Kingdoms player. Banning a player disables that player.
Pardoning them enables them again. If you vet players some other way, set
`operatorVetsPlayersOutOfBand` to `true` in that same file.

If the server never joins the shared world, `/ck status` says why. The reason is also in the log.

## Players

Each vetted player gets a generated gamertag. Commands and the age tools use that name. The
Minecraft name and the Minecraft UUID are not the Crowded Kingdoms player.

On joining, a vanilla client is offered a resource pack of the avatar skins. Other people appear
as those avatars. The menus are chest menus, and the commands are the ones the client mod uses.

A player who also has the client mod installed gets voice and video through this server, and that
client does not sign in a second time. Video is granted per player by the app's admin.

## Running the server

These commands need op level 3, or the console. `<name>` is the Crowded Kingdoms gamertag.

| Command | What it does |
| --- | --- |
| `/ck player <name> info` | The player, including the id an admin uses to grant video |
| `/ck player <name> disable` | Ends that player's sessions and refuses new ones |
| `/ck player <name> enable` | Allows sign-in again |
| `/ck player <name> signout` | Ends that player's sessions everywhere |
| `/ck player <name> forget` | Deletes that Crowded Kingdoms player and their content |
| `/ck player <name> age` | Whether they answered, and the age bracket. Not the month |
| `/ck player <name> reask` | Clears the answer. An online player is disconnected to answer again on rejoin |
| `/ck status` | Whether this server is in the shared world, and why not |
| `/ck cluster` | Which chunks this server runs, and which side the player is on |

A player deletes their own Crowded Kingdoms player with `/ck forget confirm`. The next time they
join, they start a new one.

## Age and country

The first time a vetted player joins, a chest menu asks the month and year they were born, then
asks them to confirm it. Nothing is picked for them. They are not in the shared world until they
answer. Closing the menu leaves them out. `/ck age` opens it again.

The month and year stay on that server. Crowded Kingdoms is told the age in whole years.

A player under 13 is disconnected with "You can't play on this server." and turned away each time
they return. The server does not keep the month they gave.

A player from 13 to 17 is turned away from the shared world. Crowded Kingdoms does not yet take an
age at sign-in, and the organization still answers for its players being 18 or older. The server
tells them "You can't enter the shared world from this server."

Put a country database at `geoip.countryDatabase`, as in the file above. The path is relative to
the server folder, or absolute. A replaced file is read again within a minute. Either
[DB-IP IP to Country Lite](https://db-ip.com/db/download/ip-to-country-lite) (CC BY 4.0; credit
"IP Geolocation by DB-IP", linked to [db-ip.com](https://db-ip.com), where the server is presented)
or MaxMind GeoLite2 Country works. The server tells Crowded Kingdoms the two-letter country of the
address the player connected from. It does not send or store that address. Behind a proxy, the
address it sees is the proxy's.

Direct messages and mail between players who are not friends follow `directMessages` in the config
file. `nonFriendsUnder18` applies to players under 18 and to players whose age is not known, and it
is off. `nonFriendsAdults` is on. A message passes only when both players' switches allow it.
Friends are unaffected. Friend requests still pass.

## Several servers, one world

Each server is its own process, with its own public hostname, and it stays running. A server that
is asleep cannot take a player the others send. Copy the same secrets, the same seed, and the same
world settings onto every server. The same `CROWDY_ID_PEPPER` is required on every server, and so
is `CROWDY_CLUSTER_SECRET`: 32 or more random characters, one value you generate
(`openssl rand -base64 32` prints one) and copy to every server. Set `accepts-transfers=true` in
`server.properties`.

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

Publish that default hostname. Players can join either hostname. A player who joins one server is
sent to the server that owns the spot they last stood, before they spawn. If that server is down,
they are told so.

`margin_blocks` is how far past the line a player walks before they change server. At 8, that is
eight blocks. The change is Minecraft's own transfer: a short reconnect, about two seconds, to
that server's `address`. They keep their inventory, health, experience, advancements, statistics,
and position, including a horse or boat they are riding and the pets and leashed mobs with them.
A player record over 1 MiB cannot cross until they put things away.

Animals, villagers, dropped items, experience orbs, empty boats and minecarts, and armor stands
cross on their own. Monsters, projectiles, and TNT stay on the server that was ticking them.

Each server draws terrain past its range, from the same seed, and shows player-made blocks copied
through Crowded Kingdoms. Crops, fluids, and mobs run only on the server that owns the chunk.

A cluster file that does not work lets nobody in. A player is asked their age once for the world.
