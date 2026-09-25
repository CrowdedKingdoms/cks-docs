---
sidebar_position: 3
title: Connect from a game
---

# Connect from a game

:::caution Dev-tier preview
Available on the **dev** environment only; see the [overview](intro). The SDK support is in
CrowdyJS **17.9.0** (the `@dev` prerelease line, `17.9.0-dev.N`) and CrowdyCPP **0.44.0**.
:::

Both SDKs wrap the same steps. First they ask the game API for a host (`execConnect`). Then
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

## When the host goes away

A host can restart, and an instance can move to another host. Both SDKs recover the same way,
unless reconnecting is turned off.

- When the socket closes unexpectedly, the connection asks `execConnect` for a host again,
  with backoff of up to 5 seconds. It then renews every subscription and resends a call that
  was waiting for its reply, once. `onReconnect` listeners get the new host.
- When a reply is `Moved`, the connection dials again and repeats the call once.
- Pushes published while the connection was down are not replayed, because topics are not a
  log. Read the state you display again in `onReconnect`.

A token is refused only when the socket opens (close code `4401`). A connection that is already
open stays open after its token expires.

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
