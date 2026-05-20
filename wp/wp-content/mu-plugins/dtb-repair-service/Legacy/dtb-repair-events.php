<?php
/**
 * DTB Repair Events — Must-Use Plugin
 *
 * Manages the wp_dtb_repair_events database table and provides all read/write
 * helpers for the repair event log.  Loaded before dtb-repairs.php,
 * dtb-repair-workflows.php, and dtb-repair-queue.php.
 *
 * Provides:
 *   dtb_repair_append_event()           — insert an event row
 *   dtb_repair_get_events()             — query events
 *   dtb_repair_get_customer_timeline()  — customer-visible timeline for status projection
 *   dtb_repair_get_last_event()         — most recent event for a repair
 *
 * Table: wp_dtb_repair_events
 * Schema version option: dtb_repair_events_db_version
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// SECTION 1 — SCHEMA VERSION & TABLE CREATION
// =============================================================================

/** Current schema version. Bump to trigger dbDelta on next boot. */
define( 'DTB_REPAIR_EVENTS_DB_VERSION', '1.0.0' );

add_action( 'plugins_loaded', 'dtb_repair_events_maybe_create_table', 5 );

/**
 * Create or upgrade the wp_dtb_repair_events table using dbDelta().
 *
 * Runs on every plugins_loaded but the version guard makes it a no-op after
 * the first successful install.
 */
function dtb_repair_events_maybe_create_table(): void {
	$installed = (string) get_option( 'dtb_repair_events_db_version', '' );

	if ( $installed === DTB_REPAIR_EVENTS_DB_VERSION ) {
		return;
	}

	global $wpdb;

	$table      = $wpdb->prefix . 'dtb_repair_events';
	$charset_collate = $wpdb->get_charset_collate();

	$sql = "CREATE TABLE {$table} (
		id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
		repair_id bigint(20) unsigned NOT NULL,
		event_type varchar(100) NOT NULL,
		from_status varchar(50) DEFAULT NULL,
		to_status varchar(50) DEFAULT NULL,
		actor_type varchar(50) NOT NULL DEFAULT 'system',
		actor_id bigint(20) DEFAULT NULL,
		source varchar(100) NOT NULL DEFAULT 'system',
		visibility varchar(50) NOT NULL DEFAULT 'operator',
		payload_json longtext,
		created_at datetime NOT NULL,
		PRIMARY KEY (id),
		KEY repair_id (repair_id),
		KEY event_type (event_type),
		KEY visibility (visibility),
		KEY created_at (created_at)
	) ENGINE=InnoDB {$charset_collate};";

	require_once ABSPATH . 'wp-admin/includes/upgrade.php';
	dbDelta( $sql );

	update_option( 'dtb_repair_events_db_version', DTB_REPAIR_EVENTS_DB_VERSION );
}

// =============================================================================
// SECTION 2 — EVENT TYPE → VISIBILITY MAP
// =============================================================================

/**
 * Return the default visibility for a given event type.
 *
 * Visibility levels:
 *   customer  — shown in customer-facing timeline
 *   operator  — shown to staff in WP-admin only
 *   internal  — system-only, never shown in UI
 *
 * Prefix conventions:
 *   repair.*          → customer  (status changes, media, milestones)
 *   notification.*    → operator  (email send/fail)
 *   integration.*     → operator  (WC, Veeqo, QB, Rewards sync)
 *   system.*          → internal  (cron, archive, SLA recalc)
 *
 * @param string $event_type
 * @return string  'customer' | 'operator' | 'internal'
 */
function dtb_repair_event_default_visibility( string $event_type ): string {
	static $map = [
		// Repair lifecycle — customer-visible.
		'repair.submitted'         => 'customer',
		'repair.reviewed'          => 'customer',
		'repair.info_requested'    => 'customer',
		'repair.approved'          => 'customer',
		'repair.quoted'            => 'customer',
		'repair.quote_accepted'    => 'customer',
		'repair.quote_declined'    => 'customer',
		'repair.parts_allocated'   => 'customer',
		'repair.in_progress'       => 'customer',
		'repair.ready_to_ship'     => 'customer',
		'repair.completed'         => 'customer',
		'repair.closed'            => 'customer',
		'repair.cancelled'         => 'customer',
		'repair.media_uploaded'    => 'customer',
		'repair.note_added'        => 'operator',

		// Notification events — operator-visible.
		'notification.email.queued'  => 'operator',
		'notification.email.sent'    => 'operator',
		'notification.email.failed'  => 'operator',

		// Integration sync events — operator-visible.
		'integration.wc.order_created'    => 'operator',
		'integration.wc.order_failed'     => 'operator',
		'integration.veeqo.synced'        => 'operator',
		'integration.veeqo.failed'        => 'operator',
		'integration.veeqo.tracking_set'  => 'operator',
		'integration.qbo.invoice_created' => 'operator',
		'integration.qbo.invoice_failed'  => 'operator',
		'integration.rewards.issued'      => 'operator',
		'integration.rewards.failed'      => 'operator',

		// System/internal events.
		'system.sla_recalculated'  => 'internal',
		'system.archived'          => 'internal',
		'system.projection_refresh'=> 'internal',
		'system.job_enqueued'      => 'internal',
		'system.job_retry'         => 'internal',
	];

	if ( isset( $map[ $event_type ] ) ) {
		return $map[ $event_type ];
	}

	// Fallback: infer from prefix (strpos for PHP 7.4 compatibility).
	if ( 0 === strpos( $event_type, 'repair.' ) ) {
		return 'customer';
	}
	if ( 0 === strpos( $event_type, 'system.' ) ) {
		return 'internal';
	}

	return 'operator';
}

