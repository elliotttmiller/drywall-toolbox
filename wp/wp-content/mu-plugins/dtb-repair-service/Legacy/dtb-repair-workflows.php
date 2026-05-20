<?php
/**
 * DTB Repair Workflows — Must-Use Plugin
 *
 * Canonical state machine for repair request status transitions.
 * All status changes MUST flow through dtb_transition_repair_status().
 *
 * Provides:
 *   dtb_get_repair_status()               — Read current status
 *   dtb_get_repair_status_label()         — Customer-facing label
 *   dtb_get_allowed_transitions()         — Full transition map
 *   dtb_is_valid_repair_transition()      — Validate a proposed transition
 *   dtb_transition_repair_status()        — THE CANONICAL TRANSITION FUNCTION
 *   dtb_get_repair_integration_state()    — Read integration state projection
 *   dtb_update_repair_integration_state() — Update one integration slice
 *   dtb_build_repair_status_projection()  — Customer-safe status response
 *
 * Depends on (loaded before this):
 *   dtb-repair-events.php  → dtb_repair_append_event()
 *   dtb-repair-queue.php   → dtb_repair_enqueue_job()
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// SECTION 1 — STATUS LABELS
// =============================================================================

/**
 * Return the customer-facing label for a repair status.
 *
 * @param string $status Internal status slug.
 * @return string Human-readable label.
 */
function dtb_get_repair_status_label( string $status ): string {
	$labels = [
		'submitted'        => __( 'Submitted', 'drywall-toolbox' ),
		'reviewed'         => __( 'Under Review', 'drywall-toolbox' ),
		'awaiting_customer'=> __( 'Waiting on Customer', 'drywall-toolbox' ),
		'approved'         => __( 'Approved', 'drywall-toolbox' ),
		'quoted'           => __( 'Quote Sent', 'drywall-toolbox' ),
		'quote_accepted'   => __( 'Quote Accepted', 'drywall-toolbox' ),
		'quote_declined'   => __( 'Quote Declined', 'drywall-toolbox' ),
		'parts_allocated'  => __( 'Parts Allocated', 'drywall-toolbox' ),
		'in_progress'      => __( 'Repair In Progress', 'drywall-toolbox' ),
		'ready_to_ship'    => __( 'Ready to Ship', 'drywall-toolbox' ),
		'completed'        => __( 'Completed', 'drywall-toolbox' ),
		'closed'           => __( 'Closed', 'drywall-toolbox' ),
		'cancelled'        => __( 'Cancelled', 'drywall-toolbox' ),
	];

	return $labels[ $status ] ?? ucwords( str_replace( '_', ' ', $status ) );
}

/**
 * Return all valid repair status slugs.
 *
 * @return string[]
 */
function dtb_get_all_repair_statuses(): array {
	return array_values( array_unique(
		array_merge( array_keys( dtb_get_allowed_transitions() ), [ 'closed', 'cancelled', 'quote_declined' ] )
	) );
}

// =============================================================================
// SECTION 2 — STATE MACHINE
// =============================================================================

/**
 * Return the allowed status transition map.
 *
 * Format: [ 'from_status' => [ 'to_status', ... ], ... ]
 *
 * Any active repair can be cancelled (handled separately in
 * dtb_is_valid_repair_transition / dtb_transition_repair_status).
 *
 * @return array<string, string[]>
 */
function dtb_get_allowed_transitions(): array {
	static $map = null;
	if ( null !== $map ) {
		return $map;
	}

	$map = [
		'submitted'         => [ 'reviewed', 'awaiting_customer', 'cancelled' ],
		'reviewed'          => [ 'approved', 'quoted', 'awaiting_customer', 'cancelled' ],
		'awaiting_customer' => [ 'reviewed', 'cancelled' ],
		'approved'          => [ 'parts_allocated', 'cancelled' ],
		'quoted'            => [ 'quote_accepted', 'quote_declined', 'cancelled' ],
		'quote_accepted'    => [ 'parts_allocated', 'cancelled' ],
		'quote_declined'    => [], // Terminal — no outbound transitions.
		'parts_allocated'   => [ 'in_progress', 'cancelled' ],
		'in_progress'       => [ 'ready_to_ship', 'cancelled' ],
		'ready_to_ship'     => [ 'completed', 'cancelled' ],
		'completed'         => [ 'closed' ],
		'closed'            => [], // Terminal.
		'cancelled'         => [], // Terminal.
	];

	return $map;
}

