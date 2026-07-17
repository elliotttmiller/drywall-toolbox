<?php
defined( 'ABSPATH' ) || exit;

final class DTB_CheckoutRestController {
	public static function register(): void {
		add_action( 'rest_api_init', [ __CLASS__, 'register_routes' ], 30 );
	}

	public static function permission( WP_REST_Request $request ): bool {
		return function_exists( 'dtb_check_origin' ) && dtb_check_origin();
	}

	public static function register_routes(): void {
		$routes = [
			[ '/checkout/capabilities', WP_REST_Server::READABLE, 'capabilities' ],
			[ '/checkout/status', WP_REST_Server::READABLE, 'status' ],
			[ '/checkout/quote', WP_REST_Server::CREATABLE, 'quote' ],
			[ '/checkout/tax-preview', WP_REST_Server::CREATABLE, 'tax_preview' ],
			[ '/checkout/session', WP_REST_Server::CREATABLE, 'session' ],
			[ '/checkout/confirm', WP_REST_Server::CREATABLE, 'confirm' ],
			[ '/checkout/finalize', WP_REST_Server::CREATABLE, 'finalize' ],
			[ '/checkout/payment-surface', WP_REST_Server::CREATABLE, 'payment_surface' ],
			[ '/checkout/resume-payment', WP_REST_Server::CREATABLE, 'resume_payment' ],
			[ '/checkout/cancel', WP_REST_Server::CREATABLE, 'cancel' ],
		];
		foreach ( $routes as [ $path, $method, $callback ] ) {
			register_rest_route( 'dtb/v1', $path, [
				'methods'             => $method,
				'callback'            => [ __CLASS__, $callback ],
				'permission_callback' => [ __CLASS__, 'permission' ],
			] );
		}
	}

	public static function capabilities(): WP_REST_Response {
		$capabilities = DTB_OrderCheckoutService::capabilities();
		$methods      = (array) ( $capabilities['gateways'][0]['payment_methods'] ?? [] );
		if ( class_exists( 'DTB_CheckoutBlocksCapabilityDetector' ) ) {
			$capabilities['payment_architecture'] = DTB_CheckoutBlocksCapabilityDetector::detect( $methods );
		}
		return new WP_REST_Response( [ 'capabilities' => $capabilities ], 200 );
	}

	public static function status( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$result = DTB_OrderCheckoutService::status( self::request_payload( $request ) );
		return self::response( $result );
	}

	public static function quote( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		return self::run_mutation( $request, 'checkout_quote', static function ( array $payload ) {
			$result = DTB_OrderCheckoutService::quote( $payload );
			return is_wp_error( $result ) ? $result : [ 'quote' => $result ];
		} );
	}

	public static function tax_preview( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		return self::run_mutation( $request, 'checkout_tax_preview', static function ( array $payload ) {
			$result = DTB_OrderCheckoutService::quote( $payload );
			if ( is_wp_error( $result ) ) {
				return $result;
			}
			return [ 'tax' => (float) ( $result['totals']['tax'] ?? 0 ), 'quote' => $result ];
		} );
	}

	public static function session( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		return self::run_mutation( $request, 'checkout_session', static function ( array $payload ) {
			return DTB_OrderCheckoutService::create_session( $payload );
		} );
	}

	public static function confirm( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		return self::run_mutation( $request, 'checkout_confirm', static function ( array $payload ) {
			return DTB_OrderCheckoutService::confirm( $payload );
		} );
	}

	public static function finalize( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		return self::run_mutation( $request, 'checkout_finalize', static function ( array $payload ) {
			return DTB_OrderCheckoutService::finalize( $payload );
		} );
	}

	public static function payment_surface( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		return self::run_mutation( $request, 'checkout_payment_surface', static function ( array $payload ) {
			if ( ! class_exists( 'DTB_CheckoutPaymentSurface' ) || ! DTB_CheckoutPaymentSurface::surface_available() ) {
				return new WP_Error( 'dtb_checkout_payment_surface_unavailable', 'The checkout payment surface is not available.', [ 'status' => 503 ] );
			}
			$order_id  = absint( $payload['order_id'] ?? 0 );
			$order_key = sanitize_text_field( (string) ( $payload['order_key'] ?? '' ) );
			if ( $order_id <= 0 || '' === $order_key ) {
				return new WP_Error( 'dtb_checkout_payment_surface_context_required', 'order_id and order_key are required for the payment surface.', [ 'status' => 400 ] );
			}
			$order = wc_get_order( $order_id );
			if ( ! $order instanceof WC_Order ) {
				return new WP_Error( 'dtb_checkout_payment_surface_order_missing', 'The checkout order could not be loaded.', [ 'status' => 404 ] );
			}
			if ( ! hash_equals( (string) $order->get_order_key(), $order_key ) ) {
				return new WP_Error( 'dtb_checkout_payment_surface_forbidden', 'The checkout payment surface is not authorized for this order.', [ 'status' => 403 ] );
			}
			$row = class_exists( 'DTB_OrderCheckoutSessionRepository' ) ? DTB_OrderCheckoutSessionRepository::find_by_order_id( $order_id ) : null;
			if ( ! is_array( $row ) ) {
				return new WP_Error( 'dtb_checkout_payment_surface_session_missing', 'The checkout session for this order could not be verified.', [ 'status' => 409 ] );
			}
			$owner = self::assert_payment_surface_owner( $row, $order );
			if ( is_wp_error( $owner ) ) {
				return $owner;
			}
			return [
				'payment_surface' => [
					'url'              => DTB_CheckoutPaymentSurface::payment_surface_url( $order ),
					'order_id'         => $order_id,
					'contract_version' => '4',
					'expires_in'       => 900,
				],
			];
		} );
	}

