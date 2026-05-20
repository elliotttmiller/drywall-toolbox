<?php
defined( 'ABSPATH' ) || exit;

if ( function_exists( 'dtb_module_require' ) ) {
	dtb_module_require( 'dtb-repairs.php' );
	return;
}

$legacy_path = dirname( __DIR__, 2 ) . '/dtb-repairs.php';
if ( file_exists( $legacy_path ) ) {
	require_once $legacy_path;
}
