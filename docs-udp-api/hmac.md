---
sidebar_position: 5
title: HMAC
---

# HMAC for spatial messages

Long Form Spatial messages carry a **32-byte HMAC-SHA256** tail whenever
`containsAuth = 1` (byte at offset 35). The **same** scheme is used in **both
directions**:

- **Client → server:** you sign your messages so the server can authenticate them.
- **Server → client:** the server signs its notifications (actor / voxel / audio /
  text / generic-spatial / single-actor) with **your** game token, so you can
  verify the message genuinely came from the server. **Verify the HMAC and drop any
  `containsAuth = 1` long-spatial message whose tag doesn't match.**

Both must match Buddy's OpenSSL `HMAC(EVP_sha256(), …)` implementation.

:::info[Server → client signing]

Buddy signs server→client long-spatial notifications by default. If you receive a
long-spatial notification with `containsAuth = 1`, validate the HMAC using the
algorithm below (same key, same `prefix || token` message). Channel notifications,
`GENERIC_ERROR_MESSAGE`, and `COMMAND_RECONNECT` are **not** signed this way —
`COMMAND_RECONNECT` carries its own HMAC (see [Operations](/replication-api/operations)).

:::

## Algorithm

- **HMAC:** HMAC-SHA256 (RFC 2104 with SHA-256). Tag length: **32 bytes**.
- **Key:** your 64-octet app-scoped token (see [Key](#key)).
- **Message to authenticate:** `prefix || token_64_bytes` (see [Message input](#message-input)).

## Key

The **app-scoped token** (from `mintAppToken` or `exchangePortalCode` — see
**[Portals & app-scoped tokens](/management-api/portals-and-app-tokens)**; not the
identity session token that `login` returns) is a **64-character string**. Use
those **64 characters as 64 raw octets** for the HMAC key — encode the string as
Latin-1 / ISO-8859-1 (each character becomes one byte).

```javascript
const key = Buffer.from(token, 'latin1'); // 64 bytes — token.length === 64
```

:::danger[Do not hex-decode the token]

The token looks like hex (e.g. `dd5c10ce…`), but it is **used as-is** — its 64
characters are the 64-byte key. **Do not** run it through a hex decoder: that would
produce a 32-byte key and every HMAC will fail (server→client messages will look
forged, and your client→server messages will be silently dropped or rejected with
`INVALID_TOKEN`). The key length must be exactly **64 bytes**.

:::

## Message input

Let `prefix` be every byte from the start of the UDP payload through the byte
**before** the 32-byte HMAC field (exclude the HMAC and everything after it). The
prefix therefore includes the message type (byte 0), the `containsAuth = 1` flag,
and the full application payload.

The HMAC **message** buffer is `prefix` concatenated with the **same** 64 token
octets used as the key:

```text
tag = HMAC-SHA256(key = token_64_bytes, message = prefix || token_64_bytes)
```

Write `tag` into the 32-byte HMAC field.

## Length check

```text
len(prefix) = len(full_message) - 41   // when containsAuth = 1 (HMAC + 8-byte slot + 1-byte seq)
len(prefix) = len(full_message) - 9    // when containsAuth = 0
```

## Direction notes

The layout and the HMAC computation are **identical** in both directions; only the
8-byte slot immediately after the HMAC differs:

- **Client → server:** that slot is your `gameTokenId` (little-endian int64),
  followed by a 1-byte sequence.
- **Server → client:** that slot holds **epoch milliseconds** (server time),
  followed by the 1-byte sequence. It is **not** the key and is **not** part of the
  signed `prefix`. Use the game token **you** authenticated with as the key.
  Notifications arrive on the same socket you send from — see
  **[Send and receive](/replication-api/send-and-receive)**.

## Libraries

`HMAC-SHA256` is in every platform's standard crypto library. `key` is the 64 token
octets; `msg` is `prefix || key` (raw bytes). Always compare tags with a
**constant-time** function.

| Platform | API | Constant-time compare |
|---|---|---|
| **C / C++ / Unreal** (OpenSSL — Unreal bundles the `OpenSSL` module) | `HMAC(EVP_sha256(), key, 64, msg, msg_len, out, &outLen)` from `<openssl/hmac.h>` | `CRYPTO_memcmp(a, b, 32)` |
| **C#/.NET** (Unity, native) | `new System.Security.Cryptography.HMACSHA256(key).ComputeHash(msg)` | `CryptographicOperations.FixedTimeEquals(a, b)` |
| **Node.js / TypeScript** | `crypto.createHmac('sha256', key).update(msg).digest()` | `crypto.timingSafeEqual(a, b)` |
| **Python** | `hmac.new(key, msg, hashlib.sha256).digest()` | `hmac.compare_digest(a, b)` |
| **Go** | `h := hmac.New(sha256.New, key); h.Write(msg)` | `hmac.Equal(a, b)` |
| **Rust** (RustCrypto) | `Hmac::<Sha256>::new_from_slice(key)?.chain_update(msg)` | `mac.verify_slice(tag)` |

## Verifying a server→client message

1. Read the message type (byte 0) and `containsAuth` (byte 35).
2. If `containsAuth == 1`: the 32-byte HMAC is at `payload[len-41 .. len-9)`, and
   `prefix = payload[0 .. len-41)`.
3. Recompute `HMAC-SHA256(token, prefix || token)` and **constant-time compare** it
   to the tail HMAC. Drop the message on mismatch.
4. The 8-byte slot at `payload[len-9 .. len-1)` is server epoch millis (informational);
   `payload[len-1]` is the sequence byte.

## Pseudocode

### Node.js — sign (client→server) and verify (server→client)

```javascript
import { createHmac, timingSafeEqual } from 'crypto';

// token is the 64-character app-scoped token (mintAppToken / exchangePortalCode) — used as 64 octets.
function spatialHmac(prefix, token) {
  const key = Buffer.from(token, 'latin1');       // 64 bytes
  const msg = Buffer.concat([prefix, key]);       // prefix || token
  return createHmac('sha256', key).update(msg).digest();
}

// Verify an inbound server→client long-spatial notification (containsAuth = 1).
function verifyServerMessage(payload, token) {
  if (payload.length < 109 || payload[35] !== 1) return false; // not signed / too short
  const prefix = payload.subarray(0, payload.length - 41);
  const tag = payload.subarray(payload.length - 41, payload.length - 9);
  const expected = spatialHmac(prefix, token);
  return tag.length === 32 && timingSafeEqual(expected, tag);
}
```

### C++ / OpenSSL (Unreal)

```cpp
#include <openssl/hmac.h>
// key = 64 token octets; build msg = prefix || key, then:
unsigned char tag[32]; unsigned int len = 0;
HMAC(EVP_sha256(), key /*64 bytes*/, 64, msg.data(), msg.size(), tag, &len);
// compare to the 32-byte HMAC field with CRYPTO_memcmp(tag, field, 32) == 0
```

See **[Send and receive](/replication-api/send-and-receive)** for the first message
to send after assignment, and **[Wire formats](/replication-api/wire-formats)** for
the full Long Form Spatial layout.
