<?php
/**
 * DTB Order Workflow Service — WooCommerce lifecycle hook handlers.
 *
 * Registers and handles the woocommerce_new_order and woocommerce_order_refunded
 * hooks, plus dispatches processing-phase async jobs.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'woocommerce_new_order', 'dtb_order_on_created', 10, 2 );
add_action( 'woocommerce_order_refunded', 'dtb_order_on_refunded', 10, 2 );

function dtb_order_on_created( int $order_id, $order ): void {
	if ( $order instanceof WC_Abstract_Order ) {
		$current_type = sanitize_key( (string) $order->get_meta( '_dtb_order_type', true ) );
		if ( '' === $current_type ) {
			$resolved_type = function_exists( 'dtb_order_resolve_type' )
				? dtb_order_resolve_type( $order )
				: 'product';

			$order->update_meta_data( '_dtb_order_type', $resolved_type );
			$order->save_meta_data();
		}
	}

	dtb_order_append_event( $order_id, 'order.created', [
		'source'      => 'checkout',
		'actor_type'  => 'customer',
		'actor_id'    => $order instanceof WC_Abstract_Order ? (int) $order->get_customer_id() : 0,
		'to_status'   => 'pending',
		'visibility'  => 'customer',
		'idempotency_key' => 'order-created:' . $order_id,
		'payload'     => [
			'total'          => $order instanceof WC_Abstract_Order ? (string) $order->get_total() : null,
			'currency'       => $order instanceof WC_Abstract_Order ? $order->get_currency() : null,
			'items_count'    => $order instanceof WC_Abstract_Order ? count( $order->get_items() ) : 0,
			'payment_method' => $order instanceof WC_Abstract_Order ? $order->get_payment_method() : null,
		],
	] );
}

function dtb_order_on_refunded( int $order_id, int $refund_id ): void {
	if ( $order_id <= 0 || $refund_id <= 0 ) {
		return;
	}

	dtb_order_append_event( $order_id, 'order.refunded', [
		'source'          => is_admin() ? 'wp_admin' : 'system',
		'actor_type'      => is_admin() ? 'admin' : 'system',
		'actor_id'        => get_current_user_id() ?: null,
		'visibility'      => 'customer',
		'idempotency_key' => 'order-refunded:' . $order_id . ':' . $refund_id,
		'payload'         => [ 'refund_id' => $refund_id ],
	] );

	$refund_args = [ 'refund_id' => $refund_id ];
	dtb_order_enqueue_job( 'dtb_order_handle_refund', $order_id, $refund_args );
	dtb_order_enqueue_job( 'dtb_order_sync_quickbooks', $order_id, [ 'action' => 'refund', 'refund_id' => $refund_id ] );
}

function dtb_order_dispatch_processing_jobs( int $order_id ): void {
	$order = function_exists( 'wc_get_order' ) ? wc_get_order( $order_id ) : null;
	if ( $order instanceof WC_Order && function_exists( 'dtb_checkout_handoff_is_unpaid_order' ) && dtb_checkout_handoff_is_unpaid_order( $order ) ) {
		return;
	}
	if ( ! add_option( 'dtb_order_processing_dispatch_' . $order_id, current_time( 'mysql', true ), '', 'no' ) ) {
		return;
	}

	dtb_order_append_event( $order_id, 'order.fulfillment_queued', [
		'source'     => 'system',
		'actor_type' => 'system',
		'visibility' => 'operator',
		'idempotency_key' => 'order-processing-dispatch:' . $order_id,
	] );

	dtb_order_enqueue_job( 'dtb_order_sync_veeqo',                  $order_id );
	dtb_order_enqueue_job( 'dtb_order_sync_quickbooks',              $order_id, [ 'action' => 'create' ] );
	// Rewards are intentionally disabled until the account rewards program is fully implemented and audited.
	dtb_order_enqueue_job( 'dtb_order_refresh_tracking_projection',  $order_id );
}
