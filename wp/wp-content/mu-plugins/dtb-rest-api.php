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
 * Depends on (loaded before this file via 00-dtb-loader.php)
 * ────────────────────────────────────────────────────
 *   00-dtb-loader.php  → dtb_allowed_origins(), dtb_check_origin()
 *   dtb-utils.php      → dtb_get_config(), dtb_get_wc_credentials(),
 *                         dtb_error_envelope(), dtb_get_client_ip()
 *   dtb-auth.php       → dtb_jwt_permission()
 *   dtb-cache.php      → dtb_cached_proxy(), dtb_invalidate_product_cache(),
 *                         dtb_log_cache_event()
 *
 * Non-REST concerns (WC config, webhooks, schematics, coming-soon) remain
 * in their dedicated files.  CORS is handled here at rest_api_init priority 15.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// ROUTE REGISTRATION
// =============================================================================

add_action( 'rest_api_init', 'dtb_register_all_routes', 10 );
add_action( 'rest_api_init', 'dtb_cors_init', 15 );

function dtb_register_all_routes(): void {
	dtb_register_proxy_routes();
	dtb_register_config_routes();
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
}

// =============================================================================
// CORS
// =============================================================================

/**
 * Emit Access-Control-* headers for the DTB REST API.
 *
 * Hooked at rest_api_init priority 15 — fires after route registration
 * (priority 10) so WooCommerce hooks are already in place, and before any
 * route handler dispatches a response.
 *
 * Behaviour by request type:
 *   OPTIONS preflight  — validate origin, emit headers, return 200 and exit.
 *   Unknown origin     — return 403 and exit for any browser origin not on the
 *                        DTB allowlist.
 *   Known origin / no origin — replace WordPress default CORS filter with ours.
 */
function dtb_cors_init(): void {
	$raw_origin = isset( $_SERVER['HTTP_ORIGIN'] )
		? (string) wp_unslash( $_SERVER['HTTP_ORIGIN'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';

	$is_options = isset( $_SERVER['REQUEST_METHOD'] )
		&& 'OPTIONS' === strtoupper( sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) ) );

	// Reject unknown browser origins before any further processing.
	if ( $raw_origin && ! in_array( rtrim( $raw_origin, '/' ), dtb_allowed_origins(), true ) ) {
		http_response_code( 403 );
		exit;
	}

	if ( $is_options ) {
		dtb_emit_cors_headers( $raw_origin );
		header( 'Content-Length: 0' );
		header( 'Content-Type: text/plain' );
		http_response_code( 200 );
		exit;
	}

	remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
	add_filter( 'rest_pre_serve_request', function ( $value ) use ( $raw_origin ) {
		dtb_emit_cors_headers( $raw_origin );
		return $value;
	} );
}

/**
 * Emit the CORS response headers.
 *
 * Validates the origin against the DTB allowlist before reflecting it.
 * Unknown or absent origins receive the production domain as a fallback
 * (browsers will reject the response — safe by default).
 *
 * @param string $raw_origin Raw value from the HTTP_ORIGIN server variable.
 */
function dtb_emit_cors_headers( string $raw_origin ): void {
	if ( $raw_origin && in_array( rtrim( $raw_origin, '/' ), dtb_allowed_origins(), true ) ) {
		header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $raw_origin ) );
	} else {
		header( 'Access-Control-Allow-Origin: https://drywalltoolbox.com' );
	}

	header( 'Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS' );
	header( 'Access-Control-Allow-Credentials: true' );
	header( 'Access-Control-Allow-Headers: Content-Type, X-WP-Nonce, Authorization, X-Requested-With' );
	header( 'Access-Control-Max-Age: 86400' );
	header( 'Vary: Origin' );
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
 * GET a WC endpoint with transient caching via dtb_cached_proxy().
 *
 * Cache key and TTL are managed by dtb_cached_proxy() in dtb-cache.php.
 *
 * @param string $wc_path  WC REST path, e.g. 'wc/v3/products'
 * @param array  $params   Query parameters forwarded verbatim.
 * @return WP_REST_Response
 */
function dtb_cached_wc_get( string $wc_path, array $params ): WP_REST_Response {
	if ( ! dtb_check_origin() ) {
		return new WP_REST_Response( dtb_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
	}

	$rl = dtb_rate_limit_get();
	if ( $rl ) {
		return $rl;
	}

	$result = dtb_cached_proxy( $wc_path, $params, function () use ( $wc_path, $params ) {
		$wc_url = dtb_wc_url( $wc_path );
		if ( ! empty( $params ) ) {
			$wc_url = add_query_arg( $params, $wc_url );
		}

		$raw = wp_remote_get( $wc_url, [
			'headers' => [ 'Authorization' => dtb_wc_auth_header() ],
			'timeout' => 15,
		] );

		if ( is_wp_error( $raw ) ) {
			return new WP_Error( 'upstream_error', 'Could not reach the product catalog.', [ 'status' => 502 ] );
		}

		$code = wp_remote_retrieve_response_code( $raw );
		$body = json_decode( wp_remote_retrieve_body( $raw ), true );

		if ( $code < 200 || $code >= 300 ) {
			return new WP_Error( 'upstream_error', 'Product catalog returned an error.', [ 'status' => (int) $code ] );
		}

		return $body;
	} );

	if ( is_wp_error( $result ) ) {
		$status = (int) ( $result->get_error_data()['status'] ?? 502 );
		return new WP_REST_Response(
			dtb_error_envelope( $result->get_error_code(), $result->get_error_message(), $status ),
			$status
		);
	}

	return new WP_REST_Response( $result, 200 );
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
	return dtb_cached_wc_get( 'wc/v3/products', $params );
}

/** GET /drywall/v1/products/{id} */
function dtb_proxy_product_by_id( WP_REST_Request $request ): WP_REST_Response {
	return dtb_cached_wc_get( 'wc/v3/products/' . absint( $request->get_param( 'id' ) ), [] );
}

/** GET /drywall/v1/products/slug/{slug} */
function dtb_proxy_product_by_slug( WP_REST_Request $request ): WP_REST_Response {
	return dtb_cached_wc_get( 'wc/v3/products', [ 'slug' => sanitize_title( $request->get_param( 'slug' ) ) ] );
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
	return dtb_cached_wc_get( 'wc/v3/products/categories', $params );
}

/** GET /drywall/v1/attributes */
function dtb_proxy_attributes( WP_REST_Request $request ): WP_REST_Response {
	return dtb_cached_wc_get( 'wc/v3/products/attributes', [] );
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
	return dtb_cached_wc_get( 'wc/v3/products', $params );
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

	// Invalidate all drywall cache transients and log the event.
	$payload    = json_decode( $raw_body, true );
	$product_id = isset( $payload['id'] ) ? absint( $payload['id'] ) : 0;

	dtb_invalidate_product_cache();
	dtb_log_cache_event( 'webhook_received', [
		'product_id' => $product_id,
		'topic'      => $request->get_header( 'x_wc_webhook_topic' ) ?? 'product.unknown',
	] );

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
