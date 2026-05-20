<?php
/**
 * DTB Handle Payment Webhook — gateway dispatch and event handlers.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_payment_webhook_dispatch( string $gateway, array $payload, ?string $idempotency_key ): true|WP_Error {
	switch ( $gateway ) {
		case 'stripe':
			return dtb_payment_webhook_handle_stripe( $payload, $idempotency_key );

		case 'paypal':
			return dtb_payment_webhook_handle_paypal( $payload, $idempotency_key );

		default:
			return new WP_Error( 'dtb_webhook_unsupported', "Unsupported gateway: {$gateway}", [ 'status' => 400 ] );
	}
}

function dtb_payment_webhook_handle_stripe( array $payload, ?string $idempotency_key ): true|WP_Error {
	$event_type = sanitize_text_field( $payload['type'] ?? '' );
	$data_obj   = $payload['data']['object'] ?? [];

	switch ( $event_type ) {
		case 'payment_intent.succeeded':
		case 'checkout.session.completed':
		case 'checkout.session.async_payment_succeeded':
			return dtb_payment_webhook_process_stripe_success( $data_obj, $idempotency_key, $event_type );

		case 'payment_intent.payment_failed':
		case 'checkout.session.async_payment_failed':
			return dtb_payment_webhook_process_stripe_failure( $data_obj, $idempotency_key, $event_type );

		case 'charge.refunded':
			return dtb_payment_webhook_process_stripe_refund( $data_obj, $idempotency_key );

		default:
			return true;
	}
}

function dtb_payment_webhook_process_stripe_success( array $data_obj, ?string $idempotency_key, string $event_type ): true|WP_Error {
	$order = dtb_payment_webhook_find_order_by_stripe( $data_obj );
	if ( ! $order ) {
		return true;
	}

	$order_id = (int) $order->get_id();

	if ( in_array( $order->get_status(), [ 'pending', 'on-hold', 'failed' ], true ) ) {
		$payment_intent_id = $data_obj['payment_intent'] ?? $data_obj['id'] ?? null;
		if ( $payment_intent_id ) {
			$order->update_meta_data( '_stripe_intent_id', sanitize_text_field( (string) $payment_intent_id ) );
			$order->save_meta_data();
		}

		$order->payment_complete( $payment_intent_id );
	}

	dtb_order_append_event( $order_id, 'order.payment_confirmed', [
		'source'          => 'webhook',
		'actor_type'      => 'payment_gateway',
		'visibility'      => 'customer',
		'idempotency_key' => $idempotency_key,
		'payload'         => [
			'gateway'    => 'stripe',
			'event_type' => $event_type,
		],
	] );

	return true;
}

function dtb_payment_webhook_process_stripe_failure( array $data_obj, ?string $idempotency_key, string $event_type ): true|WP_Error {
	$order = dtb_payment_webhook_find_order_by_stripe( $data_obj );
	if ( ! $order ) {
		return true;
	}

	$order_id = (int) $order->get_id();

	if ( in_array( $order->get_status(), [ 'pending', 'on-hold' ], true ) ) {
		$order->update_status( 'failed', __( 'Stripe payment failed via webhook.', 'drywall-toolbox' ) );
	}

	dtb_order_append_event( $order_id, 'order.payment_failed', [
		'source'          => 'webhook',
		'actor_type'      => 'payment_gateway',
		'visibility'      => 'customer',
		'idempotency_key' => $idempotency_key,
		'payload'         => [
			'gateway'    => 'stripe',
			'event_type' => $event_type,
		],
	] );

	dtb_order_enqueue_job( 'dtb_order_send_notification', $order_id, [ 'template' => 'payment-failed' ] );

	return true;
}

function dtb_payment_webhook_process_stripe_refund( array $data_obj, ?string $idempotency_key ): true|WP_Error {
	$order = dtb_payment_webhook_find_order_by_stripe( $data_obj );
	if ( ! $order ) {
		return true;
	}

	$order_id = (int) $order->get_id();

	dtb_order_append_event( $order_id, 'order.refund_requested', [
		'source'          => 'webhook',
		'actor_type'      => 'payment_gateway',
		'visibility'      => 'customer',
		'idempotency_key' => $idempotency_key,
		'payload'         => [ 'gateway' => 'stripe' ],
	] );

	dtb_order_enqueue_job( 'dtb_order_handle_refund', $order_id );
	dtb_order_enqueue_job( 'dtb_order_sync_quickbooks', $order_id, [ 'action' => 'refund' ] );

	return true;
}

function dtb_payment_webhook_handle_paypal( array $payload, ?string $idempotency_key ): true|WP_Error {
	$event_type = sanitize_text_field( $payload['event_type'] ?? '' );
	$resource   = $payload['resource'] ?? [];

	switch ( $event_type ) {
		case 'PAYMENT.CAPTURE.COMPLETED':
		case 'CHECKOUT.ORDER.COMPLETED':
			return dtb_payment_webhook_process_paypal_success( $resource, $idempotency_key );

		case 'PAYMENT.CAPTURE.DENIED':
		case 'PAYMENT.CAPTURE.DECLINED':
			return dtb_payment_webhook_process_paypal_failure( $resource, $idempotency_key );

		case 'PAYMENT.CAPTURE.REFUNDED':
			return dtb_payment_webhook_process_paypal_refund( $resource, $idempotency_key );

		default:
			return true;
	}
}

function dtb_payment_webhook_process_paypal_success( array $resource, ?string $idempotency_key ): true|WP_Error {
	$order = dtb_payment_webhook_find_order_by_paypal( $resource );
	if ( ! $order ) {
		return true;
	}

	$order_id = (int) $order->get_id();

	if ( in_array( $order->get_status(), [ 'pending', 'on-hold' ], true ) ) {
		$order->payment_complete( $resource['id'] ?? '' );
	}

	dtb_order_append_event( $order_id, 'order.payment_confirmed', [
		'source'          => 'webhook',
		'actor_type'      => 'payment_gateway',
		'visibility'      => 'customer',
		'idempotency_key' => $idempotency_key,
		'payload'         => [ 'gateway' => 'paypal' ],
	] );

	return true;
}

function dtb_payment_webhook_process_paypal_failure( array $resource, ?string $idempotency_key ): true|WP_Error {
	$order = dtb_payment_webhook_find_order_by_paypal( $resource );
	if ( ! $order ) {
		return true;
	}

	$order_id = (int) $order->get_id();

	if ( in_array( $order->get_status(), [ 'pending', 'on-hold' ], true ) ) {
		$order->update_status( 'failed', __( 'PayPal payment failed via webhook.', 'drywall-toolbox' ) );
	}

	dtb_order_append_event( $order_id, 'order.payment_failed', [
		'source'          => 'webhook',
		'actor_type'      => 'payment_gateway',
		'visibility'      => 'customer',
		'idempotency_key' => $idempotency_key,
		'payload'         => [ 'gateway' => 'paypal' ],
	] );

	return true;
}

function dtb_payment_webhook_process_paypal_refund( array $resource, ?string $idempotency_key ): true|WP_Error {
	$order = dtb_payment_webhook_find_order_by_paypal( $resource );
	if ( ! $order ) {
		return true;
	}

	$order_id = (int) $order->get_id();

	dtb_order_append_event( $order_id, 'order.refund_requested', [
		'source'          => 'webhook',
		'actor_type'      => 'payment_gateway',
		'visibility'      => 'customer',
		'idempotency_key' => $idempotency_key,
		'payload'         => [ 'gateway' => 'paypal' ],
	] );

	dtb_order_enqueue_job( 'dtb_order_handle_refund', $order_id );

	return true;
}
