# Official Stripe Embedded Checkout Checklist

## Required plugin authority

Use one storefront checkout payment authority only:

```text
WooCommerce Checkout Block
+ official WooCommerce Stripe Payment Gateway
+ DTB checkout styling/readiness diagnostics/order observation
```

Do not enable WooPayments, Payment Plugins for Stripe, DTB Stripe Embedded Checkout, same-shell custom payment iframes, copied gateway internals, fake wallet buttons, custom Stripe Checkout Sessions, or DTB express iframe surfaces as storefront checkout authorities while the official WooCommerce Stripe Payment Gateway is active.

## wp-admin configuration

1. Install and activate the official WooCommerce Stripe Payment Gateway.
2. Go to `WooCommerce -> Settings -> Payments -> Stripe`.
3. Connect the intended Stripe account through the official gateway connection flow.
4. Enable Stripe for checkout.
5. Enable the desired card, Link, and express checkout/payment methods supported by the gateway.
6. Confirm Stripe account/webhook health in WooCommerce status tools and Stripe dashboard.
7. Verify Apple Pay / Google Pay domain and browser/device eligibility where used.
8. Disable WooPayments and any competing card/wallet gateway.
9. Confirm the WooCommerce Checkout page is assigned under `WooCommerce -> Settings -> Advanced -> Page setup`.
10. Keep the Checkout page content as the WooCommerce Checkout Block.

## Server deployment checks

After deployment, confirm these return JSON:

```text
https://drywalltoolbox.com/wp-json/
https://drywalltoolbox.com/wp-json/dtb/v1/catalog/products?per_page=1
https://drywalltoolbox.com/wp/wp-json/dtb/v1/catalog/products?per_page=1
```

Confirm this renders the assigned WooCommerce Checkout page with a visible Checkout Block, not the React SPA shell or a blank document:

```text
https://drywalltoolbox.com/checkout/
```

Confirm these WordPress routes are not rewritten to React:

```text
https://drywalltoolbox.com/checkout/order-pay/{order_id}/?pay_for_order=true&key=wc_order_...
https://drywalltoolbox.com/?wc-api=...
```

Confirm retired custom checkout/express routes are absent or inert:

```text
/checkout/?dtb_wcpay_express_surface=1
/checkout/?dtb_woo_checkout=1 should still render the native checkout page, not a standalone DTB document
```

## Runtime tests

Run in Stripe test mode before live mode:

1. Add a real SKU-backed product to cart.
2. Confirm React full cart renders checkout CTA only, with no payment iframe.
3. Confirm cart side drawer renders checkout CTA only, with no payment iframe.
4. Confirm desktop cart drawer checkout dock is aligned to the drawer, not floating detached over the page.
5. Confirm mobile cart drawer uses the safe-area-aware bottom checkout dock without horizontal overflow.
6. Confirm product detail page and product modal do not mount wallet/payment iframes.
7. Proceed from React cart/sidebar to `/checkout/`.
8. Confirm customer/contact, shipping, order summary, official Stripe embedded payment, Link, eligible wallet controls, and place-order sections render in the Woo Checkout Block.
9. Test successful card payment, 3DS/SCA, failed card, eligible wallets, ineligible wallets, and retry.
10. Confirm Woo order is created once with real product/variation IDs and SKUs.
11. Confirm `_dtb_checkout_gateway=woo_native_stripe` and `_dtb_checkout_contract_version=woo-stripe-v1` are present on the order.
12. Confirm paid official Stripe order records DTB payment lifecycle events once.
13. Confirm `dtb-orders` downstream processing is dispatched once.
14. Confirm Veeqo receives/maps the Woo order by SKU in the intended environment.
15. Confirm refund and failure events update Woo order state/notes as expected.
16. Confirm QuickBooks projection eligibility after the qualifying Woo payment/refund event.

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
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/OfficialStripeNativeCheckout.php
php -l drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Validation/CheckoutValidator.php
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
4. Roll back `drywalltoolbox/wp/wp-content/mu-plugins/`, frontend `dist/`, and `.htaccess` to the previous deploy artifact if REST is returning HTML, checkout is blank, payment UI does not render, or WordPress reports critical errors.
5. Clear any server cache that may be serving old `index.html`, stale CSS, stale PHP opcode, or stale `.htaccess` behavior.