// =============================================================================
// SECTION 3 — WRITE: dtb_repair_append_event()
// =============================================================================

/**
 * Insert a row into wp_dtb_repair_events.
 *
 * @param int    $repair_id   ID of the dtb_repair_request post.
 * @param string $event_type  Machine-readable event type (e.g. 'repair.submitted').
 * @param array  $args {
 *   Optional overrides:
 *   @type string     $from_status  Previous repair status (for transition events).
 *   @type string     $to_status    New repair status (for transition events).
 *   @type string     $actor_type   'user' | 'customer' | 'system' | 'anonymous'.
 *   @type int|null   $actor_id     WP user ID of the actor, if applicable.
 *   @type string     $source       Originating system (e.g. 'api', 'cron', 'admin').
 *   @type string     $visibility   Override default visibility.
 *   @type array      $payload      Arbitrary data; will be JSON-encoded.
 * }
 * @return int|false Inserted row ID, or false on failure.
 */
function dtb_repair_append_event( int $repair_id, string $event_type, array $args = [] ): int|false {
	global $wpdb;

	if ( $repair_id <= 0 || '' === $event_type ) {
		return false;
	}

	$from_status = isset( $args['from_status'] ) ? sanitize_text_field( (string) $args['from_status'] ) : null;
	$to_status   = isset( $args['to_status'] )   ? sanitize_text_field( (string) $args['to_status'] )   : null;
	$actor_type  = sanitize_text_field( (string) ( $args['actor_type'] ?? 'system' ) );
	$actor_id    = isset( $args['actor_id'] ) ? ( absint( $args['actor_id'] ) ?: null ) : null;
	$source      = sanitize_text_field( (string) ( $args['source'] ?? 'system' ) );
	$visibility  = sanitize_text_field( (string) ( $args['visibility'] ?? dtb_repair_event_default_visibility( $event_type ) ) );
	$payload     = ! empty( $args['payload'] ) && is_array( $args['payload'] ) ? wp_json_encode( $args['payload'] ) : null;

	$table  = $wpdb->prefix . 'dtb_repair_events';
	$result = $wpdb->insert(
		$table,
		[
			'repair_id'    => $repair_id,
			'event_type'   => sanitize_text_field( $event_type ),
			'from_status'  => $from_status,
			'to_status'    => $to_status,
			'actor_type'   => $actor_type,
			'actor_id'     => $actor_id,
			'source'       => $source,
			'visibility'   => $visibility,
			'payload_json' => $payload,
			'created_at'   => current_time( 'mysql', true ),
		],
		[
			'%d', '%s', '%s', '%s', '%s', '%d', '%s', '%s', '%s', '%s',
		]
	);

	if ( false === $result ) {
		error_log( "[DTB Repairs] Failed to insert event '{$event_type}' for repair #{$repair_id}: " . $wpdb->last_error );
		return false;
	}

	return (int) $wpdb->insert_id;
}

// =============================================================================
// SECTION 4 — READ: dtb_repair_get_events()
// =============================================================================

/**
 * Query events for a repair.
 *
 * @param int         $repair_id  Post ID of the repair.
 * @param string|null $visibility Filter by visibility level. Null = all.
 * @param int         $limit      Maximum rows to return.
 * @param int         $since_id   Only return events with id > $since_id.
 * @return object[]  Array of stdClass rows from wp_dtb_repair_events.
 */
