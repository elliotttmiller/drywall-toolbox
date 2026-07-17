# Checkout and Official WooCommerce Stripe Architecture

## Purpose

Drywall Toolbox checkout uses WooCommerce Checkout Block as the storefront checkout/order-creation authority and the official WooCommerce Stripe Payment Gateway as the payment-rendering and Stripe synchronization authority.

React owns the storefront browsing/cart/account experience and hands checkout off to `/checkout/` with a full-document navigation. The root `.htaccess` routes `/checkout/` into WordPress/WooCommerce instead of the React SPA shell. DTB styles and brands the Woo checkout page, tags Woo checkout orders for downstream lifecycle observation, and dispatches order-processing jobs only after WooCommerce reports verified payment lifecycle events.

## System-of-record boundaries

| Concern | Authority |
| --- | --- |
| Product browsing, cart sidebar, account UX, checkout handoff | React storefront |
| Checkout form, customer/address collection, order creation | WooCommerce Checkout Block / Store API |
| Stripe payment form, wallets, saved payment methods, payment processing, Stripe webhooks | Official WooCommerce Stripe Payment Gateway |
| Checkout page shell/styling, checkout-order tagging, paid-order observation, event ledger, downstream jobs | DTB MU plugins |
| Product catalog, customer account, operational order record | WooCommerce |
| Inventory allocation, fulfillment, labels, shipment/tracking | Veeqo |
| Accounting projection after eligible payment/refund events | QuickBooks |

React must never receive Stripe secret keys, webhook secrets, WooCommerce application passwords, Veeqo credentials, QuickBooks credentials, or private integration credentials. Browser code does not create Stripe Checkout Sessions and does not copy or mount private gateway internals.

## Production flow

```text
React cart / cart side sheet
  -> full-document navigation to /checkout/
  -> .htaccess routes /checkout/ to wp/index.php?pagename=checkout
  -> DTB Woo checkout shell filter renders WooCommerce Checkout Block
  -> official WooCommerce Stripe Payment Gateway renders payment methods
  -> WooCommerce Store API checkout creates the order
  -> official Stripe gateway processes payment
  -> official Stripe gateway webhooks update WooCommerce order/payment status
  -> WooCommerce payment_complete / processing / completed hooks
  -> DTB order event ledger + dtb-orders queue
  -> Veeqo, QuickBooks, notification, and tracking projections
```

## Active checkout surface

| Surface | Authority |
| --- | --- |
| `/checkout/` | WordPress/WooCommerce Checkout Block, not React SPA |
| `/checkout/order-pay/{id}` | WooCommerce order-pay endpoint for payment retry only |
| `/checkout/order-received/{id}` | WooCommerce order-received endpoint |
| React `/checkout` route | Compatibility handoff that forces a full-page navigation into `/checkout/` |

The retired Stripe Embedded Checkout Session bridge, same-shell payment iframe, Payment Plugins integration, and custom DTB payment-surface routes are not active checkout authorities.

## Official Stripe gateway configuration

Production requires the official WooCommerce Stripe Payment Gateway to be installed, connected, enabled, and configured through WooCommerce settings.

Recommended wp-admin path:

```text
WooCommerce -> Settings -> Payments -> Stripe
```

Required operational settings:

1. Connect the official Stripe gateway to the production Stripe account.
2. Enable the Stripe payment method for checkout.
3. Enable Optimized Checkout Suite where supported.
4. Choose the desired Optimized Checkout Suite layout, normally Accordion for mobile-friendly checkout.
5. Confirm live and test webhook status is configured by the plugin connection.
6. Verify wallet/domain registration for Apple Pay / Google Pay / Link where used.
7. Disable Payment Plugins for Stripe and any other competing Stripe checkout gateway as storefront payment authorities.

The official gateway owns Stripe webhook registration and synchronization. DTB does not create an additional storefront checkout webhook endpoint for payment completion in this architecture.

## DTB Woo checkout integration

`DTB_WooNativeStripeCheckout` owns the DTB layer around Woo checkout:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooNativeStripeCheckout.php
```

Responsibilities:

- enqueue the DTB checkout stylesheet only on the primary Woo checkout page;
- replace the checkout page content with a branded shell around the WooCommerce Checkout Block, falling back to `[woocommerce_checkout]` if block rendering is unavailable;
- tag Woo checkout orders with DTB metadata;
- mirror verified official Stripe payment references into non-secret DTB order meta;
- show wp-admin readiness warnings if WooCommerce is active but the official Stripe gateway is not enabled.

The styling file is:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/assets/woo-native-checkout.css
```

## Order metadata

Woo checkout orders are tagged with:

```text
_dtb_checkout_gateway = woo_native_stripe
_dtb_checkout_contract_version = woo-stripe-v1
_dtb_checkout_source = woocommerce_checkout | woocommerce_store_api_checkout | woocommerce_stripe_payment_lifecycle
_dtb_order_type = product
```

When WooCommerce reports verified official Stripe payment with a transaction/payment reference, DTB mirrors:

```text
_dtb_payment_provider = woo_official_stripe
_dtb_payment_ref = Woo transaction id or Stripe payment reference
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

For DTB-tagged, verified official Stripe orders, DTB appends lifecycle events and dispatches `dtb-orders` processing jobs once payment is captured. The webhook/payment authority remains the official Stripe gateway.

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

This prevents React from rendering the checkout route and prevents API calls from returning SPA HTML instead of JSON.

## Deployment checklist

Before production use:

1. Deploy frontend and backend as a clean mirror, not a partial FTP overlay.
2. Remove retired Stripe Embedded Checkout bridge files from live `mu-plugins` if they were previously deployed.
3. Confirm `/wp-json/` returns JSON.
4. Confirm `/wp-json/dtb/v1/catalog/products?per_page=1` returns JSON.
5. Confirm `/checkout/` renders the WooCommerce checkout page, not the React SPA.
6. Confirm the official Stripe gateway is connected and enabled.
7. Confirm official Stripe gateway webhooks are configured in live and test modes.
8. Confirm Payment Plugins for Stripe is disabled as a checkout payment authority.
9. Test card success, 3DS, wallets, failed card, payment retry, refund, dispute, Woo order status changes, Veeqo order sync by SKU, and QuickBooks projection eligibility.

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
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooNativeStripeCheckout.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Domain/PaymentState.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Payment/CheckoutPaymentLifecycle.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/bootstrap.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/bootstrap.php
.\scripts\smoke-dtb-mu-modules.ps1
git diff --check
```

Runtime verification remains mandatory because the final payment form, webhook status, wallet registration, order status transitions, Veeqo sync, and QuickBooks projection depend on deployed WooCommerce/Stripe/Veeqo configuration.
