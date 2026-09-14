---
sidebar_position: 2
title: Best practices
---

# CrowdyCPP best practices

CrowdyCPP mirrors CrowdyJS on GraphQL and speaks the Replication API
natively. Use the same authority rules as every other client.

- **Two tokens.** Sign in for a session token; mint an app-scoped token
  before Game API or UDP. [Portals](/management-api/portals-and-app-tokens).
- **Follow `gameApiUrl`.** Call `serverWithLeastClients` on the app's
  datacenter endpoint, wait ~1.5 s, then send HMAC-signed UDP.
  [Replication best practices](/replication-api/best-practices).
- **Models own gameplay state.** Invoke Game Model functions (effects)
  when you know the target; use Compute for discovery and coordination.
  [Game API best practices](/game-api/best-practices).
- **Do not treat silence as loss.** A bad HMAC or token can be dropped
  with no NAK.
- **Load-test the public path.** Drive sign-in → mint → assign → UDP, not
  a private shortcut. [Load testing](/replication-api/load-testing).

See [Overview best practices](/overview/best-practices).
