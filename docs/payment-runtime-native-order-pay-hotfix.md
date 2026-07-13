# Native WooCommerce order-pay hotfix

The root `/checkout/order-pay/{id}/?pay_for_order=true&key=...` route can return HTTP 200 with a blank page if DTB restores the generic WordPress page template instead of explicitly rendering WooCommerce's checkout/order-pay shortcode.

The payment-runtime native mode now uses `dtb-platform/Templates/WooNativeOrderPayRuntime.php`, a minimal document shell that calls `[woocommerce_checkout]` after priming the Woo order-pay query vars. This preserves WooCommerce and gateway-owned payment scripts while avoiding the incomplete DTB custom runtime UI.

Custom DTB order-pay UI remains disabled by default. Re-enable only after a complete responsive rebuild and gateway validation:

```php
define( 'DTB_PAYMENT_RUNTIME_CUSTOM_TEMPLATE_ENABLED', true );
```

Deploy both files together:

- `drywalltoolbox/wp/wp-content/mu-plugins/zzzz-dtb-payment-runtime-native-template-toggle.php`
- `drywalltoolbox/wp/wp-content/mu-plugins/dtb-platform/Templates/WooNativeOrderPayRuntime.php`
