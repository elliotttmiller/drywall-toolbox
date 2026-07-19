<?php
/**
 * URL helpers — DTB Platform.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Legacy compatibility helper.
 *
 * WooCommerce application passwords and consumer credentials are server-only.
 * They must never be returned to browser code, even when the Origin header is
 * allowlisted. Server-to-server proxy code reads its credentials directly from
 * secured runtime configuration.
 *
 * @deprecated Browser credential delivery is retired. Always returns blanks.
 * @return array{auth_user:string,auth_pass:string}
 */
function dtb_get_wc_credentials(): array {
	return [
		'auth_user' => '',
		'auth_pass' => '',
	];
}

/** Detect the headless storefront sub-path mount (for example `/staging/2972`). */
function dtb_detect_storefront_base_path(): string {
	$staging_path_pattern = '#/staging/(\d+)(?:/|$|\?)#';

	$referer = isset( $_SERVER['HTTP_REFERER'] )
		? (string) wp_unslash( $_SERVER['HTTP_REFERER'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';
	if ( '' !== $referer ) {
		$referer_path = (string) wp_parse_url( $referer, PHP_URL_PATH );
		if ( preg_match( $staging_path_pattern, $referer_path . '/', $matches ) ) {
			return '/staging/' . $matches[1];
		}
	}

	$declared_base = isset( $_SERVER['HTTP_X_DTB_STOREFRONT_BASE'] )
		? (string) wp_unslash( $_SERVER['HTTP_X_DTB_STOREFRONT_BASE'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';
	if ( preg_match( $staging_path_pattern, $declared_base . '/', $matches ) ) {
		return '/staging/' . $matches[1];
	}

	$request_uri = isset( $_SERVER['REQUEST_URI'] )
		? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';
	if ( '' !== $request_uri ) {
		$path = (string) wp_parse_url( $request_uri, PHP_URL_PATH );
		if ( preg_match( '#^/staging/(\d+)(?:/|$)#', $path, $matches ) ) {
			return '/staging/' . $matches[1];
		}
	}

	return '';
}

/** Resolve the storefront base path an order was created under. */
function dtb_order_storefront_base_path( $order ): string {
	if ( is_int( $order ) || is_numeric( $order ) ) {
		$order = function_exists( 'wc_get_order' ) ? wc_get_order( (int) $order ) : null;
	}

	if ( ! is_object( $order ) || ! method_exists( $order, 'get_meta' ) ) {
		return dtb_detect_storefront_base_path();
	}

	$stored = (string) $order->get_meta( '_dtb_storefront_base_path', true );
	if ( '' !== $stored ) {
		return $stored;
	}

	return dtb_detect_storefront_base_path();
}

/** Prefix a same-host absolute or root-relative URL with a storefront base path. */
function dtb_apply_storefront_base_path( string $url, string $base_path ): string {
	if ( '' === $base_path || '' === trim( $url ) ) {
		return $url;
	}

	$parts = wp_parse_url( $url );
	if ( ! is_array( $parts ) ) {
		return $url;
	}

	$path = (string) ( $parts['path'] ?? '' );
	if ( '' === $path || 0 === strpos( $path, $base_path . '/' ) || $path === $base_path ) {
		return $url;
	}

	$new_url = home_url( $base_path . $path );
	if ( ! empty( $parts['query'] ) ) {
		$new_url .= '?' . (string) $parts['query'];
	}
	if ( ! empty( $parts['fragment'] ) ) {
		$new_url .= '#' . (string) $parts['fragment'];
	}

	return $new_url;
}
