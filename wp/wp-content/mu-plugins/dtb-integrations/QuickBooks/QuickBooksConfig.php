<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_qbo_config(): array {
	return function_exists( 'dtb_qbo_config' ) ? dtb_qbo_config() : [];
}
