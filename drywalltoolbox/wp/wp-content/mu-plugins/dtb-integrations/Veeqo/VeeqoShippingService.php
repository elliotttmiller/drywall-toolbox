<?php
/**
 * DTB checkout shipping-policy facade housed in the Veeqo integration module.
 *
 * The current handler calculates DTB policy rates locally. It does not request
 * live carrier quotes from Veeqo. Veeqo remains authoritative for inventory and
 * downstream fulfillment, shipment, label, and tracking workflows.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( class_exists( 'DTB_VeeqoShippingService' ) ) {
	return;
}

final class DTB_VeeqoShippingService {
	/**
	 * Dispatch the current DTB shipping-rate REST calculation handler.
	 */
	public static function rates( WP_REST_Request $request ): ?WP_REST_Response {
		if ( function_exists( 'dtb_veeqo_route_shipping_rates' ) ) {
			return dtb_veeqo_route_shipping_rates( $request );
		}

		return null;
	}
}

/**
 * Backward-compatible shipping-rate wrapper.
 */
function dtb_integrations_veeqo_shipping_rates( WP_REST_Request $request ): ?WP_REST_Response {
	return DTB_VeeqoShippingService::rates( $request );
}
