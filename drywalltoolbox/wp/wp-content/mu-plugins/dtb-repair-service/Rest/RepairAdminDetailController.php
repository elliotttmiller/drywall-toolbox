<?php
/**
 * DTB Repair Service — RepairAdminDetailController
 *
 * REST endpoint: GET /dtb/v1/admin/repairs/{id}/detail
 *
 * Returns the full workbench contract payload consumed by the
 * dtb-repairs-page.js full-screen modal.  Every field is authoritative
 * (read from the DB / WooCommerce at request time) and includes linked-record
 * data, customer 360 context, audit events, integration state, and workload
 * intelligence from the shared platform Services.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', 'dtb_repair_admin_detail_register_routes' );

// ── Route registration ────────────────────────────────────────────────────────

function dtb_repair_admin_detail_register_routes(): void {
	register_rest_route( 'dtb/v1', '/admin/repairs/(?P<id>\d+)/detail', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_repair_admin_detail_handler',
		'permission_callback' => fn() => is_user_logged_in() && current_user_can( 'dtb_manage_repairs' ),
		'args'                => [
			'id' => [
				'validate_callback' => fn( $v ) => is_numeric( $v ) && (int) $v > 0,
				'sanitize_callback' => 'absint',
			],
		],
	] );
}

// ── Handler ───────────────────────────────────────────────────────────────────

function dtb_repair_admin_detail_handler( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$repair_id = (int) $request->get_param( 'id' );

	$post = get_post( $repair_id );
	if ( ! $post || 'dtb_repair_request' !== $post->post_type ) {
		return new WP_Error( 'not_found', __( 'Repair not found.', 'drywall-toolbox' ), [ 'status' => 404 ] );
	}

	// ── Core projection ──
	$proj = function_exists( 'dtb_build_repair_status_projection' )
		? dtb_build_repair_status_projection( $repair_id )
		: [];

	// ── Status / workflow ──
	$status         = (string) get_post_meta( $repair_id, '_repair_status', true ) ?: $post->post_status;
	$allowed_next   = function_exists( 'dtb_get_allowed_transitions' )
		? ( dtb_get_allowed_transitions()[ $status ] ?? [] )
		: [];
	$is_terminal    = empty( $allowed_next );

	// ── Quote ──
	$quote = function_exists( 'dtb_repair_get_quote' )
		? dtb_repair_get_quote( $repair_id )
		: [];

	// ── Integration state ──
	$integration = function_exists( 'dtb_get_repair_integration_state' )
		? dtb_get_repair_integration_state( $repair_id )
		: [];

	// ── Comments / conversation ──
	$comments_raw = get_comments( [
		'post_id' => $repair_id,
		'status'  => 'approve',
		'orderby' => 'comment_date',
		'order'   => 'ASC',
		'number'  => 200,
	] );

	$conversation = array_values( array_map( fn( $c ) => [
		'id'         => (int) $c->comment_ID,
		'type'       => (string) get_comment_meta( (int) $c->comment_ID, '_dtb_comment_type', true ) ?: 'customer',
		'body'       => wp_kses_post( $c->comment_content ),
		'author'     => esc_html( $c->comment_author ),
		'user_label' => esc_html( $c->comment_author ),
		'created_at' => get_comment_date( 'c', $c ),
		'user_id'    => (int) $c->user_id,
	], $comments_raw ) );

	// ── Customer context ──
	$customer_email = sanitize_email( (string) get_post_meta( $repair_id, '_repair_customer_email', true ) );
	$customer_ctx   = [];
	if ( $customer_email && function_exists( 'dtb_admin_get_customer_context' ) ) {
		$customer_ctx = dtb_admin_get_customer_context( [ 'email' => $customer_email ] );
	}

	// ── Linked records ──
	$linked = [];
	if ( function_exists( 'dtb_admin_get_linked_records' ) ) {
		$linked = dtb_admin_get_linked_records( 'repair', $repair_id );
	}

	// ── Workload intelligence ──
	$intel = [];
	if ( function_exists( 'dtb_admin_compute_workload_score' ) ) {
		// Build a record snapshot for the intelligence helpers.
		$intel_record = array_merge( $proj, [
			'id'     => $repair_id,
			'status' => $status,
		] );

		// Collect free-text for sentiment / intent analysis.
		$intel_text = implode( ' ', array_filter( [
			(string) get_post_meta( $repair_id, '_repair_issue', true ),
			(string) get_post_meta( $repair_id, '_repair_customer_name', true ),
		] ) );

		$intel = [
			'age_bucket'      => function_exists( 'dtb_admin_compute_age_bucket' )
				? dtb_admin_compute_age_bucket( $post->post_date ) : '',
			'sla_state'       => function_exists( 'dtb_admin_compute_sla_state' )
				? dtb_admin_compute_sla_state( $post->post_date, $status, 'repair' ) : '',
			'intent_flags'    => function_exists( 'dtb_admin_detect_intent_flags' )
				? dtb_admin_detect_intent_flags( $intel_text ) : [],
			'sentiment_flags' => function_exists( 'dtb_admin_detect_customer_sentiment_flags' )
				? dtb_admin_detect_customer_sentiment_flags( $intel_text ) : [],
			'next_best_action' => function_exists( 'dtb_admin_compute_next_best_action' )
				? dtb_admin_compute_next_best_action( 'repair', $intel_record ) : '',
			'blockers'        => function_exists( 'dtb_admin_compute_blockers' )
				? dtb_admin_compute_blockers( 'repair', $intel_record ) : [],
			'workload_score'  => dtb_admin_compute_workload_score( 'repair', $intel_record ),
		];
	}

	// ── Audit events ──
	$audit_events = [];
	if ( function_exists( 'dtb_admin_audit_get_events' ) ) {
		$audit_events = dtb_admin_audit_get_events( 'repair', $repair_id, 50 );
	}

	// ── Permissions for this operator ──
	$perms = [
		'can_transition'      => current_user_can( 'dtb_manage_repairs' ) && ! $is_terminal,
		'can_note'            => current_user_can( 'dtb_manage_repairs' ),
		'can_message'         => current_user_can( 'dtb_manage_repairs' ),
		'can_edit_quote'      => current_user_can( 'dtb_manage_repairs' ) && in_array( $status, [ 'reviewed', 'approved', 'quoted' ], true ),
		'can_allocate_parts'  => current_user_can( 'dtb_manage_repairs' ) && in_array( $status, [ 'approved', 'quote_accepted' ], true ),
		'can_close'           => current_user_can( 'dtb_manage_repairs' ),
	];

	// ── Shipping ──
	$tracking_number = (string) get_post_meta( $repair_id, '_repair_veeqo_tracking', true );
	$shipping = [
		'return_address' => [
			'line1'    => (string) get_post_meta( $repair_id, '_repair_return_address_1', true ),
			'city'     => (string) get_post_meta( $repair_id, '_repair_return_city', true ),
			'state'    => (string) get_post_meta( $repair_id, '_repair_return_state', true ),
			'postcode' => (string) get_post_meta( $repair_id, '_repair_return_postcode', true ),
			'country'  => (string) get_post_meta( $repair_id, '_repair_return_country', true ),
		],
		'rate_name'       => (string) get_post_meta( $repair_id, '_repair_shipping_rate_name', true ),
		'rate_price'      => (float) get_post_meta( $repair_id, '_repair_shipping_rate_price', true ),
		'tracking_number' => $tracking_number,
		'veeqo_order_id'  => (string) get_post_meta( $repair_id, '_repair_veeqo_order_id', true ),
	];

	// ── Assemble response ──
	$payload = [
		'ok'       => true,
		'record'   => [
			'id'                 => $repair_id,
			'status'             => $status,
			'allowed_next'       => $allowed_next,
			'is_terminal'        => $is_terminal,
			'created_at'         => get_the_date( 'c', $post ),
			'updated_at'         => get_the_modified_date( 'c', $post ),
			'customer_name'      => (string) get_post_meta( $repair_id, '_repair_customer_name', true ),
			'customer_email'     => $customer_email,
			'customer_phone'     => (string) get_post_meta( $repair_id, '_repair_customer_phone', true ),
			'company'            => (string) get_post_meta( $repair_id, '_repair_company', true ),
			'tool_brand'         => (string) get_post_meta( $repair_id, '_repair_tool_brand', true ),
			'tool_category'      => (string) get_post_meta( $repair_id, '_repair_tool_category', true ),
			'tool_model'         => (string) get_post_meta( $repair_id, '_repair_model', true ),
			'serial_number'      => (string) get_post_meta( $repair_id, '_repair_serial', true ),
			'tool_age'           => (string) get_post_meta( $repair_id, '_repair_tool_age', true ),
			'service_tier'       => (string) get_post_meta( $repair_id, '_repair_service_tier', true ),
			'priority'           => (string) get_post_meta( $repair_id, '_repair_priority', true ),
			'issue_start'        => (string) get_post_meta( $repair_id, '_repair_issue_start', true ),
			'issue_description'  => (string) get_post_meta( $repair_id, '_repair_issue', true ),
			'contact_preference' => (string) get_post_meta( $repair_id, '_repair_contact_preference', true ),
			'wc_order_id'        => (int) get_post_meta( $repair_id, '_repair_wc_order_id', true ),
			'technician_id'      => (int) get_post_meta( $repair_id, '_repair_technician_id', true ),
		],
		'quote'        => $quote,
		'shipping'     => $shipping,
		'conversation' => $conversation,
		'linked'       => $linked,
		'customer'     => $customer_ctx,
		'intel'        => $intel,
		'integration'  => $integration,
		'audit'        => $audit_events,
		'permissions'  => $perms,
		'meta'         => [
			'nonce'       => wp_create_nonce( 'wp_rest' ),
			'rest_url'    => esc_url_raw( rest_url( 'dtb/v1/admin/repairs/' . $repair_id ) ),
			'fetched_at'  => gmdate( 'c' ),
		],
	];

	return new WP_REST_Response( $payload, 200 );
}
