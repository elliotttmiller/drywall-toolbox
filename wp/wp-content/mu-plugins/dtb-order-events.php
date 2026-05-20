<?php
/**
 * DTB Order Events — Must-Use Plugin
 *
 * Manages the wp_dtb_order_events database table and provides all read/write
 * helpers for the product-order event ledger.  Loaded before dtb-order-workflows,
 * dtb-order-queue, and dtb-order-tracking.
 *
 * Provides:
 *   dtb_order_append_event()              — insert an event row
 *   dtb_order_get_events()                — query events (admin)
 *   dtb_order_get_customer_timeline()     — customer-visible timeline
 *   dtb_order_get_last_event()            — most recent event for an order
 *   dtb_order_event_idempotency_exists()  — idempotency-key guard
 *
 * Table: wp_dtb_order_events
 * Schema version option: dtb_order_events_db_version
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// SECTION 1 — SCHEMA VERSION & TABLE CREATION
// =============================================================================

/** Current schema version. Bump to trigger dbDelta on next boot. */
define( 'DTB_ORDER_EVENTS_DB_VERSION', '1.0.0' );

add_action( 'plugins_loaded', 'dtb_order_events_maybe_create_table', 5 );

/**
 * Create or upgrade the wp_dtb_order_events table using dbDelta().
 *
 * Runs on every plugins_loaded but the version guard makes it a no-op after
 * the first successful install.
 */
function dtb_order_events_maybe_create_table(): void {
	$installed = (string) get_option( 'dtb_order_events_db_version', '' );

	if ( $installed === DTB_ORDER_EVENTS_DB_VERSION ) {
		return;
	}

	global $wpdb;

	$table          = $wpdb->prefix . 'dtb_order_events';
	$charset_collate = $wpdb->get_charset_collate();

	$sql = "CREATE TABLE {$table} (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		order_id bigint(20) unsigned NOT NULL,
		event_type varchar(100) NOT NULL,
		from_status varchar(50) DEFAULT NULL,
		to_status varchar(50) DEFAULT NULL,
		actor_type varchar(50) NOT NULL DEFAULT 'system',
		actor_id bigint(20) DEFAULT NULL,
		source varchar(100) NOT NULL DEFAULT 'system',
		visibility varchar(50) NOT NULL DEFAULT 'operator',
		idempotency_key varchar(191) DEFAULT NULL,
		payload_json longtext,
		created_at datetime NOT NULL,
		PRIMARY KEY (id),
		UNIQUE KEY idempotency_key (idempotency_key),
		KEY order_id (order_id),
		KEY event_type (event_type),
		KEY visibility (visibility),
		KEY created_at (created_at)
	) ENGINE=InnoDB {$charset_collate};";

	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	dbDelta( $sql );

	update_option( 'dtb_order_events_db_version', DTB_ORDER_EVENTS_DB_VERSION );
}

// =============================================================================
// SECTION 2 — EVENT TYPE → VISIBILITY MAP
// =============================================================================

/**
 * Return the default visibility for a given event type.
 *
 * @param string $event_type
 * @return string  'customer' | 'operator' | 'internal'
 */
function dtb_order_event_default_visibility( string $event_type ): string {
	$customer_events = [
		'order.created',
		'order.payment_pending',
		'order.payment_confirmed',
		'order.payment_failed',
		'order.inventory_reserved',
		'order.picked',
		'order.packed',
		'order.shipped',
		'order.tracking_updated',
		'order.delivered',
		'order.completed',
		'order.cancelled',
		'order.refund_requested',
		'order.refunded',
		'notification.order_confirmation.sent',
		'notification.shipped.sent',
		'notification.refund.sent',
	];

	$operator_events = [
		'order.payment_review_required',
		'order.inventory_reservation_failed',
		'order.fulfillment_queued',
		'integration.veeqo.queued',
		'integration.veeqo.synced',
		'integration.veeqo.failed',
		'integration.quickbooks.queued',
		'integration.quickbooks.synced',
		'integration.quickbooks.failed',
		'integration.rewards.queued',
		'integration.rewards.issued',
		'integration.rewards.failed',
	];

	if ( in_array( $event_type, $customer_events, true ) ) {
		return 'customer';
	}
	if ( in_array( $event_type, $operator_events, true ) ) {
		return 'operator';
	}
	return 'internal';
}

