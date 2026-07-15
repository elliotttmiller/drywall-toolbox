# Checkout wallet-first identity and order-pay runtime

Drywall Toolbox checkout now leads unauthenticated customers with a wallet-first express checkout section before the guest/account choice, then preserves the same wallet-first hierarchy on the WooCommerce order-pay payment runtime.

## Authority boundary

React owns only checkout identity presentation and interaction state. DTB backend remains authoritative for quote/session/finalize, shipping, tax, coupons, idempotency, and order creation. WooCommerce/WooPayments remain authoritative for payment collection on the secure order-pay step.

The wallet buttons must not create orders, payment intents, gateway callbacks, or payment tokens in the React checkout. They may only link to configured, real express provider launch URLs. When no launch URL is configured, the wallet option renders disabled rather than pointing to a fake route.

## Checkout express layout

The checkout identity step intentionally exposes exactly three express wallet methods in this order:

```text
[ Apple Pay ] [ Google Pay ]
[            PayPal            ]
```

Apple Pay and Google Pay are compact side-by-side wallet choices. PayPal is the full-width wallet choice beneath them. Shop Pay is not shown in the DTB checkout identity step unless a future backend/provider implementation explicitly adds it back.

Guest checkout remains the default fallback and is shown as a full-width primary action. Login and SSO are secondary account conveniences, not blockers.

## Order-pay payment layout

The order-pay runtime classifies gateway methods by provider and applies the same express-first layout where WooCommerce exposes matching methods:

```text
[ Apple Pay ] [ Google Pay ]
[            PayPal            ]

or continue below

[ Pay later / card / other gateway methods ]
```

Order-pay styling must never move gateway iframes, nonces, tokenization elements, payment callbacks, or submit ownership out of WooCommerce gateway markup. Selected gateway details expand inline only.

## Runtime configuration

Express wallet URLs may be injected at runtime with these keys:

```text
window.DTB_EXPRESS_CHECKOUT_PROVIDERS.apple_pay
window.DTB_EXPRESS_CHECKOUT_PROVIDERS.google_pay
window.DTB_EXPRESS_CHECKOUT_PROVIDERS.paypal
```

The React checkout component also supports guarded public build/runtime env keys:

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
- `/checkout/order-pay/{id}` renders the same express-first provider hierarchy where matching gateways are available.
- Payment fields, wallet gateway elements, and card iframes remain inside WooCommerce gateway markup.
