# Official WooCommerce Stripe Checkout Production Checklist

Last verified against source: 2026-07-21.

## Required authority

Use one storefront checkout/payment authority chain only:

```text
WooCommerce Store API cart/session
+ assigned WooCommerce Checkout page with Checkout Block
+ official WooCommerce Stripe Payment Gateway
+ DTB routing/readiness/order-observation/downstream queue
```

Do not enable WooPayments, Payment Plugins for Stripe, custom Stripe Checkout Sessions, React Stripe Elements, fake wallet buttons, copied gateway internals, or DTB payment/express iframes as parallel storefront authorities.

The DTB mobile payment sheet is presentation only. It wraps the existing WooCommerce Checkout Block payment surface visually and must never become a separate payment/order authority.

## Plugin and Stripe account configuration

1. Install and activate the official WooCommerce Stripe Payment Gateway.
2. Open `WooCommerce -> Settings -> Payments -> Stripe`.
3. Connect the intended Stripe account using the official extension flow.
4. Verify test mode before any staging payment and live mode only at launch cutover.
5. Enable only intended card/local/express methods.
6. Enable Optimized Checkout Suite when eligible and configure `Accordion` as the DTB mobile launch layout.
7. Verify Payment Method Configuration / Settings Sync is enabled and healthy.
8. Prefer automatic capture for launch. If manual capture is enabled, verify that authorization-only/on-hold orders do not dispatch fulfillment/accounting until captured.
9. Verify Stripe webhook health for the intended mode. The official gateway callback must remain reachable through WooCommerce `wc-api` routing.
10. Verify HTTPS for the entire public site.
11. For Apple Pay/Google Pay, verify Stripe payment-method domain registration and Apple Pay domain association.
12. Disable WooPayments and other competing storefront card/wallet gateways.

## WooCommerce checkout configuration

1. Confirm the Checkout page is assigned under `WooCommerce -> Settings -> Advanced`.
2. Confirm its content contains the WooCommerce Checkout Block.
3. Confirm `/checkout/` returns a WordPress/WooCommerce document, not React `index.html`.
4. Confirm Checkout Block and official Stripe scripts/styles are present and not stripped by the headless theme.
5. Confirm `GET /wp-json/dtb/v1/checkout/capabilities` reports the expected non-secret contract/readiness state:
   - `checkout=woo_native_checkout_block`;
   - `provider=woocommerce_stripe`;
   - official Stripe extension active;
   - official Stripe gateway enabled;
   - Checkout Block present;
   - HTTPS true;
   - no competing WooPayments authority;
   - `payment_sheet.payment_authority=woocommerce_official_stripe`;
   - `payment_sheet.stripe_account_connected=true`;
   - `payment_sheet.optimized_checkout_layout=accordion` for the intended mobile launch configuration;
   - `payment_sheet.settings_sync_state=enabled`;
   - `payment_sheet.active_webhook_locally_configured=true`;
   - `payment_sheet.active_webhook_cached_status` is reviewed and verified against the official Stripe settings screen;
   - `payment_sheet.automatic_capture=true` unless an explicitly approved manual-capture workflow exists;
   - `payment_sheet.competing_payment_authority_detected=false`;
   - `performance.noncritical_asset_policy=known_marketing_tracking_suppressed`;
   - `performance.checkout_runtime_telemetry=true`;
   - `performance.checkout_document_cache=private_no_store`;
   - `performance.asset_prewarm` contains only expected DTB checkout static assets and approved Stripe preconnect origins.

The public capabilities request must remain local/non-blocking and must never expose Stripe keys, webhook secrets, client secrets, payment tokens, or raw provider credentials. A cached webhook status of `unknown` is not proof of failure or health; verify live/test webhook status in the official Stripe settings before launch.

## Mobile payment-sheet UI contract

Verify the production mobile sheet at minimum:

1. `Continue to payment` opens the same-page bottom sheet without creating an order or payment.
2. Visible dialog title is `Payment`; visible close control is inside the semantic dialog and has an approximately 44px+ touch target.
3. `Tab` and `Shift+Tab` remain contained within the sheet while ordinary checkout content behind it is inert.
4. Stripe-owned challenge/redirect/modal focus is not intercepted by DTB focus containment.
5. Escape, close, and backdrop dismissal restore focus to the invoking checkout action and preserve Woo/Stripe state.
6. There is no decorative drag grabber unless real drag-to-dismiss behavior is implemented safely; the current launch contract intentionally suppresses the legacy false affordance.
7. `Total due` is read from WooCommerce Blocks `wc/store/cart` state and always matches the authoritative Woo order summary; DTB never recomputes shipping, taxes, discounts, or final payable total.
8. Provider-owned payment controls remain mounted and are never cloned/reparented.
9. Official Stripe Optimized Checkout methods remain vertically reachable in Accordion layout.
10. The authoritative WooCommerce Place Order control is the only final submission action and is labeled `Pay now` on mobile through the supported Checkout Block filter.
11. Software-keyboard and dynamic browser-chrome changes do not hide payment fields, provider errors, required terms, or the `Pay now` action.
12. Provider validation/error messages are not obscured by sticky sheet chrome/actions.

