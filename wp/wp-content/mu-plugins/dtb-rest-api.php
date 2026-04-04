<?php
/**
 * DTB REST API — Must-Use Plugin
 *
 * Single authoritative source for ALL custom REST routes registered by the
 * Drywall Toolbox suite.  Consolidates what was previously spread across:
 *
 *   • drywall-api-proxy.php   (drywall/v1 namespace — product proxy, orders, etc.)
 *   • dtb-woocommerce.php     (dtb/v1 config, catalog, products-csv, import-catalog)
 *   • dtb-app-passwords.php   (dtb/v1 create-app-password)
 *
 * Namespaces
 * ──────────
 *   drywall/v1   Server-side WC REST proxy (products, categories, orders, …)
 *   dtb/v1       Site-management endpoints  (config, catalog, import, auth, …)
 *
 * Depends on (loaded before this file alphabetically)
 * ────────────────────────────────────────────────────
 *   00-dtb-loader.php  → dtb_allowed_origins(), dtb_check_origin()
 *   dtb-utils.php      → dtb_get_config(), dtb_get_wc_credentials(),
 *                         dtb_error_envelope(), dtb_get_client_ip()
 *
 * Non-REST concerns (WC config, CORS, webhooks, schematics, coming-soon) remain
 * in their dedicated files.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// ─── Early exit for non-REST requests ────────────────────────────────────────
// Skip all function definitions and hook registrations on ordinary page loads,
// WP-Admin screens, and WP-CLI commands.
if ( ! defined( 'REST_REQUEST' ) || ! REST_REQUEST ) {
	return;
}

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

add_action( 'rest_api_init', 'dtb_register_all_routes', 10 );

function dtb_register_all_routes(): void {
	dtb_register_proxy_routes();
	dtb_register_config_routes();
	dtb_register_auth_routes();
}

// =============================================================================
// A. drywall/v1 — WooCommerce Proxy
//    Server-side proxy that forwards requests to WC REST API v3.
//    Consumer credentials (WC_PROXY_CONSUMER_KEY / SECRET) live exclusively
//    in wp-config.php and are never returned to the client.
// =============================================================================

function dtb_register_proxy_routes(): void {
	$ns = 'drywall/v1';

	// ── Public product / catalog routes ──────────────────────────────────────

	register_rest_route( $ns, '/products', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_products',
		'permission_callback' => '__return_true',
	] );

	// Slug route BEFORE the generic {id} route so WP matches it first.
	register_rest_route( $ns, '/products/slug/(?P<slug>[a-zA-Z0-9_-]+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_product_by_slug',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/products/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_product_by_id',
		'permission_callback' => '__return_true',
		'args'                => [ 'id' => [ 'validate_callback' => 'is_numeric' ] ],
	] );

	register_rest_route( $ns, '/categories', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_categories',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/attributes', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_attributes',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/search', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_search',
		'permission_callback' => '__return_true',
	] );

	// ── JWT-gated order routes ────────────────────────────────────────────────

	register_rest_route( $ns, '/orders', [
		'methods'             => 'POST',
		'callback'            => 'dtb_proxy_create_order',
		'permission_callback' => 'dtb_jwt_permission',
	] );

	register_rest_route( $ns, '/orders/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_get_order',
		'permission_callback' => 'dtb_jwt_permission',
		'args'                => [ 'id' => [ 'validate_callback' => 'is_numeric' ] ],
	] );

	// ── Coupons ───────────────────────────────────────────────────────────────

	register_rest_route( $ns, '/coupons/(?P<code>[a-zA-Z0-9_-]+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_coupon',
		'permission_callback' => '__return_true',
	] );

	// ── Customer routes ───────────────────────────────────────────────────────

	register_rest_route( $ns, '/customers', [
		'methods'             => 'POST',
		'callback'            => 'dtb_proxy_create_customer',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/customers/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'dtb_proxy_get_customer',
		'permission_callback' => 'dtb_jwt_permission',
		'args'                => [ 'id' => [ 'validate_callback' => 'is_numeric' ] ],
	] );

	// ── Cache-invalidation webhook receiver ───────────────────────────────────

	register_rest_route( $ns, '/webhooks/products', [
		'methods'             => 'POST',
		'callback'            => 'dtb_proxy_webhook_products',
		'permission_callback' => '__return_true',
	] );
}

// =============================================================================
// B. dtb/v1 — Site Management Endpoints
// =============================================================================

function dtb_register_config_routes(): void {
	$ns = 'dtb/v1';

	// ── GET /dtb/v1/config — runtime WC credentials for the SPA ──────────────
	register_rest_route( $ns, '/config', [
		'methods'             => 'GET',
		'callback'            => 'dtb_route_config',
		'permission_callback' => '__return_true',
	] );

	// ── GET /dtb/v1/catalog — CSV proxy URL ───────────────────────────────────
	register_rest_route( $ns, '/catalog', [
		'methods'             => 'GET',
		'callback'            => 'dtb_route_catalog',
		'permission_callback' => '__return_true',
	] );

	// ── GET /dtb/v1/products-csv — stream the catalog CSV ────────────────────
	register_rest_route( $ns, '/products-csv', [
		'methods'             => 'GET',
		'callback'            => 'dtb_route_products_csv',
		'permission_callback' => '__return_true',
	] );

	// ── POST /dtb/v1/import-catalog — trigger WC CSV import ──────────────────
	register_rest_route( $ns, '/import-catalog', [
		'methods'             => 'POST',
		'callback'            => 'dtb_route_import_catalog',
		// Access control enforced inside the callback via hash_equals().
		'permission_callback' => '__return_true',
	] );
}

function dtb_register_auth_routes(): void {
	$ns = 'dtb/v1';

	// ── POST /dtb/v1/create-app-password ─────────────────────────────────────
	register_rest_route( $ns, '/create-app-password', [
		'methods'             => 'POST',
		'callback'            => 'dtb_route_create_app_password',
		'permission_callback' => '__return_true',
		'args'                => [
			'username' => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_user',
				'description'       => 'WordPress username.',
			],
			'password' => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_text_field',
				'description'       => 'WordPress password.',
			],
			'app_name' => [
				'required'          => false,
				'sanitize_callback' => 'sanitize_text_field',
				'default'           => 'Drywall Toolbox',
				'description'       => 'Application name for the generated password.',
			],
		],
	] );

	// ── WC-Admin onboarding profile shim (suppresses core-profiler crash) ────
	register_rest_route( 'wc-admin', '/profile', [
		'methods'             => 'GET',
		'callback'            => 'dtb_route_wc_admin_profile',
		'permission_callback' => '__return_true',
	] );

	// ── JWT cookie-based auth endpoints ───────────────────────────────────────
	// These endpoints issue / validate / revoke JWTs as HttpOnly SameSite=Strict
	// cookies so the React SPA never stores the raw token string.

	register_rest_route( $ns, '/auth/login', [
		'methods'             => 'POST',
		'callback'            => 'dtb_route_auth_login',
		'permission_callback' => '__return_true',
		'args'                => [
			'email'    => [
				'required'          => true,
				'sanitize_callback' => 'sanitize_email',
				'description'       => 'WordPress user email or username.',
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
		'callback'            => 'dtb_route_auth_logout',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/auth/validate', [
		'methods'             => 'POST',
		'callback'            => 'dtb_route_auth_validate',
		'permission_callback' => '__return_true',
	] );
}

// =============================================================================
// HELPERS — WC HTTP transport
// =============================================================================

/**
 * Build the Basic-auth header for WC REST API v3 server-to-server calls.
 */
