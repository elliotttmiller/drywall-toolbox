<?php
/**
 * DTB Order Platform bootstrap.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// Load order: events -> workflows -> queue -> tracking -> webhooks -> admin.
dtb_module_require( 'dtb-order-events.php' );
dtb_module_require( 'dtb-order-workflows.php' );
dtb_module_require( 'dtb-order-queue.php' );
dtb_module_require( 'dtb-order-tracking.php' );
dtb_module_require( 'dtb-payment-webhooks.php' );
dtb_module_require( 'dtb-order-admin.php' );
