# Checkout and WooPayments Architecture

## Purpose

Drywall Toolbox checkout uses WooCommerce as the order, customer, cart, address, shipping, tax, and checkout authority. WooPayments is the single active storefront payment authority for embedded cards, supported wallets, tokenization, payment processing, and webhook-backed payment status.

React owns product browsing, cart page, cart drawer, account UX, and checkout placement/hand-off UX. React may frame a same-origin DTB WooPayments express surface for cart, drawer, and product-detail presentation, but it does not draw wallet buttons, create payment intents, create checkout sessions, create orders, or own payment lifecycle state.

The customer remains on `drywalltoolbox.com`. `/checkout/` is a WordPress/WooCommerce document with a DTB-branded shell around the native WooCommerce Checkout Block or classic `[woocommerce_checkout]` fallback. Cart/product express surfaces are same-origin shells that only expose provider-owned WooPayments express controls when WooPayments reports an eligible method.

## System-of-record boundaries

| Concern | Authority |
| --- | --- |
| Product browsing, cart page, cart drawer, account UX, checkout CTA, express surface placement | React storefront |
| Cart/session/customer/address/shipping/tax/order creation | WooCommerce Checkout Block / Store API |
| Embedded payment form, Apple Pay, Google Pay, Link, WooPay, cards, tokenization, 3DS/SCA, webhooks | WooPayments |
| Checkout shell/styling, express iframe shell, readiness diagnostics, checkout-order tagging, paid-order observation, event ledger, downstream jobs | DTB MU plugins |
| Product catalog, customer account, operational order record | WooCommerce |
| Inventory allocation, fulfillment, labels, shipment/tracking | Veeqo |
| Accounting projection after eligible payment/refund events | QuickBooks |

React and DTB REST responses must never expose WooCommerce application passwords, WooPayments/Stripe secrets, webhook secrets, Veeqo credentials, QuickBooks credentials, private keys, PaymentIntent client secrets, wallet tokens, or raw payment method data.

## Production flow

### Standard checkout

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

### Express checkout surfaces

```text
React full cart / cart drawer / product page / product modal
  -> same-origin iframe requests /checkout/?dtb_wcpay_express_surface=1
  -> DTB emits a minimal no-store, noindex frame shell
  -> WooPayments evaluates eligible express methods for the Woo session/context
  -> Apple Pay, Google Pay, WooPay, Link, or other enabled methods render only when eligible
  -> WooCommerce/WooPayments own address, shipping, order creation, payment, and webhooks
  -> successful order-received navigation is promoted to the top-level document
  -> normal Woo payment lifecycle and DTB downstream queues continue
```

`dtb_wcpay_express_surface=1` is a public presentation selector, not an authorization credential. Provider payment operations remain protected by WooCommerce session state, WooPayments nonces, wallet eligibility, gateway validation, and webhook reconciliation.

Express checkout is still a WooCommerce/WooPayments checkout path. It is not a DTB-created order path, not a DTB-created PaymentIntent path, and not a browser-owned payment workflow.

Express button availability is dynamic. The gateway may render one method, multiple methods, or no method depending on merchant settings, product/cart contents, browser, device, wallet setup, domain registration, country, currency, and WooPayments account state. DTB must not render lookalike buttons when the provider reports a method unavailable.

Product-surface express checkout is configuration-sensitive and must be verified on staging because product buttons depend on WooPayments product-location support and product-type eligibility. If WooPayments reports no eligible product method, React removes the section and preserves normal add-to-cart and checkout behavior.

## Active checkout surfaces

| Surface | Authority |
| --- | --- |
| `/checkout/` | WordPress/WooCommerce Checkout Block or classic checkout, rendered inside the DTB WooPayments shell |
| `/checkout/?dtb_wcpay_express_surface=1&dtb_context=cart|drawer|product` | Minimal same-origin DTB shell containing only provider-owned WooPayments express checkout controls |
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
4. Enable cart/product locations for express checkout where WooPayments supports those locations.
5. Verify Apple Pay / Google Pay / WooPay / Link behavior on eligible devices and browsers.
6. Confirm WooPayments webhook/account health in WooCommerce status tools.
7. Disable the official WooCommerce Stripe Gateway, Payment Plugins for Stripe, and any other competing card/wallet storefront payment authority.
8. Confirm staging/test mode before any live payment attempt.

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

`DTB_WooPaymentsExpressCheckoutSurface` owns only the frame shell used by React express placement:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooPaymentsExpressCheckoutSurface.php
```

Responsibilities:

- recognize the public express-surface query before the primary checkout shell;
- preserve same-origin framing, no-store/noindex behavior, and redacted diagnostics;
- render WooCommerce cart/checkout express payment blocks for cart and drawer contexts;
- render Woo product express hooks for product page/modal contexts;
- report ready/unavailable state and frame height to the same-origin React parent;
- leave all wallet eligibility, address collection, order creation, payment, and webhook behavior in WooPayments.

Presentation assets:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/assets/woo-native-checkout.css
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/assets/woo-payments-express-surface.css
frontend/src/components/payments/WooPaymentsExpressCheckout.jsx
frontend/src/components/checkout/MobileCartCheckoutDock.jsx
frontend/src/styles/woopayments-express.css
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
/checkout/?dtb_wcpay_express_surface=1
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
- If express checkout is unavailable, React removes the provider frame and keeps the standard checkout CTA available.
- No fallback may fabricate Apple Pay/Google Pay/WooPay buttons or create an alternate order/payment path.
- Checkout remains same-domain but payment fields are provider-owned embedded controls.

## Deployment checklist

Before production use:

1. Deploy frontend and backend as a clean mirror, not a partial FTP overlay.
2. Remove retired Stripe Embedded Checkout bridge files and official Stripe express iframe files from live `mu-plugins` if previously deployed.
3. Confirm `/wp-json/` returns JSON.
4. Confirm `/wp-json/dtb/v1/catalog/products?per_page=1` returns JSON.
5. Confirm `/checkout/` renders the DTB WooPayments shell and a visible Woo checkout form.
6. Confirm `/checkout/?dtb_wcpay_express_surface=1&dtb_context=cart` returns a same-origin noindex express surface.
7. Confirm full cart, cart drawer, product page, and product modal hosts hide cleanly when express checkout is unavailable.
8. Confirm WooPayments is installed, connected, enabled, and in the intended test/live mode.
9. Confirm official WooCommerce Stripe Gateway and Payment Plugins for Stripe are disabled as storefront payment authorities.
10. Test guest checkout, authenticated checkout, cards, 3DS/SCA, wallets, wallet ineligible devices, failed payment, retry, order-received, refund, webhook delay/replay, Veeqo sync, and QuickBooks eligibility.

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
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooPaymentsExpressCheckoutSurface.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Domain/PaymentState.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Payment/CheckoutPaymentLifecycle.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/bootstrap.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/bootstrap.php
.\scripts\smoke-dtb-mu-modules.ps1
git diff --check
```

Runtime verification remains mandatory because final wallet availability, payment UI, Woo session continuity, WooPayments account state, webhook status, order transitions, Veeqo sync, and QuickBooks projection depend on deployed WooCommerce/WooPayments/Veeqo configuration.
