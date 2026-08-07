---
draft: true
---

# Payments setup (Stripe + PayPal)

This document is the operational checklist for wiring the new payments module
to your Stripe and PayPal accounts. The codebase is provider-agnostic: every
checkout flows through the `createCheckout` GraphQL mutation, opens a session
with the right provider, and reconciles the result via webhook into one of
four side effects (per `CheckoutPurpose`):

| Purpose | Side effect on COMPLETED |
| --- | --- |
| `ORG_WALLET_TOPUP` | Credits `org_wallets.balance_cents` and inserts a `wallet_transactions` row of type `topup`. |
| `APP_ACCESS_PURCHASE` | Upserts `app_user_access(app_id, user_id, tier_id)` to `status='active'`, marks `granted_by='purchase:<provider>'`. |
| `DONATION` | **Legacy — deprecated.** Increments `donations.total_amount_cents` for `(user_id, app_id)`. New checkouts with this purpose are rejected by the Management API; historical rows and webhooks remain for reconciliation. |
| `PROPERTY_TOKENS` | **Legacy — deprecated.** Increments `property_tokens.available` (1 token per cent). New checkouts with this purpose are rejected; historical data is retained. |

Studio operations in the Management UI use **org wallet top-ups** and **marketplace app-access purchases** only. Do not configure new Stripe/PayPal products for donations or property tokens.

The webhook reconciliation is idempotent: it is keyed by
`payment_events(provider, external_event_id)` UNIQUE.

---

## 1. Environment variables

Set these in `cks-game-api/.env`, which serves the management surface these
endpoints belong to. The relevant block in `example.env` already documents the same
keys. For a deployed environment they are control-plane secrets — file them through
the infra control plane rather than editing a host by hand.

### Required

| Var | Where to find it | Notes |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Stripe dashboard -> Developers -> API keys -> Secret key | `sk_test_...` for sandbox, `sk_live_...` for live. |
| `STRIPE_WEBHOOK_SECRET` | Stripe dashboard -> Developers -> Webhooks -> the endpoint -> Signing secret | `whsec_...` |
| `PAYPAL_ENV` | n/a | `sandbox` or `live`. |
| `PAYPAL_CLIENT_ID` | PayPal developer dashboard -> My Apps & Credentials -> the app -> Client ID | One per env. |
| `PAYPAL_CLIENT_SECRET` | same place -> Secret | One per env. |
| `PAYPAL_WEBHOOK_ID` | PayPal developer dashboard -> Webhooks -> the webhook -> ID | NOT the URL; the alphanumeric ID. |

### Optional

| Var | Notes |
| --- | --- |
| `LOCAL_STRIPE_WEBHOOK_SECRET` | Local-only override for a tunnel/reverse-proxy Stripe endpoint. When set, it takes precedence over `STRIPE_WEBHOOK_SECRET`. |
| `LOCAL_PAYPAL_WEBHOOK_ID` | Local-only override for a tunnel/reverse-proxy PayPal endpoint. When set, it takes precedence over `PAYPAL_WEBHOOK_ID`. |
| `STRIPE_PUBLISHABLE_KEY` | Currently unused server-side; expose to the UI if you need to embed Stripe Elements later. |
| `SUPER_ADMIN_BOOTSTRAP_USER_IDS` | Comma- or whitespace-separated user_ids that get `is_super_admin = TRUE` on app boot. Defaults to `1` in `example.env` (the seed admin). |

---

## 2. Webhook endpoints

Both providers need to point at the live Crowded Kingdoms API deployment, which serves
the management surface. Webhook paths:

| Provider | URL | Method | Notes |
| --- | --- | --- | --- |
| Stripe | `POST {API_BASE_URL}/webhooks/stripe` | POST | Canonical. Stripe sends `application/json` and a `Stripe-Signature` header. The service verifies the signature against the raw request body. |
| Stripe (legacy) | `POST {API_BASE_URL}/stripe/<event-type>` | POST | Backward-compat alias that forwards to the same webhook handler as `/webhooks/stripe`. The `<event-type>` segment is ignored (the body always carries the authoritative `type`). Re-point Stripe to `/webhooks/stripe` when convenient. |
| PayPal | `POST {API_BASE_URL}/webhooks/paypal` | POST | PayPal sends `application/json` plus `PayPal-Auth-Algo` / `PayPal-Cert-Url` / `PayPal-Transmission-Id` / `PayPal-Transmission-Sig` / `PayPal-Transmission-Time` headers. The provider validates by calling PayPal's `/v1/notifications/verify-webhook-signature`, so `PAYPAL_WEBHOOK_ID` must match the webhook subscription. |

`{API_BASE_URL}` is the public URL of your Crowded Kingdoms API deployment. For local testing
behind a public reverse proxy, use that public origin (for example
`https://local.cks-env.com/webhooks/stripe` and
`https://local.cks-env.com/webhooks/paypal`) and put the local endpoint values
in `LOCAL_STRIPE_WEBHOOK_SECRET` and `LOCAL_PAYPAL_WEBHOOK_ID`. If you're
testing locally with the Stripe CLI, run `stripe listen --forward-to
localhost:3001/webhooks/stripe` and use the printed `whsec_...` as
`LOCAL_STRIPE_WEBHOOK_SECRET` or `STRIPE_WEBHOOK_SECRET`.

