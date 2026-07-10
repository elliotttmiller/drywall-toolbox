<?php
/**
 * DTB Payment Webhook Verifier — signature verification for payment gateways.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_payment_webhook_verify_signature( string $gateway, string $raw_body, WP_REST_Request $request ): true|WP_Error {
	switch ( $gateway ) {
		case 'paypal':
			return dtb_payment_webhook_verify_paypal( $raw_body, $request );

		default:
			$result = apply_filters( "dtb_payment_webhook_verify_{$gateway}", true, $raw_body, $request );
			return is_wp_error( $result ) ? $result : true;
	}
}

function dtb_payment_webhook_verify_paypal( string $raw_body, WP_REST_Request $request ): true|WP_Error {
	$webhook_id = defined( 'DTB_PAYPAL_WEBHOOK_ID' )
		? DTB_PAYPAL_WEBHOOK_ID
		: (string) get_option( 'dtb_paypal_webhook_id', '' );

	if ( '' === $webhook_id ) {
		return new WP_Error( 'dtb_webhook_no_paypal_webhook_id', 'PayPal webhook ID not configured.', [ 'status' => 500 ] );
	}

	/**
	 * PayPal webhook signatures require server-side verification with PayPal.
	 * A gateway integration must provide that verification through this filter;
	 * accepting a configured webhook ID alone would allow forged events.
	 */
	$result = apply_filters(
		'dtb_payment_webhook_verify_paypal',
		new WP_Error( 'dtb_webhook_paypal_verifier_unavailable', 'PayPal webhook verification requires a gateway integration.', [ 'status' => 500 ] ),
		$raw_body,
		$request,
		(string) $webhook_id
	);

	if ( true === $result ) {
		return true;
	}

	if ( is_wp_error( $result ) ) {
		return $result;
	}

	return new WP_Error( 'dtb_webhook_invalid_paypal_signature', 'PayPal webhook verification failed.', [ 'status' => 401 ] );
}

function dtb_is_production(): bool {
	if ( defined( 'DTB_IS_PRODUCTION' ) ) {
		return (bool) DTB_IS_PRODUCTION;
	}
	return ! ( defined( 'WP_DEBUG' ) && WP_DEBUG );
}
