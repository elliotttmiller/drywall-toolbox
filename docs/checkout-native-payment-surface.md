# Checkout Native Payment Surface

Drywall Toolbox checkout uses a same-page customer experience while keeping payment execution inside WooCommerce/WooPayments' supported runtime.

## Boundary

React owns the checkout shell, stepper, Contact, Delivery, Review, iframe mount, status messaging, and recovery UI. DTB owns quote/session/confirm/finalize, order idempotency, customer/session ownership, and lifecycle events. WooCommerce/WooPayments owns the native Checkout Block document, card fields, wallets, tokenization, 3DS/SCA, payment data, and payment result.

DTB must not clone WooPayments Blocks nodes into the React tree, dispatch into internal Woo Blocks payment stores as a payment execution dependency, create raw card fields, iframe the legacy `/checkout/order-pay/` URL, or expose the order-pay URL as the primary storefront payment path.

## Flow

```text
Store API cart
→ React /checkout
→ Contact
→ Delivery quote/tax/shipping
→ Review
→ POST /dtb/v1/checkout/session
→ POST /dtb/v1/checkout/confirm
→ POST /dtb/v1/checkout/finalize
→ DTB-created WooCommerce pending order
→ POST /dtb/v1/checkout/payment-surface with order_id/order_key
→ signed same-origin payment surface URL
→ iframe renders native WooCommerce Checkout Block document
→ WooPayments owns payment controls and payment execution
→ postMessage ready/resize/success/error back to React shell
```

## Surface contract

`DTB_CheckoutPaymentSurface` creates a short-lived signed token bound to the order id, order key hash, checkout session id, cart hash, and expiration. The surface is rendered by WordPress from `/?dtb_checkout_payment_surface=<token>` and sends same-origin `postMessage` events to the React shell.

The React runtime blocks legacy order-pay navigation, requests the signed payment surface, mounts it in `#checkout-payment-step`, and keeps the customer inside `/checkout`.

## Recovery

SessionStorage-backed `Resume Payment / Dismiss` badges are retired. Refreshing the checkout route must not resurrect a legacy order-pay recovery link. Incomplete payment recovery should return the customer to `/checkout` and create a fresh signed payment surface for the verified pending order context.

## Activation checks

`/wp-json/dtb/v1/checkout/capabilities` should report:

```text
contract_version = 4
primary_flow = native_checkout_block_payment_surface
payment_surface_supported = true
same_shell_supported = true
fallback_order_pay_enabled = false
server_blocks_ready = true
provider_same_shell_ready = true
```

If these are not true, the React checkout blocks payment in-shell instead of redirecting to a legacy payment page.
