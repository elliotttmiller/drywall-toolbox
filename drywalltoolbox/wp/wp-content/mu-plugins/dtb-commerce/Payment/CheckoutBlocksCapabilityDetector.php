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
		$server_ready              = $blocks_package_available && $payment_registry_class && $abstract_method_class && $assets_api_available;
		$registered_methods        = self::registered_blocks_methods();

		$methods = [];
		$has_blocks_candidate = false;
		$has_registered_blocks_method = false;
		foreach ( $payment_methods as $method ) {
			$id = sanitize_key( (string) ( $method['id'] ?? '' ) );
			if ( '' === $id ) {
				continue;
			}

			$is_manual = ! empty( $method['is_manual'] );
			$is_candidate = ! $is_manual && self::is_known_blocks_candidate( $id );
			$registered = self::match_registered_method( $id, $registered_methods );
			$blocks_registered = null !== $registered;
			$has_blocks_candidate = $has_blocks_candidate || $is_candidate;
			$has_registered_blocks_method = $has_registered_blocks_method || $blocks_registered;
			$methods[] = [
				'id'                         => $id,
				'title'                      => sanitize_text_field( (string) ( $method['title'] ?? $id ) ),
				'is_manual'                  => $is_manual,
				'blocks_candidate'           => $is_candidate,
				'blocks_registered'          => $blocks_registered,
				'blocks_active'              => $blocks_registered ? (bool) ( $registered['active'] ?? false ) : false,
				'blocks_script_handles'      => $blocks_registered ? (array) ( $registered['script_handles'] ?? [] ) : [],
				'blocks_data_available'      => $blocks_registered ? (bool) ( $registered['data_available'] ?? false ) : false,
				'classic_order_pay_fallback' => true,
			];
		}

		$server_same_shell_ready = $server_ready && $has_registered_blocks_method;

		/**
		 * Enable the same-shell checkout/payment path only after the production
		 * runtime has been verified with provider-owned Checkout Blocks UI.
		 *
		 * This filter is the explicit release gate. It must not be enabled merely
		 * because WooCommerce Blocks classes exist; gateway fields, wallet sheets,
		 * tokenization, callbacks, and payment lifecycle must remain owned by
		 * WooCommerce/payment providers and must be exercised against the active
		 * production gateway stack first.
		 *
		 * @param bool  $enabled            Whether DTB may activate same-shell payment.
		 * @param array $methods            Publicly normalized active checkout methods.
		 * @param array $registered_methods Normalized registered Blocks integrations.
		 */
		$client_bridge_enabled = (bool) apply_filters( 'dtb_checkout_blocks_same_shell_supported', false, $methods, array_values( $registered_methods ) );
		$same_shell_supported  = $server_same_shell_ready && $client_bridge_enabled;

		return [
			'contract_version'             => '3',
			'primary_flow'                 => $same_shell_supported ? 'official_blocks_same_shell' : ( $server_same_shell_ready ? 'official_blocks_candidate_order_pay_fallback' : 'classic_order_pay_fallback' ),
			'same_shell_supported'         => $same_shell_supported,
			'fallback_order_pay_enabled'   => true,
			'blocks_package_available'     => $blocks_package_available,
			'payment_registry_available'   => $payment_registry_class,
			'abstract_method_available'    => $abstract_method_class,
			'assets_api_available'         => $assets_api_available,
			'server_blocks_ready'          => $server_ready,
			'server_same_shell_ready'      => $server_same_shell_ready,
			'client_bridge_enabled'        => $client_bridge_enabled,
			'has_blocks_gateway_candidate' => $has_blocks_candidate,
			'has_registered_blocks_method' => $has_registered_blocks_method,
			'registered_methods'           => array_values( $registered_methods ),
			'client_registry_required'     => true,
			'client_registry_global'       => 'window.wc.wcBlocksRegistry',
			'client_bridge_required'       => 'dtb_checkout_blocks_bridge',
			'methods'                      => $methods,
			'notes'                        => [
				'Official same-shell payment requires WooCommerce Blocks client registration and server-side payment method integration.',
				'DTB keeps /checkout/order-pay as fallback until an eligible gateway is proven through the Blocks registry at runtime and the DTB client bridge is explicitly enabled.',
			],
		];
	}

	/** Return registered WooCommerce Blocks payment integrations when available. */
	private static function registered_blocks_methods(): array {
		if ( ! function_exists( 'wc_get_container' ) || ! class_exists( '\\Automattic\\WooCommerce\\Blocks\\Payments\\PaymentMethodRegistry' ) ) {
			return [];
		}

		try {
			$registry = wc_get_container()->get( '\\Automattic\\WooCommerce\\Blocks\\Payments\\PaymentMethodRegistry' );
		} catch ( Throwable $exception ) {
			return [];
		}

		$registered = [];
		foreach ( [ 'get_all_registered_payment_methods', 'get_all_registered', 'get_all_active_registered', 'get_registered_payment_methods' ] as $method_name ) {
			if ( is_object( $registry ) && method_exists( $registry, $method_name ) ) {
				$candidate = $registry->{$method_name}();
				if ( is_array( $candidate ) ) {
					$registered = $candidate;
					break;
				}
			}
		}

		$methods = [];
		foreach ( $registered as $key => $integration ) {
			$record = self::normalize_registered_method( $key, $integration );
			if ( null !== $record ) {
				$methods[ $record['id'] ] = $record;
			}
		}
		ksort( $methods );
		return $methods;
	}

	/** Normalize a registered Blocks integration object into a safe public record. */
	private static function normalize_registered_method( $key, $integration ): ?array {
		$name = '';
		if ( is_object( $integration ) && method_exists( $integration, 'get_name' ) ) {
			$name = (string) $integration->get_name();
		} elseif ( is_string( $integration ) ) {
			$name = $integration;
		}
		if ( '' === $name && is_string( $key ) ) {
			$name = $key;
		}
		$id = sanitize_key( $name );
		if ( '' === $id ) {
			return null;
		}

		$active = true;
		if ( is_object( $integration ) && method_exists( $integration, 'is_active' ) ) {
			try {
				$active = (bool) $integration->is_active();
			} catch ( Throwable $exception ) {
				$active = false;
			}
		}

		$script_handles = [];
		if ( is_object( $integration ) && method_exists( $integration, 'get_payment_method_script_handles' ) ) {
			try {
				$script_handles = array_values( array_filter( array_map( 'sanitize_text_field', (array) $integration->get_payment_method_script_handles() ) ) );
			} catch ( Throwable $exception ) {
				$script_handles = [];
			}
		}

		$data_available = false;
		if ( is_object( $integration ) && method_exists( $integration, 'get_payment_method_data' ) ) {
			try {
				$data_available = is_array( $integration->get_payment_method_data() );
			} catch ( Throwable $exception ) {
				$data_available = false;
			}
		}

		return [
			'id'             => $id,
			'active'         => $active,
			'script_handles' => $script_handles,
			'data_available' => $data_available,
		];
	}

	/** Return the matching registered Blocks integration record for a gateway id. */
	private static function match_registered_method( string $method_id, array $registered_methods ): ?array {
		$normalized = strtolower( $method_id );
		foreach ( $registered_methods as $registered ) {
			$registered_id = strtolower( (string) ( $registered['id'] ?? '' ) );
			if ( '' === $registered_id ) {
				continue;
			}
			if ( $registered_id === $normalized || false !== strpos( $registered_id, $normalized ) || false !== strpos( $normalized, $registered_id ) ) {
				return $registered;
			}
		}
		return null;
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
