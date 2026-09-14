---
sidebar_position: 14
title: Game Model
---

# Game Model

`client.gameModel` is the SDK surface for [Game Models](/game-api/game-models) —
server-authoritative containers, properties, and functions. It targets the Game
API, so every call needs an **app-scoped token** for the target app — drive it
from a per-game client (see [Portals & app-scoped
tokens](/management-api/portals-and-app-tokens)). Studio authoring (`seed`,
`upsertFunction`, …) additionally requires `manage_apps`; a studio admin can
`mintAppToken` for their own app even without player entitlement. The examples
below assume `client` is a per-game client holding that app's app-scoped token.

JSON values cross the wire as JSON-encoded strings (the `*Json` fields), so you
`JSON.stringify` inputs and `JSON.parse` outputs.

## Authoring a model (studio)

Requires `manage_apps` on the app. Seed types, property schemas, and functions
in one call:

```ts
await client.gameModel.seed({
  appId: "1",
  containerTypes: [
    { typeName: "Character", displayName: "Character", instantiableBy: "member" },
  ],
  propertyDefinitions: [
    { containerTypeName: "Character", key: "hp",  valueType: "int", defaultValueJson: "100", visibility: "public" },
    { containerTypeName: "Character", key: "str", valueType: "int", defaultValueJson: "10",  visibility: "public" },
  ],
  functions: [
    {
      name: "attack",
      containerTypeName: "Character",
      returnType: "int",
      parameters: [{ name: "target_id", valueType: "container_ref", required: true }],
      mutations: [
        { target: "ref($target_id)", property: "hp",
          expression: "max(0, ref($target_id).hp - self.str)" },
      ],
      returnExpression: "ref($target_id).hp",
      // Only the unit's owner, only on their turn.
      invokePolicyJson: JSON.stringify({
        type: "and",
        rules: [{ type: "owner_of_self" }, { type: "is_current_turn" }],
      }),
    },
  ],
});
```

Individual helpers exist too: `upsertContainerType`, `upsertPropertyDef`,
`deletePropertyDef`, `deleteContainerType`, `upsertFunction`, `deleteFunction`,
`setPolicy`, `typeSchema`, plus the tier gating `defineFeature` and
`grantTierFeature`. Runtime helpers include `createContainer`,
`deleteContainer`, `addEdge`, and `deleteEdge`.

## Running a session

```ts
// Start a battle with two participants.
const { sessionId } = await client.gameModel.createSession({
  appId: "1",
  name: "Skirmish",
  participantUserIds: ["90001", "90002"],
});

// Omit ownerUserId for member/owner-instantiable types — server defaults to the caller.
const hero = await client.gameModel.createContainer({
  appId: "1", sessionId, typeName: "Character", displayName: "Hero",
  properties: [{ key: "hp", valueType: "int", valueJson: "100" }],
});

// Whose turn it is (drives the is_current_turn authority requirement).
await client.gameModel.setSessionTurn({ appId: "1", sessionId, userId: "90001" });
```

### Roster, admission, host and presence (17.3.0+)

