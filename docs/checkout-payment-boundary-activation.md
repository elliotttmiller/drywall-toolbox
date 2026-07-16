# Checkout Payment Boundary and Live Activation Checklist

## Purpose

This document defines the production boundary for the unified checkout workflow after the React checkout UI/system refactor. It is intentionally explicit: Drywall Toolbox may orchestrate checkout steps, quote/session/finalize state, recovery, and presentation, but it must not own provider payment entry.

## Non-negotiable payment boundary

DTB must not:

- render raw card number, expiration, CVC, wallet, or bank-account fields in React;
- clone WooCommerce gateway markup into the React app;
- iframe `/checkout/order-pay` inside the storefront;
- scrape, intercept, or mutate provider iframes;
- bypass WooCommerce/WooPayments/PayPal nonce, tokenization, callback, webhook, or payment-status lifecycle;
- remove `/checkout/order-pay` from WordPress while it remains required for recovery, manual payment, email payment links, retries, or unsupported gateway stacks.

DTB may:

- present a synchronized single-page `/checkout` workflow shell;
- collect contact, delivery, shipping-rate, coupon, and note inputs;
- surface express checkout/payment method affordances immediately at the top of the checkout shell;
- request DTB quote/session/confirm/finalize through the existing checkout API contract;
- display a provider-owned Payment step after DTB prepares the WooCommerce pending order;
- block the default storefront payment click path from redirecting away from `/checkout`;
- activate official WooCommerce Blocks payment only when the active gateway stack exposes provider-owned Blocks registration and the DTB WooPayments same-shell provider adapter can submit provider-owned payment data.

## Current implemented customer workflow

```text
/cart
-> /checkout
   Express checkout rail
   Contact
   Delivery
   Shipping method
   Review
   Payment preparation
   Same-shell WooPayments adapter
```

The user-facing checkout steps are synchronized inside `/checkout`. Express checkout/payment methods are visible immediately as provider-branded launch affordances, but final payment entry still remains provider-owned.

## Linear stepper contract

The checkout stepper follows a linear wizard contract matching the requested CoreUI `CStepper` behavior:

```text
Contact -> Delivery -> Review -> Payment
```

A later step remains locked until the prior checkout state is complete:

- Contact unlocks Delivery only after first name, last name, and a valid email are present.
- Delivery unlocks Review only after the shipping address is complete and a server-calculated shipping rate is selected.
- Review unlocks Payment only after DTB has created/finalized the protected WooCommerce pending order and the payment action is actually ready.
- Payment execution remains provider-owned.

The repository does not currently include `@coreui/react-pro` in `frontend/package.json`. Importing `CStepper` directly without the package, license/registry access, and lockfile update would break the frontend build. The current implementation therefore uses a local linear stepper runtime with the same locked/unlocked behavior and ARIA step semantics. If CoreUI Pro is approved and installed later, it can replace the visual stepper behind this same contract without changing checkout authority.

## Payment method preference contract

The mobile Payment Method rows are now connected to the checkout session creation path as a gateway preference resolver. The selected customer-facing method is mapped to the available WooCommerce gateway IDs returned by `/dtb/v1/checkout/capabilities` immediately before `POST /dtb/v1/checkout/session` is sent.

Mapping policy:

```text
card       -> woocommerce_payments -> stripe -> current available online gateway
paypal     -> ppcp-gateway -> paypal -> current available online gateway
apple-pay  -> woocommerce_payments -> stripe -> current available online gateway
google-pay -> woocommerce_payments -> stripe -> current available online gateway
```

WooPayments (`woocommerce_payments`) is the preferred gateway for card, Apple Pay, and Google Pay. Stripe is fallback only. PayPal is resolved to PayPal Commerce Platform (`ppcp-gateway`) first, then legacy `paypal` if present.

The resolver changes only the `payment_method` value sent to DTB session creation. It does not create orders, execute payment, inject provider controls, or bypass WooCommerce/provider tokenization. Wallet availability is still finally determined by WooPayments/Stripe/PayPal in their provider-owned payment step.

## Same-shell provider ownership contract

Same-shell payment means provider-owned WooCommerce Blocks controls render inside the checkout shell. It does **not** mean DTB registers a fake gateway, clones order-pay markup, or submits payment directly from raw React card fields.

The DTB `dtb_checkout_blocks_bridge` integration is diagnostics-only. It must not be enabled as the production payment method. Production same-shell payment must use the active provider's own registered Blocks payment method, such as WooPayments (`woocommerce_payments`) for card/Apple Pay/Google Pay.

The diagnostic bridge can only be exposed with this separate filter:

```php
add_filter( 'dtb_checkout_blocks_register_diagnostics_bridge', '__return_true' );
```

