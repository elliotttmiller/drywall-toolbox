<?php
/**
 * DTB Order Workflows — Must-Use Plugin
 *
 * Order lifecycle orchestration: WooCommerce status hooks, DTB fulfillment
 * substate management, and integration job dispatch.
 *
 * Provides:
 *   dtb_order_get_status_label()          — Customer-facing label for WC status
 *   dtb_order_get_fulfillment_substate()  — Read fulfillment substate from meta
 *   dtb_order_set_fulfillment_substate()  — Set fulfillment substate in meta
 *   dtb_order_build_status_projection()   — Customer-safe status summary
 *   dtb_order_on_status_changed()         — WC status transition hook handler
 *   dtb_order_on_created()                — New order hook handler
 *
 * Depends on (loaded before this):
 *   dtb-order-events.php   → dtb_order_append_event(), dtb_order_get_events()
 *   dtb-order-queue.php    → dtb_order_enqueue_job()
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// SECTION 1 — STATUS LABELS & PROJECTION MAP
// =============================================================================

/**
 * Map WooCommerce order status → customer-safe label and display config.
 *
 * @return array<string, array{label:string, description:string, is_terminal:bool}>
 */
function dtb_order_get_status_map(): array {
	return [
		'pending'    => [ 'label' => __( 'Order Received',       'drywall-toolbox' ), 'description' => __( 'Order started, payment not confirmed', 'drywall-toolbox' ), 'is_terminal' => false ],
		'on-hold'    => [ 'label' => __( 'Payment Under Review',  'drywall-toolbox' ), 'description' => __( 'Awaiting confirmation or manual review', 'drywall-toolbox' ), 'is_terminal' => false ],
		'processing' => [ 'label' => __( 'Processing',            'drywall-toolbox' ), 'description' => __( 'Paid and preparing for fulfillment', 'drywall-toolbox' ), 'is_terminal' => false ],
		'completed'  => [ 'label' => __( 'Delivered / Completed', 'drywall-toolbox' ), 'description' => __( 'Fulfillment complete', 'drywall-toolbox' ), 'is_terminal' => true ],
		'cancelled'  => [ 'label' => __( 'Cancelled',             'drywall-toolbox' ), 'description' => __( 'Order cancelled', 'drywall-toolbox' ), 'is_terminal' => true ],
		'refunded'   => [ 'label' => __( 'Refunded',              'drywall-toolbox' ), 'description' => __( 'Full or partial refund processed', 'drywall-toolbox' ), 'is_terminal' => true ],
		'failed'     => [ 'label' => __( 'Payment Failed',        'drywall-toolbox' ), 'description' => __( 'Payment did not complete', 'drywall-toolbox' ), 'is_terminal' => true ],
	];
}

/**
 * Return all terminal WooCommerce order statuses.
 *
 * @return string[]
 */
function dtb_order_terminal_statuses(): array {
	return array_keys( array_filter( dtb_order_get_status_map(), static fn( $v ) => $v['is_terminal'] ) );
}

/**
 * Return the customer-facing label for a WooCommerce status.
 *
 * Falls back gracefully for unknown statuses.
 *
 * @param string $wc_status  WC status slug (without 'wc-' prefix).
 * @return string
 */
function dtb_order_get_status_label( string $wc_status ): string {
	$map = dtb_order_get_status_map();
	return $map[ $wc_status ]['label'] ?? ucwords( str_replace( '-', ' ', $wc_status ) );
}

// =============================================================================
// SECTION 2 — FULFILLMENT SUBSTATE
// =============================================================================

/**
 * Fulfillment substates stored in order meta (never replace WC statuses).
 * These drive the customer-visible tracking projection.
 *
 * @return array<string, string>  slug => customer label
 */
function dtb_order_fulfillment_substates(): array {
	return [
		'pending'            => __( 'Preparing', 'drywall-toolbox' ),
		'inventory_reserved' => __( 'Inventory Reserved', 'drywall-toolbox' ),
		'picked'             => __( 'Picking', 'drywall-toolbox' ),
		'packed'             => __( 'Packed', 'drywall-toolbox' ),
		'shipped'            => __( 'Shipped', 'drywall-toolbox' ),
		'delivered'          => __( 'Delivered', 'drywall-toolbox' ),
		'exception'          => __( 'Processing Delay', 'drywall-toolbox' ),
	];
}

