<?php
/**
 * DTB Repair Queue — Must-Use Plugin
 *
 * Action Scheduler job handlers for all async repair integrations.
 * Falls back to wp_schedule_single_event() when Action Scheduler is absent.
 *
 * Job types:
 *   dtb_repair_create_wc_order      — Create WooCommerce order
 *   dtb_repair_sync_veeqo           — Sync with Veeqo
 *   dtb_repair_sync_quickbooks      — Sync with QuickBooks Online
 *   dtb_repair_issue_rewards        — Issue loyalty rewards
 *   dtb_repair_send_notification    — Send customer/admin email
 *   dtb_repair_recalculate_sla      — Recalculate SLA age/breach
 *   dtb_repair_archive_closed       — Archive after closure
 *   dtb_repair_refresh_projection   — Refresh integration state projection
 *
 * Depends on (loaded before this):
 *   dtb-repair-events.php     → dtb_repair_append_event()
 *   dtb-repair-workflows.php  → dtb_update_repair_integration_state()
 *   dtb-repair-notifications.php → dtb_repair_dispatch_notification()
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// SECTION 1 — CENTRAL JOB ENQUEUE
// =============================================================================

/** Max retry attempts for retryable job failures. */
if ( ! defined( 'DTB_REPAIR_JOB_MAX_RETRIES' ) ) {
	define( 'DTB_REPAIR_JOB_MAX_RETRIES', 3 );
}

/** Base retry backoff delay in seconds (doubles per attempt). */
if ( ! defined( 'DTB_REPAIR_JOB_RETRY_BASE' ) ) {
	define( 'DTB_REPAIR_JOB_RETRY_BASE', 300 );
}

/**
 * Enqueue an async repair job.
 *
 * Uses Action Scheduler when available; falls back to wp_schedule_single_event().
 * Provides soft idempotency: skips scheduling if an identical pending job exists
 * (only available with Action Scheduler's as_next_scheduled_action()).
 *
 * @param string $job_type   One of the dtb_repair_* action hook names.
 * @param int    $repair_id  Post ID of the repair.
 * @param array  $args       Additional args to pass to the job handler.
 * @param int    $delay      Seconds from now to run the job (default: 0 = immediate).
 * @return string|int|false  Action Scheduler action ID, WP cron timestamp, or false.
 */
function dtb_repair_enqueue_job( string $job_type, int $repair_id, array $args = [], int $delay = 0 ): string|int|false {
	if ( '' === $job_type || $repair_id <= 0 ) {
		return false;
	}

	// Skip notifications for empty templates.
	if ( 'dtb_repair_send_notification' === $job_type && empty( $args['template'] ) ) {
		return false;
	}

	$job_args = array_merge( [ 'repair_id' => $repair_id ], $args );

	if ( function_exists( 'as_schedule_single_action' ) ) {
		// Soft idempotency: check if the same job is already pending.
		if ( function_exists( 'as_next_scheduled_action' ) ) {
			$existing = as_next_scheduled_action( $job_type, [ $repair_id, $args ], 'dtb-repairs' );
			if ( false !== $existing ) {
				return $existing;
			}
		}

		return as_schedule_single_action(
			time() + max( 0, $delay ),
			$job_type,
			[ $repair_id, $args ],
			'dtb-repairs'
		);
	}

	// Fallback: WP cron.
	$timestamp = time() + max( 1, $delay );
	wp_schedule_single_event( $timestamp, $job_type, [ $repair_id, $args ] );
	return $timestamp;
}

// =============================================================================
// SECTION 2 — RETRY HELPER
// =============================================================================

/**
 * Re-enqueue a job with exponential backoff.
 *
 * @param string $job_type   Action hook name.
 * @param int    $repair_id  Repair post ID.
 * @param array  $args       Job args (should include 'retry_count').
 */
