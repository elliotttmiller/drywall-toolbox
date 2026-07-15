# Checkout wallet-first identity runtime

Drywall Toolbox checkout now leads unauthenticated customers with a wallet-first express checkout section before the guest/account choice.

## Authority boundary

React owns only the checkout identity presentation and interaction state. DTB backend remains authoritative for quote/session/finalize, shipping, tax, coupons, idempotency, and order creation. WooCommerce/WooPayments remain authoritative for payment collection on the secure order-pay step.

The wallet buttons must not create orders, payment intents, gateway callbacks, or payment tokens in the React checkout. They may only link to configured, real express provider launch URLs. When no launch URL is configured, the wallet option renders disabled rather than pointing to a fake route.

## Express layout

The checkout identity step intentionally exposes exactly three express wallet methods in this order:

```text
[ Apple Pay ] [ Google Pay ]
[            PayPal            ]
```

Apple Pay and Google Pay are compact side-by-side wallet choices. PayPal is the full-width wallet choice beneath them. Shop Pay is not shown in the DTB checkout identity step unless a future backend/provider implementation explicitly adds it back.

## Runtime configuration

Express wallet URLs may be injected at runtime with these keys:

```text
window.DTB_EXPRESS_CHECKOUT_PROVIDERS.apple_pay
window.DTB_EXPRESS_CHECKOUT_PROVIDERS.google_pay
window.DTB_EXPRESS_CHECKOUT_PROVIDERS.paypal
```

The component also supports guarded public build/runtime env keys:

```text
REACT_APP_APPLE_PAY_URL
REACT_APP_EXPRESS_APPLE_PAY_URL
REACT_APP_GOOGLE_PAY_URL
REACT_APP_EXPRESS_GOOGLE_PAY_URL
REACT_APP_PAYPAL_EXPRESS_URL
REACT_APP_PAYPAL_CHECKOUT_URL
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
- Apple Pay and Google Pay render side by side.
- PayPal renders full width below Apple Pay and Google Pay.
- Unconfigured wallet buttons are disabled and do not navigate.
- Configured wallet URLs receive checkout return parameters.
- Guest checkout remains prominent and does not force account creation.
- Google/Apple SSO remain disabled unless configured with real launch URLs.
