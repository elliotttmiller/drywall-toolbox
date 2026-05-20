<?php
/**
 * DTB Payment Webhook Controller — route registration and main handler.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', 'dtb_payment_webhook_register_routes' );

function dtb_payment_webhook_register_routes(): void {
	register_rest_route( 'dtb/v1', '/webhooks/payment/(?P<gateway>[a-z0-9_\-]+)', [
		'methods'             => WP_REST_Server::CREATABLE,
		'callback'            => 'dtb_payment_webhook_handle',
		'permission_callback' => '__return_true',
		'args'                => [
			'gateway' => [
				'type'     => 'string',
				'required' => true,
				'enum'     => apply_filters( 'dtb_webhook_gateway_ids', [ 'stripe', 'paypal' ] ),
			],
		],
	] );
}

function dtb_payment_webhook_handle( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$gateway = sanitize_key( $request->get_param( 'gateway' ) );

	$raw_body = $request->get_body();

	if ( empty( $raw_body ) ) {
		return new WP_Error( 'dtb_webhook_empty', 'Empty webhook body.', [ 'status' => 400 ] );
	}

	$sig_valid = dtb_payment_webhook_verify_signature( $gateway, $raw_body, $request );
	if ( is_wp_error( $sig_valid ) ) {
		dtb_security_log( 'webhook_signature_failed', [ 'gateway' => $gateway ] );
		return $sig_valid;
	}

	$payload = json_decode( $raw_body, true );
	if ( ! is_array( $payload ) ) {
		return new WP_Error( 'dtb_webhook_invalid_json', 'Invalid JSON payload.', [ 'status' => 400 ] );
	}

	$event_id        = dtb_payment_webhook_extract_event_id( $gateway, $payload );
	$idempotency_key = $event_id ? "webhook:{$gateway}:{$event_id}" : null;

	if ( $idempotency_key && dtb_order_event_idempotency_exists( $idempotency_key ) ) {
		return new WP_REST_Response( [ 'received' => true, 'duplicate' => true ], 200 );
	}

	$result = apply_filters(
		"dtb_payment_webhook_handler_{$gateway}",
		dtb_payment_webhook_dispatch( $gateway, $payload, $idempotency_key ),
		$payload,
		$idempotency_key
	);

	if ( is_wp_error( $result ) ) {
		error_log( "[DTB Webhooks] Gateway '{$gateway}' handler returned error: " . $result->get_error_message() );
		return new WP_REST_Response( [ 'received' => true, 'error' => 'processing_error' ], 200 );
	}

	return new WP_REST_Response( [ 'received' => true ], 200 );
}
