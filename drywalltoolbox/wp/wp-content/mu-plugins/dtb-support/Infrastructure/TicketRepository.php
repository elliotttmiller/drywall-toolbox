<?php
/**
 * Infrastructure — TicketRepository: all CRUD and query operations against wp_dtb_support_tickets.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/**
 * Return the fully-qualified tickets table name.
 */
function dtb_support_tickets_table(): string {
	global $wpdb;
	return $wpdb->prefix . 'dtb_support_tickets';
}

/**
 * Generate a unique ticket number (DTB-YYYYMMDD-XXXXX).
 */
function dtb_support_generate_ticket_number(): string {
	global $wpdb;
	$table    = dtb_support_tickets_table();
	$date     = gmdate( 'Ymd' );
	$acquired = false;

	$lock_result = $wpdb->get_var( "SELECT GET_LOCK('dtb_ticket_num', 3)" );
	if ( '1' === (string) $lock_result ) {
		$acquired = true;
	}

	try {
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		$last = $wpdb->get_var( $wpdb->prepare(
			"SELECT ticket_number FROM {$table} WHERE ticket_number LIKE %s ORDER BY id DESC LIMIT 1",
			"DTB-{$date}-%"
		) );

		$seq = 1;
		if ( $last ) {
			$parts = explode( '-', $last );
			$seq   = ( (int) end( $parts ) ) + 1;
		}

		$number = sprintf( 'DTB-%s-%05d', $date, $seq );
	} finally {
		if ( $acquired ) {
			$wpdb->get_var( "SELECT RELEASE_LOCK('dtb_ticket_num')" );
		}
	}

	return $number;
}

// ---------------------------------------------------------------------------
// WRITE OPERATIONS
// ---------------------------------------------------------------------------

/**
 * Insert a new ticket row and return its ID, or WP_Error on failure.
 *
 * @param array $data Sanitised field values.
 * @return int|WP_Error
 */
function dtb_support_create_ticket( array $data ): int|WP_Error {
	global $wpdb;
	$table = dtb_support_tickets_table();
	$now   = gmdate( 'Y-m-d H:i:s' );

	$metadata_json = null;
	if ( isset( $data['metadata_json'] ) ) {
		$metadata_json = is_array( $data['metadata_json'] )
			? wp_json_encode( $data['metadata_json'] )
			: (string) $data['metadata_json'];
	} elseif ( ! empty( $data['meta'] ) && is_array( $data['meta'] ) ) {
		$metadata = $data['meta'];
		foreach ( [ 'ip_address', 'user_agent', 'product_id' ] as $meta_key ) {
			if ( isset( $data[ $meta_key ] ) && '' !== (string) $data[ $meta_key ] ) {
				$metadata[ $meta_key ] = $data[ $meta_key ];
			}
		}
		$metadata_json = wp_json_encode( $metadata );
	} elseif ( ! empty( $data['ip_address'] ) || ! empty( $data['user_agent'] ) || ! empty( $data['product_id'] ) ) {
		$metadata_json = wp_json_encode( array_filter( [
			'ip_address' => $data['ip_address'] ?? null,
			'user_agent' => $data['user_agent'] ?? null,
			'product_id' => isset( $data['product_id'] ) ? absint( $data['product_id'] ) : null,
		], static fn( $value ) => null !== $value && '' !== $value ) );
	}

	$row = [
		'ticket_number'            => dtb_support_generate_ticket_number(),
		'status'                   => sanitize_text_field( $data['status'] ?? 'open' ),
		'ticket_type'              => sanitize_text_field( $data['ticket_type'] ?? 'contact' ),
		'priority'                 => sanitize_text_field( $data['priority'] ?? 'normal' ),
		'subject'                  => sanitize_text_field( $data['subject'] ?? '' ),
		'customer_name'            => sanitize_text_field( $data['customer_name'] ?? '' ),
		'customer_email'           => sanitize_email( $data['customer_email'] ?? '' ),
		'customer_phone'           => sanitize_text_field( $data['customer_phone'] ?? '' ),
		'company'                  => sanitize_text_field( $data['company'] ?? '' ),
		'message'                  => wp_kses_post( $data['message'] ?? '' ),
		'source'                   => sanitize_text_field( $data['source'] ?? 'website' ),
		'order_id'                 => isset( $data['order_id'] ) ? absint( $data['order_id'] ) : null,
		'tags'                     => sanitize_text_field( $data['tags'] ?? '' ),
		'sla_first_response_due'   => ! empty( $data['sla_first_response_due'] ) ? (string) $data['sla_first_response_due'] : null,
		'sla_resolution_due'       => ! empty( $data['sla_resolution_due'] ) ? (string) $data['sla_resolution_due'] : null,
		'sla_state'                => sanitize_text_field( $data['sla_state'] ?? 'ok' ),
		'priority_score'           => isset( $data['priority_score'] ) ? (int) $data['priority_score'] : 0,
		'metadata_json'            => $metadata_json,
		'notification_status'      => 'pending',
		'created_at'               => $now,
		'updated_at'               => $now,
	];

	$formats = [
		'%s','%s','%s','%s','%s',
		'%s','%s','%s','%s','%s',
		'%s','%d','%s','%s','%s',
		'%s','%s','%d','%s','%s',
		'%s','%s',
	];

	if ( is_null( $row['order_id'] ) ) {
		unset( $row['order_id'] );
		array_splice( $formats, 11, 1 );
	}

	$inserted = $wpdb->insert( $table, $row, $formats );
	if ( false === $inserted ) {
		return new WP_Error( 'dtb_support_db_error', __( 'Could not create support ticket.', 'drywall-toolbox' ) );
	}

	return (int) $wpdb->insert_id;
}

