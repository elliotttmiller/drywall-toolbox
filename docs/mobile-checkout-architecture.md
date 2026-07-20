# Mobile Checkout Architecture

Last verified against source: 2026-07-20.

## Ownership

Drywall Toolbox no longer implements a React-owned checkout intake/finalization pipeline. React owns cart UX and the full-document checkout handoff only.

The production checkout authority is:

```text
React cart / cart drawer
  -> full-document navigation to /checkout/
  -> assigned WordPress WooCommerce Checkout page
  -> WooCommerce Checkout Block
  -> official WooCommerce Stripe Payment Gateway
  -> WooCommerce order/payment lifecycle
  -> DTB event ledger + dtb-orders queue
```

WooCommerce owns cart/session continuity, customer/address validation, shipping/tax/totals, checkout submission, and order creation. The official WooCommerce Stripe Payment Gateway owns embedded payment fields, eligible express wallets, Link, tokenization, 3DS/SCA, and webhook-backed payment reconciliation.

## Mobile mechanical requirements

The UI layer must preserve these invariants:

- the React cart and drawer use the same WooCommerce Store API cookie session as `/checkout/` on the same origin;
- no React component renders card fields, wallet buttons, Stripe Elements, payment iframes, PaymentIntents, or Stripe Checkout Sessions;
- pending cart quantity/remove mutations settle before the drawer transfers the document to checkout;
- `/checkout/` is a normal WordPress/WooCommerce document and contains the assigned Checkout Block;
- provider-owned payment controls remain mounted, keyboard accessible when active, responsive, and Stripe-owned;
- checkout mechanics do not depend on a custom full-document renderer, cloned controls, custom payment validation, or DTB submission logic;
- checkout errors remain visible and WooCommerce retains final validation authority;
- order creation occurs once through WooCommerce checkout;
- downstream Veeqo/QuickBooks/notification/tracking work waits for DTB's captured-payment gate.

## Express checkout

The official Stripe extension supports eligible express checkout methods in WooCommerce-supported contexts. Drywall Toolbox approves the native WooCommerce Checkout Block as the production express-payment surface.

React catalog/product quick-view, full cart, and mini-cart must not fabricate or iframe provider wallet controls. Native Woo purchasing surfaces and checkout allow the official Stripe extension to render only eligible provider-owned controls.

## Presentation layer

Checkout branding is isolated from payment/order mechanics:

```text
dtb-commerce/assets/woo-native-checkout.css
  -> compatibility/base layout

dtb-commerce/assets/woo-native-checkout-steps.js
  -> mechanical boot reveal only

dtb-commerce/assets/woo-native-checkout-ui.css
  -> typography, spacing, responsive surfaces, express-button radius,
     order-summary presentation, and mobile step presentation

dtb-commerce/assets/woo-native-checkout-mobile-fixes.css
  -> mobile gesture/overflow hardening around provider-owned payment UI
     and final step-navigation polish

dtb-commerce/assets/woo-native-checkout-ui.js
  -> presentation-only mobile Details / Payment / Review navigation,
     runtime Checkout Block selector fallbacks, and duplicate visual
     order-summary suppression
```

The mobile step enhancement never creates, clones, moves, submits, or validates WooCommerce/Stripe controls. Inactive sections remain mounted at a measurable width off-canvas so the official Stripe Payment Element and wallet surfaces can initialize normally. WooCommerce remains the final validation and submission authority.

Presentation discovery must support both WordPress block wrapper classes and WooCommerce's hydrated `wc-block-checkout__*` runtime classes. Missing presentation selectors must fail open: checkout sections remain native/visible rather than becoming a dependency of order or payment mechanics.

A bounded `MutationObserver` is permitted only to wait for the initial hydrated Checkout Block before attaching presentation classes; it disconnects immediately after successful mount or timeout. The mechanical checkout path must remain usable if the presentation enhancement fails to initialize.

The canonical order summary is the WooCommerce sidebar summary. A repeated responsive/fill summary may be visually suppressed, but totals/items must never be copied or recomputed by DTB.

## Mobile UX contract

The responsive presentation uses three customer-facing steps:

1. **Details** — express checkout, contact, addresses, and shipping/delivery selection.
2. **Payment** — WooCommerce payment section and optional order note; Stripe remains provider-owned.
3. **Review** — the single canonical order summary, terms, and WooCommerce-owned Place Order action.

The progress/navigation controls only change presentation. Future steps remain orientation-only until reached, completed/visited steps can be revisited, and native Woo validation may focus the customer back into the owning visible step. DTB does not bypass Woo validation, mutate checkout data, or submit the order.

## Verification

Test at minimum:

1. Mobile Safari/iPhone with and without an Apple Pay-eligible wallet.
2. Chrome/Android with and without Google Pay eligibility.
3. Card payment success, decline, and 3DS challenge.
4. Step forward/back navigation without losing address, shipping, payment, or Stripe state.
5. Every eligible provider payment method remains reachable by the provider-owned mobile selector/navigation.
6. Resize mobile -> desktop -> mobile without duplicated controls or hidden checkout sections.
7. Exactly one visible Order Summary on mobile and desktop; values must match WooCommerce totals.
8. Cart quantity change immediately followed by checkout handoff.
9. Guest and authenticated checkout.
10. Back/forward navigation and checkout refresh without cart loss or duplicate orders.
11. Failed payment followed by retry through WooCommerce order-pay.
12. Partial and full refunds with one QuickBooks refund projection per Woo refund ID.
