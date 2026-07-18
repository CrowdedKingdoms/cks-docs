---
sidebar_position: 18
title: Avatar state
---

# Avatar state

An **avatar** is a character/identity a player owns. A player can own several
avatars. Each avatar carries state that other players can read, with writes
restricted to the owner.

> Looking for the in-world character instances that move around (with a
> position)? See [Actor state](actor-state). An actor can reference an avatar.

There are two kinds of avatar state:

- **Global avatar state** — `publicState` and `privateState` on the avatar
  itself, shared across your games.
- **Per-app avatar state** — a state blob scoped to a single app, for
  game-specific data.

In both cases the rule is the same: **only the owner can write; everyone can read
the public parts.** All operations run on the Game API and require an **app-scoped
token** for the app (`Authorization: Bearer <token>`; mint one with
`mintAppToken` — see **[Authentication](/game-api/authentication)**).

State values are base64-encoded binary, so you can store whatever your client
encodes.

## Global public/private state

```graphql
mutation {
  updateAvatarState(id: "5", input: {
    publicState: "AAEC",      # visible to everyone
    privateState: "BQYH"      # visible only to the owner
  }) { avatarId }
}
```

Reading:

- `avatar(id)` — returns the avatar. The owner sees `privateState`; everyone else
  sees `publicState` only (`privateState` is stripped).
- `userAvatars(userId)` — lists a player's avatars. Non-owners receive
  public state only.
- `myAvatars` — your own avatars (full state).

## Per-app avatar state

Use per-app state for data that only matters inside one game — cosmetics
unlocked, a class loadout, a score, etc.

Write (owner only):

```graphql
mutation {
  updateAvatarAppState(input: {
    appId: "1", avatarId: "5",
    state: "AAEC"   # base64; null clears it
  }) { appId avatarId state updatedAt }
}
```

Read (any player):

```graphql
query { avatarAppState(appId: "1", avatarId: "5") { state updatedAt } }

query {
  avatarAppStates(appId: "1", avatarIds: ["5", "6", "7"]) { avatarId state }
}
```

`avatarAppStates` is a batch read — efficient when rendering many nearby players.

## Ownership rules at a glance

| Operation | Who can call |
| --------- | ------------ |
| `updateAvatarState`, `updateAvatarAppState`, `updateAvatar`, `deleteAvatar` | The avatar's owner only |
| `avatar`, `userAvatars` | Anyone (private state hidden from non-owners) |
| `avatarAppState`, `avatarAppStates` | Anyone (public) |

## Reference

See the [Game API GraphQL reference](/game-api/reference/graphql/graphql-overview)
for the exact inputs and return types.
