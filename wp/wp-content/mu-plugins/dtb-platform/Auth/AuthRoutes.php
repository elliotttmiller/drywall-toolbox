<?php
defined( 'ABSPATH' ) || exit;

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

// Only load auth helpers and route registration on admin or REST API requests.
if ( ! dtb_is_admin_or_rest_request() ) {
	return;
}

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

	$dtb_caps = [];
	$cap_constants = [
		'DTB_CAP_OPS_ADMIN',
		'DTB_CAP_ACCOUNTING',
		'DTB_CAP_SUPPORT',
		'DTB_CAP_CATALOG',
	];
	foreach ( $cap_constants as $const ) {
		if ( defined( $const ) ) {
			$cap = constant( $const );
			if ( $user->has_cap( $cap ) ) {
				$dtb_caps[] = $cap;
			}
		}
	}

	$payload = dtb_base64url_encode( (string) wp_json_encode( [
		'sub'      => $user->ID,
		'email'    => $user->user_email,
		'roles'    => array_values( (array) $user->roles ),
		'dtb_caps' => $dtb_caps,
		'iat'      => time(),
		'exp'      => time() + 7 * DAY_IN_SECONDS,
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
	// On HostGator (Apache CGI/FastCGI), the Authorization header is not
	// automatically populated in $_SERVER. The .htaccess RewriteRule that sets
	// HTTP_AUTHORIZATION handles the common case; REDIRECT_HTTP_AUTHORIZATION
	// is a second env var Apache may use when the request passed through a
	// RewriteRule redirect before reaching PHP.
	if ( ! $token ) {
		$auth = $request->get_header( 'authorization' );

		// CGI fallback 1: set by our .htaccess RewriteRule.
		if ( ! $auth && ! empty( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
			$auth = sanitize_text_field( wp_unslash( $_SERVER['HTTP_AUTHORIZATION'] ) );
		}

		// CGI fallback 2: set by Apache when request was internally redirected.
		if ( ! $auth && ! empty( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
			$auth = sanitize_text_field( wp_unslash( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) );
		}

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

/**
 * Extract the WordPress user ID from the current request's JWT.
 *
 * Returns 0 when there is no valid token present.
 *
 * @return int WordPress user ID, or 0 on failure.
 */
function dtb_jwt_get_user_id(): int {
	$token = null;

	if ( ! empty( $_COOKIE[ DTB_AUTH_COOKIE ] ) ) {
		$token = sanitize_text_field( wp_unslash( $_COOKIE[ DTB_AUTH_COOKIE ] ) );
	}

	if ( ! $token ) {
		$auth = '';
		if ( ! empty( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
			$auth = sanitize_text_field( wp_unslash( $_SERVER['HTTP_AUTHORIZATION'] ) );
		} elseif ( ! empty( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
			$auth = sanitize_text_field( wp_unslash( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) );
		}

		if ( $auth && preg_match( '/^Bearer\s+(\S+)$/i', $auth, $m ) ) {
			$token = $m[1];
		}
	}

	if ( ! $token ) {
		return 0;
	}

	$payload = dtb_verify_jwt( $token );
	if ( is_wp_error( $payload ) ) {
		return 0;
	}

	return isset( $payload->sub ) ? (int) $payload->sub : 0;
}

// =============================================================================
// COOKIE HELPERS
// =============================================================================

/**
 * Emit the dtb_auth JWT as an HttpOnly cookie.
 *
 * SameSite policy:
 *   - Same-origin requests (production domain) → SameSite=Strict (most secure).
 *   - Cross-origin requests from an allowlisted origin (e.g. GitHub Pages dev
 *     preview) → SameSite=None; Secure so the browser will actually send the
 *     cookie back on subsequent cross-origin credentialed fetches.
 *
 * Without SameSite=None, browsers silently drop the cookie on cross-site
 * requests regardless of CORS headers, making login from GitHub Pages
 * permanently impossible.
 *
 * @param string $jwt     Signed JWT string.
 * @param int    $ttl_sec Cookie lifetime in seconds (default: 7 days).
 */
function dtb_set_auth_cookie( string $jwt, int $ttl_sec = 604800 ): void {
	$cross_origin = dtb_is_cross_origin_request();

	setcookie( DTB_AUTH_COOKIE, $jwt, [
		'expires'  => time() + $ttl_sec,
		'path'     => '/',
		'domain'   => '',
		'secure'   => true,   // always true — SameSite=None requires Secure
		'httponly' => true,
		'samesite' => $cross_origin ? 'None' : 'Strict',
	] );
}

/**
 * Clear the dtb_auth cookie (logout).
 */
function dtb_clear_auth_cookie(): void {
	$cross_origin = dtb_is_cross_origin_request();

	setcookie( DTB_AUTH_COOKIE, '', [
		'expires'  => time() - 3600,
		'path'     => '/',
		'domain'   => '',
		'secure'   => true,
		'httponly' => true,
		'samesite' => $cross_origin ? 'None' : 'Strict',
	] );
}

/**
 * Return true when the current request comes from a cross-origin allowlisted
 * source (e.g. the GitHub Pages dev build).
 *
 * Used to decide whether to issue SameSite=None cookies.
 */
function dtb_is_cross_origin_request(): bool {
	$raw_origin = isset( $_SERVER['HTTP_ORIGIN'] )
		? rtrim( (string) wp_unslash( $_SERVER['HTTP_ORIGIN'] ), '/' ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';

	if ( '' === $raw_origin ) {
		return false;
	}

	// Same-origin: the production domain itself.
	$home = rtrim( (string) ( defined( 'WP_HOME' ) ? WP_HOME : home_url() ), '/' );
	if ( $raw_origin === $home || $raw_origin === 'https://www.drywalltoolbox.com' ) {
		return false;
	}

	// Any other allowlisted origin is cross-origin (dev / staging / GitHub Pages).
	return in_array( $raw_origin, dtb_allowed_origins(), true );
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

	register_rest_route( $ns, '/auth/register', [
		'methods'             => 'POST',
		'callback'            => 'dtb_auth_register',
		'permission_callback' => '__return_true',
		'args'                => [
			'email'      => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_email',
				'description'       => 'New user e-mail address.',
			],
			'password'   => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_text_field',
				'description'       => 'New user password (minimum 8 characters).',
			],
			'first_name' => [
				'required'          => false,
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => '',
			],
			'last_name'  => [
				'required'          => false,
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => '',
			],
		],
	] );

	register_rest_route( $ns, '/auth/forgot-password', [
		'methods'             => 'POST',
		'callback'            => 'dtb_auth_forgot_password',
		'permission_callback' => '__return_true',
		'args'                => [
			'email'   => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_email',
				'description'       => 'E-mail address to send the reset link to.',
			],
			'spa_url' => [
				'required'          => false,
				'sanitize_callback' => 'esc_url_raw',
				'default'           => '',
				'description'       => 'Base URL of the SPA (e.g. GitHub Pages URL). When provided and valid, the password reset link in the email will point to this URL instead of WP_HOME.',
			],
		],
	] );

	register_rest_route( $ns, '/auth/reset-password', [
		'methods'             => 'POST',
		'callback'            => 'dtb_auth_reset_password',
		'permission_callback' => '__return_true',
		'args'                => [
			'key'      => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_text_field',
				'description'       => 'Password reset key from the reset e-mail.',
			],
			'login'    => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_user',
				'description'       => 'User login (username or e-mail).',
			],
			'password' => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_text_field',
				'description'       => 'New password (minimum 8 characters).',
			],
		],
	] );
}

// =============================================================================
// ROUTE CALLBACKS
// =============================================================================

/**
 * POST /dtb/v1/auth/login
 *
 * Accepts { email, password } or { login, password } where login is a
 * WordPress username.  Authenticates via wp_authenticate(), generates a
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

	// Accept either 'email' or 'login' (WP username) as the identity field.
	$login    = sanitize_text_field( (string) ( $request->get_param( 'login' ) ?? '' ) );
	$email    = sanitize_email( (string) ( $request->get_param( 'email' ) ?? '' ) );
	$identity = $login ?: $email;  // login takes precedence; email is the fallback
	$password = (string) $request->get_param( 'password' );

	if ( empty( $identity ) || empty( $password ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'missing_credentials', 'Email (or login) and password are required.', 400 ),
			400
		);
	}

	$user = wp_authenticate( $identity, $password );

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
 * POST /dtb/v1/auth/register
 *
 * Creates a new WordPress user and a matching WooCommerce customer record,
 * then auto-logs in the new user by setting the dtb_auth cookie.
 *
 * Expected JSON body: { email, password, first_name, last_name }
 *
 * Success: HTTP 201  { success: true, user: { id, email, display_name, roles } }
 * Errors:
 *   422 — validation failure (email format, password length)
 *   409 — e-mail already registered
 *   500 — unexpected user-creation failure
 *
 * @param WP_REST_Request $request Incoming request.
 * @return WP_REST_Response
 */
function dtb_auth_register( WP_REST_Request $request ): WP_REST_Response {
	$rl = dtb_rate_limit( $request, 'auth_register' );
	if ( $rl ) {
		return $rl;
	}

	$email      = sanitize_email( (string) $request->get_param( 'email' ) );
	$password   = (string) $request->get_param( 'password' );
	$first_name = sanitize_text_field( (string) $request->get_param( 'first_name' ) );
	$last_name  = sanitize_text_field( (string) $request->get_param( 'last_name' ) );

	// ── Server-side validation ──────────────────────────────────────────────
	if ( ! is_email( $email ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'invalid_email', 'Please provide a valid email address.', 422 ),
			422
		);
	}

	if ( strlen( $password ) < 8 ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'weak_password', 'Password must be at least 8 characters.', 422 ),
			422
		);
	}

	if ( email_exists( $email ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'email_exists', 'An account with this email address already exists.', 409 ),
			409
		);
	}

	// ── Create WordPress user ───────────────────────────────────────────────
	$display_name = trim( $first_name . ' ' . $last_name ) ?: $email;

	$user_id = wp_insert_user( [
		'user_login'   => $email,   // use email as login for uniqueness
		'user_email'   => $email,
		'user_pass'    => $password,
		'first_name'   => $first_name,
		'last_name'    => $last_name,
		'display_name' => $display_name,
		'role'         => 'customer',
	] );

	if ( is_wp_error( $user_id ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'registration_failed', $user_id->get_error_message(), 500 ),
			500
		);
	}

	// ── Create WooCommerce customer record ──────────────────────────────────
	// Guard against WooCommerce being inactive to prevent fatal errors.
	if ( class_exists( 'WC_Customer' ) ) {
		try {
			$wc_customer = new WC_Customer( $user_id );
			$wc_customer->set_email( $email );
			$wc_customer->set_first_name( $first_name );
			$wc_customer->set_last_name( $last_name );
			$wc_customer->set_billing_email( $email );
			$wc_customer->set_billing_first_name( $first_name );
			$wc_customer->set_billing_last_name( $last_name );
			$wc_customer->save();
		} catch ( Exception $e ) {
			// WC customer creation is best-effort; user is already created.
			error_log( '[DTB] WC_Customer save failed for user ' . $user_id . ': ' . $e->getMessage() );
		}
	}

	// ── Auto-login: generate JWT and set the auth cookie ───────────────────
	$user = get_user_by( 'id', $user_id );
	$jwt  = dtb_generate_jwt( $user );
	dtb_set_auth_cookie( $jwt, 7 * DAY_IN_SECONDS );

	// ── Send WordPress new-user notification email ──────────────────────────
	wp_new_user_notification( $user_id, null, 'user' );

	$response = new WP_REST_Response( [
		'success' => true,
		'user'    => [
			'id'           => $user->ID,
			'email'        => $user->user_email,
			'display_name' => $user->display_name,
			'roles'        => array_values( (array) $user->roles ),
		],
	], 201 );
	$response->header( 'Cache-Control', 'private, no-store' );
	return $response;
}

