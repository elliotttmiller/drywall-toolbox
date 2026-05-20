<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_veeqo_shipping_rates( WP_REST_Request $request ): ?WP_REST_Response {
	return function_exists( 'dtb_veeqo_route_shipping_rates' ) ? dtb_veeqo_route_shipping_rates( $request ) : null;
}
