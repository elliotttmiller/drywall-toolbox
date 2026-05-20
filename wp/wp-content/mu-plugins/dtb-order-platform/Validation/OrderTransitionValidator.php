<?php
/**
 * DTB Order Transition Validator — validates WC status transitions.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_order_validate_transition( int $order_id, string $to_status ): true|WP_Error {
	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return new WP_Error( 'dtb_not_found', 'Order not found.', [ 'status' => 404 ] );
	}

	$map        = dtb_order_get_status_map();
	$wc_status  = $order->get_status();
	$entry      = $map[ $wc_status ] ?? null;
	$is_terminal = $entry['is_terminal'] ?? false;

	if ( $is_terminal ) {
		return new WP_Error( 'dtb_terminal_order', 'Cannot transition a terminal order.', [ 'status' => 422 ] );
	}

	$clean = str_starts_with( $to_status, 'wc-' ) ? substr( $to_status, 3 ) : $to_status;

	$valid_statuses = array_merge(
		array_keys( $map ),
		array_map(
			static fn( string $s ) => str_starts_with( $s, 'wc-' ) ? substr( $s, 3 ) : $s,
			array_keys( wc_get_order_statuses() )
		)
	);

	if ( ! in_array( $clean, $valid_statuses, true ) ) {
		return new WP_Error( 'dtb_invalid_status', 'Invalid target status.', [ 'status' => 422 ] );
	}

	return true;
}