/**
 * Return the terminal statuses (no further transitions allowed).
 *
 * @return string[]
 */
function dtb_get_terminal_repair_statuses(): array {
	return [ 'closed', 'cancelled', 'quote_declined' ];
}

/**
 * Return true if a transition from $from to $to is valid.
 *
 * @param string $from Current status.
 * @param string $to   Proposed status.
 * @return bool
 */
function dtb_is_valid_repair_transition( string $from, string $to ): bool {
	$map = dtb_get_allowed_transitions();

	if ( ! isset( $map[ $from ] ) ) {
		return false;
	}

	return in_array( $to, $map[ $from ], true );
}

// =============================================================================
// SECTION 3 — STATUS READ
// =============================================================================

/**
 * Return the current status slug for a repair.
 *
 * @param int $repair_id
 * @return string  Empty string if the repair doesn't exist or has no status yet.
 */
function dtb_get_repair_status( int $repair_id ): string {
	return (string) get_post_meta( $repair_id, '_repair_status', true );
}

// =============================================================================
// SECTION 4 — CANONICAL TRANSITION FUNCTION
// =============================================================================

/**
 * Transition a repair to a new status.
 *
 * This is THE canonical function. All status changes MUST go through here.
 * Direct meta updates that bypass this function will leave the audit log and
 * integration queue in an inconsistent state.
 *
 * @param int    $repair_id  Post ID of the repair.
 * @param string $to_status  Target status slug.
 * @param array  $context {
 *   Optional transition context:
 *   @type string   $actor_type  'user' | 'customer' | 'system' | 'admin'
 *   @type int|null $actor_id    WP user ID performing the transition, if applicable.
 *   @type string   $source      Originating system ('admin', 'api', 'cron', 'webhook').
 *   @type array    $payload     Arbitrary data to attach to the transition event.
 *   @type string   $note        Optional internal note to log alongside the event.
 * }
 * @return true|WP_Error  true on success, WP_Error on validation or DB failure.
 */
function dtb_transition_repair_status( int $repair_id, string $to_status, array $context = [] ): bool|WP_Error {
	$post = get_post( $repair_id );

	if ( ! $post || 'dtb_repair_request' !== $post->post_type ) {
		return new WP_Error(
			'dtb_repair_not_found',
			sprintf( __( 'Repair #%d not found.', 'drywall-toolbox' ), $repair_id )
		);
	}

	$from_status = dtb_get_repair_status( $repair_id );

	if ( '' === $from_status ) {
		return new WP_Error(
			'dtb_repair_no_status',
			sprintf( __( 'Repair #%d has no current status set.', 'drywall-toolbox' ), $repair_id )
		);
	}

	if ( ! dtb_is_valid_repair_transition( $from_status, $to_status ) ) {
		return new WP_Error(
			'dtb_repair_invalid_transition',
			sprintf(
				/* translators: 1: from status, 2: to status */
				__( 'Cannot transition repair from "%1$s" to "%2$s".', 'drywall-toolbox' ),
				$from_status,
				$to_status
			)
		);
	}

	// Build actor context.
	$actor_type = sanitize_text_field( (string) ( $context['actor_type'] ?? 'system' ) );
	$actor_id   = isset( $context['actor_id'] ) ? absint( $context['actor_id'] ) : get_current_user_id();
	$source     = sanitize_text_field( (string) ( $context['source'] ?? 'system' ) );
	$payload    = is_array( $context['payload'] ?? null ) ? $context['payload'] : [];

	// --- Update meta ---
	update_post_meta( $repair_id, '_repair_status', $to_status );

	// Timestamp bookkeeping.
	$now = gmdate( 'Y-m-d\TH:i:s\Z' );
	$ts_map = [
		'reviewed'     => '_repair_reviewed_at',
		'completed'    => '_repair_completed_at',
		'closed'       => '_repair_closed_at',
	];

	if ( isset( $ts_map[ $to_status ] ) ) {
		update_post_meta( $repair_id, $ts_map[ $to_status ], $now );
	}

	// --- Append event ---
	if ( function_exists( 'dtb_repair_append_event' ) ) {
		$event_type_map = [
			'reviewed'          => 'repair.reviewed',
			'awaiting_customer' => 'repair.info_requested',
			'approved'          => 'repair.approved',
			'quoted'            => 'repair.quoted',
			'quote_accepted'    => 'repair.quote_accepted',
			'quote_declined'    => 'repair.quote_declined',
			'parts_allocated'   => 'repair.parts_allocated',
			'in_progress'       => 'repair.in_progress',
			'ready_to_ship'     => 'repair.ready_to_ship',
			'completed'         => 'repair.completed',
			'closed'            => 'repair.closed',
			'cancelled'         => 'repair.cancelled',
		];

		$event_type = $event_type_map[ $to_status ] ?? 'repair.status_changed';

		dtb_repair_append_event(
			$repair_id,
			$event_type,
			[
				'from_status' => $from_status,
				'to_status'   => $to_status,
				'actor_type'  => $actor_type,
				'actor_id'    => $actor_id ?: null,
				'source'      => $source,
				'payload'     => $payload,
			]
		);

		// Optional internal note.
		if ( ! empty( $context['note'] ) ) {
			dtb_repair_append_event(
				$repair_id,
				'repair.note_added',
				[
					'actor_type' => $actor_type,
					'actor_id'   => $actor_id ?: null,
					'source'     => $source,
					'visibility' => 'operator',
					'payload'    => [ 'note' => wp_kses_post( (string) $context['note'] ) ],
				]
			);
		}
	}

	// --- Schedule integration jobs ---
	dtb_repair_schedule_integration_jobs( $repair_id, $to_status, $context );

	/**
	 * Fires after a repair status transition completes.
	 *
	 * @param int    $repair_id
	 * @param string $from_status
	 * @param string $to_status
	 * @param array  $context
	 */
	do_action( 'dtb_repair_status_changed', $repair_id, $from_status, $to_status, $context );

	return true;
}

