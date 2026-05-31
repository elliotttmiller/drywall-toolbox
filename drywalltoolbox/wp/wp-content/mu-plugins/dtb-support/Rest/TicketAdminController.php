<?php
/**
 * REST — TicketAdminController: admin-only ticket list and detail endpoints.
 *
 * Routes:
 *   GET    /wp-json/dtb/v1/support/tickets
 *   GET    /wp-json/dtb/v1/support/tickets/(?P<id>\d+)
 *   PATCH  /wp-json/dtb/v1/support/tickets/(?P<id>\d+)
 *   GET    /wp-json/dtb/v1/support/kpis
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register admin ticket routes.
 */
function dtb_support_register_admin_ticket_routes(): void {
	// ── Ticket list ───────────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/tickets', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_support_rest_list_tickets',
		'permission_callback' => 'dtb_support_read_permission',
		'args'                => [
			'status'   => [ 'type' => 'string',  'required' => false ],
			'type'     => [ 'type' => 'string',  'required' => false ],
			'priority' => [ 'type' => 'string',  'required' => false ],
			'queue'    => [ 'type' => 'string',  'required' => false ],
			'search'   => [ 'type' => 'string',  'required' => false ],
			'page'     => [ 'type' => 'integer', 'required' => false, 'default' => 1 ],
			'per_page' => [ 'type' => 'integer', 'required' => false, 'default' => 25 ],
			'order_by' => [ 'type' => 'string',  'required' => false, 'default' => 'created_at' ],
			'order'    => [ 'type' => 'string',  'required' => false, 'default' => 'DESC' ],
		],
	] );

	// ── Single ticket ─────────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/tickets/(?P<id>\d+)', [
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'dtb_support_rest_get_ticket',
			'permission_callback' => 'dtb_support_read_permission',
		],
		[
			'methods'             => WP_REST_Server::EDITABLE,
			'callback'            => 'dtb_support_rest_update_ticket',
			'permission_callback' => 'dtb_support_update_ticket_permission',
			'args'                => [
				'status'           => [ 'type' => 'string',  'required' => false ],
				'priority'         => [ 'type' => 'string',  'required' => false ],
				'assigned_user_id' => [ 'type' => 'integer', 'required' => false ],
				'note'             => [ 'type' => 'string',  'required' => false, 'default' => '' ],
			],
		],
	] );

	// ── KPI summary ───────────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/kpis', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_support_rest_get_kpis',
		'permission_callback' => 'dtb_support_read_permission',
	] );

	// ── Ticket events (for inline expand) ─────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/tickets/(?P<id>\d+)/events', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_support_rest_get_ticket_events',
		'permission_callback' => 'dtb_support_read_permission',
	] );

	// ── Queue projections ─────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/queues', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_support_rest_get_queues',
		'permission_callback' => 'dtb_support_read_permission',
	] );

	// ── Snooze / unsnooze ─────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/tickets/(?P<id>\d+)/snooze', [
		[
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'dtb_support_rest_snooze_ticket',
			'permission_callback' => 'dtb_support_status_change_permission',
			'args'                => [
				'snooze_until' => [ 'type' => 'string', 'required' => true ],
				'reason'       => [ 'type' => 'string', 'required' => false, 'default' => '' ],
			],
		],
		[
			'methods'             => WP_REST_Server::DELETABLE,
			'callback'            => 'dtb_support_rest_unsnooze_ticket',
			'permission_callback' => 'dtb_support_status_change_permission',
		],
	] );

	// ── Follow-up due ─────────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/tickets/(?P<id>\d+)/followup', [
		'methods'             => WP_REST_Server::CREATABLE,
		'callback'            => 'dtb_support_rest_set_followup',
		'permission_callback' => 'dtb_support_status_change_permission',
		'args'                => [
			'followup_due_at' => [ 'type' => 'string', 'required' => true ],
			'note'            => [ 'type' => 'string', 'required' => false, 'default' => '' ],
		],
	] );

	// ── Bulk actions ──────────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/bulk', [
		'methods'             => WP_REST_Server::CREATABLE,
		'callback'            => 'dtb_support_rest_bulk_action',
		'permission_callback' => 'dtb_support_bulk_action_permission',
		'args'                => [
			'ids'    => [ 'type' => 'array', 'required' => true, 'items' => [ 'type' => 'integer' ] ],
			'action' => [ 'type' => 'string', 'required' => true ],
			'value'  => [ 'type' => 'string', 'required' => false, 'default' => '' ],
		],
	] );

	// ── Macros ────────────────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/macros', [
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'dtb_support_rest_list_macros',
			'permission_callback' => 'dtb_support_macro_permission',
		],
		[
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'dtb_support_rest_create_macro',
			'permission_callback' => 'dtb_support_macro_permission',
			'args'                => [
				'macro_name'       => [ 'type' => 'string', 'required' => false ],
				'subject_template' => [ 'type' => 'string', 'required' => false, 'default' => '' ],
				'body_template'    => [ 'type' => 'string', 'required' => false ],
				'category'         => [ 'type' => 'string', 'required' => false, 'default' => 'general' ],
				'is_active'        => [ 'type' => 'boolean', 'required' => false, 'default' => true ],
				'sort_order'       => [ 'type' => 'integer', 'required' => false, 'default' => 0 ],
				'name'             => [ 'type' => 'string', 'required' => false ],
				'subject'          => [ 'type' => 'string', 'required' => false ],
				'body'             => [ 'type' => 'string', 'required' => false ],
			],
		],
	] );
	register_rest_route( 'dtb/v1', '/support/macros/(?P<id>\d+)', [
		[
			'methods'             => WP_REST_Server::EDITABLE,
			'callback'            => 'dtb_support_rest_update_macro',
			'permission_callback' => 'dtb_support_macro_permission',
			'args'                => [
				'macro_name'       => [ 'type' => 'string', 'required' => false ],
				'subject_template' => [ 'type' => 'string', 'required' => false ],
				'body_template'    => [ 'type' => 'string', 'required' => false ],
				'category'         => [ 'type' => 'string', 'required' => false ],
				'is_active'        => [ 'type' => 'boolean', 'required' => false ],
				'sort_order'       => [ 'type' => 'integer', 'required' => false ],
				'name'             => [ 'type' => 'string', 'required' => false ],
				'subject'          => [ 'type' => 'string', 'required' => false ],
				'body'             => [ 'type' => 'string', 'required' => false ],
			],
		],
		[
			'methods'             => WP_REST_Server::DELETABLE,
			'callback'            => 'dtb_support_rest_delete_macro',
			'permission_callback' => 'dtb_support_macro_permission',
		],
	] );

	// ── Health / observability ────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/health', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_support_rest_get_health',
		'permission_callback' => 'dtb_support_reports_permission',
	] );

	// ── Outbox status ─────────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/outbox', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_support_rest_get_outbox',
		'permission_callback' => 'dtb_support_reports_permission',
		'args'                => [
			'status'   => [ 'type' => 'string',  'required' => false, 'default' => 'failed' ],
			'per_page' => [ 'type' => 'integer', 'required' => false, 'default' => 25 ],
		],
	] );
}
add_action( 'rest_api_init', 'dtb_support_register_admin_ticket_routes' );

