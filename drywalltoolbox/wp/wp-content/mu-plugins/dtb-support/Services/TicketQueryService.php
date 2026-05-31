<?php
/**
 * Services — TicketQueryService: rich read-model projections for admin UIs.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Project a raw DB ticket row into a fully-enriched admin view model.
 *
 * @param object $ticket  Raw DB row from dtb_support_get_ticket() or dtb_support_query_tickets().
 * @return array
 */
function dtb_support_project_ticket( object $ticket ): array {
	$status   = $ticket->status;
	$priority = $ticket->priority;

	$is_resolved = in_array( $status, [ 'resolved', 'closed', 'spam' ], true );
	$sla_state   = dtb_support_sla_state( $ticket->created_at, $priority, $is_resolved );

	$age_seconds = time() - strtotime( $ticket->created_at );
	$age_label   = dtb_support_age_label( $age_seconds );

	$assigned_user = null;
	if ( ! empty( $ticket->assigned_user_id ) ) {
		$u = get_userdata( (int) $ticket->assigned_user_id );
		if ( $u ) {
			$assigned_user = [
				'id'           => $u->ID,
				'display_name' => $u->display_name,
				'email'        => $u->user_email,
				'avatar'       => get_avatar_url( $u->ID, [ 'size' => 36 ] ),
			];
		}
	}

	return [
		'id'             => (int) $ticket->id,
		'ticket_number'  => $ticket->ticket_number,
		'status'         => $status,
		'status_label'   => dtb_support_status_label( $status ),
		'status_css'     => dtb_support_status_css( $status ),
		'ticket_type'    => $ticket->ticket_type,
		'type_label'     => dtb_support_type_label( $ticket->ticket_type ),
		'priority'       => $priority,
		'priority_label' => dtb_support_priority_label( $priority ),
		'subject'        => $ticket->subject,
		'customer_name'  => $ticket->customer_name,
		'customer_email' => $ticket->customer_email,
		'customer_phone' => $ticket->customer_phone,
		'company'        => $ticket->company,
		'message'        => $ticket->message,
		'source'         => $ticket->source,
		'order_id'       => $ticket->order_id ? (int) $ticket->order_id : null,
		'tags'           => array_filter( explode( ',', $ticket->tags ?? '' ) ),
		'assigned_user'  => $assigned_user,
		'sla_state'      => $sla_state,
		'age_label'      => $age_label,
		'first_reply_at' => $ticket->first_reply_at,
		'resolved_at'    => $ticket->resolved_at,
		'closed_at'      => $ticket->closed_at,
		'created_at'     => $ticket->created_at,
		'updated_at'     => $ticket->updated_at,
		'edit_url'       => admin_url( 'admin.php?page=dtb-support&ticket_id=' . $ticket->id ),
	];
}

/**
 * Return a human-readable age string (e.g. "5m", "2h", "3d").
 *
 * @param int $seconds  Age in seconds.
 * @return string
 */
function dtb_support_age_label( int $seconds ): string {
	if ( $seconds < 60 ) {
		return 'just now';
	}
	if ( $seconds < 3600 ) {
		return round( $seconds / 60 ) . 'm';
	}
	if ( $seconds < 86400 ) {
		return round( $seconds / 3600 ) . 'h';
	}
	return round( $seconds / 86400 ) . 'd';
}

/**
 * Return KPI summary counts for the support dashboard.
 *
 * @return array{
 *   total: int, open: int, pending_customer: int, pending_staff: int,
 *   in_progress: int, resolved: int, closed: int, spam: int,
 *   urgent: int, high: int, unassigned: int, sla_breach: int
 * }
 */
function dtb_support_get_kpis(): array {
	global $wpdb;
	$table = dtb_support_tickets_table();

	$by_status = dtb_support_count_by_status();
	$total     = array_sum( $by_status );

	// Urgent and high priority open tickets.
	$urgent = (int) $wpdb->get_var(
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		"SELECT COUNT(*) FROM {$table} WHERE priority = 'urgent' AND status NOT IN ('resolved','closed','spam')"
	);
	$high   = (int) $wpdb->get_var(
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		"SELECT COUNT(*) FROM {$table} WHERE priority = 'high' AND status NOT IN ('resolved','closed','spam')"
	);

	// Unassigned open tickets.
	$unassigned = (int) $wpdb->get_var(
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		"SELECT COUNT(*) FROM {$table} WHERE assigned_user_id IS NULL AND status NOT IN ('resolved','closed','spam')"
	);

	// SLA breached (open tickets older than their SLA threshold).
	// Approximate breach count using the 'normal' SLA (24 h) as the default scan window.
	$breach_rows = $wpdb->get_results(
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		"SELECT priority, created_at FROM {$table} WHERE status NOT IN ('resolved','closed','spam')"
	);
	$sla_breach  = 0;
	foreach ( (array) $breach_rows as $row ) {
		if ( 'breach' === dtb_support_sla_state( $row->created_at, $row->priority ) ) {
			$sla_breach++;
		}
	}

	return [
		'total'            => $total,
		'open'             => $by_status['open']             ?? 0,
		'pending_customer' => $by_status['pending_customer'] ?? 0,
		'pending_staff'    => $by_status['pending_staff']    ?? 0,
		'in_progress'      => $by_status['in_progress']      ?? 0,
		'resolved'         => $by_status['resolved']         ?? 0,
		'closed'           => $by_status['closed']           ?? 0,
		'spam'             => $by_status['spam']             ?? 0,
		'urgent'           => $urgent,
		'high'             => $high,
		'unassigned'       => $unassigned,
		'sla_breach'       => $sla_breach,
	];
}
