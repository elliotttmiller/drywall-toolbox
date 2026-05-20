<?php
/**
 * Legacy shim. Real implementation moved to dtb-media/Legacy/dtb-image-sync.php.
 * Remove after deployment verification window.
 */
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-media/Legacy/dtb-image-sync.php' );
	return;
}

$legacy_path = __DIR__ . '/dtb-media/Legacy/dtb-image-sync.php';
if ( file_exists( $legacy_path ) ) {
	require_once $legacy_path;
}