/**
 * Update mutable fields on an existing ticket.
 *
 * @param int   $ticket_id
 * @param array $data Partial field map (only provided keys are updated).
 * @return bool|WP_Error
 */
function dtb_support_update_ticket( int $ticket_id, array $data ): bool|WP_Error {
	global $wpdb;
	$table = dtb_support_tickets_table();

	$allowed = [
		'status', 'priority', 'ticket_type', 'subject',
		'assigned_user_id', 'tags', 'internal_notes',
		'first_reply_at', 'resolved_at', 'closed_at',
		'sla_first_response_due', 'sla_resolution_due', 'sla_state',
		'last_customer_reply_at', 'last_staff_reply_at',
		'priority_score', 'metadata_json',
		'snooze_until', 'snooze_reason', 'followup_due_at',
		'notification_status', 'notification_fail_count', 'notification_last_sent_at',
	];

	$update = [ 'updated_at' => gmdate( 'Y-m-d H:i:s' ) ];
	foreach ( $allowed as $field ) {
		if ( array_key_exists( $field, $data ) ) {
			$update[ $field ] = $data[ $field ];
		}
	}

	$result = $wpdb->update( $table, $update, [ 'id' => $ticket_id ] );
	if ( false === $result ) {
		return new WP_Error( 'dtb_support_db_error', __( 'Could not update ticket.', 'drywall-toolbox' ) );
	}
	return true;
}

// ---------------------------------------------------------------------------
// READ OPERATIONS
// ---------------------------------------------------------------------------

/**
 * Return a single ticket row by ID, or null.
 */
function dtb_support_get_ticket( int $ticket_id ): ?object {
	global $wpdb;
	$table = dtb_support_tickets_table();
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	return $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d LIMIT 1", $ticket_id ) );
}

/**
 * Fetch a paginated, filtered list of ticket rows.
 *
 * @param array $args Query args.
 * @return array{ tickets: object[], total: int, page: int, per_page: int, page_count: int }
 */
