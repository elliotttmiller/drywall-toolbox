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
