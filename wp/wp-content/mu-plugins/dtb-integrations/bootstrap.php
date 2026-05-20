<?php
/**
 * DTB Integrations bootstrap.
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

// Keep WooCommerce bridge first so integration consumers hook against configured WC runtime.
$dtb_require( 'dtb-woocommerce.php' );
$dtb_require( 'dtb-veeqo.php' );
$dtb_require( 'dtb-quickbooks.php' );
$dtb_require( 'dtb-rewards.php' );

unset( $dtb_require );