// =============================================================================
// SECTION 5 — INTEGRATION JOB SCHEDULING
// =============================================================================

/**
 * Schedule the appropriate integration jobs for a given transition.
 *
 * @param int    $repair_id
 * @param string $to_status
 * @param array  $context
 */
function dtb_repair_schedule_integration_jobs( int $repair_id, string $to_status, array $context = [] ): void {
	if ( ! function_exists( 'dtb_repair_enqueue_job' ) ) {
		return;
	}

	// Always queue a notification for every transition.
	dtb_repair_enqueue_job(
		'dtb_repair_send_notification',
		$repair_id,
		[ 'template' => dtb_repair_notification_template_for_status( $to_status ) ]
	);

	// Always refresh the integration state projection.
	dtb_repair_enqueue_job( 'dtb_repair_refresh_projection', $repair_id );

	switch ( $to_status ) {
		case 'approved':
			// Create a WooCommerce order once the repair is approved.
			dtb_repair_enqueue_job( 'dtb_repair_create_wc_order', $repair_id );
			break;

		case 'quote_accepted':
			// QB invoice on quote acceptance.
			dtb_repair_enqueue_job( 'dtb_repair_sync_quickbooks', $repair_id );
			break;

		case 'parts_allocated':
			// Veeqo parts reservation.
			dtb_repair_enqueue_job( 'dtb_repair_sync_veeqo', $repair_id, [ 'action' => 'reserve_parts' ] );
			break;

		case 'ready_to_ship':
			// Veeqo shipping / label creation.
			dtb_repair_enqueue_job( 'dtb_repair_sync_veeqo', $repair_id, [ 'action' => 'create_shipment' ] );
			break;

		case 'completed':
			// Issue loyalty rewards.
			dtb_repair_enqueue_job( 'dtb_repair_issue_rewards', $repair_id );
			// Recalculate final SLA.
			dtb_repair_enqueue_job( 'dtb_repair_recalculate_sla', $repair_id );
			break;

		case 'closed':
			// Archive the record.
			dtb_repair_enqueue_job( 'dtb_repair_archive_closed', $repair_id );
			break;
	}
}

/**
 * Map a target status to the appropriate notification template slug.
 *
 * @param string $to_status
 * @return string  Template slug, or empty string if no template for this status.
 */
