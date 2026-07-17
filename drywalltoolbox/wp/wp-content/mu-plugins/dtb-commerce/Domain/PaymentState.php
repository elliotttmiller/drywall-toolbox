<?php
defined( 'ABSPATH' ) || exit;

function dtb_checkout_handoff_is_order( $order ): bool {
	return $order instanceof WC_Order && (
		'stripe_embedded_checkout' === (string) $order->get_meta( '_dtb_checkout_gateway', true )
		|| '' !== (string) $order->get_meta( '_dtb_checkout_session_id', true )
		|| '' !== (string) $order->get_meta( '_dtb_checkout_idempotency_key', true )
	);
}

function dtb_checkout_handoff_has_gateway_reference( WC_Order $order ): bool {
	if ( '' !== trim( (string) $order->get_transaction_id() ) ) {
		return true;
	}
	foreach ( [ '_dtb_payment_ref', '_dtb_stripe_checkout_session_id', '_stripe_intent_id', '_stripe_charge_id' ] as $meta_key ) {
		if ( '' !== trim( (string) $order->get_meta( $meta_key, true ) ) ) {
			return true;
		}
	}
	return false;
}

function dtb_checkout_handoff_has_provider_verified_payment( WC_Order $order ): bool {
	return 'stripe_embedded_checkout' === (string) $order->get_meta( '_dtb_payment_provider', true )
		&& '1' === (string) $order->get_meta( '_dtb_payment_captured', true )
		&& '' !== trim( (string) $order->get_meta( '_dtb_payment_ref', true ) );
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
		&& ! in_array( (string) $order->get_status(), [ 'completed', 'cancelled', 'refunded', 'trash' ], true );
}

function dtb_checkout_handoff_is_unpaid_order( $order ): bool {
	return $order instanceof WC_Order && dtb_checkout_handoff_is_order_unpaid( $order );
}
