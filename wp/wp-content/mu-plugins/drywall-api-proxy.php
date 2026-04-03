<?php
/**
 * Drywall API Proxy — Must-Use Plugin
 *
 * Server-side proxy exposing a drywall/v1 REST namespace that forwards
 * requests to WooCommerce REST API v3.  Consumer credentials live
 * exclusively in wp-config.php; they are never returned to the client.
 *
 * Sections implemented:
 *   1.1  CORS whitelist (https://drywalltoolbox.com, http://localhost:3000)
 *   1.2  Credentials from WC_PROXY_CONSUMER_KEY / WC_PROXY_CONSUMER_SECRET
 *   1.3  Route registration (drywall/v1 namespace)
 *   1.4  WP Transient cache (products 600 s, categories/attributes 900 s)
 *   1.5  Cache invalidation via webhook receiver
 *   1.6  Uniform error envelope
 *   1.7  Rate limiting on mutating routes (10 req / 60 s per IP)
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// ─── 1.1 CORS ─────────────────────────────────────────────────────────────────

add_action( 'plugins_loaded', 'drywall_proxy_cors_boot', 1 );

function drywall_proxy_cors_boot() {
	$allowed = [
		'https://drywalltoolbox.com',
		'http://localhost:3000',
	];

	$raw_origin = isset( $_SERVER['HTTP_ORIGIN'] )
		? wp_unslash( $_SERVER['HTTP_ORIGIN'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';

	$origin_ok = $raw_origin && in_array( rtrim( $raw_origin, '/' ), $allowed, true );

	// OPTIONS preflight — respond immediately before any WooCommerce code runs.
	if ( isset( $_SERVER['REQUEST_METHOD'] ) && 'OPTIONS' === strtoupper( $_SERVER['REQUEST_METHOD'] ) ) {
		if ( $origin_ok ) {
			header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $raw_origin ) );
		} else {
			http_response_code( 403 );
			exit;
		}
		header( 'Access-Control-Allow-Credentials: true' );
		header( 'Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS' );
		header( 'Access-Control-Allow-Headers: Content-Type, X-WP-Nonce, Authorization, X-Requested-With' );
		header( 'Content-Length: 0' );
		header( 'Content-Type: text/plain' );
		http_response_code( 200 );
		exit;
	}

	// Non-preflight: attach CORS headers for REST API responses.
	add_action( 'rest_api_init', function () use ( $allowed, $raw_origin, $origin_ok ) {
		remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
		add_filter( 'rest_pre_serve_request', function ( $value ) use ( $allowed, $raw_origin, $origin_ok ) {
			if ( $origin_ok ) {
				header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $raw_origin ) );
			} else {
				// Unknown origin — 403 will be returned by the route handler.
				header( 'Access-Control-Allow-Origin: https://drywalltoolbox.com' );
			}
			header( 'Access-Control-Allow-Credentials: true' );
			header( 'Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS' );
			header( 'Access-Control-Allow-Headers: Content-Type, X-WP-Nonce, Authorization, X-Requested-With' );
			header( 'Vary: Origin' );
			return $value;
		}, 1 );
	}, 1 );
}

// ─── Route registration ───────────────────────────────────────────────────────

add_action( 'rest_api_init', 'drywall_proxy_register_routes' );

function drywall_proxy_register_routes() {
	$ns = 'drywall/v1';

	// ── 1.3 Public product/catalog routes ────────────────────────────────────
	register_rest_route( $ns, '/products', [
		'methods'             => 'GET',
		'callback'            => 'drywall_route_products',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/products/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'drywall_route_product_by_id',
		'permission_callback' => '__return_true',
		'args'                => [ 'id' => [ 'validate_callback' => 'is_numeric' ] ],
	] );

	// Slug route must be registered BEFORE the generic {id} route so WordPress
	// matches the literal "slug" segment first.
	register_rest_route( $ns, '/products/slug/(?P<slug>[a-zA-Z0-9_-]+)', [
		'methods'             => 'GET',
		'callback'            => 'drywall_route_product_by_slug',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/categories', [
		'methods'             => 'GET',
		'callback'            => 'drywall_route_categories',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/attributes', [
		'methods'             => 'GET',
		'callback'            => 'drywall_route_attributes',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/search', [
		'methods'             => 'GET',
		'callback'            => 'drywall_route_search',
		'permission_callback' => '__return_true',
	] );

	// ── 1.3 JWT-gated order routes ────────────────────────────────────────────
	register_rest_route( $ns, '/orders', [
		'methods'             => 'POST',
		'callback'            => 'drywall_route_create_order',
		'permission_callback' => 'drywall_jwt_permission',
	] );

	register_rest_route( $ns, '/orders/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'drywall_route_get_order',
		'permission_callback' => 'drywall_jwt_permission',
		'args'                => [ 'id' => [ 'validate_callback' => 'is_numeric' ] ],
	] );

	// ── 1.3 Coupons ───────────────────────────────────────────────────────────
	register_rest_route( $ns, '/coupons/(?P<code>[a-zA-Z0-9_-]+)', [
		'methods'             => 'GET',
		'callback'            => 'drywall_route_coupon',
		'permission_callback' => '__return_true',
	] );

	// ── 1.3 Customer routes ───────────────────────────────────────────────────
	register_rest_route( $ns, '/customers', [
		'methods'             => 'POST',
		'callback'            => 'drywall_route_create_customer',
		'permission_callback' => '__return_true',
	] );

	register_rest_route( $ns, '/customers/(?P<id>\d+)', [
		'methods'             => 'GET',
		'callback'            => 'drywall_route_get_customer',
		'permission_callback' => 'drywall_jwt_permission',
		'args'                => [ 'id' => [ 'validate_callback' => 'is_numeric' ] ],
	] );

	// ── 1.5 Webhook receiver ──────────────────────────────────────────────────
	register_rest_route( $ns, '/webhooks/products', [
		'methods'             => 'POST',
		'callback'            => 'drywall_route_webhook_products',
		'permission_callback' => '__return_true',
	] );
}

// ─── 1.2 Credential helpers ───────────────────────────────────────────────────

function drywall_wc_auth_header() {
	$key    = defined( 'WC_PROXY_CONSUMER_KEY' )    ? WC_PROXY_CONSUMER_KEY    : '';
	$secret = defined( 'WC_PROXY_CONSUMER_SECRET' ) ? WC_PROXY_CONSUMER_SECRET : '';
	return 'Basic ' . base64_encode( $key . ':' . $secret ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
}

// ─── 1.1 Origin guard ─────────────────────────────────────────────────────────

function drywall_check_origin() {
	$allowed    = [ 'https://drywalltoolbox.com', 'http://localhost:3000' ];
	$raw_origin = isset( $_SERVER['HTTP_ORIGIN'] )
		? wp_unslash( $_SERVER['HTTP_ORIGIN'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';
	if ( $raw_origin && ! in_array( rtrim( $raw_origin, '/' ), $allowed, true ) ) {
		return false;
	}
	return true;
}

// ─── 1.3 JWT permission callback ─────────────────────────────────────────────

function drywall_jwt_permission( WP_REST_Request $request ) {
	$auth = $request->get_header( 'authorization' );
	if ( ! $auth || ! preg_match( '/^Bearer\s+(\S+)$/i', $auth, $m ) ) {
		return new WP_Error( 'missing_token', 'Authorization token required.', [ 'status' => 401 ] );
	}
	$token = $m[1];

	// Validate via the active JWT plugin REST endpoint.
	// Supports both simple-jwt-login and jwt-authentication-for-wp-rest-api.
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

// ─── 1.7 Rate limiter ─────────────────────────────────────────────────────────

function drywall_rate_limit( WP_REST_Request $request, string $route_key ): ?WP_REST_Response {
	$ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
	$key = 'drywall_rl_' . md5( $ip ) . '_' . md5( $route_key );
	$count = (int) get_transient( $key );
	if ( $count >= 10 ) {
		$resp = new WP_REST_Response(
			drywall_error_envelope( 'rate_limited', 'Too many requests. Please try again later.', 429 ),
			429
		);
		$resp->header( 'Retry-After', '60' );
		return $resp;
	}
	set_transient( $key, $count + 1, 60 );
	return null;
}

// ─── 1.6 Error envelope helper ────────────────────────────────────────────────

function drywall_error_envelope( string $code, string $message, int $status ): array {
	return [
		'success' => false,
		'code'    => $code,
		'message' => $message,
		'data'    => [ 'status' => $status ],
	];
}

// ─── 1.4 Cache helpers ────────────────────────────────────────────────────────

function drywall_cache_key( string $route, array $params ): string {
	ksort( $params );
	return 'drywall_cache_' . md5( $route . wp_json_encode( $params ) );
}

/**
 * Execute a WC API GET call with transient caching.
 *
 * @param string $wc_path  WooCommerce REST path (e.g. /wc/v3/products)
 * @param array  $params   Query params forwarded to WooCommerce
 * @param int    $ttl      Cache TTL in seconds
 * @return WP_REST_Response
 */
