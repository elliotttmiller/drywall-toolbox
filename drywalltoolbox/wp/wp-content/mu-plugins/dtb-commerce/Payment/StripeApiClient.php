<?php
/**
 * Narrow Stripe API client for DTB Embedded Checkout.
 *
 * Uses WordPress HTTP APIs and form encoding. This avoids depending on a
 * gateway plugin SDK while keeping Stripe secret-key usage server-only.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_StripeApiClient {
	private const API_BASE = 'https://api.stripe.com/v1';

	public static function create_checkout_session( array $params, string $idempotency_key ): array|WP_Error {
		return self::request( 'POST', '/checkout/sessions', $params, $idempotency_key );
	}

	public static function update_checkout_session( string $session_id, array $params ): array|WP_Error {
		$session_id = self::safe_id( $session_id );
		if ( '' === $session_id ) {
			return new WP_Error( 'dtb_stripe_invalid_session_id', 'Stripe checkout session id is required.', [ 'status' => 400 ] );
		}
		return self::request( 'POST', '/checkout/sessions/' . rawurlencode( $session_id ), $params );
	}

	public static function retrieve_checkout_session( string $session_id, array $expands = [] ): array|WP_Error {
		$session_id = self::safe_id( $session_id );
		if ( '' === $session_id ) {
			return new WP_Error( 'dtb_stripe_invalid_session_id', 'Stripe checkout session id is required.', [ 'status' => 400 ] );
		}
		$params = [];
		foreach ( array_values( array_filter( array_map( 'strval', $expands ) ) ) as $index => $expand ) {
			$params[ 'expand[' . $index . ']' ] = $expand;
		}
		$path = '/checkout/sessions/' . rawurlencode( $session_id );
		if ( ! empty( $params ) ) {
			$path .= '?' . http_build_query( $params, '', '&' );
		}
		return self::request( 'GET', $path );
	}

	private static function request( string $method, string $path, array $params = [], string $idempotency_key = '' ): array|WP_Error {
		if ( ! class_exists( 'DTB_StripeEmbeddedCheckoutConfig' ) ) {
			return new WP_Error( 'dtb_stripe_config_missing', 'Stripe Embedded Checkout configuration is unavailable.', [ 'status' => 503 ] );
		}
		$secret_key = DTB_StripeEmbeddedCheckoutConfig::secret_key();
		if ( '' === $secret_key ) {
			return new WP_Error( 'dtb_stripe_secret_missing', 'Stripe Embedded Checkout is not configured.', [ 'status' => 503 ] );
		}

		$args = [
			'timeout' => 20,
			'headers' => [
				'Authorization' => 'Bearer ' . $secret_key,
			],
		];
		if ( '' !== $idempotency_key ) {
			$args['headers']['Idempotency-Key'] = substr( sanitize_text_field( $idempotency_key ), 0, 255 );
		}
		if ( 'POST' === strtoupper( $method ) ) {
			$args['body'] = self::flatten( $params );
			$response = wp_remote_post( self::API_BASE . $path, $args );
		} else {
			$response = wp_remote_get( self::API_BASE . $path, $args );
		}

		if ( is_wp_error( $response ) ) {
			return new WP_Error( 'dtb_stripe_http_failed', 'Stripe request failed.', [ 'status' => 503 ] );
		}

		$status = (int) wp_remote_retrieve_response_code( $response );
		$body   = json_decode( (string) wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $body ) ) {
			return new WP_Error( 'dtb_stripe_invalid_response', 'Stripe returned an invalid response.', [ 'status' => 503 ] );
		}
		if ( $status < 200 || $status >= 300 ) {
			$message = sanitize_text_field( (string) ( $body['error']['message'] ?? 'Stripe rejected the checkout request.' ) );
			$code    = sanitize_key( (string) ( $body['error']['code'] ?? $body['error']['type'] ?? 'dtb_stripe_error' ) );
			return new WP_Error( 'dtb_stripe_' . ( $code ?: 'error' ), $message, [ 'status' => 502 ] );
		}

		return $body;
	}

	private static function safe_id( string $id ): string {
		$id = trim( sanitize_text_field( $id ) );
		return preg_match( '/^[A-Za-z0-9_\-]+$/', $id ) ? $id : '';
	}

	private static function flatten( array $value, string $prefix = '' ): array {
		$out = [];
		foreach ( $value as $key => $item ) {
			$name = '' === $prefix ? (string) $key : $prefix . '[' . $key . ']';
			if ( is_array( $item ) ) {
				$out += self::flatten( $item, $name );
				continue;
			}
			if ( is_bool( $item ) ) {
				$out[ $name ] = $item ? 'true' : 'false';
			} elseif ( null !== $item ) {
				$out[ $name ] = (string) $item;
			}
		}
		return $out;
	}
}
