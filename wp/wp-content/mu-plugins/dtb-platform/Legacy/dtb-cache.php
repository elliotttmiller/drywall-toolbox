<?php
/**
 * DTB Cache — Must-Use Plugin
 *
 * Centralises all transient-based caching for the Drywall Toolbox product
 * catalog proxy.  Every file in the suite should delegate cache reads,
 * writes, and invalidations to the functions defined here instead of calling
 * get_transient() / set_transient() / delete_option() directly.
 *
 * Functions provided:
 *   dtb_cached_proxy()           — Read-through transient cache wrapper
 *   dtb_invalidate_product_cache() — Bulk-delete all drywall_cache_* transients
 *   dtb_log_cache_event()        — Append an entry to the cache event log
 *   dtb_get_cache_log()          — Return the current cache event log
 *
 * Diagnostic REST route (admin only):
 *   GET /dtb/v1/cache/status
 *
 * Depends on (loaded before this file via 00-dtb-loader.php):
 *   dtb-utils.php → dtb_get_config(), dtb_error_envelope()
 *   dtb-auth.php  → dtb_jwt_permission(), dtb_verify_jwt(), DTB_AUTH_COOKIE
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// Only load cache helpers and routes on admin or REST API requests.
if ( ! dtb_is_admin_or_rest_request() ) {
	return;
}

// =============================================================================
// REST RESPONSE CACHE-CONTROL HEADERS
// =============================================================================

/**
 * Attach Cache-Control and Vary headers to DTB and WooCommerce Store API
 * REST responses so browsers and CDN edges (e.g. Cloudflare) can cache
 * them natively.
 *
 * Strategy:
 *   dtb/v1/*         → public, fresh for 5 min, stale-while-revalidate 24 h
 *   wc/store/v1/*    → public, fresh for 1 min, stale-while-revalidate 5 min
 *                      (shorter window for cart-adjacent data)
 *
 * Auth/mutation routes are excluded so that protected or state-changing
 * endpoints are never cached by a CDN or shared cache.
 */
add_action( 'rest_api_init', 'dtb_register_cache_control_headers', 10 );

function dtb_register_cache_control_headers(): void {
	add_filter( 'rest_pre_send_headers', 'dtb_maybe_add_cache_control_headers' );
}

/**
 * Filter callback: add Cache-Control + Vary headers for cacheable routes.
 *
 * @param array $headers Outgoing response headers.
 * @return array Modified headers array (unchanged for excluded routes).
 */
function dtb_maybe_add_cache_control_headers( array $headers ): array {
	$uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';

	// Never cache auth, mutation, or admin-sensitive routes.
	$excluded_patterns = [
		'auth',
		'jwt',
		'login',
		'logout',
		'register',
		'password',
		'token',
		'cart',
		'checkout',
		'order',
		'customer',
		'session',
		'nonce',
		'user',
		'payment',
	];

	foreach ( $excluded_patterns as $pattern ) {
		if ( false !== strpos( $uri, $pattern ) ) {
			return $headers;
		}
	}

	if ( false !== strpos( $uri, '/wp-json/dtb/v1/' ) ) {
		// DTB catalog/schematic data: 5-minute freshness, 24-hour SWR.
		$headers['Cache-Control'] = 'public, max-age=300, stale-while-revalidate=86400';
		$headers['Vary']          = 'Accept-Encoding';
	} elseif ( false !== strpos( $uri, '/wp-json/wc/store/v1/' ) ) {
		// WooCommerce Store API: 1-minute freshness, 5-minute SWR.
		$headers['Cache-Control'] = 'public, max-age=60, stale-while-revalidate=300';
		$headers['Vary']          = 'Accept-Encoding';
	}

	return $headers;
}

// =============================================================================
// CACHE PROXY
// =============================================================================

/**
 * Read-through transient cache for arbitrary fetchable data.
 *
 * Cache key: drywall_cache_{md5(route + serialize(params))}
 * TTL rules (overridden by caller):
 *   route contains 'categories' or 'attributes' → 900 s
 *   all other routes                             → 600 s
 *
 * On HIT:  returns the cached value and emits X-Cache: HIT response header.
 * On MISS: calls $fetcher(), stores the result in a transient, emits
 *           X-Cache: MISS.  If $fetcher() returns null or a WP_Error the
 *           result is returned as-is and NOT stored.
 *
 * @param string   $route   Route identifier used to derive the cache key and TTL.
 * @param array    $params  Additional params mixed into the cache key.
 * @param callable $fetcher Zero-argument callable that produces the fresh value.
 * @return mixed            Cached or freshly fetched value.
 */
function dtb_cached_proxy( string $route, array $params, callable $fetcher ) {
	ksort( $params );
	$cache_key = 'drywall_cache_' . md5( $route . wp_json_encode( $params ) );

	$cached = get_transient( $cache_key );
	if ( false !== $cached ) {
		header( 'X-Cache: HIT' );
		return $cached;
	}

	$result = $fetcher();

	if ( null === $result || is_wp_error( $result ) ) {
		return $result;
	}

	if ( false !== strpos( $route, 'categories' ) || false !== strpos( $route, 'attributes' ) ) {
		$ttl = 900;
	} else {
		$ttl = 600;
	}

	set_transient( $cache_key, $result, $ttl );
	header( 'X-Cache: MISS' );
	return $result;
}

// =============================================================================
// CACHE INVALIDATION
// =============================================================================

/**
 * Delete all drywall_cache_* transients from the options table.
 *
 * Removes both the transient value rows (_transient_drywall_cache_*)
 * and the corresponding timeout rows (_transient_timeout_drywall_cache_*).
 * Calls dtb_log_cache_event() with event 'cache_invalidated' after deletion.
 */
