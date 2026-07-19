# Mobile Checkout Architecture

Last verified against source: 2026-07-19.

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

Before visual branding work, mobile checkout must satisfy these invariants:

- the React cart and drawer use the same WooCommerce Store API cookie session as `/checkout/` on the same origin;
- no React component renders card fields, wallet buttons, Stripe Elements, payment iframes, PaymentIntents, or Stripe Checkout Sessions;
- pending cart quantity/remove mutations settle before the drawer transfers the document to checkout;
- `/checkout/` is a normal WordPress/WooCommerce document and contains the assigned Checkout Block;
- provider-owned payment controls remain visible, keyboard accessible, and responsive;
- checkout does not depend on DOM MutationObserver shims or a custom full-document DTB checkout renderer;
- checkout errors remain visible and do not get hidden by DTB styling;
- order creation occurs once through WooCommerce checkout;
- downstream Veeqo/QuickBooks/notification/tracking work waits for DTB's captured-payment gate.

## Express checkout

The official Stripe extension supports eligible express checkout methods in WooCommerce-supported contexts. Drywall Toolbox currently approves the native WooCommerce Checkout Block as the production express-payment surface.

React product pages, product modals, full cart, and mini-cart must not fabricate or iframe provider wallet controls. Additional locations may be added only through an officially supported WooCommerce/Stripe integration that preserves cart/session and variation/quantity authority.

## Styling boundary

Until mechanical validation passes, `dtb-commerce/assets/woo-native-checkout.css` remains a conservative compatibility baseline only.

After cards, 3DS/SCA, eligible/ineligible wallets, failed payment, retry, refunds, and downstream jobs pass staging, checkout branding may be implemented around the native Checkout Block without changing payment or order authority.

## Verification

Test at minimum:

1. Mobile Safari/iPhone with and without an Apple Pay-eligible wallet.
2. Chrome/Android with and without Google Pay eligibility.
3. Card payment success, decline, and 3DS challenge.
4. Cart quantity change immediately followed by checkout handoff.
5. Guest and authenticated checkout.
6. Back/forward navigation and checkout refresh without cart loss or duplicate orders.
7. Failed payment followed by retry through WooCommerce order-pay.
8. Partial and full refunds with one QuickBooks refund projection per Woo refund ID.
