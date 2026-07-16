<?php
/**
 * Checkout payment capability detector.
 *
 * Reports whether the current WooCommerce/runtime stack can support an
 * official Checkout Blocks payment experience. This is intentionally
 * conservative: DTB may keep the classic order-pay fallback unless the active
 * gateway stack exposes the WooCommerce Blocks payment infrastructure needed to
 * keep payment fields, wallets, tokenization, callbacks, and lifecycle state
 * owned by WooCommerce/payment providers.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_CheckoutBlocksCapabilityDetector {
	/** Known active payment method ids that commonly provide Checkout Blocks integrations. */
	private const KNOWN_BLOCKS_GATEWAY_IDS = [
		'woocommerce_payments',
		'woopayments',
		'stripe',
		'ppcp-gateway',
		'ppec_paypal',
		'paypal',
		'affirm',
		'klarna_payments',
		'klarna',
	];

	/** Return the current payment architecture capability envelope. */
	public static function detect( array $payment_methods ): array {
		$blocks_package_available = class_exists( '\\Automattic\\WooCommerce\\Blocks\\Package' );
		$payment_registry_class    = class_exists( '\\Automattic\\WooCommerce\\Blocks\\Payments\\PaymentMethodRegistry' );
		$abstract_method_class     = class_exists( '\\Automattic\\WooCommerce\\Blocks\\Payments\\Integrations\\AbstractPaymentMethodType' );
		$assets_api_available      = function_exists( 'wc_get_container' ) && class_exists( '\\Automattic\\WooCommerce\\Blocks\\Assets\\AssetDataRegistry' );

		$methods = [];
		$has_blocks_candidate = false;
		foreach ( $payment_methods as $method ) {
			$id = sanitize_key( (string) ( $method['id'] ?? '' ) );
			if ( '' === $id ) {
				continue;
			}

			$is_manual = ! empty( $method['is_manual'] );
			$is_candidate = ! $is_manual && self::is_known_blocks_candidate( $id );
			$has_blocks_candidate = $has_blocks_candidate || $is_candidate;
			$methods[] = [
				'id'                         => $id,
				'title'                      => sanitize_text_field( (string) ( $method['title'] ?? $id ) ),
				'is_manual'                  => $is_manual,
				'blocks_candidate'           => $is_candidate,
				'classic_order_pay_fallback' => true,
			];
		}

		$server_ready = $blocks_package_available && $payment_registry_class && $abstract_method_class && $assets_api_available;

		return [
			'contract_version'             => '1',
			'primary_flow'                 => 'classic_order_pay_fallback',
			'same_shell_supported'         => false,
			'fallback_order_pay_enabled'   => true,
			'blocks_package_available'     => $blocks_package_available,
			'payment_registry_available'   => $payment_registry_class,
			'abstract_method_available'    => $abstract_method_class,
			'assets_api_available'         => $assets_api_available,
			'server_blocks_ready'          => $server_ready,
			'has_blocks_gateway_candidate' => $has_blocks_candidate,
			'client_registry_required'     => true,
			'client_registry_global'       => 'window.wc.wcBlocksRegistry',
			'methods'                      => $methods,
			'notes'                        => [
				'Official same-shell payment requires WooCommerce Blocks client registration and server-side payment method integration.',
				'DTB keeps /checkout/order-pay as fallback until an eligible gateway is proven through the Blocks registry at runtime.',
			],
		];
	}

	/** Return whether an enabled method id is a known Blocks-capable candidate. */
	private static function is_known_blocks_candidate( string $method_id ): bool {
		$normalized = strtolower( $method_id );
		foreach ( self::KNOWN_BLOCKS_GATEWAY_IDS as $candidate ) {
			if ( $normalized === $candidate || false !== strpos( $normalized, $candidate ) ) {
				return true;
			}
		}
		return false;
	}
}
