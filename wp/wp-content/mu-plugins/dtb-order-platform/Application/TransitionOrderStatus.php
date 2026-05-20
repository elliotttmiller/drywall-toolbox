<?php
/**
 * DTB Transition Order Status — WooCommerce status-change handler.
 *
 * Registers and handles woocommerce_order_status_changed to record domain
 * events and dispatch follow-on async jobs for each lifecycle transition.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'woocommerce_order_status_changed', 'dtb_order_on_status_changed', 10, 4 );

function dtb_order_on_status_changed( int $order_id, string $from_status, string $to_status, $order ): void {
	$actor_id   = get_current_user_id();
	$actor_type = $actor_id ? 'admin' : 'system';
	$source     = is_admin() ? 'wp_admin' : 'system';

	$event_map = [
		'pending'    => 'order.payment_pending',
		'on-hold'    => 'order.payment_review_required',
		'processing' => 'order.payment_confirmed',
		'completed'  => 'order.completed',
		'cancelled'  => 'order.cancelled',
		'refunded'   => 'order.refunded',
		'failed'     => 'order.payment_failed',
	];

	$event_type = $event_map[ $to_status ] ?? ( 'order.status_changed.' . sanitize_key( $to_status ) );

	dtb_order_append_event( $order_id, $event_type, [
		'from_status' => $from_status,
		'to_status'   => $to_status,
		'actor_type'  => $actor_type,
		'actor_id'    => $actor_id ?: null,
		'source'      => $source,
		'payload'     => [
			'from' => $from_status,
			'to'   => $to_status,
		],
	] );

	if ( 'processing' === $to_status ) {
		dtb_order_dispatch_processing_jobs( $order_id );
	}

	if ( in_array( $to_status, [ 'cancelled', 'refunded' ], true ) ) {
		dtb_order_enqueue_job( 'dtb_order_handle_refund', $order_id );
	}

	if ( 'completed' === $to_status ) {
		dtb_order_enqueue_job( 'dtb_order_sync_quickbooks', $order_id );
		dtb_order_enqueue_job( 'dtb_order_archive_completed', $order_id );
	}
}
