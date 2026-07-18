# Checkout and WooPayments Architecture

## Purpose

Drywall Toolbox checkout uses WooCommerce as the order, customer, cart, address, shipping, tax, and checkout authority. WooPayments is the single active storefront payment authority for embedded cards, supported wallets, tokenization, payment processing, and webhook-backed payment status.

React owns product browsing, cart page, cart drawer, account UX, and the checkout handoff. React does not host payment iframes, create payment intents, create checkout sessions, create orders, render wallet lookalikes, or own payment lifecycle state.

The customer remains on `drywalltoolbox.com`. `/checkout/` is a WordPress/WooCommerce document with a DTB-branded shell around the native WooCommerce Checkout Block or classic `[woocommerce_checkout]` fallback.

## System-of-record boundaries

| Concern | Authority |
| --- | --- |
| Product browsing, cart page, cart drawer, account UX, checkout CTA | React storefront |
| Cart/session/customer/address/shipping/tax/order creation | WooCommerce Checkout Block / Store API |
| Embedded payment form, Apple Pay, Google Pay, Link, WooPay, cards, tokenization, 3DS/SCA, webhooks | WooPayments |
| Checkout shell/styling, readiness diagnostics, checkout-order tagging, paid-order observation, event ledger, downstream jobs | DTB MU plugins |
| Product catalog, customer account, operational order record | WooCommerce |
| Inventory allocation, fulfillment, labels, shipment/tracking | Veeqo |
| Accounting projection after eligible payment/refund events | QuickBooks |

React and DTB REST responses must never expose WooCommerce application passwords, WooPayments/Stripe secrets, webhook secrets, Veeqo credentials, QuickBooks credentials, private keys, PaymentIntent client secrets, wallet tokens, or raw payment method data.

## Production flow

```text
React cart / cart side sheet
  -> full-document navigation to /checkout/
  -> .htaccess routes /checkout/ to wp/index.php?pagename=checkout
  -> DTB standalone Woo checkout shell renders same-domain checkout document
  -> WooCommerce Checkout Block or [woocommerce_checkout] renders customer/order workflow
  -> WooPayments renders embedded payment form and eligible wallets
  -> WooCommerce creates the order
  -> WooPayments processes payment and reconciles webhooks
  -> WooCommerce payment_complete / processing / completed hooks
  -> DTB order event ledger + dtb-orders queue
  -> Veeqo, QuickBooks, notification, and tracking projections
```

## Active checkout surfaces

| Surface | Authority |
| --- | --- |
| `/checkout/` | WordPress/WooCommerce Checkout Block or classic checkout, rendered inside the DTB WooPayments shell |
| `/checkout/order-pay/{id}` | WooCommerce order-pay endpoint for payment retry only |
| `/checkout/order-received/{id}` | WooCommerce order-received endpoint |
| React `/checkout` route | Compatibility handoff that forces full-page navigation into `/checkout/` |

The retired custom Stripe Embedded Checkout Session bridge, official Stripe express iframe surface, Payment Plugins integration, React payment page, and custom DTB payment-intent routes are not checkout authorities.

## WooPayments configuration

Production requires WooPayments to be installed, connected, enabled, and tested through WooCommerce settings.

Recommended wp-admin path:

```text
WooCommerce -> Settings -> Payments -> WooPayments
```

Required operational settings:

1. Connect WooPayments to the intended production account.
2. Enable WooPayments as the active card/wallet checkout provider.
3. Enable the desired embedded payment methods and express checkout methods.
4. Verify Apple Pay / Google Pay / WooPay / Link behavior on eligible devices and browsers.
5. Confirm WooPayments webhook/account health in WooCommerce status tools.
6. Disable the official WooCommerce Stripe Gateway, Payment Plugins for Stripe, and any other competing card/wallet storefront payment authority.
7. Confirm staging/test mode before any live payment attempt.

WooPayments owns payment method rendering, wallet availability, tokenization, challenge/redirect authentication, and webhook-backed payment state. DTB does not create a parallel payment webhook endpoint for storefront payment completion.

