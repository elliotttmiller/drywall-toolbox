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
 * Also controls the explicit load order of all DTB mu-plugins via require_once.
 * WordPress would otherwise load each file alphabetically; the require_once
 * calls here ensure dependency order is respected.  PHP's require_once
 * semantics prevent double-inclusion when WordPress later tries to load the
 * same files.
 *
 * Load order:
 *   dtb-utils.php          — shared helper functions
 *   dtb-auth.php           — JWT generation / verification / REST auth routes
 *   dtb-cache.php          — transient cache helpers and diagnostic route
 *   dtb-rest-api.php       — WC proxy + site-management REST routes + CORS
 *   dtb-rewards.php        — WPLoyalty REST bridge (dtb/v1/rewards/* endpoints)
 *   dtb-image-sync.php     — media-library sync for uploads/2026/04/ images
 *   dtb-woocommerce.php    — WC configuration and webhook auto-creation
 *   dtb-schematics-api.php — schematics media REST route
 *   dtb-coming-soon.php    — e-mail subscriber handler
 *   dtb-seo.php            — WooCommerce product SEO meta fields + REST exposure
 *   dtb-config-reference.php — comment-only constant reference (no exec code)
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
		'http://localhost:3000',
		'http://localhost:5173',
		'http://127.0.0.1:3000',
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

// ─── Explicit load order ──────────────────────────────────────────────────────

$_dtb_dir = __DIR__;

require_once $_dtb_dir . '/dtb-utils.php';
require_once $_dtb_dir . '/dtb-auth.php';
require_once $_dtb_dir . '/dtb-cache.php';
require_once $_dtb_dir . '/dtb-rest-api.php';
require_once $_dtb_dir . '/dtb-rewards.php';       // WPLoyalty REST bridge (loads after dtb-auth)
require_once $_dtb_dir . '/dtb-image-sync.php';    // media-library sync for uploads/YYYY/MM/ images
require_once $_dtb_dir . '/dtb-woocommerce.php';
require_once $_dtb_dir . '/dtb-schematics-api.php';
require_once $_dtb_dir . '/dtb-coming-soon.php';
require_once $_dtb_dir . '/dtb-seo.php';           // WooCommerce product SEO meta fields
require_once $_dtb_dir . '/dtb-config-reference.php';

unset( $_dtb_dir );
