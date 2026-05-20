<?php
/**
 * DTB Admin Security
 *
 * Admin/Woo Admin compatibility diagnostics for REST hardening. This file
 * intentionally observes first and avoids broad permission overrides.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', 'dtb_admin_security_register_routes', 20 );
add_filter( 'rest_post_dispatch', 'dtb_admin_security_log_rest_denials', 10, 3 );

function dtb_admin_security_register_routes(): void {
	if ( ! dtb_feature_enabled( 'DTB_ENABLE_ADMIN_SMOKE_ROUTE', true ) ) {
		return;
	}

	register_rest_route(
		'dtb/v1',
		'/admin-smoke',
		[
			'methods'             => WP_REST_Server::READABLE,
			'permission_callback' => 'dtb_admin_security_can_run_smoke',
			'callback'            => static function (): WP_REST_Response {
				return rest_ensure_response(
					[
						'user'   => [
							'id'                  => get_current_user_id(),
							'manage_options'      => current_user_can( 'manage_options' ),
							'manage_woocommerce'  => current_user_can( 'manage_woocommerce' ),
							'view_woocommerce_reports' => current_user_can( 'view_woocommerce_reports' ),
						],
						'routes' => dtb_admin_security_smoke_results(),
					]
				);
			},
		]
	);
}

function dtb_admin_security_can_run_smoke(): bool {
	return current_user_can( 'manage_options' ) || current_user_can( 'manage_woocommerce' );
}

function dtb_admin_security_log_rest_denials( $response, WP_REST_Server $server, WP_REST_Request $request ) {
	if ( ! dtb_feature_enabled( 'DTB_ENABLE_ADMIN_REST_LOGGING', true ) ) {
		return $response;
	}

	$status = 0;

	if ( $response instanceof WP_HTTP_Response ) {
		$status = (int) $response->get_status();
	} elseif ( is_wp_error( $response ) ) {
		$status = (int) ( $response->get_error_data()['status'] ?? 0 );
	}

	$route = $request->get_route();

	// Log 401/403 on admin routes.
	if ( in_array( $status, [ 401, 403 ], true ) && dtb_admin_security_is_admin_route( $route ) ) {
		dtb_security_log(
			'admin_rest_denied',
			[
				'route'  => $route,
				'status' => $status,
			]
		);
	}

	// Log 500 errors on dtb/* routes for alerting.
	if ( 500 === $status && 0 === strpos( $route, '/dtb/' ) ) {
		dtb_security_log(
			'dtb_rest_server_error',
			[
				'route'  => $route,
				'status' => $status,
			]
		);
	}

	return $response;
}

function dtb_admin_security_is_admin_route( string $route ): bool {
	foreach ( [ '/wp/v2/users/me', '/wc-admin/', '/wc-analytics/', '/wc/v3/', '/newfold-ctb/' ] as $prefix ) {
		if ( 0 === strpos( $route, $prefix ) ) {
			return true;
		}
	}

	return false;
}

function dtb_admin_security_smoke_results(): array {
	$checks = [
		[
			'label'  => 'DTB Health',
			'method' => 'GET',
			'route'  => '/dtb/v1/health',
			'params' => [],
		],
		[
			'label'  => 'WP current user',
			'method' => 'GET',
			'route'  => '/wp/v2/users/me',
			'params' => [
				'context' => 'edit',
			],
		],
		[
			'label'  => 'Woo low stock count',
			'method' => 'GET',
			'route'  => '/wc-analytics/products/count-low-in-stock',
			'params' => [
				'status'   => 'publish',
				'page'     => 1,
				'per_page' => 1,
			],
		],
		[
			'label'  => 'Woo admin options',
			'method' => 'GET',
			'route'  => '/wc-admin/options',
			'params' => [
				'options' => 'woocommerce_allow_tracking',
			],
		],
		[
			'label'  => 'Woo admin tasks',
			'method' => 'GET',
			'route'  => '/wc-admin/onboarding/tasks',
			'params' => [],
		],
	];

	$results = [];

	foreach ( $checks as $check ) {
		$request = new WP_REST_Request( $check['method'], $check['route'] );

		foreach ( $check['params'] as $key => $value ) {
			$request->set_param( $key, $value );
		}

		$response = rest_do_request( $request );
		$status   = is_wp_error( $response ) ? (int) ( $response->get_error_data()['status'] ?? 0 ) : (int) $response->get_status();

		$results[] = [
			'label'  => $check['label'],
			'route'  => $check['route'],
			'status' => $status,
			'ok'     => $status >= 200 && $status < 400,
		];
	}

	return $results;
}