/**
 * Permission check: user must be logged in and have manage_support capability.
 *
 * @return bool|WP_Error
 */
function dtb_support_admin_permission(): bool|WP_Error {
	return dtb_support_rest_require_capabilities(
		[ 'dtb_manage_support' ],
		__( 'You do not have permission to manage support tickets.', 'drywall-toolbox' )
	);
}

/**
 * Check whether the current user has any of the provided support capabilities.
 *
 * @param string[] $caps Capability names.
 */
function dtb_support_user_can_any( array $caps ): bool {
	if ( current_user_can( 'manage_options' ) ) {
		return true;
	}

	foreach ( $caps as $cap ) {
		if ( current_user_can( $cap ) ) {
			return true;
		}
	}

	return false;
}

/**
 * Shared REST capability gate for support routes.
 *
 * @param string[] $caps Capability names.
 */
function dtb_support_rest_require_capabilities( array $caps, string $message ): bool|WP_Error {
	if ( ! is_user_logged_in() ) {
		return new WP_Error( 'rest_forbidden', __( 'Authentication required.', 'drywall-toolbox' ), [ 'status' => 401 ] );
	}

	if ( ! dtb_support_user_can_any( $caps ) ) {
		return new WP_Error( 'rest_forbidden', $message, [ 'status' => 403 ] );
	}

	return true;
}

/**
 * Read access to support tickets.
 */
function dtb_support_read_permission(): bool|WP_Error {
	return dtb_support_rest_require_capabilities(
		[ 'dtb_read_support_tickets', 'dtb_manage_support' ],
		__( 'You do not have permission to view support tickets.', 'drywall-toolbox' )
	);
}

/**
 * Read access to reporting and health endpoints.
 */
function dtb_support_reports_permission(): bool|WP_Error {
	return dtb_support_rest_require_capabilities(
		[ 'dtb_view_support_reports', 'dtb_manage_support' ],
		__( 'You do not have permission to view support reporting.', 'drywall-toolbox' )
	);
}

