<?php
/**
 * DTB Authentication — Must-Use Plugin
 *
 * Self-contained JWT authentication for the Drywall Toolbox SPA.
 * Issues HS256 JWTs as HttpOnly SameSite=Strict cookies so the React
 * frontend never stores the raw token string in JS memory.
 *
 * Functions provided:
 *   dtb_generate_jwt()      — Build a signed HS256 JWT for a WP user
 *   dtb_verify_jwt()        — Validate signature and exp claim
 *   dtb_jwt_permission()    — REST permission_callback (cookie > Bearer header)
 *   dtb_set_auth_cookie()   — Emit dtb_auth HttpOnly cookie
 *   dtb_clear_auth_cookie() — Clear dtb_auth cookie (logout)
 *   dtb_auth_login()        — POST /dtb/v1/auth/login handler
 *   dtb_auth_logout()       — DELETE /dtb/v1/auth/logout handler
 *   dtb_auth_validate()     — POST /dtb/v1/auth/validate handler
 *
 * Depends on (loaded before this file via 00-dtb-loader.php):
 *   dtb-utils.php  → dtb_get_config(), dtb_error_envelope()
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * Name of the HttpOnly JWT cookie.
 */
const DTB_AUTH_COOKIE = 'dtb_auth';

// =============================================================================
// JWT HELPERS
// =============================================================================

/**
 * Encode data as URL-safe base64 (no padding).
 *
 * @param string $data Raw binary string.
 * @return string      Base64url-encoded string.
 */
function dtb_base64url_encode( string $data ): string {
	return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
}

/**
 * Decode a URL-safe base64 string (with or without padding).
 *
 * @param string $data Base64url-encoded string.
 * @return string      Decoded raw bytes.
 */
