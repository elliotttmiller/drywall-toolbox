<?php
/**
 * DTB auth cookie and cache hardening.
 *
 * Normalizes storefront auth REST responses so shared hosting/page caches do not
 * retain auth state and so the HttpOnly DTB session cookie is emitted with a
 * reliable same-origin SameSite policy. This file is loaded after AuthRoutes.php
 * and does not alter credentials, validation, or route permissions.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_filter( 'rest_post_dispatch', 'dtb_auth_harden_rest_response', 20, 3 );

/**
 * Harden DTB auth REST responses before WordPress sends them.
 *
 * @param WP_REST_Response|WP_HTTP_Response|WP_Error $response REST response.
 * @param WP_REST_Server                             $server   REST server.
 * @param WP_REST_Request                            $request  REST request.
 * @return WP_REST_Response|WP_HTTP_Response|WP_Error
 */
function dtb_auth_harden_rest_response( $response, $server, $request ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
	if ( is_wp_error( $response ) || ! $request instanceof WP_REST_Request ) {
		return $response;
	}

	$route = (string) $request->get_route();
	if ( 0 !== strpos( $route, '/dtb/v1/auth/' ) ) {
		return $response;
	}

	if ( $response instanceof WP_REST_Response || $response instanceof WP_HTTP_Response ) {
		$response->header( 'Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private' );
		$response->header( 'Pragma', 'no-cache' );
		$response->header( 'Expires', '0' );
		$response->header( 'X-Accel-Expires', '0' );
		$response->header( 'Vary', 'Cookie, Authorization, Origin' );
	}

	if ( '/dtb/v1/auth/login' === $route || '/dtb/v1/auth/register' === $route ) {
		dtb_auth_refresh_cookie_from_response( $response );
	}

	if ( '/dtb/v1/auth/logout' === $route ) {
		dtb_auth_clear_hardened_cookie();
	}

	return $response;
}

/**
 * Re-emit the DTB auth cookie from a successful login/register response.
 *
 * AuthRoutes.php already authenticates credentials and creates the token. This
 * refresh keeps the same server-side authority while normalizing cookie options
 * for the live root-hosted SPA and mobile browsers.
 *
 * @param WP_REST_Response|WP_HTTP_Response $response REST response.
 */
function dtb_auth_refresh_cookie_from_response( $response ): void {
	if ( ! ( $response instanceof WP_REST_Response || $response instanceof WP_HTTP_Response ) ) {
		return;
	}

	$data = $response->get_data();
	if ( empty( $data['success'] ) || empty( $data['user']['id'] ) ) {
		return;
	}

	$user = get_user_by( 'id', (int) $data['user']['id'] );
	if ( ! $user instanceof WP_User || ! function_exists( 'dtb_generate_jwt' ) ) {
		return;
	}

	$cookie_name = defined( 'DTB_AUTH_COOKIE' ) ? DTB_AUTH_COOKIE : 'dtb_auth';
	$jwt         = dtb_generate_jwt( $user );
	$cross      = function_exists( 'dtb_is_cross_origin_request' ) && dtb_is_cross_origin_request();

	setcookie( $cookie_name, $jwt, [
		'expires'  => time() + 7 * DAY_IN_SECONDS,
		'path'     => '/',
		'secure'   => true,
		'httponly' => true,
		'samesite' => $cross ? 'None' : 'Lax',
	] );

	// Signal HostGator/Endurance cache bypass for the immediate post-login path.
	setcookie( 'endurance-no-cache', '1', [
		'expires'  => time() + 60,
		'path'     => '/',
		'secure'   => true,
		'httponly' => false,
		'samesite' => 'Strict',
	] );
}

/**
 * Clear the hardened host-only cookie variant.
 */
function dtb_auth_clear_hardened_cookie(): void {
	$cookie_name = defined( 'DTB_AUTH_COOKIE' ) ? DTB_AUTH_COOKIE : 'dtb_auth';
	$cross       = function_exists( 'dtb_is_cross_origin_request' ) && dtb_is_cross_origin_request();

	setcookie( $cookie_name, '', [
		'expires'  => time() - DAY_IN_SECONDS,
		'path'     => '/',
		'secure'   => true,
		'httponly' => true,
		'samesite' => $cross ? 'None' : 'Lax',
	] );
}
	setcookie( 'endurance-no-cache', '1', [
		'expires'  => time() + 60,
		'path'     => '/',
		'secure'   => true,
		'httponly' => false,
		'samesite' => 'Strict',
	] );
}
