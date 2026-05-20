<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_veeqo_inventory_summary(): array {
	return function_exists( 'dtb_veeqo_get_inventory_summary' ) ? dtb_veeqo_get_inventory_summary() : [];
}