/**
 * Customer-facing label for each event type.
 *
 * @param string $event_type
 * @return string
 */
function dtb_order_event_customer_label( string $event_type ): string {
	$labels = [
		'order.created'                    => __( 'Order placed', 'drywall-toolbox' ),
		'order.payment_pending'            => __( 'Awaiting payment', 'drywall-toolbox' ),
		'order.payment_confirmed'          => __( 'Payment confirmed', 'drywall-toolbox' ),
		'order.payment_failed'             => __( 'Payment failed', 'drywall-toolbox' ),
		'order.inventory_reserved'         => __( 'Inventory reserved', 'drywall-toolbox' ),
		'order.picked'                     => __( 'Picking order', 'drywall-toolbox' ),
		'order.packed'                     => __( 'Order packed', 'drywall-toolbox' ),
		'order.shipped'                    => __( 'Order shipped', 'drywall-toolbox' ),
		'order.tracking_updated'           => __( 'Tracking updated', 'drywall-toolbox' ),
		'order.delivered'                  => __( 'Delivered', 'drywall-toolbox' ),
		'order.completed'                  => __( 'Order completed', 'drywall-toolbox' ),
		'order.cancelled'                  => __( 'Order cancelled', 'drywall-toolbox' ),
		'order.refund_requested'           => __( 'Refund requested', 'drywall-toolbox' ),
		'order.refunded'                   => __( 'Refunded', 'drywall-toolbox' ),
		'notification.order_confirmation.sent' => __( 'Confirmation sent', 'drywall-toolbox' ),
		'notification.shipped.sent'        => __( 'Shipping notification sent', 'drywall-toolbox' ),
		'notification.refund.sent'         => __( 'Refund notification sent', 'drywall-toolbox' ),
	];

	return $labels[ $event_type ] ?? ucwords( str_replace( [ '.', '_' ], ' ', $event_type ) );
}

// =============================================================================
// SECTION 3 — EVENT WRITE HELPERS
// =============================================================================

/**
 * Append an event to the order event ledger.
 *
 * @param int    $order_id        WooCommerce order ID.
 * @param string $event_type      Dot-namespaced event type slug.
 * @param array  $args {
 *   @type string|null $from_status      Previous WC status.
 *   @type string|null $to_status        New WC status.
 *   @type string      $actor_type       'customer'|'admin'|'system'|'payment_gateway'|'veeqo'|'quickbooks'.
 *   @type int|null    $actor_id         WP user/admin ID.
 *   @type string      $source           'checkout'|'webhook'|'wp_admin'|'veeqo'|'cron'.
 *   @type string      $visibility       'customer'|'operator'|'internal'.
 *   @type string|null $idempotency_key  Unique key to prevent duplicate handling.
 *   @type array       $payload          Sanitized structured payload.
 * }
 * @return int|false  Inserted row ID or false on failure / duplicate.
 */
