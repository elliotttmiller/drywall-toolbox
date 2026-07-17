<?php
/**
 * REST routes for Stripe-first Embedded Checkout.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_StripeEmbeddedCheckoutRestController {
	public static function register(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ], 30 );
	}

	public static function permission( WP_REST_Request $request ): bool {
		return function_exists( 'dtb_check_origin' ) && dtb_check_origin();
	}

	public static function register_routes(): void {
		register_rest_route( 'dtb/v1', '/checkout/stripe-embedded/config', [
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => [ __CLASS__, 'config' ],
			'permission_callback' => [ __CLASS__, 'permission' ],
		] );
		register_rest_route( 'dtb/v1', '/checkout/stripe-embedded/session', [
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => [ __CLASS__, 'session' ],
			'permission_callback' => [ __CLASS__, 'permission' ],
		] );
		register_rest_route( 'dtb/v1', '/checkout/stripe-embedded/shipping-options', [
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => [ __CLASS__, 'shipping_options' ],
			'permission_callback' => [ __CLASS__, 'permission' ],
		] );
		register_rest_route( 'dtb/v1', '/checkout/stripe-embedded/status', [
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => [ __CLASS__, 'status' ],
			'permission_callback' => [ __CLASS__, 'permission' ],
		] );
	}

	public static function config(): WP_REST_Response {
		$config = class_exists( 'DTB_StripeEmbeddedCheckoutBridge' ) ? DTB_StripeEmbeddedCheckoutBridge::config() : [ 'available' => false ];
		return new WP_REST_Response( [ 'stripe_embedded_checkout' => $config ], 200 );
	}

	public static function session( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		return self::mutation( $request, 'stripe_embedded_checkout_session', static function ( array $payload ) {
			return DTB_StripeEmbeddedCheckoutBridge::create_session( $payload );
		} );
	}

	public static function shipping_options( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		return self::mutation( $request, 'stripe_embedded_shipping_options', static function ( array $payload ) {
			return DTB_StripeEmbeddedCheckoutBridge::update_shipping_options( $payload );
		} );
	}

	public static function status( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		return self::mutation( $request, 'stripe_embedded_checkout_status', static function ( array $payload ) {
			return DTB_StripeEmbeddedCheckoutBridge::status( $payload );
		} );
	}

	private static function mutation( WP_REST_Request $request, string $route_key, callable $callback ): WP_REST_Response|WP_Error {
		if ( function_exists( 'dtb_rate_limit' ) ) {
			$limited = dtb_rate_limit( $request, $route_key );
			if ( $limited instanceof WP_REST_Response ) {
				return $limited;
			}
		}
		$payload = $request->get_json_params();
		if ( ! is_array( $payload ) ) {
			$payload = $request->get_params();
		}
		$result = $callback( is_array( $payload ) ? $payload : [] );
		return self::response( $result );
	}

	private static function response( $result ): WP_REST_Response|WP_Error {
		if ( is_wp_error( $result ) ) {
			$status = (int) ( $result->get_error_data()['status'] ?? 400 );
			$body = function_exists( 'dtb_error_envelope' )
				? dtb_error_envelope( $result->get_error_code(), $result->get_error_message(), $status )
				: [ 'code' => $result->get_error_code(), 'message' => $result->get_error_message() ];
			$data = $result->get_error_data();
			if ( is_array( $data ) && isset( $data['action'] ) ) {
				$body['action'] = $data['action'];
			}
			return new WP_REST_Response( $body, $status );
		}
		return new WP_REST_Response( $result, 200 );
	}
}

DTB_StripeEmbeddedCheckoutRestController::register();