/**
 * Read the current fulfillment substate for an order.
 *
 * @param int $order_id
 * @return string  Substate slug (default 'pending').
 */
function dtb_order_get_fulfillment_substate( int $order_id ): string {
	$val = get_post_meta( $order_id, '_dtb_fulfillment_substate', true );
	return ( is_string( $val ) && '' !== $val ) ? $val : 'pending';
}

/**
 * Set the fulfillment substate for an order and append the matching event.
 *
 * @param int    $order_id
 * @param string $substate  One of the dtb_order_fulfillment_substates() keys.
 * @param array  $payload   Optional additional event payload.
 */
function dtb_order_set_fulfillment_substate( int $order_id, string $substate, array $payload = [] ): void {
	$prev = dtb_order_get_fulfillment_substate( $order_id );

	if ( $prev === $substate ) {
		return; // No-op: already in this substate.
	}

	update_post_meta( $order_id, '_dtb_fulfillment_substate', sanitize_key( $substate ) );

	$event_map = [
		'inventory_reserved' => 'order.inventory_reserved',
		'picked'             => 'order.picked',
		'packed'             => 'order.packed',
		'shipped'            => 'order.shipped',
		'delivered'          => 'order.delivered',
		'exception'          => 'integration.veeqo.failed',
	];

	if ( isset( $event_map[ $substate ] ) ) {
		dtb_order_append_event( $order_id, $event_map[ $substate ], [
			'source'      => 'veeqo',
			'actor_type'  => 'veeqo',
			'visibility'  => 'customer',
			'payload'     => $payload,
		] );
	}
}

// =============================================================================
// SECTION 3 — STATUS PROJECTION BUILDER
// =============================================================================

/**
 * Build a customer-safe order status projection.
 *
 * Returns the WC status mapped through DTB labels, overlaid with the
 * current fulfillment substate when in processing stage.
 *
 * @param int $order_id
 * @return array{status:string, label:string, wc_status:string, fulfillment_substate:string, is_terminal:bool}
 */
function dtb_order_build_status_projection( int $order_id ): array {
	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return [
			'status'               => 'unknown',
			'label'                => __( 'Unknown', 'drywall-toolbox' ),
			'wc_status'            => 'unknown',
			'fulfillment_substate' => 'pending',
			'is_terminal'          => false,
		];
	}

	$wc_status  = $order->get_status();
	$map        = dtb_order_get_status_map();
	$entry      = $map[ $wc_status ] ?? null;
	$substate   = dtb_order_get_fulfillment_substate( $order_id );
	$label      = $entry['label'] ?? dtb_order_get_status_label( $wc_status );
	$is_terminal = $entry['is_terminal'] ?? false;

	// When order is in processing and fulfillment has progressed, reflect the substate.
	$substates = dtb_order_fulfillment_substates();
	if ( 'processing' === $wc_status && isset( $substates[ $substate ] ) && 'pending' !== $substate ) {
		$label = $substates[ $substate ];
	}

	return [
		'status'               => in_array( $wc_status, [ 'processing' ], true ) && 'shipped' === $substate ? 'shipped' : $wc_status,
		'label'                => $label,
		'wc_status'            => $wc_status,
		'fulfillment_substate' => $substate,
		'is_terminal'          => $is_terminal,
	];
}

// =============================================================================
// SECTION 4 — WOOCOMMERCE HOOKS
// =============================================================================

add_action( 'woocommerce_new_order', 'dtb_order_on_created', 10, 2 );
add_action( 'woocommerce_order_status_changed', 'dtb_order_on_status_changed', 10, 4 );
add_action( 'woocommerce_order_refunded', 'dtb_order_on_refunded', 10, 2 );

