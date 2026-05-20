<?php
/**
 * DTB Platform bootstrap.
 *
 * Transitional composition module that centralizes core platform wiring while
 * legacy root files are incrementally migrated into layered module internals.
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

$dtb_require( 'dtb-utils.php' );
$dtb_require( 'dtb-auth.php' );
$dtb_require( 'dtb-cache.php' );
$dtb_require( 'dtb-cache-admin.php' );
$dtb_require( 'dtb-rest-api.php' );
$dtb_require( 'dtb-api-security.php' );
$dtb_require( 'dtb-frontend-security.php' );
$dtb_require( 'dtb-admin-security.php' );
$dtb_require( 'dtb-api-health-monitor.php' );
$dtb_require( 'dtb-admin-performance.php' );
$dtb_require( 'dtb-ops-dashboard.php' );
$dtb_require( 'dtb-config-reference.php' );

unset( $dtb_require );
