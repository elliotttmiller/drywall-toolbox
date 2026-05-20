<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_veeqo_config(): array {
	return function_exists( 'dtb_veeqo_config' ) ? dtb_veeqo_config() : [];
}
