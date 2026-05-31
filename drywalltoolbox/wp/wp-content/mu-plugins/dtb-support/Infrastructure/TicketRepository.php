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
 *
 * @return string
 */
function dtb_support_tickets_table(): string {
	global $wpdb;
	return $wpdb->prefix . 'dtb_support_tickets';
}

/**
 * Generate a unique ticket number (DTB-YYYYMMDD-XXXXX).
 *
 * Uses a GET_LOCK / RELEASE_LOCK guard to prevent sequence collisions under
 * concurrent submissions on shared MySQL hosts that lack SEQUENCE support.
 *
 * @return string
 */
function dtb_support_generate_ticket_number(): string {
	global $wpdb;
	$table = dtb_support_tickets_table();
	$date  = gmdate( 'Ymd' );

	// Acquire a named lock (waits up to 3 s before giving up and using a random fallback).
	$wpdb->get_var( "SELECT GET_LOCK('dtb_ticket_num', 3)" );

	// Find today's highest sequence.
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

	$wpdb->get_var( "SELECT RELEASE_LOCK('dtb_ticket_num')" );

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

	$row = [
		'ticket_number' => dtb_support_generate_ticket_number(),
		'status'        => sanitize_text_field( $data['status']        ?? 'open' ),
		'ticket_type'   => sanitize_text_field( $data['ticket_type']   ?? 'contact' ),
		'priority'      => sanitize_text_field( $data['priority']      ?? 'normal' ),
		'subject'       => sanitize_text_field( $data['subject']       ?? '' ),
		'customer_name' => sanitize_text_field( $data['customer_name'] ?? '' ),
		'customer_email'=> sanitize_email(      $data['customer_email']?? '' ),
		'customer_phone'=> sanitize_text_field( $data['customer_phone']?? '' ),
		'company'       => sanitize_text_field( $data['company']       ?? '' ),
		'message'       => wp_kses_post(         $data['message']       ?? '' ),
		'source'        => sanitize_text_field( $data['source']        ?? 'website' ),
		'order_id'      => isset( $data['order_id'] ) ? absint( $data['order_id'] ) : null,
		'tags'          => sanitize_text_field( $data['tags']          ?? '' ),
		'created_at'    => $now,
		'updated_at'    => $now,
	];

	$formats = [
		'%s','%s','%s','%s','%s',
		'%s','%s','%s','%s','%s',
		'%s','%d','%s','%s','%s',
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
 *
 * @param int $ticket_id
 * @return object|null
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
 * @param array $args {
 *   @type string   $status        Filter by status slug (or 'all').
 *   @type string   $type          Filter by ticket_type.
 *   @type string   $priority      Filter by priority.
 *   @type int      $assigned_to   Filter by assigned_user_id.
 *   @type string   $search        Full-text search across subject/name/email.
 *   @type string   $orderby       Column to sort by. Default 'created_at'.
 *   @type string   $order         'ASC'|'DESC'. Default 'DESC'.
 *   @type int      $per_page      Default 25.
 *   @type int      $page          1-indexed. Default 1.
 * }
 * @return array{ tickets: object[], total: int }
 */
function dtb_support_query_tickets( array $args = [] ): array {
	global $wpdb;
	$table = dtb_support_tickets_table();

	$status      = sanitize_text_field( $args['status']   ?? 'all' );
	$type        = sanitize_text_field( $args['type']     ?? '' );
	$priority    = sanitize_text_field( $args['priority'] ?? '' );
	$assigned_to = isset( $args['assigned_to'] ) ? absint( $args['assigned_to'] ) : 0;
	$search      = sanitize_text_field( $args['search']   ?? '' );
	$orderby     = in_array( $args['orderby'] ?? $args['order_by'] ?? '', [ 'created_at', 'updated_at', 'priority', 'status', 'customer_name' ], true )
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

	$total_params = $params;
	$rows_params  = array_merge( $params, [ $per_page, $offset ] );

	$total   = (int) ( $params ? $wpdb->get_var( $wpdb->prepare( $total_sql, ...$total_params ) ) : $wpdb->get_var( $total_sql ) );
	$tickets = $params ? $wpdb->get_results( $wpdb->prepare( $rows_sql, ...$rows_params ) ) : $wpdb->get_results( $wpdb->prepare( $rows_sql, $per_page, $offset ) );

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
 * @return array<string,int>  Keys are status slugs.
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
