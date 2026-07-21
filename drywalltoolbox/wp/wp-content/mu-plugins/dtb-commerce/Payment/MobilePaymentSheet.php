<?php
/**
 * Production mobile payment-sheet presentation and readiness integration.
 *
 * WooCommerce and the official WooCommerce Stripe Payment Gateway retain all
 * checkout, payment-method, tokenization, authentication, and submission
 * authority. This class only loads DTB presentation hardening and exposes
 * non-secret local readiness signals for operators.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_MobilePaymentSheet {
	private const ASSET_VERSION = '2026.07.20.1';

	public static function register(): void {
		add_action( 'wp_enqueue_scripts', [ __CLASS__, 'enqueue_assets' ], 30 );
		add_filter( 'rest_request_after_callbacks', [ __CLASS__, 'augment_checkout_capabilities' ], 10, 3 );
		add_action( 'admin_notices', [ __CLASS__, 'admin_notices' ], 30 );
	}

	public static function enqueue_assets(): void {
		if ( ! self::is_primary_checkout_request() ) {
			return;
		}

		wp_enqueue_style(
			'dtb-woo-native-checkout-payment-sheet',
			content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout-payment-sheet.css' ),
			[ 'dtb-woo-native-checkout' ],
			self::ASSET_VERSION
		);

		wp_enqueue_script(
			'dtb-woo-native-checkout-payment-sheet',
			content_url( 'mu-plugins/dtb-commerce/assets/woo-native-checkout-payment-sheet.js' ),
			[ 'dtb-woo-native-checkout-ui' ],
			self::ASSET_VERSION,
			true
		);
		wp_script_add_data( 'dtb-woo-native-checkout-payment-sheet', 'strategy', 'defer' );
	}

	/**
	 * Add non-secret local payment-sheet and Stripe-readiness diagnostics to the
	 * existing public capabilities response without triggering external calls.
	 *
	 * @param WP_REST_Response|WP_HTTP_Response|WP_Error $response REST response.
	 * @param array                                      $handler  Route handler.
	 * @param WP_REST_Request                            $request  Request object.
	 * @return WP_REST_Response|WP_HTTP_Response|WP_Error
	 */
	public static function augment_checkout_capabilities( $response, array $handler, WP_REST_Request $request ) {
		if ( '/dtb/v1/checkout/capabilities' !== $request->get_route() || is_wp_error( $response ) || ! $response instanceof WP_REST_Response ) {
			return $response;
		}

		$data = $response->get_data();
		if ( ! is_array( $data ) ) {
			return $response;
		}

		$settings  = self::stripe_settings();
		$test_mode = 'yes' === (string) ( $settings['testmode'] ?? 'no' );
		$data['payment_sheet'] = [
			'presentation'                          => 'dtb_mobile_bottom_sheet',
			'asset_version'                         => self::ASSET_VERSION,
			'payment_authority'                     => 'woocommerce_official_stripe',
			'total_source'                          => 'wc_store_cart',
			'modal_accessibility'                   => 'dialog_focus_containment',
			'active_mode'                           => $test_mode ? 'test' : 'live',
			'stripe_account_connected'              => self::stripe_account_connected(),
			'optimized_checkout_layout'             => sanitize_key( (string) ( $settings['optimized_checkout_layout'] ?? '' ) ),
			'optimized_checkout_layout_recommended' => 'accordion',
			'settings_sync_state'                   => self::settings_sync_state( $settings ),
			'active_webhook_locally_configured'     => self::active_webhook_locally_configured( $settings, $test_mode ),
			'active_webhook_cached_status'           => self::active_webhook_cached_status( $test_mode ),
			'automatic_capture'                     => 'yes' === (string) ( $settings['capture'] ?? 'yes' ),
			'competing_payment_authority_detected'  => [] !== self::competing_payment_authorities(),
		];

		$response->set_data( $data );
		return $response;
	}

	public static function admin_notices(): void {
		if ( ! is_admin() || ! current_user_can( 'manage_woocommerce' ) || ! class_exists( 'WooCommerce' ) ) {
			return;
		}

		$settings = self::stripe_settings();
		if ( [] === $settings ) {
			return;
		}

		if ( ! self::stripe_account_connected() ) {
			self::render_notice(
				'error',
				__( 'The official WooCommerce Stripe gateway is not connected to a Stripe account. Complete the official connection flow before accepting checkout payments.', 'drywall-toolbox' )
			);
		}

		$optimized_checkout_enabled = 'yes' === (string) ( $settings['optimized_checkout_element'] ?? 'no' );
		$layout                     = sanitize_key( (string) ( $settings['optimized_checkout_layout'] ?? '' ) );
		if ( $optimized_checkout_enabled && 'accordion' !== $layout ) {
			self::render_notice(
				'warning',
				__( 'Drywall Toolbox mobile checkout is optimized for the official Stripe Optimized Checkout Suite Accordion layout. Set WooCommerce → Settings → Payments → Stripe → Advanced Settings → Layout to Accordion before live acceptance.', 'drywall-toolbox' )
			);
		}

		if ( 'disabled' === self::settings_sync_state( $settings ) ) {
			self::render_notice(
				'error',
				__( 'Stripe payment-method Settings Sync is disabled. Reconnect the official WooCommerce Stripe extension and restore Settings Sync before relying on Optimized Checkout Suite payment-method eligibility.', 'drywall-toolbox' )
			);
		}

		$test_mode = 'yes' === (string) ( $settings['testmode'] ?? 'no' );
		if ( ! self::active_webhook_locally_configured( $settings, $test_mode ) ) {
			self::render_notice(
				'warning',
				sprintf(
					/* translators: %s is either Test or Live. */
					__( 'The official Stripe gateway does not have a complete local %s-mode webhook configuration. Configure and verify webhooks before accepting payments in that mode.', 'drywall-toolbox' ),
					$test_mode ? __( 'Test', 'drywall-toolbox' ) : __( 'Live', 'drywall-toolbox' )
				)
			);
		}

		if ( 'yes' !== (string) ( $settings['capture'] ?? 'yes' ) ) {
			self::render_notice(
				'warning',
				__( 'Stripe manual capture is enabled. Drywall Toolbox fulfillment and accounting remain gated until WooCommerce records captured/paid state; automatic capture is the approved launch configuration unless a manual-capture workflow has been explicitly reviewed.', 'drywall-toolbox' )
			);
		}

		$competing = self::competing_payment_authorities();
		if ( [] !== $competing ) {
			self::render_notice(
				'warning',
				sprintf(
					/* translators: %s is a comma-separated list of enabled competing gateway titles. */
					__( 'Drywall Toolbox requires one storefront card/wallet authority. Review and disable competing Stripe/WooPayments gateways before live acceptance: %s', 'drywall-toolbox' ),
					esc_html( implode( ', ', $competing ) )
				)
			);
		}
	}

	private static function stripe_settings(): array {
		if ( class_exists( 'WC_Stripe_Helper' ) && method_exists( 'WC_Stripe_Helper', 'get_stripe_settings' ) ) {
			$settings = WC_Stripe_Helper::get_stripe_settings();
			return is_array( $settings ) ? $settings : [];
		}

		$settings = get_option( 'woocommerce_stripe_settings', [] );
		return is_array( $settings ) ? $settings : [];
	}

	private static function stripe_account_connected(): bool {
		return class_exists( 'WC_Stripe_Helper' )
			&& method_exists( 'WC_Stripe_Helper', 'is_connected' )
			&& (bool) WC_Stripe_Helper::is_connected();
	}

	private static function settings_sync_state( array $settings ): string {
		if ( ! array_key_exists( 'pmc_enabled', $settings ) || '' === (string) $settings['pmc_enabled'] ) {
			return 'pending';
		}
		return 'no' === (string) $settings['pmc_enabled'] ? 'disabled' : 'enabled';
	}

	private static function active_webhook_locally_configured( array $settings, bool $test_mode ): bool {
		$data_key   = $test_mode ? 'test_webhook_data' : 'webhook_data';
		$secret_key = $test_mode ? 'test_webhook_secret' : 'webhook_secret';
		$data       = $settings[ $data_key ] ?? [];

		return is_array( $data )
			&& '' !== trim( (string) ( $data['id'] ?? '' ) )
			&& '' !== trim( (string) ( $settings[ $secret_key ] ?? '' ) );
	}

	private static function active_webhook_cached_status( bool $test_mode ): string {
		$cache_key = $test_mode ? 'wcstripe_webhook_status_test' : 'wcstripe_webhook_status_live';
		if ( class_exists( 'WC_Stripe_Account' ) ) {
			$constant = $test_mode ? 'WC_Stripe_Account::TEST_WEBHOOK_STATUS_OPTION' : 'WC_Stripe_Account::LIVE_WEBHOOK_STATUS_OPTION';
			if ( defined( $constant ) ) {
				$cache_key = (string) constant( $constant );
			}
		}

		$status = get_transient( $cache_key );
		return in_array( $status, [ 'enabled', 'disabled' ], true ) ? $status : 'unknown';
	}

	private static function competing_payment_authorities(): array {
		if ( ! function_exists( 'WC' ) || ! WC() || ! WC()->payment_gateways() ) {
			return [];
		}

		$gateways = WC()->payment_gateways()->payment_gateways();
		if ( ! is_array( $gateways ) ) {
			return [];
		}

		$competing = [];
		foreach ( $gateways as $gateway ) {
			if ( ! is_object( $gateway ) || 'yes' !== (string) ( $gateway->enabled ?? 'no' ) ) {
				continue;
			}

			$id = sanitize_key( (string) ( $gateway->id ?? '' ) );
			if ( '' === $id ) {
				continue;
			}
			if ( class_exists( 'DTB_OfficialStripeNativeCheckout' ) && DTB_OfficialStripeNativeCheckout::is_official_gateway_id( $id ) ) {
				continue;
			}

			$class_name   = strtolower( get_class( $gateway ) );
			$is_competing = 'woocommerce_payments' === $id
				|| false !== strpos( $id, 'stripe' )
				|| false !== strpos( $class_name, 'stripe' );
			if ( ! $is_competing ) {
				continue;
			}

			$title       = sanitize_text_field( (string) ( $gateway->method_title ?? $gateway->title ?? $id ) );
			$competing[] = '' !== $title ? $title : $id;
		}

		return array_values( array_unique( $competing ) );
	}

	private static function render_notice( string $type, string $message ): void {
		printf(
			'<div class="notice notice-%1$s"><p>%2$s</p></div>',
			esc_attr( sanitize_key( $type ) ),
			wp_kses_post( $message )
		);
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
}

DTB_MobilePaymentSheet::register();
