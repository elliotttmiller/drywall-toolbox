<?php

defined( 'ABSPATH' ) || exit;

function dtb_checkout_handoff_is_order( $order ): bool {
	if ( ! $order instanceof WC_Order ) {
		return false;
	}

	$gateway  = (string) $order->get_meta( '_dtb_checkout_gateway', true );
	$contract = (string) $order->get_meta( '_dtb_checkout_contract_version', true );

	return 'woo_native_woopayments' === $gateway
		|| 'woo-payments-v1' === $contract;
}

function dtb_checkout_handoff_has_gateway_reference( WC_Order $order ): bool {
	if ( '' !== trim( (string) $order->get_transaction_id() ) ) {
		return true;
	}

	$meta_keys = [
		'_dtb_payment_ref',
		'_wcpay_intent_id',
		'_wcpay_payment_intent_id',
		'_wcpay_charge_id',
		'_wcpay_transaction_id',
	];

	foreach ( $meta_keys as $meta_key ) {
		if ( '' !== trim( (string) $order->get_meta( $meta_key, true ) ) ) {
			return true;
		}
	}
	return false;
}

function dtb_checkout_handoff_uses_woopayments_gateway( WC_Order $order ): bool {
	$method = sanitize_key( (string) $order->get_payment_method() );
	return 'woocommerce_payments' === $method || str_starts_with( $method, 'woocommerce_payments_' );
}

function dtb_checkout_handoff_has_provider_verified_payment( WC_Order $order ): bool {
	if ( dtb_checkout_handoff_uses_woopayments_gateway( $order ) ) {
		return null !== $order->get_date_paid() && dtb_checkout_handoff_has_gateway_reference( $order );
	}

	return false;
}

function dtb_checkout_handoff_has_captured_payment( WC_Order $order ): bool {
	return null !== $order->get_date_paid()
		&& dtb_checkout_handoff_has_gateway_reference( $order )
		&& dtb_checkout_handoff_has_provider_verified_payment( $order );
}

function dtb_checkout_handoff_is_order_unpaid( WC_Order $order ): bool {
	return dtb_checkout_handoff_is_order( $order )
		&& (float) $order->get_total() > 0
		&& ! dtb_checkout_handoff_has_captured_payment( $order )
		&& ! in_array( (string) $order->get_status(), [ 'completed', 'cancelled', 'refunded', 'trash' ], true )
		&& ! in_array( sanitize_key( (string) $order->get_payment_method() ), [ 'cod', 'bacs', 'cheque' ], true );
}

function dtb_checkout_handoff_is_unpaid_order( $order ): bool {
	return $order instanceof WC_Order && dtb_checkout_handoff_is_order_unpaid( $order );
}
