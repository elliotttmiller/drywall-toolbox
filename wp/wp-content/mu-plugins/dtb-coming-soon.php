<?php
/**
 * Legacy shim. Real implementation moved to dtb-marketing/Legacy/dtb-coming-soon.php.
 * Remove after deployment verification window.
 */
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-marketing/Legacy/dtb-coming-soon.php' );
	return;
}

$legacy_path = __DIR__ . '/dtb-marketing/Legacy/dtb-coming-soon.php';
if ( file_exists( $legacy_path ) ) {
	require_once $legacy_path;
}
