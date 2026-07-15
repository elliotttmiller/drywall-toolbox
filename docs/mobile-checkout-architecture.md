# Mobile Checkout Architecture

Last updated: 2026-07-14.

## Ownership

The React checkout route owns customer-facing checkout intake, interaction state, client-side usability validation, draft recovery, section presentation, and the mobile action sheet.

The DTB backend remains authoritative for checkout quote creation, shipping, tax, coupon evaluation, checkout session state, confirmation, finalization, idempotency, order creation, and customer/session ownership.

WooCommerce/WooPayments remain authoritative for payment collection on the order-pay runtime. React checkout must not render card fields, wallet buttons, payment iframes, payment intents, nonces, tokenization, or gateway callbacks.

## Current route contract

```text
/cart
  -> /checkout
  -> POST /dtb/v1/checkout/quote
  -> POST /dtb/v1/checkout/session
  -> POST /dtb/v1/checkout/confirm
  -> POST /dtb/v1/checkout/finalize
  -> /checkout/order-pay/{order_id}?pay_for_order=true&key=...
```

The React CTA says `Continue to secure payment` because payment is completed on the WooCommerce order-pay page. The order-pay CTA may say `Pay {total}` because that page owns the gateway form.

## Implemented mobile checkout principles

- Guest checkout is first-class and rendered by React, not injected by a DOM runtime.
- Login and registration remain optional and preserve checkout return intent through router state.
- The mobile order summary is React-rendered and expandable.
- The sticky mobile action sheet is React-rendered and expandable/collapsible.
- Coupon entry is collapsed behind a disclosure to reduce mobile distraction.
- Order notes are collapsed behind a disclosure.
- Phone is optional for checkout intake; backend quote calculation requires name, email, and destination fields, not phone.
- Draft recovery is session-scoped with a TTL and does not persist customer notes.
- Shipping/tax copy distinguishes `By address`, `Calculating…`, and ready totals.
- Checkout DOM MutationObserver runtimes for identity choice, summary auto-open, and mobile totals mirroring are retired.

## Performance posture

Checkout-specific UI logic should be implemented as React components under `frontend/src/features/checkout/`, not as global DOM mutation runtimes. This reduces layout thrashing, selector drift, and route-wide observer work on mobile devices.

Checkout styles should be consolidated into `frontend/src/features/checkout/checkout.css` as new work lands. Existing older checkout CSS layers may remain temporarily only when they provide base layout definitions that have not yet been migrated.

## Safety constraints

Do not change these invariants from checkout UI work:

- no raw browser WooCommerce order creation;
- no browser-side WooCommerce credentials;
- no payment secrets, tokens, gateway credentials, or iframe manipulation in React;
- no order side effects before backend finalization;
- no duplicate order materialization;
- no duplicate Veeqo, QuickBooks, email, fulfillment, or webhook side effects;
- no authoritative tax, shipping, coupon, inventory, or price logic in React.

## Manual verification checklist

- Guest checkout selection focuses the first contact field.
- Login/register links route correctly and can return to checkout.
- Shipping/tax quote starts after name, email, and destination are valid.
- Phone can be omitted until final submit without blocking quote generation.
- Coupon disclosure opens, applies codes, and shows removable tags.
- Order note disclosure does not persist notes after refresh.
- Mobile action sheet is collapsed by default and expands smoothly.
- Mobile CTA says `Continue to secure payment`, not `Pay`, on React checkout.
- Order-pay still says `Pay {total}` and preserves WooCommerce gateway behavior.
- Cart refresh restores checkout draft within the same browser session.
- Checkout completion clears the draft.
