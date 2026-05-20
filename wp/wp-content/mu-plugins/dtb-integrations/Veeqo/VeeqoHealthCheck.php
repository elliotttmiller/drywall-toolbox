<?php
/**
 * Veeqo integration health check.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( class_exists( 'DTB_VeeqoHealthCheck' ) ) {
	return;
}

final class DTB_VeeqoHealthCheck {
	/** Register with platform health registry. */
	public static function register(): void {
		if ( class_exists( 'DTB_HealthRegistry' ) ) {
			DTB_HealthRegistry::register( 'veeqo', [ self::class, 'run' ] );
		}
	}

	/**
	 * Return passive Veeqo health diagnostics.
	 *
	 * @return array<string,mixed>
	 */
	public static function run(): array {
		$config = class_exists( 'DTB_VeeqoConfig' ) ? DTB_VeeqoConfig::redacted() : [];

		return [
			'ok'                    => ! empty( $config['api_key_configured'] ),
			'configured'            => $config,
			'request_function'       => function_exists( 'dtb_veeqo_request' ),
			'route_registration'     => function_exists( 'dtb_veeqo_register_routes' ),
			'webhook_controller'     => function_exists( 'dtb_veeqo_route_webhook_order' ),
			'shipping_rate_handler'  => function_exists( 'dtb_veeqo_route_shipping_rates' ),
			'inventory_handler'      => function_exists( 'dtb_veeqo_route_inventory' ),
		];
	}
}

add_action( 'plugins_loaded', [ 'DTB_VeeqoHealthCheck', 'register' ], 20 );

/**
 * Backward-compatible Veeqo health snapshot wrapper.
 *
 * @return array<string,mixed>
 */
function dtb_integrations_veeqo_healthcheck(): array {
	return DTB_VeeqoHealthCheck::run();
}
