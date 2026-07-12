<?php
/**
 * DTB Veeqo Inventory Boundary.
 *
 * Veeqo is the inventory/fulfillment source of truth. WooCommerce stores the
 * checkout-facing stock projection. This file prevents public bulk inventory
 * disclosure and exposes a narrow public cart-availability endpoint.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( ! defined( 'DTB_VEEQO_CART_AVAILABILITY_RATE_LIMIT' ) ) {
	define( 'DTB_VEEQO_CART_AVAILABILITY_RATE_LIMIT', 60 );
}
if ( ! defined( 'DTB_VEEQO_CART_AVAILABILITY_RATE_WINDOW' ) ) {
	define( 'DTB_VEEQO_CART_AVAILABILITY_RATE_WINDOW', MINUTE_IN_SECONDS );
}
if ( ! defined( 'DTB_VEEQO_CART_AVAILABILITY_MAX_ITEMS' ) ) {
	define( 'DTB_VEEQO_CART_AVAILABILITY_MAX_ITEMS', 100 );
}

if ( ! function_exists( 'dtb_veeqo_inventory_boundary_client_ip' ) ) {
	function dtb_veeqo_inventory_boundary_client_ip(): string {
		if ( function_exists( 'dtb_get_client_ip' ) ) {
			return (string) dtb_get_client_ip();
		}
		return sanitize_text_field( (string) ( $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0' ) );
	}
}

if ( ! function_exists( 'dtb_veeqo_inventory_boundary_rate_limited' ) ) {
	function dtb_veeqo_inventory_boundary_rate_limited( string $bucket, int $limit, int $window ): bool {
		$key   = 'dtb_veeqo_inv_rl_' . md5( $bucket );
		$count = (int) get_transient( $key );
		if ( $count >= $limit ) {
			return true;
		}
		set_transient( $key, $count + 1, max( 30, $window ) );
		return false;
	}
}

add_filter(
	'rest_pre_dispatch',
	static function ( $result, $server, WP_REST_Request $request ) {
		if ( null !== $result ) {
			return $result;
		}

		$route  = (string) $request->get_route();
		$method = strtoupper( (string) $request->get_method() );
		if ( '/dtb/v1/veeqo/inventory' !== $route || 'GET' !== $method ) {
			return $result;
		}

		if ( current_user_can( 'manage_woocommerce' ) ) {
			return $result;
		}

		if ( function_exists( 'dtb_veeqo_log' ) ) {
			dtb_veeqo_log( 'warn', 'public_bulk_inventory_blocked', 'Blocked public request to bulk Veeqo inventory endpoint.', [
				'ip' => dtb_veeqo_inventory_boundary_client_ip(),
			] );
		}

		return new WP_REST_Response(
			[
				'code'    => 'dtb_bulk_inventory_admin_only',
				'message' => 'Bulk Veeqo inventory is admin-only. Use /dtb/v1/veeqo/cart-availability for storefront availability checks.',
			],
			403
		);
	},
	-50,
	3
);

add_action(
	'rest_api_init',
	static function (): void {
		register_rest_route( 'dtb/v1', '/veeqo/cart-availability', [
			'methods'             => 'POST',
			'callback'            => 'dtb_veeqo_route_cart_availability',
			'permission_callback' => '__return_true',
			'args'                => [
				'items' => [
					'required' => true,
					'type'     => 'array',
				],
			],
		] );
	},
	20
);

if ( ! function_exists( 'dtb_veeqo_normalize_cart_availability_items' ) ) {
	function dtb_veeqo_normalize_cart_availability_items( array $items ): array {
		$normalized = [];
		foreach ( $items as $raw ) {
			if ( ! is_array( $raw ) ) {
				continue;
			}
			$sku = trim( sanitize_text_field( (string) ( $raw['sku'] ?? '' ) ) );
			$qty = max( 1, absint( $raw['quantity'] ?? 1 ) );
			if ( '' === $sku ) {
				continue;
			}
			$normalized[] = [
				'sku'        => $sku,
				'quantity'   => $qty,
				'product_id' => absint( $raw['product_id'] ?? $raw['id'] ?? 0 ),
				'name'       => sanitize_text_field( (string) ( $raw['name'] ?? '' ) ),
			];
		}
		return array_slice( $normalized, 0, max( 1, (int) DTB_VEEQO_CART_AVAILABILITY_MAX_ITEMS ) );
	}
}

if ( ! function_exists( 'dtb_veeqo_check_projected_stock_for_sku' ) ) {
	function dtb_veeqo_check_projected_stock_for_sku( string $sku, int $requested, int $fallback_product_id = 0, string $name = '' ): array {
		$product_id = function_exists( 'wc_get_product_id_by_sku' ) ? absint( wc_get_product_id_by_sku( $sku ) ) : 0;
		if ( $product_id <= 0 && $fallback_product_id > 0 ) {
			$product_id = $fallback_product_id;
		}

		$product = $product_id > 0 && function_exists( 'wc_get_product' ) ? wc_get_product( $product_id ) : null;
		if ( ! $product instanceof WC_Product ) {
			return [
				'sku'          => $sku,
				'productId'    => $fallback_product_id ?: null,
				'productName'  => $name,
				'requested'    => $requested,
				'available'    => null,
				'inStock'      => true,
				'status'       => 'unknown',
				'message'      => 'SKU is not mapped in WooCommerce projection; checkout will rely on server-side WooCommerce validation.',
			];
		}

		$available = $product->managing_stock() ? $product->get_stock_quantity() : null;
		$in_stock  = $product->is_in_stock() && ( null === $available || (int) $available >= $requested );

		return [
			'sku'         => $sku,
			'productId'   => $product->get_id(),
			'productName' => $product->get_name(),
			'requested'   => $requested,
			'available'   => null === $available ? null : (int) $available,
			'inStock'     => $in_stock,
			'status'      => $in_stock ? 'available' : 'insufficient_stock',
		];
	}
}

if ( ! function_exists( 'dtb_veeqo_route_cart_availability' ) ) {
	function dtb_veeqo_route_cart_availability( WP_REST_Request $request ): WP_REST_Response {
		$ip = dtb_veeqo_inventory_boundary_client_ip();
		if ( dtb_veeqo_inventory_boundary_rate_limited( $ip, (int) DTB_VEEQO_CART_AVAILABILITY_RATE_LIMIT, (int) DTB_VEEQO_CART_AVAILABILITY_RATE_WINDOW ) ) {
			$response = new WP_REST_Response( [ 'code' => 'rate_limited', 'message' => 'Too many availability checks. Please try again shortly.' ], 429 );
			$response->header( 'Retry-After', (string) DTB_VEEQO_CART_AVAILABILITY_RATE_WINDOW );
			return $response;
		}

		$body  = $request->get_json_params();
		$items = dtb_veeqo_normalize_cart_availability_items( is_array( $body['items'] ?? null ) ? $body['items'] : [] );
		if ( empty( $items ) ) {
			return new WP_REST_Response( [ 'code' => 'invalid_items', 'message' => 'Request body must include at least one item with sku and quantity.' ], 400 );
		}

		$checks = [];
		foreach ( $items as $item ) {
			$checks[] = dtb_veeqo_check_projected_stock_for_sku( $item['sku'], $item['quantity'], $item['product_id'], $item['name'] );
		}

		$out_of_stock = array_values( array_filter( $checks, static fn( array $check ): bool => empty( $check['inStock'] ) ) );

		return new WP_REST_Response(
			[
				'available'  => empty( $out_of_stock ),
				'items'      => $checks,
				'outOfStock' => $out_of_stock,
				'source'     => 'woocommerce_stock_projection_from_veeqo',
			],
			200
		);
	}
}
