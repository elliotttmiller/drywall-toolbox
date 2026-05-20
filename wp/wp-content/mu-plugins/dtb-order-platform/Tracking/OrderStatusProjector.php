<?php
/**
 * DTB Order Status Projector — REST API route registration.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', 'dtb_order_register_rest_routes' );

function dtb_order_register_rest_routes(): void {
	$ns = 'dtb/v1';

	register_rest_route( $ns, '/orders', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_order_rest_list_orders',
		'permission_callback' => 'dtb_order_rest_require_auth',
		'args'                => [
			'page'     => [ 'type' => 'integer', 'default' => 1, 'minimum' => 1 ],
			'per_page' => [ 'type' => 'integer', 'default' => 20, 'minimum' => 1, 'maximum' => 100 ],
		],
	] );

	register_rest_route( $ns, '/orders/health', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_order_rest_health',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/orders/(?P<id>[0-9]+)', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_order_rest_get_order',
		'permission_callback' => 'dtb_order_rest_require_auth',
		'args'                => [
			'id' => [ 'type' => 'integer', 'required' => true, 'minimum' => 1 ],
		],
	] );

	register_rest_route( $ns, '/orders/(?P<id>[0-9]+)/tracking', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_order_rest_get_tracking',
		'permission_callback' => 'dtb_order_rest_check_order_access',
		'args'                => [
			'id'        => [ 'type' => 'integer', 'required' => true, 'minimum' => 1 ],
			'order_key' => [ 'type' => 'string', 'default' => '' ],
		],
	] );

	register_rest_route( $ns, '/orders/(?P<id>[0-9]+)/events/stream', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_order_rest_event_stream',
		'permission_callback' => 'dtb_order_rest_check_order_access',
		'args'                => [
			'id'        => [ 'type' => 'integer', 'required' => true, 'minimum' => 1 ],
			'order_key' => [ 'type' => 'string', 'default' => '' ],
		],
	] );
}
