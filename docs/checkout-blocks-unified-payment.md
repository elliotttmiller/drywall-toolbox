# Unified Checkout and Blocks-Compatible Payment Architecture

## Current production boundary

Drywall Toolbox currently uses a secure split flow:

```text
React /checkout -> DTB checkout session -> WooCommerce pending order -> /checkout/order-pay fallback
```

WooCommerce and the active payment provider own card fields, wallet sheets, nonces, tokenization, callbacks, and payment lifecycle state. DTB owns quote validation, idempotency, order write boundaries, recovery, and post-payment event orchestration.

## Implemented single-page checkout shell

The customer-facing checkout shell is now synchronized in `/checkout`:

```text
/cart
-> /checkout
   Contact
   Delivery
   Shipping method
   Review
   Payment preparation
   Open protected payment
-> /checkout/order-pay only when the customer opens the protected fallback payment step
```

The frontend no longer treats a prepared payment URL as an immediate automatic redirect. DTB prepares the order/session, stores the returned payment URL, moves the customer to the in-page Payment step, and only opens `/checkout/order-pay` after an explicit customer action.

This does not change ownership of payment execution. Provider payment entry remains gateway-owned.

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
- request DTB quote/session/confirm/finalize through the checkout API contract;
- display a provider-owned Payment step after DTB prepares the WooCommerce pending order;
- open the protected gateway-owned payment route when fallback is required;
- activate official WooCommerce Blocks payment only when the active gateway stack exposes provider-owned Blocks registration and the release gate is intentionally enabled.

## Official Blocks-compatible target

The unified checkout target is one visible `/checkout` shell with contact, shipping, review, and payment steps. Payment methods must be rendered through official WooCommerce Blocks payment method architecture when the production gateway stack supports it.

Official WooCommerce Blocks payment integration requires:

- client-side registration through `window.wc.wcBlocksRegistry`;
- `registerExpressPaymentMethod` for Apple Pay, Google Pay, PayPal, and other one-button methods;
- `registerPaymentMethod` for regular/card/payment-provider methods;
- server-side `Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType` integration where DTB or a gateway exposes scripts/settings to the Checkout block;
- gateway/provider ownership of tokenization, iframes, callbacks, and processing.

## Implemented DTB bridge wiring

This PR adds `DTB_CheckoutBlocksBridgeIntegration`, a conservative server-side `AbstractPaymentMethodType` integration shell. It registers only inside WooCommerce Blocks through `woocommerce_blocks_payment_method_type_registration` and exposes `checkout-blocks-bridge.js` as the matching client registration script.

The bridge is intentionally hidden by default. `is_active()` returns true only when the explicit `dtb_checkout_blocks_same_shell_supported` filter is enabled and at least one non-manual WooCommerce gateway is available. The client script still requires provider-owned Blocks registry APIs before registering its payment method.

The bridge does **not** clone gateway fields, embed order-pay, intercept iframes, or move card entry into custom React code.

## Fallback rule

`/checkout/order-pay` remains the mandatory recovery/manual-payment fallback until the capability endpoint proves that the active plugin stack exposes the official Blocks payment registry and eligible payment methods for the current checkout context.

DTB must not simulate Blocks support by embedding order-pay, cloning gateway fields, intercepting iframes, or moving card entry into custom React code.

## Runtime capability contract

`GET /wp-json/dtb/v1/checkout/capabilities` includes `payment_architecture`:

```json
{
  "contract_version": "3",
  "primary_flow": "official_blocks_candidate_order_pay_fallback",
  "same_shell_supported": false,
  "fallback_order_pay_enabled": true,
  "blocks_package_available": true,
  "payment_registry_available": true,
  "abstract_method_available": true,
  "assets_api_available": true,
  "server_blocks_ready": true,
  "server_same_shell_ready": true,
  "client_bridge_enabled": false,
  "has_blocks_gateway_candidate": true,
  "has_registered_blocks_method": true,
  "client_registry_required": true,
  "client_registry_global": "window.wc.wcBlocksRegistry",
  "client_bridge_required": "dtb_checkout_blocks_bridge"
}
```

The detector inspects the WooCommerce Blocks payment registry when it is available through WooCommerce's dependency container. Per active gateway method, the response reports whether it is only a known Blocks-capable candidate or whether an actual registered Blocks integration is present.

`same_shell_supported` is gated by all of the following:

```text
server_blocks_ready === true
server_same_shell_ready === true
client_bridge_enabled === true
at least one non-manual registered Blocks method is active
```

`client_bridge_enabled` is controlled by the `dtb_checkout_blocks_same_shell_supported` PHP filter and defaults to `false`. This is the explicit production release gate; it must only be enabled after the provider-owned Blocks UI is verified with the active gateway stack and DTB's quote/session/finalize/order lifecycle remains intact.

The frontend guard in `useCheckoutBlocksBridge.js` then requires:

```text
payment_architecture.same_shell_supported === true
client_bridge_enabled === true
server_blocks_ready === true
server_same_shell_ready === true
window.wc.wcBlocksRegistry.registerPaymentMethod exists
window.wc.wcBlocksRegistry.registerExpressPaymentMethod exists
at least one non-manual registered Blocks method is active
```

If any condition fails, `/checkout/order-pay` remains the supported fallback.

## Checkout state machine

Frontend checkout now has explicit payment-stage states:

```text
editing
quoting
ready
confirming
session_created
finalizing
payment_ready
payment_processing
complete | failed | recoverable
```

This separates DTB session/order preparation from the payment UI activation point and prevents future one-shell payment work from being implemented as an implicit redirect-only side effect.

## Rollout sequence

1. Ship capability detection, registered-method discovery, server-side Blocks bridge registration, client bridge guard, payment-stage state separation, unified checkout styling, and the synchronized single-page workflow shell.
2. Verify production WooPayments/PayPal plugin stack exposes Blocks payment infrastructure.
3. Confirm the protected order-pay fallback path works with the new in-page Payment step.
4. Enable `dtb_checkout_blocks_same_shell_supported` only in a staging/protected production rollout after gateway-owned Blocks UI is verified.
5. Switch supported checkouts to one-shell payment after the active provider stack proves tokenization/callback/order lifecycle correctness.
6. Keep order-pay for fallback, retry, and manual payment links.
7. Simplify the order-pay visual template after it is no longer the primary storefront path.

## Live activation checklist

The live-server activation and rollback checklist is maintained in:

```text
docs/checkout-payment-boundary-activation.md
```

Do not enable same-shell payment in production until every server, gateway, callback, recovery, and duplicate-order condition in that checklist is satisfied.

## Validation

```powershell
npm --prefix frontend ci --include=dev
cd frontend
npm run lint
npm run build:staging
npm run build

cd ..
.\scripts\smoke-dtb-mu-modules.ps1
```

Manual checks:

- `/wp-json/dtb/v1/checkout/capabilities` returns `payment_architecture.contract_version = "3"`.
- `registered_methods` reflects WooCommerce Blocks payment registry state when available.
- `same_shell_supported` remains false until a verified DTB client bridge is intentionally enabled.
- Existing checkout opens order-pay fallback only after the customer explicitly opens the prepared payment step.
- Retry/double-submit behavior remains contained.
- `/checkout/order-pay/{id}` still works for recovery links.
