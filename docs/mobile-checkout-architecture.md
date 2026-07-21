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

WooCommerce owns cart/session continuity, customer/address validation, shipping/tax/totals, checkout submission, and order creation. The official WooCommerce Stripe Payment Gateway owns embedded payment fields, payment-method eligibility, express methods, Link, tokenization, 3DS/SCA, payment execution, and webhook-backed reconciliation.

## Mobile customer flow

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

The official WooCommerce Stripe Express Checkout block appears first when the provider reports an eligible wallet or accelerated method, followed by WooCommerce-owned contact/account fields. DTB changes presentation only; it does not clone, reparent, or mirror authoritative customer controls.

### Shipping

Contains shipping address, billing relationship/address, delivery/shipping methods, and pickup controls when available.

### Payment

The final page-level step is a review/payment-launch surface. The canonical WooCommerce sidebar Order Summary remains the only source for items, discounts, shipping, taxes, and final total.

`Continue to payment` opens the mobile payment sheet. It does not submit an order, create a Stripe object, or charge the customer.

## Payment sheet

The payment sheet is presentation state only. It is not a second checkout, payment gateway, PaymentIntent flow, Checkout Session, or order lifecycle.

When opened on mobile:

- the existing WooCommerce main checkout column becomes the fixed bottom-sheet dialog surface;
- DTB renders an accessible dialog chrome inside that existing Woo main column without moving provider-owned payment nodes;
- the dialog chrome provides `Payment`, a 46px close target, and a read-only `Total due` sourced from WooCommerce Blocks `wc/store/cart` state;
- the already-mounted official express/payment blocks remain authoritative and interactive;
- the authoritative WooCommerce Place Order action remains the only order/payment submission control;
- the supported WooCommerce Checkout Block `placeOrderButtonLabel` filter labels that same mobile action `Pay now`;
- background checkout content becomes inert and body scrolling remains locked;
- keyboard focus is contained inside the open dialog and returns to the invoking `Continue to payment` action on close through the canonical sheet state machine;
- the decorative legacy grabber/header is suppressed so the UI does not imply unsupported drag-to-dismiss behavior;
- `visualViewport` height is used as a presentation constraint so the payment sheet remains usable with mobile software keyboards and dynamic browser chrome;
- closing/reopening the sheet preserves WooCommerce and Stripe state.

DTB must not reparent WooCommerce React-controlled payment nodes, clone Stripe iframes, create a second Payment Element, create PaymentIntents, create Checkout Sessions, fabricate wallet buttons, or implement a second submit/payment state machine.

## Modal accessibility contract

The open payment sheet follows the modal-dialog contract:

- the existing Woo main payment surface carries `role="dialog"` and `aria-modal="true"`;
- `aria-labelledby` references the visible `Payment` title inside the dialog;
- the visible close control is a descendant of the dialog;
- the legacy external header is presentation-only and removed from keyboard/accessibility navigation;
- the backdrop remains pointer-dismissible but is not part of the tab order;
- `Tab` and `Shift+Tab` wrap within visible dialog controls, including provider iframes;
- focus attempts outside an open sheet are redirected to the dialog;
- Escape remains handled by the canonical `woo-native-checkout-ui.js` close path;
- focus restoration remains owned by the canonical sheet state machine.

Do not add another modal state machine or replace the Woo/Stripe submission controls to implement accessibility.

## Authoritative total projection

The payment-sheet amount is a read-only presentation projection from WooCommerce Blocks `wc/store/cart` via `getCartTotals()` and `wp.data.subscribe()`.

Rules:

- use `total_price` plus Woo currency metadata only;
- never calculate shipping, tax, discounts, or grand totals independently;
- never scrape the visible Order Summary DOM to derive payment authority;
- updates to Woo cart/totals state update the displayed amount without changing checkout state;
- if the Woo data store is unavailable, omit the amount rather than fabricate or cache a stale value.

## Stripe-safe mounting contract

The official Stripe runtime may initialize before the customer opens the payment sheet. The existing Express Checkout block remains mounted and visible on Contact, is visually inactive during Shipping/Payment review, and is re-exposed when the Payment sheet opens. Provider-owned payment fields remain mounted at measurable mobile width while inactive.

Do not use `display:none` for inactive provider payment surfaces. Do not mount Stripe only after opening the sheet.

The presentation layer may position the existing Woo checkout main column as a fixed visual bottom sheet with CSS, but it must not detach or reparent provider-owned controls from the WooCommerce React tree.

## Official Stripe Optimized Checkout Suite

The official WooCommerce Stripe extension supports Optimized Checkout Suite with merchant-configured payment-method layouts including Accordion and Tabs.

For DTB mobile checkout, Accordion is the required launch recommendation because it provides a vertically navigable payment-method experience for narrow viewports. This remains a WooCommerce/Stripe gateway setting; DTB never creates a competing payment-method selector.

Verify in:

```text
WooCommerce -> Settings -> Payments -> Stripe -> Settings -> Advanced Settings
```

Required launch checks:

