<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_rewards_recent_redemptions( int $limit = 25 ): array {
	return function_exists( 'dtb_rewards_get_recent_redemptions' ) ? (array) dtb_rewards_get_recent_redemptions( $limit ) : [];
}
