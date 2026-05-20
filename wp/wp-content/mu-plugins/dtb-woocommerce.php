<?php
/**
 * Legacy shim. Real implementation moved to dtb-commerce/Legacy/dtb-woocommerce.php.
 * Remove after deployment verification window.
 */
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-commerce/Legacy/dtb-woocommerce.php' );
	return;
}

$legacy_path = __DIR__ . '/dtb-commerce/Legacy/dtb-woocommerce.php';
if ( file_exists( $legacy_path ) ) {
	require_once $legacy_path;
}