## Performance and stability contract

Before payment acceptance, validate the checkout as a separate native performance surface rather than assuming storefront SPA optimizations apply automatically.

1. On the first successful add-to-cart event, one low-priority checkout static-asset prewarm is scheduled without delaying the cart mutation or navigation.
2. Prewarm fetches only read-safe capabilities metadata and static DTB checkout assets; it never prefetches or caches session-owned `/checkout/` HTML.
3. Core DTB checkout scripts remain deferred/footer loaded where supported.
4. Checkout restores early Stripe preconnect/DNS-prefetch hints and preloads DTB checkout styles.
5. Known non-essential marketing/analytics/A-B/chat/loyalty resources are absent from checkout unless explicitly approved; payment/Woo dependencies are never removed heuristically.
6. Order-summary images initially below the fold use async decoding and lazy/low-priority loading; provider iframes and first-interaction checkout controls are not lazy-loaded.
7. Runtime telemetry captures checkout-specific JavaScript errors, unhandled promise rejections, resource failures, payment-surface timeouts, root replacements/state-loss suspicion, poor LCP/CLS/load thresholds, and unexpected third-party hosts.
8. Telemetry contains no raw form values, email addresses, order keys, bearer/JWT tokens, Stripe keys/webhook secrets/client secrets, or Checkout Session secrets.
9. Wholesale Checkout Block root replacement during address/shipping changes is investigated; populated controls must not be wiped.
10. If the official payment block does not obtain a provider iframe within the bounded timeout, the customer sees recovery UI instead of a blank field. `Try express checkout` appears only when a real eligible express surface exists; `Reload payment options` preserves the Woo cart/session.
11. Payment failure recovery never creates a second PaymentIntent, Payment Element, Checkout Session, wallet button, or independent payment submit path.
12. `private/no-store` remains enforced for checkout/session/payment routes despite any asset prewarming.

Run the static and performance tools:

```powershell
./scripts/smoke-dtb-checkout-performance.ps1
./scripts/audit-dtb-checkout-pagespeed.ps1 -Url "https://drywalltoolbox.com/checkout/" -OutputPath "artifacts/checkout-pagespeed-mobile.json"
```

A public PageSpeed audit is a shell baseline only because it does not reproduce a shopper-specific WooCommerce cookie/cart session. Also run a session-preserving mobile Lighthouse/WebPageTest flow in staging with a real cart and record the release-candidate evidence.

Review at minimum LCP, CLS, total blocking time/long tasks, server response time, render-blocking/unused assets, third-party requests, cart-to-checkout navigation timing, and payment-provider readiness/failures.

## Routing and cache checks

Confirm these are WordPress/WooCommerce-owned and private/no-store:

```text
https://drywalltoolbox.com/checkout/
https://drywalltoolbox.com/checkout/order-pay/{order_id}/?key=wc_order_...
https://drywalltoolbox.com/checkout/order-received/{order_id}/?key=wc_order_...
https://drywalltoolbox.com/?wc-api=wc_stripe
```

Confirm staging checkout routes also enter WordPress rather than `/staging/2972/index.html`.

Confirm `.htaccess` cache-bypass behavior does not replace or corrupt WordPress/WooCommerce `Set-Cookie` headers.

Confirm the Apple Pay association URL returns the intended non-empty verification file when Apple Pay is enabled:

```text
https://drywalltoolbox.com/.well-known/apple-developer-merchantid-domain-association
```

## React cart/session continuity

Run these tests before payment testing:

1. Add a real simple SKU product in React.
2. Confirm successful add-to-cart schedules checkout asset prewarm once and does not block/duplicate the Store API mutation.
3. Change quantity and immediately click checkout from the full cart; Checkout Block must show the final quantity.
4. Repeat from the cart drawer; pending/debounced Store API mutations must settle before navigation.
5. Add a variable product and confirm the exact variation ID/SKU/quantity reaches Checkout Block.
6. Reload the React cart, then navigate to checkout; cart must remain identical.
7. Use browser back/forward and re-open checkout; no second cart/session should appear.
8. Confirm same-origin React uses WooCommerce cookie session + Store API `Nonce`; it must not rely on a separate persisted Cart-Token cart.
9. Confirm React does not render Stripe fields, wallet/payment iframes, or synthetic shipping/tax/final totals.

## Payment matrix — Stripe test mode

Test at minimum:

