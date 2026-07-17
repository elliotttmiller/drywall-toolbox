<?php
/**
 * Stripe-first Embedded Checkout bridge.
 *
 * React receives only Stripe publishable/client-secret values. DTB stores a
 * locked Woo cart snapshot, creates the Checkout Session, calculates dynamic
 * shipping options, and later materializes a WooCommerce order from verified
 * Stripe webhooks.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_StripeEmbeddedCheckoutBridge {
	public static function config(): array {
		$configured = class_exists( 'DTB_StripeEmbeddedCheckoutConfig' ) && DTB_StripeEmbeddedCheckoutConfig::is_runtime_configured();
		return [
			'available'          => $configured,
			'publishable_key'    => $configured ? DTB_StripeEmbeddedCheckoutConfig::publishable_key() : '',
			'gateway'            => DTB_StripeEmbeddedCheckoutConfig::GATEWAY_ID,
			'contract_version'   => DTB_StripeEmbeddedCheckoutConfig::CONTRACT_VERSION,
			'allowed_countries'  => $configured ? DTB_StripeEmbeddedCheckoutConfig::allowed_countries() : [],
			'dynamic_shipping'   => true,
			'order_authority'    => 'stripe_first_woocommerce_materialized_after_paid_webhook',
		];
	}

	public static function create_session( array $payload ): array|WP_Error {
		if ( ! class_exists( 'DTB_StripeEmbeddedCheckoutConfig' ) || ! DTB_StripeEmbeddedCheckoutConfig::is_runtime_configured() ) {
			return new WP_Error( 'dtb_stripe_embedded_not_configured', 'Stripe Embedded Checkout is not configured.', [ 'status' => 503 ] );
		}
		if ( ! class_exists( 'DTB_CheckoutValidator' ) || ! class_exists( 'DTB_OrderCheckoutSessionRepository' ) ) {
			return new WP_Error( 'dtb_stripe_checkout_dependencies_missing', 'Checkout dependencies are unavailable.', [ 'status' => 503 ] );
		}

		$ready = DTB_CheckoutValidator::ensure_cart();
		if ( is_wp_error( $ready ) ) {
			return $ready;
		}
		$snapshot = DTB_CheckoutValidator::cart_snapshot();
		if ( is_wp_error( $snapshot ) ) {
			return $snapshot;
		}

		$identity        = DTB_CheckoutValidator::customer_identity();
		$idempotency_key = self::idempotency_key( $payload['idempotency_key'] ?? '', (string) $identity['customer_session_hash'] );
		$existing        = DTB_OrderCheckoutSessionRepository::find_by_idempotency_key( $idempotency_key );
		if ( is_array( $existing ) ) {
			$owner = self::assert_owner( $existing );
			if ( is_wp_error( $owner ) ) {
				return $owner;
			}
			$stripe_session_id = (string) ( $existing['context']['stripe_embedded']['stripe_session_id'] ?? '' );
			if ( '' !== $stripe_session_id ) {
				$stripe_session = DTB_StripeApiClient::retrieve_checkout_session( $stripe_session_id );
				if ( is_wp_error( $stripe_session ) ) {
					return $stripe_session;
				}
				return self::session_response( $existing, $stripe_session );
			}
			return new WP_Error( 'dtb_stripe_checkout_idempotency_incomplete', 'This checkout attempt is already being created. Please retry.', [ 'status' => 409 ] );
		}

		$session_id = wp_generate_uuid4();
		$quote_id   = 'stripe_' . wp_generate_uuid4();
		$expires    = gmdate( 'Y-m-d H:i:s', time() + DTB_StripeEmbeddedCheckoutConfig::SESSION_TTL );
		$context    = [
			'customer_note'   => sanitize_textarea_field( (string) ( $payload['customer_note'] ?? '' ) ),
			'stripe_embedded' => [
				'status'            => 'creating',
				'stripe_session_id' => '',
			],
		];
		$fingerprint = DTB_CheckoutValidator::fingerprint( $snapshot, DTB_StripeEmbeddedCheckoutConfig::GATEWAY_ID );

		$inserted = DTB_OrderCheckoutSessionRepository::insert_quote( [
			'session_id'                => $session_id,
			'quote_id'                  => $quote_id,
			'customer_id'               => (int) $identity['customer_id'],
			'woo_session_identifier'    => (string) $identity['customer_session_hash'],
			'cart_hash'                 => (string) $snapshot['cart_hash'],
			'selected_shipping_rate_id' => 'stripe_dynamic_shipping',
			'fingerprint'               => $fingerprint,
			'context'                   => $context,
			'quote'                     => self::stored_snapshot( $snapshot ),
			'expires_at'                => $expires,
		] );
		if ( $inserted <= 0 ) {
			return new WP_Error( 'dtb_stripe_checkout_reservation_failed', 'Could not reserve the Stripe checkout session.', [ 'status' => 503 ] );
		}

		$promoted = DTB_OrderCheckoutSessionRepository::promote_quote( (int) $inserted, [
			'resume_token_hash'         => DTB_OrderCheckoutSessionRepository::token_hash( self::resume_token( $session_id, $idempotency_key ) ),
			'idempotency_key'           => $idempotency_key,
			'customer_id'               => (int) $identity['customer_id'],
			'woo_session_identifier'    => (string) $identity['customer_session_hash'],
			'cart_hash'                 => (string) $snapshot['cart_hash'],
			'quote_version'             => 1,
			'selected_shipping_rate_id' => 'stripe_dynamic_shipping',
			'fingerprint'               => $fingerprint,
			'payment_gateway'           => DTB_StripeEmbeddedCheckoutConfig::GATEWAY_ID,
			'payment_method'            => DTB_StripeEmbeddedCheckoutConfig::GATEWAY_ID,
			'context'                   => $context,
			'quote'                     => self::stored_snapshot( $snapshot ),
			'expires_at'                => $expires,
		], 1 );
		if ( ! $promoted ) {
			return new WP_Error( 'dtb_stripe_checkout_reservation_conflict', 'Stripe checkout reservation is already changing. Please retry.', [ 'status' => 409 ] );
		}

		$row = DTB_OrderCheckoutSessionRepository::find_by_session_id( $session_id );
		if ( ! is_array( $row ) ) {
			return new WP_Error( 'dtb_stripe_checkout_session_missing', 'Stripe checkout reservation could not be loaded.', [ 'status' => 503 ] );
		}

		$stripe_session = DTB_StripeApiClient::create_checkout_session( self::stripe_session_params( $row ), $idempotency_key );
		if ( is_wp_error( $stripe_session ) ) {
			DTB_OrderCheckoutSessionRepository::transition( (int) $row['id'], 'created', 'failed', (int) $row['state_version'], [
				'failure_code'             => $stripe_session->get_error_code(),
				'failure_context_redacted' => 'stripe-session-create-failed',
			] );
			return $stripe_session;
		}

		$context['stripe_embedded'] = [
			'status'            => 'session_created',
			'stripe_session_id' => sanitize_text_field( (string) ( $stripe_session['id'] ?? '' ) ),
		];
		DTB_OrderCheckoutSessionRepository::update_session( (int) $row['id'], [ 'context_json' => wp_json_encode( $context ) ] );
		$row = DTB_OrderCheckoutSessionRepository::find_by_session_id( $session_id ) ?: $row;

		return self::session_response( $row, $stripe_session );
	}

	public static function update_shipping_options( array $payload ): array|WP_Error {
		$stripe_session_id = sanitize_text_field( (string) ( $payload['checkout_session_id'] ?? $payload['stripe_session_id'] ?? '' ) );
		$shipping_details  = is_array( $payload['shipping_details'] ?? null ) ? $payload['shipping_details'] : [];
		if ( '' === $stripe_session_id || empty( $shipping_details['address'] ) || ! is_array( $shipping_details['address'] ) ) {
			return new WP_Error( 'dtb_stripe_shipping_context_required', 'Shipping details are required.', [ 'status' => 400 ] );
		}

		$stripe_session = DTB_StripeApiClient::retrieve_checkout_session( $stripe_session_id );
		if ( is_wp_error( $stripe_session ) ) {
			return $stripe_session;
		}
		$row = self::row_from_stripe_session( $stripe_session );
		if ( is_wp_error( $row ) ) {
			return $row;
		}
		$owner = self::assert_owner( $row );
		if ( is_wp_error( $owner ) ) {
			return $owner;
		}

		$address = self::stripe_address_to_wc( $shipping_details );
		$rates   = DTB_CheckoutValidator::shipping_rates_for_current_cart( $address );
		if ( is_wp_error( $rates ) ) {
			return new WP_Error( $rates->get_error_code(), $rates->get_error_message(), [ 'status' => 422, 'action' => [ 'type' => 'reject', 'errorMessage' => $rates->get_error_message() ] ] );
		}

		$options = [];
		foreach ( array_values( $rates ) as $index => $rate ) {
			$options[ $index ] = [
				'shipping_rate_data' => [
					'display_name'  => (string) $rate['name'],
					'type'          => 'fixed_amount',
					'fixed_amount'  => [
						'amount'   => self::amount_to_minor( (float) $rate['price'], (string) $rate['currency'] ),
						'currency' => strtolower( (string) $rate['currency'] ),
					],
					'metadata'      => [ 'dtb_shipping_rate_id' => (string) $rate['id'] ],
				],
			];
		}

		$updated = DTB_StripeApiClient::update_checkout_session( $stripe_session_id, [
			'shipping_details' => $shipping_details,
			'shipping_options' => $options,
		] );
		if ( is_wp_error( $updated ) ) {
			return $updated;
		}

		return [ 'type' => 'accept' ];
	}

	public static function verify_webhook_signature( string $payload, string $signature_header ): true|WP_Error {
		$secret = DTB_StripeEmbeddedCheckoutConfig::webhook_secret();
		if ( '' === $secret ) {
			return new WP_Error( 'dtb_stripe_webhook_secret_missing', 'Stripe webhook secret is not configured.', [ 'status' => 503 ] );
		}
		$parts = [];
		foreach ( explode( ',', $signature_header ) as $piece ) {
			[ $key, $value ] = array_pad( explode( '=', trim( $piece ), 2 ), 2, '' );
			$parts[ $key ][] = $value;
		}
		$timestamp = (string) ( $parts['t'][0] ?? '' );
		$signatures = (array) ( $parts['v1'] ?? [] );
		if ( '' === $timestamp || empty( $signatures ) || abs( time() - (int) $timestamp ) > 300 ) {
			return new WP_Error( 'dtb_stripe_webhook_signature_invalid', 'Invalid Stripe webhook signature.', [ 'status' => 401 ] );
		}
		$expected = hash_hmac( 'sha256', $timestamp . '.' . $payload, $secret );
		foreach ( $signatures as $signature ) {
			if ( hash_equals( $expected, (string) $signature ) ) {
				return true;
			}
		}
		return new WP_Error( 'dtb_stripe_webhook_signature_invalid', 'Invalid Stripe webhook signature.', [ 'status' => 401 ] );
	}

	public static function handle_webhook_event( array $event ): array|WP_Error {
		$event_id = sanitize_text_field( (string) ( $event['id'] ?? '' ) );
		$type     = sanitize_key( str_replace( '.', '_', (string) ( $event['type'] ?? '' ) ) );
		$object   = is_array( $event['data']['object'] ?? null ) ? $event['data']['object'] : [];
		if ( '' === $event_id || empty( $object['id'] ) ) {
			return new WP_Error( 'dtb_stripe_webhook_invalid_event', 'Invalid Stripe webhook payload.', [ 'status' => 400 ] );
		}

		if ( in_array( $type, [ 'checkout_session_completed', 'checkout_session_async_payment_succeeded' ], true ) ) {
			$stripe_session = DTB_StripeApiClient::retrieve_checkout_session( (string) $object['id'], [ 'line_items', 'payment_intent' ] );
			if ( is_wp_error( $stripe_session ) ) {
				return $stripe_session;
			}
			if ( 'paid' !== (string) ( $stripe_session['payment_status'] ?? '' ) ) {
				return [ 'processed' => false, 'reason' => 'payment_not_paid', 'event_id' => $event_id ];
			}
			$row = self::row_from_stripe_session( $stripe_session );
			if ( is_wp_error( $row ) ) {
				return $row;
			}
			if ( ! class_exists( 'DTB_StripeEmbeddedCheckoutOrderMaterializer' ) ) {
				return new WP_Error( 'dtb_stripe_order_materializer_missing', 'Stripe order materializer is unavailable.', [ 'status' => 503 ] );
			}
			return DTB_StripeEmbeddedCheckoutOrderMaterializer::materialize_paid_session( $row, $stripe_session, $event_id );
		}

		if ( in_array( $type, [ 'checkout_session_expired', 'checkout_session_async_payment_failed' ], true ) ) {
			$row = self::row_from_stripe_session( $object );
			if ( ! is_wp_error( $row ) && ! in_array( (string) $row['state'], [ 'paid', 'failed', 'cancelled', 'expired' ], true ) ) {
				DTB_OrderCheckoutSessionRepository::transition( (int) $row['id'], (string) $row['state'], 'failed', (int) $row['state_version'], [
					'failure_code'             => $type,
					'failure_context_redacted' => 'stripe-checkout-webhook',
				] );
			}
			return [ 'processed' => true, 'event_id' => $event_id, 'type' => $type ];
		}

		return [ 'processed' => false, 'reason' => 'ignored_event', 'event_id' => $event_id, 'type' => $type ];
	}

	private static function stripe_session_params( array $row ): array {
		$quote    = is_array( $row['quote'] ?? null ) ? $row['quote'] : [];
		$currency = DTB_StripeEmbeddedCheckoutConfig::currency();
		$params   = [
			'mode'                         => 'payment',
			'ui_mode'                      => 'embedded',
			'return_url'                   => DTB_StripeEmbeddedCheckoutConfig::return_url(),
			'client_reference_id'          => (string) $row['session_id'],
			'billing_address_collection'   => 'required',
			'phone_number_collection'      => [ 'enabled' => true ],
			'shipping_address_collection'  => [ 'allowed_countries' => DTB_StripeEmbeddedCheckoutConfig::allowed_countries() ],
			'permissions'                  => [ 'update_shipping_details' => 'server_only' ],
			'shipping_options'             => [
				[
					'shipping_rate_data' => [
						'display_name' => 'Shipping calculated after address',
						'type'         => 'fixed_amount',
						'fixed_amount' => [ 'amount' => 0, 'currency' => $currency ],
					],
				],
			],
			'automatic_tax'                => [ 'enabled' => DTB_StripeEmbeddedCheckoutConfig::automatic_tax_enabled() ],
			'allow_promotion_codes'        => DTB_StripeEmbeddedCheckoutConfig::allow_promotion_codes(),
			'metadata'                     => [
				'dtb_checkout_session_id' => (string) $row['session_id'],
				'dtb_cart_hash'           => (string) $row['cart_hash'],
				'dtb_idempotency_key'     => (string) $row['idempotency_key'],
				'dtb_customer_id'         => (string) (int) $row['customer_id'],
				'dtb_contract_version'    => DTB_StripeEmbeddedCheckoutConfig::CONTRACT_VERSION,
			],
			'line_items'                   => self::line_items( $quote, $currency ),
		];
		return (array) apply_filters( 'dtb_stripe_embedded_session_params', $params, $row );
	}

	private static function line_items( array $quote, string $currency ): array {
		$line_items = [];
		foreach ( array_values( (array) ( $quote['items'] ?? [] ) ) as $index => $item ) {
			$quantity = max( 1, absint( $item['quantity'] ?? 1 ) );
			$total    = (float) ( $item['line_total'] ?? 0 );
			$unit     = $quantity > 0 ? $total / $quantity : $total;
			$line_items[ $index ] = [
				'quantity'   => $quantity,
				'price_data' => [
					'currency'     => $currency,
					'unit_amount'  => self::amount_to_minor( $unit, $currency ),
					'product_data' => [
						'name'     => sanitize_text_field( (string) ( $item['name'] ?? 'Drywall Toolbox item' ) ),
						'metadata' => [
							'product_id'   => (string) absint( $item['product_id'] ?? 0 ),
							'variation_id' => (string) absint( $item['variation_id'] ?? 0 ),
							'sku'          => sanitize_text_field( (string) ( $item['sku'] ?? '' ) ),
						],
					],
				],
			];
		}
		return $line_items;
	}

	private static function session_response( array $row, array $stripe_session ): array {
		return [
			'checkout' => [
				'session_id'        => (string) $row['session_id'],
				'state'             => (string) $row['state'],
				'expires_at'        => gmdate( 'c', strtotime( (string) $row['expires_at'] ) ),
				'contract_version'  => DTB_StripeEmbeddedCheckoutConfig::CONTRACT_VERSION,
			],
			'stripe'   => [
				'publishable_key'    => DTB_StripeEmbeddedCheckoutConfig::publishable_key(),
				'client_secret'      => (string) ( $stripe_session['client_secret'] ?? '' ),
				'checkout_session_id'=> (string) ( $stripe_session['id'] ?? '' ),
			],
		];
	}

	private static function row_from_stripe_session( array $stripe_session ): array|WP_Error {
		$metadata = is_array( $stripe_session['metadata'] ?? null ) ? $stripe_session['metadata'] : [];
		$session_id = sanitize_text_field( (string) ( $metadata['dtb_checkout_session_id'] ?? $stripe_session['client_reference_id'] ?? '' ) );
		if ( '' === $session_id ) {
			return new WP_Error( 'dtb_stripe_checkout_session_unbound', 'Stripe checkout session is not linked to a DTB checkout session.', [ 'status' => 409 ] );
		}
		$row = DTB_OrderCheckoutSessionRepository::find_by_session_id( $session_id );
		if ( ! is_array( $row ) ) {
			return new WP_Error( 'dtb_stripe_checkout_session_missing', 'DTB checkout session could not be found.', [ 'status' => 404 ] );
		}
		$expected = (string) ( $row['context']['stripe_embedded']['stripe_session_id'] ?? '' );
		if ( '' !== $expected && ! hash_equals( $expected, (string) ( $stripe_session['id'] ?? '' ) ) ) {
			return new WP_Error( 'dtb_stripe_checkout_session_mismatch', 'Stripe checkout session does not match the DTB checkout session.', [ 'status' => 403 ] );
		}
		return $row;
	}

	private static function assert_owner( array $row ): true|WP_Error {
		$identity = DTB_CheckoutValidator::customer_identity();
		if ( ! hash_equals( (string) ( $row['woo_session_identifier'] ?? '' ), (string) $identity['customer_session_hash'] ) ) {
			return new WP_Error( 'dtb_stripe_checkout_owner_forbidden', 'Checkout session ownership could not be verified.', [ 'status' => 403 ] );
		}
		$row_customer_id      = (int) ( $row['customer_id'] ?? 0 );
		$identity_customer_id = (int) ( $identity['customer_id'] ?? 0 );
		if ( $row_customer_id > 0 && $row_customer_id !== $identity_customer_id ) {
			return new WP_Error( 'dtb_stripe_checkout_owner_forbidden', 'Checkout session ownership could not be verified.', [ 'status' => 403 ] );
		}
		return true;
	}

	private static function stored_snapshot( array $snapshot ): array {
		$snapshot['items'] = array_map( static function ( array $item ): array {
			unset( $item['product'] );
			return $item;
		}, (array) $snapshot['items'] );
		return $snapshot;
	}

	private static function idempotency_key( $provided, string $session_hash ): string {
		$provided = substr( sanitize_text_field( (string) $provided ), 0, 120 );
		if ( '' === $provided ) {
			$provided = 'auto:' . wp_generate_uuid4();
		}
		return 'stripe-embedded:' . hash( 'sha256', $session_hash . ':' . $provided );
	}

	private static function resume_token( string $session_id, string $idempotency_key ): string {
		return hash_hmac( 'sha256', 'dtb-stripe-embedded-checkout-v' . DTB_StripeEmbeddedCheckoutConfig::CONTRACT_VERSION . '|' . $session_id . '|' . $idempotency_key, wp_salt( 'auth' ) );
	}

	private static function stripe_address_to_wc( array $details ): array {
		$address = is_array( $details['address'] ?? null ) ? $details['address'] : [];
		$name    = trim( sanitize_text_field( (string) ( $details['name'] ?? '' ) ) );
		$parts   = preg_split( '/\s+/', $name, 2 ) ?: [];
		return [
			'first_name' => $parts[0] ?? '',
			'last_name'  => $parts[1] ?? '',
			'address_1'  => sanitize_text_field( (string) ( $address['line1'] ?? '' ) ),
			'address_2'  => sanitize_text_field( (string) ( $address['line2'] ?? '' ) ),
			'city'       => sanitize_text_field( (string) ( $address['city'] ?? '' ) ),
			'state'      => sanitize_text_field( (string) ( $address['state'] ?? '' ) ),
			'postcode'   => sanitize_text_field( (string) ( $address['postal_code'] ?? '' ) ),
			'country'    => sanitize_text_field( (string) ( $address['country'] ?? 'US' ) ),
		];
	}

	public static function amount_to_minor( float $amount, string $currency ): int {
		$currency = strtolower( $currency );
		$zero_decimal = [ 'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga', 'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf' ];
		return in_array( $currency, $zero_decimal, true ) ? (int) round( $amount ) : (int) round( $amount * 100 );
	}
}
