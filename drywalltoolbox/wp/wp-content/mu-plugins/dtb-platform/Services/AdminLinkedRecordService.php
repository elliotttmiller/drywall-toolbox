<?php
/**
 * DTB Platform — AdminLinkedRecordService
 *
 * Resolves cross-module linked records (order ↔ ticket ↔ return ↔ repair) for
 * the shared workbench contract and exposes confidence/source metadata on every
 * link so the UI can distinguish verified from inferred relationships.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Resolve all linked records for a given module record.
 *
 * @param string $module    'support' | 'returns' | 'repair'
 * @param int    $record_id The primary record ID in that module.
 * @return array{
 *   order_id: int|null,
 *   order_edit_url: string,
 *   order_status: string,
 *   customer_user_id: int|null,
 *   ticket_ids: int[],
 *   return_ids: int[],
 *   repair_ids: int[],
 *   veeqo_order_id: string,
 *   confidence: array<string, string>,
 *   synced_at: string,
 * }
 */
function dtb_admin_get_linked_records( string $module, int $record_id ): array {
	$result = [
		'order_id'         => null,
		'order_edit_url'   => '',
		'order_status'     => '',
		'customer_user_id' => null,
		'ticket_ids'       => [],
		'return_ids'       => [],
		'repair_ids'       => [],
		'veeqo_order_id'   => '',
		'confidence'       => [],
		'synced_at'        => gmdate( 'c' ),
	];

	switch ( $module ) {
		case 'repair':
			$result = dtb_admin_linked_from_repair( $record_id, $result );
			break;
		case 'support':
			$result = dtb_admin_linked_from_ticket( $record_id, $result );
			break;
		case 'returns':
			$result = dtb_admin_linked_from_return( $record_id, $result );
			break;
	}

	return $result;
}

/**
 * Build linked records starting from a repair record.
 *
 * @param int   $repair_id
 * @param array $r  Result skeleton.
 * @return array
 */
function dtb_admin_linked_from_repair( int $repair_id, array $r ): array {
	$order_id  = absint( get_post_meta( $repair_id, '_repair_order_id', true ) );
	$user_id   = absint( get_post_meta( $repair_id, '_repair_customer_user_id', true ) );
	$email     = sanitize_email( (string) get_post_meta( $repair_id, '_repair_customer_email', true ) );
	$veeqo_id  = (string) get_post_meta( $repair_id, '_repair_veeqo_order_id', true );

	if ( $order_id ) {
		$r['order_id']       = $order_id;
		$r['order_edit_url'] = (string) get_edit_post_link( $order_id );
		$r['confidence']['order'] = 'verified';

		if ( function_exists( 'wc_get_order' ) ) {
			$order = wc_get_order( $order_id );
			if ( $order ) {
				$r['order_status'] = $order->get_status();
				if ( ! $user_id ) {
					$user_id = absint( $order->get_customer_id() );
				}
				if ( ! $email ) {
					$email = sanitize_email( $order->get_billing_email() );
				}
			} else {
				$r['confidence']['order'] = 'orphaned';
			}
		}
	} else {
		$r['confidence']['order'] = 'not_linked';
	}

	if ( $user_id ) {
		$r['customer_user_id'] = $user_id;
	}
	if ( $veeqo_id ) {
		$r['veeqo_order_id']       = $veeqo_id;
		$r['confidence']['veeqo']  = 'verified';
	}

	// Cross-link: find tickets, returns by email/user.
	$r = dtb_admin_cross_link_by_email_user( $email, $user_id, 'repair', $repair_id, $r );

	return $r;
}

/**
 * Build linked records starting from a support ticket.
 *
 * @param int   $ticket_id
 * @param array $r  Result skeleton.
 * @return array
 */
function dtb_admin_linked_from_ticket( int $ticket_id, array $r ): array {
	global $wpdb;

	$table = $wpdb->prefix . 'dtb_support_tickets';
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
	if ( ! $exists ) {
		$r['confidence']['ticket'] = 'no_table';
		return $r;
	}

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$row = $wpdb->get_row( $wpdb->prepare( "SELECT order_id, customer_email, customer_user_id FROM {$table} WHERE id = %d", $ticket_id ) );
	if ( ! $row ) {
		$r['confidence']['ticket'] = 'not_found';
		return $r;
	}

	$order_id = absint( $row->order_id ?? 0 );
	$email    = sanitize_email( $row->customer_email ?? '' );
	$user_id  = absint( $row->customer_user_id ?? 0 );

	if ( $order_id ) {
		$r['order_id']       = $order_id;
		$r['order_edit_url'] = (string) get_edit_post_link( $order_id );
		$r['confidence']['order'] = 'verified';

		if ( function_exists( 'wc_get_order' ) ) {
			$order = wc_get_order( $order_id );
			if ( $order ) {
				$r['order_status'] = $order->get_status();
			} else {
				$r['confidence']['order'] = 'orphaned';
			}
		}
	} else {
		$r['confidence']['order'] = 'not_linked';
	}

	if ( $user_id ) {
		$r['customer_user_id'] = $user_id;
	}

	$r = dtb_admin_cross_link_by_email_user( $email, $user_id, 'support', $ticket_id, $r );

	return $r;
}