	public static function resume_payment( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		return self::run_mutation( $request, 'checkout_resume_payment', static function ( array $payload ) {
			return DTB_OrderCheckoutService::resume_payment( $payload );
		} );
	}

	public static function cancel( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		return self::run_mutation( $request, 'checkout_cancel', static function ( array $payload ) {
			return DTB_OrderCheckoutService::cancel( $payload );
		} );
	}

	private static function assert_payment_surface_owner( array $row, WC_Order $order ): true|WP_Error {
		if ( (int) ( $row['order_id'] ?? 0 ) !== (int) $order->get_id() ) {
			return new WP_Error( 'dtb_checkout_payment_surface_order_mismatch', 'The checkout payment surface order could not be verified.', [ 'status' => 403 ] );
		}
		if ( ! hash_equals( (string) ( $row['session_id'] ?? '' ), (string) $order->get_meta( '_dtb_checkout_session_id', true ) ) ) {
			return new WP_Error( 'dtb_checkout_payment_surface_session_mismatch', 'The checkout session for this order could not be verified.', [ 'status' => 403 ] );
		}
		if ( ! hash_equals( (string) ( $row['cart_hash'] ?? '' ), (string) $order->get_meta( '_dtb_checkout_cart_hash', true ) ) ) {
			return new WP_Error( 'dtb_checkout_payment_surface_cart_mismatch', 'The checkout cart context for this order could not be verified.', [ 'status' => 403 ] );
		}
		if ( ! in_array( (string) ( $row['state'] ?? '' ), [ 'order_created', 'payment_pending' ], true ) ) {
			return new WP_Error( 'dtb_checkout_payment_surface_invalid_state', 'This checkout is not ready for payment.', [ 'status' => 409 ] );
		}

		$identity = class_exists( 'DTB_CheckoutValidator' ) ? DTB_CheckoutValidator::customer_identity() : [ 'customer_id' => get_current_user_id(), 'customer_session_hash' => '' ];
		$same_cart = '' !== (string) ( $identity['customer_session_hash'] ?? '' )
			&& hash_equals( (string) ( $row['woo_session_identifier'] ?? '' ), (string) $identity['customer_session_hash'] );
		$identity_customer_id = (int) ( $identity['customer_id'] ?? 0 );
		$same_customer = $identity_customer_id > 0
			&& (int) ( $row['customer_id'] ?? 0 ) === $identity_customer_id
			&& (int) $order->get_customer_id() === $identity_customer_id;
		if ( ! $same_cart && ! $same_customer ) {
			return new WP_Error( 'dtb_checkout_payment_surface_owner_forbidden', 'Checkout session ownership could not be verified.', [ 'status' => 403 ] );
		}

		return true;
	}

	private static function run_mutation( WP_REST_Request $request, string $route_key, callable $callback ): WP_REST_Response|WP_Error {
		if ( function_exists( 'dtb_rate_limit' ) ) {
			$limited = dtb_rate_limit( $request, $route_key );
			if ( $limited instanceof WP_REST_Response ) {
				return $limited;
			}
		}
		$payload = self::request_payload( $request );
		$result  = $callback( is_array( $payload ) ? $payload : [] );
		return self::response( $result );
	}

	private static function request_payload( WP_REST_Request $request ): array {
		$payload = $request->get_json_params();
		if ( ! is_array( $payload ) ) {
			$payload = $request->get_params();
		}
		return is_array( $payload ) ? $payload : [];
	}

	private static function response( $result ): WP_REST_Response|WP_Error {
		if ( is_wp_error( $result ) ) {
			$status = (int) ( $result->get_error_data()['status'] ?? 400 );
			return new WP_REST_Response( function_exists( 'dtb_error_envelope' ) ? dtb_error_envelope( $result->get_error_code(), $result->get_error_message(), $status ) : [ 'code' => $result->get_error_code(), 'message' => $result->get_error_message() ], $status );
		}
		return new WP_REST_Response( $result, 200 );
	}
}

DTB_CheckoutRestController::register();