function dtb_repair_get_events( int $repair_id, ?string $visibility = null, int $limit = 100, int $since_id = 0 ): array {
	global $wpdb;

	$table = $wpdb->prefix . 'dtb_repair_events';
	$limit = max( 1, min( 500, $limit ) );

	if ( null !== $visibility ) {
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM `{$table}`
				 WHERE repair_id = %d AND visibility = %s AND id > %d
				 ORDER BY id ASC
				 LIMIT %d",
				$repair_id,
				$visibility,
				$since_id,
				$limit
			)
		);
	} else {
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM `{$table}`
				 WHERE repair_id = %d AND id > %d
				 ORDER BY id ASC
				 LIMIT %d",
				$repair_id,
				$since_id,
				$limit
			)
		);
	}

	return is_array( $rows ) ? $rows : [];
}

// =============================================================================
// SECTION 5 — READ: dtb_repair_get_customer_timeline()
// =============================================================================

/**
 * Customer-visible event labels for the status projection timeline.
 *
 * @return array<string, string> event_type → human-readable label
 */
function dtb_repair_customer_event_labels(): array {
	return [
		'repair.submitted'       => __( 'Repair request submitted', 'drywall-toolbox' ),
		'repair.reviewed'        => __( 'Repair reviewed by our team', 'drywall-toolbox' ),
		'repair.info_requested'  => __( 'Additional information requested', 'drywall-toolbox' ),
		'repair.approved'        => __( 'Repair approved', 'drywall-toolbox' ),
		'repair.quoted'          => __( 'Quote sent to you', 'drywall-toolbox' ),
		'repair.quote_accepted'  => __( 'Quote accepted', 'drywall-toolbox' ),
		'repair.quote_declined'  => __( 'Quote declined', 'drywall-toolbox' ),
		'repair.parts_allocated' => __( 'Parts allocated for your repair', 'drywall-toolbox' ),
		'repair.in_progress'     => __( 'Repair work started', 'drywall-toolbox' ),
		'repair.ready_to_ship'   => __( 'Repair complete — preparing for shipment', 'drywall-toolbox' ),
		'repair.completed'       => __( 'Repair completed', 'drywall-toolbox' ),
		'repair.closed'          => __( 'Repair case closed', 'drywall-toolbox' ),
		'repair.cancelled'       => __( 'Repair request cancelled', 'drywall-toolbox' ),
		'repair.media_uploaded'  => __( 'Media uploaded', 'drywall-toolbox' ),
	];
}

/**
 * Return the customer-visible event timeline for a repair.
 *
 * Each element is safe for exposure in the public status projection.
 *
 * @param int $repair_id
 * @return array[] Array of timeline items.
 */
function dtb_repair_get_customer_timeline( int $repair_id ): array {
	$events = dtb_repair_get_events( $repair_id, 'customer', 200 );
	$labels = dtb_repair_customer_event_labels();
	$items  = [];

	foreach ( $events as $ev ) {
		$label = $labels[ $ev->event_type ] ?? ucwords( str_replace( [ 'repair.', '_', '.' ], [ '', ' ', ' ' ], $ev->event_type ) );
		$items[] = [
			'id'          => (int) $ev->id,
			'type'        => $ev->event_type,
			'label'       => $label,
			'occurred_at' => $ev->created_at,
		];
	}

	return $items;
}

// =============================================================================
// SECTION 6 — READ: dtb_repair_get_last_event()
// =============================================================================

/**
 * Return the most recent event for a repair.
 *
 * @param int         $repair_id
 * @param string|null $visibility  Filter to a specific visibility level. Null = any.
 * @return object|null stdClass row or null.
 */
function dtb_repair_get_last_event( int $repair_id, ?string $visibility = null ): ?object {
	global $wpdb;

	$table = $wpdb->prefix . 'dtb_repair_events';

	if ( null !== $visibility ) {
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM `{$table}` WHERE repair_id = %d AND visibility = %s ORDER BY id DESC LIMIT 1",
				$repair_id,
				$visibility
			)
		);
	} else {
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT * FROM `{$table}` WHERE repair_id = %d ORDER BY id DESC LIMIT 1",
				$repair_id
			)
		);
	}

	return $row ?: null;
}

// =============================================================================
// SECTION 7 — UTILITY: dtb_repair_get_events_by_type()
// =============================================================================

/**
 * Return events of a specific type for a repair.
 *
 * Useful for checking whether a particular milestone has been logged.
 *
 * @param int    $repair_id
 * @param string $event_type
 * @param int    $limit
 * @return object[]
 */
function dtb_repair_get_events_by_type( int $repair_id, string $event_type, int $limit = 10 ): array {
	global $wpdb;

	$table = $wpdb->prefix . 'dtb_repair_events';

	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$rows = $wpdb->get_results(
		$wpdb->prepare(
			"SELECT * FROM `{$table}` WHERE repair_id = %d AND event_type = %s ORDER BY id DESC LIMIT %d",
			$repair_id,
			$event_type,
			max( 1, $limit )
		)
	);

	return is_array( $rows ) ? $rows : [];
}
