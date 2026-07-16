# Unified Checkout and Blocks-Compatible Payment Architecture

## Current production boundary

Drywall Toolbox currently uses a secure split flow:

```text
React /checkout -> DTB checkout session -> WooCommerce pending order -> /checkout/order-pay fallback
```

WooCommerce and the active payment provider own card fields, wallet sheets, nonces, tokenization, callbacks, and payment lifecycle state. DTB owns quote validation, idempotency, order write boundaries, recovery, and post-payment event orchestration.

## Official Blocks-compatible target

The unified checkout target is one visible `/checkout` shell with contact, shipping, review, and payment steps. Payment methods must be rendered through official WooCommerce Blocks payment method architecture when the production gateway stack supports it.

Official WooCommerce Blocks payment integration requires:

- client-side registration through `window.wc.wcBlocksRegistry`;
- `registerExpressPaymentMethod` for Apple Pay, Google Pay, PayPal, and other one-button methods;
- `registerPaymentMethod` for regular/card/payment-provider methods;
- server-side `Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType` integration where DTB or a gateway must expose scripts/settings to the Checkout block;
- gateway/provider ownership of tokenization, iframes, callbacks, and processing.

## Fallback rule

`/checkout/order-pay` remains the mandatory recovery/manual-payment fallback until the capability endpoint proves that the active plugin stack exposes the official Blocks payment registry and eligible payment methods for the current checkout context.

DTB must not simulate Blocks support by embedding order-pay, cloning gateway fields, intercepting iframes, or moving card entry into custom React code.

## Runtime capability contract

`GET /wp-json/dtb/v1/checkout/capabilities` now includes `payment_architecture`:

```json
{
  "primary_flow": "classic_order_pay_fallback",
  "same_shell_supported": false,
  "fallback_order_pay_enabled": true,
  "blocks_package_available": true,
  "payment_registry_available": true,
  "abstract_method_available": true,
  "assets_api_available": true,
  "server_blocks_ready": true,
  "has_blocks_gateway_candidate": true,
  "client_registry_required": true,
  "client_registry_global": "window.wc.wcBlocksRegistry"
}
```

The detector is conservative. `same_shell_supported` remains false until DTB has a real official Blocks payment bridge for the active gateway stack.

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

1. Ship capability detection and payment-stage state separation.
2. Verify production WooPayments/PayPal plugin stack exposes Blocks payment infrastructure.
3. Build a gateway-specific official Blocks payment bridge only for proven eligible methods.
4. Switch supported checkouts to one-shell payment.
5. Keep order-pay for fallback, retry, and manual payment links.
6. Simplify the order-pay visual template after it is no longer the primary storefront path.
