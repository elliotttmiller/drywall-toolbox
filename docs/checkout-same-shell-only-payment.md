# Same-shell checkout payment behavior

## Scope

The storefront checkout payment action is now same-shell only. The React checkout shell must not open the legacy WooCommerce order-pay URL as the default customer-facing payment path.

## Payment boundary

DTB still does not render card fields, wallet sheets, tokenization controls, provider iframes, or provider callbacks. Payment execution remains owned by WooCommerce and the selected payment provider.

## Runtime behavior

When the customer presses the protected payment action, the same-shell runtime:

1. prevents the default click navigation;
2. refreshes checkout payment capabilities;
3. verifies the same-shell gate;
4. starts `window.dtbCheckoutSameShellProvider.startPayment()` only when the provider adapter is available;
5. renders an in-shell unavailable state when the gate is missing.

The runtime does not automatically redirect to order-pay. If a provider payment result returns a redirect URL, the runtime surfaces that as an unavailable same-shell condition instead of navigating away.

## Required live activation

Same-shell payment can complete only when all of these are true:

- WooPayments or the selected provider is active and enabled;
- the provider registers an active WooCommerce Blocks payment method;
- `window.wc.wcBlocksRegistry.registerPaymentMethod` exists;
- `window.wc.wcBlocksRegistry.registerExpressPaymentMethod` exists;
- the DTB backend capability envelope reports same-shell support;
- `window.dtbCheckoutSameShellProvider.startPayment` is installed by a provider-owned adapter;
- the adapter submits valid provider-owned payment data to the existing-order Store API path for the same DTB-created WooCommerce pending order.

`/checkout/order-pay` may still exist for legacy recovery and non-storefront links, but it is no longer the default storefront payment action.
