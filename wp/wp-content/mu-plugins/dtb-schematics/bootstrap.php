<?php
/**
 * DTB Schematics bootstrap.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

$dtb_require = static function ( string $relative ): void {
	$path = dirname( __DIR__ ) . '/' . ltrim( $relative, '/' );

	if ( function_exists( '_dtb_require' ) ) {
		_dtb_require( $path );
		return;
	}

	if ( file_exists( $path ) ) {
		require_once $path;
	}
};

$dtb_require( 'dtb-product-mapping.php' );
$dtb_require( 'dtb-schematics-api.php' );
$dtb_require( 'dtb-schematics-admin.php' );

unset( $dtb_require );
