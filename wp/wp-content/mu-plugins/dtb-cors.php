<?php
/**
 * DTB CORS Proxy - Must-Use Plugin
 *
 * Handles CORS headers for the WordPress REST API and WooCommerce Store API,
 * enabling the React SPA (served from the domain root) to call /wp/wp-json/*
 * endpoints without browser cross-origin errors.
 *
 * Installation: place this file in wp-content/mu-plugins/
 * (mu-plugins load automatically - no activation step needed).
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Attach CORS header logic as early as possible, before any output.
 *
 * Priority 1 ensures this runs before WooCommerce or other plugins
 * that may also hook into plugins_loaded.
 */
add_action( 'plugins_loaded', 'dtb_cors_init', 1 );

function dtb_cors_init() {
	// Handle OPTIONS preflight immediately — exit before WordPress runs.
	if ( isset( $_SERVER['REQUEST_METHOD'] ) && 'OPTIONS' === strtoupper( $_SERVER['REQUEST_METHOD'] ) ) {
		$raw_origin = isset( $_SERVER['HTTP_ORIGIN'] )
			? (string) wp_unslash( $_SERVER['HTTP_ORIGIN'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
			: '';

		// Reject preflight from unknown origins with 403 so the browser
		// knows the cross-origin request is not allowed.
		if ( $raw_origin && ! in_array( rtrim( $raw_origin, '/' ), dtb_allowed_origins(), true ) ) {
			http_response_code( 403 );
			exit;
		}

		dtb_mu_emit_cors_headers();
		header( 'Content-Length: 0' );
		header( 'Content-Type: text/plain' );
		http_response_code( 200 );
		exit;
	}

	// For all other REST API requests, hook into rest_api_init to replace
	// the default WordPress CORS handler with ours.
	add_action( 'rest_api_init', 'dtb_cors_rest_api_init', 1 );
}

/**
 * Replace the default WordPress CORS filter with the DTB handler.
 * Must be done at rest_api_init (not earlier) so $GLOBALS['wp']->query_vars
 * is populated and REST routes are registered.
 */
function dtb_cors_rest_api_init() {
	remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
	add_filter( 'rest_pre_serve_request', 'dtb_filter_cors_headers' );
}

/**
 * Filter callback - sends CORS headers and returns $value untouched so the
 * rest of WordPress response processing continues normally.
 *
 * @param  mixed $value  Passed through unchanged.
 * @return mixed
 */
function dtb_filter_cors_headers( $value ) {
	dtb_mu_emit_cors_headers();
	return $value;
}

/**
 * Emit the CORS response headers.
 *
 * Function name is prefixed `dtb_mu_` to avoid conflicts with any theme or
 * plugin that may define its own `dtb_send_cors_headers()` function.
 *
 * Allowed origins are defined centrally in 00-dtb-loader.php via
 * dtb_allowed_origins(). Unknown origins receive the production domain as the
 * fallback Allow-Origin value, which browsers will reject (safe by default).
 *
 * The Origin header is validated against the allowlist before being echoed
 * back — this prevents open CORS reflection vulnerabilities.
 */
function dtb_mu_emit_cors_headers() {
	// Read the raw Origin header before any sanitisation.
	$raw_origin = isset( $_SERVER['HTTP_ORIGIN'] )
		? (string) wp_unslash( $_SERVER['HTTP_ORIGIN'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';

	if ( $raw_origin && in_array( rtrim( $raw_origin, '/' ), dtb_allowed_origins(), true ) ) {
		// Validate then reflect the allowlisted origin.
		header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $raw_origin ) );
	} else {
		// Unknown or absent origin — fall back to production domain.
		// Browsers will reject responses where ACAO doesn't match their Origin.
		header( 'Access-Control-Allow-Origin: https://drywalltoolbox.com' );
	}

	header( 'Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS' );
	header( 'Access-Control-Allow-Credentials: true' );
	header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce, X-Requested-With' );
	header( 'Access-Control-Max-Age: 86400' );   // Cache preflight for 24 h
	header( 'Vary: Origin' );
}
