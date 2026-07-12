# Checkout Shipping Contract

Last verified against source: 2026-07-12.

## Authority and request flow

Drywall Toolbox owns checkout shipping policy. The current rates are calculated locally through the WooCommerce shipping runtime; they are not live Veeqo carrier quotes. Veeqo remains authoritative after order creation for allocation, fulfillment, labels, shipment execution, carrier, status, and tracking.

The storefront shipping flow is:

```text
WooCommerce Store API cart/session
  -> POST /dtb/v1/checkout/quote
  -> WooCommerce customer destination
  -> active matching WooCommerce shipping zone
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

WooCommerce calculates rates only from the first zone matching a package. A method configured only in Rest of World or another nonmatching zone is insufficient. Before checkout rates are calculated, DTB verifies that every active package's matching zone has an enabled DTB method instance. Missing instances are added idempotently and the WooCommerce package-rate session cache is invalidated.

A runtime repair writes only the missing method instance and records a WooCommerce log entry with source `dtb-checkout-shipping`. It does not change products, cart contents, taxes, orders, or external integrations.

## Rate DTO contract

Each public checkout rate contains:

- `id`: complete WooCommerce rate identifier, including method instance and rate key;
- `method_id`: `dtb_veeqo_rates`;
- `instance_id`: WooCommerce shipping-method instance;
- `name`: customer-facing method label;
- `price`: pre-tax shipping cost;
- `tax`: shipping tax;
- `total`: shipping cost plus shipping tax;
- `currency`: WooCommerce store currency.

`price` must remain pre-tax because finalization creates a WooCommerce shipping line and then runs WooCommerce tax calculation. Supplying tax-inclusive `price` would double-count shipping tax and cause the final order total to diverge from the authoritative quote.

## Selection and idempotency

A nonempty selected rate ID must match one of the rates returned by the current authoritative quote. The backend returns `dtb_checkout_shipping_rate_changed` with HTTP 409 when the selection is stale or unavailable; it never silently substitutes another rate.

While a new quote is being calculated, the React checkout invalidates the prior quote. Submission is allowed only when the visible selected rate equals `quote.selected_rate_id`. The exact selected rate is then persisted in the quote/session context and included in the checkout fingerprint.

This preserves checkout idempotency and prevents a visible express or overnight selection from producing an order with the previous/default rate.

## Deployment and verification

Deploy the updated frontend build and the two owning `dtb-commerce` PHP files together. Merge is not deployment.

After deployment:

1. Clear application/page caches but do not clear or recreate customer carts.
2. Add a purchasable product to the storefront cart.
3. Enter a complete US shipping address and confirm Standard, Express, and Overnight rates appear.
4. Select a nondefault rate and confirm the displayed shipping and total refresh before Place Order becomes usable.
5. Complete `/checkout/quote -> /session -> /confirm -> /finalize` and verify the WooCommerce order has one shipping line with the selected rate ID and pre-tax cost.
6. Verify order total equals the final quote within the checkout tolerance and payment handoff is returned.
7. Inspect WooCommerce logs for source `dtb-checkout-shipping`; a repair warning is expected only when a matching zone was missing the DTB method.
8. Verify the order continues through the `dtb-orders` queue without duplicate Veeqo, QuickBooks, notification, or tracking side effects.

Rollback consists of reverting the code deployment. Shipping method instances created during repair are safe to leave in place; removing them during rollback is optional and should be done only through WooCommerce Shipping Zones after confirming another valid method covers each destination.
