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
		'permission_callback' => 'dtb_support_admin_permission',
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
			'permission_callback' => 'dtb_support_admin_permission',
		],
		[
			'methods'             => WP_REST_Server::EDITABLE,
			'callback'            => 'dtb_support_rest_update_ticket',
			'permission_callback' => 'dtb_support_admin_permission',
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
		'permission_callback' => 'dtb_support_admin_permission',
	] );

	// ── Ticket events (for inline expand) ─────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/tickets/(?P<id>\d+)/events', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_support_rest_get_ticket_events',
		'permission_callback' => 'dtb_support_admin_permission',
	] );

	// ── Queue projections ─────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/queues', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_support_rest_get_queues',
		'permission_callback' => 'dtb_support_admin_permission',
	] );

	// ── Snooze / unsnooze ─────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/tickets/(?P<id>\d+)/snooze', [
		[
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'dtb_support_rest_snooze_ticket',
			'permission_callback' => 'dtb_support_admin_permission',
			'args'                => [
				'snooze_until' => [ 'type' => 'string', 'required' => true ],
				'reason'       => [ 'type' => 'string', 'required' => false, 'default' => '' ],
			],
		],
		[
			'methods'             => WP_REST_Server::DELETABLE,
			'callback'            => 'dtb_support_rest_unsnooze_ticket',
			'permission_callback' => 'dtb_support_admin_permission',
		],
	] );

	// ── Follow-up due ─────────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/tickets/(?P<id>\d+)/followup', [
		'methods'             => WP_REST_Server::CREATABLE,
		'callback'            => 'dtb_support_rest_set_followup',
		'permission_callback' => 'dtb_support_admin_permission',
		'args'                => [
			'followup_due_at' => [ 'type' => 'string', 'required' => true ],
			'note'            => [ 'type' => 'string', 'required' => false, 'default' => '' ],
		],
	] );

	// ── Bulk actions ──────────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/bulk', [
		'methods'             => WP_REST_Server::CREATABLE,
		'callback'            => 'dtb_support_rest_bulk_action',
		'permission_callback' => 'dtb_support_admin_permission',
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
			'permission_callback' => 'dtb_support_admin_permission',
		],
		[
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => 'dtb_support_rest_create_macro',
			'permission_callback' => 'dtb_support_admin_permission',
			'args'                => [
				'name'    => [ 'type' => 'string', 'required' => true ],
				'subject' => [ 'type' => 'string', 'required' => false, 'default' => '' ],
				'body'    => [ 'type' => 'string', 'required' => true ],
				'category' => [ 'type' => 'string', 'required' => false, 'default' => 'general' ],
			],
		],
	] );
	register_rest_route( 'dtb/v1', '/support/macros/(?P<id>\d+)', [
		[
			'methods'             => WP_REST_Server::EDITABLE,
			'callback'            => 'dtb_support_rest_update_macro',
			'permission_callback' => 'dtb_support_admin_permission',
			'args'                => [
				'name'     => [ 'type' => 'string', 'required' => false ],
				'subject'  => [ 'type' => 'string', 'required' => false ],
				'body'     => [ 'type' => 'string', 'required' => false ],
				'category' => [ 'type' => 'string', 'required' => false ],
			],
		],
		[
			'methods'             => WP_REST_Server::DELETABLE,
			'callback'            => 'dtb_support_rest_delete_macro',
			'permission_callback' => 'dtb_support_admin_permission',
		],
	] );

	// ── Health / observability ────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/health', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_support_rest_get_health',
		'permission_callback' => 'dtb_support_admin_permission',
	] );

	// ── Outbox status ─────────────────────────────────────────────────────────
	register_rest_route( 'dtb/v1', '/support/outbox', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_support_rest_get_outbox',
		'permission_callback' => 'dtb_support_admin_permission',
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
	if ( ! is_user_logged_in() ) {
		return new WP_Error( 'rest_forbidden', __( 'Authentication required.', 'drywall-toolbox' ), [ 'status' => 401 ] );
	}
	if ( ! current_user_can( 'dtb_manage_support' ) && ! current_user_can( 'manage_options' ) ) {
		return new WP_Error( 'rest_forbidden', __( 'You do not have permission to manage support tickets.', 'drywall-toolbox' ), [ 'status' => 403 ] );
	}
	return true;
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

	// Queue-based filtering: map named queues to concrete query constraints.
	if ( ! empty( $params['queue'] ) ) {
		$queue = sanitize_key( $params['queue'] );
		switch ( $queue ) {
			case 'needs_reply':
				$query_args['status']   = 'open,pending_staff,in_progress';
				$query_args['order_by'] = 'priority_score';
				$query_args['order']    = 'DESC';
				break;
			case 'due_soon':
				$query_args['action_state'] = 'due_soon';
				break;
			case 'overdue':
				$query_args['action_state'] = 'overdue';
				break;
			case 'unassigned':
				$query_args['unassigned'] = true;
				break;
			case 'urgent':
				$query_args['priority'] = 'urgent';
				break;
			case 'snoozed':
				$query_args['snoozed'] = true;
				break;
			case 'in_progress':
				$query_args['status'] = 'in_progress';
				break;
			case 'waiting_on_customer':
				$query_args['status'] = 'pending_customer';
				break;
		}
	}

	$result    = dtb_support_query_tickets( $query_args );
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

// Rename internal SLA-keyed counts to operator-friendly keys.
$key_map = [
'sla_at_risk'   => 'due_soon',
'sla_breached'  => 'overdue',
];
$out = [];
foreach ( $raw as $k => $v ) {
$out[ $key_map[ $k ] ?? $k ] = $v;
}

return new WP_REST_Response( $out, 200 );
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
$ids    = array_map( 'absint', (array) $request->get_param( 'ids' ) );
$action = sanitize_key( $request->get_param( 'action' ) );
$value  = sanitize_text_field( $request->get_param( 'value' ) ?? '' );

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

default:
$errors[] = $ticket_id;
}
}

