<?php
/**
 * Backward-compatible entrypoint shim.
 * Real implementation loads from dtb-schematics/bootstrap.php.
 */
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-schematics/bootstrap.php' );
	return;
}

$module_path = __DIR__ . '/dtb-schematics/bootstrap.php';
if ( file_exists( $module_path ) ) {
	require_once $module_path;
}
