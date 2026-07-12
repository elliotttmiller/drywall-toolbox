<?php
/**
 * Plugin Name: DTB Order Loop Containment Guard
 * Description: Production guard for duplicate WooCommerce order/email loops caused by integration polling, bridge writes, marketplace materialization, or repeated checkout handoff callbacks.
 * Version: 1.1.0
 * Author: Drywall Toolbox
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'DTB_ORDER_LOOP_CONTAINMENT_ENABLED' ) ) {
	define( 'DTB_ORDER_LOOP_CONTAINMENT_ENABLED', true );
}
if ( ! defined( 'DTB_ORDER_LOOP_DUPLICATE_WINDOW' ) ) {
	define( 'DTB_ORDER_LOOP_DUPLICATE_WINDOW', 6 * HOUR_IN_SECONDS );
}
if ( ! defined( 'DTB_ORDER_LOOP_AUTO_CANCEL_DUPLICATES' ) ) {
	define( 'DTB_ORDER_LOOP_AUTO_CANCEL_DUPLICATES', true );
}
if ( ! defined( 'DTB_ORDER_LOOP_DISABLE_MARKETPLACE_MATERIALIZATION' ) ) {
	define( 'DTB_ORDER_LOOP_DISABLE_MARKETPLACE_MATERIALIZATION', true );
}
if ( ! defined( 'DTB_ORDER_LOOP_DISABLE_LEGACY_VEEQO_DIRECT_SYNC' ) ) {
	define( 'DTB_ORDER_LOOP_DISABLE_LEGACY_VEEQO_DIRECT_SYNC', true );
}
if ( ! defined( 'DTB_ORDER_LOOP_BLOCK_WC_REST_ORDER_CREATION' ) ) {
	define( 'DTB_ORDER_LOOP_BLOCK_WC_REST_ORDER_CREATION', true );
}
if ( ! defined( 'DTB_ORDER_LOOP_RECENT_SCAN_LIMIT' ) ) {
	define( 'DTB_ORDER_LOOP_RECENT_SCAN_LIMIT', 75 );
}

if ( ! function_exists( 'dtb_order_loop_bool_constant' ) ) {
	/** Resolve a boolean constant with a safe default. */
	function dtb_order_loop_bool_constant( string $constant_name, bool $default ): bool {
		if ( ! defined( $constant_name ) ) {
			return $default;
		}
		return filter_var( constant( $constant_name ), FILTER_VALIDATE_BOOLEAN );
	}
}

if ( ! function_exists( 'dtb_order_loop_containment_enabled' ) ) {
	/** Return whether the containment layer is active. */
	function dtb_order_loop_containment_enabled(): bool {
		return dtb_order_loop_bool_constant( 'DTB_ORDER_LOOP_CONTAINMENT_ENABLED', true );
	}
}

