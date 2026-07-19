<?php
/**
 * Native WooCommerce checkout runtime adapter for the headless DTB theme.
 *
 * The active public theme normally forces every frontend request into the React
 * SPA and strips non-React assets. Checkout is the deliberate exception:
 * WooCommerce must own the server-rendered document so Checkout Block and the
 * official Stripe extension can enqueue their supported scripts/styles and run
 * their native endpoint lifecycle.
 *
 * This adapter does not render payment methods or checkout blocks itself. It
 * only stops the headless-theme SPA override and supplies a standard WordPress
 * page host that executes the assigned Checkout page content.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_WooNativeCheckoutRuntime {
	public static function register(): void {
		add_action( 'wp', [ __CLASS__, 'prepare_runtime' ], 1 );
		add_filter( 'template_include', [ __CLASS__, 'template_include' ], 1000 );
		add_action( 'send_headers', [ __CLASS__, 'send_private_headers' ], 20 );
		add_action( 'woocommerce_store_api_checkout_order_processed', [ __CLASS__, 'persist_store_api_checkout_metadata' ], 100 );
	}

	public static function prepare_runtime(): void {
		if ( ! self::is_native_checkout_surface() ) {
			return;
		}

		// The active headless theme normally enqueues React and then strips every
		// other frontend asset. Neither behavior is valid on Woo checkout/payment
		// endpoints because Checkout Block and Stripe own their runtime assets.
		remove_action( 'wp_enqueue_scripts', 'dtb_enqueue_react_app', 10 );
		remove_action( 'wp_enqueue_scripts', 'dtb_dequeue_non_react_assets', 9999 );
		remove_filter( 'template_include', 'dtb_force_react_template', 99 );
	}

	public static function template_include( string $template ): string {
		if ( ! self::is_native_checkout_surface() ) {
			return $template;
		}

		$native_template = dirname( __DIR__ ) . '/Templates/WooNativeCheckoutPage.php';
		return is_readable( $native_template ) ? $native_template : $template;
	}

	public static function send_private_headers(): void {
		if ( ! self::is_native_checkout_surface() || headers_sent() ) {
			return;
		}

		nocache_headers();
		header( 'Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0', true );
		header( 'Pragma: no-cache', true );
	}

	/**
	 * Checkout Block processes orders through the Store API. DTB checkout tagging
	 * runs earlier on that lifecycle and updates the order object in memory; save
	 * the metadata explicitly at a late priority so the production contract is
	 * durable before payment/lifecycle observers inspect it.
	 */
	public static function persist_store_api_checkout_metadata( $order ): void {
		if ( ! $order instanceof WC_Order ) {
			return;
		}

		if (
			'woo_native_stripe' !== (string) $order->get_meta( '_dtb_checkout_gateway', true ) ||
			'woo-stripe-v1' !== (string) $order->get_meta( '_dtb_checkout_contract_version', true )
		) {
			return;
		}

		$order->save_meta_data();
	}

	private static function is_native_checkout_surface(): bool {
		if ( is_admin() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
			return false;
		}

		if ( function_exists( 'is_checkout' ) && is_checkout() ) {
			return true;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] )
			? (string) wp_unslash( $_SERVER['REQUEST_URI'] )
			: '';
		$path = (string) wp_parse_url( $request_uri, PHP_URL_PATH );

		return (bool) preg_match( '#/(?:staging/[A-Za-z0-9_-]+/)?checkout(?:/|$)#i', $path );
	}
}

DTB_WooNativeCheckoutRuntime::register();
