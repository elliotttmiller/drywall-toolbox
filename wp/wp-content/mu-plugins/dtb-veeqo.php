<?php
/**
 * Backward-compatible entrypoint shim.
 * Real implementation loads from dtb-integrations/Veeqo/VeeqoClient.php.
 */
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-integrations/Veeqo/VeeqoClient.php' );
	return;
}

$module_path = __DIR__ . '/dtb-integrations/Veeqo/VeeqoClient.php';
if ( file_exists( $module_path ) ) {
	require_once $module_path;
}
