<?php
/**
 * REST — TicketReplyController: handles reply submissions from staff and customers.
 *
 * Routes:
 *   POST /wp-json/dtb/v1/support/tickets/(?P<id>\d+)/reply
 *   POST /wp-json/dtb/v1/support/tickets/(?P<id>\d+)/reply/public
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Register reply routes.
 */
function dtb_support_register_reply_routes(): void {
	// Staff reply (authenticated).
	register_rest_route( 'dtb/v1', '/support/tickets/(?P<id>\d+)/reply', [
		'methods'             => WP_REST_Server::CREATABLE,
		'callback'            => 'dtb_support_rest_staff_reply',
		'permission_callback' => 'dtb_support_staff_reply_permission',
		'args'                => [
			'message'     => [ 'type' => 'string', 'required' => true ],
			'is_internal' => [ 'type' => 'boolean', 'required' => false, 'default' => false ],
		],
	] );

	// Customer reply (public, token-authenticated via hash).
	register_rest_route( 'dtb/v1', '/support/tickets/(?P<id>\d+)/reply/public', [
		'methods'             => WP_REST_Server::CREATABLE,
		'callback'            => 'dtb_support_rest_customer_reply',
		'permission_callback' => '__return_true',
		'args'                => [
			'message' => [ 'type' => 'string', 'required' => true ],
			'token'   => [ 'type' => 'string', 'required' => true ],
		],
	] );
}
add_action( 'rest_api_init', 'dtb_support_register_reply_routes' );

/**
 * Check reply vs internal-note capability.
 */
function dtb_support_staff_reply_permission( WP_REST_Request $request ): bool|WP_Error {
	$is_internal = (bool) $request->get_param( 'is_internal' );

	return dtb_support_rest_require_capabilities(
		[
			$is_internal ? 'dtb_add_support_notes' : 'dtb_reply_support_tickets',
			'dtb_manage_support',
		],
		$is_internal
			? __( 'You do not have permission to add internal support notes.', 'drywall-toolbox' )
			: __( 'You do not have permission to reply to support tickets.', 'drywall-toolbox' )
	);
}

/**
 * POST /dtb/v1/support/tickets/{id}/reply   (staff)
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_staff_reply( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$ticket_id  = (int) $request->get_param( 'id' );
	$message    = trim( $request->get_param( 'message' ) ?? '' );
	$is_internal = (bool) $request->get_param( 'is_internal' );
	$actor_id   = get_current_user_id();

	if ( '' === $message ) {
		return new WP_Error( 'dtb_support_empty', __( 'Message cannot be empty.', 'drywall-toolbox' ), [ 'status' => 422 ] );
	}

	$event_id = dtb_support_add_reply( $ticket_id, $message, 'staff', $actor_id, $is_internal );
	if ( is_wp_error( $event_id ) ) {
		return new WP_REST_Response( [ 'success' => false, 'message' => $event_id->get_error_message() ], 422 );
	}

	return new WP_REST_Response( [ 'success' => true, 'event_id' => $event_id ], 201 );
}

/**
 * POST /dtb/v1/support/tickets/{id}/reply/public   (customer, token-gated)
 *
 * The token is a signed, expiring HMAC-SHA256 of "ticket_id:customer_email:expires"
 * using AUTH_KEY. Tokens are valid for DTB_SUPPORT_PUBLIC_REPLY_TOKEN_TTL seconds
 * (default: 30 days). Verification uses constant-time comparison.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_support_rest_customer_reply( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$ticket_id = (int) $request->get_param( 'id' );
	$token     = sanitize_text_field( $request->get_param( 'token' ) ?? '' );
	$message   = trim( $request->get_param( 'message' ) ?? '' );

	$ticket = dtb_support_get_ticket( $ticket_id );
	if ( ! $ticket ) {
		// Return generic 403 to avoid leaking ticket existence to unauthenticated callers.
		return new WP_Error( 'dtb_support_forbidden', __( 'Invalid or expired reply link.', 'drywall-toolbox' ), [ 'status' => 403 ] );
	}

	// Verify expiring token: format "{expires}:{hmac-sha256}".
	// The expires component must be a positive integer string (Unix timestamp),
	// and the HMAC must be a 64-character lowercase hex string (SHA-256 output).
	$parts = explode( ':', $token, 2 );
	if ( 2 !== count( $parts ) ) {
		return new WP_Error( 'dtb_support_forbidden', __( 'Invalid or expired reply link.', 'drywall-toolbox' ), [ 'status' => 403 ] );
	}

	[ $expires_str, $provided_hmac ] = $parts;

	// Validate formats before use to prevent type-coercion edge cases and
	// length-based timing discrimination.
	if ( ! ctype_digit( $expires_str ) || 64 !== strlen( $provided_hmac ) || ! ctype_xdigit( $provided_hmac ) ) {
		return new WP_Error( 'dtb_support_forbidden', __( 'Invalid or expired reply link.', 'drywall-toolbox' ), [ 'status' => 403 ] );
	}

	$expires = (int) $expires_str;

	if ( $expires < time() ) {
		return new WP_Error( 'dtb_support_forbidden', __( 'Invalid or expired reply link.', 'drywall-toolbox' ), [ 'status' => 403 ] );
	}

	$expected_hmac = hash_hmac(
		'sha256',
		$ticket_id . ':' . $ticket->customer_email . ':' . $expires,
		AUTH_KEY
	);

	if ( ! hash_equals( $expected_hmac, $provided_hmac ) ) {
		return new WP_Error( 'dtb_support_forbidden', __( 'Invalid or expired reply link.', 'drywall-toolbox' ), [ 'status' => 403 ] );
	}

	if ( '' === $message ) {
		return new WP_Error( 'dtb_support_empty', __( 'Message cannot be empty.', 'drywall-toolbox' ), [ 'status' => 422 ] );
	}

	$event_id = dtb_support_add_reply( $ticket_id, $message, 'customer', 0, false );
	if ( is_wp_error( $event_id ) ) {
		return new WP_REST_Response( [ 'success' => false, 'message' => $event_id->get_error_message() ], 422 );
	}

	return new WP_REST_Response( [
		'success'  => true,
		'event_id' => $event_id,
		'message'  => __( 'Your reply has been sent.', 'drywall-toolbox' ),
	], 201 );
}

/**
 * Generate an expiring signed token for the public customer reply endpoint.
 *
 * Token format: "{expires}:{hmac-sha256}"
 * The HMAC covers "ticket_id:customer_email:expires" using AUTH_KEY.
 *
 * @param int      $ticket_id
 * @param string   $customer_email
 * @param int|null $ttl  Token lifetime in seconds. null = use system default (30 days).
 * @return string
 */
function dtb_support_generate_public_reply_token( int $ticket_id, string $customer_email, ?int $ttl = null ): string {
	if ( null === $ttl ) {
		$ttl = (int) apply_filters(
			'dtb_support_public_reply_token_ttl',
			defined( 'DTB_SUPPORT_PUBLIC_REPLY_TOKEN_TTL' ) ? DTB_SUPPORT_PUBLIC_REPLY_TOKEN_TTL : ( 30 * DAY_IN_SECONDS )
		);
	}
	$expires = time() + max( 1, $ttl );
	$hmac    = hash_hmac( 'sha256', $ticket_id . ':' . $customer_email . ':' . $expires, AUTH_KEY );
	return $expires . ':' . $hmac;
}