/**
 * POST /dtb/v1/auth/forgot-password
 *
 * Accepts an email address.  If a matching WP user exists, generates a
 * password reset key and sends a reset link pointing to the React SPA
 * at /reset-password?key={key}&login={login} (NOT wp-login.php).
 *
 * Optional `spa_url` parameter: when a cross-origin SPA (e.g. GitHub Pages)
 * provides its own base URL, the reset link in the email will target that SPA
 * instead of WP_HOME.  The origin is validated against dtb_allowed_origins().
 *
 * Always returns HTTP 200 with the same message regardless of whether the
 * email matched a real account (prevents user enumeration).
 *
 * @param WP_REST_Request $request Incoming request.
 * @return WP_REST_Response
 */
function dtb_auth_forgot_password( WP_REST_Request $request ): WP_REST_Response {
	$email = sanitize_email( (string) $request->get_param( 'email' ) );

	$generic = new WP_REST_Response( [
		'success' => true,
		'message' => 'If an account with that address exists, a reset link has been sent.',
	], 200 );
	$generic->header( 'Cache-Control', 'private, no-store' );

	if ( ! is_email( $email ) ) {
		return $generic; // do not reveal format issues
	}

	$user = get_user_by( 'email', $email );
	if ( ! $user ) {
		return $generic; // user enumeration prevention
	}

	// Generate a native WP password reset key.
	$reset_key = get_password_reset_key( $user );
	if ( is_wp_error( $reset_key ) ) {
		error_log( '[DTB] get_password_reset_key failed for user ' . $user->ID . ': ' . $reset_key->get_error_message() );
		return $generic; // fail silently — still return generic message
	}

	// Build the reset URL pointing to the React SPA (not wp-login.php).
	//
	// When a cross-origin SPA (e.g. GitHub Pages) sends a `spa_url` parameter,
	// use that URL as the reset-link base so the emailed link sends the user
	// back to the correct SPA origin (e.g. https://elliotttmiller.github.io/drywall-toolbox).
	// The origin component of the provided URL is validated against the DTB
	// allowlist before use; unknown/untrusted URLs fall back to WP_HOME.
	$default_spa_base = defined( 'WP_HOME' ) ? rtrim( (string) WP_HOME, '/' ) : '';
	$spa_url_param    = (string) $request->get_param( 'spa_url' );
	$spa_base         = $default_spa_base; // default: same-origin (production domain)

	if ( $spa_url_param ) {
		$parsed      = wp_parse_url( $spa_url_param );
		$parsed_host = ! empty( $parsed['host'] ) ? (string) $parsed['host'] : '';

		if ( $parsed_host ) {
			$parsed_origin = ( ! empty( $parsed['scheme'] ) ? $parsed['scheme'] : 'https' )
				. '://'
				. $parsed_host;

			if (
				function_exists( 'dtb_allowed_origins' ) &&
				in_array( rtrim( $parsed_origin, '/' ), dtb_allowed_origins(), true )
			) {
				// Strip any trailing slash so '/reset-password' appends cleanly.
				$spa_base = rtrim( $spa_url_param, '/' );
			}
		}
	}

	$reset_url = add_query_arg(
		[
			'key'   => rawurlencode( $reset_key ),
			'login' => rawurlencode( $user->user_login ),
		],
		$spa_base . '/reset-password'
	);

	$site_name = get_bloginfo( 'name' ) ?: 'Drywall Toolbox';
	$subject   = sprintf( '[%s] Password Reset Request', $site_name );

	$message  = sprintf( "Hi %s,\r\n\r\n", $user->display_name ?: $user->user_login );
	$message .= "We received a request to reset the password for your account.\r\n\r\n";
	$message .= "Click the link below to set a new password. This link expires in 24 hours.\r\n\r\n";
	$message .= $reset_url . "\r\n\r\n";
	$message .= "If you did not request this, you can safely ignore this email.\r\n\r\n";
	$message .= '— ' . $site_name;

	wp_mail( $user->user_email, $subject, $message );

	return $generic;
}

