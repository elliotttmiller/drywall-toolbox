<?php
/**
 * DTB Integrations — QuickBooks Accounting Pipeline.
 *
 * Queue-safe QuickBooks accounting helpers for SalesReceipt and RefundReceipt
 * creation. This layer keeps accounting writes behind dtb-order-platform jobs,
 * centralizes item/account references, and avoids hidden direct batch behavior.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'dtb_qbo_accounting_ref' ) ) {
	/** Resolve a configured QuickBooks reference value/name pair. */
	function dtb_qbo_accounting_ref( string $key, string $default_id, string $default_name ): array {
		$key        = strtoupper( sanitize_key( $key ) );
		$id_const   = 'DTB_QBO_ITEM_' . $key . '_ID';
		$name_const = 'DTB_QBO_ITEM_' . $key . '_NAME';

		$value = defined( $id_const ) ? constant( $id_const ) : get_option( strtolower( $id_const ), $default_id );
		$name  = defined( $name_const ) ? constant( $name_const ) : get_option( strtolower( $name_const ), $default_name );

		return [
			'value' => sanitize_text_field( (string) $value ),
			'name'  => sanitize_text_field( (string) $name ),
		];
	}
}

if ( ! function_exists( 'dtb_qbo_money' ) ) {
	/** Normalize a money value for QBO payloads. */
	function dtb_qbo_money( mixed $amount ): float {
		return (float) wc_format_decimal( (float) $amount, 2 );
	}
}

if ( ! function_exists( 'dtb_qbo_product_item_ref_for_order_item' ) ) {
	/** Resolve the QBO item ref for a Woo line item. */
	function dtb_qbo_product_item_ref_for_order_item( WC_Order_Item_Product $item ): array {
		$product = $item->get_product();
		if ( $product instanceof WC_Product ) {
			foreach ( [ '_dtb_qbo_item_id', '_qbo_item_id', '_quickbooks_item_id' ] as $meta_key ) {
				$item_id = (string) $product->get_meta( $meta_key, true );
				if ( '' !== $item_id ) {
					return [ 'value' => sanitize_text_field( $item_id ), 'name' => sanitize_text_field( $product->get_sku() ?: $product->get_name() ) ];
				}
			}
		}

		return dtb_qbo_accounting_ref( 'product', '1', 'Services' );
	}
}

if ( ! function_exists( 'dtb_qbo_build_sales_lines_for_order' ) ) {
	/** Build SalesReceipt lines from a Woo order. */
	function dtb_qbo_build_sales_lines_for_order( WC_Order $order, bool $refund_mode = false ): array {
		$lines = [];

		foreach ( $order->get_items( 'line_item' ) as $item ) {
			if ( ! $item instanceof WC_Order_Item_Product ) {
				continue;
			}

			$qty       = max( 1, (int) $item->get_quantity() );
			$amount    = dtb_qbo_money( $order->get_line_total( $item, true ) );
			$unit      = dtb_qbo_money( $amount / $qty );
			$item_ref  = dtb_qbo_product_item_ref_for_order_item( $item );
			$product   = $item->get_product();
			$sku       = $product instanceof WC_Product ? (string) $product->get_sku() : '';
			$desc_bits = array_filter( [ $item->get_name(), $sku ? 'SKU: ' . $sku : '' ] );

			if ( $amount <= 0 ) {
				continue;
			}

			$lines[] = [
				'Amount'      => $amount,
				'DetailType'  => 'SalesItemLineDetail',
				'Description' => implode( ' — ', $desc_bits ),
				'SalesItemLineDetail' => [
					'Qty'       => $qty,
					'UnitPrice' => $unit,
					'ItemRef'   => $item_ref,
				],
			];
		}

		$shipping = dtb_qbo_money( $order->get_shipping_total() );
		if ( $shipping > 0 ) {
			$lines[] = [
				'Amount'      => $shipping,
				'DetailType'  => 'SalesItemLineDetail',
				'Description' => 'Shipping for WooCommerce order #' . $order->get_order_number(),
				'SalesItemLineDetail' => [
					'Qty'       => 1,
					'UnitPrice' => $shipping,
					'ItemRef'   => dtb_qbo_accounting_ref( 'shipping', '2', 'Shipping' ),
				],
			];
		}

		$discount = dtb_qbo_money( $order->get_discount_total() );
		if ( $discount > 0 ) {
			$lines[] = [
				'Amount'      => -1 * $discount,
				'DetailType'  => 'SalesItemLineDetail',
				'Description' => 'Discount for WooCommerce order #' . $order->get_order_number(),
				'SalesItemLineDetail' => [
					'Qty'       => 1,
					'UnitPrice' => -1 * $discount,
					'ItemRef'   => dtb_qbo_accounting_ref( 'discount', '1', 'Discount' ),
				],
			];
		}

		$tax     = dtb_qbo_money( $order->get_total_tax() );
		$tax_ref = dtb_qbo_accounting_ref( 'tax', '', 'Sales Tax' );
		if ( $tax > 0 && '' !== $tax_ref['value'] ) {
			$lines[] = [
				'Amount'      => $tax,
				'DetailType'  => 'SalesItemLineDetail',
				'Description' => 'Tax for WooCommerce order #' . $order->get_order_number(),
				'SalesItemLineDetail' => [
					'Qty'       => 1,
					'UnitPrice' => $tax,
					'ItemRef'   => $tax_ref,
				],
			];
		}

		return $lines;
	}
}

