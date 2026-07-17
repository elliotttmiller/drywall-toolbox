# Deployment Cleanup: Retired Stripe Embedded Checkout Bridge

This branch removes the DTB Stripe Embedded Checkout bridge from the active codebase and restores WooCommerce Checkout Block + official WooCommerce Stripe Payment Gateway as the checkout/payment authority.

## Remove stale live files

If the Stripe Embedded Checkout branch was deployed manually, remove these files from the live server after deploying this branch:

```text
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/StripeEmbeddedCheckoutConfig.php
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/StripeApiClient.php
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Payment/StripeEmbeddedCheckoutBridge.php
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Rest/StripeEmbeddedCheckoutRestController.php
drywalltoolbox/wp/wp-content/mu-plugins/dtb-commerce/Rest/StripeEmbeddedCheckoutWebhookController.php
drywalltoolbox/wp/wp-content/mu-plugins/dtb-order-platform/Application/StripeEmbeddedCheckoutOrderMaterializer.php
```

Also remove retired frontend artifacts from the deployed build by deploying a fresh `frontend/dist` payload rather than copying individual files over an old build.

## Why this matters

WordPress loads must-use plugins on every REST request. A partial FTP overlay can leave deleted PHP files on the server or omit newly required files. Either condition can cause `/wp-json/*` to return WordPress critical-error HTML instead of JSON, which breaks login, product catalog, cart, and checkout together.

Use the CI/deploy artifact or a clean mirror upload. Do not manually overlay only changed files for this checkout migration.
