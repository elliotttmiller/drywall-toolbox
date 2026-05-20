<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_qbo_customer_id_for_order( WC_Order $order ): string {
	return function_exists( 'dtb_qbo_get_or_create_customer' ) ? (string) dtb_qbo_get_or_create_customer( $order ) : '';
}
