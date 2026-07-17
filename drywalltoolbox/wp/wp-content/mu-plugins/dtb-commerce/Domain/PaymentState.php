<?php
defined( 'ABSPATH' ) || exit;

function dtb_checkout_handoff_is_order( $order ): bool {
	return $order instanceof WC_Order && (
		'woo_native_stripe' === (string) $order->get_meta( '_dtb_checkout_gateway', true )
		|| '' !== (string) $order->get_meta( '_dtb_checkout_contract_version', true )
		|| '' !== (string) $order->get_meta( '_dtb_checkout_session_id', true )
		|| '' !== (string) $order->get_meta( '_dtb_checkout_idempotency_key', true )
	);
}

function dtb_checkout_handoff_has_gateway_reference( WC_Order $order ): bool {
	if ( '' !== trim( (string) $order->get_transaction_id() ) ) {
		return true;
	}
	foreach ( [ '_dtb_payment_ref', '_stripe_intent_id', '_stripe_charge_id', '_stripe_source_id', '_payment_intent_id' ] as $meta_key ) {
		if ( '' !== trim( (string) $order->get_meta( $meta_key, true ) ) ) {
			return true;
		}
	}
	return false;
}

function dtb_checkout_handoff_uses_official_stripe_gateway( WC_Order $order ): bool {
	$method = sanitize_key( (string) $order->get_payment_method() );
	return 'stripe' === $method || str_starts_with( $method, 'stripe_' );
}

function dtb_checkout_handoff_has_provider_verified_payment( WC_Order $order ): bool {
	if ( dtb_checkout_handoff_uses_official_stripe_gateway( $order ) ) {
		return null !== $order->get_date_paid() && dtb_checkout_handoff_has_gateway_reference( $order );
	}

	return dtb_checkout_handoff_has_gateway_reference( $order );
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
