# Checkout Shipping Contract

Last verified against source: 2026-07-12.

## Authority and request flow

Drywall Toolbox owns checkout shipping policy. The current rates are calculated locally through the WooCommerce shipping runtime; they are not live Veeqo carrier quotes. Veeqo remains authoritative after order creation for allocation, fulfillment, labels, shipment execution, carrier, status, and tracking.

The storefront shipping flow is:

```text
WooCommerce Store API cart/session
  -> POST /dtb/v1/checkout/quote
  -> WooCommerce customer destination
  -> active matching WooCommerce shipping package
  -> DTB shipping policy rates
  -> selected rate bound into the checkout quote
  -> POST /dtb/v1/checkout/session
  -> /checkout/confirm
  -> /checkout/finalize
  -> WooCommerce order shipping line and tax calculation
```

The compatibility endpoint `POST /dtb/v1/veeqo/shipping-rates` delegates to the same WooCommerce cart and DTB policy calculation. It must not be described as live Veeqo rating.

## Shipping method and zone contract

The WooCommerce method ID is `dtb_veeqo_rates`. The shipping-zone bootstrap is versioned through `DTB_SHIPPING_ZONE_BOOTSTRAP_VERSION` so deployments can repair earlier incomplete setup.

WooCommerce normally calculates rates from the first zone matching a package. A method configured only in Rest of World or another nonmatching zone is insufficient. The versioned bootstrap repairs existing US-related zones and Rest of World without relying on browser input.

Interactive public quote requests remain read-only. If the active matching zone has no DTB instance, the `woocommerce_package_rates` fallback calculates the same DTB policy rates in memory through `DTB_Shipping_Method::get_rates_for_package()`. It does not add, enable, disable, or reorder shipping-zone methods. An existing disabled DTB instance is treated as explicit operator intent: no duplicate instance is created and the fallback does not bypass the disabled state.

WooCommerce's `shipping_for_package_*` session cache is invalidated after a destination change so rates are recalculated against the current address instead of a previous package result.

## Rate DTO contract

Each public checkout rate contains:

- `id`: complete WooCommerce rate identifier, including method instance and rate key when an instance exists;
- `method_id`: `dtb_veeqo_rates`;
- `instance_id`: WooCommerce shipping-method instance, or `0` for the read-only in-memory fallback;
- `name`: customer-facing method label;
- `price`: pre-tax shipping cost;
- `tax`: shipping tax;
- `total`: shipping cost plus shipping tax;
- `currency`: WooCommerce store currency.

`price` must remain pre-tax because finalization creates a WooCommerce shipping line and then runs WooCommerce tax calculation. Supplying tax-inclusive `price` would double-count shipping tax and cause the final order total to diverge from the authoritative quote.

## Selection and idempotency

A nonempty selected rate ID must match one of the rates returned by the current authoritative quote. The backend returns `dtb_checkout_shipping_rate_changed` with HTTP 409 when the selection is stale or unavailable; it never silently substitutes another rate.

When that specific conflict occurs during quote refresh, the frontend performs one recovery quote without a preferred rate so the server can return the current valid rate set and default selection. Other 409 responses are not retried. This avoids a stale local rate ID trapping checkout in a permanent quote-failure loop.

While a new quote is being calculated, the React checkout invalidates the prior quote and prior rates. Submission is allowed only when the visible selected rate equals `quote.selected_rate_id`. The exact selected rate is then persisted in the quote/session context and included in the checkout fingerprint.

This preserves checkout idempotency and prevents a visible express or overnight selection from producing an order with the previous/default rate.

## Deployment and verification

Deploy the updated frontend build and the two owning `dtb-commerce` PHP files together. Merge is not deployment.

After deployment:

1. Clear application/page caches but do not clear or recreate customer carts.
2. Add a purchasable product to the storefront cart.
3. Enter a complete US shipping address and confirm Standard, Express, and Overnight rates appear.
4. Select a nondefault rate and confirm the displayed shipping and total refresh before Place Order becomes usable.
5. Change the address or shipping-zone match and confirm a stale selection recovers to the current valid rate set without looping.
6. Complete `/checkout/quote -> /session -> /confirm -> /finalize` and verify the WooCommerce order has one shipping line with the selected rate ID and pre-tax cost.
7. Verify order total equals the final quote within the checkout tolerance and payment handoff is returned.
8. Confirm a zone missing the persisted DTB method still receives rates without any shipping-zone database mutation during the quote request; confirm a deliberately disabled instance remains disabled.
9. Verify the order continues through the `dtb-orders` queue without duplicate Veeqo, QuickBooks, notification, or tracking side effects.

Rollback consists of reverting the code deployment. Shipping method instances created by the versioned bootstrap are safe to leave in place; removing them during rollback is optional and should be done only through WooCommerce Shipping Zones after confirming another valid method covers each destination.
