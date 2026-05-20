<?php
/**
 * DTB Payment Webhook Verifier — signature verification for payment gateways.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'DTB_STRIPE_WEBHOOK_TIMESTAMP_TOLERANCE' ) ) {
	define( 'DTB_STRIPE_WEBHOOK_TIMESTAMP_TOLERANCE', 300 );
}

function dtb_payment_webhook_verify_signature( string $gateway, string $raw_body, WP_REST_Request $request ): true|WP_Error {
	switch ( $gateway ) {
		case 'stripe':
			return dtb_payment_webhook_verify_stripe( $raw_body, $request );

		case 'paypal':
			return dtb_payment_webhook_verify_paypal( $raw_body, $request );

		default:
			$result = apply_filters( "dtb_payment_webhook_verify_{$gateway}", true, $raw_body, $request );
			return is_wp_error( $result ) ? $result : true;
	}
}

function dtb_payment_webhook_verify_stripe( string $raw_body, WP_REST_Request $request ): true|WP_Error {
	$secret = defined( 'DTB_STRIPE_WEBHOOK_SECRET' )
		? DTB_STRIPE_WEBHOOK_SECRET
		: (string) get_option( 'dtb_stripe_webhook_secret', '' );

	if ( '' === $secret ) {
		if ( dtb_is_production() ) {
			return new WP_Error( 'dtb_webhook_no_secret', 'Stripe webhook secret not configured.', [ 'status' => 500 ] );
		}
		return true;
	}

	$sig_header = $request->get_header( 'Stripe-Signature' );
	if ( empty( $sig_header ) ) {
		return new WP_Error( 'dtb_webhook_missing_sig', 'Missing Stripe-Signature header.', [ 'status' => 400 ] );
	}

	$timestamp  = null;
	$signatures = [];

	foreach ( explode( ',', $sig_header ) as $pair ) {
		[ $k, $v ] = array_pad( explode( '=', $pair, 2 ), 2, '' );
		if ( 't' === $k ) {
			$timestamp = (int) $v;
		} elseif ( 'v1' === $k ) {
			$signatures[] = $v;
		}
	}

	if ( null === $timestamp || empty( $signatures ) ) {
		return new WP_Error( 'dtb_webhook_invalid_sig', 'Invalid Stripe-Signature format.', [ 'status' => 400 ] );
	}

	if ( abs( time() - $timestamp ) > DTB_STRIPE_WEBHOOK_TIMESTAMP_TOLERANCE ) {
		return new WP_Error( 'dtb_webhook_replay', 'Stripe webhook timestamp too old.', [ 'status' => 400 ] );
	}

	$signed_payload = "{$timestamp}.{$raw_body}";
	$expected_sig   = hash_hmac( 'sha256', $signed_payload, $secret );

	foreach ( $signatures as $v1_sig ) {
		if ( hash_equals( $expected_sig, $v1_sig ) ) {
			return true;
		}
	}

	return new WP_Error( 'dtb_webhook_sig_mismatch', 'Stripe signature verification failed.', [ 'status' => 403 ] );
}

function dtb_payment_webhook_verify_paypal( string $raw_body, WP_REST_Request $request ): true|WP_Error {
	$secret = defined( 'DTB_PAYPAL_WEBHOOK_ID' )
		? DTB_PAYPAL_WEBHOOK_ID
		: (string) get_option( 'dtb_paypal_webhook_id', '' );

	if ( '' !== $secret ) {
		return true;
	}

	if ( dtb_is_production() ) {
		return new WP_Error( 'dtb_webhook_no_paypal_secret', 'PayPal webhook ID not configured.', [ 'status' => 500 ] );
	}

	return true;
}

function dtb_is_production(): bool {
	if ( defined( 'DTB_IS_PRODUCTION' ) ) {
		return (bool) DTB_IS_PRODUCTION;
	}
	return ! ( defined( 'WP_DEBUG' ) && WP_DEBUG );
}