function dtb_wc_auth_header(): string {
	$config = dtb_get_config();
	return 'Basic ' . base64_encode( $config['wc_proxy_key'] . ':' . $config['wc_proxy_secret'] ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
}

/**
 * Resolve a WC REST path to an absolute URL.
 */
function dtb_wc_url( string $path ): string {
	return rest_url( ltrim( $path, '/' ) );
}

/**
 * Build a deterministic transient cache key for a WC API call.
 */
function dtb_cache_key( string $route, array $params ): string {
	ksort( $params );
	return 'drywall_cache_' . md5( $route . wp_json_encode( $params ) );
}

/**
 * GET a WC endpoint with transient caching.
 *
 * @param string $wc_path  WC REST path, e.g. 'wc/v3/products'
 * @param array  $params   Query parameters forwarded verbatim.
 * @param int    $ttl      Cache lifetime in seconds.
 * @return WP_REST_Response
 */
function dtb_cached_wc_get( string $wc_path, array $params, int $ttl ): WP_REST_Response {
	if ( ! dtb_check_origin() ) {
		return new WP_REST_Response( dtb_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
	}

	$rl = dtb_rate_limit_get();
	if ( $rl ) {
		return $rl;
	}

	$cache_key = dtb_cache_key( $wc_path, $params );
	$cached    = get_transient( $cache_key );

	if ( false !== $cached ) {
		$resp = new WP_REST_Response( $cached, 200 );
		$resp->header( 'X-Cache', 'HIT' );
		return $resp;
	}

	$wc_url = dtb_wc_url( $wc_path );
	if ( ! empty( $params ) ) {
		$wc_url = add_query_arg( $params, $wc_url );
	}

	$raw = wp_remote_get( $wc_url, [
		'headers' => [ 'Authorization' => dtb_wc_auth_header() ],
		'timeout' => 15,
	] );

	if ( is_wp_error( $raw ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'upstream_error', 'Could not reach the product catalog.', 502 ),
			502
		);
	}

	$code = wp_remote_retrieve_response_code( $raw );
	$body = json_decode( wp_remote_retrieve_body( $raw ), true );

	if ( $code < 200 || $code >= 300 ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'upstream_error', 'Product catalog returned an error.', (int) $code ),
			(int) $code
		);
	}

	set_transient( $cache_key, $body, $ttl );

	$resp = new WP_REST_Response( $body, 200 );
	$resp->header( 'X-Cache', 'MISS' );
	return $resp;
}

