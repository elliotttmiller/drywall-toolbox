# Checkout and Official WooCommerce Stripe Gateway Architecture

## Purpose

Drywall Toolbox checkout uses WooCommerce as the cart, customer, address, shipping, tax, checkout, and order authority. The official WooCommerce Stripe Payment Gateway is the single active storefront payment authority for embedded card fields, Link, eligible Apple Pay / Google Pay express controls, tokenization, payment processing, 3DS/SCA, and webhook-backed payment status.

React owns product browsing, cart page, cart drawer, account UX, and checkout handoff UX only. React does not draw wallet buttons, frame checkout/payment iframes, create PaymentIntents, create Stripe Checkout Sessions, create orders, or own payment lifecycle state.

The customer remains on `drywalltoolbox.com`. `/checkout/` is the assigned WordPress/WooCommerce Checkout page containing the native WooCommerce Checkout Block. DTB may style that native page and add diagnostics/order metadata, but DTB does not replace the checkout document or manually render isolated Woo payment blocks.

## System-of-record boundaries

| Concern | Authority |
| --- | --- |
| Product browsing, React cart page, React cart drawer, checkout CTA | React storefront |
| Cart/session/customer/address/shipping/tax/order creation | WooCommerce Checkout Block / Store API |
| Embedded card form, Link, Apple Pay, Google Pay, tokenization, 3DS/SCA, webhooks | Official WooCommerce Stripe Payment Gateway |
| Checkout styling, readiness diagnostics, checkout-order tagging, paid-order observation, event ledger, downstream jobs | DTB MU plugins |
| Product catalog, customer account, operational order record | WooCommerce |
| Inventory allocation, fulfillment, labels, shipment/tracking | Veeqo |
| Accounting projection after eligible payment/refund events | QuickBooks |

React and DTB REST responses must never expose WooCommerce application passwords, Stripe secrets, webhook secrets, Veeqo credentials, QuickBooks credentials, private keys, PaymentIntent client secrets, wallet tokens, or raw payment method data.

## Production flow

```text
React cart / cart side sheet
  -> full-document navigation to /checkout/
  -> .htaccess routes /checkout/ to wp/index.php?pagename=checkout
  -> WordPress serves the assigned WooCommerce Checkout page
  -> WooCommerce Checkout Block renders customer/order/payment workflow
  -> official WooCommerce Stripe Payment Gateway renders embedded payment form and eligible wallet controls
  -> WooCommerce creates the order
  -> Stripe gateway processes payment and reconciles webhooks
  -> WooCommerce payment_complete / processing / completed hooks
  -> DTB order event ledger + dtb-orders queue
  -> Veeqo, QuickBooks, notification, and tracking projections
```

There is no supported React mini-cart/product iframe express-payment path. Stripe wallet controls must render through WooCommerce-supported Checkout/Product/Cart contexts. Because Drywall Toolbox uses a React cart and React product UX rather than native Woo Cart/Product templates, the only production-approved express/wallet surface is the native Woo Checkout Block until an officially supported integration is adopted.

## Active checkout surfaces

| Surface | Authority |
| --- | --- |
| `/checkout/` | Assigned WordPress Checkout page containing WooCommerce Checkout Block |
| `/checkout/order-pay/{id}` | WooCommerce order-pay endpoint for payment retry only |
| `/checkout/order-received/{id}` | WooCommerce order-received endpoint |
| React `/checkout` route | Compatibility handoff that forces full-page navigation into `/checkout/` |

The retired custom Stripe Embedded Checkout Session bridge, DTB official-Stripe express iframe surface, WooPayments integration, Payment Plugins integration, React payment page, custom DTB payment-intent routes, DTB standalone checkout document, and DTB WooPayments express iframe surface are not checkout authorities.

## Official Stripe gateway configuration

Production requires the official WooCommerce Stripe Payment Gateway to be installed, connected, enabled, and tested through WooCommerce settings.

Recommended wp-admin path:

```text
WooCommerce -> Settings -> Payments -> Stripe
```

Required operational settings:

1. Install and activate the official WooCommerce Stripe Payment Gateway.
2. Connect the intended Stripe account through the official gateway connection flow.
3. Enable Stripe as the active card/wallet checkout provider.
4. Enable the desired embedded payment methods, Link, and express checkout methods supported by the gateway.
5. Verify Apple Pay / Google Pay / Link behavior on eligible devices and browsers from the native Checkout Block.
6. Confirm Stripe webhook/account health in WooCommerce status tools and Stripe dashboard.
7. Disable WooPayments, Payment Plugins for Stripe, and any other competing card/wallet storefront payment authority.
8. Confirm test mode before any live payment attempt.

The official Stripe gateway owns payment method rendering, wallet availability, tokenization, challenge/redirect authentication, and webhook-backed payment state. DTB does not create a parallel payment webhook endpoint for storefront payment completion.

## DTB official Stripe checkout integration

