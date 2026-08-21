---
sidebar_position: 6
title: Example operations
---

# Example operations

Copy-paste examples for common Management API (studio-backend) flows, each with variables
and a representative response. Field shapes are authoritative in the
[GraphQL reference](/management-api/reference/graphql-overview) and the
[Management API SDL](pathname:///schema/management-api.graphql). For the agent overview see
[For AI agents](/overview/for-ai-agents); for error handling see
[Error codes](/overview/error-codes).

Agentic Crowdy Studio policy and kill operations are privileged,
revision-guarded control-plane actions and are intentionally not included as a
generic copy-paste quickstart. Use the
[policy guide](agentic-crowdy-studio-policy), generated field descriptions, and
[operator runbook](/operators/agentic-crowdy-studio). The player-facing
quickstart uses the normal CrowdyJS SDK.

> Responses are representative. Send `Authorization: Bearer <token>` on every request
> (except the public marketplace reads). `BigInt` values are decimal strings; `*Cents`
> fields are minor currency units.

## 1. Authenticate

Sign in with email and a password, a magic link, or a social provider. The magic-link
flow below requests a link, then completes it with the token from
the emailed URL to receive an identity **session token**:

```graphql
mutation Request($input: RequestLoginLinkInput!) {
  requestLoginLink(input: $input) { sent }
}
```

```json
{ "input": { "email": "owner@example.com" } }
```

```json
{ "data": { "requestLoginLink": { "sent": true } } }
```

```graphql
mutation Complete($input: CompleteLoginLinkInput!) {
  completeLoginLink(input: $input) { token gameTokenId user { userId email } }
}
```

```json
{ "input": { "token": "<one-time-token-from-the-link>" } }
```

```json
{ "data": { "completeLoginLink": { "token": "ServerIssuedSessionToken", "gameTokenId": "9001", "user": { "userId": "777", "email": "owner@example.com" } } } }
```

> Email + password is `register(registerUserInput:{email,password})` for a new
> account and `login(loginUserInput:{email,password})` for an existing one; social
> sign-in uses `socialLoginStart` → `socialLoginComplete`. The magic-link token
> arrives only by email — there is no way to read it out of the response. See
> [Sign in](/management-api/authentication).

## 2. Browse the marketplace (public, no auth)

```graphql
query Apps($filter: AppMarketplaceFilterInput, $limit: Int, $offset: Int) {
  apps(filter: $filter, limit: $limit, offset: $offset) {
    items { appId name slug }
    pageInfo { totalCount limit offset }
  }
}
```

```json
{ "filter": { "query": "racing" }, "limit": 25, "offset": 0 }
```

```json
{
  "data": {
    "apps": {
      "items": [{ "appId": "42", "name": "Turbo Racer", "slug": "turbo-racer" }],
      "pageInfo": { "totalCount": 1, "limit": 25, "offset": 0 }
    }
  }
}
```

## 3. Search users (super admin)

```graphql
query Users($query: String, $limit: Int, $offset: Int) {
  usersPaginated(query: $query, limit: $limit, offset: $offset) {
    items { userId gamertag }
    pageInfo { totalCount limit offset }
  }
}
```

```json
{ "query": "ada", "limit": 50, "offset": 0 }
```

```json
{
  "data": {
    "usersPaginated": {
      "items": [{ "userId": "777", "gamertag": "ada" }],
      "pageInfo": { "totalCount": 1, "limit": 50, "offset": 0 }
    }
  }
}
```

## 4. Check an org wallet

```graphql
query Wallet($orgId: BigInt!) {
  walletBalance(orgId: $orgId) { balanceCents currency }
}
```

```json
{ "orgId": "10" }
```

```json
{ "data": { "walletBalance": { "balanceCents": "5000", "currency": "usd" } } }
```

## 5. Open a wallet top-up checkout

```graphql
mutation TopUp($input: CreateCheckoutInput!) {
  createCheckout(input: $input) { externalUrl status }
}
```

```json
{
  "input": {
    "purpose": "ORG_WALLET_TOPUP",
    "orgId": "10",
    "amountCents": "5000",
    "provider": "STRIPE"
  }
}
```

```json
{
  "data": {
    "createCheckout": {
      "externalUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
      "status": "PENDING"
    }
  }
}
```

Redirect the user to `externalUrl`. The wallet credit reconciles via webhook, not the
redirect, and `status` advances to `COMPLETED` then. `createCheckout` is **not**
idempotent — do not blind-retry it on a network error.

## 6. Grant a user access to an app

```graphql
mutation Grant($input: GrantAppAccessInput!) {
  grantAppAccess(input: $input) { status }
}
```

```json
{ "input": { "appId": "42", "userId": "777", "tierId": "5" } }
```

```json
{ "data": { "grantAppAccess": { "status": "active" } } }
```

This is an entitlement change that propagates to the game runtime. It requires the
`manage_access_tiers` permission on the app's org (see the field's description in the SDL).