/**
 * Build linked records starting from a return.
 *
 * @param int   $return_id
 * @param array $r  Result skeleton.
 * @return array
 */
function dtb_admin_linked_from_return( int $return_id, array $r ): array {
	global $wpdb;

	$table = $wpdb->prefix . 'dtb_returns';
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) );
	if ( ! $exists ) {
		$r['confidence']['returns'] = 'no_table';
		return $r;
	}

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$row = $wpdb->get_row( $wpdb->prepare( "SELECT order_id, customer_email, customer_user_id FROM {$table} WHERE id = %d", $return_id ) );
	if ( ! $row ) {
		$r['confidence']['returns'] = 'not_found';
		return $r;
	}

	$order_id = absint( $row->order_id ?? 0 );
	$email    = sanitize_email( $row->customer_email ?? '' );
	$user_id  = absint( $row->customer_user_id ?? 0 );

	if ( $order_id ) {
		$r['order_id']       = $order_id;
		$r['order_edit_url'] = (string) get_edit_post_link( $order_id );
		$r['confidence']['order'] = 'verified';

		if ( function_exists( 'wc_get_order' ) ) {
			$order = wc_get_order( $order_id );
			if ( $order ) {
				$r['order_status'] = $order->get_status();
			} else {
				$r['confidence']['order'] = 'orphaned';
			}
		}
	} else {
		$r['confidence']['order'] = 'not_linked';
	}

	if ( $user_id ) {
		$r['customer_user_id'] = $user_id;
	}

	$r = dtb_admin_cross_link_by_email_user( $email, $user_id, 'returns', $return_id, $r );

	return $r;
}

/**
 * Cross-link tickets, returns, and repairs by customer email/user, excluding
 * the originating module record to prevent self-reference.
 *
 * @param string $email
 * @param int    $user_id
 * @param string $exclude_module  'support'|'returns'|'repair'
 * @param int    $exclude_id
 * @param array  $r
 * @return array
 */
function dtb_admin_cross_link_by_email_user( string $email, int $user_id, string $exclude_module, int $exclude_id, array $r ): array {
	global $wpdb;

	// ── Support tickets ──────────────────────────────────────────────────────
	if ( 'support' !== $exclude_module && ( $email || $user_id ) ) {
		$tickets_table = $wpdb->prefix . 'dtb_support_tickets';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$t_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $tickets_table ) );
		if ( $t_exists ) {
			if ( $email ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$ids = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$tickets_table} WHERE customer_email = %s", $email ) );
			} else {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$ids = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$tickets_table} WHERE customer_user_id = %d", $user_id ) );
			}
			$r['ticket_ids'] = array_values( array_map( 'absint', (array) $ids ) );
		}
	}

	// ── Returns ──────────────────────────────────────────────────────────────
	if ( 'returns' !== $exclude_module && ( $email || $user_id ) ) {
		$returns_table = $wpdb->prefix . 'dtb_returns';
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$rt_exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $returns_table ) );
		if ( $rt_exists ) {
			if ( $email ) {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$ids = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$returns_table} WHERE customer_email = %s", $email ) );
			} else {
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching,WordPress.DB.PreparedSQL.InterpolatedNotPrepared
				$ids = $wpdb->get_col( $wpdb->prepare( "SELECT id FROM {$returns_table} WHERE customer_user_id = %d", $user_id ) );
			}
			$r['return_ids'] = array_values( array_map( 'absint', (array) $ids ) );
		}
	}

	// ── Repairs ──────────────────────────────────────────────────────────────
	if ( 'repair' !== $exclude_module && ( $email || $user_id ) ) {
		$meta_query = [ 'relation' => 'OR' ];
		if ( $email ) {
			$meta_query[] = [ 'key' => '_repair_customer_email', 'value' => $email ];
		}
		if ( $user_id ) {
			$meta_query[] = [ 'key' => '_repair_customer_user_id', 'value' => $user_id, 'type' => 'NUMERIC' ];
		}
		$q = new WP_Query( [
			'post_type'      => 'dtb_repair_request',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'fields'         => 'ids',
			'meta_query'     => $meta_query, // phpcs:ignore WordPress.DB.SlowDBQuery
		] );
		$r['repair_ids'] = array_values( array_map( 'absint', $q->posts ) );
	}

	return $r;
}
