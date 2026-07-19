# Checkout and Official WooCommerce Stripe Gateway Architecture

Last verified against source: 2026-07-19.

## Production authority

Drywall Toolbox uses one storefront checkout/payment authority chain:

```text
React Store API cart
  -> full-document navigation to /checkout/
  -> WordPress serves the assigned WooCommerce Checkout page
  -> WooCommerce Checkout Block
  -> official WooCommerce Stripe Payment Gateway
  -> WooCommerce order/payment lifecycle
  -> DTB captured-payment observation
  -> dtb-orders Action Scheduler queue
  -> Veeqo / QuickBooks / notifications / tracking
```

WooCommerce owns cart/session state, customer/address validation, shipping, tax, totals, Checkout Block, order creation, and authoritative order/payment status.

The official WooCommerce Stripe Payment Gateway owns embedded payment fields, supported Stripe payment methods, Link, eligible Apple Pay/Google Pay/other express methods, tokenization, 3DS/SCA, Stripe-side payment execution, and webhook-backed reconciliation into WooCommerce.

DTB does not create Stripe PaymentIntents, Stripe Checkout Sessions, wallet tokens, payment-method payloads, or storefront orders. DTB owns routing integration, a minimal native checkout document adapter for the headless theme, conservative presentation CSS, readiness diagnostics, order metadata, captured-payment observation, eventing, queues, and downstream projections.

## Headless-theme checkout exception

The public WordPress theme normally forces frontend requests into the React SPA and strips non-React assets. Checkout cannot use that behavior.

`dtb-commerce/Payment/WooNativeCheckoutRuntime.php` is the explicit exception boundary. On WooCommerce checkout/endpoints it:

1. disables the theme's React bundle enqueue for that request;
2. disables the theme's non-React asset stripping;
3. bypasses the theme's SPA `template_include` override;
4. serves `Templates/WooNativeCheckoutPage.php`, a standard WordPress document host;
5. executes the assigned Checkout page content through `the_content()`;
6. leaves Checkout Block, WooCommerce endpoint handling, and official Stripe scripts/styles/provider controls owned by WooCommerce/plugins;
7. sends private/no-store response headers.

The adapter must never manually instantiate payment fields, create an order, or duplicate Checkout Block state.

## Cart/session continuity

Production and staging are same-origin with WordPress/WooCommerce. React therefore uses WooCommerce's cookie-backed Store API session as the primary cart authority and uses the Store API `Nonce` header for mutations.

`Cart-Token` is retained only for genuinely cross-origin headless clients. Same-origin React must not prefer or persist a separate Cart-Token cart because a full-document `/checkout/` navigation uses the browser's WooCommerce session cookie.

Server-side DTB code must never decode an unsigned Cart-Token payload, derive a session ID from it, query `woocommerce_sessions` directly, or inject another session into WooCommerce.

## Frontend checkout handoff

React owns cart interaction only.

- Full cart and drawer use Woo Store API state.
- React does not display synthetic shipping, tax, discounts, or estimated grand totals as checkout authority.
- The full cart may display the Store API merchandise subtotal and state that WooCommerce calculates remaining totals at checkout.
- Checkout is a full-document navigation to the canonical WooCommerce checkout URL.
- The drawer waits for debounced quantity changes and active Store API mutations to settle before navigation. If the cart cannot settle, checkout fails closed instead of transferring a stale cart.
- The React `/checkout` route is compatibility-only. It performs a document handoff and has a one-shot direct WordPress fallback if a routing error serves the SPA at `/checkout/`.

React product pages, product modals, full cart, and mini-cart do not mount Stripe/Woo payment iframes or fabricate express wallet buttons.

## Official Stripe gateway identity

DTB does not trust a gateway merely because its ID starts with `stripe`.

`DTB_OfficialStripeNativeCheckout` verifies that the selected gateway instance is loaded from the official `woocommerce-gateway-stripe` extension using the active extension constants/path and the gateway class source path.

This prevents another Stripe plugin using overlapping `stripe_*` IDs from satisfying DTB's captured-payment authority contract.

Production must have only one storefront card/wallet authority. WooPayments, Payment Plugins for Stripe, custom Stripe integrations, and other competing card/wallet providers must be disabled unless a future architecture explicitly authorizes them.

## Checkout contract metadata

Woo-created checkout orders are tagged with:

```text
_dtb_checkout_gateway = woo_native_stripe
_dtb_checkout_contract_version = woo-stripe-v1
_dtb_checkout_source = woocommerce_checkout | woocommerce_store_api_checkout
_dtb_order_type = product
```

The checkout source is immutable after initial tagging. Payment lifecycle observation uses separate metadata.

After WooCommerce reaches a paid lifecycle hook and DTB verifies the selected gateway is an official Stripe extension instance with a non-secret transaction/payment reference, DTB mirrors:

```text
_dtb_payment_provider = woocommerce_stripe
_dtb_payment_ref = Woo transaction ID / official Stripe payment reference
_dtb_payment_captured = 1 when WooCommerce date_paid is present
_dtb_payment_lifecycle_source = woocommerce_stripe_lifecycle
```

DTB deliberately does not treat source IDs, SetupIntent IDs, arbitrary `stripe_*` method names, browser redirects, or unverified metadata as captured payment proof.

## Captured-payment gate

Fulfillment/accounting eligibility requires all of:

1. exact DTB checkout contract `woo_native_stripe` + `woo-stripe-v1`;
2. `_dtb_payment_provider=woocommerce_stripe`, set only after the official gateway instance is verified;
3. WooCommerce `date_paid` is present;
4. a non-secret transaction/payment reference is present.