if ( ! function_exists( 'dtb_qbo_build_refund_lines_for_order' ) ) {
	/** Build one RefundReceipt line for one concrete WooCommerce refund. */
	function dtb_qbo_build_refund_lines_for_order( WC_Order $order, WC_Order_Refund $refund ): array {
		$refund_total = dtb_qbo_money( abs( (float) $refund->get_amount() ) );
		if ( $refund_total <= 0 ) {
			return [];
		}

		return [
			[
				'Amount'      => $refund_total,
				'DetailType'  => 'SalesItemLineDetail',
				'Description' => sprintf( 'Refund #%d for Drywall Toolbox order #%s', $refund->get_id(), $order->get_order_number() ),
				'SalesItemLineDetail' => [
					'Qty'       => 1,
					'UnitPrice' => $refund_total,
					'ItemRef'   => dtb_qbo_accounting_ref( 'refund', '1', 'Refund' ),
				],
			],
		];
	}
}

if ( ! function_exists( 'dtb_qbo_order_doc_number' ) ) {
	/** Build a deterministic QBO document number for an order. */
	function dtb_qbo_order_doc_number( WC_Order $order, string $prefix = 'DTB' ): string {
		return substr( sanitize_text_field( $prefix . '-' . $order->get_order_number() ), 0, 21 );
	}
}

if ( ! function_exists( 'dtb_qbo_refund_doc_number' ) ) {
	/** Build a deterministic QBO document number unique to a Woo refund. */
	function dtb_qbo_refund_doc_number( WC_Order $order, int $refund_id ): string {
		return substr( sanitize_text_field( 'DTB-R-' . $order->get_id() . '-' . $refund_id ), 0, 21 );
	}
}

if ( ! function_exists( 'dtb_qbo_refund_meta_key' ) ) {
	function dtb_qbo_refund_meta_key( int $refund_id ): string {
		return '_dtb_quickbooks_refund_id_' . max( 0, $refund_id );
	}
}

if ( ! function_exists( 'dtb_qbo_sync_order_pipeline' ) ) {
	/** Queue-safe SalesReceipt sync for one Woo order. */
	function dtb_qbo_sync_order_pipeline( WC_Order $order ): array|WP_Error {
		$existing_id = (string) ( $order->get_meta( '_dtb_quickbooks_entity_id', true ) ?: $order->get_meta( '_dtb_qbo_receipt_id', true ) ?: $order->get_meta( '_dtb_quickbooks_invoice_id', true ) );
		if ( '' !== $existing_id || $order->get_meta( '_dtb_qbo_synced' ) ) {
			return new WP_Error( 'already_synced', 'Order already synced to QuickBooks.' );
		}
		if ( function_exists( 'dtb_order_integration_acquire_lock' ) && ! dtb_order_integration_acquire_lock( 'quickbooks', (int) $order->get_id() ) ) {
			return new WP_Error( 'qbo_locked', 'A QuickBooks sync is already in progress for this order.' );
		}

		try {
			$lines = dtb_qbo_build_sales_lines_for_order( $order, false );
			if ( empty( $lines ) ) {
				return new WP_Error( 'no_line_items', 'Order has no valid positive line items to sync.' );
			}

			$created = $order->get_date_created();
			$payload = [
				'Line'        => $lines,
				'CustomerRef' => [ 'value' => dtb_qbo_get_or_create_customer( $order ) ],
				'DocNumber'   => dtb_qbo_order_doc_number( $order, 'DTB' ),
				'TxnDate'     => $created ? gmdate( 'Y-m-d', $created->getTimestamp() ) : gmdate( 'Y-m-d' ),
				'PrivateNote' => 'Drywall Toolbox WooCommerce order #' . $order->get_order_number(),
				'CurrencyRef' => [ 'value' => strtoupper( $order->get_currency() ?: get_woocommerce_currency() ) ],
			];

			$result = dtb_qbo_request( 'POST', '/salesreceipt', [], $payload );
			if ( empty( $result['ok'] ) ) {
				return new WP_Error( 'qbo_sync_failed', 'QBO SalesReceipt API error: ' . ( $result['error'] ?? 'Unknown error.' ) );
			}

			$qbo_id = (string) ( $result['data']['SalesReceipt']['Id'] ?? '' );
			$order->update_meta_data( '_dtb_qbo_synced', '1' );
			$order->update_meta_data( '_dtb_quickbooks_entity_type', 'sales_receipt' );
			if ( '' !== $qbo_id ) {
				$order->update_meta_data( '_dtb_qbo_receipt_id', $qbo_id );
				$order->update_meta_data( '_dtb_quickbooks_entity_id', $qbo_id );
			}
			$order->save_meta_data();

			return $result['data'];
		} finally {
			if ( function_exists( 'dtb_order_integration_release_lock' ) ) {
				dtb_order_integration_release_lock( 'quickbooks', (int) $order->get_id() );
			}
		}
	}
}

