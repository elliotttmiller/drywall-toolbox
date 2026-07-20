<?php
/**
 * Native checkout identity bridge.
 *
 * The React storefront authenticates customers with the HttpOnly `dtb_auth` JWT.
 * WooCommerce Store API requests already resolve that identity before creating a
 * user-owned Woo session. Native checkout is a normal document request, so it
 * must resolve the same verified customer before WooCommerce validates/loads its
 * session cookie. Otherwise Woo sees a registered-user session on a logged-out
 * request and invalidates the cart.
 *
 * This bridge is intentionally narrow: native WordPress cookie auth wins, only
 * Woo checkout/payment document requests are eligible, no WordPress auth cookie
 * is minted, no capabilities are elevated, and no Woo session rows are decoded,
 * queried, copied, or injected.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_filter( 'determine_current_user', 'dtb_native_checkout_resolve_current_user', 25 );

/**
 * Resolve a verified DTB storefront identity for native checkout documents.
 *
 * @param int|false $user_id User resolved by earlier/native auth providers.
 * @return int|false
 */
function dtb_native_checkout_resolve_current_user( $user_id ) {
	if ( ! empty( $user_id ) || ! dtb_native_checkout_identity_bridge_request() ) {
		return $user_id;
	}

	$token = ! empty( $_COOKIE['dtb_auth'] )
		? sanitize_text_field( wp_unslash( (string) $_COOKIE['dtb_auth'] ) )
		: '';
	if ( '' === $token ) {
		return $user_id;
	}

	$resolved = dtb_native_checkout_verify_user_id( $token );
	if ( $resolved <= 0 ) {
		return $user_id;
	}

	$user = get_user_by( 'id', $resolved );
	if ( ! $user instanceof WP_User ) {
		return $user_id;
	}

	return (int) $user->ID;
}

/**
 * Whether this request is a native Woo checkout/payment document request.
 *
 * REST requests continue to use AuthRoutes.php's existing resolver. wp-admin,
 * AJAX, cron and unrelated frontend pages are deliberately excluded.
 */
function dtb_native_checkout_identity_bridge_request(): bool {
	if ( is_admin() || wp_doing_ajax() || wp_doing_cron() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
		return false;
	}

	$method = isset( $_SERVER['REQUEST_METHOD'] )
		? strtoupper( sanitize_key( wp_unslash( (string) $_SERVER['REQUEST_METHOD'] ) ) )
		: 'GET';
	if ( ! in_array( $method, [ 'GET', 'POST' ], true ) ) {
		return false;
	}

	$request_uri = isset( $_SERVER['REQUEST_URI'] )
		? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';
	$path = (string) wp_parse_url( $request_uri, PHP_URL_PATH );

	if ( preg_match( '#^/(?:staging/[A-Za-z0-9_-]+/)?checkout(?:/|$)#i', $path ) ) {
		return true;
	}

	if ( '/wp/index.php' === rtrim( $path, '/' ) || '/index.php' === rtrim( $path, '/' ) ) {
		$pagename = isset( $_GET['pagename'] ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			? sanitize_key( wp_unslash( (string) $_GET['pagename'] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			: '';
		return 'checkout' === $pagename;
	}

	return false;
}

/**
 * Verify the existing DTB HS256 cookie contract and return its WordPress user ID.
 *
 * AuthRoutes.php is intentionally REST/admin-scoped, so its helper functions are
 * not available during a public checkout document request. This verifier mirrors
 * only the established signed-cookie trust boundary required before Woo session
 * initialization; it does not accept bearer tokens or caller-supplied identities.
 */
function dtb_native_checkout_verify_user_id( string $token ): int {
	$parts = explode( '.', $token );
	if ( 3 !== count( $parts ) ) {
		return 0;
	}

	[ $encoded_header, $encoded_payload, $encoded_signature ] = $parts;
	$header_json  = dtb_native_checkout_base64url_decode( $encoded_header );
	$payload_json = dtb_native_checkout_base64url_decode( $encoded_payload );
	if ( null === $header_json || null === $payload_json ) {
		return 0;
	}

	$header  = json_decode( $header_json );
	$payload = json_decode( $payload_json );
	if ( ! is_object( $header ) || ! is_object( $payload ) || 'HS256' !== ( $header->alg ?? '' ) ) {
		return 0;
	}

	$config = function_exists( 'dtb_get_config' ) ? dtb_get_config() : [];
	$secret = is_array( $config ) ? (string) ( $config['jwt_secret'] ?? '' ) : '';
	if ( '' === $secret ) {
		return 0;
	}

	$expected = rtrim(
		strtr(
			base64_encode( hash_hmac( 'sha256', $encoded_header . '.' . $encoded_payload, $secret, true ) ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
			'+/',
			'-_'
		),
		'='
	);
	if ( ! hash_equals( $expected, $encoded_signature ) ) {
		return 0;
	}

	$now = time();
	$sub = isset( $payload->sub ) ? absint( $payload->sub ) : 0;
	$exp = isset( $payload->exp ) ? (int) $payload->exp : 0;
	$iat = isset( $payload->iat ) ? (int) $payload->iat : 0;
	if ( $sub <= 0 || $exp <= $now || ( $iat > 0 && $iat > $now + 300 ) ) {
		return 0;
	}

	return $sub;
}

/**
 * Strict base64url decode.
 *
 * @return string|null
 */
function dtb_native_checkout_base64url_decode( string $value ): ?string {
	if ( '' === $value || ! preg_match( '/^[A-Za-z0-9_-]+$/', $value ) ) {
		return null;
	}

	$padded = $value . str_repeat( '=', ( 4 - ( strlen( $value ) % 4 ) ) % 4 );
	$decoded = base64_decode( strtr( $padded, '-_', '+/' ), true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode
	return false === $decoded ? null : $decoded;
}
