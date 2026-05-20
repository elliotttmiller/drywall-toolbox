<?php
/**
 * Legacy shim. Real implementation moved to dtb-integrations/Legacy/dtb-veeqo.php.
 * Remove after deployment verification window.
 */
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-integrations/Legacy/dtb-veeqo.php' );
	return;
}

$legacy_path = __DIR__ . '/dtb-integrations/Legacy/dtb-veeqo.php';
if ( file_exists( $legacy_path ) ) {
	require_once $legacy_path;
}
