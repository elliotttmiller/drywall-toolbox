<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_woo_find_product_by_sku( string $sku ): ?int {
	$pid = wc_get_product_id_by_sku( $sku );
	return $pid > 0 ? (int) $pid : null;
}
