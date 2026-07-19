# Official WooCommerce Stripe Checkout Production Checklist

Last verified against source: 2026-07-19.

## Required authority

Use one storefront checkout/payment authority chain only:

```text
WooCommerce Store API cart/session
+ assigned WooCommerce Checkout page with Checkout Block
+ official WooCommerce Stripe Payment Gateway
+ DTB routing/readiness/order-observation/downstream queue
```

Do not enable WooPayments, Payment Plugins for Stripe, custom Stripe Checkout Sessions, React Stripe Elements, fake wallet buttons, copied gateway internals, or DTB payment/express iframes as parallel storefront authorities.

## Plugin and Stripe account configuration

1. Install and activate the official WooCommerce Stripe Payment Gateway.
2. Open `WooCommerce -> Settings -> Payments -> Stripe`.
3. Connect the intended Stripe account using the official extension flow.
4. Verify test mode before any staging payment and live mode only at launch cutover.
5. Enable only intended card/local/express methods.
6. Prefer automatic capture for launch. If manual capture is enabled, verify that authorization-only/on-hold orders do not dispatch fulfillment/accounting until captured.
7. Verify Stripe webhook health for the intended mode. The official gateway callback must remain reachable through WooCommerce `wc-api` routing.
8. Verify HTTPS for the entire public site.
9. For Apple Pay/Google Pay, verify Stripe payment-method domain registration and Apple Pay domain association.
10. Disable WooPayments and other competing storefront card/wallet gateways.

## WooCommerce checkout configuration

1. Confirm the Checkout page is assigned under `WooCommerce -> Settings -> Advanced`.
2. Confirm its content contains the WooCommerce Checkout Block.
3. Confirm `/checkout/` returns a WordPress/WooCommerce document, not React `index.html`.
4. Confirm Checkout Block and official Stripe scripts/styles are present and not stripped by the headless theme.
5. Confirm `GET /wp-json/dtb/v1/checkout/capabilities` reports:
   - `checkout=woo_native_checkout_block`;
   - `provider=woocommerce_stripe`;
   - official Stripe extension active;
   - official Stripe gateway enabled;
   - Checkout Block present;
   - HTTPS true;
   - no competing WooPayments authority.

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
2. Change quantity and immediately click checkout from the full cart; Checkout Block must show the final quantity.
3. Repeat from the cart drawer; pending/debounced Store API mutations must settle before navigation.
4. Add a variable product and confirm the exact variation ID/SKU/quantity reaches Checkout Block.
5. Reload the React cart, then navigate to checkout; cart must remain identical.
6. Use browser back/forward and re-open checkout; no second cart/session should appear.
7. Confirm same-origin React uses WooCommerce cookie session + Store API `Nonce`; it must not rely on a separate persisted Cart-Token cart.
8. Confirm React does not render Stripe fields, wallet/payment iframes, or synthetic shipping/tax/final totals.

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
13. Address/shipping-rate change immediately before payment recalculates the final Woo total.
14. Coupon/tax/shipping final total exactly matches the amount processed by Stripe.

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
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Domain/PaymentState.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Payment/CheckoutPaymentLifecycle.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Payment/RefundLifecycle.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-integrations/OperationalPipeline/QuickBooksAccountingPipeline.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-integrations/OperationalPipeline/QuickBooksJobOverride.php
git diff --check
```

If a referenced smoke script is unavailable in the checked-out source, do not claim it passed; record the missing command as a validation gap.

## Go-live gate

Do not enable live payment acceptance until all of these are true:

- native Checkout Block visibly renders on production routing;
- official Stripe gateway is connected and healthy;
- webhook health is confirmed;
- card/3DS/express eligibility tests pass in test mode;
- cart/session continuity passes from React to Woo checkout;
- duplicate order/payment/downstream tests pass;
- partial/multiple refund accounting tests pass;
- rollback artifact and operational recovery procedure are verified.

UI redesign/branding is explicitly after this mechanical gate.