/**
 * POST to a WC endpoint (no caching — mutating).
 */
function dtb_wc_post( string $wc_path, array $body ): WP_REST_Response {
	if ( ! dtb_check_origin() ) {
		return new WP_REST_Response( dtb_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
	}

	$raw = wp_remote_post( dtb_wc_url( $wc_path ), [
		'headers' => [
			'Authorization' => dtb_wc_auth_header(),
			'Content-Type'  => 'application/json',
		],
		'body'    => wp_json_encode( $body ),
		'timeout' => 15,
	] );

	if ( is_wp_error( $raw ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'upstream_error', 'Could not reach the store backend.', 502 ),
			502
		);
	}

	$code = wp_remote_retrieve_response_code( $raw );
	$data = json_decode( wp_remote_retrieve_body( $raw ), true );

	if ( $code < 200 || $code >= 300 ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'upstream_error', 'Store backend returned an error.', (int) $code ),
			(int) $code
		);
	}

	return new WP_REST_Response( $data, (int) $code );
}

/**
 * GET a WC endpoint without caching (used for order/customer reads).
 */
function dtb_wc_get( string $wc_path, array $params = [] ): WP_REST_Response {
	if ( ! dtb_check_origin() ) {
		return new WP_REST_Response( dtb_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
	}

	$rl = dtb_rate_limit_get();
	if ( $rl ) {
		return $rl;
	}

	$wc_url = dtb_wc_url( $wc_path );
	if ( ! empty( $params ) ) {
		$wc_url = add_query_arg( $params, $wc_url );
	}

	$raw = wp_remote_get( $wc_url, [
		'headers' => [ 'Authorization' => dtb_wc_auth_header() ],
		'timeout' => 15,
	] );

	if ( is_wp_error( $raw ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'upstream_error', 'Could not reach the store backend.', 502 ),
			502
		);
	}

	$code = wp_remote_retrieve_response_code( $raw );
	$data = json_decode( wp_remote_retrieve_body( $raw ), true );

	if ( $code < 200 || $code >= 300 ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'upstream_error', 'Store backend returned an error.', (int) $code ),
			(int) $code
		);
	}

	return new WP_REST_Response( $data, (int) $code );
}

// =============================================================================
// HELPERS — Rate limiters
// =============================================================================

/**
 * Rate-limit mutating routes: 10 requests per 60 s per IP.
 *
 * @param WP_REST_Request $request Current request (used for context in errors).
 * @param string          $route_key Unique key per route (e.g. 'orders_post').
 * @return WP_REST_Response|null  Response to return immediately, or null to continue.
 */
function dtb_rate_limit( WP_REST_Request $request, string $route_key ): ?WP_REST_Response {
	if ( empty( $_SERVER['REMOTE_ADDR'] ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'bad_request', 'Unable to identify request origin.', 400 ), 400 );
	}
	$ip    = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
	$key   = 'drywall_rl_' . md5( $ip ) . '_' . md5( $route_key );
	$count = (int) get_transient( $key );
	if ( $count >= 10 ) {
		$resp = new WP_REST_Response(
			dtb_error_envelope( 'rate_limited', 'Too many requests. Please try again later.', 429 ),
			429
		);
		$resp->header( 'Retry-After', '60' );
		return $resp;
	}
	set_transient( $key, $count + 1, 60 );
	return null;
}

/**
 * Rate-limit public GET routes: 100 requests per 60 s per IP.
 *
 * @return WP_REST_Response|null  Response to return immediately, or null to continue.
 */
function dtb_rate_limit_get(): ?WP_REST_Response {
	if ( empty( $_SERVER['REMOTE_ADDR'] ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'bad_request', 'Unable to identify request origin.', 400 ), 400 );
	}
	$ip    = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
	$key   = 'drywall_rl_get_' . md5( $ip );
	$count = (int) get_transient( $key );
	if ( $count >= 100 ) {
		$resp = new WP_REST_Response(
			dtb_error_envelope( 'rate_limited', 'Too many requests. Please try again later.', 429 ),
			429
		);
		$resp->header( 'Retry-After', '60' );
		return $resp;
	}
	set_transient( $key, $count + 1, 60 );
	return null;
}

