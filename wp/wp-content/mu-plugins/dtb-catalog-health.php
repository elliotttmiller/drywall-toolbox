<?php
/**
 * Legacy shim. Real implementation moved to dtb-catalog-platform/Legacy/dtb-catalog-health.php.
 * Remove after deployment verification window.
 */
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-catalog-platform/Legacy/dtb-catalog-health.php' );
	return;
}

$legacy_path = __DIR__ . '/dtb-catalog-platform/Legacy/dtb-catalog-health.php';
if ( file_exists( $legacy_path ) ) {
	require_once $legacy_path;
}