/**
 * Macro management access.
 */
function dtb_support_macro_permission(): bool|WP_Error {
	return dtb_support_rest_require_capabilities(
		[ 'dtb_manage_support_macros', 'dtb_manage_support' ],
		__( 'You do not have permission to manage support macros.', 'drywall-toolbox' )
	);
}

/**
 * Status-style operations used for snooze and follow-up actions.
 */
function dtb_support_status_change_permission(): bool|WP_Error {
	return dtb_support_rest_require_capabilities(
		[ 'dtb_change_support_status', 'dtb_manage_support' ],
		__( 'You do not have permission to change support ticket status.', 'drywall-toolbox' )
	);
}

/**
 * Check granular patch permissions based on requested fields.
 */
function dtb_support_update_ticket_permission( WP_REST_Request $request ): bool|WP_Error {
	$result = dtb_support_read_permission();
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	$checks = [];
	if ( null !== $request->get_param( 'status' ) ) {
		$checks['dtb_change_support_status'] = __( 'You do not have permission to change support ticket status.', 'drywall-toolbox' );
	}
	if ( null !== $request->get_param( 'priority' ) ) {
		$checks['dtb_change_support_priority'] = __( 'You do not have permission to change support ticket priority.', 'drywall-toolbox' );
	}
	if ( null !== $request->get_param( 'assigned_user_id' ) ) {
		$checks['dtb_assign_support_tickets'] = __( 'You do not have permission to assign support tickets.', 'drywall-toolbox' );
	}

	foreach ( $checks as $cap => $message ) {
		$allowed = dtb_support_rest_require_capabilities( [ $cap, 'dtb_manage_support' ], $message );
		if ( is_wp_error( $allowed ) ) {
			return $allowed;
		}
	}

	return true;
}

/**
 * Check granular bulk action permissions.
 */
function dtb_support_bulk_action_permission( WP_REST_Request $request ): bool|WP_Error {
	$result = dtb_support_read_permission();
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	$action = sanitize_key( (string) $request->get_param( 'action' ) );
	$map = [
		'status'      => [ 'dtb_change_support_status', __( 'You do not have permission to change support ticket status.', 'drywall-toolbox' ) ],
		'set_status'  => [ 'dtb_change_support_status', __( 'You do not have permission to change support ticket status.', 'drywall-toolbox' ) ],
		'priority'    => [ 'dtb_change_support_priority', __( 'You do not have permission to change support ticket priority.', 'drywall-toolbox' ) ],
		'set_priority'=> [ 'dtb_change_support_priority', __( 'You do not have permission to change support ticket priority.', 'drywall-toolbox' ) ],
		'assign'      => [ 'dtb_assign_support_tickets', __( 'You do not have permission to assign support tickets.', 'drywall-toolbox' ) ],
		'assign_me'   => [ 'dtb_assign_support_tickets', __( 'You do not have permission to assign support tickets.', 'drywall-toolbox' ) ],
		'unassign'    => [ 'dtb_assign_support_tickets', __( 'You do not have permission to assign support tickets.', 'drywall-toolbox' ) ],
		'close'       => [ 'dtb_change_support_status', __( 'You do not have permission to change support ticket status.', 'drywall-toolbox' ) ],
		'spam'        => [ 'dtb_change_support_status', __( 'You do not have permission to change support ticket status.', 'drywall-toolbox' ) ],
		'snooze'      => [ 'dtb_change_support_status', __( 'You do not have permission to change support ticket status.', 'drywall-toolbox' ) ],
		'unsnooze'    => [ 'dtb_change_support_status', __( 'You do not have permission to change support ticket status.', 'drywall-toolbox' ) ],
	];

	if ( isset( $map[ $action ] ) ) {
		[ $cap, $message ] = $map[ $action ];
		return dtb_support_rest_require_capabilities( [ $cap, 'dtb_manage_support' ], $message );
	}

	return dtb_support_admin_permission();
}

