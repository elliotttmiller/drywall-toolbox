<?php
/**
 * Plugin Name: DTB Order Loop Containment Guard
 * Description: Emergency production guard for duplicate WooCommerce order/email loops caused by integration polling or repeated checkout handoff callbacks.
 * Version: 1.0.0
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

if ( ! defined( 'DTB_ORDER_LOOP_RECENT_SCAN_LIMIT' ) ) {
	define( 'DTB_ORDER_LOOP_RECENT_SCAN_LIMIT', 50 );
}

if ( ! function_exists( 'dtb_order_loop_containment_enabled' ) ) {
	/** Return whether the emergency containment layer is active. */
	function dtb_order_loop_containment_enabled(): bool {
		return filter_var( DTB_ORDER_LOOP_CONTAINMENT_ENABLED, FILTER_VALIDATE_BOOLEAN );
	}
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

if ( ! function_exists( 'dtb_order_loop_remove_risky_side_effect_hooks' ) ) {
	/**
	 * Disable known recurring/order side-effect hooks while the production order loop
	 * is being contained. These are safe to re-enable after the integration source
	 * is proven idempotent in staging.
	 */
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

if ( ! function_exists( 'dtb_order_loop_orders_equivalent' ) ) {
	/** Compare two WooCommerce orders by the emergency duplicate fingerprint. */
	function dtb_order_loop_orders_equivalent( WC_Order $a, WC_Order $b ): bool {
		return dtb_order_loop_fingerprint( $a ) === dtb_order_loop_fingerprint( $b );
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
		$order->add_order_note( sprintf( '[DTB Order Guard] Duplicate order loop contained. Existing canonical order: #%d. Source: %s.', absint( $existing_order->get_id() ), sanitize_key( $source ) ), false, false );
		$order->save_meta_data();

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
		if ( $order instanceof WC_Order && dtb_order_loop_is_duplicate( $order ) ) {
			return false;
		}

		return $pre;
	},
	0,
	5
);

add_action(
	'shutdown',
	static function (): void {
		if ( ! dtb_order_loop_containment_enabled() || ! function_exists( 'wc_get_orders' ) ) {
			return;
		}

		$orders = wc_get_orders( [
			'limit'        => max( 10, (int) DTB_ORDER_LOOP_RECENT_SCAN_LIMIT ),
			'orderby'      => 'date',
			'order'        => 'DESC',
			'status'       => dtb_order_loop_order_statuses(),
			'date_created' => '>' . gmdate( 'Y-m-d H:i:s', time() - max( HOUR_IN_SECONDS, (int) DTB_ORDER_LOOP_DUPLICATE_WINDOW ) ),
		] );

		foreach ( $orders as $order ) {
			if ( $order instanceof WC_Order ) {
				dtb_order_loop_tag_order( $order, 'shutdown_sweep' );
			}
		}
	},
	PHP_INT_MAX
);
