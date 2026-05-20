<?php
/**
 * QuickBooks integration health check.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( class_exists( 'DTB_QuickBooksHealthCheck' ) ) {
	return;
}

final class DTB_QuickBooksHealthCheck {
	/** Register with platform health registry. */
	public static function register(): void {
		if ( class_exists( 'DTB_HealthRegistry' ) ) {
			DTB_HealthRegistry::register( 'quickbooks', [ self::class, 'run' ] );
		}
	}

	/**
	 * Return passive QuickBooks health diagnostics.
	 *
	 * @return array<string,mixed>
	 */
	public static function run(): array {
		$status = [
			'ok'                 => function_exists( 'dtb_qbo_enabled' ) ? (bool) dtb_qbo_enabled() : false,
			'config_function'    => function_exists( 'dtb_qbo_config' ),
			'tokens_configured'  => function_exists( 'dtb_qbo_load_tokens' ) ? null !== dtb_qbo_load_tokens() : false,
			'auth_url_available' => function_exists( 'dtb_qbo_get_auth_url' ) && '' !== dtb_qbo_get_auth_url(),
			'sync_available'     => function_exists( 'dtb_qbo_run_sync' ),
		];

		if ( function_exists( 'dtb_qbo_rest_status' ) ) {
			$response = dtb_qbo_rest_status();
			if ( $response instanceof WP_REST_Response ) {
				$status['rest_status'] = $response->get_data();
			}
		}

		return $status;
	}
}

add_action( 'plugins_loaded', [ 'DTB_QuickBooksHealthCheck', 'register' ], 20 );

/**
 * Backward-compatible QuickBooks status wrapper.
 *
 * @return array<string,mixed>
 */
function dtb_integrations_qbo_status(): array {
	return DTB_QuickBooksHealthCheck::run();
}
