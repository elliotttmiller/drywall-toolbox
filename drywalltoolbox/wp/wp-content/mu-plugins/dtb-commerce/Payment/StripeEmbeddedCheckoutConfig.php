<?php
/**
 * Stripe Embedded Checkout configuration boundary.
 *
 * Secrets must be supplied by wp-config.php/constants or filters. No Stripe
 * secret, webhook secret, or restricted key is ever emitted to the browser.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_StripeEmbeddedCheckoutConfig {
	public const GATEWAY_ID       = 'stripe_embedded_checkout';
	public const PAYMENT_PROVIDER = 'stripe_embedded_checkout';
	public const CONTRACT_VERSION = '5';
	public const SESSION_TTL      = 3600;

	public static function publishable_key(): string {
		$key = defined( 'DTB_STRIPE_PUBLISHABLE_KEY' ) ? (string) DTB_STRIPE_PUBLISHABLE_KEY : '';
		return sanitize_text_field( (string) apply_filters( 'dtb_stripe_embedded_publishable_key', $key ) );
	}

	public static function secret_key(): string {
		$key = defined( 'DTB_STRIPE_SECRET_KEY' ) ? (string) DTB_STRIPE_SECRET_KEY : '';
		return trim( (string) apply_filters( 'dtb_stripe_embedded_secret_key', $key ) );
	}

	public static function webhook_secret(): string {
		$secret = defined( 'DTB_STRIPE_WEBHOOK_SECRET' ) ? (string) DTB_STRIPE_WEBHOOK_SECRET : '';
		return trim( (string) apply_filters( 'dtb_stripe_embedded_webhook_secret', $secret ) );
	}

	public static function is_runtime_configured(): bool {
		return '' !== self::publishable_key() && '' !== self::secret_key();
	}

	public static function is_webhook_configured(): bool {
		return '' !== self::secret_key() && '' !== self::webhook_secret();
	}

	public static function allowed_countries(): array {
		$countries = apply_filters( 'dtb_stripe_embedded_allowed_countries', [ 'US' ] );
		$countries = array_map( static fn( $country ): string => strtoupper( sanitize_text_field( (string) $country ) ), is_array( $countries ) ? $countries : [ 'US' ] );
		$countries = array_values( array_filter( array_unique( $countries ), static fn( string $country ): bool => 2 === strlen( $country ) ) );
		return empty( $countries ) ? [ 'US' ] : $countries;
	}

	public static function currency(): string {
		$currency = function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'USD';
		return strtolower( sanitize_text_field( (string) apply_filters( 'dtb_stripe_embedded_currency', $currency ) ) );
	}

	public static function automatic_tax_enabled(): bool {
		return (bool) apply_filters( 'dtb_stripe_embedded_automatic_tax_enabled', false );
	}

	public static function allow_promotion_codes(): bool {
		return (bool) apply_filters( 'dtb_stripe_embedded_allow_promotion_codes', false );
	}

	public static function return_url(): string {
		$base = function_exists( 'dtb_detect_storefront_base_path' ) ? dtb_detect_storefront_base_path() : '';
		$path = trailingslashit( home_url( ltrim( (string) $base, '/' ) ) );
		$url  = $path . 'checkout/complete?stripe_session_id={CHECKOUT_SESSION_ID}';
		return esc_url_raw( (string) apply_filters( 'dtb_stripe_embedded_return_url', $url ) );
	}
}