function dtb_repair_retry_job( string $job_type, int $repair_id, array $args = [] ): void {
	$retry_count = (int) ( $args['retry_count'] ?? 0 );

	if ( $retry_count >= DTB_REPAIR_JOB_MAX_RETRIES ) {
		error_log( "[DTB Repairs] Job '{$job_type}' for repair #{$repair_id} exceeded max retries ({$retry_count})." );
		return;
	}

	$delay             = DTB_REPAIR_JOB_RETRY_BASE * (int) pow( 2, $retry_count );
	$args['retry_count'] = $retry_count + 1;

	dtb_repair_enqueue_job( $job_type, $repair_id, $args, $delay );

	if ( function_exists( 'dtb_repair_append_event' ) ) {
		dtb_repair_append_event(
			$repair_id,
			'system.job_retry',
			[
				'visibility' => 'internal',
				'payload'    => [
					'job_type'    => $job_type,
					'retry_count' => $args['retry_count'],
					'delay'       => $delay,
				],
			]
		);
	}
}

// =============================================================================
// SECTION 3 — JOB: dtb_repair_create_wc_order
// =============================================================================

add_action( 'dtb_repair_create_wc_order', 'dtb_repair_job_create_wc_order', 10, 2 );

/**
 * Job handler: create a WooCommerce order for the repair.
 *
 * @param int   $repair_id
 * @param array $args
 */
function dtb_repair_job_create_wc_order( int $repair_id, array $args = [] ): void {
	try {
		// Guard: skip if already synced.
		$state = function_exists( 'dtb_get_repair_integration_state' )
			? dtb_get_repair_integration_state( $repair_id )
			: [];

		if ( ( $state['woocommerce']['state'] ?? '' ) === 'synced' ) {
			return;
		}

		$result = dtb_repair_create_woocommerce_order( $repair_id );

		if ( is_wp_error( $result ) ) {
			throw new RuntimeException( $result->get_error_message() );
		}

		if ( function_exists( 'dtb_update_repair_integration_state' ) ) {
			dtb_update_repair_integration_state(
				$repair_id,
				'woocommerce',
				[
					'state'          => 'synced',
					'order_id'       => $result,
					'last_success_at'=> gmdate( 'Y-m-d\TH:i:s\Z' ),
					'last_error'     => null,
				]
			);
		}

		update_post_meta( $repair_id, '_repair_wc_order_id', $result );

		if ( function_exists( 'dtb_repair_append_event' ) ) {
			dtb_repair_append_event( $repair_id, 'integration.wc.order_created', [
				'visibility' => 'operator',
				'payload'    => [ 'order_id' => $result ],
			] );
		}
	} catch ( Throwable $e ) {
		error_log( "[DTB Repairs] dtb_repair_create_wc_order failed for #{$repair_id}: " . $e->getMessage() );

		if ( function_exists( 'dtb_update_repair_integration_state' ) ) {
			dtb_update_repair_integration_state( $repair_id, 'woocommerce', [
				'state'      => 'error',
				'last_error' => $e->getMessage(),
			] );
		}

		if ( function_exists( 'dtb_repair_append_event' ) ) {
			dtb_repair_append_event( $repair_id, 'integration.wc.order_failed', [
				'visibility' => 'operator',
				'payload'    => [ 'error' => $e->getMessage(), 'retry_count' => $args['retry_count'] ?? 0 ],
			] );
		}

		dtb_repair_retry_job( 'dtb_repair_create_wc_order', $repair_id, $args );
	}
}

// =============================================================================
// SECTION 4 — JOB: dtb_repair_sync_veeqo
// =============================================================================

add_action( 'dtb_repair_sync_veeqo', 'dtb_repair_job_sync_veeqo', 10, 2 );

/**
 * Job handler: sync repair with Veeqo.
 *
 * @param int   $repair_id
 * @param array $args  May include 'action' => 'reserve_parts' | 'create_shipment'.
 */
