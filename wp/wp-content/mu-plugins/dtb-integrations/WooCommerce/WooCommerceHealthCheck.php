<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_woo_health(): array {
	return function_exists( 'dtb_wc_connection_health' ) ? (array) dtb_wc_connection_health() : [];
}