## DTB WooPayments checkout integration

`DTB_WooPaymentsNativeCheckout` owns the branded same-domain layer around Woo checkout:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooPaymentsNativeCheckout.php
```

Responsibilities:

- render the primary `/checkout/` document directly from WordPress on checkout requests, avoiding fragile theme `the_content` dependence;
- render a DTB-branded, multi-step checkout shell around WooCommerce Checkout Block, falling back to `[woocommerce_checkout]` if block rendering is unavailable;
- render a visible unavailable panel if Woo checkout markup cannot be produced;
- enqueue DTB checkout styling only for the primary checkout page;
- tag Woo checkout orders with DTB metadata;
- mirror verified WooPayments references into non-secret DTB order meta;
- show wp-admin readiness warnings when WooPayments is not enabled or a competing Stripe gateway remains active.

Presentation asset:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/assets/woo-native-checkout.css
```

## Order metadata

Woo checkout orders are tagged with:

```text
_dtb_checkout_gateway = woo_native_woopayments
_dtb_checkout_contract_version = woo-payments-v1
_dtb_checkout_source = woocommerce_checkout | woocommerce_store_api_checkout | woocommerce_woopayments_lifecycle
_dtb_order_type = product
```

When WooCommerce reports a verified WooPayments payment with a transaction/payment reference, DTB mirrors:

```text
_dtb_payment_provider = woopayments
_dtb_payment_ref = Woo transaction id or WooPayments/Stripe payment reference
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

For DTB-tagged WooPayments orders with provider-verified captured payment, DTB appends lifecycle events and dispatches `dtb-orders` processing jobs once. The webhook/payment authority remains WooPayments.

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

`GET /wp-json/dtb/v1/checkout/capabilities` remains a public, read-only compatibility route. It returns non-secret checkout contract metadata and enabled WooPayments gateway identifiers. It does not create orders, render payment fields, expose gateway secrets, or replace WooCommerce checkout.

## Failure and fallback behavior

- If Woo checkout markup is unavailable, DTB renders a visible customer-facing fallback panel instead of a blank page.
- If WooPayments is not enabled, wp-admin shows a warning before live payment acceptance.
- If the official WooCommerce Stripe gateway is also enabled, wp-admin shows a competing-authority warning.
- No fallback may fabricate Apple Pay/Google Pay/WooPay buttons or create an alternate order/payment path.
- Checkout remains same-domain but payment fields are provider-owned embedded controls.

## Deployment checklist

Before production use:

1. Deploy frontend and backend as a clean mirror, not a partial FTP overlay.
2. Remove retired Stripe Embedded Checkout bridge files and official Stripe express iframe files from live `mu-plugins` if previously deployed.
3. Confirm `/wp-json/` returns JSON.
4. Confirm `/wp-json/dtb/v1/catalog/products?per_page=1` returns JSON.
5. Confirm `/checkout/` renders the DTB WooPayments shell and a visible Woo checkout form.
6. Confirm WooPayments is installed, connected, enabled, and in the intended test/live mode.
7. Confirm official WooCommerce Stripe Gateway and Payment Plugins for Stripe are disabled as storefront payment authorities.
8. Test guest checkout, authenticated checkout, cards, 3DS/SCA, wallets, wallet ineligible devices, failed payment, retry, order-received, refund, webhook delay/replay, Veeqo sync, and QuickBooks eligibility.

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
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooPaymentsNativeCheckout.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Domain/PaymentState.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Payment/CheckoutPaymentLifecycle.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/bootstrap.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/bootstrap.php
.\scripts\smoke-dtb-mu-modules.ps1
git diff --check
```

Runtime verification remains mandatory because final wallet availability, payment UI, Woo session continuity, WooPayments account state, webhook status, order transitions, Veeqo sync, and QuickBooks projection depend on deployed WooCommerce/WooPayments/Veeqo configuration.