/**
 * GET /dtb/v1/support/tickets
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function dtb_support_rest_list_tickets( WP_REST_Request $request ): WP_REST_Response {
	$params = $request->get_params();

	$query_args = [
		'status'   => $params['status']   ?? '',
		'type'     => $params['type']     ?? '',
		'priority' => $params['priority'] ?? '',
		'search'   => $params['search']   ?? '',
		'page'     => (int) ( $params['page']     ?? 1 ),
		'per_page' => (int) ( $params['per_page'] ?? 25 ),
		'order_by' => $params['order_by'] ?? 'created_at',
		'order'    => strtoupper( $params['order'] ?? 'DESC' ) === 'ASC' ? 'ASC' : 'DESC',
	];

	$queue = ! empty( $params['queue'] ) ? sanitize_key( (string) $params['queue'] ) : '';
	$smart_queues = [
		'needs_reply',
		'overdue',
		'due_soon',
		'unassigned',
		'urgent',
		'snoozed',
		'in_progress',
		'waiting_on_customer',
		'resolved_pending_close',
		'all_active',
	];

	if ( in_array( $queue, $smart_queues, true ) ) {
		$result = dtb_support_query_queue( $queue, $query_args );
	} else {
		$result = dtb_support_query_tickets( $query_args );
	}
	$projected = array_map( 'dtb_support_project_ticket', $result['tickets'] );

	return new WP_REST_Response( [
		'tickets'    => $projected,
		'total'      => $result['total'],
		'page'       => $result['page'],
		'per_page'   => $result['per_page'],
		'page_count' => $result['page_count'],
	], 200 );
}

/**
 * GET /dtb/v1/support/tickets/{id}
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_get_ticket( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$ticket_id = (int) $request->get_param( 'id' );
	$ticket    = dtb_support_get_ticket( $ticket_id );

	if ( ! $ticket ) {
		return new WP_Error( 'dtb_support_not_found', __( 'Ticket not found.', 'drywall-toolbox' ), [ 'status' => 404 ] );
	}

	$events = dtb_support_get_events( $ticket_id, 'operator' );

	return new WP_REST_Response( [
		'ticket' => dtb_support_project_ticket( $ticket ),
		'events' => $events,
	], 200 );
}

/**
 * PATCH /dtb/v1/support/tickets/{id}
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_update_ticket( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$ticket_id = (int) $request->get_param( 'id' );
	$ticket    = dtb_support_get_ticket( $ticket_id );

	if ( ! $ticket ) {
		return new WP_Error( 'dtb_support_not_found', __( 'Ticket not found.', 'drywall-toolbox' ), [ 'status' => 404 ] );
	}

	$actor_id = get_current_user_id();

	// Status transition.
	if ( ! empty( $request['status'] ) && $request['status'] !== $ticket->status ) {
		$result = dtb_support_do_transition( $ticket_id, $request['status'], $request['note'] ?? '', $actor_id );
		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => $result->get_error_message() ], 422 );
		}
	}

	// Priority update.
	if ( ! empty( $request['priority'] ) && dtb_support_is_valid_priority( $request['priority'] ) ) {
		dtb_support_update_ticket( $ticket_id, [ 'priority' => $request['priority'] ] );
	}

	// Assignment.
	if ( ! empty( $request['assigned_user_id'] ) ) {
		$assign_result = dtb_support_assign_ticket( $ticket_id, (int) $request['assigned_user_id'] );
		if ( is_wp_error( $assign_result ) ) {
			return new WP_REST_Response( [ 'success' => false, 'message' => $assign_result->get_error_message() ], 422 );
		}
	}

	$fresh = dtb_support_get_ticket( $ticket_id );

	return new WP_REST_Response( [
		'success' => true,
		'ticket'  => dtb_support_project_ticket( $fresh ),
	], 200 );
}

/**
 * GET /dtb/v1/support/kpis
 *
 * @return WP_REST_Response
 */
function dtb_support_rest_get_kpis(): WP_REST_Response {
	return new WP_REST_Response( dtb_support_get_kpis(), 200 );
}

/**
 * GET /dtb/v1/support/tickets/{id}/events
 *
 * Returns the operator-visible event stream for inline expand.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_get_ticket_events( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$ticket_id = (int) $request->get_param( 'id' );

	if ( ! dtb_support_get_ticket( $ticket_id ) ) {
		return new WP_Error( 'dtb_support_not_found', __( 'Ticket not found.', 'drywall-toolbox' ), [ 'status' => 404 ] );
	}

	$events = dtb_support_get_events( $ticket_id, 'operator' );
	$now    = time();
	$out    = [];

	foreach ( (array) $events as $ev ) {
		$ev_arr = is_object( $ev ) ? get_object_vars( $ev ) : (array) $ev;
		// Add human-readable age label.
		$ev_arr['age_label'] = ! empty( $ev_arr['created_at'] )
			? dtb_support_age_label( $now - strtotime( $ev_arr['created_at'] ) )
			: '';
		// Resolve actor label.
		if ( 'customer' === ( $ev_arr['actor_type'] ?? '' ) ) {
			$ticket = dtb_support_get_ticket( $ticket_id );
			$ev_arr['actor_label'] = $ticket ? $ticket->customer_name : 'Customer';
		} elseif ( ! empty( $ev_arr['actor_id'] ) ) {
			$u = get_userdata( (int) $ev_arr['actor_id'] );
			$ev_arr['actor_label'] = $u ? $u->display_name : 'Staff';
		} else {
			$ev_arr['actor_label'] = 'System';
		}
		$out[] = $ev_arr;
	}

	return new WP_REST_Response( $out, 200 );
}

// ── v2 endpoint handlers ──────────────────────────────────────────────────────

/**
 * GET /dtb/v1/support/queues
 *
 * Returns named queue counts. Keys use operator-friendly names:
 * "overdue" (not "sla_breached"), "due_soon" (not "sla_at_risk").
 *
 * @return WP_REST_Response
 */
