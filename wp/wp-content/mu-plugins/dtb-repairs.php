<?php
/**
 * Legacy shim. Real implementation moved to dtb-repair-service/Legacy/dtb-repairs.php.
 * Remove after deployment verification window.
 */
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-repair-service/Legacy/dtb-repairs.php' );
	return;
}

$legacy_path = __DIR__ . '/dtb-repair-service/Legacy/dtb-repairs.php';
if ( file_exists( $legacy_path ) ) {
	require_once $legacy_path;
}
