<!-- markdownlint-disable MD013 MD032 -->

# Drywall Toolbox MU-Plugin Architecture and Runtime Contract

Last verified against source: 2026-07-19.

Source code and the active loader are authoritative for `drywalltoolbox/wp/wp-content/mu-plugins/`. When this document and implementation diverge, correct the document in the same change.

## 1. Runtime model

`00-dtb-loader.php` is the explicit composition root. Preserve module order:

1. `dtb-platform/bootstrap.php`
2. `dtb-catalog-platform/bootstrap.php`
3. `dtb-commerce/bootstrap.php`
4. `dtb-order-platform/bootstrap.php`
5. `dtb-schematics/bootstrap.php`
6. `dtb-media/bootstrap.php`
7. `dtb-marketing/bootstrap.php`
8. `dtb-repair-service/bootstrap.php`
9. `dtb-integrations/bootstrap.php`
10. `dtb-support/bootstrap.php`
11. `dtb-returns/bootstrap.php`

New bounded business logic belongs inside the owning module subtree. Root compatibility files may delegate but must not become new domain homes.

## 2. Module responsibilities

### `dtb-platform`

Security/origin/authentication, shared support primitives, cache/health/logging/metrics, account/history APIs, admin workbenches, Command Center, and System Manager.

### `dtb-catalog-platform`

Catalog/product/variation/brand/taxonomy models and normalization, relationships, compatible/universal parts, inventory intelligence, validation, REST/CLI/admin tooling.

### `dtb-commerce`

- WooCommerce Store API cart extension data;
- toolset/order-line metadata;
- native Woo checkout runtime exception for the headless theme;
- official WooCommerce Stripe gateway readiness/capability metadata;
- checkout-order contract tagging and non-secret paid reference mirroring;
- conservative checkout presentation CSS;
- DTB shipping policy method;
- order-type/query and branded email support;
- commerce-facing REST/admin surfaces.

The checkout runtime adapter lives at:

```text
dtb-commerce/Payment/WooNativeCheckoutRuntime.php
```

It prevents the headless theme from forcing checkout into React or stripping Woo/plugin assets, then hosts the assigned Checkout page content using:

```text
dtb-commerce/Templates/WooNativeCheckoutPage.php
```

It does not manually create Checkout Block state, Stripe fields, PaymentIntents, Stripe Checkout Sessions, or orders.

Official Stripe observation/readiness lives at:

```text
dtb-commerce/Payment/OfficialStripeNativeCheckout.php
```

DTB verifies official gateway origin rather than trusting arbitrary `stripe_*` IDs.

### `dtb-order-platform`

- order statuses/transitions and append-only event ledger;
- integration-state persistence;
- `dtb-orders` Action Scheduler queue/retry;
- order write boundary and duplicate containment;
- captured-payment lifecycle observation;
- refund lifecycle projection keyed by concrete Woo refund ID;
- customer/operator tracking projections and order REST/admin surfaces.

The retired custom checkout-session repository is not part of the native Checkout Block runtime.

### `dtb-schematics` / `dtb-media`

Schematic mapping/editor/runtime APIs and image/media synchronization, validation, registration, and repair tooling.

### `dtb-marketing`

Coming-soon/subscriber and SEO support.

### `dtb-repair-service`

Repair statuses/events/persistence, intake/media/public tokens/quotes/SLA/queues/notifications, customer/operator timelines, REST/admin workbench.

### `dtb-integrations`

Woo adapters, Veeqo inventory/fulfillment, QuickBooks accounting projection, notification dispatch, order pipeline contracts, webhook guards, and marketplace infrastructure.

QuickBooks refund projection must be keyed by `order_id + refund_id`; one cumulative parent-order refund marker is not sufficient for multiple partial refunds.

Rewards integration remains launch-gated unless backend services/jobs/controllers are explicitly restored and validated.

### `dtb-support` / `dtb-returns`

Independent support-ticket and return lifecycle domains with persistence, authorization, customer/admin REST, notifications, histories, and operator workbenches.

## 3. Checkout/payment trust boundary

```text
React cart / cart drawer
  -> WooCommerce Store API same-origin cookie session
  -> full-document /checkout/
  -> domain-root .htaccess routes to WordPress
  -> DTB native checkout runtime exempts request from React theme override
  -> assigned WooCommerce Checkout page
  -> WooCommerce Checkout Block
  -> official WooCommerce Stripe Payment Gateway
  -> WooCommerce order/payment lifecycle
  -> DTB captured-payment verification
  -> dtb-orders queue
  -> Veeqo / QuickBooks / notifications / tracking
```

Authority rules:

