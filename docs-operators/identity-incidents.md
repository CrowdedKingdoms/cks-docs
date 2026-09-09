---
sidebar_position: 10
title: Identity incidents (accounts, sessions, customer origins)
---

# Identity incidents: accounts, sessions, and customer origins

The runbook for "someone is in an account they should not be in", "a
customer's game is compromised", and "a credential leaked". Companion to the
[player-code kill ladder](/operators/player-code-incidents) and
[commerce incidents](/operators/commerce-incidents). Everything here is a
GraphQL call on the Management API or a Studio action; nothing needs a
database session.

## The controls at a glance

| Control | Where | Since |
|---|---|---|
| Direct sign-in is first-party only | `HOSTED_SIGN_IN_REQUIRED` from any other browser origin | ck-api v1.88.0 |
| CORS = first-party + every app's redirect URIs, live | `OriginPolicyService`, 10 s snapshot | v1.88.0 |
| `register` never touches an account that has a password | `EMAIL_ALREADY_REGISTERED` | v1.87.2 |
| Reset revokes every session; change revokes the others | `resetPassword` / `changePassword` | v1.88.0 |
| Sign-in rate limits (per address, per client) | `RATE_LIMITED`; masked mutations stay masked | v1.88.0 |
| Authentication is the default on every root field | `@Public()` allow-list + `AuthDefaultGuard` | v1.88.0 |
| App tokens are confined to one app, 30 min | `refreshAppToken`; `revokeAppAuthorization` | unchanged |
| Studio session is an HttpOnly cookie + CSRF | `ck_session` / `ck_csrf`; cookie auth from a non-first-party origin is `COOKIE_AUTH_ORIGIN_REFUSED` | ck-api v1.92.0 |

## Playbooks

### A. A player reports their account was taken over

1. **Confirm the address** with the player out of band.
2. **Trigger a reset**: `requestPasswordReset(email)` (or have the player use
   "Forgot password" on Studio). Completing the reset **revokes every session
   and every app token** for the account -- the attacker is out the moment the
   player finishes.
3. If the player cannot receive email, a **super admin** can
   `forceLogoutUser(userId)` (every session gone) and then set a temporary
   password through the support path.
4. Check **Connected apps** (Account > Connected apps, or `myAuthorizedApps` as
   the user) for a grant the player does not recognise, and revoke it
   (`revokeAppAuthorization`). Check `myIdentities` for a linked social identity
   the player did not add (`unlinkIdentity`).
5. Ask how the credential left them. If they typed their Crowded Kingdoms
   password into a **game's page**, that game is either a first-party page or a
   phishing copy: since v1.88.0 no customer game can collect it. Escalate.

### B. A customer's game (origin) is compromised

What the attacker holds: **app tokens for that app**, minted by players who
consented on Studio, and CORS access to the API from that origin. What they do
not hold: passwords, sessions, tokens for other apps.

1. **Close the door.** In Studio > Apps > Settings > *Sign-in & redirect URIs*,
   remove the compromised origin (or every URI). Within ten seconds on every
   API instance the origin gets no CORS headers and hosted sign-in refuses to
   return there. Equivalent: `setAppClientSettings({ appId, redirectUris: [] })`.
2. **Invalidate what is out there.** Each player's grant can be revoked
   (`revokeAppAuthorization(appId)` as that user invalidates their live tokens
   for the app). For a fleet-wide cut, an app manager can `archiveApp(appId)`
   so nothing is served for it; tokens also expire on their own within 30
   minutes and cannot be refreshed once the grant is gone.
3. **Notify** the customer and, if players were affected, the players (the
   account address is in `users`).
4. **Re-open** by re-adding the origin once the customer has remediated.

### C. A sign-in flood / credential stuffing

1. Read the per-minute summary in the API logs: `auth.rate_limited
   op=<login|register|...> dimension=<email|ip> origin=<origin> refused=<n>`, and
   `direct sign-in refused: field=<f> origin=<o>` for non-first-party attempts.
2. The limiter is per datacenter and per address / per client. A legitimate
   population behind one NAT trips the **IP** dimension at 100 attempts per
   15 minutes; if that is what you see (successful logins refused), raise
   `AUTH_RATE_LIMITS.login.ip` in a release rather than disabling the limiter.
3. A flood against one **address** locks that account for 15 minutes after ten
   failures; the owner's way in is the reset email, which also clears the
   window. Nothing to do unless the owner asks.
4. Sustained floods are a WAF question (Phase 3, not yet in place).

### D. A credential leaked (token, key, password)

| Leaked | Do |
|---|---|
| A player's **session token** (or a stolen `ck_session`) | `forceLogoutUser(userId)` (super admin) or have them `logoutAllDevices`; then a password change. Studio no longer keeps the session in `localStorage`; XSS there cannot read `ck_session`. |
| An **app token** | Expires within 30 min; `revokeAppAuthorization` ends it now. |
| The `P2P_SECRET` / a control-plane secret | Rotate in Secrets Manager and re-file the component (`infra-control-plane/docs/ops/SECRETS.md`). |
| An **org API token** | Org > API credentials > revoke; it stops authenticating on its next request. |
| A password in a log or chat | Treat as A; the owner resets. |

### E. A customer asks why their game gets `HOSTED_SIGN_IN_REQUIRED` or CORS errors

Both have one fix: the game's **origin** is not one of the app's redirect URIs.
Studio > Apps > Settings > *Sign-in & redirect URIs*; or `npm run setup --
--origin https://their.host` in The Construct. Direct `auth.login` from a
game page is not supported on any tier; the game uses
`client.portal.signIn` ([Sign in](/management-api/authentication)).

## What to expect from the logs

- One `WARN` per refused direct sign-in naming the field and origin
  (`FirstPartyOriginGuard`). A first-party page appearing here means its host
  is missing from `FIRST_PARTY_ORIGINS` / `FRONTEND_URL` on that tier.
- One `WARN` per minute per (op, dimension, origin) from the rate limiter, with
  the count, never one per refusal.
- `AuthDefaultGuard` warns once per process for a root field that is neither
  `@Public()` nor behind `TokenAuthGuard`; the build also fails, so seeing it on
  a tier means a gate was bypassed.
