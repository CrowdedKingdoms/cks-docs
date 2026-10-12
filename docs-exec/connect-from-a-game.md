---
sidebar_position: 3
title: Connect from a game
---

# Connect from a game

:::note
The SDK support is in CrowdyJS 18, CrowdyCPP and CrowdyPy. Use CrowdyJS 18.1.0, CrowdyCPP 0.55.0
and CrowdyPy 0.5.0 or later: they check a gateway before they send it a connect token
([below](#where-the-connect-token-goes)).
:::

The SDKs wrap the same steps. First they ask the game API for a host (`execConnect`). Then
they open a WebSocket to that host's gateway, speak the [wire protocol](intro#the-wire-protocol),
and encode payloads as MessagePack. The player's session must be the **app-scoped token** of the
app you connect to, which is what hosted sign-in gives a game. See
[session vs app-scoped tokens](/crowdyjs/readme#authentication-session-vs-app-scoped-tokens).

## CrowdyJS

```ts
import { CrowdyExecError } from '@crowdedkingdoms/crowdyjs';

// `client` holds the player's app-scoped token for `appId`.
const exec = await client.exec.connect(appId, { nodeType: 'arena', key: 'm1' });

const state = await exec.call<{ hp: number }>('arena', 'm1', 'state');

const stop = await exec.subscribe<number>('arena', 'm1', 'hp', (push) => {
  renderHp(push.value);
});

try {
  await exec.call('arena', 'm1', 'hit', { weapon: 2 });
} catch (e) {
  if (e instanceof CrowdyExecError && e.retryable) {
    // Busy, Moved, Unavailable or RateLimited: try again with backoff.
  } else {
    throw e;
  }
}

await stop(); // ends this handler, and the subscription when it was the last one
exec.close();
```

- `call` sends its arguments as MessagePack and returns the decoded reply. `callRaw` takes and
  returns bytes.
- A status other than `Ok` throws a `CrowdyExecError`. Its `status` is the status name
  (`AppError`, `Denied`, …), and for `AppError` its message is the handler's.
- `subscribe` returns a function that removes the handler. `push.value` is the published
  payload, decoded.
- Options for `connect`:
  - `callTimeoutMs` sets how long a call waits for its reply (default 10 seconds); a single
    call can pass `{ timeoutMs }`.
  - `reconnect: false` turns off recovery.
  - `decode: { useBigInt64: true }` decodes 64-bit integers above 2^53 exactly.
  - `WebSocket` supplies an implementation where there is no global one: in Node before 22,
    pass the `ws` package's.
- `exec.ping()` measures the round trip to the gateway in milliseconds.

## CrowdyCPP

```cpp
#include <crowdy/client.hpp>

using crowdy::domains::ExecPush;
using crowdy::domains::ExecReply;
using crowdy::graphql::JVal;

// `client` holds the player's app-scoped token for `appId`.
auto exec = client.exec().connect(appId, {.nodeType = "arena", .key = "m1"});

exec->call("arena", "m1", "hit", JVal::object({{"weapon", JVal(2)}}), [](ExecReply r) {
  if (r.ok()) {
    showHp(r.value()["hp"].asInt64());
  } else if (r.retryable()) {
    // Busy, Moved, Unavailable or RateLimited: try again with backoff.
  } else {
    logError(crowdy::domains::execStatusName(r.status), r.message());
  }
});

auto handle = exec->subscribe("arena", "m1", "hp", [](const ExecPush& push) {
  renderHp(push.value().asInt64());
});

// Every frame, on the game thread: callbacks run here.
client.poll();

exec->unsubscribe(handle);
exec->close();
```

- `connect` returns at once; calls made while the connection opens wait for it.
  `connectAsync` calls back once it is open, or with the failure.
- Callbacks run through the client's dispatcher, like the SDK's other realtime callbacks, so
  they arrive on the thread that calls `poll()`. See the [quick start](/crowdycpp/quick-start).
- Replies and pushes carry the raw payload. `value()` decodes it from MessagePack into a
  `graphql::Json`, and `graphql::Json::toMsgpack()` / `fromMsgpack()` are available directly.
- The domain works without C++ exceptions, so builds with `CROWDY_NO_EXCEPTIONS` get it too.
- The WebSocket is the transport you give the client. The bundled one needs libcurl 8.13 or
  later, built with WebSocket support; an engine can inject its own `IWebSocketTransport`.

## CrowdyPy

```python
from crowdypy.domains.exec import CrowdyExecError

# `game` holds the player's app-scoped token for `app_id`.
exec_conn = await game.exec.connect(app_id, node_type="arena", key="m1")

try:
    reply = await exec_conn.call("arena", "m1", "hit", {"weapon": 2})
    show_hp(reply["hp"])
except CrowdyExecError as error:
    if error.retryable:
        ...  # Busy, Moved, Unavailable or RateLimited: try again with backoff.
    else:
        log_error(error.status, error.message)

unsubscribe = await exec_conn.subscribe("arena", "m1", "hp", lambda push: render_hp(push.value))

await unsubscribe()
await exec_conn.close()
```

- `connect` returns once the connection is open. It redials with a fresh token whenever it
  reconnects, and `on_reconnect` listeners get the new host.
- Arguments and replies are MessagePack; `call` returns the decoded reply, and `push.value` is
  the decoded push.
- `crowdypy.sync.CrowdyClient` has the same `exec.connect` without `await`; its connection
  reads on a thread of its own.

## When the host goes away

A host can restart, and an instance can move to another host. Both SDKs recover the same way,
unless reconnecting is turned off.

- When the socket closes unexpectedly, the connection asks `execConnect` for a host again,
  with backoff of up to 5 seconds. It then renews every subscription and resends a call that
  was waiting for its reply, once. `onReconnect` listeners get the new host.
- When a reply is `Moved`, the connection dials again and repeats the call once.
- Pushes published while the connection was down are not replayed, because topics are not a
  log. Read the state you display again in `onReconnect`.

## When the platform's manager fails over

The service that places instances on hosts (the execution manager) runs as a leader with a
standby. When the leader stops, the standby takes over, usually within a few seconds and up to
about 15. A game can see it:

- `execConnect` waits for the new leader within its 15-second budget, so it can be slow, and it
  may then fail with "no execution manager leader reachable"
  ([below](#when-execconnect-refuses)). Retry it with backoff, as a connection's reconnect does.
- Connections that are open stay open, and the instances running keep running. A call that
  needs an instance started (a hub key that is not running) can be answered `Unavailable` until
  a leader is back.
- A takeover longer than about 10 seconds stops what the hosts run. Each hub starts again from
  its last snapshot when it is next called, so up to one snapshot interval (`persist_every_ms`)
  of its state is lost, and connections recover as when a host goes away.

## When `execConnect` refuses

`execConnect` answers these errors before any gateway is involved. The code is in
`extensions.code`, and `extensions.httpStatus` carries the HTTP status.

| `extensions.code` | Why | What to do |
|---|---|---|
| `FORBIDDEN` | The session is not the app-scoped token of the app named, or the app is switched off or paused for its budget | Connect with the app's own token. A switched-off or paused app stays refused until its developer turns it on or funds it |
| `BAD_REQUEST` | `nodeType` is not 1–64 letters, digits, `-` or `_`, or `key` is longer than 256 characters | Fix the arguments |
| `NOT_FOUND` | With `nodeType`: the app has no deployed version, or its active version has no node type of that name | Deploy it, or fix the name |
| `CONFLICT` | The app lives in another datacenter than this game API's | Call the endpoint `mintAppToken` and `gameClientBootstrap` return for the app |
| `INTERNAL_SERVER_ERROR`, `httpStatus` 503 | ck-exec is not available on this environment, no host is live, or no manager answered within 15 seconds ("no execution manager leader reachable"); or the app already runs 1,024 instances and the call would start another ([instances](operations#call-limits)) | Retry with backoff. At the instance ceiling, wait for idle instances to stop |

## Where the connect token goes

The connect token rides in the gateway URL that `execConnect` names, so the SDKs check that URL
before they dial it (CrowdyJS 18.1.0, CrowdyCPP 0.55.0, CrowdyPy 0.5.0). They dial a gateway only when it is a
`ws:` or `wss:` URL with no credentials in it, `wss:` whenever the game API is `https:`, and on
the platform's own domain: the game API's, or the one the SDK release was published for. A game
API on `localhost` may also name a gateway on `localhost`, as a local development cluster does.
Any other gateway is never dialed: the attempt fails `Unavailable` ("refusing the gateway …"),
and the next reconnect asks `execConnect` again. `execGatewayRefusal(gameApiUrl, gatewayUrl)`
(CrowdyJS), `crowdy::domains::execGatewayRefusal` (CrowdyCPP) and
`crowdypy.domains.exec.exec_gateway_refusal` (CrowdyPy) say why, for a tool that dials an endpoint
itself; `ExecConnection.open(gatewayUrl, token)` dials the URL it is given.

## When the gateway refuses

A token is checked only when the socket opens, and a connection that is already open stays open
after its token expires. The connection's reconnect asks `execConnect` for a fresh token each
time.

| The gateway answers | Why | CrowdyJS in Node, with the `ws` package | CrowdyJS in a browser | CrowdyCPP | CrowdyPy |
|---|---|---|---|---|---|
| `HTTP 401` with the reason, no socket | the connect token is refused | `Denied`, with the reason | `Unavailable` | `Denied` (with the reason when the transport can read it; the bundled libcurl transport reports the status only) | `Denied`, with the reason |
| `HTTP 429` with the reason, no socket | the player already holds 16 sessions to the app through this gateway, or the gateway is full | `Unavailable`, with the reason | `Unavailable` | `Unavailable` | `Unavailable`, with the reason |
| socket opened, then closed `4401` | a host before ck-exec 0.10.0 refused the token | `Denied` | `Denied` | `Denied` | `Denied` |

A browser cannot read the status of a WebSocket upgrade it was refused, so there a refused
token looks like any failed connection. Before CrowdyJS 18.1.0, CrowdyCPP 0.55.0 and CrowdyPy
0.5.0 the SDKs reported a `401` as `Unavailable` everywhere. In CrowdyCPP the first connection's `connect`
callback gets `Errc::Rejected` for `Denied`, and `ExecConnection::lastFailure()` holds the status
and reason of the last attempt that failed.

## Deploying from a script

`client.exec.deploy` builds the manifest from the modules you give it. It computes each
module's SHA-256 and uploads each distinct module once. It needs the organization's
`manage_compute` permission, so it runs from a developer's tooling, not from the game.

```ts
import { readFile } from 'node:fs/promises';

const wasm = (name: string) => readFile(`target/wasm32-unknown-unknown/release/${name}.wasm`);

const { version } = await client.exec.deploy({
  appId,
  root: 'lobby',
  types: {
    lobby: { kind: 'hub', wasm: await wasm('lobby'), client: true },
    arena: { kind: 'hub', parent: 'lobby', wasm: await wasm('arena'), client: true, persist_every_ms: 5000 },
    combat: { kind: 'spoke', parent: 'arena', wasm: await wasm('combat'), client: true, calls: ['arena'], replicas: 2 },
  },
});
```

Any other [manifest field](intro#the-manifest) goes on the type as written. CrowdyCPP has the
same call as `client.exec().deploy(appId, root, types)`, with a vector of `ExecNodeType`.

The modules above come from a build on your machine, with the open [dev kit](develop-locally)
(`ckx-kit build`). A platform build deploys the same way: pass its `buildId`, and give each type
its `crate` instead of `wasm` ([builds from an SDK](builds#from-an-sdk)).

Next: [world and platform data](world-and-platform-data).