function dtb_base64url_decode( string $data ): string {
	$padded = $data . str_repeat( '=', ( 4 - ( strlen( $data ) % 4 ) ) % 4 );
	return base64_decode( strtr( $padded, '-_', '+/' ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
}

/**
 * Generate a signed HS256 JWT for a WordPress user.
 *
 * Payload claims:
 *   sub   — WP user ID (integer)
 *   email — user e-mail address
 *   roles — array of WP role slugs
 *   iat   — issued-at timestamp (Unix seconds)
 *   exp   — expiry timestamp (iat + 7 days)
 *
 * The signing secret is read from DRYWALL_JWT_SECRET via dtb_get_config().
 *
 * @param WP_User $user Authenticated WordPress user object.
 * @return string       Signed JWT string (header.payload.signature).
 */
function dtb_generate_jwt( WP_User $user ): string {
	$secret = dtb_get_config()['jwt_secret'];

	$header  = dtb_base64url_encode( (string) wp_json_encode( [ 'alg' => 'HS256', 'typ' => 'JWT' ] ) );
	$payload = dtb_base64url_encode( (string) wp_json_encode( [
		'sub'   => $user->ID,
		'email' => $user->user_email,
		'roles' => array_values( (array) $user->roles ),
		'iat'   => time(),
		'exp'   => time() + 7 * DAY_IN_SECONDS,
	] ) );

	$sig = dtb_base64url_encode(
		hash_hmac( 'sha256', $header . '.' . $payload, $secret, true )
	);

	return $header . '.' . $payload . '.' . $sig;
}

/**
 * Validate a JWT string: verify the HS256 signature and the exp claim.
 *
 * @param string $token JWT string (header.payload.signature).
 * @return object|WP_Error Decoded payload object on success; WP_Error on failure.
 */
function dtb_verify_jwt( string $token ) {
	$secret = dtb_get_config()['jwt_secret'];

	$parts = explode( '.', $token );
	if ( 3 !== count( $parts ) ) {
		return new WP_Error( 'invalid_token', 'Malformed token.', [ 'status' => 401 ] );
	}

	[ $header, $payload, $sig ] = $parts;

	$expected = dtb_base64url_encode(
		hash_hmac( 'sha256', $header . '.' . $payload, $secret, true )
	);

	if ( ! hash_equals( $expected, $sig ) ) {
		return new WP_Error( 'invalid_token', 'Invalid token signature.', [ 'status' => 401 ] );
	}

	$decoded = json_decode( dtb_base64url_decode( $payload ) );
	if ( ! is_object( $decoded ) ) {
		return new WP_Error( 'invalid_token', 'Token payload is unreadable.', [ 'status' => 401 ] );
	}

	if ( ! isset( $decoded->exp ) || time() > (int) $decoded->exp ) {
		return new WP_Error( 'token_expired', 'Token has expired.', [ 'status' => 401 ] );
	}

	return $decoded;
}

// =============================================================================
// PERMISSION CALLBACK
// =============================================================================

/**
 * REST permission_callback that validates a DTB JWT token.
 *
 * Token is read in priority order:
 *   1. dtb_auth HttpOnly cookie               (browser SPA after login)
 *   2. Authorization: Bearer {token}  header  (API / mobile clients)
 *
 * Cookie takes precedence over the Authorization header.
 *
 * @param WP_REST_Request $request Incoming request.
 * @return true|WP_Error True on success; WP_Error on auth failure.
 */
function dtb_jwt_permission( WP_REST_Request $request ) {
	$token = null;

	// 1. Cookie takes precedence.
	if ( ! empty( $_COOKIE[ DTB_AUTH_COOKIE ] ) ) {
		$token = sanitize_text_field( wp_unslash( $_COOKIE[ DTB_AUTH_COOKIE ] ) );
	}

	// 2. Fall back to Authorization: Bearer header.
	if ( ! $token ) {
		$auth = $request->get_header( 'authorization' );
		if ( $auth && preg_match( '/^Bearer\s+(\S+)$/i', $auth, $m ) ) {
			$token = $m[1];
		}
	}

	if ( ! $token ) {
		return new WP_Error( 'missing_token', 'Authorization token required.', [ 'status' => 401 ] );
	}

	$result = dtb_verify_jwt( $token );
	if ( is_wp_error( $result ) ) {
		return $result;
	}

	return true;
}

// =============================================================================
// COOKIE HELPERS
// =============================================================================

/**
 * Emit the dtb_auth JWT as an HttpOnly, SameSite=Strict cookie.
 *
 * @param string $jwt     Signed JWT string.
 * @param int    $ttl_sec Cookie lifetime in seconds (default: 7 days).
 */
function dtb_set_auth_cookie( string $jwt, int $ttl_sec = 604800 ): void {
	setcookie( DTB_AUTH_COOKIE, $jwt, [
		'expires'  => time() + $ttl_sec,
		'path'     => '/',
		'domain'   => '',        // current domain only
		'secure'   => is_ssl(), // HTTPS-only in production
		'httponly' => true,      // not accessible from JS
		'samesite' => 'Strict',  // protects against CSRF
	] );
}

/**
 * Clear the dtb_auth cookie (logout).
 */
function dtb_clear_auth_cookie(): void {
	setcookie( DTB_AUTH_COOKIE, '', [
		'expires'  => time() - 3600,
		'path'     => '/',
		'domain'   => '',
		'secure'   => is_ssl(),
		'httponly' => true,
		'samesite' => 'Strict',
	] );
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

add_action( 'rest_api_init', 'dtb_register_auth_routes', 10 );

/**
 * Register dtb/v1/auth/* REST routes.
 */
function dtb_register_auth_routes(): void {
	$ns = 'dtb/v1';

	register_rest_route( $ns, '/auth/login', [
		'methods'             => 'POST',
		'callback'            => 'dtb_auth_login',
		'permission_callback' => '__return_true',
		'args'                => [
			'email'    => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_email',
				'description'       => 'WordPress user e-mail address.',
			],
			'password' => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_text_field',
				'description'       => 'WordPress user password.',
			],
		],
	] );

	register_rest_route( $ns, '/auth/logout', [
		'methods'             => 'DELETE',
		'callback'            => 'dtb_auth_logout',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/auth/validate', [
		'methods'             => 'POST',
		'callback'            => 'dtb_auth_validate',
		'permission_callback' => '__return_true',
	] );
}

// =============================================================================
// ROUTE CALLBACKS
// =============================================================================

/**
 * POST /dtb/v1/auth/login
 *
 * Accepts { email, password }. Authenticates via wp_authenticate(), generates a
 * JWT, and sets it as an HttpOnly SameSite=Strict cookie valid for 7 days.
 *
 * Success: { success: true, user: { id, email, display_name, roles } }
 * Failure: dtb_error_envelope shape with HTTP 401.
 *
 * @param WP_REST_Request $request Incoming request.
 * @return WP_REST_Response
 */
function dtb_auth_login( WP_REST_Request $request ): WP_REST_Response {
	$rl = dtb_rate_limit( $request, 'auth_login' );
	if ( $rl ) {
		return $rl;
	}

	$email    = sanitize_email( (string) $request->get_param( 'email' ) );
	$password = (string) $request->get_param( 'password' );

	if ( empty( $email ) || empty( $password ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'missing_credentials', 'Email and password are required.', 400 ),
			400
		);
	}

	$user = wp_authenticate( $email, $password );

	if ( is_wp_error( $user ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'auth_failed', 'Invalid credentials.', 401 ),
			401
		);
	}

	$jwt = dtb_generate_jwt( $user );
	dtb_set_auth_cookie( $jwt, 7 * DAY_IN_SECONDS );

	$response = new WP_REST_Response( [
		'success' => true,
		'user'    => [
			'id'           => $user->ID,
			'email'        => $user->user_email,
			'display_name' => $user->display_name,
			'roles'        => array_values( (array) $user->roles ),
		],
	], 200 );
	$response->header( 'Cache-Control', 'private, no-store' );
	return $response;
}

