<?php
/**
 * DTB MU-Plugins Bootstrap
 *
 * This file is intentionally named with a "00-" prefix so it sorts first
 * alphabetically and is loaded before all other mu-plugin files.
 *
 * Defines shared utility functions used across the mu-plugin suite so that
 * the allowed-origins list and origin-check logic live in exactly one place.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Return the list of CORS-allowed origins for the Drywall Toolbox SPA.
 *
 * The production domain and local-dev origins are always included.
 * An additional origin can be declared in wp-config.php:
 *
 *   define( 'DRYWALL_ALLOWED_ORIGIN', 'https://staging.drywalltoolbox.com' );
 *
 * Third-party code may extend the list via the dtb_allowed_origins filter.
 *
 * @return string[] List of allowed origin strings (scheme + host, no trailing slash).
 */
function dtb_allowed_origins(): array {
	$origins = [
		'https://drywalltoolbox.com',
		'https://www.drywalltoolbox.com',
		'http://localhost:5173',
		'http://127.0.0.1:5173',
	];

	if ( defined( 'DRYWALL_ALLOWED_ORIGIN' ) && DRYWALL_ALLOWED_ORIGIN ) {
		$origins[] = rtrim( (string) DRYWALL_ALLOWED_ORIGIN, '/' );
	}

	/** @var string[] $origins */
	return (array) apply_filters( 'dtb_allowed_origins', array_unique( $origins ) );
}

/**
 * Check whether the current request's Origin header is in the allowlist.
 *
 * Requests without an Origin header (direct / server-to-server) are allowed by
 * default — the guard is only enforced when a browser presents an origin that is
 * not on the list.
 *
 * @return bool True when the origin is allowlisted or absent; false otherwise.
 */
function dtb_check_origin(): bool {
	$raw_origin = isset( $_SERVER['HTTP_ORIGIN'] )
		? (string) wp_unslash( $_SERVER['HTTP_ORIGIN'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';

	if ( '' === $raw_origin ) {
		return true; // no Origin → not a cross-origin browser request
	}

	return in_array( rtrim( $raw_origin, '/' ), dtb_allowed_origins(), true );
}