function dtb_support_rest_get_queues(): WP_REST_Response {
	$raw = function_exists( 'dtb_support_get_queue_counts' )
		? dtb_support_get_queue_counts()
		: [];
	$counts = function_exists( 'dtb_support_normalize_queue_counts' )
		? dtb_support_normalize_queue_counts( $raw )
		: $raw;

	$payload = $counts;
	$payload['counts'] = $counts;

	return new WP_REST_Response( $payload, 200 );
}

/**
 * POST /dtb/v1/support/tickets/{id}/snooze
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_snooze_ticket( WP_REST_Request $request ): WP_REST_Response|WP_Error {
$ticket_id = (int) $request->get_param( 'id' );
if ( ! dtb_support_get_ticket( $ticket_id ) ) {
return new WP_Error( 'dtb_support_not_found', __( 'Ticket not found.', 'drywall-toolbox' ), [ 'status' => 404 ] );
}

if ( ! function_exists( 'dtb_support_snooze_ticket' ) ) {
return new WP_Error( 'dtb_support_unavailable', __( 'Snooze service not available.', 'drywall-toolbox' ), [ 'status' => 503 ] );
}

$until  = sanitize_text_field( $request->get_param( 'snooze_until' ) );
$reason = sanitize_text_field( $request->get_param( 'reason' ) ?? '' );

$result = dtb_support_snooze_ticket( $ticket_id, $until, [
'reason'     => $reason,
'actor_id'   => get_current_user_id(),
'actor_type' => 'staff',
] );

if ( is_wp_error( $result ) ) {
return new WP_REST_Response( [ 'success' => false, 'message' => $result->get_error_message() ], 422 );
}

return new WP_REST_Response( [
'success' => true,
'ticket'  => dtb_support_project_ticket( dtb_support_get_ticket( $ticket_id ) ),
], 200 );
}

/**
 * DELETE /dtb/v1/support/tickets/{id}/snooze
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_unsnooze_ticket( WP_REST_Request $request ): WP_REST_Response|WP_Error {
$ticket_id = (int) $request->get_param( 'id' );
if ( ! dtb_support_get_ticket( $ticket_id ) ) {
return new WP_Error( 'dtb_support_not_found', __( 'Ticket not found.', 'drywall-toolbox' ), [ 'status' => 404 ] );
}

if ( function_exists( 'dtb_support_unsnooze_ticket' ) ) {
dtb_support_unsnooze_ticket( $ticket_id, [
'actor_id'   => get_current_user_id(),
'actor_type' => 'staff',
'source'     => 'manual',
] );
}

return new WP_REST_Response( [
'success' => true,
'ticket'  => dtb_support_project_ticket( dtb_support_get_ticket( $ticket_id ) ),
], 200 );
}

/**
 * POST /dtb/v1/support/tickets/{id}/followup
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_set_followup( WP_REST_Request $request ): WP_REST_Response|WP_Error {
$ticket_id = (int) $request->get_param( 'id' );
if ( ! dtb_support_get_ticket( $ticket_id ) ) {
return new WP_Error( 'dtb_support_not_found', __( 'Ticket not found.', 'drywall-toolbox' ), [ 'status' => 404 ] );
}

$due_at = sanitize_text_field( $request->get_param( 'followup_due_at' ) );
$note   = sanitize_text_field( $request->get_param( 'note' ) ?? '' );

if ( function_exists( 'dtb_support_set_followup' ) ) {
dtb_support_set_followup( $ticket_id, $due_at, [
'note'       => $note,
'actor_id'   => get_current_user_id(),
'actor_type' => 'staff',
] );
} else {
dtb_support_update_ticket( $ticket_id, [ 'followup_due_at' => $due_at ] );
}

return new WP_REST_Response( [
'success' => true,
'ticket'  => dtb_support_project_ticket( dtb_support_get_ticket( $ticket_id ) ),
], 200 );
}

/**
 * POST /dtb/v1/support/bulk
 *
 * Supported actions: status, priority, assign, unassign, snooze, close, spam.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_bulk_action( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$raw_ids = $request->get_param( 'ids' );
	if ( null === $raw_ids ) {
		$raw_ids = $request->get_param( 'ticket_ids' );
	}

	$ids    = array_filter( array_map( 'absint', (array) $raw_ids ) );
	$action = sanitize_key( (string) $request->get_param( 'action' ) );
	$value  = sanitize_text_field( $request->get_param( 'value' ) ?? '' );

	if ( 'set_status' === $action ) {
		$action = 'status';
	} elseif ( 'set_priority' === $action ) {
		$action = 'priority';
	}

	if ( empty( $ids ) ) {
		return new WP_Error( 'dtb_support_invalid', __( 'No ticket IDs provided.', 'drywall-toolbox' ), [ 'status' => 400 ] );
	}

	$actor_id = get_current_user_id();
	$updated  = [];
	$errors   = [];

	foreach ( $ids as $ticket_id ) {
		$ticket = dtb_support_get_ticket( $ticket_id );
		if ( ! $ticket ) {
			$errors[] = $ticket_id;
			continue;
		}

		switch ( $action ) {
			case 'status':
				if ( dtb_support_is_valid_status( $value ) ) {
					$r = dtb_support_do_transition( $ticket_id, $value, '', $actor_id );
					if ( ! is_wp_error( $r ) ) {
						$updated[] = $ticket_id;
					} else {
						$errors[] = $ticket_id;
					}
				}
				break;

			case 'priority':
				if ( dtb_support_is_valid_priority( $value ) ) {
					dtb_support_update_ticket( $ticket_id, [ 'priority' => $value ] );
					if ( function_exists( 'dtb_support_update_ticket_priority_score' ) ) {
						dtb_support_update_ticket_priority_score( $ticket_id );
					}
					$updated[] = $ticket_id;
				}
				break;

			case 'assign':
				$uid = absint( $value );
				if ( $uid ) {
					$r = dtb_support_assign_ticket( $ticket_id, $uid );
					if ( ! is_wp_error( $r ) ) {
						$updated[] = $ticket_id;
					} else {
						$errors[] = $ticket_id;
					}
				}
				break;

			case 'assign_me':
				$r = dtb_support_assign_ticket( $ticket_id, $actor_id );
				if ( ! is_wp_error( $r ) ) {
					$updated[] = $ticket_id;
				} else {
					$errors[] = $ticket_id;
				}
				break;

			case 'unassign':
				dtb_support_update_ticket( $ticket_id, [ 'assigned_user_id' => null ] );
				$updated[] = $ticket_id;
				break;

			case 'close':
				$r = dtb_support_do_transition( $ticket_id, 'closed', '', $actor_id );
				if ( ! is_wp_error( $r ) ) {
					$updated[] = $ticket_id;
				} else {
					$errors[] = $ticket_id;
				}
				break;

			case 'spam':
				$r = dtb_support_do_transition( $ticket_id, 'spam', '', $actor_id );
				if ( ! is_wp_error( $r ) ) {
					$updated[] = $ticket_id;
				} else {
					$errors[] = $ticket_id;
				}
				break;

			case 'unsnooze':
				if ( function_exists( 'dtb_support_unsnooze_ticket' ) ) {
					dtb_support_unsnooze_ticket( $ticket_id, [
						'actor_id'   => $actor_id,
						'actor_type' => 'staff',
						'source'     => 'bulk_action',
					] );
				}
				$updated[] = $ticket_id;
				break;

			default:
				$errors[] = $ticket_id;
		}
	}

	return new WP_REST_Response( [
		'success'   => count( $errors ) === 0,
		'updated'   => $updated,
		'processed' => $updated,
		'errors'    => $errors,
	], 200 );
}

/**
 * Normalize macro payloads to the schema-backed service contract.
 */
