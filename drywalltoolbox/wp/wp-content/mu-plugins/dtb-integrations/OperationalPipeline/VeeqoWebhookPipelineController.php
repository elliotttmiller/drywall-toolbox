<?php
/**
 * DTB Integrations — Veeqo Webhook Pipeline Controller.
 *
 * Overrides the legacy Veeqo order webhook route so inbound Veeqo events update
 * WooCommerce while also writing DTB order events, integration state, tracking
 * projection, and suppressing webhook-origin echo writes back to Veeqo.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', 'dtb_operational_pipeline_register_veeqo_webhook_route', 20 );

if ( ! function_exists( 'dtb_operational_pipeline_register_veeqo_webhook_route' ) ) {
	/** Register the pipeline-aware Veeqo webhook route override. */
	function dtb_operational_pipeline_register_veeqo_webhook_route(): void {
		register_rest_route(
			'dtb/v1',
			'/veeqo/webhooks/order',
			[
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => 'dtb_operational_pipeline_veeqo_webhook_order',
				'permission_callback' => '__return_true',
			],
			true
		);
	}
}

if ( ! function_exists( 'dtb_operational_pipeline_veeqo_response' ) ) {
	/**
	 * Build a Veeqo webhook response.
	 *
	 * @param string $code    Machine code.
	 * @param string $message Human message.
	 * @param int    $status  HTTP status.
	 * @param array  $extra   Extra data.
	 * @return WP_REST_Response
	 */
	function dtb_operational_pipeline_veeqo_response( string $code, string $message, int $status = 200, array $extra = [] ): WP_REST_Response {
		$payload = array_merge(
			[
				'success' => $status >= 200 && $status < 300,
				'code'    => sanitize_key( $code ),
				'message' => $message,
			],
			$extra
		);

		return new WP_REST_Response( $payload, $status );
	}
}

if ( ! function_exists( 'dtb_operational_pipeline_validate_veeqo_webhook_signature' ) ) {
	/**
	 * Validate Veeqo webhook HMAC when a secret is configured.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_Error|null
	 */
	function dtb_operational_pipeline_validate_veeqo_webhook_signature( WP_REST_Request $request ): ?WP_Error {
		$cfg    = function_exists( 'dtb_veeqo_config' ) ? dtb_veeqo_config() : [];
		$secret = (string) ( $cfg['webhook_secret'] ?? '' );

		if ( '' === $secret ) {
			return null;
		}

		$raw_body  = $request->get_body();
		$signature = (string) ( $request->get_header( 'x_veeqo_signature' ) ?: $request->get_header( 'x-veeqo-signature' ) );
		if ( '' === $signature ) {
			return new WP_Error( 'missing_signature', 'Webhook signature is required.', [ 'status' => 401 ] );
		}

		$expected = hash_hmac( 'sha256', $raw_body, $secret );
		if ( ! hash_equals( strtolower( $expected ), strtolower( trim( $signature ) ) ) ) {
			return new WP_Error( 'invalid_signature', 'Webhook signature mismatch.', [ 'status' => 401 ] );
		}

		return null;
	}
}

if ( ! function_exists( 'dtb_operational_pipeline_find_order_by_order_number' ) ) {
	/**
	 * Locate a Woo order by order number.
	 *
	 * @param string $order_number Woo order number.
	 * @return WC_Order|null
	 */
	function dtb_operational_pipeline_find_order_by_order_number( string $order_number ): ?WC_Order {
		if ( ! function_exists( 'wc_get_orders' ) || '' === $order_number ) {
			return null;
		}

		$orders = wc_get_orders( [
			'order_number' => $order_number,
			'limit'        => 1,
			'return'       => 'objects',
		] );

		return ! empty( $orders[0] ) && $orders[0] instanceof WC_Order ? $orders[0] : null;
	}
}

