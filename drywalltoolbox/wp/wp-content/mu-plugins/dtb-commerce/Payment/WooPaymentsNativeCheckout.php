<?php
/**
 * WooPayments-native checkout integration.
 *
 * WooCommerce owns the checkout page, cart/session/customer/address validation,
 * tax, shipping, and order creation. WooPayments owns embedded payment methods,
 * tokenization, payment processing, challenge flows, and webhook-backed payment
 * status. DTB owns checkout presentation assets, readiness diagnostics,
 * checkout-order tagging, and verified lifecycle observation only.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_WooPaymentsNativeCheckout {
	public const CHECKOUT_GATEWAY = 'woo_native_woopayments';
	public const CONTRACT_VERSION = 'woo-payments-v1';

	private const WOOPAYMENTS_GATEWAY_ID = 'woocommerce_payments';
	private const ASSET_VERSION          = '2026.07.18.4';

	public static function register(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_rest_routes' ] );
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_checkout_assets' ], 20 );
		add_filter( 'body_class', [ __CLASS__, 'body_class' ] );
		add_action( 'woocommerce_checkout_create_order', [ __CLASS__, 'tag_checkout_order' ], 20, 2 );
		add_action( 'woocommerce_store_api_checkout_order_processed', [ __CLASS__, 'tag_store_api_order' ], 20 );
		add_action( 'woocommerce_payment_complete', [ __CLASS__, 'mirror_verified_woopayments_payment' ], 9 );
		add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'mirror_verified_woopayments_payment' ], 9 );
		add_action( 'woocommerce_order_status_completed', [ __CLASS__, 'mirror_verified_woopayments_payment' ], 9 );
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
			$id = sanitize_key( (string) ( $gateway->id ?? '' ) );
			if ( self::WOOPAYMENTS_GATEWAY_ID !== $id ) {
				continue;
			}
			$enabled    = isset( $gateway->enabled ) && 'yes' === (string) $gateway->enabled;
			$gateways[] = [
				'id'              => $id,
				'title'           => sanitize_text_field( (string) ( $gateway->method_title ?? $gateway->title ?? 'WooPayments' ) ),
				'enabled'         => $enabled,
				'provider'        => 'woopayments',
				'contract'        => self::CONTRACT_VERSION,
				'payment_methods' => [
					[
						'id'       => $id,
						'title'    => sanitize_text_field( (string) ( $gateway->title ?? 'WooPayments' ) ),
						'enabled'  => $enabled,
						'provider' => 'woopayments',
					],
				],
			];
		}

		return rest_ensure_response(
			[
				'checkout' => 'woo_native_checkout_block',
				'contract' => self::CONTRACT_VERSION,
				'provider' => 'woopayments',
				'gateways' => $gateways,
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
			$classes[] = 'dtb-woopayments-checkout';
			$classes[] = 'dtb-checkout-embedded-flow';
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

	public static function mirror_verified_woopayments_payment( $order_id ): void {
		$order = wc_get_order( (int) $order_id );
		if ( ! $order instanceof WC_Order || ! self::is_woopayments_order( $order ) ) {
			return;
		}

		self::tag_order( $order, 'woocommerce_woopayments_lifecycle' );
		$reference = self::gateway_reference( $order );
		if ( '' !== $reference ) {
			$order->update_meta_data( '_dtb_payment_provider', 'woopayments' );
			$order->update_meta_data( '_dtb_payment_ref', $reference );
			$order->update_meta_data( '_dtb_payment_captured', null !== $order->get_date_paid() ? '1' : '0' );
			$order->save_meta_data();
		}
	}

	public static function admin_notices(): void {
		if ( ! is_admin() || ! current_user_can( 'manage_woocommerce' ) || ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		if ( ! self::is_woopayments_gateway_enabled() ) {
			echo '<div class="notice notice-warning"><p>'
				. esc_html__( 'Drywall Toolbox checkout is configured for WooCommerce Checkout + WooPayments. Enable, connect, and test WooPayments before accepting live checkout payments.', 'drywall-toolbox' )
				. '</p></div>';
		}

		if ( self::is_gateway_enabled( 'stripe' ) ) {
			echo '<div class="notice notice-warning"><p>'
				. esc_html__( 'Drywall Toolbox checkout should have one active storefront card/wallet authority. Disable the official WooCommerce Stripe gateway when WooPayments is the active payment provider.', 'drywall-toolbox' )
				. '</p></div>';
		}

		if ( ! self::checkout_page_has_supported_content() ) {
			echo '<div class="notice notice-error"><p>'
				. esc_html__( 'Drywall Toolbox checkout requires the assigned WooCommerce Checkout page to contain the WooCommerce Checkout Block. Add the block before testing payments.', 'drywall-toolbox' )
				. '</p></div>';
		}
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
		$order->update_meta_data( '_dtb_checkout_source', sanitize_key( $source ) );
		$order->update_meta_data( '_dtb_order_type', 'product' );
		if ( function_exists( 'dtb_detect_storefront_base_path' ) ) {
			$order->update_meta_data( '_dtb_storefront_base_path', dtb_detect_storefront_base_path() );
		}
	}

	private static function is_woopayments_order( WC_Order $order ): bool {
		$method = sanitize_key( (string) $order->get_payment_method() );
		return self::WOOPAYMENTS_GATEWAY_ID === $method || str_starts_with( $method, self::WOOPAYMENTS_GATEWAY_ID . '_' );
	}

	private static function gateway_reference( WC_Order $order ): string {
		$transaction_id = trim( (string) $order->get_transaction_id() );
		if ( '' !== $transaction_id ) {
			return sanitize_text_field( $transaction_id );
		}

		$meta_keys = [
			'_wcpay_intent_id',
			'_wcpay_payment_intent_id',
			'_wcpay_charge_id',
			'_wcpay_transaction_id',
		];
		foreach ( $meta_keys as $meta_key ) {
			$value = trim( (string) $order->get_meta( $meta_key, true ) );
			if ( '' !== $value ) {
				return sanitize_text_field( $value );
			}
		}
		return '';
	}

	private static function payment_gateways(): array {
		if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
			return [];
		}
		$gateways = WC()->payment_gateways()->payment_gateways();
		return is_array( $gateways ) ? $gateways : [];
	}

	private static function is_woopayments_gateway_enabled(): bool {
		return self::is_gateway_enabled( self::WOOPAYMENTS_GATEWAY_ID );
	}

	private static function is_gateway_enabled( string $gateway_id ): bool {
		$gateways = self::payment_gateways();
		$gateway  = $gateways[ $gateway_id ] ?? null;
		return is_object( $gateway ) && isset( $gateway->enabled ) && 'yes' === (string) $gateway->enabled;
	}
}

DTB_WooPaymentsNativeCheckout::register();