Both `/webhooks/stripe` and the legacy `/stripe/<event-type>` URL share the
same active Stripe signing secret (`LOCAL_STRIPE_WEBHOOK_SECRET` when set,
otherwise `STRIPE_WEBHOOK_SECRET`); if you have two separate Stripe webhook
subscriptions with different signing secrets, consolidate to one subscription
pointed at `/webhooks/stripe`.

---

## 3. Stripe dashboard setup

### a. Webhook subscription

1. Stripe dashboard -> Developers -> Webhooks -> Add endpoint
2. Endpoint URL: `{API_BASE_URL}/webhooks/stripe`
3. Subscribe to events:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `checkout.session.async_payment_failed`
   - `payment_intent.payment_failed`
   - (Optional, for future subscription tiers) `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

### b. Catalog (Products and Prices)

The new payments module builds Stripe Checkout sessions on demand using
either:
- **a per-tier `Price` ID** if `app_access_tiers.stripe_price_id` is set, OR
- **an inline `price_data` object** built from `amountCents` + `currency` if
  no Price ID is configured.

For app access purchases that should use a fixed Stripe Price (e.g. so
buyers see a familiar SKU and so reporting groups by Price), do this for
each tier:

1. Stripe dashboard -> Products -> Add product. Name it after the tier
   (e.g. "Crowd - Builder tier").
2. Add a Price (one-time or recurring). Note the `price_xxx` id.
3. From the management portal, edit the access tier and paste the Price ID
   into the "stripe price id" field. (Or via SDK: `client.appAccess.updateTier({ tierId, input: { stripePriceId: 'price_xxx' } })`).

For the open-ended purposes (`DONATION`, `ORG_WALLET_TOPUP`, ad hoc
`PROPERTY_TOKENS`), no Stripe-side product is required - the API uses
inline `price_data` from the `amountCents` you pass to `createCheckout`.

### c. Test mode

Use `sk_test_...` keys and the Stripe-provided test card numbers
(`4242 4242 4242 4242`) so you can validate the full webhook -> ledger loop
end-to-end before flipping to live keys.

---

## 4. PayPal developer dashboard setup

### a. App credentials

1. https://developer.paypal.com -> My Apps & Credentials.
2. Use the same app for both sandbox and live (they have separate keys
   and webhooks).
3. Copy the Client ID and Secret into `PAYPAL_CLIENT_ID` and
   `PAYPAL_CLIENT_SECRET`.
4. Set `PAYPAL_ENV` to `sandbox` or `live` to match.

### b. Webhook subscription

1. In the same app -> Sandbox/Live Webhooks -> Add Webhook.
2. URL: `{API_BASE_URL}/webhooks/paypal`.
3. Subscribe to events:
   - `CHECKOUT.ORDER.COMPLETED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.DENIED`
   - `CHECKOUT.ORDER.VOIDED`
   - (Optional, for future recurring tiers) `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`
4. Save and copy the `WH-...` Webhook ID into `PAYPAL_WEBHOOK_ID`.

### c. Catalog (optional)

The current PayPal integration uses one-time PayPal Orders built on demand
from `amountCents`. There is no per-tier Plan ID required yet; if you want
recurring subscription tiers (PayPal Subscriptions API), set
`app_access_tiers.paypal_plan_id` and extend `PaypalProvider.createCheckoutSession`
to switch between Orders and Subscriptions based on whether the field is set.

### d. Test mode

PayPal sandbox lets you create personal + business test accounts that can
pay each other. Webhook delivery in sandbox is occasionally slow; if you
don't see the side effect within ~30s, refire from the developer dashboard.

---

## 5. Validation

After setting the env vars and creating the webhook subscriptions:

1. Start the API (`node dist/main`) and confirm no startup warnings about
   missing keys (you'll see `WARN [PaypalProvider] PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET
   not configured; PaypalProvider is inert` if PayPal isn't wired up).
2. From the management portal `/account/payments` page, kick off a small
   donation in test/sandbox mode for each provider.
3. Confirm the redirect lands on the provider's hosted checkout, complete
   the test payment.
4. Watch the API logs for webhook receipt; the `checkouts.status` should
   flip to `COMPLETED` within seconds.
5. Inspect the side-effect table (`donations`, `org_wallets`, `app_user_access`,
   or `property_tokens`) for the expected row.

For super-admin auditing, `/admin/payments` shows every `Checkout` row
across tenants.

---

## 6. AWS Secrets Manager mirror

Once the keys work locally, mirror them into the AWS secret used by the
deployed task definition (per the LEARNINGS note: secret IDs and JSON keys
are listed in `.github/task-definition.dev.json`). Add the following keys:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`

`PAYPAL_ENV` is non-secret and stays in the task definition's `environment`
array (`sandbox` for dev, `live` for prod). `STRIPE_PUBLISHABLE_KEY` is not
used by the current server-side Checkout flow, but the task definition still
mirrors it from Secrets Manager for compatibility with older deploys.