1. Successful card payment.
2. Declined card.
3. 3DS/SCA success.
4. 3DS/SCA cancellation/failure.
5. Retry after failed payment using the WooCommerce order-pay path.
6. Browser refresh during checkout without duplicate order/payment.
7. Double-click/repeated Place Order does not create duplicate orders.
8. Apple Pay eligible device/browser/wallet when enabled.
9. Apple Pay ineligible case hides cleanly.
10. Google Pay eligible case when enabled.
11. Google Pay ineligible case hides cleanly.
12. Link behavior when enabled.
13. Address/shipping-rate change immediately before payment recalculates the final Woo total and the read-only sheet `Total due` follows the authoritative update.
14. Coupon/tax/shipping final total exactly matches the amount processed by Stripe.
15. Open -> enter/select payment state -> close -> reopen without remounting or losing provider state.
16. Mobile viewport widths 320/375/390/430px plus orientation/keyboard transitions.
17. Simulate/observe a payment-provider load failure and confirm bounded recovery UI with no second payment authority.

## Order/payment contract checks

For a successful paid Stripe order confirm:

```text
_dtb_checkout_gateway = woo_native_stripe
_dtb_checkout_contract_version = woo-stripe-v1
_dtb_payment_provider = woocommerce_stripe
_dtb_payment_ref = non-empty non-secret transaction/payment reference
_dtb_payment_captured = 1
```

Confirm WooCommerce `date_paid` is present before DTB considers the order captured/fulfillable.

Confirm DTB never treats a SetupIntent, source ID, arbitrary `stripe_*` gateway prefix, redirect success, or browser response as captured-payment proof.

## Duplicate-side-effect and webhook replay matrix

For one successful paid order:

1. Re-deliver/replay the Stripe webhook where tooling permits.
2. Re-trigger Woo processing/completed transitions where safe in staging.
3. Confirm Veeqo dispatch occurs once.
4. Confirm QuickBooks create projection occurs once.
5. Confirm tracking/notification jobs are not duplicated.
6. Confirm the `dtb_order_processing_dispatch_{order_id}` barrier prevents duplicate initial downstream dispatch.
7. Confirm failed/unpaid/cancelled orders do not dispatch fulfillment/accounting.

## Refund matrix

Use actual WooCommerce refund records:

1. Create partial refund A and record its Woo `refund_id`.
2. Confirm QuickBooks refund projection uses only refund A's amount.
3. Create partial refund B.
4. Confirm refund B receives a different deterministic/refund-specific idempotency identity and is not suppressed by refund A.
5. Confirm replay of refund A does not create a second QuickBooks refund.
6. Test full refund after partial refunds where business rules permit.
7. Confirm parent order status does not cause a partial refund to be treated as cancellation.
8. Confirm Veeqo/fulfillment compensation behavior separately from accounting refund projection.

## Downstream checks

After captured payment:

- Veeqo receives/maps the exact Woo order SKUs/variation SKUs once;
- QuickBooks receives the eligible order projection once;
- customer/operator tracking projection updates;
- external calls occur asynchronously through `dtb-orders`, not during interactive checkout or Stripe webhook acknowledgement.

## Validation commands

Frontend:

```powershell
cd frontend
npm ci --include=dev
npm run lint
npm run build
```

Backend/source:

```powershell
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooNativeCheckoutRuntime.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/OfficialStripeNativeCheckout.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/MobilePaymentSheet.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/CheckoutPerformance.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Domain/PaymentState.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Payment/CheckoutPaymentLifecycle.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Payment/RefundLifecycle.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-integrations/OperationalPipeline/QuickBooksAccountingPipeline.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-integrations/OperationalPipeline/QuickBooksJobOverride.php
./scripts/smoke-dtb-mobile-payment-sheet.ps1
./scripts/smoke-dtb-checkout-performance.ps1
git diff --check
```

If a referenced smoke script is unavailable in the checked-out source, do not claim it passed; record the missing command as a validation gap.

## Go-live gate

Do not enable live payment acceptance until all of these are true:

- native Checkout Block visibly renders on production routing;
- official Stripe gateway is connected and healthy;
- Optimized Checkout/Accordion and Settings Sync are verified for the intended mobile experience;
- webhook health is confirmed for the active mode;
- mobile payment-sheet accessibility, keyboard, viewport, authoritative-total, close/reopen, and provider-challenge tests pass;
- mobile performance evidence is recorded, including LCP/CLS/blocking/server/third-party review with a real-cart staging flow;
- no unexplained checkout third-party scripts remain;
- checkout root/address/shipping rerenders do not wipe populated form state;
- payment-provider timeout recovery is verified and remains provider/Woo-safe;
- card/3DS/express eligibility tests pass in test mode;
- cart/session continuity passes from React to Woo checkout;
- duplicate order/payment/downstream tests pass;
- partial/multiple refund accounting tests pass;
- rollback artifact and operational recovery procedure are verified.

The mobile payment-sheet branding/presentation layer may ship only when the mechanical payment authority, performance/stability, and UI safety/accessibility gates above pass together. A visually polished or fast synthetic score is never allowed to bypass payment, idempotency, security, or provider-runtime verification.