/**
 * Handle new order creation.
 *
 * Appends order.created event and queues initial jobs.
 *
 * @param int      $order_id  WC order ID.
 * @param WC_Order $order     WC order object.
 */
function dtb_order_on_created( int $order_id, $order ): void {
	dtb_order_append_event( $order_id, 'order.created', [
		'source'      => 'checkout',
		'actor_type'  => 'customer',
		'actor_id'    => $order instanceof WC_Abstract_Order ? (int) $order->get_customer_id() : 0,
		'to_status'   => 'pending',
		'visibility'  => 'customer',
		'payload'     => [
			'total'          => $order instanceof WC_Abstract_Order ? (string) $order->get_total() : null,
			'currency'       => $order instanceof WC_Abstract_Order ? $order->get_currency() : null,
			'items_count'    => $order instanceof WC_Abstract_Order ? count( $order->get_items() ) : 0,
			'payment_method' => $order instanceof WC_Abstract_Order ? $order->get_payment_method() : null,
		],
	] );
}

/**
 * Handle WooCommerce order status transitions.
 *
 * Appends the matching event and dispatches integration jobs as required.
 *
 * @param int    $order_id    WC order ID.
 * @param string $from_status Previous status slug (without 'wc-' prefix).
 * @param string $to_status   New status slug.
 * @param WC_Order $order
 */
function dtb_order_on_status_changed( int $order_id, string $from_status, string $to_status, $order ): void {
	$actor_id   = get_current_user_id();
	$actor_type = $actor_id ? 'admin' : 'system';
	$source     = is_admin() ? 'wp_admin' : 'system';

	// Map status transitions to event types.
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

	// Dispatch integration jobs on payment confirmation.
	if ( 'processing' === $to_status ) {
		dtb_order_dispatch_processing_jobs( $order_id );
	}

	// On cancellation, attempt reward reversal.
	if ( in_array( $to_status, [ 'cancelled', 'refunded' ], true ) ) {
		dtb_order_enqueue_job( 'dtb_order_handle_refund', $order_id );
	}

	// On completion, finalize accounting and rewards.
	if ( 'completed' === $to_status ) {
		dtb_order_enqueue_job( 'dtb_order_sync_quickbooks', $order_id );
		dtb_order_enqueue_job( 'dtb_order_archive_completed', $order_id );
	}
}

/**
 * Handle order refund event.
 *
 * @param int $order_id
 * @param int $refund_id
 */
function dtb_order_on_refunded( int $order_id, int $refund_id ): void {
	dtb_order_append_event( $order_id, 'order.refunded', [
		'source'     => is_admin() ? 'wp_admin' : 'system',
		'actor_type' => is_admin() ? 'admin' : 'system',
		'actor_id'   => get_current_user_id() ?: null,
		'visibility' => 'customer',
		'payload'    => [ 'refund_id' => $refund_id ],
	] );
	dtb_order_enqueue_job( 'dtb_order_handle_refund', $order_id, [ 'refund_id' => $refund_id ] );
	dtb_order_enqueue_job( 'dtb_order_sync_quickbooks', $order_id, [ 'action' => 'refund', 'refund_id' => $refund_id ] );
}

/**
 * Dispatch all integration jobs when an order moves to 'processing' (paid).
 *
 * @param int $order_id
 */
function dtb_order_dispatch_processing_jobs( int $order_id ): void {
	dtb_order_append_event( $order_id, 'order.fulfillment_queued', [
		'source'     => 'system',
		'actor_type' => 'system',
		'visibility' => 'operator',
	] );

	dtb_order_enqueue_job( 'dtb_order_sync_veeqo',                  $order_id );
	dtb_order_enqueue_job( 'dtb_order_sync_quickbooks',              $order_id, [ 'action' => 'create' ] );
	dtb_order_enqueue_job( 'dtb_order_issue_rewards',                $order_id );
	dtb_order_enqueue_job( 'dtb_order_send_notification',            $order_id, [ 'template' => 'order-confirmation' ] );
	dtb_order_enqueue_job( 'dtb_order_refresh_tracking_projection',  $order_id );
}
