<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_rewards_balance( WP_REST_Request $request ) {
	return function_exists( 'dtb_rewards_get_balance' ) ? dtb_rewards_get_balance( $request ) : new WP_Error( 'rewards_unavailable', 'Rewards balance unavailable.' );
}
