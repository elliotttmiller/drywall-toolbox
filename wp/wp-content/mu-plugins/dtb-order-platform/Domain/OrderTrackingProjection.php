<?php
/**
 * Domain: Order Tracking Projection — projection cache key and structure constants.
 *
 * @package drywall-toolbox
 */
defined( 'ABSPATH' ) || exit;

if ( ! defined( 'DTB_ORDER_TRACKING_CACHE_TTL' ) ) {
define( 'DTB_ORDER_TRACKING_CACHE_TTL', 2 * MINUTE_IN_SECONDS );
}

function dtb_order_tracking_cache_key( int $order_id ): string {
return 'dtb_order_tracking_' . $order_id;
}
