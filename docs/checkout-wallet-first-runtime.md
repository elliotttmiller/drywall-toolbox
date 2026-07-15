# Checkout wallet-first identity runtime

Drywall Toolbox checkout now leads unauthenticated customers with a wallet-first express checkout section before the guest/account choice.

## Authority boundary

React owns only the checkout identity presentation and interaction state. DTB backend remains authoritative for quote/session/finalize, shipping, tax, coupons, idempotency, and order creation. WooCommerce/WooPayments remain authoritative for payment collection on the secure order-pay step.

The wallet buttons must not create orders, payment intents, gateway callbacks, or payment tokens in the React checkout. They may only link to configured, real express provider launch URLs. When no launch URL is configured, the wallet option renders disabled rather than pointing to a fake route.

## Runtime configuration

Express wallet URLs may be injected at runtime:

```js
window.DTB_EXPRESS_CHECKOUT_PROVIDERS = {
  shop: '/dtb/v1/auth/shop-pay/start',
  paypal: '/dtb/v1/auth/paypal/start',
  google_pay: '/dtb/v1/auth/google-pay/start',
  apple_pay: '/dtb/v1/auth/apple-pay/start',
};
```

The component also supports guarded public build/runtime env keys:

```text
REACT_APP_SHOP_PAY_URL
REACT_APP_SHOPPAY_URL
REACT_APP_EXPRESS_SHOP_PAY_URL
REACT_APP_PAYPAL_EXPRESS_URL
REACT_APP_PAYPAL_CHECKOUT_URL
REACT_APP_GOOGLE_PAY_URL
REACT_APP_EXPRESS_GOOGLE_PAY_URL
REACT_APP_APPLE_PAY_URL
REACT_APP_EXPRESS_APPLE_PAY_URL
```

SSO remains separately config-gated through:

```text
window.DTB_AUTH_PROVIDERS
window.dtbAuthProviders
REACT_APP_GOOGLE_SSO_URL
REACT_APP_AUTH_GOOGLE_URL
REACT_APP_APPLE_SSO_URL
REACT_APP_AUTH_APPLE_URL
```

The component uses guarded environment access so a missing `process` object in the browser cannot crash the SPA.

## Manual verification

- `/checkout` renders without the branded 500 error page.
- Express wallet buttons are first in the unauthenticated checkout flow.
- Unconfigured wallet buttons are disabled and do not navigate.
- Configured wallet URLs receive `returnTo=/checkout` and `return_to=/checkout` query parameters.
- Guest checkout remains prominent and does not force account creation.
- Google/Apple SSO remain disabled unless configured with real launch URLs.
