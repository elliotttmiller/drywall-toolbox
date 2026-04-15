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
 * WordPress sets REST_REQUEST early in wp-includes/rest-api.php, so this
 * constant is reliable from plugins_loaded onward.
 *
 * @return bool
 */
function dtb_is_rest_api_request(): bool {
	return defined( 'REST_REQUEST' ) && REST_REQUEST;
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
 *   csv_filename      Product CSV filename (single, legacy)         (DTB_WC_CSV_FILENAME)
 *   csv_filenames     Product CSV filenames (array, preferred)       (DTB_WC_CSV_FILENAMES)
 *   webhook_delivery  Webhook delivery URL                      (DTB_WEBHOOK_DELIVERY_URL)
 *
 * @return array<string,string>
 */
function dtb_get_config(): array {
	if ( isset( $GLOBALS['_dtb_config_cache'] ) ) {
		return $GLOBALS['_dtb_config_cache'];
	}

	// ── Resolve CSV filenames ────────────────────────────────────────────────
	// Priority:
	//   1. DTB_WC_CSV_FILENAMES  — JSON array of filenames (preferred for multi-file catalogs)
	//                               e.g. '["product-wc-tapetech-abc.csv","product-wc-columbia-xyz.csv"]'
	//   2. DTB_WC_CSV_FILENAME   — legacy single-filename string (still supported)
	//   3. Auto-discovery        — glob wc-imports/ for product-wc-*.csv, newest file per brand prefix.
	//                               Eliminates the need to update wp-config.php after every CSV upload.
	$csv_filenames = [];
	if ( defined( 'DTB_WC_CSV_FILENAMES' ) ) {
		$decoded = json_decode( DTB_WC_CSV_FILENAMES, true );
		if ( is_array( $decoded ) && count( $decoded ) > 0 ) {
			$csv_filenames = array_values( array_filter( array_map( 'sanitize_file_name', $decoded ) ) );
		}
	}
	if ( empty( $csv_filenames ) && defined( 'DTB_WC_CSV_FILENAME' ) ) {
		$csv_filenames = [ sanitize_file_name( DTB_WC_CSV_FILENAME ) ];
	}
	if ( empty( $csv_filenames ) ) {
		// Auto-discover: scan wc-imports/ for files matching product-wc-*.csv.
		// When multiple files share the same brand prefix (e.g. after re-uploads),
		// keep only the newest one per prefix so stale duplicates are ignored.
		$upload_dir    = wp_upload_dir();
		$wc_imports    = trailingslashit( $upload_dir['basedir'] ) . 'wc-imports/';
		$found         = glob( $wc_imports . 'product-wc-*.csv' );
		if ( ! empty( $found ) ) {
			// Group by brand prefix: everything before the last random suffix token.
			// e.g. "product-wc-tapetech-cczyksx7op.csv" → prefix "product-wc-tapetech"
			$by_prefix = [];
			foreach ( $found as $path ) {
				$base   = basename( $path, '.csv' );
				$parts  = explode( '-', $base );
				// Drop the last segment (random suffix) to get the brand prefix.
				array_pop( $parts );
				$prefix = implode( '-', $parts );
				// Keep only the file with the highest mtime per prefix.
				if ( ! isset( $by_prefix[ $prefix ] ) || filemtime( $path ) > filemtime( $by_prefix[ $prefix ] ) ) {
					$by_prefix[ $prefix ] = $path;
				}
			}
			// Sort by prefix name for deterministic ordering.
			ksort( $by_prefix );
			$csv_filenames = array_values( array_map( 'basename', $by_prefix ) );
		}
	}

	$GLOBALS['_dtb_config_cache'] = [
		'wc_proxy_key'     => defined( 'WC_PROXY_CONSUMER_KEY' )    ? WC_PROXY_CONSUMER_KEY    : '',
		'wc_proxy_secret'  => defined( 'WC_PROXY_CONSUMER_SECRET' ) ? WC_PROXY_CONSUMER_SECRET : '',
		'wc_auth_user'     => defined( 'DTB_WC_AUTH_USER' )         ? DTB_WC_AUTH_USER         : '',
		'wc_auth_pass'     => defined( 'DTB_WC_AUTH_PASS' )         ? DTB_WC_AUTH_PASS         : '',
		'webhook_secret'   => defined( 'WC_WEBHOOK_SECRET' )        ? WC_WEBHOOK_SECRET        : '',
		'import_secret'    => defined( 'DTB_IMPORT_SECRET' )        ? DTB_IMPORT_SECRET        : '',
		'jwt_secret'       => defined( 'DRYWALL_JWT_SECRET' )       ? DRYWALL_JWT_SECRET       : '',
		// Legacy single-filename key — first entry in the array for backward compat.
		'csv_filename'     => $csv_filenames[0] ?? '',
		// Full ordered list — used by the multi-file import and products-csv merge.
		'csv_filenames'    => $csv_filenames,
		'webhook_delivery' => defined( 'DTB_WEBHOOK_DELIVERY_URL' ) ? DTB_WEBHOOK_DELIVERY_URL : 'https://drywalltoolbox.com/wp-json/drywall/v1/webhooks/products',
	];

	return $GLOBALS['_dtb_config_cache'];
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