// =============================================================================
// HELPERS — JWT auth
// =============================================================================

/**
 * REST permission_callback that validates a JWT token.
 *
 * Token is read in priority order:
 *   1. Authorization: Bearer {token}  header  (API / mobile clients)
 *   2. dtb_auth HttpOnly cookie               (browser SPA after cookie-login)
 *
 * @param WP_REST_Request $request Incoming request.
 * @return true|WP_Error True on success; WP_Error on auth failure.
 */
function dtb_jwt_permission( WP_REST_Request $request ) {
	$token = null;

	// 1. Try Authorization header.
	$auth = $request->get_header( 'authorization' );
	if ( $auth && preg_match( '/^Bearer\s+(\S+)$/i', $auth, $m ) ) {
		$token = $m[1];
	}

	// 2. Fall back to HttpOnly cookie (set by POST /dtb/v1/auth/login).
	if ( ! $token && ! empty( $_COOKIE['dtb_auth'] ) ) {
		$token = sanitize_text_field( wp_unslash( $_COOKIE['dtb_auth'] ) );
	}

	if ( ! $token ) {
		return new WP_Error( 'missing_token', 'Authorization token required.', [ 'status' => 401 ] );
	}

	$validate_url = rest_url( 'simple-jwt-login/v1/auth/validate' );
	$resp = wp_remote_post( $validate_url, [
		'headers' => [ 'Authorization' => 'Bearer ' . $token ],
		'timeout' => 5,
	] );

	if ( is_wp_error( $resp ) || wp_remote_retrieve_response_code( $resp ) !== 200 ) {
		return new WP_Error( 'invalid_token', 'Authorization token is invalid or expired.', [ 'status' => 401 ] );
	}
	return true;
}

// =============================================================================
// HELPERS — App-password rate limiter
// =============================================================================

/**
 * Rate-limit the create-app-password endpoint: 5 attempts per IP per 5 min.
 *
 * @return WP_REST_Response|null 429 response to return, or null to proceed.
 */
function dtb_app_password_rate_limit(): ?WP_REST_Response {
	if ( empty( $_SERVER['REMOTE_ADDR'] ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'bad_request', 'Unable to identify request origin.', 400 ),
			400
		);
	}
	$ip    = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) );
	$key   = 'dtb_app_pw_rl_' . md5( $ip );
	$count = (int) get_transient( $key );
	if ( $count >= 5 ) {
		$resp = new WP_REST_Response(
			dtb_error_envelope( 'rate_limited', 'Too many requests. Please try again later.', 429 ),
			429
		);
		$resp->header( 'Retry-After', '300' );
		return $resp;
	}
	set_transient( $key, $count + 1, 300 );
	return null;
}

// =============================================================================
// ROUTE CALLBACKS — drywall/v1 proxy
// =============================================================================

/** GET /drywall/v1/products */
function dtb_proxy_products( WP_REST_Request $request ): WP_REST_Response {
	$allowed = [ 'page', 'per_page', 'category', 'search', 'orderby', 'order', 'min_price', 'max_price', 'stock_status' ];
	$params  = [];
	foreach ( $allowed as $k ) {
		$v = $request->get_param( $k );
		if ( null !== $v ) {
			$params[ $k ] = sanitize_text_field( $v );
		}
	}
	return dtb_cached_wc_get( 'wc/v3/products', $params, 600 );
}

/** GET /drywall/v1/products/{id} */
function dtb_proxy_product_by_id( WP_REST_Request $request ): WP_REST_Response {
	return dtb_cached_wc_get( 'wc/v3/products/' . absint( $request->get_param( 'id' ) ), [], 600 );
}

/** GET /drywall/v1/products/slug/{slug} */
function dtb_proxy_product_by_slug( WP_REST_Request $request ): WP_REST_Response {
	return dtb_cached_wc_get( 'wc/v3/products', [ 'slug' => sanitize_title( $request->get_param( 'slug' ) ) ], 600 );
}

/** GET /drywall/v1/categories */
function dtb_proxy_categories( WP_REST_Request $request ): WP_REST_Response {
	$params = [];
	foreach ( [ 'page', 'per_page', 'parent' ] as $k ) {
		$v = $request->get_param( $k );
		if ( null !== $v ) {
			$params[ $k ] = sanitize_text_field( $v );
		}
	}
	return dtb_cached_wc_get( 'wc/v3/products/categories', $params, 900 );
}

