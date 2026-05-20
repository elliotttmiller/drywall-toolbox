<?php
/**
 * DTB Order Access Validator — REST permission callbacks.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_order_rest_require_auth( WP_REST_Request $request ): bool|WP_Error {
	if ( ! is_user_logged_in() ) {
		return new WP_Error( 'dtb_unauthorized', 'Authentication required.', [ 'status' => 401 ] );
	}
	return true;
}

function dtb_order_rest_check_order_access( WP_REST_Request $request ): bool|WP_Error {
	$order_id  = (int) $request->get_param( 'id' );
	$order_key = sanitize_text_field( (string) $request->get_param( 'order_key' ) );
	$user_id   = get_current_user_id();

	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return new WP_Error( 'dtb_not_found', 'Order not found.', [ 'status' => 404 ] );
	}

	if ( current_user_can( 'manage_woocommerce' ) ) {
		return true;
	}

	if ( $user_id && (int) $order->get_customer_id() === $user_id ) {
		return true;
	}

	if ( $order_key && hash_equals( $order->get_order_key(), $order_key ) ) {
		return true;
	}

	return new WP_Error( 'dtb_forbidden', 'You do not have access to this order.', [ 'status' => 403 ] );
}
