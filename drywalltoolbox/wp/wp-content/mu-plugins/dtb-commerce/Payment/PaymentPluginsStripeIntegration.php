<?php
/**
 * DTB integration contract for Payment Plugins for Stripe WooCommerce.
 *
 * Payment Plugins owns Stripe credentials, webhooks, payment fields, wallets,
 * PaymentIntents, Stripe API calls, refunds, disputes, and WooCommerce payment
 * completion. DTB only declares capability, applies supported Stripe Elements
 * appearance options, attaches non-secret correlation metadata, and mirrors
 * verified WooCommerce payment references onto DTB checkout metadata.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_PaymentPluginsStripeIntegration {
	private const PROVIDER = 'payment_plugins_stripe';

	/** @var string[] */
	private const GATEWAY_IDS = [
		'stripe',
		'stripe_cc',
		'stripe_upm',
		'stripe_applepay',
		'stripe_googlepay',
		'stripe_link_checkout',
		'stripe_payment_request',
		'stripe_affirm',
		'stripe_afterpay',
		'stripe_klarna',
		'stripe_ach',
	];

	/** @var string[] */
	private const REFERENCE_META_KEYS = [
		'_payment_intent_id',
		'_stripe_intent_id',
		'_stripe_charge_id',
		'_stripe_source_id',
	];

	public static function register(): void {
		add_filter( 'dtb_checkout_blocks_same_shell_supported', [ __CLASS__, 'same_shell_supported' ], 20, 3 );
		add_filter( 'wc_stripe_get_element_options', [ __CLASS__, 'stripe_element_options' ], 20, 2 );
		add_filter( 'wc_stripe_order_meta_data', [ __CLASS__, 'order_metadata' ], 20, 2 );
		add_filter( 'wc_stripe_payment_intent_args', [ __CLASS__, 'payment_intent_metadata' ], 20, 3 );
		add_action( 'woocommerce_payment_complete', [ __CLASS__, 'sync_paid_order_meta' ], 15, 1 );
		add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'sync_paid_order_meta' ], 15, 1 );
		add_action( 'woocommerce_order_status_completed', [ __CLASS__, 'sync_paid_order_meta' ], 15, 1 );
		add_action( 'wc_stripe_order_payment_complete', [ __CLASS__, 'sync_completed_charge' ], 20, 2 );
		add_action( 'wc_stripe_webhook_payment_intent_succeeded', [ __CLASS__, 'sync_webhook_payment_intent' ], 20, 3 );
	}

	public static function same_shell_supported( bool $enabled, array $methods, array $registered_methods ): bool {
		if ( $enabled ) {
			return true;
		}

		foreach ( $methods as $method ) {
			$id = sanitize_key( (string) ( $method['id'] ?? '' ) );
			if ( ! self::is_gateway_id( $id ) || ! empty( $method['is_manual'] ) ) {
				continue;
			}
			if ( ! empty( $method['blocks_registered'] ) && ! empty( $method['blocks_active'] ) ) {
				return true;
			}
		}

		foreach ( $registered_methods as $method ) {
			$id = sanitize_key( (string) ( $method['id'] ?? '' ) );
			if ( self::is_gateway_id( $id ) && ! empty( $method['active'] ) ) {
				return true;
			}
		}

		return false;
	}

	public static function stripe_element_options( array $options, $gateway ): array {
		$gateway_id = self::gateway_id( $gateway );
		if ( ! self::is_gateway_id( $gateway_id ) ) {
			return $options;
		}

		$appearance = is_array( $options['appearance'] ?? null ) ? $options['appearance'] : [];
		$variables  = is_array( $appearance['variables'] ?? null ) ? $appearance['variables'] : [];
		$rules      = is_array( $appearance['rules'] ?? null ) ? $appearance['rules'] : [];

		$options['appearance'] = [
			'theme'     => (string) ( $appearance['theme'] ?? 'stripe' ),
			'variables' => array_merge( $variables, [
				'fontFamily'           => 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
				'fontSizeBase'         => '16px',
				'fontWeightNormal'     => '500',
				'fontWeightMedium'     => '700',
				'colorPrimary'         => '#2563eb',
				'colorText'            => '#0f172a',
				'colorTextSecondary'   => '#64748b',
				'colorTextPlaceholder' => '#94a3b8',
				'colorBackground'      => '#ffffff',
				'colorDanger'          => '#dc2626',
				'colorSuccess'         => '#16a34a',
				'borderRadius'         => '14px',
				'spacingUnit'          => '6px',
			] ),
			'rules'     => array_merge( $rules, [
				'.Input'       => [
					'border'          => '1px solid #d8e1f0',
					'boxShadow'       => '0 1px 2px rgba(15, 23, 42, 0.05)',
					'padding'         => '14px 15px',
					'backgroundColor' => '#ffffff',
				],
				'.Input:focus' => [
					'borderColor' => '#2563eb',
					'boxShadow'   => '0 0 0 3px rgba(37, 99, 235, 0.14)',
				],
				'.Label'       => [
					'fontSize'     => '13px',
					'fontWeight'   => '700',
					'color'        => '#475569',
					'marginBottom' => '7px',
				],
				'.Tab'         => [
					'border'       => '1px solid #d8e1f0',
					'borderRadius' => '14px',
				],
				'.Tab:focus'   => [
					'borderColor' => '#2563eb',
					'boxShadow'   => '0 0 0 3px rgba(37, 99, 235, 0.14)',
				],
			] ),
		];

		return $options;
	}

	public static function order_metadata( array $metadata, $order ): array {
		if ( ! $order instanceof WC_Order || ! self::is_dtb_stripe_order( $order ) ) {
			return $metadata;
		}

		return array_merge( $metadata, self::safe_correlation_metadata( $order ) );
	}

	public static function payment_intent_metadata( array $args, $order, $payment = null ): array {
		if ( ! $order instanceof WC_Order || ! self::is_dtb_stripe_order( $order ) ) {
			return $args;
		}

		$metadata         = is_array( $args['metadata'] ?? null ) ? $args['metadata'] : [];
		$args['metadata'] = array_merge( $metadata, self::safe_correlation_metadata( $order ) );

		return $args;
	}

	public static function sync_completed_charge( $charge, $order ): void {
		if ( $order instanceof WC_Order ) {
			self::sync_paid_order_meta( (int) $order->get_id() );
		}
	}

	public static function sync_webhook_payment_intent( $intent, $request = null, $event = null ): void {
		$order_id = self::metadata_order_id( $intent );
		if ( $order_id > 0 ) {
			self::sync_paid_order_meta( $order_id );
			return;
		}

		if ( class_exists( 'DTB_PaymentProviderRuntimeGuards' ) && self::is_dtb_metadata_object( $intent ) ) {
			DTB_PaymentProviderRuntimeGuards::record_warning(
				'dtb_stripe_webhook_order_unresolved',
				'A DTB Stripe PaymentIntent webhook could not be resolved to a WooCommerce order from provider metadata.',
				[ 'intent_id' => self::object_id( $intent ) ]
			);
		}
	}

	public static function sync_paid_order_meta( $order_id ): void {
		$order = function_exists( 'wc_get_order' ) ? wc_get_order( absint( $order_id ) ) : null;
		if ( ! $order instanceof WC_Order || ! self::is_dtb_stripe_order( $order ) ) {
			return;
		}

		$reference = self::payment_reference( $order );
		if ( '' === $reference || null === $order->get_date_paid() ) {
			return;
		}

		$order->update_meta_data( '_dtb_payment_provider', self::PROVIDER );
		$order->update_meta_data( '_dtb_payment_ref', $reference );
		$order->update_meta_data( '_dtb_payment_captured', '1' );
		$order->update_meta_data( '_dtb_payment_verified_at', gmdate( 'c' ) );
		$order->delete_meta_data( '_dtb_payment_handoff_pending' );
		$order->save_meta_data();
	}

	private static function safe_correlation_metadata( WC_Order $order ): array {
		$order_id = (string) (int) $order->get_id();

		return [
			'dtb_order_id'             => $order_id,
			'dtb_wc_order_id'          => $order_id,
			'wc_order_id'              => $order_id,
			'dtb_checkout_session_id'  => substr( sanitize_text_field( (string) $order->get_meta( '_dtb_checkout_session_id', true ) ), 0, 255 ),
			'dtb_idempotency_key'      => substr( sanitize_text_field( (string) $order->get_meta( '_dtb_checkout_idempotency_key', true ) ), 0, 255 ),
			'dtb_order_type'           => substr( sanitize_key( (string) $order->get_meta( '_dtb_order_type', true ) ), 0, 64 ),
			'dtb_payment_provider'     => self::PROVIDER,
			'dtb_created_via'          => 'dtb_checkout',
		];
	}

	private static function metadata_order_id( $object ): int {
		$metadata = null;
		if ( is_object( $object ) && isset( $object->metadata ) ) {
			$metadata = $object->metadata;
		} elseif ( is_array( $object ) && isset( $object['metadata'] ) ) {
			$metadata = $object['metadata'];
		}

		foreach ( [ 'dtb_order_id', 'dtb_wc_order_id', 'wc_order_id', 'order_id' ] as $key ) {
			if ( is_object( $metadata ) && isset( $metadata->{$key} ) ) {
				return absint( $metadata->{$key} );
			}
			if ( is_array( $metadata ) && isset( $metadata[ $key ] ) ) {
				return absint( $metadata[ $key ] );
			}
		}

		return 0;
	}

	private static function is_dtb_stripe_order( WC_Order $order ): bool {
		if ( function_exists( 'dtb_checkout_handoff_is_order' ) && ! dtb_checkout_handoff_is_order( $order ) ) {
			return false;
		}
		return self::is_gateway_id( sanitize_key( (string) $order->get_payment_method() ) );
	}

	private static function payment_reference( WC_Order $order ): string {
		$transaction_id = trim( (string) $order->get_transaction_id() );
		if ( '' !== $transaction_id ) {
			return sanitize_text_field( $transaction_id );
		}

		foreach ( self::REFERENCE_META_KEYS as $meta_key ) {
			$value = trim( (string) $order->get_meta( $meta_key, true ) );
			if ( '' !== $value ) {
				return sanitize_text_field( $value );
			}
		}

		return '';
	}

	private static function is_dtb_metadata_object( $object ): bool {
		$metadata = null;
		if ( is_object( $object ) && isset( $object->metadata ) ) {
			$metadata = $object->metadata;
		} elseif ( is_array( $object ) && isset( $object['metadata'] ) ) {
			$metadata = $object['metadata'];
		}

		if ( is_object( $metadata ) ) {
			return (string) ( $metadata->dtb_created_via ?? '' ) === 'dtb_checkout';
		}
		return is_array( $metadata ) && (string) ( $metadata['dtb_created_via'] ?? '' ) === 'dtb_checkout';
	}

	private static function object_id( $object ): string {
		if ( is_object( $object ) && isset( $object->id ) ) {
			return sanitize_text_field( (string) $object->id );
		}
		if ( is_array( $object ) && isset( $object['id'] ) ) {
			return sanitize_text_field( (string) $object['id'] );
		}
		return '';
	}

	private static function gateway_id( $gateway ): string {
		return is_object( $gateway ) && isset( $gateway->id ) ? sanitize_key( (string) $gateway->id ) : '';
	}

	private static function is_gateway_id( string $gateway_id ): bool {
		return '' !== $gateway_id && ( in_array( $gateway_id, self::GATEWAY_IDS, true ) || str_starts_with( $gateway_id, 'stripe_' ) );
	}
}

DTB_PaymentPluginsStripeIntegration::register();