function dtb_support_rest_macro_payload( WP_REST_Request $request, ?object $existing = null ): array {
	$data = [];

	$macro_name = $request->get_param( 'macro_name' );
	if ( null === $macro_name ) {
		$macro_name = $request->get_param( 'name' );
	}
	if ( null !== $macro_name ) {
		$data['macro_name'] = sanitize_text_field( (string) $macro_name );
	} elseif ( $existing ) {
		$data['macro_name'] = (string) $existing->macro_name;
	}

	$subject_template = $request->get_param( 'subject_template' );
	if ( null === $subject_template ) {
		$subject_template = $request->get_param( 'subject' );
	}
	if ( null !== $subject_template ) {
		$data['subject_template'] = sanitize_text_field( (string) $subject_template );
	} elseif ( $existing ) {
		$data['subject_template'] = (string) $existing->subject_template;
	}

	$body_template = $request->get_param( 'body_template' );
	if ( null === $body_template ) {
		$body_template = $request->get_param( 'body' );
	}
	if ( null !== $body_template ) {
		$data['body_template'] = wp_kses_post( (string) $body_template );
	} elseif ( $existing ) {
		$data['body_template'] = (string) $existing->body_template;
	}

	if ( null !== $request->get_param( 'category' ) ) {
		$data['category'] = sanitize_text_field( (string) $request->get_param( 'category' ) );
	} elseif ( $existing ) {
		$data['category'] = (string) $existing->category;
	}

	if ( null !== $request->get_param( 'is_active' ) ) {
		$data['is_active'] = (bool) $request->get_param( 'is_active' );
	} elseif ( $existing ) {
		$data['is_active'] = (bool) $existing->is_active;
	}

	if ( null !== $request->get_param( 'sort_order' ) ) {
		$data['sort_order'] = (int) $request->get_param( 'sort_order' );
	} elseif ( $existing ) {
		$data['sort_order'] = (int) $existing->sort_order;
	}

	return $data;
}

