<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_woo_repair_quote_totals( array $lines ): array {
	if ( function_exists( 'dtb_repair_calculate_totals' ) ) {
		return (array) dtb_repair_calculate_totals( $lines );
	}
	return [];
}
