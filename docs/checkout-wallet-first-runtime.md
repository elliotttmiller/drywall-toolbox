# Checkout and order-pay runtime

Drywall Toolbox checkout uses a two-page, official-boundary workflow:

1. React `/checkout` collects customer identity, contact, delivery address, coupon code, order note, and DTB server-calculated quote context.
2. DTB creates/finalizes the checkout session and hands the customer to the keyed WooCommerce `/checkout/order-pay/{order_id}` payment page.
3. WooCommerce/WooPayments and the active gateway plugins collect payment fields, wallet authorization, tokenization, nonces, iframes, callbacks, and payment lifecycle state.

## Authority boundary

React owns checkout intake presentation and interaction state only. It must not create payment intents, payment tokens, gateway callbacks, wallet sessions, or parallel order-payment forms.

DTB backend remains authoritative for quote/session/finalize, shipping, tax, coupons, idempotency, duplicate containment, order creation, and secure payment handoff.

WooCommerce/WooPayments remain authoritative for actual payment collection on the order-pay step.

## Checkout intake UX

Unauthenticated checkout is guest-first. The primary CTA is `Continue as guest`. Sign-in remains secondary and optional. SSO options may render only when real auth provider launch URLs are configured; unconfigured SSO controls must not render as disabled dead-end buttons.

The React checkout page must not show fake Apple Pay, Google Pay, PayPal, Shop Pay, or other wallet buttons. Those providers belong on the official WooCommerce/WooPayments payment runtime unless a future provider-specific backend integration explicitly owns a real express launch contract.

Mobile checkout must stay fluid within the visual viewport:

- top order summary is a compact, collapsible summary card;
- product images are constrained and never expand to page width;
- form sections use single-column mobile flow;
- the sticky total/action sheet is compact by default and expandable for detailed totals;
- the bottom CTA validates/finalizes checkout and opens the secure order-pay payment page.

## Order-pay payment UX

The order-pay page may classify available WooCommerce gateway methods for presentation only:

```text
[ wallet / express gateways exposed by WooCommerce ]
[ card gateway ]
[ pay-later / other enabled gateways ]
```

Classification must never move gateway iframes, nonces, tokenization elements, payment callbacks, or submit ownership out of WooCommerce gateway markup. Selected gateway details expand inline only.

## Manual verification

Frontend:

```powershell
cd frontend
npm ci --include=dev
npm run lint
npm run build:staging
npm run build
```

Backend/order-pay smoke checks:

```powershell
.\scripts\smoke-dtb-mu-modules.ps1
```

Manual checks:

- `/checkout` renders without the branded 500 error page.
- Guest checkout is the primary unauthenticated action.
- Fake/unconfigured wallet buttons are not present on the React intake page.
- Mobile order summary opens/closes and keeps product imagery constrained.
- Shipping/tax status updates from the DTB quote context.
- Sticky mobile CTA remains above browser safe areas and opens secure payment when checkout is ready.
- `/checkout/order-pay/{id}` renders WooCommerce gateway methods in a clean responsive shell.
- Wallet/card/pay-later fields remain inside official WooCommerce gateway markup.
- Payment submit remains WooCommerce-owned.