/**
 * Format a macro row for REST responses.
 */
function dtb_support_rest_prepare_macro( object $macro ): array {
	$variables = json_decode( (string) ( $macro->variables ?? '[]' ), true );

	return [
		'id'               => (int) $macro->id,
		'macro_name'       => (string) $macro->macro_name,
		'subject_template' => (string) $macro->subject_template,
		'body_template'    => (string) $macro->body_template,
		'variables'        => is_array( $variables ) ? array_values( $variables ) : [],
		'category'         => (string) $macro->category,
		'is_active'        => ! empty( $macro->is_active ),
		'sort_order'       => (int) $macro->sort_order,
		'created_by'       => isset( $macro->created_by ) ? (int) $macro->created_by : null,
		'created_at'       => $macro->created_at ?? null,
		'updated_at'       => $macro->updated_at ?? null,
	];
}

/**
 * GET /dtb/v1/support/macros
 *
 * @return WP_REST_Response
 */
function dtb_support_rest_list_macros(): WP_REST_Response {
	$macros = function_exists( 'dtb_support_get_macros' ) ? dtb_support_get_macros() : [];
	$macros = array_map( 'dtb_support_rest_prepare_macro', $macros );
	return new WP_REST_Response( [ 'macros' => $macros ], 200 );
}

/**
 * POST /dtb/v1/support/macros
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_create_macro( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	if ( ! function_exists( 'dtb_support_save_macro' ) ) {
		return new WP_Error( 'dtb_support_unavailable', __( 'Macro service not available.', 'drywall-toolbox' ), [ 'status' => 503 ] );
	}

	$macro_id = dtb_support_save_macro( dtb_support_rest_macro_payload( $request ) );
	if ( is_wp_error( $macro_id ) ) {
		return $macro_id;
	}

	$macro = function_exists( 'dtb_support_get_macro' ) ? dtb_support_get_macro( (int) $macro_id ) : null;
	if ( ! $macro ) {
		return new WP_Error( 'dtb_support_not_found', __( 'Macro not found after save.', 'drywall-toolbox' ), [ 'status' => 500 ] );
	}

	return new WP_REST_Response( [ 'success' => true, 'macro' => dtb_support_rest_prepare_macro( $macro ) ], 201 );
}

/**
 * PUT /dtb/v1/support/macros/{id}
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_update_macro( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$macro_id = (int) $request->get_param( 'id' );
	$existing = function_exists( 'dtb_support_get_macro' ) ? dtb_support_get_macro( $macro_id ) : null;
	if ( ! $existing ) {
		return new WP_Error( 'dtb_support_not_found', __( 'Macro not found.', 'drywall-toolbox' ), [ 'status' => 404 ] );
	}

	$result = function_exists( 'dtb_support_save_macro' )
		? dtb_support_save_macro( dtb_support_rest_macro_payload( $request, $existing ), $macro_id )
		: new WP_Error( 'dtb_support_unavailable', __( 'Macro service not available.', 'drywall-toolbox' ), [ 'status' => 503 ] );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	$macro = dtb_support_get_macro( $macro_id );
	return new WP_REST_Response( [ 'success' => true, 'macro' => dtb_support_rest_prepare_macro( $macro ) ], 200 );
}

/**
 * DELETE /dtb/v1/support/macros/{id}
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_delete_macro( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$macro_id = (int) $request->get_param( 'id' );
	$result   = function_exists( 'dtb_support_delete_macro' )
		? dtb_support_delete_macro( $macro_id )
		: new WP_Error( 'dtb_support_unavailable', __( 'Macro service not available.', 'drywall-toolbox' ), [ 'status' => 503 ] );

	if ( is_wp_error( $result ) ) {
		return 'dtb_support_not_found' === $result->get_error_code()
			? new WP_Error( 'dtb_support_not_found', $result->get_error_message(), [ 'status' => 404 ] )
			: $result;
	}

	return new WP_REST_Response( [ 'success' => true, 'deleted' => $macro_id ], 200 );
}

/**
 * GET /dtb/v1/support/health
 *
 * Observability endpoint: queue counts, overdue/due-soon tickets, email failures,
 * oldest active ticket, schema version, cron health.
 *
 * @return WP_REST_Response
 */
