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

## WooPayments same-shell adapter

`frontend/src/features/checkout/wooPaymentsSameShellProvider.js` installs the production provider adapter at:

```js
window.dtbCheckoutSameShellProvider.startPayment()
```

The adapter is deliberately narrow:

- it reads provider-owned payment state from the WooCommerce Blocks payment data store;
- it accepts only WooPayments-compatible gateway ids: `woocommerce_payments`, `woopayments`, or `stripe`;
- it rejects Apple Pay / Google Pay when WooCommerce Blocks has not initialized express payment methods for the current browser/device;
- it rejects payment when provider-owned payment data is missing;
- it submits payment through the same-order Store API path using the DTB-created pending order id and order key;
- it never creates raw card fields, payment tokens, provider iframes, or wallet sheets inside DTB React.

## Backend same-shell activation

`DTB_CheckoutBlocksCapabilityDetector` now defaults the `dtb_checkout_blocks_same_shell_supported` gate to true only when the server has WooCommerce Blocks infrastructure and an active registered WooPayments-compatible Blocks method. A site may still force-disable the path by returning false from that filter.

## Required live activation

Same-shell payment can complete only when all of these are true:

- WooPayments or the selected provider is active and enabled;
- the provider registers an active WooCommerce Blocks payment method;
- `window.wc.wcBlocksRegistry.registerPaymentMethod` exists;
- `window.wc.wcBlocksRegistry.registerExpressPaymentMethod` exists;
- `window.wc.wcBlocksData.paymentStore` exists;
- the WooCommerce Blocks payment store has initialized methods;
- provider-owned payment controls have produced valid payment data;
- the DTB backend capability envelope reports same-shell support;
- `window.dtbCheckoutSameShellProvider.startPayment` is installed by the WooPayments same-shell adapter;
- the adapter submits valid provider-owned payment data to the existing-order Store API path for the same DTB-created WooCommerce pending order.

`/checkout/order-pay` may still exist for legacy recovery and non-storefront links, but it is no longer the default storefront payment action.
