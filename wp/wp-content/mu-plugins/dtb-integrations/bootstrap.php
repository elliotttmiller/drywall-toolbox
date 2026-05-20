<?php
/**
 * DTB Integrations bootstrap.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// Keep WooCommerce bridge first so integration consumers hook against configured WC runtime.
dtb_module_require( 'dtb-integrations/WooCommerce/WooCommerceBridge.php' );
dtb_module_require( 'dtb-integrations/Veeqo/VeeqoClient.php' );
dtb_module_require( 'dtb-integrations/QuickBooks/QuickBooksClient.php' );
dtb_module_require( 'dtb-integrations/Rewards/RewardsService.php' );