if ( ! function_exists( 'dtb_order_loop_log' ) ) {
	/** Write structured containment diagnostics. */
	function dtb_order_loop_log( string $level, string $event, string $message, array $context = [] ): void {
		$context = array_merge(
			[
				'event' => sanitize_key( $event ),
				'ts'    => gmdate( 'c' ),
			],
			$context
		);

		if ( function_exists( 'wc_get_logger' ) ) {
			$map = [ 'debug' => 'debug', 'info' => 'info', 'warn' => 'warning', 'error' => 'error' ];
			wc_get_logger()->log( $map[ $level ] ?? 'info', $message, array_merge( [ 'source' => 'dtb-order-loop-containment' ], $context ) );
			return;
		}

		error_log( '[DTB Order Guard] ' . wp_json_encode( array_merge( [ 'level' => $level, 'message' => $message ], $context ) ) ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
	}
}

if ( ! function_exists( 'dtb_order_loop_remove_risky_side_effect_hooks' ) ) {
	/** Disable known recurring/order side-effect hooks while production containment is active. */
	function dtb_order_loop_remove_risky_side_effect_hooks(): void {
		if ( ! dtb_order_loop_containment_enabled() ) {
			return;
		}

		if ( dtb_order_loop_bool_constant( 'DTB_ORDER_LOOP_DISABLE_MARKETPLACE_MATERIALIZATION', true ) ) {
			remove_action( 'dtb_marketplace_materialize_unlinked', 'dtb_marketplace_materialize_unlinked_orders' );
			remove_action( 'dtb_marketplace_reconcile', 'dtb_marketplace_materialize_unlinked_orders', 20 );
			remove_action( 'wp', 'dtb_marketplace_schedule_materialization_jobs' );

			if ( function_exists( 'wp_clear_scheduled_hook' ) ) {
				wp_clear_scheduled_hook( 'dtb_marketplace_materialize_unlinked' );
			}
		}

		if ( dtb_order_loop_bool_constant( 'DTB_ORDER_LOOP_DISABLE_LEGACY_VEEQO_DIRECT_SYNC', true ) ) {
			remove_action( 'woocommerce_order_status_changed', 'dtb_veeqo_sync_order_status', 20 );
		}
	}
}

add_action( 'plugins_loaded', 'dtb_order_loop_remove_risky_side_effect_hooks', PHP_INT_MAX );
add_action( 'init', 'dtb_order_loop_remove_risky_side_effect_hooks', PHP_INT_MAX );
add_action( 'wp', 'dtb_order_loop_remove_risky_side_effect_hooks', PHP_INT_MAX );

if ( ! function_exists( 'dtb_order_loop_secret_allows_external_write' ) ) {
	/** Allow a deliberately configured external write through a private header/param. */
	function dtb_order_loop_secret_allows_external_write( WP_REST_Request $request ): bool {
		if ( ! defined( 'DTB_EXTERNAL_ORDER_WRITE_SECRET' ) || '' === trim( (string) DTB_EXTERNAL_ORDER_WRITE_SECRET ) ) {
			return false;
		}

		$provided = trim( (string) ( $request->get_header( 'x-dtb-external-order-secret' ) ?: $request->get_param( 'dtb_external_order_secret' ) ) );
		return '' !== $provided && hash_equals( (string) DTB_EXTERNAL_ORDER_WRITE_SECRET, $provided );
	}
}

if ( ! function_exists( 'dtb_order_loop_is_external_wc_order_create_request' ) ) {
	/** Detect direct WooCommerce REST order creation that bypasses the DTB checkout/order pipeline. */
	function dtb_order_loop_is_external_wc_order_create_request( WP_REST_Request $request ): bool {
		if ( 'POST' !== strtoupper( (string) $request->get_method() ) ) {
			return false;
		}

		$route = (string) $request->get_route();
		return (bool) preg_match( '#^/wc/v[1-3]/orders/?$#', $route );
	}
}

add_filter(
	'rest_pre_dispatch',
	static function ( $result, WP_REST_Server $server, WP_REST_Request $request ) {
		if ( null !== $result || ! dtb_order_loop_containment_enabled() ) {
			return $result;
		}

		if ( ! dtb_order_loop_bool_constant( 'DTB_ORDER_LOOP_BLOCK_WC_REST_ORDER_CREATION', true ) ) {
			return $result;
		}

		if ( ! dtb_order_loop_is_external_wc_order_create_request( $request ) ) {
			return $result;
		}

		if ( dtb_order_loop_secret_allows_external_write( $request ) ) {
			dtb_order_loop_log( 'warn', 'external_order_create_allowed', 'External WooCommerce REST order creation allowed by DTB_EXTERNAL_ORDER_WRITE_SECRET.' );
			return $result;
		}

		dtb_order_loop_log( 'error', 'external_order_create_blocked', 'Blocked external WooCommerce REST order creation. Orders must enter through the DTB checkout/order pipeline.', [
			'route'      => (string) $request->get_route(),
			'user_id'    => get_current_user_id(),
			'user_agent' => substr( sanitize_text_field( (string) ( $_SERVER['HTTP_USER_AGENT'] ?? '' ) ), 0, 240 ),
		] );

		return new WP_REST_Response(
			[
				'code'    => 'dtb_external_order_creation_blocked',
				'message' => 'External WooCommerce REST order creation is disabled. Use the DTB checkout/order pipeline or configure an explicit DTB_EXTERNAL_ORDER_WRITE_SECRET exception.',
			],
			403
		);
	},
	-100,
	3
);

if ( ! function_exists( 'dtb_order_loop_order_statuses' ) ) {
	/** Return the statuses considered when searching for duplicates. */
	function dtb_order_loop_order_statuses(): array {
		return [ 'pending', 'on-hold', 'processing', 'completed', 'failed' ];
	}
}

if ( ! function_exists( 'dtb_order_loop_line_signature' ) ) {
	/** Build a normalized line-item signature for an order. */
	function dtb_order_loop_line_signature( WC_Order $order ): array {
		$lines = [];

		foreach ( $order->get_items( 'line_item' ) as $item ) {
			if ( ! $item instanceof WC_Order_Item_Product ) {
				continue;
			}

			$product = $item->get_product();
			$sku     = $product ? (string) $product->get_sku() : '';

			$lines[] = [
				'product_id'   => absint( $item->get_product_id() ),
				'variation_id' => absint( $item->get_variation_id() ),
				'sku'          => sanitize_text_field( $sku ),
				'quantity'     => max( 1, absint( $item->get_quantity() ) ),
				'total'        => function_exists( 'wc_format_decimal' ) ? wc_format_decimal( (string) $item->get_total(), 2 ) : (string) round( (float) $item->get_total(), 2 ),
			];
		}

		usort(
			$lines,
			static function ( array $a, array $b ): int {
				return ( $a['product_id'] <=> $b['product_id'] )
					?: ( $a['variation_id'] <=> $b['variation_id'] )
					?: strcmp( (string) $a['sku'], (string) $b['sku'] )
					?: ( $a['quantity'] <=> $b['quantity'] )
					?: strcmp( (string) $a['total'], (string) $b['total'] );
			}
		);

		return $lines;
	}
}

if ( ! function_exists( 'dtb_order_loop_fingerprint' ) ) {
	/** Build a stable duplicate-detection fingerprint for WooCommerce orders. */
	function dtb_order_loop_fingerprint( WC_Order $order ): string {
		$payload = [
			'billing_email' => strtolower( sanitize_email( (string) $order->get_billing_email() ) ),
			'currency'      => sanitize_text_field( (string) $order->get_currency() ),
			'total'         => function_exists( 'wc_format_decimal' ) ? wc_format_decimal( (string) $order->get_total(), 2 ) : (string) round( (float) $order->get_total(), 2 ),
			'payment'       => sanitize_key( (string) $order->get_payment_method() ),
			'billing'       => [
				'first_name' => strtolower( sanitize_text_field( (string) $order->get_billing_first_name() ) ),
				'last_name'  => strtolower( sanitize_text_field( (string) $order->get_billing_last_name() ) ),
				'postcode'   => strtoupper( sanitize_text_field( (string) $order->get_billing_postcode() ) ),
				'country'    => strtoupper( sanitize_text_field( (string) $order->get_billing_country() ) ),
			],
			'shipping'      => [
				'first_name' => strtolower( sanitize_text_field( (string) $order->get_shipping_first_name() ) ),
				'last_name'  => strtolower( sanitize_text_field( (string) $order->get_shipping_last_name() ) ),
				'postcode'   => strtoupper( sanitize_text_field( (string) $order->get_shipping_postcode() ) ),
				'country'    => strtoupper( sanitize_text_field( (string) $order->get_shipping_country() ) ),
			],
			'lines'         => dtb_order_loop_line_signature( $order ),
		];

		return 'dtb-order-loop:' . hash( 'sha256', wp_json_encode( $payload ) ?: '' );
	}
}

if ( ! function_exists( 'dtb_order_loop_write_fingerprint' ) ) {
	/** Persist the duplicate-detection fingerprint on an order. */
	function dtb_order_loop_write_fingerprint( WC_Order $order, string $fingerprint ): void {
		if ( '' === $fingerprint ) {
			return;
		}

		if ( (string) $order->get_meta( '_dtb_order_loop_fingerprint', true ) === $fingerprint ) {
			return;
		}

		$order->update_meta_data( '_dtb_order_loop_fingerprint', $fingerprint );
		$order->update_meta_data( '_dtb_order_loop_scanned_at', gmdate( 'c' ) );
		$order->save_meta_data();
	}
}

if ( ! function_exists( 'dtb_order_loop_find_existing_duplicate' ) ) {
	/** Find an older order representing the same checkout/cart payload. */
	function dtb_order_loop_find_existing_duplicate( WC_Order $order ): ?WC_Order {
		if ( ! function_exists( 'wc_get_orders' ) ) {
			return null;
		}

		$fingerprint = dtb_order_loop_fingerprint( $order );
		if ( '' === $fingerprint ) {
			return null;
		}

		$current_id = absint( $order->get_id() );
		$email      = strtolower( sanitize_email( (string) $order->get_billing_email() ) );
		$window     = max( HOUR_IN_SECONDS, (int) DTB_ORDER_LOOP_DUPLICATE_WINDOW );

		$meta_matches = wc_get_orders( [
			'limit'        => 10,
			'orderby'      => 'date',
			'order'        => 'ASC',
			'status'       => dtb_order_loop_order_statuses(),
			'date_created' => '>' . gmdate( 'Y-m-d H:i:s', time() - $window ),
			'meta_query'   => [
				[
					'key'     => '_dtb_order_loop_fingerprint',
					'value'   => $fingerprint,
					'compare' => '=',
				],
			],
		] );

		foreach ( $meta_matches as $candidate ) {
			if ( $candidate instanceof WC_Order && absint( $candidate->get_id() ) !== $current_id ) {
				return $candidate;
			}
		}

		$args = [
			'limit'        => max( 10, (int) DTB_ORDER_LOOP_RECENT_SCAN_LIMIT ),
			'orderby'      => 'date',
			'order'        => 'ASC',
			'status'       => dtb_order_loop_order_statuses(),
			'date_created' => '>' . gmdate( 'Y-m-d H:i:s', time() - $window ),
		];

		if ( '' !== $email ) {
			$args['billing_email'] = $email;
		}

		$candidates = wc_get_orders( $args );
		foreach ( $candidates as $candidate ) {
			if ( ! $candidate instanceof WC_Order || absint( $candidate->get_id() ) === $current_id ) {
				continue;
			}

			$candidate_fingerprint = dtb_order_loop_fingerprint( $candidate );
			dtb_order_loop_write_fingerprint( $candidate, $candidate_fingerprint );
			if ( $candidate_fingerprint === $fingerprint ) {
				return $candidate;
			}
		}

		return null;
	}
}

if ( ! function_exists( 'dtb_order_loop_cancel_scheduled_order_jobs' ) ) {
	/** Unschedule known DTB side-effect jobs for a duplicate order where exact args are known. */
	function dtb_order_loop_cancel_scheduled_order_jobs( int $order_id ): void {
		if ( $order_id <= 0 || ! function_exists( 'as_unschedule_all_actions' ) ) {
			return;
		}

		foreach ( [
			'dtb_order_sync_veeqo',
			'dtb_order_sync_quickbooks',
			'dtb_order_issue_rewards',
			'dtb_order_send_notification',
			'dtb_order_refresh_tracking_projection',
			'dtb_order_archive_completed',
			'dtb_order_handle_refund',
		] as $hook ) {
			as_unschedule_all_actions( $hook, [ $order_id, [] ], 'dtb-orders' );
			as_unschedule_all_actions( $hook, [ $order_id ], 'dtb-orders' );
		}
	}
}

if ( ! function_exists( 'dtb_order_loop_mark_duplicate' ) ) {
	/** Mark, suppress, and optionally cancel a duplicate order. */
	function dtb_order_loop_mark_duplicate( WC_Order $order, WC_Order $existing_order, string $source = 'runtime' ): void {
		static $running = false;

		if ( $running || absint( $order->get_id() ) === absint( $existing_order->get_id() ) ) {
			return;
		}

		$fingerprint = dtb_order_loop_fingerprint( $order );
		dtb_order_loop_write_fingerprint( $order, $fingerprint );

		if ( absint( $order->get_meta( '_dtb_duplicate_of_order_id', true ) ) === absint( $existing_order->get_id() ) ) {
			return;
		}

		$order->update_meta_data( '_dtb_duplicate_of_order_id', absint( $existing_order->get_id() ) );
		$order->update_meta_data( '_dtb_order_loop_duplicate_source', sanitize_key( $source ) );
		$order->update_meta_data( '_dtb_order_loop_duplicate_detected_at', gmdate( 'c' ) );
		$order->update_meta_data( '_dtb_order_loop_fingerprint', $fingerprint );
		$order->update_meta_data( '_dtb_order_loop_suppress_emails', '1' );
		$order->update_meta_data( '_dtb_skip_integrations', '1' );
		$order->add_order_note( sprintf( '[DTB Order Guard] Duplicate order loop contained. Existing canonical order: #%d. Source: %s.', absint( $existing_order->get_id() ), sanitize_key( $source ) ), false, false );
		$order->save_meta_data();

		dtb_order_loop_cancel_scheduled_order_jobs( (int) $order->get_id() );
		dtb_order_loop_log( 'error', 'duplicate_order_contained', 'Duplicate WooCommerce order contained.', [
			'order_id'          => (int) $order->get_id(),
			'duplicate_of'      => (int) $existing_order->get_id(),
			'source'            => sanitize_key( $source ),
			'order_fingerprint' => $fingerprint,
		] );

		if ( ! dtb_order_loop_bool_constant( 'DTB_ORDER_LOOP_AUTO_CANCEL_DUPLICATES', true ) ) {
			return;
		}

		if ( in_array( (string) $order->get_status(), [ 'cancelled', 'refunded' ], true ) ) {
			return;
		}

		$running = true;
		try {
			$order->update_status( 'cancelled', sprintf( '[DTB Order Guard] Auto-cancelled duplicate of order #%d.', absint( $existing_order->get_id() ) ), false );
		} finally {
			$running = false;
		}
	}
}

if ( ! function_exists( 'dtb_order_loop_tag_order' ) ) {
	/** Fingerprint and contain a duplicate order when found. */
	function dtb_order_loop_tag_order( WC_Order $order, string $source = 'runtime' ): ?WC_Order {
		if ( ! dtb_order_loop_containment_enabled() ) {
			return null;
		}

		$fingerprint = dtb_order_loop_fingerprint( $order );
		dtb_order_loop_write_fingerprint( $order, $fingerprint );

		$existing = dtb_order_loop_find_existing_duplicate( $order );
		if ( $existing instanceof WC_Order ) {
			dtb_order_loop_mark_duplicate( $order, $existing, $source );
			return $existing;
		}

		return null;
	}
}

add_action(
	'woocommerce_new_order',
	static function ( int $order_id, $order = null ): void {
		if ( ! $order instanceof WC_Order && function_exists( 'wc_get_order' ) ) {
			$order = wc_get_order( $order_id );
		}
		if ( $order instanceof WC_Order ) {
			dtb_order_loop_tag_order( $order, 'woocommerce_new_order' );
		}
	},
	0,
	2
);

add_action(
	'woocommerce_checkout_order_processed',
	static function ( int $order_id, array $posted_data = [], $order = null ): void {
		if ( ! $order instanceof WC_Order && function_exists( 'wc_get_order' ) ) {
			$order = wc_get_order( $order_id );
		}
		if ( $order instanceof WC_Order ) {
			dtb_order_loop_tag_order( $order, 'woocommerce_checkout_order_processed' );
		}
	},
	0,
	3
);

add_action(
	'woocommerce_store_api_checkout_order_processed',
	static function ( $order ): void {
		if ( $order instanceof WC_Order ) {
			dtb_order_loop_tag_order( $order, 'store_api_checkout_order_processed' );
		}
	},
	0,
	1
);

add_action(
	'woocommerce_order_status_changed',
	static function ( int $order_id, string $old_status, string $new_status, $order ): void {
		if ( ! $order instanceof WC_Order && function_exists( 'wc_get_order' ) ) {
			$order = wc_get_order( $order_id );
		}
		if ( $order instanceof WC_Order ) {
			dtb_order_loop_tag_order( $order, 'order_status_changed' );
		}
	},
	0,
	4
);

if ( ! function_exists( 'dtb_order_loop_is_duplicate' ) ) {
	/** Return whether an order is already marked or computably known as duplicate. */
	function dtb_order_loop_is_duplicate( $order ): bool {
		if ( ! $order instanceof WC_Order ) {
			return false;
		}

		if ( absint( $order->get_meta( '_dtb_duplicate_of_order_id', true ) ) > 0 ) {
			return true;
		}

		return dtb_order_loop_tag_order( $order, 'email_or_job_gate' ) instanceof WC_Order;
	}
}

if ( ! function_exists( 'dtb_order_loop_email_guard' ) ) {
	/** Suppress all order emails for duplicate-loop orders. */
	function dtb_order_loop_email_guard( bool $enabled, $order ): bool {
		if ( ! $enabled || ! dtb_order_loop_containment_enabled() || ! $order instanceof WC_Order ) {
			return $enabled;
		}

		if ( '1' === (string) $order->get_meta( '_dtb_order_loop_suppress_emails', true ) ) {
			return false;
		}

		return dtb_order_loop_is_duplicate( $order ) ? false : $enabled;
	}
}

foreach ( [
	'woocommerce_email_enabled_new_order',
	'woocommerce_email_enabled_customer_processing_order',
	'woocommerce_email_enabled_customer_completed_order',
	'woocommerce_email_enabled_customer_on_hold_order',
	'woocommerce_email_enabled_customer_invoice',
	'woocommerce_email_enabled_customer_invoice_paid',
	'woocommerce_email_enabled_customer_note',
	'woocommerce_email_enabled_failed_order',
	'woocommerce_email_enabled_cancelled_order',
] as $dtb_order_loop_email_filter ) {
	add_filter( $dtb_order_loop_email_filter, 'dtb_order_loop_email_guard', 0, 2 );
}
unset( $dtb_order_loop_email_filter );

add_filter(
	'pre_as_schedule_single_action',
	static function ( $pre, int $timestamp, string $hook, array $args, string $group ) {
		if ( ! dtb_order_loop_containment_enabled() || 'dtb-orders' !== $group ) {
			return $pre;
		}

		$order_id = absint( $args[0] ?? 0 );
		$order    = $order_id > 0 && function_exists( 'wc_get_order' ) ? wc_get_order( $order_id ) : null;
		if ( $order instanceof WC_Order && ( '1' === (string) $order->get_meta( '_dtb_skip_integrations', true ) || dtb_order_loop_is_duplicate( $order ) ) ) {
			return false;
		}

		return $pre;
	},
	0,
	5
);

if ( ! function_exists( 'dtb_order_loop_run_sweep' ) ) {
	/** Sweep recent orders and return duplicate containment stats. */
	function dtb_order_loop_run_sweep(): array {
		$stats = [ 'scanned' => 0, 'duplicates' => 0 ];
		if ( ! dtb_order_loop_containment_enabled() || ! function_exists( 'wc_get_orders' ) ) {
			return $stats;
		}

		$orders = wc_get_orders( [
			'limit'        => max( 10, (int) DTB_ORDER_LOOP_RECENT_SCAN_LIMIT ),
			'orderby'      => 'date',
			'order'        => 'DESC',
			'status'       => dtb_order_loop_order_statuses(),
			'date_created' => '>' . gmdate( 'Y-m-d H:i:s', time() - max( HOUR_IN_SECONDS, (int) DTB_ORDER_LOOP_DUPLICATE_WINDOW ) ),
		] );

		foreach ( $orders as $order ) {
			if ( ! $order instanceof WC_Order ) {
				continue;
			}
			$stats['scanned']++;
			if ( dtb_order_loop_tag_order( $order, 'sweep' ) instanceof WC_Order ) {
				$stats['duplicates']++;
			}
		}

		return $stats;
	}
}

add_action(
	'shutdown',
	static function (): void {
		dtb_order_loop_run_sweep();
	},
	PHP_INT_MAX
);

add_action(
	'rest_api_init',
	static function (): void {
		register_rest_route( 'dtb/v1', '/order-loop/status', [
			'methods'             => 'GET',
			'permission_callback' => static fn (): bool => current_user_can( 'manage_woocommerce' ),
			'callback'            => static function (): WP_REST_Response {
				$recent_duplicates = [];
				if ( function_exists( 'wc_get_orders' ) ) {
					$orders = wc_get_orders( [
						'limit'      => 20,
						'orderby'    => 'date',
						'order'      => 'DESC',
						'status'     => [ 'cancelled', 'pending', 'on-hold', 'processing', 'completed', 'failed' ],
						'meta_query' => [
							[
								'key'     => '_dtb_duplicate_of_order_id',
								'compare' => 'EXISTS',
							],
						],
					] );
					foreach ( $orders as $order ) {
						if ( $order instanceof WC_Order ) {
							$recent_duplicates[] = [
								'order_id'     => (int) $order->get_id(),
								'duplicate_of' => absint( $order->get_meta( '_dtb_duplicate_of_order_id', true ) ),
								'status'       => (string) $order->get_status(),
								'source'       => (string) $order->get_meta( '_dtb_order_loop_duplicate_source', true ),
							];
						}
					}
				}

				return new WP_REST_Response( [
					'enabled'                         => dtb_order_loop_containment_enabled(),
					'block_wc_rest_order_creation'    => dtb_order_loop_bool_constant( 'DTB_ORDER_LOOP_BLOCK_WC_REST_ORDER_CREATION', true ),
					'disable_marketplace_materialize' => dtb_order_loop_bool_constant( 'DTB_ORDER_LOOP_DISABLE_MARKETPLACE_MATERIALIZATION', true ),
					'disable_legacy_veeqo_direct'     => dtb_order_loop_bool_constant( 'DTB_ORDER_LOOP_DISABLE_LEGACY_VEEQO_DIRECT_SYNC', true ),
					'auto_cancel_duplicates'          => dtb_order_loop_bool_constant( 'DTB_ORDER_LOOP_AUTO_CANCEL_DUPLICATES', true ),
					'duplicate_window_seconds'        => (int) DTB_ORDER_LOOP_DUPLICATE_WINDOW,
					'recent_duplicates'               => $recent_duplicates,
				], 200 );
			},
		] );

		register_rest_route( 'dtb/v1', '/order-loop/sweep', [
			'methods'             => 'POST',
			'permission_callback' => static fn (): bool => current_user_can( 'manage_woocommerce' ),
			'callback'            => static function (): WP_REST_Response {
				return new WP_REST_Response( [ 'success' => true, 'stats' => dtb_order_loop_run_sweep() ], 200 );
			},
		] );
	},
	20
);
