<?php
/**
 * Legacy shim. Real implementation moved to dtb-platform/Legacy/dtb-auth.php.
 * Remove after deployment verification window.
 */
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-platform/Legacy/dtb-auth.php' );
	return;
}

$legacy_path = __DIR__ . '/dtb-platform/Legacy/dtb-auth.php';
if ( file_exists( $legacy_path ) ) {
	require_once $legacy_path;
}
