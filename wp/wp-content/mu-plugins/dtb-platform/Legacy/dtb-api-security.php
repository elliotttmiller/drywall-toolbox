<?php
/**
 * DTB API Security
 *
 * Owns REST/CORS policy that used to be split between themes and dtb-rest-api.
 * Keep this layer admin-aware and feature-flagged so hardening can be tightened
 * gradually without turning Woo Admin into a 403 confetti cannon.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', 'dtb_cors_init', 15 );
add_action( 'init', 'dtb_emit_cors_headers_early', 0 );
add_action( 'send_headers', 'dtb_send_rest_cors_headers', 1 );
add_action( 'woocommerce_init', 'dtb_wc_cors_early', 1 );
add_action( 'init', 'dtb_api_security_handle_options_preflight', 1 );
add_filter( 'rest_endpoints', 'dtb_api_security_restrict_user_endpoints', 20 );
add_filter( 'woocommerce_rest_check_permissions', 'dtb_api_security_wc_public_read', 10, 4 );
add_action( 'rest_api_init', 'dtb_api_security_register_nonce_route', 20 );

add_action(
	'rest_api_init',
	static function (): void {
		remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
	},
	-999
);

function dtb_wc_cors_early(): void {
	if ( dtb_feature_enabled( 'DTB_ENABLE_REST_CORS', true ) ) {
		dtb_emit_cors_headers();
	}
}

function dtb_cors_init(): void {
	if ( ! dtb_feature_enabled( 'DTB_ENABLE_REST_CORS', true ) ) {
		return;
	}

	remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );

	add_filter(
		'rest_pre_serve_request',
		static function ( $served, $result, $request, $server ) {
			dtb_emit_cors_headers();
			return $served;
		},
		10,
		4
	);
}

function dtb_emit_cors_headers_early(): void {
	if ( dtb_feature_enabled( 'DTB_ENABLE_REST_CORS', true ) && dtb_is_rest_request() ) {
		dtb_emit_cors_headers();
	}
}

function dtb_send_rest_cors_headers(): void {
	if ( dtb_feature_enabled( 'DTB_ENABLE_REST_CORS', true ) && dtb_is_rest_request() ) {
		dtb_emit_cors_headers();
	}
}

function dtb_api_security_handle_options_preflight(): void {
	if (
		! dtb_feature_enabled( 'DTB_ENABLE_REST_CORS', true )
		|| 'OPTIONS' !== ( $_SERVER['REQUEST_METHOD'] ?? '' )
		|| ! dtb_is_rest_request()
	) {
		return;
	}

	if ( dtb_check_origin() ) {
		dtb_emit_cors_headers();
		status_header( 204 );
		exit;
	}

	dtb_security_log( 'cors_preflight_denied' );
	status_header( 403 );
	exit;
}

function dtb_is_rest_request(): bool {
	if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) {
		return true;
	}

	$request_uri = isset( $_SERVER['REQUEST_URI'] )
		? (string) wp_unslash( $_SERVER['REQUEST_URI'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';

	if ( '' === $request_uri ) {
		return false;
	}

	$rest_path   = wp_parse_url( rest_url(), PHP_URL_PATH );

	return ( $rest_path && str_starts_with( $request_uri, $rest_path ) )
		|| str_contains( $request_uri, '/wp-json/' )
		|| str_contains( $request_uri, '/wp-json' );
}

function dtb_emit_cors_headers( ?string $raw_origin = null ): void {
	$raw_origin ??= isset( $_SERVER['HTTP_ORIGIN'] )
		? (string) wp_unslash( $_SERVER['HTTP_ORIGIN'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: '';

	header_remove( 'Access-Control-Allow-Origin' );
	header_remove( 'Access-Control-Allow-Credentials' );
	header_remove( 'Access-Control-Allow-Methods' );
	header_remove( 'Access-Control-Allow-Headers' );

	if ( '' !== $raw_origin && dtb_check_origin() ) {
		header( 'Access-Control-Allow-Origin: ' . esc_url_raw( rtrim( $raw_origin, '/' ) ) );
		header( 'Access-Control-Allow-Credentials: true' );
		header( 'Vary: Origin', false );
	}

	header( 'Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS' );
	header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce, X-Requested-With, X-WC-Store-API-Nonce' );
	header( 'Access-Control-Expose-Headers: X-WC-Store-API-Nonce' );
	header( 'Access-Control-Max-Age: 86400' );

	$ops_version = defined( 'DTB_OPS_VERSION' ) ? DTB_OPS_VERSION : '1.0.0';
	header( 'X-DTB-Version: ' . $ops_version );
}

function dtb_api_security_restrict_user_endpoints( array $endpoints ): array {
	if ( ! dtb_feature_enabled( 'DTB_RESTRICT_USER_ENDPOINTS', true ) ) {
		return $endpoints;
	}

	$restricted_routes = [
		'/wp/v2/users',
		'/wp/v2/users/(?P<id>[\d]+)',
		'/wp/v2/users/me',
	];

	foreach ( $restricted_routes as $route ) {
		if ( ! isset( $endpoints[ $route ] ) || ! is_array( $endpoints[ $route ] ) ) {
			continue;
		}

		foreach ( $endpoints[ $route ] as &$handler ) {
			if ( ! is_array( $handler ) ) {
				continue;
			}

			$handler['permission_callback'] = static function () use ( $route ): bool {
				$allowed = current_user_can( 'list_users' );

				if ( ! $allowed ) {
					dtb_security_log(
						'wp_users_endpoint_denied',
						[
							'route'        => $route,
							'required_cap' => 'list_users',
						]
					);
				}

				return $allowed;
			};
		}
		unset( $handler );
	}

	return $endpoints;
}

function dtb_api_security_wc_public_read( $permission, $context, $object_id, $post_type ) {
	if (
		dtb_feature_enabled( 'DTB_WC_PUBLIC_READ', true )
		&& 'read' === $context
		&& in_array( $post_type, [ 'product', 'product_cat', 'product_tag', 'product_attribute', 'product_variation' ], true )
	) {
		return true;
	}

	return $permission;
}

function dtb_api_security_register_nonce_route(): void {
	if ( ! dtb_feature_enabled( 'DTB_ENABLE_NONCE_REFRESH', true ) ) {
		return;
	}

	register_rest_route(
		'dtb/v1',
		'/nonce',
		[
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => '__return_true',
			'callback'            => static function (): WP_REST_Response {
				return rest_ensure_response(
					[
						'nonce' => wp_create_nonce( 'wp_rest' ),
					]
				);
			},
		]
	);
}

function dtb_route_cors_test(): WP_REST_Response {
	return rest_ensure_response(
		[
			'ok'              => true,
			'allowed_origins' => dtb_allowed_origins(),
			'origin_allowed'  => dtb_check_origin(),
		]
	);
}
