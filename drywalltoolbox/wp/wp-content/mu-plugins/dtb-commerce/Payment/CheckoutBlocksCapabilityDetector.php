<?php
/**
 * Checkout payment capability detector.
 *
 * Reports whether the current WooCommerce runtime can support DTB's signed,
 * same-origin payment surface. The surface renders the native WooCommerce
 * Checkout Block document so the configured payment provider stays inside its supported
 * context; DTB does not clone registered Blocks nodes into the React SPA.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_CheckoutBlocksCapabilityDetector {
	/** Known active payment method ids that commonly provide Checkout Blocks integrations. */
	private const KNOWN_BLOCKS_GATEWAY_IDS = [
		'stripe',
		'stripe_cc',
		'stripe_upm',
		'stripe_applepay',
		'stripe_googlepay',
		'stripe_link_checkout',
		'stripe_affirm',
		'stripe_klarna',
		'stripe_afterpay',
	];

	/** Gateway ids that DTB can route through the native payment surface. */
	private const SURFACE_PROVIDER_GATEWAY_IDS = [
		'stripe',
		'stripe_cc',
		'stripe_upm',
		'stripe_applepay',
		'stripe_googlepay',
		'stripe_link_checkout',
	];

	/** Return the current payment architecture capability envelope. */
	public static function detect( array $payment_methods ): array {
		$blocks_package_available = class_exists( '\Automattic\WooCommerce\Blocks\Package' );
		$payment_registry_class    = class_exists( '\Automattic\WooCommerce\Blocks\Payments\PaymentMethodRegistry' );
		$abstract_method_class     = class_exists( '\Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType' );
		$assets_api_available      = function_exists( 'wc_get_container' ) && class_exists( '\Automattic\WooCommerce\Blocks\Assets\AssetDataRegistry' );
		$server_ready              = $blocks_package_available && $payment_registry_class && $abstract_method_class && $assets_api_available;
		$payment_surface_supported = class_exists( 'DTB_CheckoutPaymentSurface' ) && DTB_CheckoutPaymentSurface::surface_available();
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
				'classic_order_pay_fallback' => false,
			];
		}

		$provider_diagnostics = class_exists( 'DTB_PaymentProviderRuntimeGuards' )
			? DTB_PaymentProviderRuntimeGuards::provider_diagnostics( $methods, array_values( $registered_methods ) )
			: [];
		$provider_runtime_ready = empty( $provider_diagnostics ) || ! empty( $provider_diagnostics['provider_runtime_ready'] );
		$server_same_shell_ready   = $server_ready && $payment_surface_supported && $has_registered_blocks_method;
		$provider_same_shell_ready = $server_same_shell_ready && self::has_surface_provider_method( $methods );

		/**
		 * Enable DTB's same-page checkout payment surface only after the native
		 * WooCommerce Checkout Block route, provider Blocks integrations, and live
		 * provider runtime diagnostics are ready.
		 *
		 * @param bool  $enabled            Whether DTB may activate the payment surface.
		 * @param array $methods            Publicly normalized active checkout methods.
		 * @param array $registered_methods Normalized registered Blocks integrations.
		 */
		$client_bridge_enabled = (bool) apply_filters( 'dtb_checkout_blocks_same_shell_supported', $provider_same_shell_ready && $provider_runtime_ready, $methods, array_values( $registered_methods ) );
		$same_shell_supported  = $server_same_shell_ready && $provider_same_shell_ready && $provider_runtime_ready && $client_bridge_enabled;

		return [
			'contract_version'             => '4',
			'primary_flow'                 => $same_shell_supported ? 'native_checkout_block_payment_surface' : ( $server_same_shell_ready ? 'native_payment_surface_candidate' : 'payment_surface_unavailable' ),
			'same_shell_supported'         => $same_shell_supported,
			'fallback_order_pay_enabled'   => false,
			'order_pay_blocks_native'      => false,
			'order_pay_role'               => 'legacy_provider_fallback_only_not_dtb_primary_flow',
			'payment_surface_supported'    => $payment_surface_supported,
			'blocks_package_available'     => $blocks_package_available,
			'payment_registry_available'   => $payment_registry_class,
			'abstract_method_available'    => $abstract_method_class,
			'assets_api_available'         => $assets_api_available,
			'server_blocks_ready'          => $server_ready,
			'server_same_shell_ready'      => $server_same_shell_ready,
			'provider_same_shell_ready'    => $provider_same_shell_ready,
			'provider_runtime_ready'       => $provider_runtime_ready,
			'client_bridge_enabled'        => $client_bridge_enabled,
			'has_blocks_gateway_candidate' => $has_blocks_candidate,
			'has_registered_blocks_method' => $has_registered_blocks_method,
			'gateway_availability_source'  => 'woocommerce_available_payment_gateways',
			'registered_methods'           => array_values( $registered_methods ),
			'provider_diagnostics'         => $provider_diagnostics,
			'client_registry_required'     => false,
			'client_registry_global'       => '',
			'client_bridge_required'       => 'dtb_checkout_payment_surface_frame',
			'client_provider_adapter'      => '',
			'methods'                      => $methods,
			'notes'                        => [
				'DTB same-page payment uses a signed same-origin WordPress payment surface, not cloned provider Blocks nodes in React.',
				'Gateway controls, wallet sheets, tokenization, and payment execution remain inside the native WooCommerce Checkout Block document.',
				'Payment readiness is derived from live WooCommerce gateway availability, provider Blocks registration, and current-mode webhook diagnostics.',
			],
		];
	}

	/** Return registered WooCommerce Blocks payment integrations when available. */
	private static function registered_blocks_methods(): array {
		if ( ! function_exists( 'wc_get_container' ) || ! class_exists( '\Automattic\WooCommerce\Blocks\Payments\PaymentMethodRegistry' ) ) {
			return [];
		}

		try {
			$registry = wc_get_container()->get( '\Automattic\WooCommerce\Blocks\Payments\PaymentMethodRegistry' );
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
		if ( str_starts_with( $normalized, 'stripe_' ) ) {
			return true;
		}
		foreach ( self::KNOWN_BLOCKS_GATEWAY_IDS as $candidate ) {
			if ( $normalized === $candidate || false !== strpos( $normalized, $candidate ) ) {
				return true;
			}
		}
		return false;
	}

	/** Return whether an active registered surface provider method is present. */
	private static function has_surface_provider_method( array $methods ): bool {
		foreach ( $methods as $method ) {
			$id = strtolower( (string) ( $method['id'] ?? '' ) );
			if ( '' === $id || ( ! in_array( $id, self::SURFACE_PROVIDER_GATEWAY_IDS, true ) && ! str_starts_with( $id, 'stripe_' ) ) ) {
				continue;
			}
			if ( ! empty( $method['is_manual'] ) ) {
				continue;
			}
			if ( ! empty( $method['blocks_registered'] ) && ! empty( $method['blocks_active'] ) ) {
				return true;
			}
		}
		return false;
	}
}
