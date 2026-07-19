# Checkout Shipping Contract

Last verified against source: 2026-07-19.

## Authority and request flow

Drywall Toolbox owns checkout shipping policy. Current rates are calculated locally through the WooCommerce shipping runtime; they are not live Veeqo carrier quotes. Veeqo remains authoritative after order creation for allocation, fulfillment, labels, shipment execution, carrier, status, and tracking.

The production storefront flow is:

```text
React Store API cart using the WooCommerce same-origin cookie session
  -> full-document navigation to /checkout/
  -> WooCommerce Checkout Block hydrates the same cart/session
  -> customer delivery address updates WooCommerce customer/package context
  -> WooCommerce selects the active matching shipping zone/package
  -> DTB shipping method contributes policy rates
  -> customer selects a WooCommerce rate
  -> WooCommerce recalculates shipping/tax/order totals
  -> Checkout Block submits the authoritative order
  -> official WooCommerce Stripe Payment Gateway processes payment
```

There is no active `/dtb/v1/checkout/quote -> /session -> /confirm -> /finalize` storefront order-creation pipeline. Historical documentation or code comments describing that flow are superseded by the native Checkout Block architecture.

The compatibility endpoint `POST /dtb/v1/veeqo/shipping-rates`, where still retained for non-checkout consumers, delegates to WooCommerce/DTB policy calculation. It must never be described as live Veeqo carrier rating.

## Shipping method and zone contract

The WooCommerce method ID is `dtb_veeqo_rates`. The shipping-zone bootstrap is versioned through `DTB_SHIPPING_ZONE_BOOTSTRAP_VERSION` so deployments can repair earlier incomplete setup.

WooCommerce calculates rates from the matching shipping zone/package. A method configured only in a nonmatching zone is insufficient. Existing operator-disabled instances remain disabled and must not be silently re-enabled by public checkout traffic.

WooCommerce shipping package cache must be invalidated when destination context changes so the current address produces current rates.

## Rate correctness

A checkout shipping rate must remain a WooCommerce-owned rate with:

- a stable complete rate identifier;
- method ID `dtb_veeqo_rates`;
- the configured WooCommerce method instance where applicable;
- customer-facing label;
- pre-tax shipping cost;
- WooCommerce-calculated shipping tax;
- store currency.

Do not send a tax-inclusive shipping cost into a line that WooCommerce will tax again.

## Cart and checkout presentation

React cart UI must not fabricate shipping cost, tax, discounts, free-shipping thresholds, or an estimated grand total that differs from WooCommerce.

Before checkout, React may display the authoritative Store API merchandise subtotal and state that shipping, discounts, and taxes are calculated at checkout. Once `/checkout/` loads, WooCommerce Checkout Block is the sole authority for the displayed shipping choices and totals.

## Selection, concurrency, and idempotency

- The customer-visible selected shipping rate must be the rate WooCommerce applies to the active package.
- Address/rate changes must finish recalculation before payment submission.
- A stale or unavailable rate must produce a visible validation/recalculation state, not silent substitution by React.
- No external Veeqo or QuickBooks call occurs synchronously while calculating checkout shipping.
- The Woo order shipping line produced by checkout is the downstream source for fulfillment/accounting projections.

## Verification

After deployment:

1. Add a real SKU-backed product through the React storefront.
2. Change quantity and immediately continue to checkout; verify the Checkout Block sees the final quantity.
3. Enter multiple supported US destinations and verify the expected DTB WooCommerce shipping rates.
4. Change destination after selecting a rate and verify rates/totals recalculate without stale selection leakage.
5. Confirm the final Woo order contains exactly the selected shipping line and Woo-calculated tax/totals.
6. Confirm the official Stripe charge/payment amount matches the final Woo order total.
7. Confirm no React-estimated shipping or tax value is used as an order/payment authority.
8. Confirm post-payment Veeqo/QuickBooks jobs dispatch once and not during interactive rate calculation.
