<?php
/**
 * DTB Order Platform bootstrap.
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

// Load order: events -> workflows -> queue -> tracking -> webhooks -> admin.
$dtb_require( 'dtb-order-events.php' );
$dtb_require( 'dtb-order-workflows.php' );
$dtb_require( 'dtb-order-queue.php' );
$dtb_require( 'dtb-order-tracking.php' );
$dtb_require( 'dtb-payment-webhooks.php' );
$dtb_require( 'dtb-order-admin.php' );

unset( $dtb_require );
