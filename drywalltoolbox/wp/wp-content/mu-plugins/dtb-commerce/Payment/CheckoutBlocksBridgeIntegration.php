<?php
/**
 * DTB Checkout Blocks bridge integration shell.
 *
 * Registers a conservative WooCommerce Checkout Blocks payment-method type so
 * DTB can participate in the official Blocks payment registry without moving
 * card fields, wallet sheets, tokenization, callbacks, or payment processing
 * into the React storefront.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( class_exists( '\\Automattic\\WooCommerce\\Blocks\\Payments\\Integrations\\AbstractPaymentMethodType' ) ) {
	final class DTB_CheckoutBlocksBridgeIntegration extends \Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType {
		protected $name = 'dtb_checkout_blocks_bridge';

		/** Register the Blocks payment method type with WooCommerce Blocks. */
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
		 * Keep this payment method hidden unless the explicit DTB release gate is enabled.
		 *
		 * The gate must only be enabled after the active provider-owned Blocks UI has
		 * been verified end to end against DTB quote/session/finalize/order lifecycle.
		 */
		public function is_active(): bool {
			return $this->bridge_enabled() && $this->has_online_gateway_candidate();
		}

		/** Return script handles for the client-side Blocks registration shim. */
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

		/** Return public settings exposed to the Blocks registry script. */
		public function get_payment_method_data(): array {
			$enabled = $this->bridge_enabled();
			return [
				'title'              => 'Drywall Toolbox secure payment',
				'description'        => 'Payment remains provider-owned through WooCommerce Checkout Blocks.',
				'bridgeEnabled'      => $enabled,
				'sameShellSupported' => $enabled,
				'supports'           => [ 'features' => [ 'products' ] ],
				'fallbackRoute'      => '/checkout/order-pay',
				'contractVersion'    => '1',
			];
		}

		/** Whether the explicit production release gate is enabled. */
		private function bridge_enabled(): bool {
			return (bool) apply_filters( 'dtb_checkout_blocks_same_shell_supported', false, [], [] );
		}

		/** Return whether at least one non-manual WooCommerce gateway is available. */
		private function has_online_gateway_candidate(): bool {
			if ( ! function_exists( 'WC' ) || ! WC()->payment_gateways() ) {
				return false;
			}
			foreach ( (array) WC()->payment_gateways()->get_available_payment_gateways() as $gateway ) {
				$id = is_object( $gateway ) ? sanitize_key( (string) ( $gateway->id ?? '' ) ) : '';
				if ( '' !== $id && ! in_array( $id, [ 'cod', 'bacs', 'cheque' ], true ) ) {
					return true;
				}
			}
			return false;
		}
	}
} else {
	final class DTB_CheckoutBlocksBridgeIntegration {
		/** No-op when WooCommerce Blocks payment integration classes are unavailable. */
		public static function register(): void {}
	}
}
