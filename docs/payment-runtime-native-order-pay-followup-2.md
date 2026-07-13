# Native order-pay follow-up

The headless deployment cannot rely on a generic WordPress page template for `/checkout/order-pay/{id}/?...`; it can return a blank HTTP 200 page. Native order-pay mode must render a minimal document wrapper that calls `[woocommerce_checkout]` after the order-pay query vars are primed.