function dtb_support_rest_get_health(): WP_REST_Response {
	global $wpdb;
	$table = dtb_support_tickets_table();

	$kpis = dtb_support_get_kpis();

	$queues = function_exists( 'dtb_support_get_queue_counts' )
		? dtb_support_get_queue_counts()
		: [];
	$queue_out = function_exists( 'dtb_support_normalize_queue_counts' )
		? dtb_support_normalize_queue_counts( $queues )
		: $queues;

	$oldest = $wpdb->get_var(
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		"SELECT created_at FROM {$table} WHERE status NOT IN ('resolved','closed','spam') ORDER BY created_at ASC LIMIT 1"
	);
	$oldest_seconds = $oldest ? ( time() - strtotime( $oldest ) ) : null;

	$outbox_failed = 0;
	if ( ! empty( $wpdb->prefix ) ) {
		$outbox_table  = $wpdb->prefix . 'dtb_support_email_outbox';
		$outbox_failed = (int) $wpdb->get_var(
			// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
			"SELECT COUNT(*) FROM {$outbox_table} WHERE status = 'failed'"
		);
	}

	$next_scan = 0;
	foreach ( [ 'dtb_support_hourly_sla_scan', 'dtb_support_sla_hourly_scan', 'dtb_support_sla_scan_hourly' ] as $scan_hook ) {
		$scheduled = wp_next_scheduled( $scan_hook );
		if ( $scheduled ) {
			$next_scan = (int) $scheduled;
			break;
		}
	}
	$last_scan = get_option( 'dtb_support_last_sla_scan', '' );

	return new WP_REST_Response( [
		'schema_version'                  => $kpis['schema_version'] ?? '0',
		'total_open'                      => $kpis['active_total'] ?? 0,
		'needs_reply'                     => $kpis['needs_reply'] ?? 0,
		'overdue_count'                   => $kpis['overdue_count'] ?? 0,
		'due_soon_count'                  => $kpis['due_soon_count'] ?? 0,
		'email_failures'                  => $kpis['email_failures'] ?? 0,
		'outbox_failed'                   => $outbox_failed,
		'oldest_active_ticket_age_seconds'=> $oldest_seconds,
		'oldest_active_ticket_at'         => $oldest,
		'queues'                          => $queue_out,
		'cron'                            => [
			'operational_target_scan' => [
				'label'       => __( 'Operational Target Scan', 'drywall-toolbox' ),
				'next_run_at' => $next_scan ? gmdate( 'c', $next_scan ) : null,
				'last_run_at' => $last_scan ? gmdate( 'c', strtotime( (string) $last_scan ) ) : null,
			],
		],
		'generated_at'                    => gmdate( 'c' ),
	], 200 );
}

/**
 * GET /dtb/v1/support/outbox
 *
 * Returns outbox items filtered by status (default: failed).
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function dtb_support_rest_get_outbox( WP_REST_Request $request ): WP_REST_Response {
	global $wpdb;
	$table    = $wpdb->prefix . 'dtb_support_email_outbox';
	$status   = sanitize_key( $request->get_param( 'status' ) ?? 'failed' );
	$per_page = min( 100, max( 1, (int) $request->get_param( 'per_page' ) ) );

	$rows = $wpdb->get_results( $wpdb->prepare(
		// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
		"SELECT id, ticket_id, recipient_email, recipient_name, subject, status, attempts, next_attempt_at, sent_at, last_error, created_at, updated_at
			FROM {$table}
			WHERE status = %s
			ORDER BY created_at DESC
			LIMIT %d",
		$status,
		$per_page
	) );

	return new WP_REST_Response( [ 'items' => $rows ?? [] ], 200 );
}
