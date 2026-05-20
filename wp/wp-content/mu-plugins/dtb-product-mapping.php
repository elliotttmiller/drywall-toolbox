<?php
/**
 * Backward-compatible entrypoint shim.
 * Real implementation loads from dtb-catalog-platform/bootstrap.php.
 */
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-catalog-platform/bootstrap.php' );
	return;
}

$module_path = __DIR__ . '/dtb-catalog-platform/bootstrap.php';
if ( file_exists( $module_path ) ) {
	require_once $module_path;
}