A session carries an authoritative roster, an admission state, a seat cap, a
host and a revision log; the SDK exposes them as thin wrappers over the
[Game API session system](/game-api/game-models#the-session-system-roster-admission-host-presence).

```ts
// A lobby with three seats. The creator is host (hostTerm 1).
const lobby = await client.gameModel.createSession({
  appId, name: "Lobby", maxParticipants: 3, admission: "open",
});

// Join, binding presence to the actor this client replicates with. Keep the
// incarnation: leaveSession requires it.
const me = await client.gameModel.joinSession({
  appId, sessionId: lobby.sessionId, actorUuid: session.self.uuid,
});

// Pull the snapshot, then stream revisions above it.
const snapshot = await client.gameModel.sessionSnapshot({ appId, sessionId: lobby.sessionId });
const stop = client.gameModel.sessionChanged(
  { appId, sessionId: lobby.sessionId, afterRevision: snapshot.revision },
  { next: (event) => console.log(event.revision, event.kind, JSON.parse(event.payloadJson)) },
);

// Host actions carry the term you last read, so a stale host is refused
// (SESSION_HOST_TERM_STALE) rather than acting on a change it has not seen.
await client.gameModel.setSessionAdmission({
  appId, sessionId: lobby.sessionId, admission: "locked", expectedHostTerm: lobby.hostTerm,
});
await client.gameModel.transferSessionHost({ appId, sessionId: lobby.sessionId, toUserId: "90002" });
await client.gameModel.endSession({ appId, sessionId: lobby.sessionId, reason: "completed" });

// Leaving names your incarnation; a superseded client cannot remove the one that took over.
await client.gameModel.leaveSession({ appId, sessionId: lobby.sessionId, incarnation: me.incarnation });
stop();
```

Refusals arrive as `CrowdyGraphQLError` with `code` one of `SESSION_FULL`,
`SESSION_LOCKED`, `SESSION_CLOSED`, `SESSION_ENDED`, `SESSION_NOT_PARTICIPANT`
(you are not joined), `SESSION_TARGET_NOT_PARTICIPANT` (the user you named to
`transferSessionHost` is not joined), `SESSION_INCARNATION_STALE`,
`SESSION_HOST_TERM_STALE`. Two rules to plan around: **presence is the player's
Buddy actor** — a participant with no fresh actor in the app after the join
grace window is expired by the server, and an empty session is abandoned after
its `emptyTimeoutSec` — so a GraphQL-only client must rejoin to come back,
unless the session was created with `presence: 'none'`, which turns the rule
off (leave, end and the empty timeout are then the roster's only exits); and
every session mutation accepts an `idempotencyKey`. The `sessionChanged` push
is per datacenter and the event log is the record: `sessionEvents` fills a gap
in the stream from wherever you reconnect.
`gameModelSessions({ appId, status: "active", admission: "open" })` lists
joinable lobbies; `sessionInspect` (app admins) shows the whole roster with
presence verdicts. The `kit.matches` helpers create their session with
`presence: 'none'` — a kit match is GraphQL plus channel pings and never spawns
an actor — and otherwise still keep their own `max_players` and do not bind an
actor on join.

## Invoking a function

```ts
const result = await client.gameModel.invoke({
  appId: "1",
  functionName: "attack",
  selfContainerId: hero.containerId,
  sessionId,
  paramsJson: JSON.stringify({ target_id: enemyId }),
});

if (result.success) {
  console.log("enemy hp:", JSON.parse(result.returnValueJson!));
} else {
  console.warn("attack failed:", result.errorMessage);
}
```

If the caller is not authorized the call throws; if the logic errors the call
returns `success: false` and rolls back.

## Reading state

```ts
const state = await client.gameModel.containerState({ appId: "1", containerId: enemyId });
const props = JSON.parse(state.propertiesJson); // only properties you may see
```

`containers`, `container`, and `traverse` round out the read surface.

## Active player count

`client.gameModel.activePlayerCount(appId)` reads the app-wide count of active
**app-scoped gameplay sessions**:

```ts
const snapshot = await client.gameModel.activePlayerCount("1");

console.log(
  snapshot.activePlayerCount,
  snapshot.status,       // "FRESH" | "PARTIAL" | "UNAVAILABLE"
  snapshot.observedAt,   // nullable
  snapshot.revision,
);
```

The client must hold a bearer app-scoped token matching `appId`.
`activePlayerCount` is best-known in every response, but only a `FRESH`
snapshot is authoritative. Treat `PARTIAL` and `UNAVAILABLE` as degraded
freshness, never as an authoritative zero.

This is a session gauge, not a distinct-user, actor, game-model-session, host,
or per-server count. A session remains visible until explicit disconnect or
deauthorization, token expiry, or inactivity expiry. Abandoned sessions can
linger for roughly 120 seconds plus observation latency, and a brief reconnect
overlap can transiently count twice.

Use `activePlayerCountChanged({ appId }, handlers)` for post-observation
changes:

```ts
const unsubscribe = client.gameModel.activePlayerCountChanged(
  { appId: "1" },
  {
    next: (change) => {
      console.log(
        change.previousCount,
        change.currentCount,
        change.delta,
        change.revision,
        change.observedAt,
      );
    },
    error: (error) => console.error(error),
  },
);

// Stop watching when this app view is disposed.
unsubscribe();
```

The subscription is best-effort and does not provide the initial value. Open
it and then query `activePlayerCount(appId)` on startup; deduplicate by
`revision`. Re-query after reconnect and whenever revisions indicate a gap.
See [Game Models → Active player count](/game-api/game-models#active-player-count-app-scoped-sessions)
for the raw GraphQL operations and full freshness contract.

## Reacting to changes

Clients **pull** authoritative container state. Use the best-effort,
metadata-only `containerChanged(...)` subscription as a prompt to re-read,
poll the event log with `events` (filter by session, container, function, or
success), or re-read `containerState` after a change:

```ts
const recent = await client.gameModel.events({ appId: "1", sessionId });
for (const e of recent) {
  console.log(e.functionName, e.success, JSON.parse(e.returnValueJson ?? "null"));
}
```

To avoid blind polling, have the **acting** client send a lightweight
"model changed" ping over the realtime path; peers then re-pull. Both carriers
are already wrapped by the SDK:

- **Recommended — channels.** Publish to a per-session [channel](/crowdyjs/channels)
  with `client.udp.sendChannelMessage`; members receive a `channelMessage`
  notification and re-read `client.gameModel.containerState(...)`.
- **Alternative — spatial.** For location-bound changes, `client.udp.sendClientEvent`
  pings nearby players, who re-pull.

See [Game Models › Reacting to changes](/game-api/game-models#reacting-to-changes)
for the full pattern.

See [Game Models](/game-api/game-models) for the full concept guide, the
expression language, the authority model, and property visibility. For
ready-made mappings of common concepts (inventory, lockable objects, NPCs)
onto this API, see the [Game Kit](/crowdyjs/game-kit).

Two parts of that guide are worth reading before you write a function that
several players call at once: the
[list builtins](/game-api/game-models#lists) (`at`, `set_at`, `append`,
`remove_at`, `index_of`, `array`), and
[what happens when two players write the same property](/game-api/game-models#concurrency-two-players-writing-the-same-property)
— which shapes are atomic, which are protected by a lock, and why a
roster update should be written as the guarded form.