function drywall_cached_wc_get( string $wc_path, array $params, int $ttl ): WP_REST_Response {
	if ( ! drywall_check_origin() ) {
		return new WP_REST_Response( drywall_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
	}

	$cache_key = drywall_cache_key( $wc_path, $params );
	$cached    = get_transient( $cache_key );

	if ( false !== $cached ) {
		$resp = new WP_REST_Response( $cached, 200 );
		$resp->header( 'X-Cache', 'HIT' );
		return $resp;
	}

	$wc_url = drywall_wc_url( $wc_path );
	if ( ! empty( $params ) ) {
		$wc_url = add_query_arg( $params, $wc_url );
	}

	$raw = wp_remote_get( $wc_url, [
		'headers' => [ 'Authorization' => drywall_wc_auth_header() ],
		'timeout' => 15,
	] );

	if ( is_wp_error( $raw ) ) {
		return new WP_REST_Response(
			drywall_error_envelope( 'upstream_error', 'Could not reach the product catalog.', 502 ),
			502
		);
	}

	$code = wp_remote_retrieve_response_code( $raw );
	$body = json_decode( wp_remote_retrieve_body( $raw ), true );

	if ( $code < 200 || $code >= 300 ) {
		return new WP_REST_Response(
			drywall_error_envelope( 'upstream_error', 'Product catalog returned an error.', (int) $code ),
			(int) $code
		);
	}

	set_transient( $cache_key, $body, $ttl );

	$resp = new WP_REST_Response( $body, 200 );
	$resp->header( 'X-Cache', 'MISS' );
	return $resp;
}

// ─── WC URL helper ────────────────────────────────────────────────────────────

function drywall_wc_url( string $path ): string {
	return rest_url( ltrim( $path, '/' ) );
}

// ─── WC POST/authenticated helper ────────────────────────────────────────────

function drywall_wc_post( string $wc_path, array $body ): WP_REST_Response {
	if ( ! drywall_check_origin() ) {
		return new WP_REST_Response( drywall_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
	}

	$raw = wp_remote_post( drywall_wc_url( $wc_path ), [
		'headers' => [
			'Authorization' => drywall_wc_auth_header(),
			'Content-Type'  => 'application/json',
		],
		'body'    => wp_json_encode( $body ),
		'timeout' => 15,
	] );

	if ( is_wp_error( $raw ) ) {
		return new WP_REST_Response(
			drywall_error_envelope( 'upstream_error', 'Could not reach the store backend.', 502 ),
			502
		);
	}

	$code = wp_remote_retrieve_response_code( $raw );
	$data = json_decode( wp_remote_retrieve_body( $raw ), true );

	if ( $code < 200 || $code >= 300 ) {
		return new WP_REST_Response(
			drywall_error_envelope( 'upstream_error', 'Store backend returned an error.', (int) $code ),
			(int) $code
		);
	}

	return new WP_REST_Response( $data, (int) $code );
}

// ─── WC GET (no cache) helper ─────────────────────────────────────────────────

function drywall_wc_get( string $wc_path, array $params = [] ): WP_REST_Response {
	if ( ! drywall_check_origin() ) {
		return new WP_REST_Response( drywall_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
	}

	$wc_url = drywall_wc_url( $wc_path );
	if ( ! empty( $params ) ) {
		$wc_url = add_query_arg( $params, $wc_url );
	}

	$raw = wp_remote_get( $wc_url, [
		'headers' => [ 'Authorization' => drywall_wc_auth_header() ],
		'timeout' => 15,
	] );

	if ( is_wp_error( $raw ) ) {
		return new WP_REST_Response(
			drywall_error_envelope( 'upstream_error', 'Could not reach the store backend.', 502 ),
			502
		);
	}

	$code = wp_remote_retrieve_response_code( $raw );
	$data = json_decode( wp_remote_retrieve_body( $raw ), true );

	if ( $code < 200 || $code >= 300 ) {
		return new WP_REST_Response(
			drywall_error_envelope( 'upstream_error', 'Store backend returned an error.', (int) $code ),
			(int) $code
		);
	}

	return new WP_REST_Response( $data, (int) $code );
}

// ─── 1.3 Route callbacks ──────────────────────────────────────────────────────

/** GET /products → /wc/v3/products (cached 600 s) */
function drywall_route_products( WP_REST_Request $request ): WP_REST_Response {
	$allowed = [ 'page', 'per_page', 'category', 'search', 'orderby', 'order', 'min_price', 'max_price', 'stock_status' ];
	$params  = [];
	foreach ( $allowed as $k ) {
		$v = $request->get_param( $k );
		if ( null !== $v ) {
			$params[ $k ] = sanitize_text_field( $v );
		}
	}
	return drywall_cached_wc_get( 'wc/v3/products', $params, 600 );
}

/** GET /products/{id} → /wc/v3/products/{id} (cached 600 s) */
function drywall_route_product_by_id( WP_REST_Request $request ): WP_REST_Response {
	$id = absint( $request->get_param( 'id' ) );
	return drywall_cached_wc_get( "wc/v3/products/{$id}", [], 600 );
}

/** GET /products/slug/{slug} → /wc/v3/products?slug={slug} (cached 600 s) */
function drywall_route_product_by_slug( WP_REST_Request $request ): WP_REST_Response {
	$slug = sanitize_title( $request->get_param( 'slug' ) );
	return drywall_cached_wc_get( 'wc/v3/products', [ 'slug' => $slug ], 600 );
}

/** GET /categories → /wc/v3/products/categories (cached 900 s) */
function drywall_route_categories( WP_REST_Request $request ): WP_REST_Response {
	$params = [];
	foreach ( [ 'page', 'per_page', 'parent' ] as $k ) {
		$v = $request->get_param( $k );
		if ( null !== $v ) {
			$params[ $k ] = sanitize_text_field( $v );
		}
	}
	return drywall_cached_wc_get( 'wc/v3/products/categories', $params, 900 );
}

/** GET /attributes → /wc/v3/products/attributes (cached 900 s) */
function drywall_route_attributes( WP_REST_Request $request ): WP_REST_Response {
	return drywall_cached_wc_get( 'wc/v3/products/attributes', [], 900 );
}

/** GET /search?q={query} → /wc/v3/products?search={q} (cached 600 s) */
function drywall_route_search( WP_REST_Request $request ): WP_REST_Response {
	$q = sanitize_text_field( $request->get_param( 'q' ) ?? '' );
	if ( '' === $q ) {
		return new WP_REST_Response( drywall_error_envelope( 'missing_param', 'Query parameter "q" is required.', 400 ), 400 );
	}
	$params = [ 'search' => $q ];
	foreach ( [ 'page', 'per_page' ] as $k ) {
		$v = $request->get_param( $k );
		if ( null !== $v ) {
			$params[ $k ] = sanitize_text_field( $v );
		}
	}
	return drywall_cached_wc_get( 'wc/v3/products', $params, 600 );
}

/** POST /orders → /wc/v3/orders (JWT-gated, rate-limited) */
function drywall_route_create_order( WP_REST_Request $request ): WP_REST_Response {
	$rl = drywall_rate_limit( $request, 'orders_post' );
	if ( $rl ) {
		return $rl;
	}
	$body = $request->get_json_params();
	if ( empty( $body ) ) {
		return new WP_REST_Response( drywall_error_envelope( 'invalid_body', 'Request body must be valid JSON.', 400 ), 400 );
	}
	return drywall_wc_post( 'wc/v3/orders', $body );
}

/** GET /orders/{id} → /wc/v3/orders/{id} (JWT-gated) */
function drywall_route_get_order( WP_REST_Request $request ): WP_REST_Response {
	$id = absint( $request->get_param( 'id' ) );
	return drywall_wc_get( "wc/v3/orders/{$id}" );
}

/** GET /coupons/{code} → /wc/v3/coupons?code={code} */
function drywall_route_coupon( WP_REST_Request $request ): WP_REST_Response {
	$code = sanitize_text_field( $request->get_param( 'code' ) );
	return drywall_wc_get( 'wc/v3/coupons', [ 'code' => $code ] );
}

/** POST /customers → /wc/v3/customers (rate-limited) */
function drywall_route_create_customer( WP_REST_Request $request ): WP_REST_Response {
	$rl = drywall_rate_limit( $request, 'customers_post' );
	if ( $rl ) {
		return $rl;
	}
	$body = $request->get_json_params();
	if ( empty( $body ) ) {
		return new WP_REST_Response( drywall_error_envelope( 'invalid_body', 'Request body must be valid JSON.', 400 ), 400 );
	}
	return drywall_wc_post( 'wc/v3/customers', $body );
}

/** GET /customers/{id} → /wc/v3/customers/{id} (JWT-gated) */
function drywall_route_get_customer( WP_REST_Request $request ): WP_REST_Response {
	$id = absint( $request->get_param( 'id' ) );
	return drywall_wc_get( "wc/v3/customers/{$id}" );
}

// ─── 1.5 Webhook receiver ─────────────────────────────────────────────────────

function drywall_route_webhook_products( WP_REST_Request $request ): WP_REST_Response {
	// Validate HMAC signature against WC_WEBHOOK_SECRET.
	$secret = defined( 'WC_WEBHOOK_SECRET' ) ? WC_WEBHOOK_SECRET : '';
	if ( '' === $secret ) {
		return new WP_REST_Response( drywall_error_envelope( 'config_error', 'Webhook secret not configured.', 500 ), 500 );
	}

	$raw_body = $request->get_body();
	$sig      = $request->get_header( 'x_wc_webhook_signature' );

	if ( ! $sig ) {
		return new WP_REST_Response( drywall_error_envelope( 'missing_signature', 'Webhook signature is required.', 401 ), 401 );
	}

	$expected = base64_encode( hash_hmac( 'sha256', $raw_body, $secret, true ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
	if ( ! hash_equals( $expected, $sig ) ) {
		return new WP_REST_Response( drywall_error_envelope( 'invalid_signature', 'Webhook signature mismatch.', 401 ), 401 );
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

	// Extract product ID for log entry.
	$payload    = json_decode( $raw_body, true );
	$product_id = isset( $payload['id'] ) ? absint( $payload['id'] ) : 0;

	// Append to rolling log (last 50 entries).
	$log     = get_option( 'drywall_cache_log', [] );
	$log[]   = [
		'timestamp'  => gmdate( 'c' ),
		'product_id' => $product_id,
		'event'      => $request->get_header( 'x_wc_webhook_topic' ) ?? 'product.unknown',
	];
	$log     = array_slice( $log, -50 );
	update_option( 'drywall_cache_log', $log, false );

	return new WP_REST_Response( [ 'success' => true ], 200 );
}