function dtb_repair_notification_template_for_status( string $to_status ): string {
	$map = [
		'awaiting_customer' => 'repair-info-requested',
		'reviewed'          => 'repair-reviewed',
		'approved'          => 'repair-approved',
		'quoted'            => 'repair-quote-created',
		'quote_accepted'    => 'repair-quote-accepted',
		'in_progress'       => 'repair-in-progress',
		'ready_to_ship'     => 'repair-ready-to-ship',
		'completed'         => 'repair-completed',
		'cancelled'         => 'repair-cancelled',
	];

	return $map[ $to_status ] ?? '';
}

// =============================================================================
// SECTION 6 — INTEGRATION STATE PROJECTION
// =============================================================================

/**
 * Return the integration state for a repair.
 *
 * @param int $repair_id
 * @return array Integration state keyed by integration name.
 */
function dtb_get_repair_integration_state( int $repair_id ): array {
	$raw = (string) get_post_meta( $repair_id, '_repair_integration_state', true );

	if ( '' === $raw ) {
		return [
			'woocommerce' => [ 'state' => 'pending', 'order_id' => null, 'last_success_at' => null, 'last_error' => null ],
			'veeqo'       => [ 'state' => 'pending', 'tracking_number' => null, 'last_success_at' => null, 'last_error_code' => null ],
			'quickbooks'  => [ 'state' => 'pending', 'invoice_id' => null, 'last_success_at' => null, 'last_error_code' => null ],
			'rewards'     => [ 'state' => 'not_eligible', 'issued' => false ],
		];
	}

	$decoded = json_decode( $raw, true );
	return is_array( $decoded ) ? $decoded : [];
}

/**
 * Update one integration slice in the repair's integration state projection.
 *
 * Performs a shallow merge of $data into the existing integration entry.
 *
 * @param int    $repair_id    Post ID of the repair.
 * @param string $integration  Key: 'woocommerce' | 'veeqo' | 'quickbooks' | 'rewards'.
 * @param array  $data         Partial data to merge into the integration's state.
 */
function dtb_update_repair_integration_state( int $repair_id, string $integration, array $data ): void {
	$allowed = [ 'woocommerce', 'veeqo', 'quickbooks', 'rewards' ];

	if ( ! in_array( $integration, $allowed, true ) ) {
		return;
	}

	$state = dtb_get_repair_integration_state( $repair_id );
	$state[ $integration ] = array_merge( $state[ $integration ] ?? [], $data );

	update_post_meta( $repair_id, '_repair_integration_state', wp_json_encode( $state ) );
}

// =============================================================================
// SECTION 7 — STATUS PROJECTION (customer-safe response)
// =============================================================================

/**
 * Build the full customer-safe status projection for a repair.
 *
 * This is the shape returned by GET /dtb/v1/repairs/status/{repair_id}.
 * It contains no private data (no email, no internal notes, no admin links).
 *
 * @param int $repair_id
 * @return array
 */
function dtb_build_repair_status_projection( int $repair_id ): array {
	$status       = dtb_get_repair_status( $repair_id );
	$label        = dtb_get_repair_status_label( $status );
	$submitted_at = (string) get_post_meta( $repair_id, '_repair_submitted_at', true );

	// Determine last_updated_at from most recent customer-visible event.
	$last_event    = null;
	$last_updated  = '';

	if ( function_exists( 'dtb_repair_get_last_event' ) ) {
		$last_event   = dtb_repair_get_last_event( $repair_id );
		$last_updated = $last_event ? (string) $last_event->created_at : $submitted_at;
	}

	// Customer-visible timeline.
	$timeline = [];
	if ( function_exists( 'dtb_repair_get_customer_timeline' ) ) {
		$timeline = dtb_repair_get_customer_timeline( $repair_id );
	}

	// Tracking number — only expose when ready to ship or later.
	$tracking_number = null;
	$expose_tracking = in_array( $status, [ 'ready_to_ship', 'completed', 'closed' ], true );
	if ( $expose_tracking ) {
		$tracking_number = (string) get_post_meta( $repair_id, '_repair_veeqo_tracking', true ) ?: null;
	}

	return [
		'repair_id'            => $repair_id,
		'status'               => $status,
		'label'                => $label,
		'submitted_at'         => $submitted_at,
		'last_updated_at'      => $last_updated,
		'estimated_completion' => null, // TODO: implement SLA calculation.
		'tracking_number'      => $tracking_number,
		'timeline'             => $timeline,
	];
}
