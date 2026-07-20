# Mobile Checkout Architecture

Last verified against source: 2026-07-20.

## Ownership

Drywall Toolbox does not own payment processing. React owns cart UX and the full-document checkout handoff only.

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

WooCommerce owns cart/session continuity, customer/address validation, shipping/tax/totals, checkout submission, and order creation. The official WooCommerce Stripe Payment Gateway owns embedded payment fields, payment-method eligibility, express methods, Link, tokenization, 3DS/SCA, and webhook-backed reconciliation.

## Mobile customer flow

The mobile presentation is:

```text
Contact
  -> Shipping
  -> Payment summary
  -> Continue to payment
  -> same-page bottom payment sheet
  -> authoritative WooCommerce payment submission
  -> Woo order-received / DTB order tracking
```

### Contact

Contains contact/account fields only. Payment controls are not presented as a general checkout surface in this step.

### Shipping

Contains shipping address, billing relationship/address, delivery/shipping methods, and pickup controls when available.

### Payment

The final page-level step is a review/payment-launch surface. The canonical WooCommerce sidebar Order Summary remains the only source for items, discounts, shipping, taxes, and final total. DTB must never copy or recompute those values.

The page-level CTA opens the payment sheet; it does not submit an order or charge the customer.

## Payment sheet

The payment sheet is presentation state only. It is not a new checkout, payment gateway, PaymentIntent flow, or order lifecycle.

When opened on mobile:

- the existing WooCommerce main checkout column becomes a fixed bottom-sheet surface;
- a backdrop and lightweight sheet header are added by DTB;
- the already-mounted official express/payment blocks become interactive inside the sheet;
- the authoritative WooCommerce Place Order/payment action remains the only order/payment submission control;
- the page behind the sheet becomes inert and body scrolling is locked;
- closing the sheet restores the Payment summary without destroying checkout or Stripe state.

DTB must not reparent WooCommerce React-controlled nodes, clone Stripe iframes, create a second Payment Element, create PaymentIntents, create Checkout Sessions, fabricate wallet buttons, or implement a second submit/payment state machine.

## Stripe-safe mounting contract

The official Stripe runtime may initialize before the customer opens the payment sheet. Therefore provider-owned payment and express blocks remain mounted at measurable mobile width while visually inactive.

Do not use `display:none` for inactive Stripe/Woo payment surfaces. Do not mount Stripe only after opening the sheet.

The presentation layer may move the existing Woo checkout main column into a fixed visual bottom-sheet position with CSS, but it must not detach/reparent provider-owned controls from the WooCommerce React tree.

## Official Stripe Optimized Checkout Suite

The official WooCommerce Stripe extension supports Optimized Checkout Suite and provides merchant-configured payment-method layouts including Accordion and Tabs.

For the DTB mobile sheet, Accordion is the preferred operator configuration because it provides a vertically navigable payment-method experience suitable for narrow mobile viewports and avoids a cramped horizontal tab selector. This is a WooCommerce/Stripe gateway setting, not a DTB-created payment-method UI.

Required operator configuration should be verified in:

```text
WooCommerce -> Settings -> Payments -> Stripe -> Settings -> Advanced Settings
```

Verify:

- official WooCommerce Stripe extension is current and connected;
- Optimized Checkout Suite is enabled when eligible;
- settings sync is healthy;
- Layout is configured to Accordion for the intended mobile experience;
- only desired payment methods are enabled;
- wallet and local-payment eligibility remain provider controlled.

## Presentation assets

```text
dtb-commerce/assets/woo-native-checkout.css
  -> compatibility/base checkout layout

dtb-commerce/assets/woo-native-checkout-steps.js
  -> mechanical boot/reveal only

dtb-commerce/assets/woo-native-checkout-ui.css
  -> typography, Contact/Shipping/Payment presentation,
     canonical Order Summary styling, payment-sheet layout/animation

dtb-commerce/assets/woo-native-checkout-ui.js
  -> presentation-only step navigation, duplicate visual summary suppression,
     payment-sheet open/close/focus/scroll state

dtb-commerce/assets/woo-native-checkout-mobile-fixes.css
  -> provider-safe mobile overflow/touch compatibility only
```

## Validation/error behavior

WooCommerce remains final validation authority.

- DTB step buttons only change presentation state.
- If Woo focuses an invalid Contact or Shipping control, the presentation layer returns to that owning step.
- Payment-specific errors remain in the open payment sheet.
- Closing/reopening the sheet must not remount Stripe unnecessarily.
- 3DS/SCA temporarily hands control to Stripe and must return to the same Woo payment state on failure/cancel.
- Successful payment follows the authoritative WooCommerce order-received flow and existing DTB storefront tracking redirect.

## Responsive behavior

The enhanced Contact/Shipping/Payment + payment-sheet UX applies only at the mobile breakpoint.

On desktop/tablet outside the mobile breakpoint, DTB removes the enhanced step/sheet classes and restores the normal WooCommerce Checkout Block document.

The presentation enhancement must fail open: if required Woo runtime selectors are not present after hydration, the native checkout remains usable rather than hiding controls.

## Verification

Test at minimum:

1. Mobile Safari/iPhone with and without Apple Pay eligibility.
2. Chrome/Android with and without Google Pay eligibility.
3. Contact -> Shipping -> Payment -> payment sheet -> close -> reopen.
4. Address, shipping method, selected payment method, and provider state remain intact across navigation.
5. Accordion payment methods remain vertically reachable and scrollable in the sheet.
6. Card payment success, decline, and 3DS challenge/cancel/failure.
7. Exactly one visible canonical Order Summary; values always match WooCommerce totals.
8. Page behind the open sheet cannot scroll or receive interaction.
9. Escape/close/back interactions restore focus without destroying checkout state.
10. Resize mobile -> desktop -> mobile without duplicated controls, fixed overlays, or hidden checkout sections.
11. Guest and authenticated checkout.
12. Cart quantity change immediately followed by checkout handoff.
13. Failed payment followed by retry through WooCommerce order-pay.
14. Successful staging checkout returns to the staging storefront order-tracking path.
15. Partial/full refunds retain one QuickBooks projection per Woo refund ID.