function dtb_support_query_tickets( array $args = [] ): array {
	global $wpdb;
	$table = dtb_support_tickets_table();

	$status      = sanitize_text_field( $args['status'] ?? 'all' );
	$type        = sanitize_text_field( $args['type'] ?? '' );
	$priority    = sanitize_text_field( $args['priority'] ?? '' );
	$assigned_to = isset( $args['assigned_to'] ) ? absint( $args['assigned_to'] ) : 0;
	$search      = sanitize_text_field( $args['search'] ?? '' );
	$orderby     = in_array( $args['orderby'] ?? $args['order_by'] ?? '', [ 'created_at', 'updated_at', 'priority', 'status', 'customer_name', 'priority_score' ], true )
		? ( $args['orderby'] ?? $args['order_by'] )
		: 'created_at';
	$order       = strtoupper( $args['order'] ?? 'DESC' ) === 'ASC' ? 'ASC' : 'DESC';
	$per_page    = min( 200, max( 1, (int) ( $args['per_page'] ?? 25 ) ) );
	$page        = max( 1, (int) ( $args['page'] ?? 1 ) );
	$offset      = ( $page - 1 ) * $per_page;

	$where  = [];
	$params = [];

	if ( 'all' !== $status && '' !== $status ) {
		$where[]  = 'status = %s';
		$params[] = $status;
	}
	if ( '' !== $type ) {
		$where[]  = 'ticket_type = %s';
		$params[] = $type;
	}
	if ( '' !== $priority ) {
		$where[]  = 'priority = %s';
		$params[] = $priority;
	}
	if ( $assigned_to > 0 ) {
		$where[]  = 'assigned_user_id = %d';
		$params[] = $assigned_to;
	}
	if ( '' !== $search ) {
		$like     = '%' . $wpdb->esc_like( $search ) . '%';
		$where[]  = '(subject LIKE %s OR customer_name LIKE %s OR customer_email LIKE %s OR ticket_number LIKE %s)';
		$params[] = $like;
		$params[] = $like;
		$params[] = $like;
		$params[] = $like;
	}

	$where_sql = $where ? 'WHERE ' . implode( ' AND ', $where ) : '';

	// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$total_sql = "SELECT COUNT(*) FROM {$table} {$where_sql}";
	$rows_sql  = "SELECT * FROM {$table} {$where_sql} ORDER BY {$orderby} {$order} LIMIT %d OFFSET %d";
	// phpcs:enable

	$total = (int) ( $params ? $wpdb->get_var( $wpdb->prepare( $total_sql, ...$params ) ) : $wpdb->get_var( $total_sql ) );
	$tickets = $params
		? $wpdb->get_results( $wpdb->prepare( $rows_sql, ...array_merge( $params, [ $per_page, $offset ] ) ) )
		: $wpdb->get_results( $wpdb->prepare( $rows_sql, $per_page, $offset ) );

	return [
		'tickets'    => $tickets ?: [],
		'total'      => $total,
		'page'       => $page,
		'per_page'   => $per_page,
		'page_count' => $per_page > 0 ? (int) ceil( $total / $per_page ) : 1,
	];
}

/**
 * Return tickets for a named smart queue, sorted by priority score.
 *
 * Queues: needs_reply, sla_at_risk, sla_breached, unassigned, urgent,
 *         in_progress, waiting_on_customer, snoozed, resolved_pending_close, all_active.
 */
function dtb_support_query_queue( string $queue, array $args = [] ): array {
	global $wpdb;
	$table    = dtb_support_tickets_table();
	$per_page = min( 200, max( 1, (int) ( $args['per_page'] ?? 25 ) ) );
	$page     = max( 1, (int) ( $args['page'] ?? 1 ) );
	$offset   = ( $page - 1 ) * $per_page;
	$active   = "(snooze_until IS NULL OR snooze_until <= UTC_TIMESTAMP())";

	$map = [
		'needs_reply'            => "status IN ('open','pending_staff','in_progress') AND {$active}",
		'sla_at_risk'            => "sla_state = 'warning' AND status NOT IN ('resolved','closed','spam') AND {$active}",
		'sla_breached'           => "sla_state = 'breach' AND status NOT IN ('resolved','closed','spam') AND {$active}",
		'unassigned'             => "assigned_user_id IS NULL AND status NOT IN ('resolved','closed','spam') AND {$active}",
		'urgent'                 => "priority = 'urgent' AND status NOT IN ('resolved','closed','spam') AND {$active}",
		'in_progress'            => "status = 'in_progress' AND {$active}",
		'waiting_on_customer'    => "status = 'pending_customer' AND {$active}",
		'snoozed'                => "snooze_until IS NOT NULL AND snooze_until > UTC_TIMESTAMP() AND status NOT IN ('resolved','closed','spam')",
		'resolved_pending_close' => "status = 'resolved'",
		'all_active'             => "status NOT IN ('resolved','closed','spam') AND {$active}",
	];

	$where_sql = $map[ $queue ] ?? $map['needs_reply'];
	// phpcs:disable WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$total     = (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$table} WHERE {$where_sql}" );
	$tickets   = $wpdb->get_results( $wpdb->prepare(
		"SELECT * FROM {$table} WHERE {$where_sql} ORDER BY priority_score DESC, created_at ASC LIMIT %d OFFSET %d",
		$per_page,
		$offset
	) );
	// phpcs:enable

	return [
		'tickets'    => $tickets ?: [],
		'total'      => $total,
		'page'       => $page,
		'per_page'   => $per_page,
		'page_count' => $per_page > 0 ? (int) ceil( $total / $per_page ) : 1,
	];
}

