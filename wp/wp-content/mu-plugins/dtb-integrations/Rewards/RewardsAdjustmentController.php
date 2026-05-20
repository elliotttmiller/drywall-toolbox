<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_rewards_adjust( WP_REST_Request $request ) {
	return function_exists( 'dtb_rewards_admin_adjust' ) ? dtb_rewards_admin_adjust( $request ) : new WP_Error( 'rewards_unavailable', 'Rewards adjust unavailable.' );
}