`DTB_OfficialStripeNativeCheckout` owns only the native-checkout support layer:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/OfficialStripeNativeCheckout.php
```

Responsibilities:

- enqueue DTB checkout styling only for the primary native checkout page;
- add checkout body classes for CSS scoping;
- expose a read-only checkout capabilities route with non-secret contract metadata;
- tag Woo checkout orders with DTB metadata;
- mirror verified Stripe references into non-secret DTB order meta;
- show wp-admin readiness warnings when the official Stripe gateway is not enabled, the Checkout page lacks the Checkout Block, or WooPayments remains active as a competing authority.

Presentation asset:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/assets/woo-native-checkout.css
```

The module must not call `template_redirect` to print a custom checkout document, must not render isolated payment blocks, and must not create iframe wallet surfaces.

## Order metadata

Woo checkout orders are tagged with:

```text
_dtb_checkout_gateway = woo_native_stripe
_dtb_checkout_contract_version = woo-stripe-v1
_dtb_checkout_source = woocommerce_checkout | woocommerce_store_api_checkout | woocommerce_stripe_lifecycle
_dtb_order_type = product
```

When WooCommerce reports a verified Stripe payment with a transaction/payment reference, DTB mirrors:

```text
_dtb_payment_provider = woocommerce_stripe
_dtb_payment_ref = Woo transaction id or official Stripe payment reference
_dtb_payment_captured = 1 when date_paid is present
```

These values are non-secret references only.

## Downstream lifecycle

DTB order-platform observes WooCommerce payment lifecycle hooks:

```text
woocommerce_payment_complete
woocommerce_order_status_processing
woocommerce_order_status_completed
woocommerce_order_status_failed
woocommerce_order_status_cancelled
woocommerce_order_status_refunded
```

For DTB-tagged official Stripe orders with provider-verified captured payment, DTB appends lifecycle events and dispatches `dtb-orders` processing jobs once. The webhook/payment authority remains the official Stripe gateway.

## Cart/session policy

React Store API calls may use WooCommerce's supported Store API session mechanisms. Server-side DTB code must never decode an unverified Cart-Token payload, select a session key from that payload, query `woocommerce_sessions` directly, or inject arbitrary session rows into the active Woo session.

WooCommerce owns Cart-Token validation and session resolution. If React-to-Woo checkout cart continuity fails, fix the supported Store API/session-cookie configuration; do not bypass WooCommerce session authority.

## Routing contract

The public root `.htaccess` must route these to WordPress before the React SPA catch-all:

```text
/checkout/
/checkout/order-pay/{id}
/checkout/?pay_for_order=true&key=wc_order_...
/wp-json/*
?rest_route=...
?wc-api=...
```

`GET /wp-json/dtb/v1/checkout/capabilities` remains a public, read-only compatibility route. It returns non-secret checkout contract metadata and enabled official Stripe gateway identifiers. It does not create orders, render payment fields, expose gateway secrets, or replace WooCommerce checkout.

## Failure and fallback behavior

- If the assigned Checkout page lacks the WooCommerce Checkout Block, wp-admin shows a blocking readiness warning.
- If the official Stripe gateway is not enabled, wp-admin shows a warning before live payment acceptance.
- If WooPayments is also enabled, wp-admin shows a competing-authority warning.
- React cart and drawer always preserve the standard checkout CTA.
- No fallback may fabricate Apple Pay/Google Pay/Link buttons or create an alternate order/payment path.
- Checkout remains same-domain but payment fields are provider-owned embedded controls.

## Deployment checklist

Before production use:

1. Deploy frontend and backend as a clean mirror, not a partial FTP overlay.
2. Remove retired Stripe Embedded Checkout bridge files, DTB Stripe express iframe files, and DTB WooPayments files from live `mu-plugins` if previously deployed.
3. Confirm `/wp-json/` returns JSON.
4. Confirm `/wp-json/dtb/v1/catalog/products?per_page=1` returns JSON.
5. Confirm `/checkout/` renders the assigned WooCommerce Checkout page with the Checkout Block.
6. Confirm the React cart and cart drawer navigate to `/checkout/` and do not mount payment iframes.
7. Confirm the official WooCommerce Stripe gateway is installed, connected, enabled, and in the intended test/live mode.
8. Confirm WooPayments and Payment Plugins for Stripe are disabled as storefront payment authorities.
9. Test guest checkout, authenticated checkout, cards, 3DS/SCA, wallets, wallet-ineligible devices, failed payment, retry, order-received, refund, webhook delay/replay, Veeqo sync, and QuickBooks eligibility.

## Validation commands

Frontend:

```powershell
cd frontend
npm ci --include=dev
npm run lint
npm run build
```

Backend:

```powershell
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/OfficialStripeNativeCheckout.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Domain/PaymentState.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Validation/CheckoutValidator.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Payment/CheckoutPaymentLifecycle.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/bootstrap.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/bootstrap.php
.\scripts\smoke-dtb-mu-modules.ps1
git diff --check
```

Runtime verification remains mandatory because final wallet availability, payment UI, Woo session continuity, Stripe account state, webhook status, order transitions, Veeqo sync, and QuickBooks projection depend on deployed WooCommerce/Stripe/Veeqo configuration.