function dtb_invalidate_product_cache(): void {
	global $wpdb;

	$wpdb->query(
		$wpdb->prepare(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
			$wpdb->esc_like( '_transient_drywall_cache_' ) . '%',
			$wpdb->esc_like( '_transient_timeout_drywall_cache_' ) . '%'
		)
	);

	dtb_log_cache_event( 'cache_invalidated', [] );
}

// =============================================================================
// CACHE LOG
// =============================================================================

/**
 * Append an event record to the drywall_cache_log WordPress option.
 *
 * Log entries are stored newest-first.  The log is trimmed to the most
 * recent 50 entries after each write.
 *
 * Each record shape:
 *   { event: string, context: array, timestamp: ISO-8601 string }
 *
 * @param string $event   Machine-readable event identifier (e.g. 'cache_invalidated').
 * @param array  $context Additional key-value context to store alongside the event.
 */
function dtb_log_cache_event( string $event, array $context ): void {
	$log = dtb_get_cache_log();

	array_unshift( $log, [
		'event'     => $event,
		'context'   => $context,
		'timestamp' => gmdate( 'c' ),
	] );

	update_option( 'drywall_cache_log', array_slice( $log, 0, 50 ), false );
}

/**
 * Return the current cache event log.
 *
 * @return array Array of event records, newest first.
 */
function dtb_get_cache_log(): array {
	return (array) get_option( 'drywall_cache_log', [] );
}

// =============================================================================
// OPS MODULE CACHE HELPERS
// =============================================================================

/**
 * Read-through transient cache with module-namespaced keys for the Ops Dashboard.
 *
 * Cache key: dtb_ops_{$module}_{$key}
 *
 * @param string   $module   Module name (e.g. 'kpis', 'orders', 'inventory').
 * @param string   $key      Additional key suffix.
 * @param int      $ttl      Cache TTL in seconds.
 * @param callable $callback Zero-argument callable that produces the fresh value.
 * @return mixed
 */
function dtb_ops_cache_get( string $module, string $key, int $ttl, callable $callback ) {
	$cache_key = 'dtb_ops_' . sanitize_key( $module ) . '_' . sanitize_key( $key );
	$cached    = get_transient( $cache_key );

	if ( false !== $cached ) {
		dtb_log_cache_event( 'ops_cache_hit', [ 'module' => $module, 'key' => $key ] );
		return $cached;
	}

	$result = $callback();

	if ( null !== $result && ! is_wp_error( $result ) ) {
		set_transient( $cache_key, $result, $ttl );
		dtb_log_cache_event( 'ops_cache_miss', [ 'module' => $module, 'key' => $key ] );
	}

	return $result;
}

/**
 * Delete all dtb_ops_{$module}_* transients from the options table.
 *
 * @param string $module Module name (e.g. 'kpis', 'orders'). Empty string flushes all ops transients.
 */
function dtb_ops_cache_flush( string $module = '' ): void {
	global $wpdb;

	$prefix = '' !== $module
		? '_transient_dtb_ops_' . sanitize_key( $module ) . '_'
		: '_transient_dtb_ops_';

	$timeout_prefix = '' !== $module
		? '_transient_timeout_dtb_ops_' . sanitize_key( $module ) . '_'
		: '_transient_timeout_dtb_ops_';

	$wpdb->query(
		$wpdb->prepare(
			"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
			$wpdb->esc_like( $prefix ) . '%',
			$wpdb->esc_like( $timeout_prefix ) . '%'
		)
	);

	dtb_log_cache_event( 'ops_cache_flushed', [ 'module' => $module ?: 'all' ] );
}

// =============================================================================
// DIAGNOSTIC REST ROUTE
// =============================================================================

add_action( 'rest_api_init', 'dtb_register_cache_routes', 10 );

/**
 * Register the diagnostic cache/status REST route (admin only).
 */
function dtb_register_cache_routes(): void {
	register_rest_route( 'dtb/v1', '/cache/status', [
		'methods'             => 'GET',
		'callback'            => 'dtb_route_cache_status',
		'permission_callback' => 'dtb_cache_status_permission',
	] );
}

/**
 * Permission callback for GET /dtb/v1/cache/status.
 *
 * Requires a valid JWT and administrator role embedded in the token's
 * roles claim.
 *
 * @param WP_REST_Request $request Incoming request.
 * @return true|WP_Error
 */
function dtb_cache_status_permission( WP_REST_Request $request ) {
	$token = null;

	// Cookie takes precedence (same rule as dtb_jwt_permission).
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
		return new WP_Error( 'missing_token', 'Authorization token required.', [ 'status' => 401 ] );
	}

	$payload = dtb_verify_jwt( $token );
	if ( is_wp_error( $payload ) ) {
		return $payload;
	}

	$roles = isset( $payload->roles ) ? (array) $payload->roles : [];
	if ( ! in_array( 'administrator', $roles, true ) ) {
		return new WP_Error( 'forbidden', 'Administrator access required.', [ 'status' => 403 ] );
	}

	return true;
}

/**
 * GET /dtb/v1/cache/status
 *
 * Returns the cache event log and the timestamp of the last invalidation.
 *
 * @return WP_REST_Response
 */
function dtb_route_cache_status(): WP_REST_Response {
	$log = dtb_get_cache_log();

	$last_invalidated = null;
	foreach ( $log as $entry ) {
		if ( 'cache_invalidated' === ( $entry['event'] ?? '' ) ) {
			$last_invalidated = $entry['timestamp'];
			break;
		}
	}

	return rest_ensure_response( [
		'log'              => $log,
		'last_invalidated' => $last_invalidated,
	] );
}