/** GET /drywall/v1/attributes */
function dtb_proxy_attributes( WP_REST_Request $request ): WP_REST_Response {
	return dtb_cached_wc_get( 'wc/v3/products/attributes', [], 900 );
}

/** GET /drywall/v1/search?q={query} */
function dtb_proxy_search( WP_REST_Request $request ): WP_REST_Response {
	$q = sanitize_text_field( $request->get_param( 'q' ) ?? '' );
	if ( '' === $q ) {
		return new WP_REST_Response( dtb_error_envelope( 'missing_param', 'Query parameter "q" is required.', 400 ), 400 );
	}
	$params = [ 'search' => $q ];
	foreach ( [ 'page', 'per_page' ] as $k ) {
		$v = $request->get_param( $k );
		if ( null !== $v ) {
			$params[ $k ] = sanitize_text_field( $v );
		}
	}
	return dtb_cached_wc_get( 'wc/v3/products', $params, 600 );
}

/** POST /drywall/v1/orders  (JWT-gated, rate-limited) */
function dtb_proxy_create_order( WP_REST_Request $request ): WP_REST_Response {
	$rl = dtb_rate_limit( $request, 'orders_post' );
	if ( $rl ) {
		return $rl;
	}
	$body = $request->get_json_params();
	if ( empty( $body ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'invalid_body', 'Request body must be valid JSON.', 400 ), 400 );
	}
	return dtb_wc_post( 'wc/v3/orders', $body );
}

/** GET /drywall/v1/orders/{id}  (JWT-gated) */
function dtb_proxy_get_order( WP_REST_Request $request ): WP_REST_Response {
	return dtb_wc_get( 'wc/v3/orders/' . absint( $request->get_param( 'id' ) ) );
}

/** GET /drywall/v1/coupons/{code} */
function dtb_proxy_coupon( WP_REST_Request $request ): WP_REST_Response {
	return dtb_wc_get( 'wc/v3/coupons', [ 'code' => sanitize_text_field( $request->get_param( 'code' ) ) ] );
}

/** POST /drywall/v1/customers  (rate-limited) */
function dtb_proxy_create_customer( WP_REST_Request $request ): WP_REST_Response {
	$rl = dtb_rate_limit( $request, 'customers_post' );
	if ( $rl ) {
		return $rl;
	}
	$body = $request->get_json_params();
	if ( empty( $body ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'invalid_body', 'Request body must be valid JSON.', 400 ), 400 );
	}
	return dtb_wc_post( 'wc/v3/customers', $body );
}

/** GET /drywall/v1/customers/{id}  (JWT-gated) */
function dtb_proxy_get_customer( WP_REST_Request $request ): WP_REST_Response {
	return dtb_wc_get( 'wc/v3/customers/' . absint( $request->get_param( 'id' ) ) );
}

