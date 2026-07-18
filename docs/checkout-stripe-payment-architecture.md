# Checkout and Official WooCommerce Stripe Architecture

## Purpose

Drywall Toolbox checkout uses WooCommerce Checkout Block as the storefront checkout/order-creation authority and the official WooCommerce Stripe Payment Gateway as the payment-rendering and Stripe synchronization authority.

React owns the storefront browsing, cart, account, and responsive interaction experience. Standard checkout performs a full-document handoff to `/checkout/`. On eligible mobile cart surfaces, React may also frame the official Stripe Express Checkout Element through the same-origin DTB surface documented below. DTB does not create wallet buttons, Stripe intents, payment tokens, or orders.

The root `.htaccess` routes `/checkout/` into WordPress/WooCommerce instead of the React SPA shell. DTB styles and brands the Woo checkout page, tags Woo checkout orders for downstream lifecycle observation, and dispatches order-processing jobs only after WooCommerce reports verified payment lifecycle events.

## System-of-record boundaries

| Concern | Authority |
| --- | --- |
| Product browsing, cart page, cart drawer, account UX, checkout handoff | React storefront |
| Checkout form, customer/address collection, shipping selection, order creation | WooCommerce Checkout Block / Store API |
| Stripe payment form, Express Checkout Element, Apple Pay, Google Pay, saved payment methods, payment processing, Stripe webhooks | Official WooCommerce Stripe Payment Gateway |
| Checkout shell/styling, same-origin express surface shell, checkout-order tagging, paid-order observation, event ledger, downstream jobs | DTB MU plugins |
| Product catalog, customer account, operational order record | WooCommerce |
| Inventory allocation, fulfillment, labels, shipment/tracking | Veeqo |
| Accounting projection after eligible payment/refund events | QuickBooks |

React must never receive Stripe secret keys, webhook secrets, WooCommerce application passwords, Veeqo credentials, QuickBooks credentials, private integration credentials, PaymentIntent client secrets, or wallet tokens. Browser code does not create Stripe Checkout Sessions and does not copy or mount private gateway internals.

## Production flow

### Standard checkout

```text
React cart / cart side sheet
  -> full-document navigation to /checkout/
  -> .htaccess routes /checkout/ to wp/index.php?pagename=checkout
  -> DTB Woo checkout shell renders WooCommerce Checkout Block
  -> official WooCommerce Stripe Payment Gateway renders payment methods
  -> WooCommerce Store API checkout creates the order
  -> official Stripe gateway processes payment
  -> official Stripe gateway webhooks update WooCommerce order/payment status
  -> WooCommerce payment_complete / processing / completed hooks
  -> DTB order event ledger + dtb-orders queue
  -> Veeqo, QuickBooks, notification, and tracking projections
```

### Mobile express checkout

```text
React mobile cart page or cart drawer
  -> same-origin iframe requests /checkout/?dtb_express_surface=1
  -> DTB emits a minimal no-store, same-origin frame shell
  -> official WooCommerce Stripe Express Checkout Element evaluates eligibility
  -> Apple Pay and/or Google Pay render only when provider/device/browser/cart rules allow
  -> official gateway collects wallet address/shipping data and creates the Woo order
  -> official Stripe gateway processes payment and reconciles webhooks
  -> successful order-received navigation is promoted to the top-level document
  -> normal Woo payment lifecycle and DTB downstream queues continue
```

Apple Pay and Google Pay availability is dynamic. The official gateway may render one method, both methods, or no method. DTB must not render lookalike buttons when the provider reports a method unavailable.

## Active checkout surfaces

| Surface | Authority |
| --- | --- |
| `/checkout/` | WordPress/WooCommerce Checkout Block, not React SPA |
| `/checkout/?dtb_express_surface=1&dtb_surface_id={id}` | Minimal same-origin DTB shell containing only the official Stripe Express Checkout Element |
| `/checkout/order-pay/{id}` | WooCommerce order-pay endpoint for payment retry only |
| `/checkout/order-received/{id}` | WooCommerce order-received endpoint |
| React `/checkout` route | Compatibility handoff that forces full-page navigation into `/checkout/` |

`dtb_express_surface=1` is a public presentation selector, not an authorization credential. Payment operations remain protected by the official extension’s WooCommerce session, gateway availability checks, nonces, Stripe validation, and webhook reconciliation. The surface sends no secret or customer record through the query string.

The express surface is restricted with `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy: frame-ancestors 'self'`, `Referrer-Policy: same-origin`, no-store cache headers, and `noindex`. The React iframe declares `allow="payment *"` so supported wallet APIs can run in the same-origin frame.

The retired Stripe Embedded Checkout Session bridge, same-shell custom payment runtime, Payment Plugins integration, and custom DTB payment-intent routes are not active checkout authorities.

## Official Stripe gateway configuration

Production requires the official WooCommerce Stripe Payment Gateway to be installed, connected, enabled, and configured through WooCommerce settings.

Recommended wp-admin path:

```text
WooCommerce -> Settings -> Payments -> Stripe
```

Required operational settings:

