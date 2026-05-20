<?php
/**
 * DTB Payment Webhook Validator — order lookup helpers for payment gateways.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_payment_webhook_find_order_by_stripe( array $data_obj ): ?WC_Order {
	$meta_order_id = $data_obj['metadata']['order_id'] ?? $data_obj['metadata']['woocommerce_order_id'] ?? null;
	if ( $meta_order_id ) {
		$order = wc_get_order( (int) $meta_order_id );
		if ( $order ) {
			return $order;
		}
	}

	$intent_id = $data_obj['payment_intent'] ?? $data_obj['id'] ?? null;
	if ( $intent_id ) {
		$orders = wc_get_orders( [
			'meta_key'   => '_stripe_intent_id',
			'meta_value' => sanitize_text_field( (string) $intent_id ),
			'limit'      => 1,
		] );
		if ( ! empty( $orders ) ) {
			return reset( $orders );
		}
	}

	return null;
}

function dtb_payment_webhook_find_order_by_paypal( array $resource ): ?WC_Order {
	$custom_id = $resource['custom_id'] ?? $resource['invoice_id'] ?? null;
	if ( $custom_id ) {
		$order = wc_get_order( (int) $custom_id );
		if ( $order ) {
			return $order;
		}
	}

	$capture_id = $resource['id'] ?? null;
	if ( $capture_id ) {
		$orders = wc_get_orders( [
			'meta_key'   => '_paypal_capture_id',
			'meta_value' => sanitize_text_field( (string) $capture_id ),
			'limit'      => 1,
		] );
		if ( ! empty( $orders ) ) {
			return reset( $orders );
		}
	}

	return null;
}
