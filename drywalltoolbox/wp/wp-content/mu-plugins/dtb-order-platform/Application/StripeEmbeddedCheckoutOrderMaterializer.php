<?php
/**
 * Materializes WooCommerce orders from verified Stripe Embedded Checkout
 * Sessions.
 *
 * This class is the write boundary for Stripe-first checkout. It only creates a
 * Woo order after a server-verified paid Checkout Session and keeps duplicate
 * webhook deliveries idempotent.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_StripeEmbeddedCheckoutOrderMaterializer {
	public static function materialize_paid_session( array $row, array $stripe_session, string $event_id = '' ): array|WP_Error {
		if ( ! function_exists( 'wc_get_order' ) || ! function_exists( 'wc_create_order' ) ) {
			return new WP_Error( 'dtb_stripe_order_wc_unavailable', 'WooCommerce is not available.', [ 'status' => 503 ] );
		}
		if ( 'paid' !== (string) ( $stripe_session['payment_status'] ?? '' ) ) {
			return [ 'processed' => false, 'reason' => 'payment_not_paid' ];
		}
		$matched = self::assert_session_matches_row( $row, $stripe_session );
		if ( is_wp_error( $matched ) ) {
			return $matched;
		}

		$existing = self::existing_order( $row, $stripe_session );
		if ( $existing instanceof WC_Order ) {
			self::ensure_paid( $existing, $stripe_session, $event_id );
			return [ 'processed' => true, 'idempotent' => true, 'order_id' => (int) $existing->get_id() ];
		}

		$state = (string) ( $row['state'] ?? '' );
		if ( ! in_array( $state, [ 'created', 'confirmed', 'finalizing' ], true ) ) {
			return new WP_Error( 'dtb_stripe_order_invalid_state', 'Checkout session is not ready for Stripe order materialization.', [ 'status' => 409 ] );
		}
		if ( 'finalizing' !== $state ) {
			$transitioned = DTB_OrderCheckoutSessionRepository::transition( (int) $row['id'], $state, 'finalizing', (int) $row['state_version'] );
			if ( ! $transitioned ) {
				$latest = DTB_OrderCheckoutSessionRepository::find_by_session_id( (string) $row['session_id'] );
				$existing = is_array( $latest ) ? self::existing_order( $latest, $stripe_session ) : null;
				if ( $existing instanceof WC_Order ) {
					self::ensure_paid( $existing, $stripe_session, $event_id );
					return [ 'processed' => true, 'idempotent' => true, 'order_id' => (int) $existing->get_id() ];
				}
				return new WP_Error( 'dtb_stripe_order_finalize_conflict', 'Stripe order materialization is already in progress.', [ 'status' => 409 ] );
			}
			$row = DTB_OrderCheckoutSessionRepository::find_by_session_id( (string) $row['session_id'] ) ?: $row;
		}

		$order = self::create_order( $row, $stripe_session );
		if ( is_wp_error( $order ) ) {
			DTB_OrderCheckoutSessionRepository::transition( (int) $row['id'], 'finalizing', 'failed', (int) $row['state_version'], [
				'failure_code'             => $order->get_error_code(),
				'failure_context_redacted' => 'stripe-order-materialization-failed',
			] );
			return $order;
		}

		$linked = DTB_OrderCheckoutSessionRepository::transition( (int) $row['id'], 'finalizing', 'order_created', (int) $row['state_version'], [ 'order_id' => (int) $order->get_id() ] );
		if ( ! $linked ) {
			$order->delete( true );
			return new WP_Error( 'dtb_stripe_order_link_failed', 'Woo order was created but could not be linked to the Stripe checkout session.', [ 'status' => 503 ] );
		}

		self::ensure_paid( $order, $stripe_session, $event_id );
		return [ 'processed' => true, 'idempotent' => false, 'order_id' => (int) $order->get_id() ];
	}

	private static function assert_session_matches_row( array $row, array $stripe_session ): true|WP_Error {
		$metadata = is_array( $stripe_session['metadata'] ?? null ) ? $stripe_session['metadata'] : [];
		if ( ! hash_equals( (string) ( $row['session_id'] ?? '' ), (string) ( $metadata['dtb_checkout_session_id'] ?? $stripe_session['client_reference_id'] ?? '' ) ) ) {
			return new WP_Error( 'dtb_stripe_order_session_mismatch', 'Stripe session is not linked to the expected DTB checkout session.', [ 'status' => 403 ] );
		}
		if ( ! hash_equals( (string) ( $row['cart_hash'] ?? '' ), (string) ( $metadata['dtb_cart_hash'] ?? '' ) ) ) {
			return new WP_Error( 'dtb_stripe_order_cart_mismatch', 'Stripe session cart context does not match the DTB checkout session.', [ 'status' => 403 ] );
		}
		if ( ! hash_equals( (string) ( $row['context']['stripe_embedded']['stripe_session_id'] ?? '' ), (string) ( $stripe_session['id'] ?? '' ) ) ) {
			return new WP_Error( 'dtb_stripe_order_provider_session_mismatch', 'Stripe session id does not match the reserved checkout session.', [ 'status' => 403 ] );
		}
		return true;
	}

	private static function existing_order( array $row, array $stripe_session ): ?WC_Order {
		$order_id = absint( $row['order_id'] ?? 0 );
		if ( $order_id > 0 ) {
			$order = wc_get_order( $order_id );
			if ( $order instanceof WC_Order ) {
				return $order;
			}
		}
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return null;
		}
		$orders = wc_get_orders( [
			'limit'      => 1,
			'orderby'    => 'date',
			'order'      => 'DESC',
			'meta_query' => [
				'relation' => 'OR',
				[ 'key' => '_dtb_checkout_session_id', 'value' => (string) $row['session_id'], 'compare' => '=' ],
				[ 'key' => '_dtb_stripe_checkout_session_id', 'value' => (string) ( $stripe_session['id'] ?? '' ), 'compare' => '=' ],
			],
		] );
		return ! empty( $orders[0] ) && $orders[0] instanceof WC_Order ? $orders[0] : null;
	}

	private static function create_order( array $row, array $stripe_session ): WC_Order|WP_Error {
		$quote = is_array( $row['quote'] ?? null ) ? $row['quote'] : [];
		if ( empty( $quote['items'] ) || ! is_array( $quote['items'] ) ) {
			return new WP_Error( 'dtb_stripe_order_empty_snapshot', 'Checkout cart snapshot is empty.', [ 'status' => 409 ] );
		}

		$order = new WC_Order();
		$order->set_customer_id( (int) ( $row['customer_id'] ?? 0 ) );
		$order->set_created_via( 'dtb_stripe_embedded_checkout' );
		$order->set_payment_method( 'stripe_embedded_checkout' );
		$order->set_payment_method_title( 'Stripe Embedded Checkout' );
		$order->set_status( 'pending' );
		$order->update_meta_data( '_dtb_checkout_gateway', 'stripe_embedded_checkout' );
		$order->update_meta_data( '_dtb_checkout_contract_version', '5' );
		$order->update_meta_data( '_dtb_checkout_session_id', (string) $row['session_id'] );
		$order->update_meta_data( '_dtb_checkout_idempotency_key', (string) $row['idempotency_key'] );
		$order->update_meta_data( '_dtb_checkout_cart_hash', (string) $row['cart_hash'] );
		$order->update_meta_data( '_dtb_checkout_fingerprint', (string) $row['fingerprint'] );
		$order->update_meta_data( '_dtb_payment_provider', 'stripe_embedded_checkout' );
		$order->update_meta_data( '_dtb_payment_captured', '1' );
		$order->update_meta_data( '_dtb_stripe_checkout_session_id', (string) ( $stripe_session['id'] ?? '' ) );
		$order->update_meta_data( '_dtb_order_type', 'product' );
		if ( function_exists( 'dtb_detect_storefront_base_path' ) ) {
			$order->update_meta_data( '_dtb_storefront_base_path', dtb_detect_storefront_base_path() );
		}

		$payment_ref = self::payment_reference( $stripe_session );
		if ( '' !== $payment_ref ) {
			$order->set_transaction_id( $payment_ref );
			$order->update_meta_data( '_dtb_payment_ref', $payment_ref );
		}
		$intent_id = self::payment_intent_id( $stripe_session );
		$charge_id = self::charge_id( $stripe_session );
		if ( '' !== $intent_id ) {
			$order->update_meta_data( '_stripe_intent_id', $intent_id );
		}
		if ( '' !== $charge_id ) {
			$order->update_meta_data( '_stripe_charge_id', $charge_id );
		}

		self::apply_addresses( $order, $stripe_session );
		if ( ! empty( $row['context']['customer_note'] ) ) {
			$order->set_customer_note( sanitize_textarea_field( (string) $row['context']['customer_note'] ) );
		}

		foreach ( (array) $quote['items'] as $item ) {
			$product_id = absint( $item['variation_id'] ?? 0 ) ?: absint( $item['product_id'] ?? 0 );
			$product    = $product_id > 0 ? wc_get_product( $product_id ) : null;
			$quantity   = max( 1, absint( $item['quantity'] ?? 1 ) );
			if ( ! $product instanceof WC_Product ) {
				$order->delete( true );
				return new WP_Error( 'dtb_stripe_order_product_missing', 'A checkout product could not be loaded.', [ 'status' => 409 ] );
			}
			$item_id = $order->add_product( $product, $quantity );
			if ( ! $item_id ) {
				$order->delete( true );
				return new WP_Error( 'dtb_stripe_order_line_failed', 'A checkout product could not be added to the order.', [ 'status' => 503 ] );
			}
			$order_item = $order->get_item( $item_id );
			if ( $order_item instanceof WC_Order_Item_Product ) {
				$order_item->set_subtotal( wc_format_decimal( (string) ( $item['line_subtotal'] ?? $item['line_total'] ?? 0 ), 2 ) );
				$order_item->set_total( wc_format_decimal( (string) ( $item['line_total'] ?? $item['line_subtotal'] ?? 0 ), 2 ) );
				$order_item->save();
			}
		}

		self::apply_shipping( $order, $stripe_session );
		$order->calculate_totals( false );
		$expected_total = self::minor_to_amount( absint( $stripe_session['amount_total'] ?? 0 ), (string) ( $stripe_session['currency'] ?? $order->get_currency() ) );
		$diff = round( $expected_total - (float) $order->get_total(), 2 );
		if ( abs( $diff ) > 0.02 ) {
			self::add_adjustment_fee( $order, $diff );
			$order->calculate_totals( false );
		}
		if ( abs( $expected_total - (float) $order->get_total() ) > 0.02 ) {
			$order->delete( true );
			return new WP_Error( 'dtb_stripe_order_total_mismatch', 'Woo order total does not match the verified Stripe Checkout Session.', [ 'status' => 409 ] );
		}

		$order->save();
		if ( function_exists( 'dtb_order_append_event' ) ) {
			dtb_order_append_event( (int) $order->get_id(), 'order.payment_pending', [
				'source'          => 'stripe-embedded-checkout',
				'actor_type'      => 'system',
				'visibility'      => 'customer',
				'idempotency_key' => 'stripe-embedded-created:' . (string) $row['session_id'],
				'payload'         => [ 'stripe_checkout_session_id' => (string) ( $stripe_session['id'] ?? '' ) ],
			] );
		}
		return $order;
	}

	private static function ensure_paid( WC_Order $order, array $stripe_session, string $event_id ): void {
		$payment_ref = self::payment_reference( $stripe_session );
		if ( '' !== $payment_ref && '' === (string) $order->get_transaction_id() ) {
			$order->set_transaction_id( $payment_ref );
		}
		$order->update_meta_data( '_dtb_payment_provider', 'stripe_embedded_checkout' );
		$order->update_meta_data( '_dtb_payment_captured', '1' );
		$order->update_meta_data( '_dtb_payment_ref', $payment_ref );
		$order->update_meta_data( '_dtb_stripe_checkout_session_id', (string) ( $stripe_session['id'] ?? '' ) );
		$intent_id = self::payment_intent_id( $stripe_session );
		$charge_id = self::charge_id( $stripe_session );
		if ( '' !== $intent_id ) {
			$order->update_meta_data( '_stripe_intent_id', $intent_id );
		}
		if ( '' !== $charge_id ) {
			$order->update_meta_data( '_stripe_charge_id', $charge_id );
		}
		if ( '' !== $event_id ) {
			$order->update_meta_data( '_dtb_stripe_paid_event_id', sanitize_text_field( $event_id ) );
		}
		$order->save();
		if ( method_exists( $order, 'is_paid' ) && $order->is_paid() ) {
			return;
		}
		$order->payment_complete( $payment_ref );
	}

	private static function apply_addresses( WC_Order $order, array $stripe_session ): void {
		$customer = is_array( $stripe_session['customer_details'] ?? null ) ? $stripe_session['customer_details'] : [];
		$shipping = is_array( $stripe_session['shipping_details'] ?? null ) ? $stripe_session['shipping_details'] : [];
		$billing_address = self::stripe_address_to_wc( $customer, true );
		$shipping_address = self::stripe_address_to_wc( $shipping ?: $customer, false );
		$email = sanitize_email( (string) ( $customer['email'] ?? '' ) );
		$phone = sanitize_text_field( (string) ( $customer['phone'] ?? '' ) );
		if ( '' !== $email ) {
			$billing_address['email'] = $email;
		}
		if ( '' !== $phone ) {
			$billing_address['phone'] = $phone;
		}
		$order->set_address( $billing_address, 'billing' );
		$order->set_address( $shipping_address, 'shipping' );
	}

	private static function apply_shipping( WC_Order $order, array $stripe_session ): void {
		$total = self::minor_to_amount( absint( $stripe_session['total_details']['amount_shipping'] ?? $stripe_session['shipping_cost']['amount_total'] ?? 0 ), (string) ( $stripe_session['currency'] ?? $order->get_currency() ) );
		if ( $total <= 0 && empty( $stripe_session['shipping_details'] ) ) {
			return;
		}
		$item = new WC_Order_Item_Shipping();
		$item->set_method_title( sanitize_text_field( (string) ( $stripe_session['shipping_cost']['shipping_rate'] ?? 'Stripe Checkout Shipping' ) ) );
		$item->set_method_id( 'stripe_embedded_checkout' );
		$item->set_total( wc_format_decimal( (string) $total, 2 ) );
		$order->add_item( $item );
	}

	private static function add_adjustment_fee( WC_Order $order, float $amount ): void {
		$fee = new WC_Order_Item_Fee();
		$fee->set_name( $amount < 0 ? 'Stripe Checkout discount adjustment' : 'Stripe Checkout total adjustment' );
		$fee->set_total( wc_format_decimal( (string) $amount, 2 ) );
		$fee->set_tax_status( 'none' );
		$order->add_item( $fee );
	}

	private static function payment_reference( array $stripe_session ): string {
		$intent_id = self::payment_intent_id( $stripe_session );
		return '' !== $intent_id ? $intent_id : sanitize_text_field( (string) ( $stripe_session['id'] ?? '' ) );
	}

	private static function payment_intent_id( array $stripe_session ): string {
		if ( is_array( $stripe_session['payment_intent'] ?? null ) ) {
			return sanitize_text_field( (string) ( $stripe_session['payment_intent']['id'] ?? '' ) );
		}
		return sanitize_text_field( (string) ( $stripe_session['payment_intent'] ?? '' ) );
	}

	private static function charge_id( array $stripe_session ): string {
		if ( is_array( $stripe_session['payment_intent'] ?? null ) ) {
			$intent = $stripe_session['payment_intent'];
			if ( is_array( $intent['latest_charge'] ?? null ) ) {
				return sanitize_text_field( (string) ( $intent['latest_charge']['id'] ?? '' ) );
			}
			return sanitize_text_field( (string) ( $intent['latest_charge'] ?? '' ) );
		}
		return '';
	}

	private static function stripe_address_to_wc( array $details, bool $include_contact ): array {
		$address = is_array( $details['address'] ?? null ) ? $details['address'] : [];
		$name    = trim( sanitize_text_field( (string) ( $details['name'] ?? '' ) ) );
		$parts   = preg_split( '/\s+/', $name, 2 ) ?: [];
		$out = [
			'first_name' => $parts[0] ?? '',
			'last_name'  => $parts[1] ?? '',
			'company'    => '',
			'address_1'  => sanitize_text_field( (string) ( $address['line1'] ?? '' ) ),
			'address_2'  => sanitize_text_field( (string) ( $address['line2'] ?? '' ) ),
			'city'       => sanitize_text_field( (string) ( $address['city'] ?? '' ) ),
			'state'      => sanitize_text_field( (string) ( $address['state'] ?? '' ) ),
			'postcode'   => sanitize_text_field( (string) ( $address['postal_code'] ?? '' ) ),
			'country'    => sanitize_text_field( (string) ( $address['country'] ?? 'US' ) ),
		];
		if ( $include_contact ) {
			$out['email'] = sanitize_email( (string) ( $details['email'] ?? '' ) );
			$out['phone'] = sanitize_text_field( (string) ( $details['phone'] ?? '' ) );
		}
		return $out;
	}

	private static function minor_to_amount( int $amount, string $currency ): float {
		$currency = strtolower( $currency );
		$zero_decimal = [ 'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf' ];
		return in_array( $currency, $zero_decimal, true ) ? (float) $amount : $amount / 100;
	}
}
