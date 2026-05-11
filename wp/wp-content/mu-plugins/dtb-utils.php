<?php
/**
 * DTB Utilities — Shared helpers for the mu-plugin suite.
 *
 * Loaded after 00-dtb-loader.php (alphabetical order) and before all other
 * mu-plugins, so every file in this directory can call these helpers freely.
 *
 * Functions provided:
 *   dtb_is_rest_api_request()  — true when the current request is a WP REST call
 *   dtb_get_config()           — single lookup of all wp-config.php constants
 *   dtb_get_wc_credentials()   — WC auth pair, only for allowlisted browser origins
 *   dtb_error_envelope()       — uniform JSON error shape used by all DTB endpoints
 *   dtb_get_client_ip()        — real client IP respecting CF / proxy headers
 *   dtb_anonymise_ip()         — GDPR-friendly IP anonymisation before storage
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// ─── Request detection ────────────────────────────────────────────────────────

/**
 * Return true when the current request is a WordPress REST API request.
 *
 * MU plugins load before WordPress always defines REST_REQUEST, so this also
 * checks the two canonical REST entry shapes early: /wp-json/... permalinks
 * and ?rest_route=/... fallback URLs.
 *
 * @return bool
 */
function dtb_is_rest_api_request(): bool {
	if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
		return true;
	}

	if ( isset( $_GET['rest_route'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		return true;
	}

	$request_uri = isset( $_SERVER['REQUEST_URI'] )
		? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';

	return false !== strpos( $request_uri, '/wp-json/' );
}

/**
 * Return true when the current request is an admin or AJAX request.
 */
function dtb_is_admin_or_ajax_request(): bool {
	if ( function_exists( 'is_admin' ) && is_admin() ) {
		return true;
	}

	if ( function_exists( 'wp_doing_ajax' ) && wp_doing_ajax() ) {
		return true;
	}

	return false;
}

/**
 * Return true when the current request is admin, AJAX, or REST API.
 */
function dtb_is_admin_or_rest_request(): bool {
	return dtb_is_admin_or_ajax_request() || dtb_is_rest_api_request();
}

// ─── Config cache ─────────────────────────────────────────────────────────────

/**
 * Return all DTB wp-config.php constants as a single associative array.
 *
 * Calling defined() once here (at first use) is cheaper than scattering
 * individual defined() checks throughout every route callback.  The result
 * is stored in $GLOBALS so the check runs at most once per request.
 *
 * Keys:
 *   wc_proxy_key      WC REST API consumer key  (WC_PROXY_CONSUMER_KEY)
 *   wc_proxy_secret   WC REST API consumer secret (WC_PROXY_CONSUMER_SECRET)
 *   wc_auth_user      App-password username for browser clients (DTB_WC_AUTH_USER)
 *   wc_auth_pass      App-password string for browser clients   (DTB_WC_AUTH_PASS)
 *   webhook_secret    HMAC secret for webhook validation        (WC_WEBHOOK_SECRET)
 *   import_secret     CI/CD catalog-import auth token          (DTB_IMPORT_SECRET)
 *   jwt_secret        JWT signing secret                        (DRYWALL_JWT_SECRET)
 *   csv_filename      Primary resolved catalog CSV filename
 *   csv_filenames     Resolved catalog CSV filename list
 *   csv_source        configured, auto, fallback, or missing
 *   csv_missing       Configured CSV filenames that were not readable
 *   webhook_delivery  Webhook delivery URL                      (DTB_WEBHOOK_DELIVERY_URL)
 *
 * @return array<string,mixed>
 */
function dtb_get_config(): array {
	if ( isset( $GLOBALS['_dtb_config_cache'] ) ) {
		return $GLOBALS['_dtb_config_cache'];
	}

	$csv_config = dtb_resolve_catalog_csv_config();

	$GLOBALS['_dtb_config_cache'] = [
		'wc_proxy_key'     => defined( 'WC_PROXY_CONSUMER_KEY' )    ? WC_PROXY_CONSUMER_KEY    : '',
		'wc_proxy_secret'  => defined( 'WC_PROXY_CONSUMER_SECRET' ) ? WC_PROXY_CONSUMER_SECRET : '',
		'wc_auth_user'     => defined( 'DTB_WC_AUTH_USER' )         ? DTB_WC_AUTH_USER         : '',
		'wc_auth_pass'     => defined( 'DTB_WC_AUTH_PASS' )         ? DTB_WC_AUTH_PASS         : '',
		'webhook_secret'   => defined( 'WC_WEBHOOK_SECRET' )        ? WC_WEBHOOK_SECRET        : '',
		'import_secret'    => defined( 'DTB_IMPORT_SECRET' )        ? DTB_IMPORT_SECRET        : '',
		'jwt_secret'       => defined( 'DRYWALL_JWT_SECRET' )       ? DRYWALL_JWT_SECRET       : '',
		'csv_filename'     => $csv_config['filename'],
		'csv_filenames'    => $csv_config['filenames'],
		'csv_source'       => $csv_config['source'],
		'csv_missing'      => $csv_config['missing'],
		'webhook_delivery' => defined( 'DTB_WEBHOOK_DELIVERY_URL' ) ? DTB_WEBHOOK_DELIVERY_URL : 'https://drywalltoolbox.com/wp-json/drywall/v1/webhooks/products',
	];

	return $GLOBALS['_dtb_config_cache'];
}

/**
 * Resolve the active WooCommerce product CSV configuration.
 *
 * Priority:
 *   1. DTB_WC_CSV_FILENAME when defined. It may contain one filename or a
 *      comma/pipe-separated list. Each entry is reduced to basename().
 *   2. Newest readable product-*.csv file in uploads/wc-imports/.
 *   3. Readable uploads/wc-imports/wp-catalog.csv fallback.
 *
 * @return array{filename:string,filenames:string[],source:string,missing:string[]}
 */
function dtb_resolve_catalog_csv_config(): array {
	$upload_dir = wp_upload_dir();
	$imports_dir = trailingslashit( $upload_dir['basedir'] ) . 'wc-imports/';

	$result = [
		'filename'  => '',
		'filenames' => [],
		'source'    => 'missing',
		'missing'   => [],
	];

	$configured_csv = defined( 'DTB_WC_CSV_FILENAME' ) ? trim( (string) DTB_WC_CSV_FILENAME ) : '';
	if ( '' !== $configured_csv ) {
		$requested = preg_split( '/\s*[,|]\s*/', $configured_csv ) ?: [];
		foreach ( $requested as $filename ) {
			$basename = basename( trim( (string) $filename ) );
			if ( '' === $basename ) {
				continue;
			}

			$path = $imports_dir . $basename;
			if ( is_readable( $path ) && is_file( $path ) ) {
				$result['filenames'][] = $basename;
			} else {
				$result['missing'][] = $basename;
			}
		}

		$result['filenames'] = array_values( array_unique( $result['filenames'] ) );
		if ( ! empty( $result['filenames'] ) ) {
			$result['filename'] = $result['filenames'][0];
			$result['source']   = 'configured';
			return $result;
		}
	}

	if ( is_dir( $imports_dir ) ) {
		$product_csvs = glob( $imports_dir . 'product-*.csv' ) ?: [];
		$product_csvs = array_values( array_filter( $product_csvs, static fn( $path ) => is_file( $path ) && is_readable( $path ) ) );

		if ( ! empty( $product_csvs ) ) {
			usort( $product_csvs, static function ( string $a, string $b ): int {
				$mtime_compare = filemtime( $b ) <=> filemtime( $a );
				return 0 !== $mtime_compare ? $mtime_compare : strcmp( basename( $a ), basename( $b ) );
			} );

			$result['filename']  = basename( $product_csvs[0] );
			$result['filenames'] = [ $result['filename'] ];
			$result['source']    = 'auto';
			return $result;
		}
	}

	$fallback = $imports_dir . 'wp-catalog.csv';
	if ( is_readable( $fallback ) && is_file( $fallback ) ) {
		$result['filename']  = 'wp-catalog.csv';
		$result['filenames'] = [ 'wp-catalog.csv' ];
		$result['source']    = 'fallback';
	}

	return $result;
}

// ─── Credential helpers ───────────────────────────────────────────────────────

/**
 * Return WooCommerce Application Password credentials for the current request.
 *
 * Credentials are only exposed to browser requests whose Origin header is
 * on the DTB allowlist (defined in 00-dtb-loader.php).  Server-to-server
 * requests (curl, CI, scrapers) receive empty strings so secrets are never
 * leaked outside a browser session.
 *
 * @return array{ auth_user: string, auth_pass: string }
 */
function dtb_get_wc_credentials(): array {
	$raw_origin = isset( $_SERVER['HTTP_ORIGIN'] )
		? rtrim( (string) wp_unslash( $_SERVER['HTTP_ORIGIN'] ), '/' ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';

	$origin_ok = '' !== $raw_origin && in_array( $raw_origin, dtb_allowed_origins(), true );
	$config    = dtb_get_config();

	return [
		'auth_user' => $origin_ok ? $config['wc_auth_user'] : '',
		'auth_pass' => $origin_ok ? $config['wc_auth_pass'] : '',
	];
}

// ─── Error envelope ───────────────────────────────────────────────────────────

/**
 * Build the uniform JSON error envelope used by all DTB REST endpoints.
 *
 * Shape:
 * {
 *   "success": false,
 *   "code":    "snake_case_error_code",
 *   "message": "Human-readable explanation.",
 *   "data":    { "status": 400 }
 * }
 *
 * @param string $code    Machine-readable error code (snake_case).
 * @param string $message Human-readable explanation shown to the client.
 * @param int    $status  HTTP status code to accompany the response.
 * @return array<string,mixed>
 */
function dtb_error_envelope( string $code, string $message, int $status ): array {
	return [
		'success' => false,
		'code'    => $code,
		'message' => $message,
		'data'    => [ 'status' => $status ],
	];
}

// ─── Capability helpers ───────────────────────────────────────────────────────

/**
 * Return true when the current user has manage_options OR a specific DTB custom capability.
 *
 * @param string $cap DTB custom capability slug, e.g. 'dtb_admin_ops'.
 * @return bool
 */
function dtb_ops_can( string $cap ): bool {
	if ( ! function_exists( 'current_user_can' ) ) {
		return false;
	}
	return current_user_can( 'manage_options' ) || current_user_can( $cap );
}

/**
 * Sanitize and clamp pagination inputs.
 *
 * @param mixed $page        Raw page input.
 * @param mixed $per_page    Raw per_page input.
 * @param int   $max_per_page Maximum allowed per_page value.
 * @return array{page: int, per_page: int}
 */
function dtb_sanitize_pagination( $page, $per_page, int $max_per_page = 100 ): array {
	return [
		'page'     => max( 1, absint( $page ) ),
		'per_page' => min( $max_per_page, max( 1, absint( $per_page ) ) ),
	];
}

// ─── IP helpers ───────────────────────────────────────────────────────────────

/**
 * Determine the real client IP, accounting for Cloudflare and common proxies.
 *
 * Header priority (first valid IP wins):
 *   1. HTTP_CF_CONNECTING_IP  — Cloudflare
 *   2. HTTP_X_FORWARDED_FOR   — load balancers / reverse proxies (first value)
 *   3. HTTP_X_REAL_IP         — Nginx-style single-IP proxy header
 *   4. REMOTE_ADDR            — direct TCP connection (final fallback)
 *
 * @return string A validated IP address string, or '0.0.0.0' if none found.
 */
function dtb_get_client_ip(): string {
	$candidates = [
		'HTTP_CF_CONNECTING_IP',
		'HTTP_X_FORWARDED_FOR',
		'HTTP_X_REAL_IP',
		'REMOTE_ADDR',
	];

	foreach ( $candidates as $key ) {
		if ( empty( $_SERVER[ $key ] ) ) {
			continue;
		}

		// X-Forwarded-For may carry a comma-separated list; take the first entry.
		$raw = sanitize_text_field( wp_unslash( $_SERVER[ $key ] ) );
		$ip  = trim( explode( ',', $raw )[0] );

		if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) {
			return $ip;
		}
	}

	return '0.0.0.0';
}

/**
 * Anonymise an IP address before persisting it (GDPR-friendlier storage).
 *
 *   IPv4 — zeroes the last octet:       203.0.113.42  → 203.0.113.0
 *   IPv6 — keeps the first 48 bits, zeroes the remaining 80 bits.
 *
 * @param string $ip Raw IP address string.
 * @return string    Anonymised IP, or a safe placeholder on parse failure.
 */
function dtb_anonymise_ip( string $ip ): string {
	if ( filter_var( $ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6 ) ) {
		$bin = inet_pton( $ip );
		if ( false === $bin ) {
			return '::';
		}
		$bin = substr( $bin, 0, 6 ) . str_repeat( "\x00", 10 );
		return inet_ntop( $bin ) ?: '::';
	}

	$parts = explode( '.', $ip );
	if ( 4 === count( $parts ) ) {
		$parts[3] = '0';
		return implode( '.', $parts );
	}

	return '0.0.0.0';
}