/** POST /drywall/v1/webhooks/products — cache-invalidation receiver */
function dtb_proxy_webhook_products( WP_REST_Request $request ): WP_REST_Response {
	$config = dtb_get_config();
	$secret = $config['webhook_secret'];

	if ( '' === $secret ) {
		return new WP_REST_Response( dtb_error_envelope( 'config_error', 'Webhook secret not configured.', 500 ), 500 );
	}

	$raw_body = $request->get_body();
	$sig      = $request->get_header( 'x_wc_webhook_signature' );

	if ( ! $sig ) {
		return new WP_REST_Response( dtb_error_envelope( 'missing_signature', 'Webhook signature is required.', 401 ), 401 );
	}

	$expected = base64_encode( hash_hmac( 'sha256', $raw_body, $secret, true ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	if ( ! hash_equals( $expected, $sig ) ) {
		return new WP_REST_Response( dtb_error_envelope( 'invalid_signature', 'Webhook signature mismatch.', 401 ), 401 );
	}

	// Invalidate all drywall cache transients.
	global $wpdb;
	$wpdb->query(
		$wpdb->prepare(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
			$wpdb->esc_like( '_transient_drywall_cache_' ) . '%',
			$wpdb->esc_like( '_transient_timeout_drywall_cache_' ) . '%'
		)
	);

	$payload    = json_decode( $raw_body, true );
	$product_id = isset( $payload['id'] ) ? absint( $payload['id'] ) : 0;

	$log   = get_option( 'drywall_cache_log', [] );
	$log[] = [
		'timestamp'  => gmdate( 'c' ),
		'product_id' => $product_id,
		'event'      => $request->get_header( 'x_wc_webhook_topic' ) ?? 'product.unknown',
	];
	update_option( 'drywall_cache_log', array_slice( $log, -50 ), false );

	return new WP_REST_Response( [ 'success' => true ], 200 );
}

// =============================================================================
// ROUTE CALLBACKS — dtb/v1 management
// =============================================================================

/** GET /dtb/v1/config */
function dtb_route_config(): WP_REST_Response {
	$credentials = dtb_get_wc_credentials();

	$response = rest_ensure_response( [
		'wc_auth_user' => $credentials['auth_user'],
		'wc_auth_pass' => $credentials['auth_pass'],
	] );
	$response->header( 'Cache-Control', 'private, no-store' );
	return $response;
}

/** GET /dtb/v1/catalog */
function dtb_route_catalog(): WP_REST_Response {
	$config = dtb_get_config();
	return rest_ensure_response( [
		'csv_url'  => rest_url( 'dtb/v1/products-csv' ),
		'filename' => $config['csv_filename'],
	] );
}

/** GET /dtb/v1/products-csv — stream the catalog CSV through PHP */
function dtb_route_products_csv(): void {
	$config      = dtb_get_config();
	$upload_dir  = wp_upload_dir();
	$uploads_dir = trailingslashit( $upload_dir['basedir'] );
	$file_path   = $uploads_dir . 'wc-imports/' . $config['csv_filename'];

	$real_path    = realpath( $file_path );
	$real_uploads = realpath( $uploads_dir );

	if (
		false === $real_path ||
		false === $real_uploads ||
		0 !== strpos( $real_path, trailingslashit( $real_uploads ) ) ||
		! file_exists( $real_path )
	) {
		wp_send_json_error( dtb_error_envelope( 'csv_not_found', 'Product CSV file not found on server.', 404 ), 404 );
	}

	$raw_origin = isset( $_SERVER['HTTP_ORIGIN'] )
		? (string) wp_unslash( $_SERVER['HTTP_ORIGIN'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';

	header( 'Content-Type: text/csv; charset=UTF-8' );
	header( 'Content-Disposition: inline; filename="' . $config['csv_filename'] . '"' );
	header( 'Cache-Control: public, max-age=3600' );

	if ( $raw_origin && in_array( rtrim( $raw_origin, '/' ), dtb_allowed_origins(), true ) ) {
		header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $raw_origin ) );
		header( 'Vary: Origin' );
	}

	// phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
	readfile( $real_path );
	exit;
}

/** POST /dtb/v1/import-catalog — trigger WC CSV import */
function dtb_route_import_catalog( WP_REST_Request $request ) {
	$config   = dtb_get_config();
	$provided = (string) ( $request->get_param( 'secret' ) ?? '' );
	$expected = $config['import_secret'] ?: (string) get_option( 'dtb_import_secret', '' );

	if ( empty( $expected ) || ! hash_equals( $expected, $provided ) ) {
		return new WP_Error( 'forbidden', 'Invalid or missing import secret.', [ 'status' => 403 ] );
	}

	$upload_dir = wp_upload_dir();
	$file_path  = trailingslashit( $upload_dir['basedir'] ) . 'wc-imports/' . $config['csv_filename'];

	if ( ! file_exists( $file_path ) ) {
		return new WP_Error( 'csv_not_found', 'Product CSV not found. Ensure the deploy step has uploaded it to wc-imports/.', [ 'status' => 404 ] );
	}

	if ( function_exists( 'as_unschedule_all_actions' ) && function_exists( 'as_schedule_single_action' ) ) {
		as_unschedule_all_actions( 'dtb_run_catalog_import', [], 'dtb-catalog-sync' );
		$action_id = as_schedule_single_action( time(), 'dtb_run_catalog_import', [ $file_path ], 'dtb-catalog-sync' );
		return rest_ensure_response( [
			'status'    => 'scheduled',
			'action_id' => $action_id,
			'file'      => basename( $file_path ),
			'message'   => 'WooCommerce product import scheduled as background job.',
		] );
	}

	return dtb_run_catalog_import_sync( $file_path );
}

// =============================================================================
// ROUTE CALLBACKS — dtb/v1 JWT cookie auth
// =============================================================================

/**
 * Name of the HttpOnly JWT cookie.
 */
const DTB_AUTH_COOKIE = 'dtb_auth';

/**
 * Emit the dtb_auth JWT as an HttpOnly, SameSite=Strict cookie.
 *
 * @param string $jwt     JWT string from simple-jwt-login.
 * @param int    $ttl_sec Cookie lifetime in seconds (default: 86400 = 24 h).
 */
function dtb_set_auth_cookie( string $jwt, int $ttl_sec = 86400 ): void {
	setcookie( DTB_AUTH_COOKIE, $jwt, [
		'expires'  => time() + $ttl_sec,
		'path'     => '/',
		'domain'   => '',           // current domain only
		'secure'   => is_ssl(),     // HTTPS-only in production
		'httponly' => true,         // not accessible from JS
		'samesite' => 'Strict',     // protects against CSRF
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

/** POST /dtb/v1/auth/login — authenticate and issue HttpOnly JWT cookie. */
function dtb_route_auth_login( WP_REST_Request $request ): WP_REST_Response {
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

	// Forward credentials to the active JWT plugin (simple-jwt-login).
	$jwt_url = rest_url( 'simple-jwt-login/v1/auth' );
	$resp    = wp_remote_post( $jwt_url, [
		'body'    => wp_json_encode( [ 'email' => $email, 'password' => $password ] ),
		'headers' => [ 'Content-Type' => 'application/json' ],
		'timeout' => 10,
	] );

	if ( is_wp_error( $resp ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'auth_unavailable', 'Authentication service unavailable.', 502 ),
			502
		);
	}

	$code = wp_remote_retrieve_response_code( $resp );
	$body = json_decode( wp_remote_retrieve_body( $resp ), true );

	if ( 200 !== $code ) {
		$msg = $body['message'] ?? 'Invalid credentials.';
		return new WP_REST_Response(
			dtb_error_envelope( 'auth_failed', sanitize_text_field( $msg ), 401 ),
			401
		);
	}

	$jwt = $body['data']['jwt'] ?? '';
	if ( empty( $jwt ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'auth_failed', 'Token not returned by authentication service.', 401 ),
			401
		);
	}

	// Issue the JWT as an HttpOnly, SameSite=Strict cookie.
	dtb_set_auth_cookie( $jwt );

	// Return user info only — never expose the raw JWT in the response body.
	$user_data = $body['data']['user'] ?? [];
	$response  = new WP_REST_Response( [
		'success' => true,
		'user'    => [
			'email'       => sanitize_email( $user_data['user_email']    ?? '' ),
			'nicename'    => sanitize_text_field( $user_data['user_nicename'] ?? ( $user_data['user_login'] ?? '' ) ),
			'displayName' => sanitize_text_field( $user_data['display_name']  ?? '' ),
		],
	], 200 );

	// Prevent this response from being cached.
	$response->header( 'Cache-Control', 'private, no-store' );
	return $response;
}

/** DELETE /dtb/v1/auth/logout — clear the HttpOnly JWT cookie. */
function dtb_route_auth_logout(): WP_REST_Response {
	dtb_clear_auth_cookie();

	$response = new WP_REST_Response( [ 'success' => true ], 200 );
	$response->header( 'Cache-Control', 'private, no-store' );
	return $response;
}

/**
 * POST /dtb/v1/auth/validate — validate the current JWT (cookie or Bearer)
 * and return the authenticated user's profile.
 */
function dtb_route_auth_validate( WP_REST_Request $request ): WP_REST_Response {
	$token = null;

	// 1. Check Authorization header.
	$auth = $request->get_header( 'authorization' );
	if ( $auth && preg_match( '/^Bearer\s+(\S+)$/i', $auth, $m ) ) {
		$token = $m[1];
	}

	// 2. Fall back to HttpOnly cookie.
	if ( ! $token && ! empty( $_COOKIE[ DTB_AUTH_COOKIE ] ) ) {
		$token = sanitize_text_field( wp_unslash( $_COOKIE[ DTB_AUTH_COOKIE ] ) );
	}

	if ( ! $token ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'missing_token', 'No active session.', 401 ),
			401
		);
	}

	$validate_url = rest_url( 'simple-jwt-login/v1/auth/validate' );
	$resp = wp_remote_post( $validate_url, [
		'headers' => [ 'Authorization' => 'Bearer ' . $token ],
		'timeout' => 5,
	] );

	if ( is_wp_error( $resp ) || 200 !== wp_remote_retrieve_response_code( $resp ) ) {
		// Invalid / expired — also clear the cookie.
		dtb_clear_auth_cookie();
		return new WP_REST_Response(
			dtb_error_envelope( 'invalid_token', 'Session expired. Please log in again.', 401 ),
			401
		);
	}

	$body      = json_decode( wp_remote_retrieve_body( $resp ), true );
	$user_data = $body['data']['user'] ?? [];

	$response = new WP_REST_Response( [
		'success' => true,
		'user'    => [
			'email'       => sanitize_email( $user_data['user_email']    ?? '' ),
			'nicename'    => sanitize_text_field( $user_data['user_nicename'] ?? ( $user_data['user_login'] ?? '' ) ),
			'displayName' => sanitize_text_field( $user_data['display_name']  ?? '' ),
		],
	], 200 );
	$response->header( 'Cache-Control', 'private, no-store' );
	return $response;
}

/** POST /dtb/v1/create-app-password */
function dtb_route_create_app_password( WP_REST_Request $request ): WP_REST_Response {
	$rl = dtb_app_password_rate_limit();
	if ( $rl ) {
		return $rl;
	}

	try {
		$username = sanitize_user( $request->get_param( 'username' ) );
		$password = $request->get_param( 'password' );
		$app_name = sanitize_text_field( $request->get_param( 'app_name' ) ) ?: 'Drywall Toolbox';

		if ( empty( $username ) || empty( $password ) ) {
			return new WP_REST_Response(
				dtb_error_envelope( 'missing_credentials', 'Username and password are required.', 400 ),
				400
			);
		}

		$user = wp_authenticate( $username, $password );

		if ( ! $user || is_wp_error( $user ) ) {
			return new WP_REST_Response(
				dtb_error_envelope( 'invalid_credentials', 'Invalid username or password.', 401 ),
				401
			);
		}

		if ( ! class_exists( 'WP_Application_Passwords' ) ) {
			require_once ABSPATH . 'wp-includes/class-wp-application-passwords.php';
		}

		$result = WP_Application_Passwords::create_new_application_password(
			$user->ID,
			[ 'name' => $app_name ]
		);

		if ( is_wp_error( $result ) ) {
			return new WP_REST_Response(
				dtb_error_envelope( 'create_failed', $result->get_error_message(), 500 ),
				500
			);
		}

		$password_string = $result[0] ?? '';

		if ( empty( $password_string ) ) {
			return new WP_REST_Response(
				dtb_error_envelope( 'empty_password', 'Application password was created but the string is empty.', 500 ),
				500
			);
		}

		return new WP_REST_Response( [
			'success'  => true,
			'message'  => 'Application password created successfully.',
			'username' => $username,
			'password' => $password_string,
			'app_name' => $app_name,
			'note'     => 'Use these credentials for WooCommerce REST API access. Password will not be shown again.',
		], 200 );

	} catch ( Exception $e ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'server_error', $e->getMessage(), 500 ),
			500
		);
	}
}