if ( ! function_exists( 'dtb_operational_pipeline_extract_veeqo_tracking' ) ) {
	/**
	 * Extract tracking data from a Veeqo webhook payload.
	 *
	 * @param array $payload Payload.
	 * @return array{tracking_number:string,tracking_carrier:string}
	 */
	function dtb_operational_pipeline_extract_veeqo_tracking( array $payload ): array {
		$tracking_number = sanitize_text_field( (string) ( $payload['tracking_number'] ?? ( $payload['shipments'][0]['tracking_number'] ?? '' ) ) );
		$carrier         = sanitize_text_field( (string) ( $payload['carrier'] ?? $payload['tracking_carrier'] ?? ( $payload['shipments'][0]['tracking_carrier'] ?? '' ) ) );

		return [
			'tracking_number'  => $tracking_number,
			'tracking_carrier' => $carrier,
		];
	}
}

if ( ! function_exists( 'dtb_operational_pipeline_veeqo_webhook_order' ) ) {
	/**
	 * Pipeline-aware Veeqo order webhook handler.
	 *
	 * @param WP_REST_Request $request Request.
	 * @return WP_REST_Response|WP_Error
	 */
	function dtb_operational_pipeline_veeqo_webhook_order( WP_REST_Request $request ): WP_REST_Response|WP_Error {
		$signature_error = dtb_operational_pipeline_validate_veeqo_webhook_signature( $request );
		if ( $signature_error instanceof WP_Error ) {
			if ( function_exists( 'dtb_veeqo_log' ) ) {
				dtb_veeqo_log( 'warn', $signature_error->get_error_code(), $signature_error->get_error_message() );
			}
			return $signature_error;
		}

		$payload = $request->get_json_params();
		if ( empty( $payload ) || ! is_array( $payload ) ) {
			return dtb_operational_pipeline_veeqo_response( 'invalid_body', 'Empty or invalid JSON payload.', 400 );
		}

		$veeqo_status   = strtolower( sanitize_text_field( (string) ( $payload['status'] ?? '' ) ) );
		$veeqo_order_id = absint( $payload['id'] ?? 0 );
		$order_number   = sanitize_text_field( (string) ( $payload['channel_order_number'] ?? '' ) );

		$status_map = [
			'awaiting_fulfillment' => 'processing',
			'allocated'            => 'processing',
			'printed'              => 'processing',
			'shipped'              => 'completed',
			'cancelled'            => 'cancelled',
			'refunded'             => 'refunded',
		];

		$wc_status = $status_map[ $veeqo_status ] ?? null;
		if ( null === $wc_status ) {
			if ( function_exists( 'dtb_veeqo_log' ) ) {
				dtb_veeqo_log( 'debug', 'webhook_unmapped_status', 'Veeqo status has no WC mapping.', [ 'veeqo_status' => $veeqo_status, 'veeqo_order_id' => $veeqo_order_id ] );
			}
			return dtb_operational_pipeline_veeqo_response( 'status_unmapped', 'Status not mapped; skipped.', 200, [ 'veeqo_order_id' => $veeqo_order_id, 'veeqo_status' => $veeqo_status ] );
		}

		if ( '' === $order_number ) {
			if ( function_exists( 'dtb_veeqo_log' ) ) {
				dtb_veeqo_log( 'warn', 'webhook_no_wc_order', 'Veeqo webhook missing channel_order_number.', [ 'veeqo_order_id' => $veeqo_order_id ] );
			}
			return dtb_operational_pipeline_veeqo_response( 'missing_order_number', 'No WooCommerce order number; skipped.', 200, [ 'veeqo_order_id' => $veeqo_order_id ] );
		}

		$order = dtb_operational_pipeline_find_order_by_order_number( $order_number );
		if ( ! $order instanceof WC_Order ) {
			if ( function_exists( 'dtb_veeqo_log' ) ) {
				dtb_veeqo_log( 'warn', 'webhook_wc_order_not_found', 'WC order not found for Veeqo webhook.', [ 'wc_order_number' => $order_number, 'veeqo_order_id' => $veeqo_order_id ] );
			}
			return dtb_operational_pipeline_veeqo_response( 'order_not_found', 'WooCommerce order not found.', 404, [ 'order_number' => $order_number, 'veeqo_order_id' => $veeqo_order_id ] );
		}

		$order_id    = (int) $order->get_id();
		$prev_status = $order->get_status();
		$tracking    = 'shipped' === $veeqo_status ? dtb_operational_pipeline_extract_veeqo_tracking( $payload ) : [ 'tracking_number' => '', 'tracking_carrier' => '' ];

		if ( $veeqo_order_id > 0 ) {
			$order->update_meta_data( '_veeqo_order_id', $veeqo_order_id );
			$order->update_meta_data( '_dtb_veeqo_order_id', $veeqo_order_id );
		}

		if ( '' !== $tracking['tracking_number'] ) {
			$order->update_meta_data( '_tracking_number', $tracking['tracking_number'] );
			$order->update_meta_data( '_dtb_veeqo_tracking', $tracking['tracking_number'] );
			$order->update_meta_data( '_dtb_veeqo_tracking_number', $tracking['tracking_number'] );
			if ( '' !== $tracking['tracking_carrier'] ) {
				$order->update_meta_data( '_tracking_carrier', $tracking['tracking_carrier'] );
				$order->update_meta_data( '_dtb_veeqo_tracking_carrier', $tracking['tracking_carrier'] );
			}
		}
		$order->save_meta_data();

		$status_note = sprintf( '[Veeqo] Status synced from Veeqo order #%d (%s).', $veeqo_order_id, $veeqo_status );
		if ( '' !== $tracking['tracking_number'] ) {
			$status_note .= sprintf( ' Tracking: %s%s.', $tracking['tracking_number'], '' !== $tracking['tracking_carrier'] ? ' (' . $tracking['tracking_carrier'] . ')' : '' );
		}

		set_transient( 'dtb_veeqo_webhook_updating_order_' . $order_id, '1', 60 );
		if ( $prev_status !== $wc_status ) {
			$order->update_status( $wc_status, $status_note );
		} else {
			$order->add_order_note( $status_note );
		}
		delete_transient( 'dtb_veeqo_webhook_updating_order_' . $order_id );

		if ( function_exists( 'dtb_order_update_integration_state' ) ) {
			dtb_order_update_integration_state( $order_id, 'veeqo', [
				'status'          => 'synced',
				'order_id'        => $veeqo_order_id ?: null,
				'source_status'   => $veeqo_status,
				'tracking'        => $tracking['tracking_number'] ?: null,
				'carrier'         => $tracking['tracking_carrier'] ?: null,
				'last_success_at' => current_time( 'mysql', true ),
				'error'           => null,
			] );
		}

		if ( function_exists( 'dtb_order_append_event' ) ) {
			dtb_order_append_event( $order_id, 'integration.veeqo.webhook_received', [
				'source'          => 'veeqo_webhook',
				'actor_type'      => 'veeqo',
				'visibility'      => 'operator',
				'idempotency_key' => 'veeqo-webhook-' . $veeqo_order_id . '-' . $veeqo_status . '-' . md5( $request->get_body() ),
				'payload'         => [
					'from_status'      => $prev_status,
					'to_status'        => $wc_status,
					'veeqo_status'     => $veeqo_status,
					'veeqo_order_id'   => $veeqo_order_id,
					'tracking_number'  => $tracking['tracking_number'] ?: null,
					'tracking_carrier' => $tracking['tracking_carrier'] ?: null,
				],
			] );
		}

		if ( function_exists( 'dtb_order_enqueue_job' ) ) {
			dtb_order_enqueue_job( 'dtb_order_refresh_tracking_projection', $order_id );
		}

		if ( function_exists( 'dtb_veeqo_log_sync_timestamp' ) ) {
			dtb_veeqo_log_sync_timestamp( 'order_webhook' );
		}
		if ( function_exists( 'dtb_veeqo_log' ) ) {
			dtb_veeqo_log( 'info', 'webhook_status_synced_pipeline', 'WC order status updated from Veeqo webhook through operational pipeline.', [ 'wc_order_id' => $order_id, 'prev_status' => $prev_status, 'new_status' => $wc_status, 'veeqo_order_id' => $veeqo_order_id, 'veeqo_status' => $veeqo_status ] );
		}

		return dtb_operational_pipeline_veeqo_response( 'webhook_processed', 'Webhook processed.', 200, [
			'wc_order_id'    => $order_id,
			'new_status'     => $wc_status,
			'veeqo_order_id' => $veeqo_order_id,
		] );
	}
}
