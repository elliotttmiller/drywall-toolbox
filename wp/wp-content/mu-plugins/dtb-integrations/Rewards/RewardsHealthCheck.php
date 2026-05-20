<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_rewards_liability_total(): float {
	return function_exists( 'dtb_rewards_get_total_liability' ) ? (float) dtb_rewards_get_total_liability() : 0.0;
}
