# Checkout Session and Identity Contract

Last verified against source: 2026-07-20.

## Production contract

Drywall Toolbox uses one WooCommerce cart/session across the React storefront and native WooCommerce checkout:

```text
React Store API cart
  -> same-origin Woo cookie-backed session
  -> full-document https://drywalltoolbox.com/checkout/
  -> WordPress resolves the same authenticated customer
  -> WooCommerce loads the same session/cart
  -> Checkout Block
  -> official WooCommerce Stripe Payment Gateway
```

`/staging/{id}/` is only a React storefront build location. It is not a separate checkout authority. Staging and production storefront builds both hand off to the canonical root `/checkout/` on the backend/public origin.

## Authenticated customer identity convergence

The React storefront issues the signed HttpOnly `dtb_auth` JWT after DTB login. Store API REST requests already resolve that verified JWT to the matching WordPress customer before WooCommerce initializes customer/session state.

Native checkout is a normal WordPress document request rather than a REST request. `dtb-platform/Auth/NativeCheckoutIdentityBridge.php` therefore resolves the same signed `dtb_auth` identity during `determine_current_user` for native checkout/payment document requests only.

Required invariant:

```text
DTB authenticated customer ID
  == WordPress current user ID during native checkout
  == WooCommerce registered-customer session owner
```

Native WordPress cookie authentication always wins when present. The bridge does not mint WordPress admin/auth cookies, grant capabilities, accept caller-supplied customer IDs, decode unsigned tokens, query `woocommerce_sessions`, copy session rows, or inject arbitrary Woo sessions.

## Guest contract

Guests remain WordPress user `0` with WooCommerce's normal guest session identity. The native checkout bridge does nothing when `dtb_auth` is absent or invalid.

## Cart-Token policy

Same-origin production/staging React uses WooCommerce's cookie-backed session plus Store API Nonce semantics. `Cart-Token` remains compatibility-only for genuinely cross-origin clients.

Do not use a browser-persisted Cart-Token to repair native checkout continuity: a full-document checkout navigation cannot attach a custom `Cart-Token` request header, which would recreate two cart authorities.

## Failure behavior

If a signed DTB identity cannot be verified, the bridge fails closed and leaves WordPress authentication unchanged.

The checkout flow must never repair identity/session mismatch by:

- decoding an unsigned JWT payload;
- deriving a Woo session key from caller-controlled data;
- reading another customer's `woocommerce_sessions` row;
- manually injecting a Woo session;
- trusting a caller-supplied customer ID.

## Mechanical verification

For an authenticated staging customer:

1. Add a product through the Store API and verify the server cart contains it.
2. Verify the browser has `wp_woocommerce_session_*` and `woocommerce_items_in_cart` cookies.
3. Click Checkout from `/staging/2972/`.
4. The first checkout document navigation must target `/checkout/`, not `/staging/2972/checkout/`.
5. The `/checkout/` response must not expire `wp_woocommerce_session_*`, `woocommerce_items_in_cart`, or `woocommerce_cart_hash`.
6. Native checkout must render the same SKU/variation/quantity seen by the React cart.
7. For an authenticated customer, server-side `get_current_user_id()` must equal the Woo session customer ID.
8. Guest checkout must continue to work without a DTB auth cookie.
9. Invalid/expired/tampered `dtb_auth` must not authenticate the request or expose another customer's cart.

Only after this identity/session contract passes should Stripe card, 3DS/SCA, Link, wallet, webhook, order-pay, refund, Veeqo, and QuickBooks acceptance tests be considered meaningful.