/** GET /wc-admin/profile — shim to suppress core-profiler crash */
function dtb_route_wc_admin_profile(): WP_REST_Response {
	return rest_ensure_response( [
		'title'               => 'Drywall Toolbox',
		'industries'          => [ [ 'slug' => 'retail' ] ],
		'products'            => [],
		'business_extensions' => [],
		'completed'           => true,
		'skipped'             => true,
	] );
}

// =============================================================================
// CATALOG IMPORT — Action Scheduler callback + sync runner
// (shared between the REST endpoint and background processing)
// =============================================================================

add_action( 'dtb_run_catalog_import', function ( string $file_path ): void {
	dtb_run_catalog_import_sync( $file_path );
} );

/**
 * Run a WooCommerce CSV product import synchronously.
 *
 * @param string $file_path Absolute server path to the CSV.
 * @return WP_REST_Response|WP_Error
 */
function dtb_run_catalog_import_sync( string $file_path ) {
	if ( ! file_exists( $file_path ) ) {
		return new WP_Error( 'csv_not_found', 'CSV file not found: ' . basename( $file_path ), [ 'status' => 404 ] );
	}

	if ( ! defined( 'WC_ABSPATH' ) ) {
		return new WP_Error( 'wc_not_loaded', 'WooCommerce is not loaded.', [ 'status' => 500 ] );
	}

	if ( ! class_exists( 'WC_Product_CSV_Importer' ) ) {
		$importer_file = WC_ABSPATH . 'includes/import/class-wc-product-csv-importer.php';
		if ( ! file_exists( $importer_file ) ) {
			return new WP_Error( 'importer_not_found', 'WooCommerce CSV importer class not available.', [ 'status' => 500 ] );
		}
		require_once $importer_file;
	}

	$importer = new WC_Product_CSV_Importer( $file_path, [
		'update_existing'    => true,
		'character_encoding' => '',
		'lines'              => -1,
		'mapping'            => [],
		'parse'              => true,
	] );
	$results = $importer->import();

	do_action( 'woocommerce_product_import_end' );
	wc_delete_product_transients();

	return rest_ensure_response( [
		'status'   => 'completed',
		'file'     => basename( $file_path ),
		'imported' => (int) ( $results['imported'] ?? 0 ),
		'updated'  => (int) ( $results['updated']  ?? 0 ),
		'skipped'  => (int) ( $results['skipped']  ?? 0 ),
		'failed'   => (int) ( $results['failed']   ?? 0 ),
	] );
}
