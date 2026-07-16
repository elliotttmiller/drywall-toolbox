<?php
/**
 * DTB Checkout Blocks bridge integration guard.
 *
 * DTB must not register a fake payment gateway for same-shell checkout. Official
 * provider-owned gateway integrations such as WooPayments, Stripe, or PayPal
 * must register their own Checkout Blocks payment methods and own card fields,
 * wallets, tokenization, callbacks, and payment processing.
 *
 * This class is retained only as an optional diagnostics shim behind a separate
 * explicit filter. It must not become the production same-shell payment method.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( class_exists( '\\Automattic\\WooCommerce\\Blocks\\Payments\\Integrations\\AbstractPaymentMethodType' ) ) {
	final class DTB_CheckoutBlocksBridgeIntegration extends \Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType {
		protected $name = 'dtb_checkout_blocks_bridge';

		/** Register the optional diagnostics method type with WooCommerce Blocks. */
		public static function register(): void {
			add_action( 'woocommerce_blocks_payment_method_type_registration', [ __CLASS__, 'register_payment_method_type' ] );
		}

		/** Register this integration with the Blocks payment registry. */
		public static function register_payment_method_type( $payment_method_registry ): void {
			if ( ! is_object( $payment_method_registry ) || ! method_exists( $payment_method_registry, 'register' ) ) {
				return;
			}
			$payment_method_registry->register( new self() );
		}

		/** Initialize integration settings. */
		public function initialize(): void {}

		/**
		 * Keep this shim inactive by default.
		 *
		 * Same-shell payment must be provided by the active payment provider's own
		 * official Blocks registration, not by a DTB placeholder gateway. This shim is
		 * only available for diagnostics if explicitly enabled by a separate filter.
		 */
		public function is_active(): bool {
			return (bool) apply_filters( 'dtb_checkout_blocks_register_diagnostics_bridge', false );
		}

		/** Return script handles for the optional client-side diagnostics shim. */
		public function get_payment_method_script_handles(): array {
			$asset_path = dirname( __DIR__ ) . '/assets/checkout-blocks-bridge.js';
			$asset_url  = content_url( 'mu-plugins/dtb-commerce/assets/checkout-blocks-bridge.js' );
			$version    = file_exists( $asset_path ) ? (string) filemtime( $asset_path ) : '1';
			wp_register_script(
				'dtb-checkout-blocks-bridge',
				$asset_url,
				[ 'wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-i18n', 'wp-html-entities' ],
				$version,
				true
			);
			return [ 'dtb-checkout-blocks-bridge' ];
		}

		/** Return public settings exposed to the optional Blocks registry script. */
		public function get_payment_method_data(): array {
			$enabled = (bool) apply_filters( 'dtb_checkout_blocks_register_diagnostics_bridge', false );
			return [
				'title'              => 'Drywall Toolbox diagnostics bridge',
				'description'        => 'Diagnostics only. Production payment remains provider-owned through WooCommerce Checkout Blocks.',
				'bridgeEnabled'      => $enabled,
				'sameShellSupported' => false,
				'supports'           => [ 'features' => [ 'products' ] ],
				'fallbackRoute'      => '/checkout/order-pay',
				'contractVersion'    => '3',
			];
		}
	}
} else {
	final class DTB_CheckoutBlocksBridgeIntegration {
		/** No-op when WooCommerce Blocks payment integration classes are unavailable. */
		public static function register(): void {}
	}
}
