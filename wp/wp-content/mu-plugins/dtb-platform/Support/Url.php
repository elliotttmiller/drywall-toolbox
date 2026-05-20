<?php
/**
 * Url — DTB Platform
 *
 * WooCommerce credential helpers restricted to allowlisted browser origins.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Return WooCommerce Application Password credentials for the current request.
 *
 * Credentials are only exposed to browser requests whose Origin header is
 * on the DTB allowlist.  Server-to-server requests (curl, CI, scrapers)
 * receive empty strings so secrets are never leaked outside a browser session.
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