1. Connect the official Stripe gateway to the intended production Stripe account.
2. Enable the Stripe payment method for checkout.
3. Enable Apple Pay and Google Pay / Express Checkout Element.
4. Keep the cart location enabled for the mobile React cart and drawer surface.
5. Enable Optimized Checkout Suite where supported.
6. Choose the desired Optimized Checkout Suite layout, normally Accordion for mobile-friendly checkout.
7. Confirm live and test webhook status is configured by the official extension.
8. Verify wallet/domain registration for every production and staging hostname where wallets are tested.
9. Disable Payment Plugins for Stripe and any other competing Stripe checkout gateway as storefront payment authorities.

The DTB frame maps cart-enabled express checkout into its special checkout-route request only. It does not persistently change Stripe settings. Link and Amazon Pay are suppressed on this specific mobile cart surface; standard Woo checkout continues to use the merchant’s official gateway configuration.

The official gateway owns Stripe webhook registration and synchronization. DTB does not create an additional storefront checkout webhook endpoint for payment completion.

## DTB Woo checkout integration

`DTB_WooNativeStripeCheckout` owns the branded DTB layer around the primary Woo checkout:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooNativeStripeCheckout.php
```

Responsibilities:

- enqueue the DTB checkout stylesheet only on the primary Woo checkout page;
- replace checkout page content with a branded shell around WooCommerce Checkout Block, falling back to `[woocommerce_checkout]` if block rendering is unavailable;
- tag Woo checkout orders with DTB metadata;
- mirror verified official Stripe payment references into non-secret DTB order meta;
- show wp-admin readiness warnings if WooCommerce is active but the official Stripe gateway is not enabled.

`DTB_WooStripeExpressCheckoutSurface` owns only the frame shell used by mobile cart presentation:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooStripeExpressCheckoutSurface.php
```

Responsibilities:

- recognize the special query only on the primary checkout route;
- reject order-pay and order-received endpoints;
- preserve same-origin framing and no-store/noindex headers;
- map cart-enabled Apple Pay/Google Pay into this request without persisting gateway settings;
- invoke the public official gateway Express Checkout Element renderer;
- report ready/unavailable state and frame height to the same-origin React parent;
- leave all wallet eligibility, address collection, order creation, payment, and webhook behavior in the official gateway.

Presentation assets:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/assets/woo-native-checkout.css
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/assets/woo-stripe-express-surface.css
frontend/src/components/checkout/MobileExpressCheckout.jsx
frontend/src/components/checkout/MobileCartCheckoutDock.jsx
frontend/src/styles/mobile-cart-express-checkout.css
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

For DTB-tagged, verified official Stripe orders, DTB appends lifecycle events and dispatches `dtb-orders` processing jobs once payment is captured. Express checkout does not create a separate downstream path. The webhook/payment authority remains the official Stripe gateway.

## Routing contract

The public root `.htaccess` must route these to WordPress before the React SPA catch-all:

```text
/checkout/
/checkout/?dtb_express_surface=1
/checkout/order-pay/{id}
/checkout/?pay_for_order=true&key=wc_order_...
/wp-json/*
?rest_route=...
?wc-api=...
```

The express surface reuses the existing `/checkout/` rewrite and does not require a new path rewrite.

`GET /wp-json/dtb/v1/checkout/capabilities` remains a public, read-only compatibility route. It returns non-secret checkout contract metadata and enabled official WooCommerce Stripe gateway identifiers. It does not create orders, render payment fields, expose gateway secrets, or replace WooCommerce Checkout Block.

## Failure and fallback behavior

- While eligibility is evaluated, React renders a non-interactive two-column skeleton.
- When the official gateway reports no eligible wallet, the entire express section is removed; standard checkout remains available.
- Cart changes reload the frame against the current Woo session so provider totals are recalculated.
- The React parent accepts state messages only from its own origin and exact iframe window.
- Cross-origin Stripe authentication is left untouched and is not introspected.
- A successful same-origin `/checkout/order-received/` redirect is promoted to the top-level document.
- No fallback may fabricate Apple Pay/Google Pay buttons or create an alternate order/payment path.

## Deployment checklist

Before production use:

1. Deploy frontend and backend as a clean mirror, not a partial FTP overlay.
2. Remove retired Stripe Embedded Checkout bridge files from live `mu-plugins` if previously deployed.
3. Confirm `/wp-json/` returns JSON.
4. Confirm `/wp-json/dtb/v1/catalog/products?per_page=1` returns JSON.
5. Confirm `/checkout/` renders WooCommerce checkout, not the React SPA.
6. Confirm the official Stripe gateway is connected and enabled.
7. Confirm cart Express Checkout is enabled for Apple Pay and Google Pay.
8. Confirm official Stripe webhooks are configured in live and test modes.
9. Confirm wallet domain registration covers production and staging hostnames.
10. Confirm Payment Plugins for Stripe is disabled as a checkout authority.
11. Test eligible and ineligible devices, cart mutation refresh, wallet cancellation, failed wallet payment, 3DS where applicable, successful order-received promotion, refunds, webhook delay, Veeqo sync, and QuickBooks eligibility.

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
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooStripeExpressCheckoutSurface.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Domain/PaymentState.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Payment/CheckoutPaymentLifecycle.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/bootstrap.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/bootstrap.php
.\scripts\smoke-dtb-mu-modules.ps1
git diff --check
```

Runtime verification remains mandatory because final wallet availability, payment UI, Woo session continuity, domain registration, webhook status, order transitions, Veeqo sync, and QuickBooks projection depend on deployed WooCommerce/Stripe/Veeqo configuration.
