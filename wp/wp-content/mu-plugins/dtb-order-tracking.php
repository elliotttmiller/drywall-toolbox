<?php
/**
 * Legacy shim. Real implementation moved to dtb-order-platform/Legacy/dtb-order-tracking.php.
 * Remove after deployment verification window.
 */
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-order-platform/Legacy/dtb-order-tracking.php' );
	return;
}

$legacy_path = __DIR__ . '/dtb-order-platform/Legacy/dtb-order-tracking.php';
if ( file_exists( $legacy_path ) ) {
	require_once $legacy_path;
}
