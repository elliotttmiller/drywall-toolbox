<?php
/**
 * DTB Marketing bootstrap.
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

$dtb_require( 'dtb-coming-soon.php' );
$dtb_require( 'dtb-seo.php' );

unset( $dtb_require );
