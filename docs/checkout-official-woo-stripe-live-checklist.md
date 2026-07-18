# WooPayments Embedded Checkout Checklist

## Required plugin authority

Use one storefront checkout payment authority only:

```text
WooCommerce Checkout Block or [woocommerce_checkout]
+ WooPayments
+ DTB checkout shell/styling only
```

Do not enable the official WooCommerce Stripe Gateway, Payment Plugins for Stripe, DTB Stripe Embedded Checkout, same-shell custom payment iframes, copied gateway internals, or custom Stripe Checkout Sessions as storefront checkout authorities while WooPayments is active.

## wp-admin configuration

1. Install and activate WooPayments.
2. Go to `WooCommerce -> Settings -> Payments -> WooPayments`.
3. Connect the intended WooPayments account through the plugin connection flow.
4. Enable WooPayments for checkout.
5. Enable the desired card, wallet, WooPay, Link, and express checkout methods.
6. Confirm WooPayments account/webhook health in WooCommerce status tools.
7. Verify Apple Pay / Google Pay domain and browser/device eligibility where used.
8. Disable official WooCommerce Stripe Gateway and any competing card/wallet gateway.
9. Confirm the WooCommerce Checkout page is assigned under `WooCommerce -> Settings -> Advanced -> Page setup`.
10. Keep the Checkout page content as either the WooCommerce Checkout Block or `[woocommerce_checkout]`.

## Server deployment checks

After deployment, confirm these return JSON:

```text
https://drywalltoolbox.com/wp-json/
https://drywalltoolbox.com/wp-json/dtb/v1/catalog/products?per_page=1
https://drywalltoolbox.com/wp/wp-json/dtb/v1/catalog/products?per_page=1
```

Confirm this renders the DTB WooPayments checkout shell and visible Woo checkout form, not the React SPA shell or a blank document:

```text
https://drywalltoolbox.com/checkout/
```

Confirm these WordPress routes are not rewritten to React:

```text
https://drywalltoolbox.com/checkout/order-pay/{order_id}/?pay_for_order=true&key=wc_order_...
https://drywalltoolbox.com/?wc-api=...
```

## Runtime tests

Run in WooPayments test/sandbox mode before live mode:

1. Add a real SKU-backed product to cart.
2. Proceed from React cart/sidebar to `/checkout/`.
3. Confirm the DTB shell source contains `dtb-checkout-contract: woo-payments-v1`.
4. Confirm customer/contact fields render.
5. Confirm shipping address fields render.
6. Confirm order summary renders.
7. Confirm WooPayments embedded payment methods render.
8. Test successful card payment.
9. Test 3DS/SCA challenge flow.
10. Test failed card flow.
11. Test Apple Pay / Google Pay / WooPay / Link only on eligible devices and browsers.
12. Confirm ineligible wallet devices hide wallet controls cleanly.
13. Confirm Woo order is created once.
14. Confirm Woo order has real product/variation IDs and SKUs.
15. Confirm `_dtb_checkout_gateway=woo_native_woopayments` is present on the order.
16. Confirm `_dtb_checkout_contract_version=woo-payments-v1` is present on the order.
17. Confirm paid WooPayments order records DTB payment lifecycle events once.
18. Confirm `dtb-orders` downstream processing is dispatched once.
19. Confirm Veeqo receives/maps the Woo order by SKU in the intended environment.
20. Confirm refund and failure events update Woo order state/notes as expected.
21. Confirm QuickBooks projection eligibility after the qualifying Woo payment/refund event.

## Rollback

If checkout fails after deploy:

1. Disable checkout traffic or place site in maintenance mode.
2. Confirm `/wp-json/` and `/wp/wp-json/` status.
3. Check PHP fatal logs first.
4. Roll back `drywalltoolbox/wp/wp-content/mu-plugins/`, frontend `dist/`, and `.htaccess` to the previous deploy artifact if REST is returning HTML, checkout is blank, or WordPress reports critical errors.
5. Clear any server cache that may be serving old `index.html`, stale CSS, stale PHP opcode, or stale `.htaccess` behavior.
