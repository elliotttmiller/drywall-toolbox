<?php
/**
 * DTB Payment Webhook Idempotency — event ID extraction.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_payment_webhook_extract_event_id( string $gateway, array $payload ): ?string {
	switch ( $gateway ) {
		case 'stripe':
			return ! empty( $payload['id'] ) ? sanitize_text_field( (string) $payload['id'] ) : null;

		case 'paypal':
			return ! empty( $payload['id'] ) ? sanitize_text_field( (string) $payload['id'] ) : null;

		default:
			return apply_filters( "dtb_payment_webhook_event_id_{$gateway}", null, $payload );
	}
}