/**
 * POST /dtb/v1/auth/reset-password
 *
 * Validates a password reset key, enforces the minimum password length,
 * and resets the user's password using the native WP function.
 *
 * Expected JSON body: { key, login, password }
 *
 * Success: HTTP 200  { success: true, message: '...' }
 * Errors:
 *   400 — invalid / expired key, or validation failure
 *
 * @param WP_REST_Request $request Incoming request.
 * @return WP_REST_Response
 */
function dtb_auth_reset_password( WP_REST_Request $request ): WP_REST_Response {
	$key      = sanitize_text_field( (string) $request->get_param( 'key' ) );
	$login    = sanitize_user( (string) $request->get_param( 'login' ) );
	$password = (string) $request->get_param( 'password' );

	if ( strlen( $password ) < 8 ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'weak_password', 'Password must be at least 8 characters.', 400 ),
			400
		);
	}

	// Validate the reset key using the native WP function.
	$user = check_password_reset_key( $key, $login );

	if ( is_wp_error( $user ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'invalid_key', 'This reset link is invalid or has expired. Please request a new one.', 400 ),
			400
		);
	}

	// Reset the password using native WP — this also invalidates the key.
	reset_password( $user, $password );

	$response = new WP_REST_Response( [
		'success' => true,
		'message' => 'Your password has been reset. You can now sign in with your new password.',
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
		$response = new WP_REST_Response( [
			'success'       => true,
			'authenticated' => false,
			'user'          => null,
		], 200 );
		$response->header( 'Cache-Control', 'private, no-store' );
		return $response;
	}

	$payload = dtb_verify_jwt( $token );

	if ( is_wp_error( $payload ) ) {
		dtb_clear_auth_cookie();
		$response = new WP_REST_Response( [
			'success'       => true,
			'authenticated' => false,
			'user'          => null,
			'message'       => 'Session expired. Please log in again.',
		], 200 );
		$response->header( 'Cache-Control', 'private, no-store' );
		return $response;
	}

	$user = get_user_by( 'id', (int) $payload->sub );

	if ( ! $user ) {
		dtb_clear_auth_cookie();
		$response = new WP_REST_Response( [
			'success'       => true,
			'authenticated' => false,
			'user'          => null,
			'message'       => 'User account not found.',
		], 200 );
		$response->header( 'Cache-Control', 'private, no-store' );
		return $response;
	}

	$response = new WP_REST_Response( [
		'success'       => true,
		'authenticated' => true,
		'user'          => [
			'id'           => $user->ID,
			'email'        => $user->user_email,
			'display_name' => $user->display_name,
			'roles'        => array_values( (array) $user->roles ),
		],
	], 200 );
	$response->header( 'Cache-Control', 'private, no-store' );
	return $response;
}
