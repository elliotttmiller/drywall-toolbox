<?php
/**
 * DTB Repair Service bootstrap.
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

// Load order: events -> workflows -> queue -> notifications -> rest/CPT -> admin.
$dtb_require( 'dtb-repair-events.php' );
$dtb_require( 'dtb-repair-workflows.php' );
$dtb_require( 'dtb-repair-queue.php' );
$dtb_require( 'dtb-repair-notifications.php' );
$dtb_require( 'dtb-repairs.php' );
$dtb_require( 'dtb-repair-admin.php' );

unset( $dtb_require );