- official WooCommerce Stripe extension is current and connected;
- Optimized Checkout Suite is enabled when eligible;
- Payment Method Configuration / Settings Sync is enabled and healthy;
- Layout is `Accordion` for the intended mobile experience;
- only desired payment methods are enabled;
- active test/live webhook configuration is complete and webhook health is verified;
- automatic capture is enabled unless an explicitly reviewed manual-capture workflow exists;
- competing Stripe/WooPayments card-wallet authorities are disabled;
- wallet and local-payment eligibility remain provider controlled.

`GET /wp-json/dtb/v1/checkout/capabilities` exposes only non-secret local readiness metadata. `DTB_MobilePaymentSheet` augments it with payment-sheet version, active mode, configured layout, settings-sync state, local active-webhook configuration, cached webhook health when available, capture mode, and a competing-authority boolean. It must not perform external Stripe calls in this public request.

## Presentation assets

```text
dtb-commerce/assets/woo-native-checkout.css
  -> canonical base checkout layout, tokens, responsive steps, provider-safe
     structural rules, and the original fail-open payment-sheet mechanics

dtb-commerce/assets/woo-native-checkout-steps.js
  -> mechanical boot/reveal only

dtb-commerce/assets/woo-native-checkout-ui.js
  -> Contact/Shipping/Payment state, wrapper classification, provider-safe
     visibility, canonical payment-sheet open/close state, focus restoration,
     body scroll/inert state, and the supported mobile `Pay now` label filter

dtb-commerce/Payment/MobilePaymentSheet.php
  -> bounded production hardening asset loader plus non-secret local readiness
     diagnostics/admin warnings; no payment processing authority
dtb-commerce/assets/woo-native-checkout-payment-sheet.js
  -> accessible dialog chrome, focus containment, authoritative Woo total
     projection, legacy chrome suppression, and visualViewport adaptation
dtb-commerce/assets/woo-native-checkout-payment-sheet.css
  -> bounded mobile dialog/chrome/provider-container polish only
```

The payment-sheet hardening assets are intentionally downstream of the canonical checkout UI asset. They may only refine DTB-owned shell presentation and safe outer provider containers. They must never duplicate provider fields, mutate payment state, or introduce another checkout/payment authority.

`woo-native-checkout-profile-refinements.css/js` remain a separate profile/contact presentation companion loaded by the native checkout template. New payment-sheet behavior belongs in the bounded payment-sheet assets above rather than in profile refinements.

## Validation/error behavior

WooCommerce remains final validation authority.

- DTB step buttons change presentation state only.
- If Woo focuses an invalid Contact or Shipping control, presentation returns to that owning step.
- Payment-specific errors remain in the open payment sheet and receive scroll margin so sticky chrome/actions do not obscure them.
- Closing/reopening the sheet must not remount Stripe unnecessarily.
- 3DS/SCA temporarily hands control to Stripe and must return to the same Woo payment state on failure/cancel.
- Successful payment follows the authoritative WooCommerce order-received flow and existing DTB storefront tracking redirect.

## Responsive behavior

The Contact/Shipping/Payment state contract applies on mobile, tablet, and desktop. Desktop keeps the canonical order summary beside the active step and renders official payment controls in normal document flow.

The bottom payment sheet and mobile `Pay now` label apply only below the mobile breakpoint. Crossing the breakpoint must not clone provider controls. If the enhancement fails to load, normal WooCommerce Checkout Block remains the fail-open document.

## Verification

Static contract validation:

```powershell
./scripts/smoke-dtb-mobile-payment-sheet.ps1
```

The smoke check verifies asset wiring, JavaScript/PHP syntax when runtimes are available, accessibility/authoritative-total contracts, and the absence of a second Stripe payment orchestration path. CI runs this script before deployment-payload assembly.

Manual/staging acceptance remains mandatory:

1. Mobile Safari/iPhone with and without Apple Pay eligibility.
2. Chrome/Android with and without Google Pay eligibility.
3. Contact -> Shipping -> Payment -> payment sheet -> close -> reopen.
4. Address, shipping method, selected payment method, and provider state remain intact across navigation.
5. Accordion payment methods remain vertically reachable and scrollable.
6. Card success, decline, and 3DS challenge/cancel/failure.
7. Exactly one visible canonical Order Summary; sheet total always matches Woo authoritative totals.
8. Page behind the open sheet cannot scroll or receive interaction.
9. Tab/Shift+Tab remain inside the modal; Escape/close restore focus without destroying checkout state.
10. Software-keyboard open/close does not hide payment fields, provider errors, or the authoritative `Pay now` action.
11. Mobile authoritative submit label is `Pay now`; desktop retains Woo default labeling; both use the same Woo action.
12. Resize mobile -> desktop -> mobile without duplicated controls, fixed overlays, or hidden sections.
13. Guest and authenticated checkout.
14. Cart quantity change immediately followed by checkout handoff.
15. Failed payment followed by retry through WooCommerce order-pay.
16. Successful staging checkout returns to the staging storefront order-tracking path.
17. Duplicate submit/reload/webhook replay does not duplicate orders or downstream jobs.
18. Partial/full refunds retain one QuickBooks projection per concrete Woo refund ID.
19. Operator readiness confirms Accordion layout, Settings Sync, active-mode webhooks, automatic capture, and single payment authority before live acceptance.
