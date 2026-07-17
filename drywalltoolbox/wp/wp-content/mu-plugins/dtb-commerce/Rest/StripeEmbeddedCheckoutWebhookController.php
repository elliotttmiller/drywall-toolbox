<?php
/**
 * Public Stripe webhook endpoint for Embedded Checkout.
 *
 * The route is intentionally public because Stripe cannot present browser
 * origin/cookie credentials. Authorization is the Stripe-Signature HMAC.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_StripeEmbeddedCheckoutWebhookController {
	public static function register(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ], 30 );
	}

	public static function register_routes(): void {
		register_rest_route( 'dtb/v1', '/stripe/embedded-checkout/webhook', [
			'methods'             => WP_REST_Server::CREATABLE,
			'callback'            => [ __CLASS__, 'webhook' ],
			'permission_callback' => '__return_true',
		] );
	}

	public static function webhook( WP_REST_Request $request ): WP_REST_Response {
		$payload   = (string) $request->get_body();
		$signature = (string) $request->get_header( 'stripe-signature' );
		$verified  = DTB_StripeEmbeddedCheckoutBridge::verify_webhook_signature( $payload, $signature );
		if ( is_wp_error( $verified ) ) {
			return self::error_response( $verified );
		}

		$event = json_decode( $payload, true );
		if ( ! is_array( $event ) ) {
			return self::error_response( new WP_Error( 'dtb_stripe_webhook_invalid_json', 'Invalid Stripe webhook payload.', [ 'status' => 400 ] ) );
		}

		$result = DTB_StripeEmbeddedCheckoutBridge::handle_webhook_event( $event );
		if ( is_wp_error( $result ) ) {
			return self::error_response( $result );
		}
		return new WP_REST_Response( [ 'received' => true, 'result' => $result ], 200 );
	}

	private static function error_response( WP_Error $error ): WP_REST_Response {
		$status = (int) ( $error->get_error_data()['status'] ?? 400 );
		$body = function_exists( 'dtb_error_envelope' )
			? dtb_error_envelope( $error->get_error_code(), $error->get_error_message(), $status )
			: [ 'code' => $error->get_error_code(), 'message' => $error->get_error_message() ];
		return new WP_REST_Response( $body, $status );
	}
}

DTB_StripeEmbeddedCheckoutWebhookController::register();