Authorization-only payment state is not fulfillable. DTB's launch policy should use automatic capture unless a reviewed manual-capture workflow is explicitly implemented and tested. If manual capture is enabled operationally, the order must remain ineligible for Veeqo/QuickBooks fulfillment/accounting until WooCommerce records the captured/paid state.

## Order lifecycle and idempotency

`dtb-order-platform/Payment/CheckoutPaymentLifecycle.php` observes WooCommerce hooks after the official Stripe mirror runs:

```text
woocommerce_payment_complete
woocommerce_order_status_processing
woocommerce_order_status_completed
woocommerce_order_status_failed
woocommerce_order_status_cancelled
woocommerce_order_status_refunded
```

Paid processing state is recorded as `payment_confirmed`, not `payment_authorized`.

Initial downstream dispatch uses an atomic `add_option()` barrier per Woo order. Veeqo, QuickBooks create, tracking, and related projections are enqueued through `dtb_order_enqueue_job()` in Action Scheduler group `dtb-orders` only after the paid gate passes (or for an explicitly non-payment/free order path allowed by Woo lifecycle policy).

Raw browser/external WooCommerce REST order creation remains blocked by the order write boundary.

## Refund contract

WooCommerce owns refund creation.

Each `woocommerce_order_refunded` event is keyed by both:

```text
order_id + refund_id
```

DTB does not infer refund-versus-cancellation from the parent order status. Partial refunds can leave the parent order in processing and must still be treated as refunds.

QuickBooks refund projection:

- verifies the concrete `WC_Order_Refund` belongs to the parent order;
- uses the exact refund amount, not cumulative lifetime refunded amount;
- uses deterministic document identity `DTB-R-{order_id}-{refund_id}`;
- stores a per-refund QuickBooks entity key;
- prevents one refund from suppressing or duplicating another partial refund.

WooCommerce remains responsible for native refund emails/customer notices unless explicitly changed by a reviewed notification policy.

## Shipping and totals

Current checkout shipping is WooCommerce/DTB policy rating, not live Veeqo carrier rating.

WooCommerce Checkout Block owns the displayed shipping rates, selected rate, tax, discounts, and final payable total. The official Stripe gateway processes the WooCommerce total.

Veeqo becomes authoritative downstream for inventory allocation, fulfillment, labels, shipment execution/status, carrier, and tracking.

## Routing and caching

The domain-root `.htaccess` must route these to WordPress before the SPA catch-all:

```text
/checkout/
/staging/{id}/checkout/
/checkout/order-pay/{order_id}
/checkout/order-received/{order_id}
?wc-api=wc_stripe
/wp-json/*
?rest_route=...
```

Checkout, callbacks, Woo session-owned requests, and payment endpoints must bypass public page cache. Cache-bypass headers/cookies must never replace or corrupt WordPress/WooCommerce `Set-Cookie` headers.

The Apple Pay domain-association file must be reachable at the public domain root when express checkout is enabled.

## Official Stripe operational requirements

Configure the official extension through WooCommerce settings. Before live acceptance:

1. install/activate the official WooCommerce Stripe Payment Gateway;
2. connect the intended Stripe account;
3. verify test/live mode explicitly;
4. enable only intended payment methods;
5. verify Stripe webhook status for both test and live modes as applicable;
6. verify HTTPS across the entire site;
7. verify payment-method domain registration and Apple Pay domain association when wallets are enabled;
8. disable competing storefront card/wallet authorities;
9. keep the assigned Checkout page as the WooCommerce Checkout Block;
10. test with real Woo SKU/variation cart data in staging/test mode before live mode.

The public read-only endpoint `GET /wp-json/dtb/v1/checkout/capabilities` exposes non-secret contract/readiness metadata only. It must never expose Stripe keys, webhook secrets, client secrets, tokens, or raw payment data.

## Presentation policy

Mechanical correctness precedes branding.

`dtb-commerce/assets/woo-native-checkout.css` is intentionally a conservative compatibility baseline while checkout is being proven. It must not hide, re-parent, clone, or restyle provider-owned controls in ways that change eligibility or behavior.

After the full mechanical test matrix passes, the UI may be designed around supported WooCommerce Checkout Block customization and outer styling without changing checkout/payment authority.

## Required verification matrix

Before live payment acceptance verify at minimum:

- guest and authenticated checkout;
- React quantity change immediately followed by checkout handoff;
- cart/session continuity after reload/back/forward;
- simple and variable products with correct SKU/variation/quantity;
- shipping destination/rate recalculation;
- coupons/tax/final total parity between Woo and Stripe;
- card success and decline;
- 3DS/SCA success, cancellation, and retry;
- Apple Pay/Google Pay/Link eligible and ineligible cases as configured;
- duplicate submit/reload/webhook replay does not duplicate orders or downstream jobs;
- order-pay retry path;
- order-received path;
- partial refund, second partial refund, and full refund;
- Veeqo dispatch exactly once after eligible captured payment;
- QuickBooks create exactly once and each refund exactly once by `refund_id`;
- failed/cancelled/unpaid orders do not dispatch fulfillment/accounting;
- `/checkout/` and Stripe callback endpoints are never served by the React SPA or public cache.

## Validation commands

```powershell
cd frontend
npm ci --include=dev
npm run lint
npm run build
```

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

Runtime validation is mandatory. Static source checks cannot prove Stripe account connection, webhook health, wallet eligibility, Woo session cookies, HostGator rewrite/cache behavior, or external Veeqo/QuickBooks responses.
