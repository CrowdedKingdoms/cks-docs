---
sidebar_position: 20
title: Game Models
---

# Game Models

Game Models let you put your game's **rules and state on the server**. Instead of
every client agreeing on what happens, you describe your game once as data and
the server owns the state, evaluates the logic, and records every change. It is
deliberately engine-agnostic: the server only knows three primitives.

- **Container** — any typed, named object in your game: a character, an item, a
  spell, a quest, an inventory, a battle. A container has a `typeName` (the
  class) and a `displayName` (the instance), and holds properties.
- **Property** — a typed key/value on a container instance. Health, mana,
  position, gold, equipped weapon — all properties. Types: `int`, `float`,
  `string`, `bool`, `array`, `object`, `container_ref` (a reference to another
  container).
- **Function** — a named, parameterized operation that reads properties from any
  container and produces an ordered set of property writes plus an optional
  return value. Functions are your game logic. They run in a transaction: either
  every write applies or none do.

This pairs well with turn-based games (RPGs, tactics, card and board games) but
works for anything where the server should be the source of truth. For worked
mappings of familiar features — inventory, keys/doors/chests, land permissions,
NPCs — onto these primitives, see
[Modeling game concepts](modeling-game-concepts).

All Game Model operations live on the **Game API** GraphQL endpoint and require an
**app-scoped token** for the app (`Authorization: Bearer <token>`; mint one with
`mintAppToken` — studio admins can mint for their own app even without player
entitlement). Studio/authoring operations additionally require the `manage_apps`
permission on the app — that is the **only** extra gate. It is checked against the
calling user on that app-scoped token (the server verifies it with the Management
API; the client sends nothing special), so any trusted admin context can author
the model: a studio backend
**or** your own admin-only / authenticated web tool — a browser is fine. The only
rule is to keep that privileged token out of the untrusted client you ship to end
users.

JSON-typed values (property values, parameters, metadata, invoke policies) are
passed and returned as **JSON-encoded strings** — the fields ending in `Json`.
Your client `JSON.parse`s / `JSON.stringify`s around them.

## Defining your model (studio)

As an app admin you declare container types, their property schemas, and your
functions. You can do it field-by-field or in one `gameModelSeed` call.

```graphql
mutation {
  gameModelSeed(input: {
    appId: "1",
    containerTypes: [
      { typeName: "Character", displayName: "Character", instantiableBy: "member" },
      { typeName: "Attack", displayName: "Attack", instantiableBy: "admin" }
    ],
    propertyDefinitions: [
      { containerTypeName: "Character", key: "hp",  valueType: "int", defaultValueJson: "100", visibility: "public" },
      { containerTypeName: "Character", key: "str", valueType: "int", defaultValueJson: "10",  visibility: "public" },
      # A hidden stat is never returned to players (see Property visibility).
      { containerTypeName: "Character", key: "secret_weakness", valueType: "string", visibility: "hidden" }
    ],
    functions: [
      {
        name: "attack",
        containerTypeName: "Character",
        returnType: "int",
        parameters: [
          { name: "target_id", valueType: "container_ref", required: true },
          { name: "base_power", valueType: "int", required: false, defaultValueJson: "5" }
        ],
        mutations: [
          { target: "ref($target_id)", property: "hp",
            expression: "max(0, ref($target_id).hp - (self.str + $base_power))" }
        ],
        returnExpression: "ref($target_id).hp",
        invokePolicyJson: "{\"type\":\"and\",\"rules\":[{\"type\":\"owner_of_self\"},{\"type\":\"is_current_turn\"}]}"
      }
    ]
  }) { containerTypesCreated propertyDefinitionsCreated functionsCreated warnings }
}
```

`warnings` reports non-fatal static-analysis notes (for example, a function that
reads `self.someKey` you never declared, or a `$param` you never listed). Your
expressions are compiled when you upload them; a syntax error is rejected with a
position so you can fix it.

Individual authoring operations also exist: `gameModelUpsertContainerType`,
`gameModelUpsertPropertyDef`, `gameModelUpsertFunction`,
`gameModelDeleteContainerType`, `gameModelDeletePropertyDef`,
`gameModelDeleteFunction`. Deleting a container type also removes its property
definitions, but refuses if live containers of that type still exist or if
functions are bound to it — delete those first. Deleting a property definition
does **not** strip instance values already stored on containers.
For tooling and autocomplete, read your model back with
`gameModelTypeSchema(appId, typeName)`, `gameModelContainerTypes(appId)`,
`gameModelPropertyDefs(appId, typeName)`, `gameModelFunctions(appId)`, and
`gameModelFunction(appId, name)`.

### The expression language

Expressions are small, **pure** (read-only) arithmetic-and-logic. Writes happen
only through a function's `mutations` list, never inside an expression.