function dtb_repair_job_sync_veeqo( int $repair_id, array $args = [] ): void {
	try {
		$veeqo_action = sanitize_text_field( (string) ( $args['action'] ?? 'reserve_parts' ) );

		if ( ! function_exists( 'dtb_veeqo_enabled' ) || ! dtb_veeqo_enabled() ) {
			error_log( "[DTB Repairs] Veeqo not configured — skipping sync for repair #{$repair_id}." );

			if ( function_exists( 'dtb_update_repair_integration_state' ) ) {
				dtb_update_repair_integration_state( $repair_id, 'veeqo', [
					'state'           => 'not_configured',
					'last_error_code' => 'veeqo_not_configured',
				] );
			}
			return;
		}

		// TODO: Wire to dtb_veeqo_request() from dtb-veeqo.php.
		// Suggested implementation:
		//   $brand  = get_post_meta( $repair_id, '_repair_tool_brand', true );
		//   $model  = get_post_meta( $repair_id, '_repair_model', true );
		//   $serial = get_post_meta( $repair_id, '_repair_serial', true );
		//
		// For 'reserve_parts':
		//   $result = dtb_veeqo_request( 'POST', '/orders', [], [ ... order payload ... ] );
		//
		// For 'create_shipment':
		//   $result = dtb_veeqo_request( 'POST', '/shipments', [], [ ... shipment payload ... ] );
		//   Store tracking: update_post_meta( $repair_id, '_repair_veeqo_tracking', $tracking_number );

		error_log( "[DTB Repairs] TODO: Veeqo {$veeqo_action} for repair #{$repair_id}. Wire dtb_veeqo_request() here." );

		if ( function_exists( 'dtb_update_repair_integration_state' ) ) {
			dtb_update_repair_integration_state( $repair_id, 'veeqo', [
				'state'          => 'stub_pending',
				'last_success_at'=> null,
				'last_error_code'=> null,
			] );
		}

		if ( function_exists( 'dtb_repair_append_event' ) ) {
			dtb_repair_append_event( $repair_id, 'integration.veeqo.synced', [
				'visibility' => 'operator',
				'payload'    => [ 'action' => $veeqo_action, 'stub' => true ],
			] );
		}
	} catch ( Throwable $e ) {
		error_log( "[DTB Repairs] dtb_repair_sync_veeqo failed for #{$repair_id}: " . $e->getMessage() );

		if ( function_exists( 'dtb_update_repair_integration_state' ) ) {
			dtb_update_repair_integration_state( $repair_id, 'veeqo', [
				'state'           => 'error',
				'last_error_code' => $e->getMessage(),
			] );
		}

		if ( function_exists( 'dtb_repair_append_event' ) ) {
			dtb_repair_append_event( $repair_id, 'integration.veeqo.failed', [
				'visibility' => 'operator',
				'payload'    => [ 'error' => $e->getMessage() ],
			] );
		}

		dtb_repair_retry_job( 'dtb_repair_sync_veeqo', $repair_id, $args );
	}
}

// =============================================================================
// SECTION 5 — JOB: dtb_repair_sync_quickbooks
// =============================================================================

add_action( 'dtb_repair_sync_quickbooks', 'dtb_repair_job_sync_quickbooks', 10, 2 );

/**
 * Job handler: create a QuickBooks Online invoice for the repair.
 *
 * @param int   $repair_id
 * @param array $args
 */
