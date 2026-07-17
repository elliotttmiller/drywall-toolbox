# Checkout Stripe Payment Architecture

## Purpose

Drywall Toolbox checkout uses one payment authority: WooCommerce plus Payment Plugins for Stripe WooCommerce. React owns checkout presentation and step workflow. DTB owns checkout orchestration, validation, idempotency, order write boundaries, and lifecycle observation. Payment Plugins owns Stripe credentials, Stripe Elements, wallets, PaymentIntents, webhooks, refunds, disputes, and WooCommerce payment completion.

This document is the durable checkout/payment contract for production implementation and operations.

## System-of-record boundaries

| Concern | Authority |
| --- | --- |
| Checkout layout and customer workflow | React storefront |
| Quote/session/confirm/finalize/idempotency | DTB MU plugins |
| Order object, status, totals, taxes, payment status | WooCommerce |
| Stripe Elements, Payment Element, wallets, PaymentIntents, webhooks | Payment Plugins for Stripe WooCommerce |
| Paid-order observation and downstream jobs | DTB order platform |

DTB must not create Stripe Checkout Sessions, direct browser PaymentIntents, duplicate Stripe webhook endpoints, or independent payment completion code.

## Production flow

```text
React checkout shell
  -> POST /wp-json/dtb/v1/checkout/quote
  -> POST /wp-json/dtb/v1/checkout/session
  -> POST /wp-json/dtb/v1/checkout/confirm
  -> POST /wp-json/dtb/v1/checkout/finalize
  -> WooCommerce order created by DTB with provider payment method
  -> signed same-origin DTB payment surface
  -> native WooCommerce Checkout Block document
  -> Payment Plugins Stripe Blocks method: stripe_upm or stripe_cc
  -> Stripe Elements / Payment Element / wallet sheet
  -> WooCommerce Store API keyed existing-order checkout
  -> Payment Plugins payment completion + webhook reconciliation
  -> DTB payment lifecycle observer marks checkout session paid
  -> DTB order event ledger + dtb-orders downstream queues
```

## Active provider contract

Installed provider path:

```text
drywalltoolbox/wp/wp-content/plugins/woo-stripe-payments
```

Provider-owned integration points in active use:

- REST namespace: `wc-stripe/v1`
- Webhook endpoint: `/wp-json/wc-stripe/v1/webhook`
- Checkout Blocks integrations under `packages/packages/blocks/src`
- Gateway ids: `stripe_upm`, `stripe_cc`, `stripe_applepay`, `stripe_googlepay`, `stripe_link_checkout`
- DTB-supported hooks:
  - `wc_stripe_get_element_options`
  - `wc_stripe_order_meta_data`
  - `wc_stripe_payment_intent_args`
  - `wc_stripe_order_payment_complete`
  - `wc_stripe_webhook_payment_intent_succeeded`
  - `woocommerce_payment_complete`
  - `woocommerce_order_status_processing`
  - `woocommerce_order_status_completed`

## Same-origin payment surface

The React checkout page never renders Stripe card fields directly. After `finalize`, DTB returns the payable WooCommerce order context. The frontend mounts a signed same-origin WordPress document that renders the native WooCommerce Checkout Block. Payment Plugins registers and renders the Stripe payment method inside that document.

The payment surface verifies:

- signed token integrity and expiry;
- order key;
- DTB checkout session id;
- DTB cart hash;
- checkout session state;
- same WooCommerce customer/session ownership.

The surface defensively reroutes Store API checkout submissions from `/wc/store/v1/checkout` to `/wc/store/v1/checkout/{order_id}` with the verified order key. This prevents ambient-cart order creation and preserves the one storefront order materialization path.

## Idempotency and duplicate-effect containment

DTB checkout session promotion and finalization use the frontend attempt id as an idempotency key. The backend binds that key to the cart/session fingerprint. A repeat call with the same fingerprint returns the existing session/order. A repeat with different checkout details is rejected.

Post-payment effects are not performed during checkout finalize. Payment Plugins completes the WooCommerce order. DTB observes verified WooCommerce payment state and appends idempotent lifecycle events before dispatching downstream jobs.

## Payment lifecycle observation

DTB treats a checkout order as paid only after WooCommerce/Payment Plugins have a paid date plus a gateway reference. The observer listens to WooCommerce payment/status actions and only then transitions the DTB checkout session to `paid`, removes `_dtb_payment_handoff_pending`, and dispatches DTB order processing jobs.

The Stripe integration attaches only non-secret correlation metadata to Payment Plugins requests. No Stripe secrets, client secrets, webhook secrets, or credentials are exposed to React, REST responses, logs, or generated assets.

## Operational readiness checklist

Before production use, verify in the WordPress/WooCommerce/Stripe runtime:

1. Payment Plugins for Stripe WooCommerce is connected in the intended live/test mode.
2. The Stripe webhook points to `/wp-json/wc-stripe/v1/webhook`.
3. Webhook deliveries are healthy in Stripe Dashboard.
4. Wallet domains are registered where Apple Pay, Google Pay, or Link are enabled.
5. Legacy gateways are disabled unless intentionally retained outside the storefront checkout path.
6. A normal card, 3DS card, failed card, retry, wallet, refund, and webhook-delayed completion are tested.
7. DTB checkout session state reaches `paid` only after WooCommerce payment completion.
8. DTB event ledger and `dtb-orders` queue receive exactly one downstream processing dispatch per paid order.

## Validation commands

Frontend:

```powershell
cd frontend
npm run lint
npm run build:staging
```

Backend:

```powershell
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/PaymentPluginsStripeIntegration.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/CheckoutPaymentSurface.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Payment/CheckoutPaymentLifecycle.php
git diff --check
```

Runtime verification is still required because Stripe Elements, wallet domain state, webhooks, and WooCommerce Blocks registry availability depend on the deployed WordPress/plugin environment.
