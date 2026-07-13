<?php
/**
 * Compatibility toggle: native WooCommerce order-pay template.
 *
 * The DTB custom/branded payment runtime is temporarily disabled by default so
 * WooCommerce's native order-pay shortcode/gateway runtime can be evaluated
 * directly while the custom desktop/mobile UI is rebuilt. Routing,
 * canonical-redirect suppression, order-key validation, payable-order
 * preparation, and gateway scripts remain owned by the existing payment
 * runtime.
 *
 * Re-enable the custom DTB payment template only after it is rebuilt and tested:
 * define( 'DTB_PAYMENT_RUNTIME_CUSTOM_TEMPLATE_ENABLED', true );
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'dtb_payment_runtime_native_toggle_request' ) ) {
	/** Detect keyed WooCommerce order-pay requests. */
	function dtb_payment_runtime_native_toggle_request(): bool {
		if ( function_exists( 'dtb_payment_runtime_hotfix_request' ) && dtb_payment_runtime_hotfix_request() ) {
			return true;
		}

		if ( function_exists( 'dtb_wc_payment_runtime_request' ) && dtb_wc_payment_runtime_request() ) {
			return true;
		}

		$request_uri = isset( $_SERVER['REQUEST_URI'] )
			? sanitize_text_field( wp_unslash( (string) $_SERVER['REQUEST_URI'] ) )
			: '';
		$path        = (string) wp_parse_url( $request_uri, PHP_URL_PATH );
		$query       = (string) wp_parse_url( $request_uri, PHP_URL_QUERY );

		return (bool) preg_match( '#/(?:staging/\d+/)?checkout/order-pay/\d+/?#', $path )
			|| ( false !== stripos( $query, 'pay_for_order=true' ) && false !== stripos( $query, 'key=wc_order_' ) );
	}
}

if ( ! function_exists( 'dtb_payment_runtime_native_toggle_custom_enabled' ) ) {
	/** Return whether the DTB custom payment runtime template should be used. */
	function dtb_payment_runtime_native_toggle_custom_enabled(): bool {
		return defined( 'DTB_PAYMENT_RUNTIME_CUSTOM_TEMPLATE_ENABLED' )
			&& true === (bool) DTB_PAYMENT_RUNTIME_CUSTOM_TEMPLATE_ENABLED;
	}
}

if ( ! function_exists( 'dtb_payment_runtime_native_template_path' ) ) {
	/** Return the native WooCommerce order-pay template path. */
	function dtb_payment_runtime_native_template_path(): string {
		return __DIR__ . '/dtb-platform/Templates/WooNativeOrderPayRuntime.php';
	}
}

add_filter(
	'template_include',
	static function ( string $template ): string {
		if ( ! dtb_payment_runtime_native_toggle_request() || dtb_payment_runtime_native_toggle_custom_enabled() ) {
			return $template;
		}

		$native_template = dtb_payment_runtime_native_template_path();
		return file_exists( $native_template ) ? $native_template : $template;
	},
	PHP_INT_MAX
);

add_action(
	'wp_enqueue_scripts',
	static function (): void {
		if ( ! dtb_payment_runtime_native_toggle_request() || dtb_payment_runtime_native_toggle_custom_enabled() ) {
			return;
		}

		foreach ( [ 'dtb-payment-runtime', 'dtb-payment-runtime-modern-typography', 'dtb-payment-runtime-bnpl-flow' ] as $handle ) {
			wp_dequeue_style( $handle );
			wp_deregister_style( $handle );
			wp_dequeue_script( $handle );
			wp_deregister_script( $handle );
		}
	},
	PHP_INT_MAX
);