function dtb_repair_job_sync_quickbooks( int $repair_id, array $args = [] ): void {
	try {
		// Guard: skip if already synced.
		$state = function_exists( 'dtb_get_repair_integration_state' )
			? dtb_get_repair_integration_state( $repair_id )
			: [];

		if ( ( $state['quickbooks']['state'] ?? '' ) === 'synced' ) {
			return;
		}

		if ( ! function_exists( 'dtb_qbo_enabled' ) || ! dtb_qbo_enabled() ) {
			error_log( "[DTB Repairs] QuickBooks not configured — skipping invoice for repair #{$repair_id}." );

			if ( function_exists( 'dtb_update_repair_integration_state' ) ) {
				dtb_update_repair_integration_state( $repair_id, 'quickbooks', [
					'state'           => 'not_configured',
					'last_error_code' => 'qbo_not_configured',
				] );
			}
			return;
		}

		// TODO: Wire to dtb_qbo_request() from dtb-quickbooks.php.
		// Suggested implementation:
		//   $customer_name  = get_post_meta( $repair_id, '_repair_customer_name', true );
		//   $customer_email = get_post_meta( $repair_id, '_repair_customer_email', true );
		//   $service_tier   = get_post_meta( $repair_id, '_repair_service_tier', true );
		//
		//   $invoice_payload = [
		//     'CustomerRef' => [ 'value' => $qbo_customer_id ],
		//     'Line'        => [ [ 'Amount' => $repair_amount, 'DetailType' => 'SalesItemLineDetail', ... ] ],
		//   ];
		//   $result = dtb_qbo_request( 'POST', '/invoice', [], $invoice_payload );
		//   $invoice_id = $result['data']['Invoice']['Id'] ?? null;

		error_log( "[DTB Repairs] TODO: QuickBooks invoice for repair #{$repair_id}. Wire dtb_qbo_request() here." );

		if ( function_exists( 'dtb_update_repair_integration_state' ) ) {
			dtb_update_repair_integration_state( $repair_id, 'quickbooks', [
				'state'          => 'stub_pending',
				'invoice_id'     => null,
				'last_success_at'=> null,
				'last_error_code'=> null,
			] );
		}

		if ( function_exists( 'dtb_repair_append_event' ) ) {
			dtb_repair_append_event( $repair_id, 'integration.qbo.invoice_created', [
				'visibility' => 'operator',
				'payload'    => [ 'stub' => true ],
			] );
		}
	} catch ( Throwable $e ) {
		error_log( "[DTB Repairs] dtb_repair_sync_quickbooks failed for #{$repair_id}: " . $e->getMessage() );

		if ( function_exists( 'dtb_update_repair_integration_state' ) ) {
			dtb_update_repair_integration_state( $repair_id, 'quickbooks', [
				'state'           => 'error',
				'last_error_code' => $e->getMessage(),
			] );
		}

		if ( function_exists( 'dtb_repair_append_event' ) ) {
			dtb_repair_append_event( $repair_id, 'integration.qbo.invoice_failed', [
				'visibility' => 'operator',
				'payload'    => [ 'error' => $e->getMessage() ],
			] );
		}

		dtb_repair_retry_job( 'dtb_repair_sync_quickbooks', $repair_id, $args );
	}
}

// =============================================================================
// SECTION 6 — JOB: dtb_repair_issue_rewards
// =============================================================================

add_action( 'dtb_repair_issue_rewards', 'dtb_repair_job_issue_rewards', 10, 2 );

/**
 * Job handler: issue loyalty rewards for a completed repair.
 *
 * Idempotent: guarded by _repair_rewards_issued meta.
 *
 * @param int   $repair_id
 * @param array $args
 */
