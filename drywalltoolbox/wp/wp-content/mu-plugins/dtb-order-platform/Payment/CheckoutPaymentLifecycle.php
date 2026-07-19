<?php

defined( 'ABSPATH' ) || exit;

final class DTB_CheckoutPaymentLifecycle {
	public static function register(): void {
		add_action( 'woocommerce_payment_complete', [ __CLASS__, 'complete' ], 20 );
		add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'processing' ], 20 );
		add_action( 'woocommerce_order_status_completed', [ __CLASS__, 'completed' ], 20 );
		add_action( 'woocommerce_order_status_failed', [ __CLASS__, 'failed' ], 20 );
		add_action( 'woocommerce_order_status_cancelled', [ __CLASS__, 'cancelled' ], 20 );
		add_action( 'woocommerce_order_status_refunded', [ __CLASS__, 'refunded' ], 20 );
	}

	public static function complete( $order_id ): void {
		$order = wc_get_order( (int) $order_id );
		if ( ! $order instanceof WC_Order || ! self::is_verified( $order ) ) {
			return;
		}
		self::record( $order, 'payment_completed' );
	}

	public static function processing( $order_id ): void {
		$order = wc_get_order( (int) $order_id );
		if ( ! $order instanceof WC_Order || ! self::is_verified( $order ) ) {
			return;
		}
		// Processing is observed only after the captured-payment gate passes. Do not
		// call this "authorized"; authorization-only Stripe orders are not fulfillable.
		self::record( $order, 'payment_confirmed' );
	}

	public static function completed( $order_id ): void {
		$order = wc_get_order( (int) $order_id );
		if ( ! $order instanceof WC_Order || ! self::is_verified( $order ) ) {
			return;
		}
		self::record( $order, 'payment_completed' );
	}

	public static function failed( $order_id ): void {
		$order = wc_get_order( (int) $order_id );
		if ( $order instanceof WC_Order && self::is_dtb_checkout_order( $order ) ) {
			self::record( $order, 'payment_failed' );
		}
	}

	public static function cancelled( $order_id ): void {
		$order = wc_get_order( (int) $order_id );
		if ( $order instanceof WC_Order && self::is_dtb_checkout_order( $order ) ) {
			self::record( $order, 'payment_cancelled' );
		}
	}

	public static function refunded( $order_id ): void {
		$order = wc_get_order( (int) $order_id );
		if ( $order instanceof WC_Order && self::is_dtb_checkout_order( $order ) ) {
			self::record( $order, 'payment_refunded' );
		}
	}

	private static function is_verified( WC_Order $order ): bool {
		return function_exists( 'dtb_checkout_handoff_has_captured_payment' )
			&& dtb_checkout_handoff_has_captured_payment( $order );
	}

	private static function is_dtb_checkout_order( WC_Order $order ): bool {
		return function_exists( 'dtb_checkout_handoff_is_order' )
			&& dtb_checkout_handoff_is_order( $order );
	}

	private static function record( WC_Order $order, string $event ): void {
		if ( ! self::is_dtb_checkout_order( $order ) ) {
			return;
		}

		$event_key = 'payment-lifecycle:' . $event . ':' . (int) $order->get_id();
		if ( function_exists( 'dtb_order_append_event' ) ) {
			dtb_order_append_event(
				(int) $order->get_id(),
				$event,
				[
					'source'          => 'woocommerce-payment-lifecycle',
					'actor_type'      => 'system',
					'visibility'      => 'internal',
					'idempotency_key' => $event_key,
					'payload'         => [
						'gateway'            => sanitize_key( (string) $order->get_payment_method() ),
						'provider'           => sanitize_key( (string) $order->get_meta( '_dtb_payment_provider', true ) ),
						'provider_reference' => sanitize_text_field( (string) $order->get_meta( '_dtb_payment_ref', true ) ),
						'event_timestamp'    => gmdate( 'c' ),
					],
				]
			);
		}

		if ( in_array( $event, [ 'payment_completed', 'payment_confirmed' ], true ) ) {
			if ( function_exists( 'dtb_order_dispatch_processing_jobs' ) ) {
				dtb_order_dispatch_processing_jobs( (int) $order->get_id() );
			}
			$order->delete_meta_data( '_dtb_payment_handoff_pending' );
			$order->save_meta_data();
		}
	}
}

DTB_CheckoutPaymentLifecycle::register();
