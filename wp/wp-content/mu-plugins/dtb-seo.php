<?php
/**
 * Backward-compatible entrypoint shim.
 * Real implementation loads from dtb-marketing/bootstrap.php.
 */
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-marketing/bootstrap.php' );
	return;
}

$module_path = __DIR__ . '/dtb-marketing/bootstrap.php';
if ( file_exists( $module_path ) ) {
	require_once $module_path;
}