function dtb_repair_job_issue_rewards( int $repair_id, array $args = [] ): void {
	try {
		// Idempotency guard.
		if ( get_post_meta( $repair_id, '_repair_rewards_issued', true ) ) {
			return;
		}

		$user_id = (int) get_post_meta( $repair_id, '_repair_customer_user_id', true );
		if ( ! $user_id ) {
			// Guest repair — no user account to credit.
			if ( function_exists( 'dtb_update_repair_integration_state' ) ) {
				dtb_update_repair_integration_state( $repair_id, 'rewards', [
					'state'  => 'not_eligible',
					'issued' => false,
				] );
			}
			return;
		}

		// TODO: Wire to WPLoyalty via dtb-rewards.php earn engine.
		// Suggested implementation:
		//   $wc_order_id = (int) get_post_meta( $repair_id, '_repair_wc_order_id', true );
		//   if ( $wc_order_id ) {
		//     dtb_rewards_award_order_points( $wc_order_id );
		//   }

		error_log( "[DTB Repairs] TODO: Issue rewards for user #{$user_id} on repair #{$repair_id}. Wire WPLoyalty earn engine here." );

		$now = gmdate( 'Y-m-d\TH:i:s\Z' );
		update_post_meta( $repair_id, '_repair_rewards_issued', true );
		update_post_meta( $repair_id, '_repair_rewards_issued_at', $now );
		update_post_meta( $repair_id, '_repair_rewards_status', 'issued_stub' );

		if ( function_exists( 'dtb_update_repair_integration_state' ) ) {
			dtb_update_repair_integration_state( $repair_id, 'rewards', [
				'state'  => 'stub_issued',
				'issued' => true,
			] );
		}

		if ( function_exists( 'dtb_repair_append_event' ) ) {
			dtb_repair_append_event( $repair_id, 'integration.rewards.issued', [
				'visibility' => 'operator',
				'payload'    => [ 'user_id' => $user_id, 'stub' => true, 'issued_at' => $now ],
			] );
		}
	} catch ( Throwable $e ) {
		error_log( "[DTB Repairs] dtb_repair_issue_rewards failed for #{$repair_id}: " . $e->getMessage() );

		if ( function_exists( 'dtb_update_repair_integration_state' ) ) {
			dtb_update_repair_integration_state( $repair_id, 'rewards', [
				'state'  => 'error',
				'issued' => false,
			] );
		}

		if ( function_exists( 'dtb_repair_append_event' ) ) {
			dtb_repair_append_event( $repair_id, 'integration.rewards.failed', [
				'visibility' => 'operator',
				'payload'    => [ 'error' => $e->getMessage() ],
			] );
		}

		// Rewards failure is retryable (max 3 attempts).
		dtb_repair_retry_job( 'dtb_repair_issue_rewards', $repair_id, $args );
	}
}

// =============================================================================
// SECTION 7 — JOB: dtb_repair_send_notification
// =============================================================================

add_action( 'dtb_repair_send_notification', 'dtb_repair_job_send_notification', 10, 2 );

/**
 * Job handler: send a notification email for a repair.
 *
 * @param int   $repair_id
 * @param array $args  Must include 'template'.
 */
function dtb_repair_job_send_notification( int $repair_id, array $args = [] ): void {
	$template = sanitize_text_field( (string) ( $args['template'] ?? '' ) );
	if ( '' === $template ) {
		return;
	}

	if ( function_exists( 'dtb_repair_dispatch_notification' ) ) {
		dtb_repair_dispatch_notification( $repair_id, $template, $args['context'] ?? [] );
	} else {
		error_log( "[DTB Repairs] dtb_repair_dispatch_notification() not available — skipping '{$template}' for repair #{$repair_id}." );
	}
}

// =============================================================================
// SECTION 8 — JOB: dtb_repair_recalculate_sla
// =============================================================================

add_action( 'dtb_repair_recalculate_sla', 'dtb_repair_job_recalculate_sla', 10, 2 );

/**
 * Job handler: recalculate SLA age and breach status for a repair.
 *
 * Stores results as transient + post meta for display in the admin list table.
 *
 * @param int   $repair_id
 * @param array $args
 */
