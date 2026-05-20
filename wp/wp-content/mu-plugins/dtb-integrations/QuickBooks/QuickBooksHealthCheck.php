<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_qbo_status(): array {
	if ( function_exists( 'dtb_qbo_rest_status' ) ) {
		$response = dtb_qbo_rest_status();
		if ( $response instanceof WP_REST_Response ) {
			return (array) $response->get_data();
		}
	}
	return [];
}
