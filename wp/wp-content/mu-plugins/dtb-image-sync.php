<?php
/**
 * Backward-compatible entrypoint shim.
 * Real implementation loads from dtb-media/bootstrap.php.
 */
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-media/bootstrap.php' );
	return;
}

$module_path = __DIR__ . '/dtb-media/bootstrap.php';
if ( file_exists( $module_path ) ) {
	require_once $module_path;
}