if ( ! function_exists( 'dtb_qbo_sync_refund' ) ) {
	/** Queue-safe RefundReceipt sync for one concrete Woo refund event. */
	function dtb_qbo_sync_refund( WC_Order $order, int $refund_id ): array|WP_Error {
		$refund_id = absint( $refund_id );
		$refund    = $refund_id > 0 ? wc_get_order( $refund_id ) : null;
		if ( ! $refund instanceof WC_Order_Refund || (int) $refund->get_parent_id() !== (int) $order->get_id() ) {
			return new WP_Error( 'invalid_refund', 'The WooCommerce refund could not be verified for this order.' );
		}

		$meta_key    = dtb_qbo_refund_meta_key( $refund_id );
		$existing_id = (string) $order->get_meta( $meta_key, true );
		if ( '' !== $existing_id ) {
			return new WP_Error( 'already_synced', 'This WooCommerce refund is already synced to QuickBooks.', [ 'entity_id' => $existing_id ] );
		}
		if ( function_exists( 'dtb_order_integration_acquire_lock' ) && ! dtb_order_integration_acquire_lock( 'quickbooks', (int) $order->get_id() ) ) {
			return new WP_Error( 'qbo_locked', 'A QuickBooks sync is already in progress for this order.' );
		}

		try {
			$lines = dtb_qbo_build_refund_lines_for_order( $order, $refund );
			if ( empty( $lines ) ) {
				return new WP_Error( 'no_refund_total', 'WooCommerce refund has no positive refunded amount to sync.' );
			}

			$refund_created = $refund->get_date_created();
			$payload = [
				'Line'        => $lines,
				'CustomerRef' => [ 'value' => dtb_qbo_get_or_create_customer( $order ) ],
				'DocNumber'   => dtb_qbo_refund_doc_number( $order, $refund_id ),
				'TxnDate'     => $refund_created ? gmdate( 'Y-m-d', $refund_created->getTimestamp() ) : gmdate( 'Y-m-d' ),
				'PrivateNote' => sprintf( 'WooCommerce refund #%d for Drywall Toolbox order #%s', $refund_id, $order->get_order_number() ),
				'CurrencyRef' => [ 'value' => strtoupper( $order->get_currency() ?: get_woocommerce_currency() ) ],
			];

			$result = dtb_qbo_request( 'POST', '/refundreceipt', [], $payload );
			if ( empty( $result['ok'] ) ) {
				return new WP_Error( 'qbo_refund_sync_failed', 'QBO RefundReceipt API error: ' . ( $result['error'] ?? 'Unknown error.' ) );
			}

			$qbo_id = (string) ( $result['data']['RefundReceipt']['Id'] ?? '' );
			if ( '' !== $qbo_id ) {
				$order->update_meta_data( $meta_key, $qbo_id );
				// Compatibility pointers describe the latest refund only. Per-refund meta
				// above is the authoritative idempotency key and must not be replaced.
				$order->update_meta_data( '_dtb_quickbooks_refund_id', $qbo_id );
				$order->update_meta_data( '_dtb_quickbooks_refund_type', 'refund_receipt' );
				$order->save_meta_data();
			}

			return $result['data'];
		} finally {
			if ( function_exists( 'dtb_order_integration_release_lock' ) ) {
				dtb_order_integration_release_lock( 'quickbooks', (int) $order->get_id() );
			}
		}
	}
}
