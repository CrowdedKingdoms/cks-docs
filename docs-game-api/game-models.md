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
[Modeling game concepts](modeling-game-concepts). The expression language is
deliberately loop-free; when your server logic outgrows it (pathfinding, world
simulation, heavy computation), pair your model with a Rust
**[Compute Module](/game-api/compute-modules)** — modules read and write the
same containers and properties through a server-side host API.

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
- List builtins (see [Lists](#lists)): `at set_at append remove_at index_of
  array`
- Permission/grid reads (see
  [Reading permissions from expressions](#reading-permissions-from-expressions)):
  `has_grid_permission has_chunk_permission grid_at grid_contains grid_min
  grid_max`
- Call another function's return value (read-only): `fn:level_bonus(self.level)`

Within one invocation, a later mutation sees the values written by earlier
mutations.

**Argument counts are checked when you upload the function**, not when a player
calls it, and the error names what the builtin takes. Two long-standing spellings
are refused by this: `max` and `rand_int` take exactly two arguments, and `rand`
takes none, so `max(self.hp)` and `rand(1)` are rejected at upload. They never
worked at runtime either — only the moment you find out has changed. Stored
functions are not re-checked, so an existing app keeps running until the next time
it re-uploads a function that was already broken.

### Lists

Array properties have six builtins. All of them are pure: they return a new list
and never modify the one you passed.

| Builtin | Returns |
| --- | --- |
| `at(list, i)` | the item at index `i`; an error if `i` is out of range |
| `set_at(list, i, v)` | the list with index `i` replaced by `v` |
| `append(list, v)` | the list with `v` added at the end |
| `remove_at(list, i)` | the list with index `i` removed; an error if out of range |
| `index_of(list, v)` | the index of the first `v`, or **-1** if it is not there |
| `array(v1, v2, …)` | a new list of the arguments; `array()` is the empty list |

**A property that was never written reads as nothing, and every one of these
treats that as the empty list.** So `append(self.members, $caller_user_id)` on a
brand-new container stores a one-item list rather than failing, `index_of` on it
returns -1, and `at` on it returns nothing. The one exception is `remove_at`,
which is an out-of-range error, because removing index 0 of an empty list has no
answer. A list that a function did not change is never written back as `[]`.

`index_of` compares values exactly the way `==` does, so
`index_of(l, x) >= 0` and a `==` test over the same values can never disagree.

**There is a 1000-item cap per list, and it is enforced inside the builtins**
rather than at the point of storage — `append` onto a 1000-item list is refused
with an error naming the cap even when your expression was going to discard the
result, because a bounded stored value does not bound the work of building an
oversized one. `array(...)` and `set_at` enforce it identically. At the sizes a
game actually uses (a camp's members, a squad, inventory slots) you will not come
near it: an append onto a 990-item list costs about 2 ms end to end, most of that
the database read.

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
  `$current_turn_user_id`, `$self_owner_id`, `$session_id`,
  `$self_container_id`.

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

### Ensured containers (atomic get-or-create)

When N clients all need the **same shared container** — one boss, one chest,
one world object every connected player sees identically — use
`gameModelEnsureContainer` instead of electing a leader to
create-then-search. It atomically gets-or-creates a container keyed by an
opaque, client-derived **`bindingKey`** (≤ 128 chars), unique per
`(appId, typeName, sessionId)`; a `null` session scopes the key app-globally:

```graphql
mutation {
  gameModelEnsureContainer(input: {
    appId: "1",
    typeName: "TitanAssaultAttributes",
    bindingKey: "boss:titan-1",
    # used ONLY when this call creates the row:
    displayName: "Boss",
    metadataJson: "{\"tier\":3}"
  }) {
    container { containerId typeName bindingKey ownerUserId }
    created   # true for exactly ONE of any set of concurrent ensures
  }
}
```

- **Atomic under concurrency.** Any number of simultaneous ensures of the same
  key converge on one row (a partial unique index is the arbiter); all callers
  get the same `containerId` and exactly one response carries `created: true`.
  Duplicate rows are impossible by schema, and the object can be ensured with
  zero players connected (e.g. by a deploy tool).
- **Exists ⇒ read.** When the row already exists the ensure behaves like a
  read: creation-only fields (`displayName`, `description`, `metadataJson`,
  `properties`, `ownerUserId`) are ignored and the type's `instantiableBy` is
  not enforced.
- **Not-exists ⇒ create.** Creation is authorized like
  `gameModelCreateContainer` (`instantiableBy` + the ownership rules above)
  **and** by the type's `bindPolicy` (below), so a caller who may not
  instantiate the type, or may not claim keys for it, errors only in the
  not-exists case.
- **Read back by key.** `bindingKey` is returned on the container object, and
  `gameModelContainers(appId, typeName, bindingKey, ...)` is the get-by-key
  read.

#### Who may CLAIM a key: `bindPolicy`

**Read this before using an ensured container for anything shared.**

`bindingKey` is supplied by the client, and whoever creates the keyed row
becomes its **owner**. On a `member`- or `owner`-instantiable type that means
any entitled player can claim a key before its rightful user does — and because
`owner_of_self` reads `ownerUserId` off that same row, the squatter then passes
every `owner_of_self` invoke policy on the type and the legitimate player is
refused. The invoke policy does not protect you here; it is the thing that gets
inverted.

Two ways to close it, and a shared object needs one of them:

1. **An admin-instantiable type.** Existing rows stay readable by everyone,
   while only app admins and automations can create the keyed row.
2. **A `bindPolicy` on the container type.** Same JSON shape as a function's
   `invokePolicyJson` — the same `AuthorityRule` tree, evaluated the same way:

```graphql
mutation {
  gameModelUpsertContainerType(input: {
    appId: "1",
    typeName: "TitanAssaultAttributes",
    displayName: "Boss attributes",
    instantiableBy: "member",
    bindPolicyJson: "{\"type\":\"is_host\"}"
  }) { typeName bindPolicyJson }
}
```

- **Omit it and nothing changes.** No `bindPolicy` means binding is governed by
  `instantiableBy` alone, which is how ensured containers behaved before the
  field existed.
- **It governs creation only.** Resolving a key that already exists is a read
  and is never refused by a bind policy — otherwise no client could see a
  shared object it did not create.
- **App admins bypass it**, exactly as they bypass invoke policies.
- **Three requirements are refused**, because a bind is what *creates* the
  container and there is no acting container to resolve them against:
  `owner_of_self`, `is_current_turn` and `condition`. You get a `BAD_REQUEST`
  naming the leaf when you author one. Everything else composes as usual:
  `is_host`, `is_participant`, `is_automation`, `group_permission`,
  `grid_permission`, `tier_feature`, `allow`, and `and` / `or` / `not`.
- **Per-player containers.** If your key identifies a *player's* object rather
  than a world object, `{"type":"is_participant"}` limits claims to the session,
  but it does not stop one participant claiming another's key. For that, derive
  the key server-side or make the type admin-instantiable and ensure it from an
  automation.

**Rolling one out onto a live game.** Adding a `bindPolicy` to a type whose
players are already binding keys can refuse the very players it is meant to
protect. Set `GM_BIND_POLICY_MODE=shadow` on the tier first: a bind the policy
*would* have refused is admitted and counted on the type, and
`scripts/report-bind-policy-shadow.mjs` prints the count. A policy at zero
refusals is safe to enforce; one that is accumulating them is refusing real
players. The default is `enforce`, and an unrecognised value falls back to
`shadow`.

Turns are explicit and developer-driven: `gameModelSetSessionTurn` records whose
turn it is (the current turn holder, the elected host, or an app admin may set
it), and the `is_current_turn` requirement reads it. You implement your own turn
order; the server just enforces it.

## Active player count (app-scoped sessions)

`gameModelActivePlayerCount` reports an app-wide gauge of active **app-scoped
gameplay sessions**. It is not a count of distinct users, actor rows,
game-model sessions, host candidates, or load on one game server. A user with
two overlapping gameplay sessions can therefore contribute two to the count.

Both the snapshot and subscription require
`Authorization: Bearer <app-token>`, and that token's app scope must match
`appId`.

```graphql
query ActivePlayerCount {
  gameModelActivePlayerCount(appId: "1") {
    appId
    activePlayerCount
    status
    observedAt
    revision
  }
}
```

`activePlayerCount` is always the best-known count; interpret it together with
`status`:

- **`FRESH`** — the observation is complete and authoritative.
- **`PARTIAL`** — some current telemetry is missing, so the count is useful as
  a best-known value but is not authoritative.
- **`UNAVAILABLE`** — a current authoritative observation is unavailable. The
  returned count is still best-known, not proof that nobody is active.

`observedAt` is nullable when no observation time is available. Never turn a
`PARTIAL` or `UNAVAILABLE` result, missing telemetry, or a null `observedAt`
into an authoritative zero.

Once counted, a gameplay session remains active until explicit disconnect or
deauthorization, token expiry, or inactivity expiry. An abandoned session can
remain visible for roughly 120 seconds plus observation latency. A quick
reconnect can briefly overlap the old session and count twice, so this gauge is
appropriate for presence, scaling hints, and automations—not billing or
distinct-user analytics.

Subscribe for post-observation changes:

```graphql
subscription ActivePlayerCountChanged {
  gameModelActivePlayerCountChanged(appId: "1") {
    appId
    previousCount
    currentCount
    delta
    revision
    observedAt
  }
}
```

Delivery is best-effort and the stream is not an initial snapshot. On startup,
open the subscription and immediately query `gameModelActivePlayerCount`;
deduplicate snapshot/change data by `revision`. Re-query after reconnect and
whenever revisions indicate a gap. The snapshot's `status` remains the
authority on freshness; receiving a change does not imply that later snapshot
telemetry is `FRESH`.

An app admin can feed the same transitions into an
[`onEvent: "player_count_changed"` automation](autonomous-processes#player-count-changes).

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

## Concurrency: two players writing the same property

A mutation reads the property's old value, evaluates your expression, and writes
the result. When two invocations of that overlap, the naive outcome is that both
compute from the same starting value and the second write silently replaces the
first — both callers are told they succeeded and one of them is not there.

**The engine prevents that, for every mutation, and you do not have to do
anything to get it.** No version numbers, no retry loop, no locking of your own.
There are two mechanisms and the difference between them is worth knowing, because
it is the difference between *exactly-once* and *correct but serialised*.

### The four shapes that are atomic

These compile to a single database statement that recomputes from the row's own
live value, so a caller that loses the race re-evaluates against what the winner
actually committed. No lock is taken and nothing is retried.

| What you write | Guarantee |
| --- | --- |
| `p = if(index_of(p, X) < 0, append(p, X), p)` | **exactly-once** — add to a set |
| `p = if(index_of(p, X) >= 0, remove_at(p, index_of(p, X)), p)` | **idempotent** — remove one entry |
| `p = append(p, X)` | lossless, but see below |
| `p = p + N` / `p = p - N`, integers | lossless |

Both orderings of each conditional work (`if(absent, add, p)` and
`if(present, p, add)`), as do the equivalent spellings of the bound (`< 0`,
`== -1`, `<= -1`; `>= 0`, `!= -1`, `> -1`). `X` must be an `int`, `string`, `bool`
or `null` — which covers `$caller_user_id`, the case this exists for.

```
// enter: exactly-once, however many players arrive in the same instant
self.members = if(index_of(self.members, $caller_user_id) < 0,
                  append(self.members, $caller_user_id),
                  self.members)

// leave: removes one entry, and does nothing if they were not in it
self.members = if(index_of(self.members, $caller_user_id) >= 0,
                  remove_at(self.members, index_of(self.members, $caller_user_id)),
                  self.members)
```

Written that way, a player who sends enter three times because their connection
flapped is in the camp once, and a disconnect that fires leave twice removes one
entry.

### Everything else is protected by a lock

Any other mutation that **reads the property it writes** takes a short lock on the
container row before the first read, so the guarantee is unconditional rather than
a property of the shape you happened to write. That includes a guard that is not
the containment test, a `set_at` or `remove_at` at a literal index, anything that
reads a *different* property to decide this one's value, and anything routed
through `fn:`. A write that does **not** read what it writes takes nothing —
there is no update to lose.

You do not have to know which branch you are on to be correct. The reason to
prefer the guarded form anyway is contention: the lock is held across an
evaluation, so callers to one hot container queue, and it is the locked path where
a busy refusal becomes likely.

### What you still must not assume

- **A bare `append` is not exactly-once.** It will not lose anyone's entry, but it
  will happily add the same player twice if they send enter twice. That is
  `append` doing what it says. Use the guarded form whenever "already there?"
  matters.
- **Two properties written by one function are atomic together; two separate
  invokes are not.** If a `members` list and a `headcount` must agree, write them
  in the same function — they commit or roll back together. Across two invokes
  there is no such guarantee and no way to give you one.
- **A very hot single property still has a ceiling.** Writes to one row are
  serialised by the database and a call has a time budget, so beyond a certain
  rate some callers are **refused rather than served late**. The refusal is
  *ours*: `blame: PLATFORM`, `retryable: true`, it does not count against your
  function and it never arrives as "your code timed out". Retrying is the correct
  response. Unlike an authority denial or an evaluation failure — which come back
  in band as `success: false` with a `fault` — this one is a thrown error, so read
  it from `errors[].extensions` (see [Error codes](/overview/error-codes)). If a single
  list is genuinely taking hundreds of writes a second, split it: per squad, per
  region, per shard of the roster.
- **Order within a list is not stable under concurrency.** Two players entering
  together land in an order nobody controls. Never use a position as identity —
  use `index_of`.

## Reading state and the graph

- `gameModelContainer(appId, containerId)` — container metadata.
- `gameModelContainerState(appId, containerId)` — visible properties as a JSON
  object.
- `gameModelContainers(appId, typeName, sessionId, bindingKey, where, limit, offset)` —
  list instances. `bindingKey` narrows to a container
  [ensured](#ensured-containers-atomic-get-or-create) under that key.
  `where` (requires `typeName`) filters by up to 8
  AND-combined property predicates `{ key, op, valueJson }` — ops `==`,
  `!=`, `<`, `>`, `<=`, `>=`; missing properties fall back to the type
  default (the same predicate shape [automation
  selectors](autonomous-processes#selectors-choosing-targets-from-model-data)
  use). `limit`/`offset` page after filtering over the stable created-at
  ordering:

```graphql
query {
  gameModelContainers(
    appId: "1", typeName: "Unit",
    where: [{ key: "team", op: "==", valueJson: "\"red\"" },
            { key: "hp", op: ">", valueJson: "0" }]
    limit: 20
  ) { containerId displayName }
}
```
- `gameModelTraverse(appId, rootId, relationshipType, depth)` — walk the
  container graph (edges created with `gameModelAddEdge` / removed with
  `gameModelDeleteEdge`), e.g. an inventory's items or a tech tree. `depth` is
  clamped to a maximum of 5.

## Reacting to changes

Every successful invocation is recorded — whether a player or a server-driven
[automation](autonomous-processes) made it (events carry `callerKind` and
`automationId`). Clients **pull** the authoritative state from the model API;
the `gameModelContainerChanged` subscription (below) tells you *when* to pull.
Poll the event log with `gameModelEvents`
(filter by session, container, function, success):

```graphql
query { gameModelEvents(appId: "1", sessionId: "<session-uuid>") {
  functionName success callerUserId returnValueJson executedAt
} }
```

Re-read `gameModelContainerState` / `gameModelContainers` after a change to get
the new values.

### Tracing a flow

Every event carries a nullable `flowId`: a correlation id (UUID) minted at
the **entry edge** of a request — a player `gameModelInvoke`, an
[automation](autonomous-processes) run, or a
[`computeInvoke`](compute-modules) — and propagated across `model_invoke`,
the event bus, and `emit_event` cascades. The same id lands on the
`gameModelEvents` rows, the `gameModelAutomationRuns` rows, and the
[`computeModuleRuns`](compute-modules#monitoring) rows a single cause
produced, so a cross-engine chain like *mob kill → compute event → reward
grant* is one correlated trace instead of three uncorrelated records.

Stitch a flow into one timeline with `gameModelFlow` (a diagnostics surface;
requires app-admin `manage_apps`, like `gameModelAutomationRuns`). Take the
`flowId` from any event or run row:

```graphql
query { gameModelFlow(appId: "1", flowId: "<flow-uuid>") {
  flowId
  events         { functionName callerKind success executedAt }
  automationRuns { automationName triggerSource success startedAt }
  moduleRuns     { moduleName triggerSource success errorMessage startedAt }
} }
```

Each array is ordered by time ascending; an unknown `flowId` returns three
empty arrays. Ticks mint their own flow id per batch, so tick-driven cascades
correlate too. The SDKs expose this as `client.gameModel.flow({ appId,
flowId })` (CrowdyJS 8.13+) / `gameModel().flow(appId, flowId)` (CrowdyCPP
0.9+), and their default event/run selections include `flowId`.

### Push: the container-change subscription

Instead of interval polling, subscribe to `gameModelContainerChanged` over
graphql-transport-ws (the same WebSocket path as `udpNotifications`):

```graphql
subscription {
  gameModelContainerChanged(appId: "1", typeName: "Npc") {
    containerId typeName sessionId source functionName changedKeys occurredAt
  }
}
```

Events fire post-commit whenever a container changes — an invoke mutated it
(`source: "function"`), a direct `gameModelSetProperty` wrote it
(`"direct"`), or it was `"created"` / `"deleted"`. Delivery is **metadata
only** (which container, which keys — never property values), so visibility
rules need no per-subscriber filtering: pull the filtered state with
`gameModelContainerState` on receipt. Semantics are best-effort like
[model-driven notifications](model-driven-notifications) — a dropped event
costs one missed pull, never correctness; events fan out across all API
replicas. CrowdyJS exposes this as `client.gameModel.containerChanged(...)`
(pass `webSocketImpl` on Node ≤ 21).

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

## Reading permissions from expressions

Expressions can also **read** the runtime grid ACL and the grid layout, so a
single function can branch on where a player may act — not just be
allowed/denied as a whole by the invoke policy. Six DB-backed builtins are
available everywhere expressions run (mutations, `returnExpression`,
notification args, permission-effect expressions, and policy `condition`
rules), always scoped to your own app:

| Builtin | Returns | Meaning |
| --- | --- | --- |
| `has_grid_permission(user_id, key)` | bool | The user holds an unexpired runtime permission `key` on **any** grid. |
| `has_grid_permission(user_id, key, grid_id)` | bool | …on that specific grid. |
| `grid_at(cx, cy, cz [, mode])` | int \| null | The grid covering a chunk (null when none does). |
| `has_chunk_permission(user_id, key, cx, cy, cz [, mode])` | bool | Sugar for `has_grid_permission(user, key, grid_at(...))`; false when no grid covers the chunk. |
| `grid_contains(grid_id, cx, cy, cz)` | bool | Whether the grid's box covers the chunk. |
| `grid_min(grid_id, axis)` / `grid_max(grid_id, axis)` | int | The grid's inclusive chunk bounds on `"x"` \| `"y"` \| `"z"`. |

Several grids may cover one chunk (a plot nested inside the world grid), so
`grid_at`/`has_chunk_permission` take an optional **`mode`** choosing the
overlap-resolution algorithm:

- `"first"` (default) — lowest `grid_id`, exact parity with how the
  replication layer picks the enforcing grid.
- `"smallest"` — the innermost, most specific grid (natural for plot logic).
- `"largest"` — the outermost grid.

```graphql
# One door function that decides per-caller, per-location:
mutation {
  gameModelUpsertFunction(input: {
    appId: "1",
    name: "open_door",
    containerTypeName: "Door",
    mutations: [
      { target: "self", property: "is_open",
        expression: "has_chunk_permission($caller_user_id, \"access\", self.cx, self.cy, self.cz, \"smallest\")" }
    ],
    returnExpression: "self.is_open"
  }) { name warnings }
}
```

Semantics worth knowing:

- **Live and transactional.** Reads hit the same materialized ACL the
  replication layer enforces, on the invocation's transaction — and after a
  [permission effect](#permission-effects-functions-that-write-grid-permissions)
  applies inside the same invocation, later expressions observe the new grant
  (read-your-writes).
- **Metered.** Each *uncached* lookup charges an extra 25 gas on top of the
  normal per-node cost; repeats within one invocation are cached and cheap.
  A runaway lookup loop fails the invocation like any other budget breach.
- **Checked at upload.** `gameModelUpsertFunction`/`gameModelSeed` return
  non-fatal `warnings` for wrong argument counts, invalid `mode`/axis
  literals, and permission keys missing from the `runtime_permissions`
  catalog.

## Permission effects: functions that write grid permissions

Invoke policies let model logic *read* the permission systems; **permission
effects** let a function *write* one of them — the runtime
[grid permissions](grids-and-permissions) that govern movement, voxel edits,
teleports, and voice on regions of the world. Declare `permissionEffects` on a
function and every successful invocation grants (or revokes) grid permissions
**in the same transaction** as its property mutations: "pay 100 gold AND get
access to the plot" either both happen or neither does.

```graphql
mutation {
  gameModelUpsertFunction(input: {
    appId: "1",
    name: "buy_plot",
    containerTypeName: "Plot",
    parameters: [
      { name: "wallet_id", valueType: "container_ref", required: true }
    ],
    mutations: [
      # The policy has already verified ownership and price; spend the gold.
      { target: "ref($wallet_id)", property: "gold",
        expression: "ref($wallet_id).gold - self.price" },
      { target: "self", property: "owner_user_id", expression: "$caller_user_id" }
    ],
    permissionEffects: [
      {
        action: "grant",
        permissionKeys: ["access", "update_voxel_data"],
        userExpression: "$caller_user_id",
        gridIdExpression: "self.grid_id"
      }
    ],
    invokePolicyJson: "{\"type\":\"condition\",\"expression\":\"ref($wallet_id).owner_user_id == $caller_user_id && ref($wallet_id).gold >= self.price\"}"
  }) { name permissionEffects { action permissionKeys } }
}
```

Each effect declares:

- **`action`** — `grant` (upsert direct grants) or `revoke` (delete them).
- **`permissionKeys`** — runtime permission keys (`access`, `teleport`,
  `update_voxel_data`, `use_voice_chat`), validated against the
  `runtime_permissions` catalog.
- **`userExpression`** / **`gridIdExpression`** — model expressions resolving
  the target user id and grid id, evaluated in the invocation's (post-mutation)
  context.
- **`ttlSecondsExpression`** — grant only, optional: an expiry in seconds
  (rentals and leases; e.g. `"86400"` for a day).

Semantics and safety:

- **Transactional.** Effects apply after the mutations succeed, on the same
  transaction; a failing effect (unknown key, wrong-app grid, grantee without
  app access, non-integer user/grid) rolls the whole invocation back with
  `success: false`. Contrast with
  [notifications](model-driven-notifications), which are post-commit and
  best-effort.
- **Immediately enforced.** The effect writes the direct-grant input table and
  recomputes the materialized ACL, so Buddy's movement/voxel enforcement and
  every `grid_permission` policy check see the change at commit.
- **System params.** `$caller_user_id`, `$current_turn_user_id`,
  `$self_owner_id`, `$session_id`, and `$self_container_id` (the acting
  container's UUID) are injected into function-body, effect, and
  [notification-arg](model-driven-notifications) expressions (they cannot be
  spoofed by a same-named caller param), so "grant to whoever invoked" is just
  `$caller_user_id`. This applies to your `mutations` expressions too.
- **Bounded.** At most 4 effects per function, each charged against the
  invocation's gas budget; the target user must hold active app access to
  receive a grant; per-grid `grid_permission_limits` still cap what is
  effective.
- **Audited.** Applied effects are recorded on the event
  (`gameModelEvents` → `permissionEffectsAppliedJson`), so every model-driven
  grant/revoke is attributable — including automation-driven ones (an NPC
  quartermaster can grant with `runAsUserId` resolving `$caller_user_id`).

For the worked land-purchase mapping, see
[Modeling game concepts](modeling-game-concepts#custom-permissions-on-game-objects).

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
