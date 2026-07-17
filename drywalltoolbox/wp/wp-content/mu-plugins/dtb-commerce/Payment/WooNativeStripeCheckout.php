<?php
/**
 * Woo-native checkout integration for the official WooCommerce Stripe gateway.
 *
 * WooCommerce Checkout Block / checkout shortcode owns order creation and the
 * official Stripe gateway owns payment rendering, payment processing, and Stripe
 * webhook synchronization. DTB observes paid Woo orders for downstream jobs and
 * provides a branded checkout shell without taking over gateway internals.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_WooNativeStripeCheckout {
	public const CHECKOUT_GATEWAY      = 'woo_native_stripe';
	public const CONTRACT_VERSION      = 'woo-stripe-v1';
	private const OFFICIAL_GATEWAY_ID  = 'stripe';

	public static function register(): void {
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_checkout_assets' ], 20 );
		add_filter( 'body_class', [ __CLASS__, 'body_class' ] );
		add_filter( 'the_content', [ __CLASS__, 'checkout_content' ], 20 );
		add_action( 'woocommerce_checkout_create_order', [ __CLASS__, 'tag_checkout_order' ], 20, 2 );
		add_action( 'woocommerce_store_api_checkout_order_processed', [ __CLASS__, 'tag_store_api_order' ], 20 );
		add_action( 'woocommerce_payment_complete', [ __CLASS__, 'mirror_verified_stripe_payment' ], 9 );
		add_action( 'woocommerce_order_status_processing', [ __CLASS__, 'mirror_verified_stripe_payment' ], 9 );
		add_action( 'woocommerce_order_status_completed', [ __CLASS__, 'mirror_verified_stripe_payment' ], 9 );
		add_action( 'admin_notices', [ __CLASS__, 'admin_notices' ] );
	}

	public static function enqueue_checkout_assets(): void {
		if ( ! self::is_primary_checkout_request() ) {
			return;
		}
		wp_enqueue_style(
			'dtb-woo-native-checkout',
			content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout.css' ),
			[],
			'2026.07.17'
		);
	}

	public static function body_class( array $classes ): array {
		if ( self::is_primary_checkout_request() ) {
			$classes[] = 'dtb-woo-native-checkout';
		}
		return $classes;
	}

	public static function checkout_content( string $content ): string {
		if ( ! self::is_primary_checkout_request() || ! in_the_loop() || ! is_main_query() ) {
			return $content;
		}

		$checkout_markup = self::render_checkout_runtime();
		if ( '' === trim( $checkout_markup ) ) {
			$checkout_markup = $content;
		}

		return '<div class="dtb-woo-checkout-shell">'
			. '<header class="dtb-woo-checkout-hero">'
			. '<p class="dtb-woo-checkout-kicker">Secure checkout</p>'
			. '<h1>Complete your Drywall Toolbox order</h1>'
			. '<p>WooCommerce owns order creation. The official WooCommerce Stripe gateway renders payment methods, wallets, saved methods, and webhook-backed payment status.</p>'
			. '<div class="dtb-woo-checkout-trust" aria-label="Checkout safeguards">'
			. '<span>Stripe secure payments</span>'
			. '<span>WooCommerce order record</span>'
			. '<span>Veeqo fulfillment sync</span>'
			. '</div>'
			. '</header>'
			. '<section class="dtb-woo-checkout-card" aria-label="Checkout form">'
			. $checkout_markup
			. '</section>'
			. '</div>';
	}

	public static function tag_checkout_order( WC_Order $order, array $data = [] ): void {
		self::tag_order( $order, 'woocommerce_checkout' );
	}

	public static function tag_store_api_order( $order ): void {
		if ( $order instanceof WC_Order ) {
			self::tag_order( $order, 'woocommerce_store_api_checkout' );
		}
	}

	public static function mirror_verified_stripe_payment( $order_id ): void {
		$order = wc_get_order( (int) $order_id );
		if ( ! $order instanceof WC_Order || ! self::is_official_stripe_order( $order ) ) {
			return;
		}

		self::tag_order( $order, 'woocommerce_stripe_payment_lifecycle' );
		$reference = self::gateway_reference( $order );
		if ( '' !== $reference ) {
			$order->update_meta_data( '_dtb_payment_provider', 'woo_official_stripe' );
			$order->update_meta_data( '_dtb_payment_ref', $reference );
			$order->update_meta_data( '_dtb_payment_captured', null !== $order->get_date_paid() ? '1' : '0' );
			$order->save_meta_data();
		}
	}

	public static function admin_notices(): void {
		if ( ! is_admin() || ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}
		if ( ! class_exists( 'WooCommerce' ) ) {
			return;
		}
		if ( self::is_official_stripe_gateway_enabled() ) {
			return;
		}
		echo '<div class="notice notice-warning"><p>'
			. esc_html__( 'Drywall Toolbox checkout is configured for WooCommerce Checkout + official WooCommerce Stripe Gateway. Enable and connect the official Stripe gateway before accepting live checkout payments.', 'drywall-toolbox' )
			. '</p></div>';
	}

	private static function render_checkout_runtime(): string {
		if ( function_exists( 'do_blocks' ) && self::has_checkout_block_support() ) {
			$block = '<!-- wp:woocommerce/checkout {"className":"dtb-woo-checkout-block"} /-->';
			$markup = do_blocks( $block );
			if ( '' !== trim( $markup ) ) {
				return $markup;
			}
		}
		return do_shortcode( '[woocommerce_checkout]' );
	}

	private static function has_checkout_block_support(): bool {
		return function_exists( 'WC' ) && class_exists( 'Automattic\\WooCommerce\\Blocks\\Package' );
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

	private static function tag_order( WC_Order $order, string $source ): void {
		$order->update_meta_data( '_dtb_checkout_gateway', self::CHECKOUT_GATEWAY );
		$order->update_meta_data( '_dtb_checkout_contract_version', self::CONTRACT_VERSION );
		$order->update_meta_data( '_dtb_checkout_source', sanitize_key( $source ) );
		$order->update_meta_data( '_dtb_order_type', 'product' );
		if ( function_exists( 'dtb_detect_storefront_base_path' ) ) {
			$order->update_meta_data( '_dtb_storefront_base_path', dtb_detect_storefront_base_path() );
		}
	}

	private static function is_official_stripe_order( WC_Order $order ): bool {
		$method = sanitize_key( (string) $order->get_payment_method() );
		return self::OFFICIAL_GATEWAY_ID === $method || str_starts_with( $method, self::OFFICIAL_GATEWAY_ID . '_' );
	}

	private static function gateway_reference( WC_Order $order ): string {
		$transaction_id = trim( (string) $order->get_transaction_id() );
		if ( '' !== $transaction_id ) {
			return sanitize_text_field( $transaction_id );
		}
		foreach ( [ '_stripe_intent_id', '_stripe_charge_id', '_stripe_source_id', '_payment_intent_id' ] as $meta_key ) {
			$value = trim( (string) $order->get_meta( $meta_key, true ) );
			if ( '' !== $value ) {
				return sanitize_text_field( $value );
			}
		}
		return '';
	}

	private static function is_official_stripe_gateway_enabled(): bool {
		if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
			return false;
		}
		$gateways = WC()->payment_gateways()->payment_gateways();
		$gateway  = $gateways[ self::OFFICIAL_GATEWAY_ID ] ?? null;
		return is_object( $gateway ) && isset( $gateway->enabled ) && 'yes' === (string) $gateway->enabled;
	}
}

DTB_WooNativeStripeCheckout::register();
