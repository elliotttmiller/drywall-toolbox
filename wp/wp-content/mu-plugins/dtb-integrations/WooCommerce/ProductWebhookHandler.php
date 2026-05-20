<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_woo_product_webhook_payload( WC_Product $product ): array {
	if ( function_exists( 'dtb_wc_product_webhook_payload' ) ) {
		return (array) dtb_wc_product_webhook_payload( $product );
	}
	return [];
}
