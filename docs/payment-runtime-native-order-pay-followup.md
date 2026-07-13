# Native order-pay shortcode fallback

Follow-up to PR #445: the generic WordPress page template can return a blank 200 response for `/checkout/order-pay/{id}/?...` in the headless deployment. Native mode therefore now renders a minimal WooCommerce document shell that executes `[woocommerce_checkout]`, preserving WooCommerce's official order-pay/payment gateway runtime without the incomplete DTB custom UI.
