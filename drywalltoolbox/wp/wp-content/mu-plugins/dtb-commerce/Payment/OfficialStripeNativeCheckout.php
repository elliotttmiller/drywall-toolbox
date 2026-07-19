<?php
/**
 * Official WooCommerce Stripe gateway checkout integration.
 *
 * WooCommerce owns the checkout page, cart/session/customer/address validation,
 * tax, shipping, and order creation. The official WooCommerce Stripe Payment
 * Gateway owns embedded payment methods, eligible express wallets, tokenization,
 * payment processing, challenge flows, and webhook-backed payment status. DTB
 * owns checkout presentation assets, readiness diagnostics, checkout-order
 * tagging, and verified lifecycle observation only.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_OfficialStripeNativeCheckout {
	public const CHECKOUT_GATEWAY = 'woo_native_stripe';
	public const CONTRACT_VERSION = 'woo-stripe-v1';

	private const STRIPE_GATEWAY_ID = 'stripe';
	private const ASSET_VERSION     = '2026.07.19.2';

	public static function register(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_checkout_assets' ], 20 );
		add_filter( 'body_class', [ __CLASS__, 'body_class' ] );
		add_action( 'woocommerce_checkout_create_order', [ __CLASS__, 'tag_checkout_order' ], 20, 2 );
		add_action( 'woocommerce_store_api_checkout_order_processed', [ __CLASS__, 'tag_store_api_order' ], 20 );
		add_action( 'woocommerce_payment_complete', [ __CLASS__, 'mirror_verified_stripe_payment' ], 9 );
		add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'mirror_verified_stripe_payment' ], 9 );
		add_action( 'woocommerce_order_status_completed', [ __CLASS__, 'mirror_verified_stripe_payment' ], 9 );
		add_action( 'admin_notices', [ __CLASS__, 'admin_notices' ] );
	}

	public static function register_rest_routes(): void {
		register_rest_route(
			'dtb/v1',
			'/checkout/capabilities',
			[
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => [ __CLASS__, 'checkout_capabilities' ],
				'permission_callback' => '__return_true',
			]
		);
	}

	public static function checkout_capabilities(): WP_REST_Response {
		$gateways = [];
		foreach ( self::payment_gateways() as $gateway ) {
			if ( ! self::is_official_stripe_gateway_instance( $gateway ) ) {
				continue;
			}

			$id      = sanitize_key( (string) ( $gateway->id ?? '' ) );
			$enabled = isset( $gateway->enabled ) && 'yes' === (string) $gateway->enabled;
			$gateways[] = [
				'id'       => $id,
				'title'    => sanitize_text_field( (string) ( $gateway->method_title ?? $gateway->title ?? 'Stripe' ) ),
				'enabled'  => $enabled,
				'provider' => 'woocommerce_stripe',
				'contract' => self::CONTRACT_VERSION,
			];
		}

		return rest_ensure_response(
			[
				'checkout' => 'woo_native_checkout_block',
				'contract' => self::CONTRACT_VERSION,
				'provider' => 'woocommerce_stripe',
				'gateways' => $gateways,
				'readiness' => [
					'stripe_extension_active' => self::is_official_stripe_extension_active(),
					'stripe_gateway_enabled'  => self::is_official_stripe_gateway_enabled(),
					'checkout_block'          => self::checkout_page_has_supported_content(),
					'https'                   => is_ssl(),
					'competing_woopayments'   => self::is_gateway_enabled( 'woocommerce_payments' ),
				],
			]
		);
	}

	public static function enqueue_checkout_assets(): void {
		if ( ! self::is_primary_checkout_request() ) {
			return;
		}

		wp_enqueue_style(
			'dtb-woo-native-checkout',
			content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout.css' ),
			[],
			self::ASSET_VERSION
		);
	}

	public static function body_class( array $classes ): array {
		if ( self::is_primary_checkout_request() ) {
			$classes[] = 'dtb-woo-native-checkout';
			$classes[] = 'dtb-official-stripe-checkout';
			$classes[] = 'dtb-checkout-native-page';
		}
		return $classes;
	}

	public static function tag_checkout_order( WC_Order $order, array $data = [] ): void {
		self::tag_order( $order, 'woocommerce_checkout' );
	}

	public static function tag_store_api_order( $order ): void {
		if ( $order instanceof WC_Order ) {
			self::tag_order( $order, 'woocommerce_store_api_checkout' );
		}
	}

	/**
	 * Mirror only non-secret identifiers after WooCommerce has entered a paid
	 * lifecycle hook and the selected gateway instance is owned by the official
	 * WooCommerce Stripe extension.
	 */
	public static function mirror_verified_stripe_payment( $order_id ): void {
		$order = wc_get_order( (int) $order_id );
		if ( ! $order instanceof WC_Order || ! self::is_official_stripe_order( $order ) ) {
			return;
		}

		$reference = self::gateway_reference( $order );
		if ( '' === $reference ) {
			return;
		}

		$order->update_meta_data( '_dtb_payment_provider', 'woocommerce_stripe' );
		$order->update_meta_data( '_dtb_payment_ref', $reference );
		$order->update_meta_data( '_dtb_payment_captured', null !== $order->get_date_paid() ? '1' : '0' );
		$order->update_meta_data( '_dtb_payment_lifecycle_source', 'woocommerce_stripe_lifecycle' );
		$order->save_meta_data();
	}

	public static function admin_notices(): void {
		if ( ! is_admin() || ! current_user_can( 'manage_woocommerce' ) || ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		if ( ! self::is_official_stripe_extension_active() ) {
			echo '<div class="notice notice-error"><p>'
				. esc_html__( 'Drywall Toolbox checkout requires the official WooCommerce Stripe Payment Gateway plugin. Install and activate the WooCommerce-maintained Stripe extension before testing payments.', 'drywall-toolbox' )
				. '</p></div>';
		} elseif ( ! self::is_official_stripe_gateway_enabled() ) {
			echo '<div class="notice notice-warning"><p>'
				. esc_html__( 'Drywall Toolbox checkout is configured for WooCommerce Checkout + the official WooCommerce Stripe Payment Gateway. Connect and enable Stripe before accepting payments.', 'drywall-toolbox' )
				. '</p></div>';
		}

		if ( ! is_ssl() ) {
			echo '<div class="notice notice-error"><p>'
				. esc_html__( 'Drywall Toolbox checkout requires HTTPS. Stripe payment fields and express wallets must not be enabled on an insecure checkout origin.', 'drywall-toolbox' )
				. '</p></div>';
		}

		if ( self::is_gateway_enabled( 'woocommerce_payments' ) ) {
			echo '<div class="notice notice-warning"><p>'
				. esc_html__( 'Drywall Toolbox checkout should have one active storefront card/wallet authority. Disable WooPayments when the official WooCommerce Stripe gateway is active.', 'drywall-toolbox' )
				. '</p></div>';
		}

		if ( ! self::checkout_page_has_supported_content() ) {
			echo '<div class="notice notice-error"><p>'
				. esc_html__( 'Drywall Toolbox checkout requires the assigned WooCommerce Checkout page to contain the WooCommerce Checkout Block. Add the block before testing payments.', 'drywall-toolbox' )
				. '</p></div>';
		}
	}

	/**
	 * Determine whether a payment gateway ID currently belongs to an instance
	 * loaded from the official WooCommerce Stripe extension.
	 *
	 * This deliberately avoids treating every `stripe_*` ID as official because
	 * third-party Stripe plugins use overlapping ID prefixes.
	 */
	public static function is_official_gateway_id( string $gateway_id ): bool {
		$gateway_id = sanitize_key( $gateway_id );
		if ( '' === $gateway_id || ! self::is_official_stripe_extension_active() ) {
			return false;
		}

		$gateway = self::payment_gateways()[ $gateway_id ] ?? null;
		return self::is_official_stripe_gateway_instance( $gateway );
	}

	private static function is_primary_checkout_request(): bool {
		if ( is_admin() || ! function_exists( 'is_checkout' ) || ! is_checkout() ) {
			return false;
		}
		if ( function_exists( 'is_wc_endpoint_url' ) && ( is_wc_endpoint_url( 'order-pay' ) || is_wc_endpoint_url( 'order-received' ) ) ) {
			return false;
		}
		return true;
	}

	private static function checkout_page_has_supported_content(): bool {
		$checkout_page_id = function_exists( 'wc_get_page_id' ) ? (int) wc_get_page_id( 'checkout' ) : 0;
		if ( $checkout_page_id <= 0 ) {
			return false;
		}

		$content = (string) get_post_field( 'post_content', $checkout_page_id );
		return has_block( 'woocommerce/checkout', $content );
	}

	private static function tag_order( WC_Order $order, string $source ): void {
		$order->update_meta_data( '_dtb_checkout_gateway', self::CHECKOUT_GATEWAY );
		$order->update_meta_data( '_dtb_checkout_contract_version', self::CONTRACT_VERSION );
		if ( '' === (string) $order->get_meta( '_dtb_checkout_source', true ) ) {
			$order->update_meta_data( '_dtb_checkout_source', sanitize_key( $source ) );
		}
		$order->update_meta_data( '_dtb_order_type', 'product' );
		if ( function_exists( 'dtb_detect_storefront_base_path' ) ) {
			$order->update_meta_data( '_dtb_storefront_base_path', dtb_detect_storefront_base_path() );
		}
	}

	private static function is_official_stripe_order( WC_Order $order ): bool {
		return self::is_official_gateway_id( (string) $order->get_payment_method() );
	}

	private static function gateway_reference( WC_Order $order ): string {
		$transaction_id = trim( (string) $order->get_transaction_id() );
		if ( '' !== $transaction_id ) {
			return sanitize_text_field( $transaction_id );
		}

		foreach ( [ '_stripe_intent_id', '_stripe_charge_id', '_payment_intent_id' ] as $meta_key ) {
			$value = trim( (string) $order->get_meta( $meta_key, true ) );
			if ( '' !== $value ) {
				return sanitize_text_field( $value );
			}
		}
		return '';
	}

	private static function payment_gateways(): array {
		if ( ! function_exists( 'WC' ) || ! WC() || ! WC()->payment_gateways() ) {
			return [];
		}
		$gateways = WC()->payment_gateways()->payment_gateways();
		return is_array( $gateways ) ? $gateways : [];
	}

	private static function is_official_stripe_extension_active(): bool {
		return defined( 'WC_STRIPE_VERSION' ) || defined( 'WC_STRIPE_PLUGIN_PATH' );
	}

	private static function is_official_stripe_gateway_enabled(): bool {
		foreach ( self::payment_gateways() as $gateway ) {
			if ( self::is_official_stripe_gateway_instance( $gateway ) && isset( $gateway->enabled ) && 'yes' === (string) $gateway->enabled ) {
				return true;
			}
		}
		return false;
	}

	private static function is_gateway_enabled( string $gateway_id ): bool {
		$gateways = self::payment_gateways();
		$gateway  = $gateways[ sanitize_key( $gateway_id ) ] ?? null;
		return is_object( $gateway ) && isset( $gateway->enabled ) && 'yes' === (string) $gateway->enabled;
	}

	private static function is_official_stripe_gateway_instance( $gateway ): bool {
		if ( ! is_object( $gateway ) || ! self::is_official_stripe_extension_active() ) {
			return false;
		}

		$id = sanitize_key( (string) ( $gateway->id ?? '' ) );
		if ( '' === $id || ( self::STRIPE_GATEWAY_ID !== $id && ! str_starts_with( $id, self::STRIPE_GATEWAY_ID . '_' ) ) ) {
			return false;
		}

		try {
			$reflection = new ReflectionClass( $gateway );
			$file       = wp_normalize_path( (string) $reflection->getFileName() );
		} catch ( ReflectionException $e ) {
			return false;
		}

		if ( '' === $file ) {
			return false;
		}

		if ( defined( 'WC_STRIPE_PLUGIN_PATH' ) ) {
			$plugin_path = trailingslashit( wp_normalize_path( (string) WC_STRIPE_PLUGIN_PATH ) );
			if ( '' !== $plugin_path && str_starts_with( $file, $plugin_path ) ) {
				return true;
			}
		}

		return false !== strpos( $file, '/woocommerce-gateway-stripe/' );
	}
}

DTB_OfficialStripeNativeCheckout::register();