function dtb_repair_job_recalculate_sla( int $repair_id, array $args = [] ): void {
	$submitted_at_raw = (string) get_post_meta( $repair_id, '_repair_submitted_at', true );
	if ( '' === $submitted_at_raw ) {
		return;
	}

	$submitted = strtotime( $submitted_at_raw );
	if ( ! $submitted ) {
		return;
	}

	$age_days     = (int) floor( ( time() - $submitted ) / DAY_IN_SECONDS );
	$service_tier = (string) get_post_meta( $repair_id, '_repair_service_tier', true );

	// SLA thresholds in business days.
	$sla_days_map = [
		'express'  => 3,
		'standard' => 10,
		'warranty' => 21,
	];
	$sla_days = $sla_days_map[ $service_tier ] ?? 10;
	$breached = $age_days > $sla_days;

	update_post_meta( $repair_id, '_repair_sla_age_days', $age_days );
	update_post_meta( $repair_id, '_repair_sla_breached', $breached ? '1' : '0' );
	update_post_meta( $repair_id, '_repair_sla_threshold_days', $sla_days );

	if ( function_exists( 'dtb_repair_append_event' ) ) {
		dtb_repair_append_event( $repair_id, 'system.sla_recalculated', [
			'visibility' => 'internal',
			'payload'    => [
				'age_days'  => $age_days,
				'sla_days'  => $sla_days,
				'breached'  => $breached,
			],
		] );
	}
}

// =============================================================================
// SECTION 9 — JOB: dtb_repair_archive_closed
// =============================================================================

add_action( 'dtb_repair_archive_closed', 'dtb_repair_job_archive_closed', 10, 2 );

/**
 * Job handler: archive a closed repair.
 *
 * Currently sets a flag and logs the event. A future implementation could
 * move the post to a dedicated archive table or export to cold storage.
 *
 * @param int   $repair_id
 * @param array $args
 */
function dtb_repair_job_archive_closed( int $repair_id, array $args = [] ): void {
	$status = (string) get_post_meta( $repair_id, '_repair_status', true );

	if ( ! in_array( $status, [ 'closed', 'cancelled', 'quote_declined' ], true ) ) {
		// Repair is not in a terminal state; skip archiving.
		return;
	}

	update_post_meta( $repair_id, '_repair_archived', '1' );
	update_post_meta( $repair_id, '_repair_archived_at', gmdate( 'Y-m-d\TH:i:s\Z' ) );

	if ( function_exists( 'dtb_repair_append_event' ) ) {
		dtb_repair_append_event( $repair_id, 'system.archived', [
			'visibility' => 'internal',
			'payload'    => [ 'final_status' => $status ],
		] );
	}
}

// =============================================================================
// SECTION 10 — JOB: dtb_repair_refresh_projection
// =============================================================================

add_action( 'dtb_repair_refresh_projection', 'dtb_repair_job_refresh_projection', 10, 2 );

/**
 * Job handler: refresh the integration state projection meta.
 *
 * Reads all integration-related meta keys and rebuilds a coherent projection
 * that the admin UI and status endpoint can display without N+1 meta queries.
 *
 * @param int   $repair_id
 * @param array $args
 */
function dtb_repair_job_refresh_projection( int $repair_id, array $args = [] ): void {
	if ( ! function_exists( 'dtb_get_repair_integration_state' ) ) {
		return;
	}

	$state = dtb_get_repair_integration_state( $repair_id );

	// Re-sync live meta values into the projection.
	$wc_order_id = (int) get_post_meta( $repair_id, '_repair_wc_order_id', true );
	if ( $wc_order_id ) {
		$state['woocommerce']['order_id'] = $wc_order_id;
		if ( 'pending' === $state['woocommerce']['state'] ) {
			$state['woocommerce']['state'] = 'synced';
		}
	}

	$tracking = (string) get_post_meta( $repair_id, '_repair_veeqo_tracking', true );
	if ( '' !== $tracking ) {
		$state['veeqo']['tracking_number'] = $tracking;
	}

	$qb_invoice = (string) get_post_meta( $repair_id, '_repair_quickbooks_invoice_id', true );
	if ( '' !== $qb_invoice ) {
		$state['quickbooks']['invoice_id'] = $qb_invoice;
		if ( 'pending' === $state['quickbooks']['state'] ) {
			$state['quickbooks']['state'] = 'synced';
		}
	}

	$rewards_issued = (bool) get_post_meta( $repair_id, '_repair_rewards_issued', true );
	if ( $rewards_issued ) {
		$state['rewards']['state']  = 'issued';
		$state['rewards']['issued'] = true;
	}

	update_post_meta( $repair_id, '_repair_integration_state', wp_json_encode( $state ) );

	if ( function_exists( 'dtb_repair_append_event' ) ) {
		dtb_repair_append_event( $repair_id, 'system.projection_refresh', [
			'visibility' => 'internal',
		] );
	}
}