- WooCommerce owns cart/session/customer/address/shipping/tax/totals/order creation and authoritative order/payment status.
- Official WooCommerce Stripe Payment Gateway owns Stripe payment rendering, eligible wallets/Link, tokenization, 3DS/SCA, payment execution, and webhook synchronization.
- React owns cart UX/handoff only and must not render payment fields, wallet iframes, fake buttons, or create payment/order objects.
- DTB may style/diagnose/tag/observe, but does not impersonate the gateway.
- Veeqo owns fulfillment truth; QuickBooks owns accounting projection only.

Same-origin React cart traffic uses WooCommerce's cookie-backed session + Store API `Nonce`. Cart-Token is compatibility-only for genuinely cross-origin clients. DTB must never decode unsigned Cart-Token payloads or query `woocommerce_sessions` to recover arbitrary sessions.

## 4. Captured-payment contract

A storefront order is eligible for paid downstream effects only when all are true:

```text
_dtb_checkout_gateway = woo_native_stripe
_dtb_checkout_contract_version = woo-stripe-v1
_dtb_payment_provider = woocommerce_stripe
WooCommerce date_paid is present
non-secret transaction/payment reference is present
```

`_dtb_payment_provider` is mirrored only after the selected gateway instance is verified as originating from the official `woocommerce-gateway-stripe` extension.

Authorization-only/manual-capture state is not fulfillable. Launch should use automatic capture unless a reviewed manual-capture workflow is explicitly approved and tested.

Initial downstream processing dispatch is protected by an atomic per-order `add_option()` barrier.

## 5. Refund contract

WooCommerce owns refund creation. `woocommerce_order_refunded` supplies both parent `order_id` and concrete `refund_id`.

Each refund must retain that identity through queue arguments, event idempotency, and QuickBooks projection. Partial refund A and partial refund B are distinct accounting events.

Do not infer cancellation from the parent order remaining in processing after a partial refund. Do not use cumulative `get_total_refunded()` as the amount for every refund event.

## 6. Request/security boundaries

Every REST route needs explicit permission behavior. Customer-facing record reads must authenticate, derive the validated customer identity, verify record ownership, and not trust caller-supplied customer IDs.

Server-only secrets include Woo application credentials, JWT signing secrets, official Stripe secret/webhook configuration, Veeqo/QuickBooks/marketplace credentials, and external-write secrets. Browser `REACT_APP_*` values are public by definition.

The React storefront does not require a Stripe key for the current architecture.

## 7. Routing/cache contract

Root routing must send these to WordPress before SPA fallback:

```text
/checkout/
/staging/{id}/checkout/
/checkout/order-pay/{id}
/checkout/order-received/{id}
/wp-json/*
?rest_route=...
?wc-api=wc_stripe
```

Checkout, callbacks, session-owned pages, and payment endpoints are private/no-store. Host cache-bypass cookies must be added without replacing WordPress/WooCommerce `Set-Cookie` headers.

## 8. Async/integration contract

Order-related external effects use `dtb_order_enqueue_job()` and Action Scheduler group `dtb-orders`.

New work must define owner, hook/args, idempotency/deduplication, retries/terminal failure, observability, and recovery. Slow Veeqo/QuickBooks calls must not occur synchronously during checkout or Stripe webhook acknowledgement.

## 9. Deployment contract

Live production paths:

- React build contents -> `/public_html/drywalltoolbox/`;
- root `.htaccess` -> `/public_html/drywalltoolbox/.htaccess`;
- WordPress deployment mirror -> `/public_html/drywalltoolbox/wp/` matching tracked paths.

Never overwrite `wp-config.php`, WordPress core unintentionally, uploads, cache, upgrade state, runtime secrets, or uncontrolled dumps.

Clean deployments must delete retired custom order-pay/checkout-session/payment iframe artifacts rather than leave them beside the canonical runtime.

## 10. Validation

Frontend:

```powershell
cd frontend
npm ci --include=dev
npm run lint
npm run build
```

Targeted PHP/source validation:

```powershell
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooNativeCheckoutRuntime.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/OfficialStripeNativeCheckout.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Domain/PaymentState.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Payment/CheckoutPaymentLifecycle.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Payment/RefundLifecycle.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-integrations/OperationalPipeline/QuickBooksAccountingPipeline.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-integrations/OperationalPipeline/QuickBooksJobOverride.php
git diff --check
```

Do not claim a referenced smoke script passed if it is absent from the checked-out repository.

Runtime staging validation must prove cart/session continuity, Checkout Block rendering, official Stripe cards/3DS/eligible and ineligible express methods, order creation exactly once, captured-payment gating, webhook replay tolerance, order-pay retry, refunds by `refund_id`, Veeqo dispatch once, and QuickBooks create/refund projection exactly once before live payment acceptance.
