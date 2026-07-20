<?php
/**
 * Preserve the originating React storefront context through native Woo checkout.
 *
 * Checkout itself is always canonical root `/checkout/`. A staging React build may
 * originate that handoff from `/staging/{id}`; this module stores only that
 * validated public base path in the existing Woo session/order contract and uses
 * it when WooCommerce asks the payment gateway for its successful return URL.
 *
 * No payment state, Stripe state, order totals, or customer identity are derived
 * from this context. The value is presentation/routing metadata only.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_StorefrontReturnContext {
	private const QUERY_ARG   = 'dtb_storefront_base_path';
	private const SESSION_KEY = 'dtb_storefront_base_path';
	private const ORDER_META  = '_dtb_storefront_base_path';

	public static function register(): void {
		add_action( 'wp', [ __CLASS__, 'capture_checkout_context' ], 5 );
		// Run after OfficialStripeNativeCheckout's priority-20 order tagging so the
		// explicit originating storefront context is the final persisted value.
		add_action( 'woocommerce_checkout_create_order', [ __CLASS__, 'apply_order_context' ], 30, 2 );
		add_action( 'woocommerce_store_api_checkout_order_processed', [ __CLASS__, 'apply_store_api_order_context' ], 30 );
		add_filter( 'woocommerce_get_return_url', [ __CLASS__, 'filter_success_return_url' ], 1000, 2 );
	}

	/**
	 * Capture the storefront base path only on the primary native checkout page.
	 */
	public static function capture_checkout_context(): void {
		if ( ! self::is_primary_checkout_request() || ! function_exists( 'WC' ) || ! WC() || ! WC()->session ) {
			return;
		}

		$raw = isset( $_GET[ self::QUERY_ARG ] ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			? (string) wp_unslash( $_GET[ self::QUERY_ARG ] ) // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			: '';

		$base_path = self::sanitize_storefront_base_path( $raw );
		WC()->session->set( self::SESSION_KEY, $base_path );
	}

	/**
	 * Persist the checkout-origin context on classic checkout orders.
	 */
	public static function apply_order_context( WC_Order $order, array $data = [] ): void { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed
		self::persist_order_context( $order );
	}

	/**
	 * Persist the checkout-origin context on Checkout Block / Store API orders.
	 */
	public static function apply_store_api_order_context( $order ): void {
		if ( $order instanceof WC_Order ) {
			self::persist_order_context( $order );
		}
	}

	/**
	 * Route a successful DTB storefront checkout back to the originating React
	 * order-tracking surface while keeping WooCommerce/gateway payment ownership.
	 *
	 * @param string        $return_url WooCommerce's default order-received URL.
	 * @param WC_Order|null $order      Processed order, when available.
	 */
	public static function filter_success_return_url( string $return_url, $order = null ): string {
		if ( ! $order instanceof WC_Order || ! self::is_dtb_checkout_order( $order ) ) {
			return $return_url;
		}

		$base_path = self::sanitize_storefront_base_path( (string) $order->get_meta( self::ORDER_META, true ) );
		$path      = $base_path . '/order-tracking/' . absint( $order->get_id() );
		$url       = home_url( $path );

		return add_query_arg(
			[
				'order_key'         => $order->get_order_key(),
				'checkout_complete' => '1',
			],
			$url
		);
	}

	private static function persist_order_context( WC_Order $order ): void {
		$base_path = '';
		if ( function_exists( 'WC' ) && WC() && WC()->session ) {
			$base_path = self::sanitize_storefront_base_path( (string) WC()->session->get( self::SESSION_KEY, '' ) );
		}

		$order->update_meta_data( self::ORDER_META, $base_path );
	}

	/**
	 * Only production root or a tracked staging build path may be persisted.
	 */
	private static function sanitize_storefront_base_path( string $value ): string {
		$value = trim( rawurldecode( $value ) );
		if ( '' === $value || '/' === $value ) {
			return '';
		}

		$value = '/' . trim( $value, '/' );
		return preg_match( '#^/staging/[A-Za-z0-9_-]+$#', $value ) ? $value : '';
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

	private static function is_dtb_checkout_order( WC_Order $order ): bool {
		return 'woo_native_stripe' === (string) $order->get_meta( '_dtb_checkout_gateway', true )
			&& 'woo-stripe-v1' === (string) $order->get_meta( '_dtb_checkout_contract_version', true );
	}
}

DTB_StorefrontReturnContext::register();
