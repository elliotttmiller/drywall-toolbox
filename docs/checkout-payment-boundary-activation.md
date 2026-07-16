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
- remove `/checkout/order-pay` while it remains required for fallback, recovery, manual payment, email payment links, retries, or unsupported gateway stacks.

DTB may:

- present a synchronized single-page `/checkout` workflow shell;
- collect contact, delivery, shipping-rate, coupon, and note inputs;
- surface express checkout/payment method affordances immediately at the top of the checkout shell;
- request DTB quote/session/confirm/finalize through the existing checkout API contract;
- display a provider-owned Payment step after DTB prepares the WooCommerce pending order;
- open the protected gateway-owned payment route when fallback is required;
- activate official WooCommerce Blocks payment only when the active gateway stack exposes provider-owned Blocks registration and the release gate is intentionally enabled.

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
   Open protected payment
-> /checkout/order-pay only when the customer opens the protected fallback payment step
```

The user-facing checkout steps are synchronized inside `/checkout`. Express checkout/payment methods are visible immediately as provider-branded launch affordances, but final payment entry still remains provider-owned. This is the correct safe transition state before activating any same-shell Blocks payment path.

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

Same-shell payment means provider-owned WooCommerce Blocks controls render inside the checkout shell. It does **not** mean DTB registers a fake gateway, clones order-pay markup, or submits payment directly from React.

The DTB `dtb_checkout_blocks_bridge` integration is diagnostics-only. It must not be enabled as the production payment method. Production same-shell payment must use the active provider's own registered Blocks payment method, such as WooPayments (`woocommerce_payments`) for card/Apple Pay/Google Pay or PayPal Commerce Platform (`ppcp-gateway`) for PayPal.

The diagnostic bridge can only be exposed with this separate filter:

```php
add_filter( 'dtb_checkout_blocks_register_diagnostics_bridge', '__return_true' );
```

That filter is not a production same-shell activation switch.

## Same-shell frontend adapter contract

The frontend now includes a same-shell payment adapter gate. It checks the DTB checkout capability envelope, the WooCommerce Blocks registry, registered provider Blocks methods, and a provider-owned adapter before it suppresses the protected order-pay fallback navigation.

The gate only intercepts `Open protected payment` when all of these are true:

```text
payment_architecture.same_shell_supported === true
payment_architecture.client_bridge_enabled === true
payment_architecture.server_blocks_ready === true
payment_architecture.server_same_shell_ready === true
window.wc.wcBlocksRegistry.registerPaymentMethod exists
window.wc.wcBlocksRegistry.registerExpressPaymentMethod exists
an active provider gateway such as woocommerce_payments has blocks_registered === true and blocks_active === true
window.dtbCheckoutSameShellProvider.startPayment is a function
```

If `window.dtbCheckoutSameShellProvider.startPayment` is missing, checkout keeps the order-pay fallback path. The adapter contract is intentionally explicit so DTB cannot silently block a working fallback with a placeholder payment screen.

A production provider adapter must:

- render or activate only provider-owned WooPayments/WooCommerce Blocks controls;
- update the same DTB-created WooCommerce pending order;
- return success/failure to the checkout shell without creating a second WooCommerce order;
- expose recoverable failure so the fallback route can remain available.

## Runtime switch conditions for same-shell payment

Same-shell payment must remain disabled unless all of these are true on the live server:

```text
payment_architecture.contract_version === "3"
payment_architecture.server_blocks_ready === true
payment_architecture.server_same_shell_ready === true
payment_architecture.client_bridge_enabled === true
payment_architecture.same_shell_supported === true
at least one active non-manual provider gateway reports blocks_registered === true
at least one active non-manual provider gateway reports blocks_active === true
window.wc.wcBlocksRegistry.registerPaymentMethod exists
window.wc.wcBlocksRegistry.registerExpressPaymentMethod exists
provider-owned UI renders without DTB-created card inputs
payment callback updates the same DTB-created WooCommerce pending order
no duplicate WooCommerce order is created by the Blocks provider flow
```

If any condition fails, `/checkout/order-pay` remains the primary payment execution path.

## Live server manual activation checklist

### 1. Deploy source safely

- Confirm PR #475 and the checkout UI/workflow PR are merged into `main`.
- Run the protected deployment workflow, not manual file drift.
- Confirm the deployed `frontend/src/main.jsx` bundle imports the canonical checkout stylesheet path at build time: `features/checkout/checkout-system.css`.
- Confirm the deployed bundle also includes the express payment rail module: `features/checkout/checkout-express-payment-rail.css`.
- Confirm the old checkout CSS files are not present in the deployed frontend manifest or loaded page source.
- Purge CDN/cache/plugin/page cache after deploy.
- Open `/checkout` in an incognito browser and confirm the Express checkout rail plus Contact, Delivery, Review, Payment sequence appears in one page.

### 2. Confirm WordPress/WooCommerce payment prerequisites

- Confirm WooCommerce is active and healthy.
- Confirm WooPayments and/or PayPal payment plugin is active.
- Confirm production/sandbox mode is intentional.
- Confirm webhook endpoints and webhook secrets are configured in the payment provider dashboard.
- Confirm WooCommerce order-pay route remains reachable.
- Confirm no maintenance/security plugin blocks `/checkout/order-pay`, `/wp-json/wc/`, or `/wp-json/dtb/v1/checkout/*`.
- Confirm HTTPS is valid and no mixed-content warnings appear on checkout or order-pay.

### 3. Inspect DTB checkout capability response

Open:

```text
/wp-json/dtb/v1/checkout/capabilities
```

Confirm:

- `payment_architecture.contract_version` is `"3"`.
- `fallback_order_pay_enabled` is `true`.
- `client_bridge_enabled` is `false` unless intentionally enabling same-shell payment.
- `same_shell_supported` is `false` by default.
- Active gateways are present and manual-only methods are not selected as the storefront payment method.
- `woocommerce_payments` is present and enabled when WooPayments should own card/wallet preference routing.
- If WooCommerce Blocks registry is available, registered methods are reported without exposing secrets.

### 4. Confirm fallback payment flow before enabling anything

- Add one real catalog product to cart.
- Open `/checkout`.
- Confirm the express checkout/payment method rail appears immediately under the checkout header on mobile and at the top of the checkout summary column on desktop.
- Complete Contact and Delivery.
- Select a shipping method.
- Confirm Review appears before Payment.
- Select Card, Apple Pay, Google Pay, or PayPal in the Payment Method step.
- Confirm Card/Apple Pay/Google Pay create the checkout session with `woocommerce_payments` when WooPayments is enabled.
- Confirm PayPal creates the checkout session with `ppcp-gateway` when PayPal Commerce Platform is enabled.
- Click `Prepare protected payment`.
- Confirm the Payment section appears in `/checkout` without an automatic redirect.
- Confirm the button changes to `Open protected payment`.
- Click `Open protected payment`.
- Confirm the customer is taken to `/checkout/order-pay/...`.
- Complete or cancel payment using the configured sandbox/test method.
- Confirm only one WooCommerce order exists for the attempt.
- Confirm the DTB order/session metadata and recovery state remain consistent.

### 5. Same-shell Blocks gate activation, only after fallback is clean

Do not enable this in production first. Enable only in staging/protected rollout by adding a controlled mu-plugin or environment-specific filter:

```php
add_filter('dtb_checkout_blocks_same_shell_supported', '__return_true');
```

After enabling on staging, confirm:

- `/wp-json/dtb/v1/checkout/capabilities` reports `client_bridge_enabled: true`.
- `same_shell_supported` becomes true only if registered provider Blocks payment methods are actually active.
- Browser console shows `window.wc.wcBlocksRegistry` exists.
- Browser console shows `window.dtbCheckoutSameShellProvider.startPayment` exists before fallback navigation is suppressed.
- Provider-owned payment UI renders through WooCommerce Blocks registration.
- DTB React code does not render raw card fields.
- Gateway/provider callback updates the DTB-created pending order.
- A failed payment can be retried without creating duplicate orders.
- A browser refresh during payment does not lose recovery state.
- A second tab/double click does not create duplicate orders.

### 6. Production rollout guardrails

- Keep the same-shell gate disabled until staging proves order lifecycle correctness.
- Keep `/checkout/order-pay` route reachable after enabling same-shell payment.
- Keep payment recovery links pointing to order-pay unless an officially supported provider recovery path is proven.
- Monitor WooCommerce orders, DTB checkout session rows, action scheduler jobs, payment-provider events, and failed payment webhooks during rollout.
- Roll back by removing the `dtb_checkout_blocks_same_shell_supported` filter first; do not roll back source unless frontend checkout itself is broken.

## Rollback rules

Fast rollback for payment issues:

```php
remove_filter('dtb_checkout_blocks_same_shell_supported', '__return_true');
```

or remove the temporary activation mu-plugin. This returns checkout to the protected order-pay fallback while preserving the unified `/checkout` intake workflow.

Full rollback is only needed if the new checkout visual shell or step orchestration itself breaks. In that case, revert the checkout UI/workflow PR and redeploy through the protected deployment workflow.