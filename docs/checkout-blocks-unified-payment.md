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
  "contract_version": "2",
  "primary_flow": "official_blocks_candidate_order_pay_fallback",
  "same_shell_supported": false,
  "fallback_order_pay_enabled": true,
  "blocks_package_available": true,
  "payment_registry_available": true,
  "abstract_method_available": true,
  "assets_api_available": true,
  "server_blocks_ready": true,
  "server_same_shell_ready": true,
  "has_blocks_gateway_candidate": true,
  "has_registered_blocks_method": true,
  "client_registry_required": true,
  "client_registry_global": "window.wc.wcBlocksRegistry",
  "client_bridge_required": "dtb_checkout_blocks_bridge"
}
```

The detector now inspects the WooCommerce Blocks payment registry when it is available through WooCommerce's dependency container. Per active gateway method, the response reports whether it is only a known Blocks-capable candidate or whether an actual registered Blocks integration is present.

`same_shell_supported` intentionally remains false until DTB has a verified client bridge that can use the registered provider-owned Blocks UI without bypassing DTB's quote/session/finalize/order lifecycle. The frontend guard in `useCheckoutBlocksBridge.js` requires all of the following before a same-shell payment step can become primary:

```text
payment_architecture.same_shell_supported === true
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

1. Ship capability detection, registered-method discovery, and payment-stage state separation.
2. Verify production WooPayments/PayPal plugin stack exposes Blocks payment infrastructure.
3. Build a gateway-specific official Blocks payment bridge only for proven eligible methods.
4. Switch supported checkouts to one-shell payment by enabling `same_shell_supported` only after the client bridge is verified.
5. Keep order-pay for fallback, retry, and manual payment links.
6. Simplify the order-pay visual template after it is no longer the primary storefront path.

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

- `/wp-json/dtb/v1/checkout/capabilities` returns `payment_architecture.contract_version = "2"`.
- `registered_methods` reflects WooCommerce Blocks payment registry state when available.
- `same_shell_supported` remains false until a verified DTB client bridge is intentionally enabled.
- Existing checkout still reaches order-pay fallback.
- Retry/double-submit behavior remains contained.
- `/checkout/order-pay/{id}` still works for recovery links.
