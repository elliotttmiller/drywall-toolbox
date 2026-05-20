<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_veeqo_webhook_order( WP_REST_Request $request ): ?WP_REST_Response {
	return function_exists( 'dtb_veeqo_route_webhook_order' ) ? dtb_veeqo_route_webhook_order( $request ) : null;
}
