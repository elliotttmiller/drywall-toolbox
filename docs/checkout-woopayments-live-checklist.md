# WooPayments Embedded Checkout Checklist

## Required plugin authority

Use one storefront checkout payment authority only:

```text
WooCommerce Checkout Block or [woocommerce_checkout]
+ WooPayments
+ DTB checkout shell/styling and provider-owned express surface placement
```

Do not enable the official WooCommerce Stripe Gateway, Payment Plugins for Stripe, DTB Stripe Embedded Checkout, same-shell custom payment iframes, copied gateway internals, fake wallet buttons, or custom Stripe Checkout Sessions as storefront checkout authorities while WooPayments is active.

## wp-admin configuration

1. Install and activate WooPayments.
2. Go to `WooCommerce -> Settings -> Payments -> WooPayments`.
3. Connect the intended WooPayments account through the plugin connection flow.
4. Enable WooPayments for checkout.
5. Enable the desired card, wallet, WooPay, Link, and express checkout methods.
6. Enable cart and product locations for express checkout where WooPayments supports those locations.
7. Confirm WooPayments account/webhook health in WooCommerce status tools.
8. Verify Apple Pay / Google Pay domain and browser/device eligibility where used.
9. Disable official WooCommerce Stripe Gateway and any competing card/wallet gateway.
10. Confirm the WooCommerce Checkout page is assigned under `WooCommerce -> Settings -> Advanced -> Page setup`.
11. Keep the Checkout page content as either the WooCommerce Checkout Block or `[woocommerce_checkout]`.

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

Confirm these return noindex same-origin express surfaces and do not expose secrets:

```text
https://drywalltoolbox.com/checkout/?dtb_wcpay_express_surface=1&dtb_context=cart
https://drywalltoolbox.com/checkout/?dtb_wcpay_express_surface=1&dtb_context=product&product_id={woo_product_id}&quantity=1
```

Confirm the optional WooCommerce frontend tracking script is not emitted on DTB checkout shells if it would crash checkout initialization:

```text
frontend-tracks.js should be absent from /checkout/?dtb_woo_checkout=1 when it throws Cannot read properties of undefined (reading 'url')
```

Confirm these WordPress routes are not rewritten to React:

```text
https://drywalltoolbox.com/checkout/order-pay/{order_id}/?pay_for_order=true&key=wc_order_...
https://drywalltoolbox.com/?wc-api=...
```

## Runtime tests

Run in WooPayments test/sandbox mode before live mode:

1. Add a real SKU-backed product to cart.
2. Confirm full cart renders provider-owned express checkout when eligible.
3. Confirm cart side drawer renders provider-owned express checkout when eligible.
4. Confirm desktop cart drawer express checkout is aligned to the drawer, not floating detached over the page.
5. Confirm mobile cart drawer uses the safe-area-aware bottom checkout dock without horizontal overflow.
6. Confirm product detail page renders provider-owned express checkout when eligible.
7. Confirm product detail modal renders provider-owned express checkout when eligible.
8. Confirm product express surface requests `/checkout/?dtb_wcpay_express_surface=1&dtb_context=product&product_id=...`, not the React staging route.
9. Confirm product express surface renders inside a WooCommerce add-to-cart form context.
10. Confirm product/variable-product ineligible states hide express controls without hiding normal add-to-cart.
11. Confirm `/checkout/?dtb_wcpay_express_surface=1&dtb_context=cart` posts ready or unavailable state to the parent only from same origin.
12. Proceed from React cart/sidebar to `/checkout/`.
13. Confirm the DTB shell source contains `dtb-checkout-contract: woo-payments-v1`.
14. Confirm customer/contact, shipping, order summary, WooPayments embedded payment, and place-order sections render.
15. Test successful card payment, 3DS/SCA, failed card, eligible wallets, ineligible wallets, and retry.
16. Confirm Woo order is created once with real product/variation IDs and SKUs.
17. Confirm `_dtb_checkout_gateway=woo_native_woopayments` and `_dtb_checkout_contract_version=woo-payments-v1` are present on the order.
18. Confirm paid WooPayments order records DTB payment lifecycle events once.
19. Confirm `dtb-orders` downstream processing is dispatched once.
20. Confirm Veeqo receives/maps the Woo order by SKU in the intended environment.
21. Confirm refund and failure events update Woo order state/notes as expected.
22. Confirm QuickBooks projection eligibility after the qualifying Woo payment/refund event.

## Validation commands

Frontend:

```powershell
cd frontend
npm ci --include=dev
npm run lint
npm run build
```

Backend:

```powershell
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooFrontendTracksGuard.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooPaymentsNativeCheckout.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/WooPaymentsExpressCheckoutSurface.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Domain/PaymentState.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/bootstrap.php
.\scripts\smoke-dtb-mu-modules.ps1
git diff --check
```

## Rollback

If checkout fails after deploy:

1. Disable checkout traffic or place site in maintenance mode.
2. Confirm `/wp-json/` and `/wp/wp-json/` status.
3. Check PHP fatal logs first.
4. Roll back `drywalltoolbox/wp/wp-content/mu-plugins/`, frontend `dist/`, and `.htaccess` to the previous deploy artifact if REST is returning HTML, checkout is blank, express surfaces break navigation, or WordPress reports critical errors.
5. Clear any server cache that may be serving old `index.html`, stale CSS, stale PHP opcode, or stale `.htaccess` behavior.