After publishing the new secret revision, redeploy the API task so the
container picks them up. Without `STRIPE_WEBHOOK_SECRET` the webhook
controller will reject every Stripe event with `Webhook validation failed`
(visible in the API logs).

---

## 7. Hosted Payment Link (legacy) flow

Before commit `231fdea` introduced the `createCheckout` mutation, payments
flowed through Stripe-hosted Payment Links built around two pre-created
Stripe Prices (`STRIPE_DONATION_PRICE_ID` and
`STRIPE_PROPERTY_TOKENS_PRICE_ID`). Buyers paid through a Stripe-hosted URL,
Stripe POSTed `checkout.session.completed`, and the old `StripeService`
credited `donations` / `property_tokens` for `app_id=1` using
`metadata.user_id`.

The new `createCheckout` flow is the recommended path going forward, but the
legacy path is still supported by a webhook fallback:
when an inbound Stripe webhook has no matching `checkouts` row,
`handleLegacyStripeCompleted` runs and credits the user directly.

### Required Payment Link metadata

For the fallback to credit anything, the Stripe Payment Link must populate
two metadata fields on each session:

| Key | Value | Notes |
| --- | --- | --- |
| `user_id` | The buyer's `users.user_id` | Required. If missing, the event is recorded in `payment_events` but the side effect is skipped. Templated per buyer via the Payment Link's `prefilled_metadata` URL parameters or by using a custom checkout flow. |
| `purpose` | `donation` or `property_tokens` | Optional but recommended. Skips the Stripe API round trip used by the Price-ID fallback below. |

### Price-ID fallback (no metadata.purpose)

If `metadata.purpose` is omitted, the fallback retrieves the session's line
items via `stripe.checkout.sessions.retrieve(id, { expand: ['line_items'] })`
and matches the first line item's `price.id` against:

- `STRIPE_PROPERTY_TOKENS_PRICE_ID` -> credits `property_tokens.available` by
  `amount_total / 100` for `(app_id=1, user_id)`.
- `STRIPE_DONATION_PRICE_ID` -> increments
  `donations.total_amount_cents` by `amount_total` for `(user_id, app_id=1)`.

If neither matches, the event is logged and persisted to `payment_events`
but no side effect is applied. Setting `metadata.purpose` removes both the
extra Stripe API call and any classification ambiguity.

### `app_id` is hard-coded to 1

`handleLegacyStripeCompleted` writes to `(app_id=1, user_id)` to mirror the
pre-refactor `StripeService.processSuccessfulPayment` behavior. New apps
should use the `createCheckout` flow instead, which respects the
`appId` argument.

### Idempotency

The fallback runs inside the same DB transaction as the
`payment_events` insert, so duplicate Stripe deliveries (matched by
`(provider, external_event_id)`) are safe: the second delivery short-circuits
on the `processed_at IS NOT NULL` check and never re-credits.

---

## 8. Production deploy checklist

When rolling out the payments module to a dedicated environment for the first
time:

1. Confirm the environment is on a release that includes the payments GraphQL
   surface (`Checkout`, `PaymentEvent`, wallet mutations, etc.) — see the
   **Management API schema reference** and your Crowded Kingdoms operator for
   environment version selection.
2. Confirm the Stripe dashboard webhook subscription URL is one of:
   - `{API_BASE_URL}/webhooks/stripe` (preferred), OR
   - `{API_BASE_URL}/stripe/<any-event-type>` (legacy alias - works but
     should be re-pointed at the canonical URL when convenient).
3. Verify the following secrets are set in AWS Secrets Manager (per the
   task definition's secret reference):
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_WEBHOOK_ID`
   - If relying on the legacy Price-ID fallback:
     `STRIPE_DONATION_PRICE_ID`, `STRIPE_PROPERTY_TOKENS_PRICE_ID`
4. For each pre-existing Stripe-hosted Payment Link, edit the metadata in
   the Stripe dashboard so every session it creates carries
   `user_id=<buyer-id>` and (recommended) `purpose=donation` or
   `purpose=property_tokens`. Without `user_id` the fallback can't credit
   anyone.
5. Smoke-test by triggering a small donation in test/sandbox mode through
   each path:
   - New flow: `client.payments.createCheckout(...)` from the management
     portal UI -> Stripe checkout -> webhook -> `checkouts.status='completed'`.
   - Legacy flow: pay through one of the pre-existing Payment Links ->
     webhook hits `/webhooks/stripe` (or `/stripe/checkout.session.completed`)
     -> `donations` or `property_tokens` row updated for `(app_id=1, user_id)`.

The legacy alias and the `handleLegacyStripeCompleted` fallback are intended
as a transition aid. Once every Stripe Payment Link has been migrated to
either `createCheckout` or a session-builder that includes
`metadata.checkout_id`, the fallback path becomes dead code and the
the legacy `/stripe/*` alias can be removed in a future cleanup once all Stripe subscriptions use `/webhooks/stripe`.
