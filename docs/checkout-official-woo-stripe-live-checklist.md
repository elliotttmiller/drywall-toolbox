# Official WooCommerce Stripe Live Checkout Checklist

## Required plugin authority

Use one checkout payment authority only:

```text
WooCommerce Checkout Block
+ official WooCommerce Stripe Payment Gateway
+ Optimized Checkout Suite
```

Do not enable Payment Plugins for Stripe, DTB Stripe Embedded Checkout, same-shell payment iframes, copied gateway internals, or custom Stripe Checkout Sessions as the storefront `/checkout` authority.

## wp-admin configuration

1. Install and activate the official WooCommerce Stripe Payment Gateway.
2. Go to `WooCommerce -> Settings -> Payments -> Stripe`.
3. Connect the intended Stripe account through the plugin connection flow.
4. Enable Stripe for checkout.
5. Enable Optimized Checkout Suite where available.
6. Select the desired Optimized Checkout Suite layout, normally Accordion for mobile-first checkout.
7. Confirm live webhook status is configured.
8. Confirm test webhook status is configured before sandbox testing.
9. Verify Apple Pay / wallet domain association.
10. Disable competing Stripe gateways and duplicate express-checkout buttons.

## Server deployment checks

After deployment, confirm these return JSON:

```text
https://drywalltoolbox.com/wp-json/
https://drywalltoolbox.com/wp-json/dtb/v1/catalog/products?per_page=1
https://drywalltoolbox.com/wp/wp-json/dtb/v1/catalog/products?per_page=1
```

Confirm this renders WooCommerce checkout, not the React SPA shell:

```text
https://drywalltoolbox.com/checkout/
```

Confirm these WordPress routes are not rewritten to React:

```text
https://drywalltoolbox.com/checkout/order-pay/{order_id}/?pay_for_order=true&key=wc_order_...
https://drywalltoolbox.com/?wc-api=wc_stripe
```

## Runtime tests

Run in Stripe test mode before live mode:

1. Add a real SKU-backed product to cart.
2. Proceed from React cart/sidebar to `/checkout/`.
3. Confirm Woo Checkout Block renders inside the DTB-branded checkout shell.
4. Confirm official Stripe payment methods render.
5. Test successful card payment.
6. Test 3DS challenge flow.
7. Test failed card flow.
8. Test wallet/Link flow if enabled.
9. Confirm Woo order is created once.
10. Confirm Woo order has real product/variation IDs and SKUs.
11. Confirm `_dtb_checkout_gateway=woo_native_stripe` is present on the order.
12. Confirm paid Stripe order records DTB payment lifecycle events.
13. Confirm `dtb-orders` downstream processing is dispatched once.
14. Confirm Veeqo receives/maps the Woo order by SKU.
15. Confirm refund and dispute events from the official Stripe plugin update Woo order state/notes as expected.
16. Confirm QuickBooks projection eligibility after the qualifying Woo payment/refund event.

## Rollback

If checkout fails after deploy:

1. Disable checkout traffic or place site in maintenance mode.
2. Confirm `/wp-json/` and `/wp/wp-json/` status.
3. Check PHP fatal logs first.
4. Roll back `drywalltoolbox/wp/wp-content/mu-plugins/` and `.htaccess` to the previous deploy artifact if REST is returning HTML/critical-error pages.
5. Clear any server cache that may be serving old `index.html` or stale `.htaccess` behavior.
