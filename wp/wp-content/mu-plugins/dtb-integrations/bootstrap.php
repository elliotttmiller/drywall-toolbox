<?php
/**
 * DTB Integrations bootstrap.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// Keep WooCommerce bridge first so integration consumers hook against configured WC runtime.
dtb_module_require( 'dtb-woocommerce.php' );
dtb_module_require( 'dtb-veeqo.php' );
dtb_module_require( 'dtb-quickbooks.php' );
dtb_module_require( 'dtb-rewards.php' );