That filter is not a production same-shell activation switch.

## Same-shell frontend adapter contract

The frontend includes a same-shell payment runtime and a WooPayments provider adapter.

The runtime intercepts `Open protected payment`, refreshes capabilities, and starts `window.dtbCheckoutSameShellProvider.startPayment()` only when all of these are true:

```text
payment_architecture.same_shell_supported === true
payment_architecture.client_bridge_enabled === true
payment_architecture.server_blocks_ready === true
payment_architecture.server_same_shell_ready === true
payment_architecture.provider_same_shell_ready === true
window.wc.wcBlocksRegistry.registerPaymentMethod exists
window.wc.wcBlocksRegistry.registerExpressPaymentMethod exists
an active WooPayments-compatible gateway reports blocks_registered === true and blocks_active === true
window.wc.wcBlocksData.paymentStore exists
window.dtbCheckoutSameShellProvider.startPayment is a function
```

The WooPayments adapter must:

- read only provider-owned payment state from the WooCommerce Blocks payment store;
- reject payment if WooCommerce Blocks has not initialized payment methods;
- reject Apple Pay / Google Pay if express methods are not initialized and available for the browser/device;
- reject payment if provider-owned payment data is missing;
- update the same DTB-created WooCommerce pending order;
- submit valid provider-owned `payment_data` through WooCommerce's existing-order Store API payment path, `POST /wc/store/v1/checkout/{ORDER_ID}`, using the DTB-created order id and order key returned in `order.same_shell_payment`;
- return success/failure to the checkout shell without creating a second WooCommerce order.

`order.same_shell_payment` is emitted only while the order still requires payment. It contains the prepared WooCommerce order id, order key, billing email, selected payment method, the Store API path, and the protected fallback URL. The order key is already present in WooCommerce's order-pay URL, but DTB must still avoid logging it or exposing it after payment is verified.

## Runtime switch conditions for same-shell payment

Same-shell payment can complete only when all of these are true on the live server:

```text
payment_architecture.contract_version === "3"
payment_architecture.server_blocks_ready === true
payment_architecture.server_same_shell_ready === true
payment_architecture.provider_same_shell_ready === true
payment_architecture.client_bridge_enabled === true
payment_architecture.same_shell_supported === true
at least one active WooPayments-compatible gateway reports blocks_registered === true
at least one active WooPayments-compatible gateway reports blocks_active === true
window.wc.wcBlocksRegistry.registerPaymentMethod exists
window.wc.wcBlocksRegistry.registerExpressPaymentMethod exists
window.wc.wcBlocksData.paymentStore exists
provider-owned payment data is present before payment submission
payment submission targets `POST /wc/store/v1/checkout/{ORDER_ID}` for the same DTB-created WooCommerce pending order
no duplicate WooCommerce order is created by the Blocks provider flow
```

If any condition fails, the storefront remains in `/checkout` and surfaces the blocked same-shell state. `/checkout/order-pay` can still exist for recovery and non-storefront links, but it is not the default storefront payment click path.

## Live server manual activation checklist

### 1. Deploy source safely

- Confirm the checkout same-shell PR is merged into `main`.
- Run the protected deployment workflow, not manual file drift.
- Confirm the deployed `frontend/src/main.jsx` bundle imports the canonical checkout stylesheet path at build time: `features/checkout/checkout-system.css`.
- Confirm the deployed bundle includes the same-shell runtime and WooPayments same-shell adapter.
- Purge CDN/cache/plugin/page cache after deploy.
- Open `/checkout` in an incognito browser and confirm the Express checkout rail plus Contact, Delivery, Review, Payment sequence appears in one page.

### 2. Confirm WordPress/WooCommerce payment prerequisites

- Confirm WooCommerce is active and healthy.
- Confirm WooPayments is active, connected, and enabled.
- Confirm production/sandbox mode is intentional.
- Confirm webhook endpoints and webhook secrets are configured in the payment provider dashboard.
- Confirm no maintenance/security plugin blocks `/wp-json/wc/` or `/wp-json/dtb/v1/checkout/*`.
- Confirm HTTPS is valid and no mixed-content warnings appear on checkout.

### 3. Inspect DTB checkout capability response

Open:

```text
/wp-json/dtb/v1/checkout/capabilities
```

Confirm:

- `payment_architecture.contract_version` is `"3"`.
- `client_bridge_enabled` is `true` when WooPayments Blocks is active.
- `same_shell_supported` is `true` when WooPayments Blocks is active.
- `provider_same_shell_ready` is `true`.
- `woocommerce_payments` or `woopayments` is present, enabled, `blocks_registered`, and `blocks_active`.
