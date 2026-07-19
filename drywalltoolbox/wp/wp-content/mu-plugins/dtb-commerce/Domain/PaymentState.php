<?php

defined( 'ABSPATH' ) || exit;

function dtb_checkout_handoff_is_order( $order ): bool {
	if ( ! $order instanceof WC_Order ) {
		return false;
	}

	$gateway  = (string) $order->get_meta( '_dtb_checkout_gateway', true );
	$contract = (string) $order->get_meta( '_dtb_checkout_contract_version', true );

	return 'woo_native_stripe' === $gateway
		&& 'woo-stripe-v1' === $contract;
}

function dtb_checkout_handoff_has_gateway_reference( WC_Order $order ): bool {
	if ( '' !== trim( (string) $order->get_transaction_id() ) ) {
		return true;
	}

	foreach ( [ '_dtb_payment_ref', '_stripe_intent_id', '_stripe_charge_id', '_payment_intent_id' ] as $meta_key ) {
		if ( '' !== trim( (string) $order->get_meta( $meta_key, true ) ) ) {
			return true;
		}
	}
	return false;
}

/**
 * Verify that DTB observed the selected gateway as an instance owned by the
 * official WooCommerce Stripe extension during the Woo payment lifecycle.
 *
 * We intentionally do not trust a raw `stripe_*` payment-method prefix here;
 * third-party Stripe extensions use overlapping gateway IDs.
 */
function dtb_checkout_handoff_uses_official_stripe_gateway( WC_Order $order ): bool {
	return 'woocommerce_stripe' === sanitize_key( (string) $order->get_meta( '_dtb_payment_provider', true ) );
}

function dtb_checkout_handoff_has_provider_verified_payment( WC_Order $order ): bool {
	return dtb_checkout_handoff_is_order( $order )
		&& dtb_checkout_handoff_uses_official_stripe_gateway( $order )
		&& null !== $order->get_date_paid()
		&& dtb_checkout_handoff_has_gateway_reference( $order );
}

function dtb_checkout_handoff_has_captured_payment( WC_Order $order ): bool {
	return dtb_checkout_handoff_has_provider_verified_payment( $order );
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