function dtb_order_append_event( int $order_id, string $event_type, array $args = [] ): int|false {
	if ( $order_id <= 0 || '' === $event_type ) {
		return false;
	}

	global $wpdb;

	// Idempotency guard — skip if this key already exists.
	$idempotency_key = isset( $args['idempotency_key'] ) ? sanitize_text_field( (string) $args['idempotency_key'] ) : null;
	if ( $idempotency_key && dtb_order_event_idempotency_exists( $idempotency_key ) ) {
		return false;
	}

	$visibility = isset( $args['visibility'] )
		? sanitize_text_field( (string) $args['visibility'] )
		: dtb_order_event_default_visibility( $event_type );

	$payload = isset( $args['payload'] ) && is_array( $args['payload'] ) ? $args['payload'] : [];
	// Strip sensitive keys from payload before storage.
	$safe_payload = dtb_order_sanitize_event_payload( $payload );

	$row = [
		'order_id'        => (int) $order_id,
		'event_type'      => sanitize_key( $event_type ),
		'from_status'     => isset( $args['from_status'] ) ? sanitize_text_field( (string) $args['from_status'] ) : null,
		'to_status'       => isset( $args['to_status'] ) ? sanitize_text_field( (string) $args['to_status'] ) : null,
		'actor_type'      => isset( $args['actor_type'] ) ? sanitize_text_field( (string) $args['actor_type'] ) : 'system',
		'actor_id'        => isset( $args['actor_id'] ) ? (int) $args['actor_id'] : null,
		'source'          => isset( $args['source'] ) ? sanitize_text_field( (string) $args['source'] ) : 'system',
		'visibility'      => $visibility,
		'idempotency_key' => $idempotency_key ?: null,
		'payload_json'    => wp_json_encode( $safe_payload ),
		'created_at'      => current_time( 'mysql', true ),
	];

	$formats = [
		'%d', // order_id
		'%s', // event_type
		'%s', // from_status
		'%s', // to_status
		'%s', // actor_type
		'%d', // actor_id
		'%s', // source
		'%s', // visibility
		'%s', // idempotency_key
		'%s', // payload_json
		'%s', // created_at
	];

	$wpdb->insert( $wpdb->prefix . 'dtb_order_events', $row, $formats ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery

	if ( $wpdb->last_error ) {
		// Silently absorb duplicate-key errors (idempotency). MySQL errno 1062 = ER_DUP_ENTRY.
		if ( 1062 === (int) $wpdb->errno || str_contains( (string) $wpdb->last_error, 'Duplicate entry' ) ) {
			return false;
		}
		error_log( '[DTB Orders] dtb_order_append_event error: ' . $wpdb->last_error );
		return false;
	}

	return $wpdb->insert_id > 0 ? (int) $wpdb->insert_id : false;
}

/**
 * Remove sensitive internal keys from an event payload before storage.
 *
 * @param array $payload Raw payload.
 * @return array Sanitized payload.
 */
function dtb_order_sanitize_event_payload( array $payload ): array {
	$deny_keys = [
		'card_number', 'cvv', 'cvc', 'card_cvc',
		'raw_error', 'stack_trace', 'gateway_raw',
		'payment_method_details', 'fraud_score',
		'quickbooks_token', 'veeqo_api_key',
		'password', 'secret',
	];

	$out = [];
	foreach ( $payload as $key => $val ) {
		$k = strtolower( (string) $key );
		if ( in_array( $k, $deny_keys, true ) ) {
			continue;
		}
		if ( is_array( $val ) ) {
			$out[ $key ] = dtb_order_sanitize_event_payload( $val );
		} elseif ( is_scalar( $val ) || null === $val ) {
			$out[ $key ] = $val;
		}
	}
	return $out;
}

// =============================================================================
// SECTION 4 — EVENT READ HELPERS
// =============================================================================

/**
 * Query events for an order (all visibility levels — for admin use).
 *
 * @param int   $order_id
 * @param array $args {
 *   @type string   $visibility   Filter: 'customer'|'operator'|'internal'|'' (all).
 *   @type string   $event_type   Filter by specific event type.
 *   @type int      $limit        Max rows (default: 200).
 *   @type string   $order        'ASC'|'DESC' (default: 'ASC').
 * }
 * @return array<object> Event rows.
 */
function dtb_order_get_events( int $order_id, array $args = [] ): array {
	if ( $order_id <= 0 ) {
		return [];
	}

	global $wpdb;

	$table  = $wpdb->prefix . 'dtb_order_events';
	$limit  = isset( $args['limit'] ) ? max( 1, (int) $args['limit'] ) : 200;
	$sort   = isset( $args['order'] ) && 'DESC' === strtoupper( $args['order'] ) ? 'DESC' : 'ASC';

	$where  = [ $wpdb->prepare( 'order_id = %d', $order_id ) ]; // phpcs:ignore WordPress.DB.PreparedSQL

	if ( ! empty( $args['visibility'] ) ) {
		$where[] = $wpdb->prepare( 'visibility = %s', $args['visibility'] ); // phpcs:ignore WordPress.DB.PreparedSQL
	}
	if ( ! empty( $args['event_type'] ) ) {
		$where[] = $wpdb->prepare( 'event_type = %s', $args['event_type'] ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	$where_sql = 'WHERE ' . implode( ' AND ', $where );

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	return (array) $wpdb->get_results(
		"SELECT * FROM {$table} {$where_sql} ORDER BY created_at {$sort}, id {$sort} LIMIT {$limit}"
	);
}

/**
 * Build the customer-visible timeline for an order.
 *
 * Returns only 'customer' visibility events with a sanitized label and
 * occurred_at timestamp — never exposes operator/internal data.
 *
 * @param int $order_id
 * @return array<array{type:string,label:string,occurred_at:string}>
 */
function dtb_order_get_customer_timeline( int $order_id ): array {
	$events = dtb_order_get_events( $order_id, [ 'visibility' => 'customer', 'order' => 'ASC' ] );

	$timeline = [];
	foreach ( $events as $row ) {
		$timeline[] = [
			'type'        => (string) $row->event_type,
			'label'       => dtb_order_event_customer_label( (string) $row->event_type ),
			'occurred_at' => (string) $row->created_at,
		];
	}
	return $timeline;
}

/**
 * Return the most recent event row for an order (optionally filtered by event type).
 *
 * @param int         $order_id
 * @param string|null $event_type  Optional filter.
 * @return object|null
 */
function dtb_order_get_last_event( int $order_id, ?string $event_type = null ): ?object {
	if ( $order_id <= 0 ) {
		return null;
	}

	global $wpdb;

	$table = $wpdb->prefix . 'dtb_order_events';
	$where = [ $wpdb->prepare( 'order_id = %d', $order_id ) ]; // phpcs:ignore WordPress.DB.PreparedSQL

	if ( $event_type ) {
		$where[] = $wpdb->prepare( 'event_type = %s', $event_type ); // phpcs:ignore WordPress.DB.PreparedSQL
	}

	$where_sql = 'WHERE ' . implode( ' AND ', $where );

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	return $wpdb->get_row( "SELECT * FROM {$table} {$where_sql} ORDER BY created_at DESC, id DESC LIMIT 1" );
}

/**
 * Check whether an idempotency key already exists in the event ledger.
 *
 * @param string $key
 * @return bool
 */
function dtb_order_event_idempotency_exists( string $key ): bool {
	if ( '' === $key ) {
		return false;
	}

	global $wpdb;

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery
	$count = (int) $wpdb->get_var(
		$wpdb->prepare(
			'SELECT COUNT(1) FROM ' . $wpdb->prefix . 'dtb_order_events WHERE idempotency_key = %s',
			$key
		)
	);

	return $count > 0;
}

// =============================================================================
// SECTION 5 — ORDER INTEGRATION STATE (order meta helpers)
// =============================================================================

/**
 * Read the DTB integration state projection for an order.
 *
 * Returns a merged array of all integration slices stored in order meta.
 *
 * @param int $order_id
 * @return array{veeqo:array,quickbooks:array,rewards:array,notifications:array}
 */
function dtb_order_get_integration_state( int $order_id ): array {
	$defaults = [
		'veeqo'         => [ 'status' => 'pending', 'order_id' => null, 'tracking' => null, 'error' => null, 'updated_at' => null ],
		'quickbooks'    => [ 'status' => 'pending', 'entity_id' => null, 'error' => null, 'updated_at' => null ],
		'rewards'       => [ 'status' => 'pending', 'points_issued' => null, 'error' => null, 'updated_at' => null ],
		'notifications' => [],
	];

	$stored = get_post_meta( $order_id, '_dtb_integration_state', true );

	if ( is_array( $stored ) ) {
		return array_replace_recursive( $defaults, $stored );
	}

	return $defaults;
}

/**
 * Update a single integration slice in the order's integration state meta.
 *
 * @param int    $order_id  WooCommerce order ID.
 * @param string $slice     One of: 'veeqo', 'quickbooks', 'rewards', 'notifications'.
 * @param array  $data      Partial state to merge.
 */
function dtb_order_update_integration_state( int $order_id, string $slice, array $data ): void {
	$state = dtb_order_get_integration_state( $order_id );

	if ( 'notifications' === $slice ) {
		$state['notifications'][] = array_merge( [ 'sent_at' => current_time( 'mysql', true ) ], $data );
	} else {
		$state[ $slice ] = array_merge( $state[ $slice ] ?? [], $data, [ 'updated_at' => current_time( 'mysql', true ) ] );
	}

	update_post_meta( $order_id, '_dtb_integration_state', $state );
}