/**
 * Return aggregate counts per-status (for KPI badges).
 *
 * @return array<string,int>
 */
function dtb_support_count_by_status(): array {
	global $wpdb;
	$table = dtb_support_tickets_table();
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$rows  = $wpdb->get_results( "SELECT status, COUNT(*) AS cnt FROM {$table} GROUP BY status" );

	$map = [];
	foreach ( (array) $rows as $row ) {
		$map[ $row->status ] = (int) $row->cnt;
	}
	return $map;
}

/**
 * Return counts for all smart queues.
 */
function dtb_support_get_queue_counts(): array {
	global $wpdb;
	$table = dtb_support_tickets_table();
	// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$row = $wpdb->get_row( "SELECT
		SUM(CASE WHEN status IN ('open','pending_staff','in_progress') AND (snooze_until IS NULL OR snooze_until <= UTC_TIMESTAMP()) THEN 1 ELSE 0 END) AS needs_reply,
		SUM(CASE WHEN sla_state = 'warning' AND status NOT IN ('resolved','closed','spam') AND (snooze_until IS NULL OR snooze_until <= UTC_TIMESTAMP()) THEN 1 ELSE 0 END) AS sla_at_risk,
		SUM(CASE WHEN sla_state = 'breach' AND status NOT IN ('resolved','closed','spam') AND (snooze_until IS NULL OR snooze_until <= UTC_TIMESTAMP()) THEN 1 ELSE 0 END) AS sla_breached,
		SUM(CASE WHEN assigned_user_id IS NULL AND status NOT IN ('resolved','closed','spam') AND (snooze_until IS NULL OR snooze_until <= UTC_TIMESTAMP()) THEN 1 ELSE 0 END) AS unassigned,
		SUM(CASE WHEN priority = 'urgent' AND status NOT IN ('resolved','closed','spam') AND (snooze_until IS NULL OR snooze_until <= UTC_TIMESTAMP()) THEN 1 ELSE 0 END) AS urgent,
		SUM(CASE WHEN status = 'in_progress' AND (snooze_until IS NULL OR snooze_until <= UTC_TIMESTAMP()) THEN 1 ELSE 0 END) AS in_progress,
		SUM(CASE WHEN status = 'pending_customer' AND (snooze_until IS NULL OR snooze_until <= UTC_TIMESTAMP()) THEN 1 ELSE 0 END) AS waiting_on_customer,
		SUM(CASE WHEN snooze_until IS NOT NULL AND snooze_until > UTC_TIMESTAMP() AND status NOT IN ('resolved','closed','spam') THEN 1 ELSE 0 END) AS snoozed,
		SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_pending_close,
		SUM(CASE WHEN status NOT IN ('resolved','closed','spam') AND (snooze_until IS NULL OR snooze_until <= UTC_TIMESTAMP()) THEN 1 ELSE 0 END) AS all_active
	FROM {$table}" , ARRAY_A );

	$counts = [];
	foreach ( [ 'needs_reply', 'sla_at_risk', 'sla_breached', 'unassigned', 'urgent', 'in_progress', 'waiting_on_customer', 'snoozed', 'resolved_pending_close', 'all_active' ] as $key ) {
		$counts[ $key ] = isset( $row[ $key ] ) ? (int) $row[ $key ] : 0;
	}

	return $counts;
}