- Literals: `42`, `3.14`, `"text"`, `true`, `null`
- Property reads: `self.hp`, `ref("<container-uuid>").hp`, `ref($target_id).hp`
- Parameters: `$damage`
- Operators: `+ - * / %`, `== != < > <= >=`, `&& || !`
- Conditional: `if(self.hp > 0, self.hp - $dmg, 0)`
- Builtins: `max min abs floor ceil round clamp pow sqrt len concat to_int
  to_float to_string rand rand_int not is_null coalesce`
- Call another function's return value (read-only): `fn:level_bonus(self.level)`

Within one invocation, a later mutation sees the values written by earlier
mutations.

## Authority: deciding who may invoke a function

Every function carries an **invoke policy** — a small boolean tree of
requirements you combine with `and` / `or` / `not`. App admins always bypass it;
an absent policy means any entitled player may invoke. You can mix authority
sources freely:

- `owner_of_self` — the caller owns the `self` container (e.g. "only act on your
  own characters").
- `is_current_turn` — it is the caller's turn in the session.
- `is_host` — the caller is the app's elected [host](host-discovery).
- `is_participant` — the caller is a participant of the session.
- `is_automation` — the call is driven by an [autonomous process](autonomous-processes)
  (an automation / NPC), not a player. Gate a function to automations only, or
  branch logic on caller kind.
- `tier_feature` — the caller's access tier unlocks a named feature (premium
  abilities, etc. — see [Tier-gated features](#tier-gated-features)).
- `group_permission` — the caller holds a permission in a [team/group](teams)
  (e.g. a GM role can invoke admin functions).
- `grid_permission` — the caller holds a runtime [grid](grids-and-permissions)
  permission (optionally on a specific grid), tying logic to world regions.
- `condition` — an arbitrary expression that must evaluate to `true`. It can read
  `self`, the call's params, and the injected values `$caller_user_id`,
  `$current_turn_user_id`, `$self_owner_id`, `$session_id`.

```json
{ "type": "and", "rules": [
  { "type": "owner_of_self" },
  { "type": "is_current_turn" },
  { "type": "tier_feature", "feature": "premium_abilities" }
] }
```

Some leaves carry fields: `tier_feature` takes a `feature` key; `group_permission`
takes a `groupId` (and optional `permission`); `grid_permission` takes a `key`
(and optional `gridId`); `condition` takes an `expression`. For example, "a member
holding the `manage_group` permission in team 42, acting inside grid 7":

```json
{ "type": "and", "rules": [
  { "type": "group_permission", "groupId": "42", "permission": "manage_group" },
  { "type": "grid_permission", "key": "update_voxel_data", "gridId": "7" }
] }
```

Functions also have an `invokeScope`: `player` (default, directly callable),
`server` (admins only), or `internal` (only reachable via `fn:` from another
function). A separate opt-in flag, `autonomousInvocable`, controls whether a
[server-driven automation](autonomous-processes) (an NPC / autonomous process)
may use the function as an entry point — players are unaffected by it.

## Property visibility

Each property declares a `visibility`:

- `public` — readable by anyone who can read the container.
- `owner` — readable only by the container's owner (and app admins).
- `hidden` — never returned to players; server-only (secret stats, RNG seeds).

`gameModelContainerState` returns only the properties the caller may see.

## Writable properties and direct writes

By default every property is written **only** through a function's `mutations` —
its `writable` is `function`. You can instead let a property be set directly,
without a function:

- `function` (default) — only function mutations may write it.
- `owner` — the container's owner may set it directly.
- `admin` — only app admins may set it directly.

Declare it on the property definition (`writable: "owner"`), then set it with
`gameModelSetProperty`:

```graphql
mutation {
  gameModelSetProperty(input: {
    appId: "1", containerId: "<character-uuid>",
    key: "display_name", valueType: "string", valueJson: "\"Aria\""
  }) { containerId }
}
```

Use direct writes for player-controlled, non-authoritative fields (a cosmetic
name, a UI preference); anything that must enforce rules belongs in a function.
Direct writes are **not** recorded in the event log, so pair them with a
[change notification](#reacting-to-changes) when other players need to know.

## Sessions, ownership, and turns

State can be **app-global** (a persistent world) or scoped to a **session** — a
battle, match, save, or party. Many sessions run concurrently from one model.

```graphql
mutation {
  gameModelCreateSession(input: {
    appId: "1", name: "Skirmish", participantUserIds: ["90001", "90002"]
  }) { sessionId }
}
```

Who may create sessions is set per app with `gameModelSetPolicy`
(`sessionCreationPolicy`: `admin` | `member` | `anyone`). `member` requires app
access; `anyone` lets any logged-in user create one (handy for open lobbies).
Players join with `gameModelJoinSession`; list sessions with
`gameModelSessions(appId, status)` and read one with
`gameModelSession(appId, sessionId)`.

Containers can have an **owner** (`ownerUserId`) which powers `owner_of_self` and
owner-only visibility. Create instances with `gameModelCreateContainer`
(allowed per the type's `instantiableBy`: `admin` | `member` | `owner`).
Delete an instance with `gameModelDeleteContainer` (app admin or the container
owner); that cascades its properties and any connected edges.

On create, default ownership follows the type's **`instantiableBy`**, not whether
the caller happens to be an app admin. For player-owned types (`member` /
`owner`), **omit `ownerUserId`** so the server assigns the caller — clients
cannot claim someone else's container, and `owner_of_self` / owner-only
visibility work as intended. Admin-instantiable types stay shared (`null`)
unless an admin or automation sets an owner explicitly.

| `instantiableBy` | Omit `ownerUserId` | Explicit `ownerUserId` |
| --- | --- | --- |
| **member** / **owner** | Defaults to **caller** | Admins may set; non-admins cannot set another user |
| **admin** | Stays **null** (shared/world) | Admin/automation may set explicitly |

Turns are explicit and developer-driven: `gameModelSetSessionTurn` records whose
turn it is (the current turn holder, the elected host, or an app admin may set
it), and the `is_current_turn` requirement reads it. You implement your own turn
order; the server just enforces it.

## Invoking a function

```graphql
mutation {
  gameModelInvoke(input: {
    appId: "1",
    functionName: "attack",
    selfContainerId: "<your-character-uuid>",
    sessionId: "<session-uuid>",
    paramsJson: "{\"target_id\":\"<enemy-character-uuid>\"}"
  }) {
    success
    returnValueJson
    errorMessage
    mutationsApplied { key oldValueJson newValueJson }
  }
}
```

If authority fails you get an authorization error. If the logic errors (e.g.
arithmetic on a missing value) the transaction is rolled back, `success` is
`false`, and the attempt is still recorded.

## Reading state and the graph

- `gameModelContainer(appId, containerId)` — container metadata.
- `gameModelContainerState(appId, containerId)` — visible properties as a JSON
  object.
- `gameModelContainers(appId, typeName, sessionId)` — list instances.
- `gameModelTraverse(appId, rootId, relationshipType, depth)` — walk the
  container graph (edges created with `gameModelAddEdge` / removed with
  `gameModelDeleteEdge`), e.g. an inventory's items or a tech tree. `depth` is
  clamped to a maximum of 5.

## Reacting to changes

Every successful invocation is recorded — whether a player or a server-driven
[automation](autonomous-processes) made it (events carry `callerKind` and
`automationId`). Clients **pull** the authoritative state from the model API —
there is no server-push subscription. Poll the event log with `gameModelEvents`
(filter by session, container, function, success):

```graphql
query { gameModelEvents(appId: "1", sessionId: "<session-uuid>") {
  functionName success callerUserId returnValueJson executedAt
} }
```

Re-read `gameModelContainerState` / `gameModelContainers` after a change to get
the new values.

### Notify clients to pull

To avoid blind polling, have the **acting** client send a lightweight
"model changed" ping over the realtime path; peers then re-pull the model. The
ping carries no authoritative state — the model API stays the source of truth.

- **Recommended — channels.** Publish a small message to a [channel](channels)
  (for example, one per session) with `sendChannelMessage`. Every channel member
  gets a `ChannelMessageNotification` wherever they are in the world, then calls
  `gameModelContainerState` / `gameModelEvents` to fetch the change. Best for
  turn-based and session-scoped games whose participants aren't near each other.
- **Alternative — spatial client events.** If the change is tied to a world
  location and only nearby players care, send a client event
  ([`sendClientEvent`](/game-api/graphql-udp-proxy-api), chunk + distance) so
  nearby players get a `ClientEventNotification` and re-pull.

Both paths are wrapped by CrowdyJS; see
[CrowdyJS → Game Models](/crowdyjs/game-model) for the SDK pattern.

## Tier-gated features

Sell or gate abilities by access tier. Define a feature key for your app, then
grant it to the tiers that should unlock it; the `tier_feature` requirement then
passes only for players on a granting tier.

```graphql
mutation { gameModelDefineFeature(input: {
  appId: "1", featureKey: "premium_abilities"
}) { featureKey } }

mutation { gameModelGrantTierFeature(input: {
  appId: "1", tierId: "<tier-id>", featureKey: "premium_abilities"
}) { featureKey } }
```

Revoke a grant with `gameModelRevokeTierFeature` (same input shape), and list an
app's features and grants with `gameModelFeatures(appId)` and
`gameModelTierFeatures(appId, tierId)`.

Feature keys are specific to your app and independent of the built-in runtime
permission keys used for [grids](grids-and-permissions).