// =============================================================================
// SECTION 11 — WOOCOMMERCE ORDER CREATION
// =============================================================================

/**
 * Create a WooCommerce order for a repair request.
 *
 * Creates a pending WC order with a single service line item representing
 * the repair service.  Sets repair-specific order meta for easy lookup.
 *
 * @param int $repair_id  Post ID of the repair.
 * @return int|WP_Error   WooCommerce order ID on success, WP_Error on failure.
 */
function dtb_repair_create_woocommerce_order( int $repair_id ): int|WP_Error {
	if ( ! function_exists( 'wc_create_order' ) ) {
		return new WP_Error( 'wc_unavailable', __( 'WooCommerce is not active.', 'drywall-toolbox' ) );
	}

	$customer_email = sanitize_email( (string) get_post_meta( $repair_id, '_repair_customer_email', true ) );
	$customer_name  = sanitize_text_field( (string) get_post_meta( $repair_id, '_repair_customer_name', true ) );
	$service_tier   = sanitize_text_field( (string) get_post_meta( $repair_id, '_repair_service_tier', true ) );
	$brand          = sanitize_text_field( (string) get_post_meta( $repair_id, '_repair_tool_brand', true ) );
	$model          = sanitize_text_field( (string) get_post_meta( $repair_id, '_repair_model', true ) );
	$user_id        = (int) get_post_meta( $repair_id, '_repair_customer_user_id', true );

	// TODO: Wire real pricing — fetch from WC product catalogue or option.
	// Map service tiers to placeholder amounts for now.
	// Use the dtb_repair_service_tier_prices filter to configure from outside this file.
	$tier_prices = (array) apply_filters(
		'dtb_repair_service_tier_prices',
		[
			'standard' => 0.00, // Will be filled in by a quote.
			'express'  => 0.00,
			'warranty' => 0.00,
		],
		$service_tier,
		$repair_id
	);
	$line_amount = (float) ( $tier_prices[ $service_tier ] ?? 0.00 );

	$order_args = [];
	if ( $user_id ) {
		$order_args['customer_id'] = $user_id;
	}

	$order = wc_create_order( $order_args );

	if ( is_wp_error( $order ) ) {
		return $order;
	}

	// Set billing address from repair meta.
	$name_parts = explode( ' ', $customer_name, 2 );
	$order->set_billing_first_name( $name_parts[0] ?? '' );
	$order->set_billing_last_name( $name_parts[1] ?? '' );
	$order->set_billing_email( $customer_email );

	// Add a simple service fee line item.
	// TODO: Replace with a WC product ID fetched from options/catalog.
	$item = new WC_Order_Item_Fee();
	$item->set_name(
		sprintf(
			/* translators: 1: brand, 2: model, 3: service tier */
			__( 'Repair Service (%1$s %2$s — %3$s)', 'drywall-toolbox' ),
			$brand,
			$model,
			ucfirst( $service_tier )
		)
	);
	$item->set_amount( $line_amount );
	$item->set_total( $line_amount );
	$item->add_meta_data( '_dtb_repair_service_tier', $service_tier );
	$order->add_item( $item );

	// Repair-specific meta.
	$order->update_meta_data( '_dtb_is_repair_order', '1' );
	$order->update_meta_data( '_dtb_repair_id', $repair_id );
	$order->update_meta_data( '_dtb_repair_service_tier', $service_tier );

	$order->set_status( 'pending' );
	$order->calculate_totals();
	$order->save();

	return $order->get_id();
}