return new WP_REST_Response( [
'success' => count( $errors ) === 0,
'updated' => $updated,
'errors'  => $errors,
], 200 );
}

/**
 * GET /dtb/v1/support/macros
 *
 * @return WP_REST_Response
 */
function dtb_support_rest_list_macros(): WP_REST_Response {
$macros = function_exists( 'dtb_support_get_macros' ) ? dtb_support_get_macros() : [];
return new WP_REST_Response( [ 'macros' => $macros ], 200 );
}

/**
 * POST /dtb/v1/support/macros
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_create_macro( WP_REST_Request $request ): WP_REST_Response|WP_Error {
if ( ! function_exists( 'dtb_support_get_macros' ) ) {
return new WP_Error( 'dtb_support_unavailable', __( 'Macro service not available.', 'drywall-toolbox' ), [ 'status' => 503 ] );
}

global $wpdb;
$table = $wpdb->prefix . 'dtb_support_macros';

$result = $wpdb->insert( $table, [
'name'       => sanitize_text_field( $request->get_param( 'name' ) ),
'subject'    => sanitize_text_field( $request->get_param( 'subject' ) ?? '' ),
'body'       => wp_kses_post( $request->get_param( 'body' ) ),
'category'   => sanitize_key( $request->get_param( 'category' ) ?? 'general' ),
'created_by' => get_current_user_id(),
'created_at' => gmdate( 'Y-m-d H:i:s' ),
'updated_at' => gmdate( 'Y-m-d H:i:s' ),
] );

if ( false === $result ) {
return new WP_Error( 'dtb_support_db_error', __( 'Could not save macro.', 'drywall-toolbox' ), [ 'status' => 500 ] );
}

$macro = $wpdb->get_row( $wpdb->prepare(
"SELECT * FROM {$table} WHERE id = %d",
$wpdb->insert_id
) );

return new WP_REST_Response( [ 'success' => true, 'macro' => $macro ], 201 );
}

/**
 * PUT /dtb/v1/support/macros/{id}
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_update_macro( WP_REST_Request $request ): WP_REST_Response|WP_Error {
global $wpdb;
$table    = $wpdb->prefix . 'dtb_support_macros';
$macro_id = (int) $request->get_param( 'id' );

$existing = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $macro_id ) );
if ( ! $existing ) {
return new WP_Error( 'dtb_support_not_found', __( 'Macro not found.', 'drywall-toolbox' ), [ 'status' => 404 ] );
}

$update = [ 'updated_at' => gmdate( 'Y-m-d H:i:s' ) ];
if ( null !== $request->get_param( 'name' ) )     { $update['name']     = sanitize_text_field( $request->get_param( 'name' ) ); }
if ( null !== $request->get_param( 'subject' ) )  { $update['subject']  = sanitize_text_field( $request->get_param( 'subject' ) ); }
if ( null !== $request->get_param( 'body' ) )     { $update['body']     = wp_kses_post( $request->get_param( 'body' ) ); }
if ( null !== $request->get_param( 'category' ) ) { $update['category'] = sanitize_key( $request->get_param( 'category' ) ); }

$wpdb->update( $table, $update, [ 'id' => $macro_id ] );

$macro = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM {$table} WHERE id = %d", $macro_id ) );
return new WP_REST_Response( [ 'success' => true, 'macro' => $macro ], 200 );
}

/**
 * DELETE /dtb/v1/support/macros/{id}
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_delete_macro( WP_REST_Request $request ): WP_REST_Response|WP_Error {
global $wpdb;
$table    = $wpdb->prefix . 'dtb_support_macros';
$macro_id = (int) $request->get_param( 'id' );

if ( ! $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$table} WHERE id = %d", $macro_id ) ) ) {
return new WP_Error( 'dtb_support_not_found', __( 'Macro not found.', 'drywall-toolbox' ), [ 'status' => 404 ] );
}

$wpdb->delete( $table, [ 'id' => $macro_id ] );
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

// Map internal keys.
$queue_out = [];
$key_map   = [ 'sla_at_risk' => 'due_soon', 'sla_breached' => 'overdue' ];
foreach ( $queues as $k => $v ) {
$queue_out[ $key_map[ $k ] ?? $k ] = $v;
}

// Oldest active ticket.
$oldest = $wpdb->get_var(
// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
"SELECT created_at FROM {$table} WHERE status NOT IN ('resolved','closed','spam') ORDER BY created_at ASC LIMIT 1"
);
$oldest_seconds = $oldest ? ( time() - strtotime( $oldest ) ) : null;

// Email outbox failures.
$outbox_failed = 0;
if ( ! empty( $wpdb->prefix ) ) {
$outbox_table = $wpdb->prefix . 'dtb_support_email_outbox';
$outbox_failed = (int) $wpdb->get_var(
// phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
"SELECT COUNT(*) FROM {$outbox_table} WHERE status = 'failed'"
);
}

// Cron health: check scheduled SLA scan.
$next_sla_scan = wp_next_scheduled( 'dtb_support_sla_scan_cron' );

return new WP_REST_Response( [
'schema_version'   => $kpis['schema_version']  ?? '0',
'total_open'       => $kpis['open']             ?? 0,
'needs_reply'      => $kpis['needs_reply']      ?? 0,
'overdue_count'    => $kpis['overdue_count']    ?? 0,
'due_soon_count'   => $kpis['due_soon_count']   ?? 0,
'email_failures'   => $kpis['email_failures']   ?? 0,
'outbox_failed'    => $outbox_failed,
'oldest_active_ticket_age_seconds' => $oldest_seconds,
'oldest_active_ticket_at'          => $oldest,
'queues'           => $queue_out,
'cron' => [
'sla_scan_next_run' => $next_sla_scan ? gmdate( 'c', $next_sla_scan ) : null,
],
'generated_at'     => gmdate( 'c' ),
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
"SELECT id, ticket_id, recipient_email, subject, status, fail_count, scheduled_at, sent_at, failed_at, created_at FROM {$table} WHERE status = %s ORDER BY created_at DESC LIMIT %d",
$status,
$per_page
) );

return new WP_REST_Response( [ 'items' => $rows ?? [] ], 200 );
}