/**
 * DELETE /dtb/v1/auth/logout
 *
 * Clears the dtb_auth cookie by setting its expiry to the past.
 *
 * @return WP_REST_Response
 */
function dtb_auth_logout(): WP_REST_Response {
	dtb_clear_auth_cookie();

	$response = new WP_REST_Response( [ 'success' => true ], 200 );
	$response->header( 'Cache-Control', 'private, no-store' );
	return $response;
}

/**
 * POST /dtb/v1/auth/validate
 *
 * Reads the dtb_auth cookie, calls dtb_verify_jwt(), and returns the
 * authenticated user object on success or a 401 on invalid / expired token.
 *
 * @param WP_REST_Request $request Incoming request.
 * @return WP_REST_Response
 */
function dtb_auth_validate( WP_REST_Request $request ): WP_REST_Response {
	$token = null;

	// Read cookie first (same precedence as dtb_jwt_permission).
	if ( ! empty( $_COOKIE[ DTB_AUTH_COOKIE ] ) ) {
		$token = sanitize_text_field( wp_unslash( $_COOKIE[ DTB_AUTH_COOKIE ] ) );
	}

	if ( ! $token ) {
		$auth = $request->get_header( 'authorization' );
		if ( $auth && preg_match( '/^Bearer\s+(\S+)$/i', $auth, $m ) ) {
			$token = $m[1];
		}
	}

	if ( ! $token ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'missing_token', 'No active session.', 401 ),
			401
		);
	}

	$payload = dtb_verify_jwt( $token );

	if ( is_wp_error( $payload ) ) {
		dtb_clear_auth_cookie();
		return new WP_REST_Response(
			dtb_error_envelope( 'invalid_token', 'Session expired. Please log in again.', 401 ),
			401
		);
	}

	$user = get_user_by( 'id', (int) $payload->sub );

	if ( ! $user ) {
		dtb_clear_auth_cookie();
		return new WP_REST_Response(
			dtb_error_envelope( 'user_not_found', 'User account not found.', 401 ),
			401
		);
	}

	$response = new WP_REST_Response( [
		'success' => true,
		'user'    => [
			'id'           => $user->ID,
			'email'        => $user->user_email,
			'display_name' => $user->display_name,
			'roles'        => array_values( (array) $user->roles ),
		],
	], 200 );
	$response->header( 'Cache-Control', 'private, no-store' );
	return $response;
}
