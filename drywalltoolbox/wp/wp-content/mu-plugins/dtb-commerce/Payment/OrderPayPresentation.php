<?php
/**
 * Order-pay presentation runtime.
 *
 * Owns the public WooCommerce order-pay document shell and mobile-first visual
 * behavior for Drywall Toolbox. WooCommerce and the active gateway plugins still
 * own gateway fields, iframes, nonces, tokenization, callbacks, and payment
 * lifecycle state.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_OrderPayPresentation {
	private const STYLE_HANDLE  = 'dtb-order-pay-runtime';
	private const SCRIPT_HANDLE = 'dtb-order-pay-runtime';

	/** Register early lifecycle hooks. */
	public static function register(): void {
		add_filter( 'redirect_canonical', [ __CLASS__, 'disable_canonical_redirect' ], 0, 2 );
		add_action( 'template_redirect', [ __CLASS__, 'prepare_order_pay_request' ], 0 );
		add_action( 'muplugins_loaded', [ __CLASS__, 'register_late_hooks' ], PHP_INT_MAX );
	}

	/** Register hooks that must win after legacy root MU files are loaded. */
	public static function register_late_hooks(): void {
		self::remove_legacy_presentation_hooks();

		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_assets' ], PHP_INT_MAX );
		add_filter( 'template_include', [ __CLASS__, 'template_include' ], PHP_INT_MAX );
	}

	/** Return whether the current request is a public keyed order-pay document. */
	public static function is_request(): bool {
		if (
			is_admin()
			|| wp_doing_ajax()
			|| ( defined( 'REST_REQUEST' ) && REST_REQUEST )
			|| ( defined( 'DOING_CRON' ) && DOING_CRON )
			|| ( defined( 'WP_CLI' ) && WP_CLI )
		) {
			return false;
		}

		if ( function_exists( 'dtb_wc_payment_runtime_request' ) && dtb_wc_payment_runtime_request() ) {
			return true;
		}

		$order_pay = function_exists( 'get_query_var' ) ? absint( get_query_var( 'order-pay' ) ) : 0;
		if ( $order_pay > 0 ) {
			return true;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] )
			? sanitize_text_field( wp_unslash( (string) $_SERVER['REQUEST_URI'] ) )
			: '';
		$path        = '' !== $request_uri ? (string) wp_parse_url( $request_uri, PHP_URL_PATH ) : '';
		$query       = '' !== $request_uri ? (string) wp_parse_url( $request_uri, PHP_URL_QUERY ) : '';

		return (bool) preg_match( '#/(?:staging/\d+/)?(?:wp/)?checkout/order-pay/\d+/?#', $path )
			|| ( false !== stripos( $query, 'pay_for_order=true' ) && false !== stripos( $query, 'key=wc_order_' ) );
	}

	/** Disable WordPress canonical redirects for order-pay handoff URLs. */
	public static function disable_canonical_redirect( $redirect_url, $requested_url ) {
		unset( $requested_url );
		return self::is_request() ? false : $redirect_url;
	}

	/** Prime WooCommerce order-pay query state before the template renders. */
	public static function prepare_order_pay_request(): void {
		if ( ! self::is_request() ) {
			return;
		}

		if ( function_exists( 'dtb_wc_payment_runtime_prime_order_pay_query_vars' ) ) {
			dtb_wc_payment_runtime_prime_order_pay_query_vars();
		}
		if ( function_exists( 'dtb_wc_payment_runtime_prepare_current_order' ) ) {
			dtb_wc_payment_runtime_prepare_current_order();
		}
	}

	/** Render the canonical DTB order-pay template. */
	public static function template_include( string $template ): string {
		if ( ! self::is_request() ) {
			return $template;
		}

		self::prepare_order_pay_request();

		$order_pay_template = dirname( __DIR__ ) . '/Templates/WooOrderPayRuntime.php';
		return file_exists( $order_pay_template ) ? $order_pay_template : $template;
	}

	/** Enqueue the single authoritative order-pay stylesheet and runtime script. */
	public static function enqueue_assets(): void {
		if ( ! self::is_request() ) {
			return;
		}

		self::suppress_public_storefront_assets();
		self::dequeue_legacy_asset_handles();

		$asset_dir = dirname( __DIR__ ) . '/assets';
		$style     = $asset_dir . '/order-pay-runtime.css';
		$script    = $asset_dir . '/order-pay-runtime.js';

		if ( file_exists( $style ) ) {
			wp_enqueue_style(
				self::STYLE_HANDLE,
				self::asset_url( 'order-pay-runtime.css' ),
				[],
				(string) filemtime( $style )
			);
		}

		if ( file_exists( $script ) ) {
			wp_enqueue_script(
				self::SCRIPT_HANDLE,
				self::asset_url( 'order-pay-runtime.js' ),
				[],
				(string) filemtime( $script ),
				true
			);
			wp_script_add_data( self::SCRIPT_HANDLE, 'defer', true );
		}
	}

	/** Remove old root-level presentation callbacks when stale files remain deployed. */
	private static function remove_legacy_presentation_hooks(): void {
		$legacy_actions = [
			[ 'wp_head', 'dtb_order_pay_conversion_polish_head', 99 ],
			[ 'wp_footer', 'dtb_order_pay_conversion_polish_footer', 99 ],
			[ 'wp_head', 'dtb_order_pay_layout_repair_head', 120 ],
			[ 'wp_footer', 'dtb_order_pay_layout_repair_footer', 120 ],
			[ 'wp_head', 'dtb_order_pay_checkout_sync_head', 220 ],
			[ 'wp_footer', 'dtb_order_pay_checkout_sync_footer', 220 ],
			[ 'wp_head', 'dtb_order_pay_final_ui_normalizer_head', 999 ],
			[ 'wp_footer', 'dtb_order_pay_final_ui_normalizer_footer', 999 ],
			[ 'wp_head', 'dtb_order_pay_premium_mobile_ux_head', 999 ],
			[ 'wp_footer', 'dtb_order_pay_premium_mobile_ux_footer', 999 ],
			[ 'wp_head', 'dtb_order_pay_compact_gateway_ui_head', 1002 ],
			[ 'wp_footer', 'dtb_order_pay_compact_gateway_ui_footer', 1002 ],
		];

		foreach ( $legacy_actions as [ $hook, $callback, $priority ] ) {
			remove_action( $hook, $callback, $priority );
		}
	}

	/** Keep the public React shell and broad host asset suppression out of order-pay. */
	private static function suppress_public_storefront_assets(): void {
		if ( function_exists( 'hb_dequeue_all_frontend_assets' ) ) {
			remove_action( 'wp_enqueue_scripts', 'hb_dequeue_all_frontend_assets', 9999 );
		}
		if ( function_exists( 'dtb_dequeue_non_react_assets' ) ) {
			remove_action( 'wp_enqueue_scripts', 'dtb_dequeue_non_react_assets', 9999 );
		}
		if ( function_exists( 'dtb_enqueue_react_app' ) ) {
			remove_action( 'wp_enqueue_scripts', 'dtb_enqueue_react_app' );
		}
	}

	/** Remove legacy presentation asset handles if stale root files are still live. */
	private static function dequeue_legacy_asset_handles(): void {
		$handles = [
			'dtb-payment-runtime',
			'dtb-payment-runtime-modern-typography',
			'dtb-payment-runtime-bnpl-flow',
			'dtb-payment-runtime-font-sync',
			'dtb-payment-runtime-order-summary-polish',
			'dtb-payment-runtime-pay-later-layout',
			'dtb-payment-runtime-summary-title-cleanup',
			'dtb-payment-runtime-mobile-fixes',
		];

		foreach ( $handles as $handle ) {
			wp_dequeue_style( $handle );
			wp_deregister_style( $handle );
			wp_dequeue_script( $handle );
			wp_deregister_script( $handle );
		}
	}

	/** Build a public MU-plugin asset URL. */
	private static function asset_url( string $file ): string {
		$base = defined( 'WPMU_PLUGIN_URL' ) ? WPMU_PLUGIN_URL : content_url( '/mu-plugins' );
		return trailingslashit( $base ) . 'dtb-commerce/assets/' . ltrim( $file, '/' );
	}
}

DTB_OrderPayPresentation::register();
