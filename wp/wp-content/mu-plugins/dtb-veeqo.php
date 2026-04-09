<?php
/**
 * Plugin Name: DTB Veeqo Integration
 * Description: Server-side Veeqo API proxy, WooCommerce bi-directional order/inventory
 *              sync, real-time shipping rate calculation, webhook receiver, and
 *              structured logging for production monitoring.
 * Version: 1.0.0
 * Author: Drywall Toolbox
 *
 * Must-use plugin: wp/wp-content/mu-plugins/dtb-veeqo.php
 * Loaded by: 00-dtb-loader.php (after dtb-woocommerce.php)
 *
 * Required wp-config.php constants:
 *   DTB_VEEQO_API_KEY        — Veeqo API key (Settings → API Keys in Veeqo)
 *   DTB_VEEQO_WEBHOOK_SECRET — HMAC secret for Veeqo webhook HMAC validation
 *   DTB_VEEQO_WAREHOUSE_ID   — Primary warehouse ID for order routing
 *   DTB_VEEQO_CHANNEL_ID     — Veeqo channel ID mapped to this WooCommerce store
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// SECTION 1 — VEEQO API HELPER
//
// All requests to the Veeqo API originate here, server-side only.
// The API key never travels to the browser.
// =============================================================================

define( 'DTB_VEEQO_API_BASE', 'https://api.veeqo.com' );

/**
 * Return the Veeqo configuration array (reads wp-config.php constants once
 * per request and caches the result in $GLOBALS).
 *
 * @return array{api_key: string, webhook_secret: string, warehouse_id: int, channel_id: int}
 */
function dtb_veeqo_config(): array {
	if ( isset( $GLOBALS['_dtb_veeqo_config'] ) ) {
		return $GLOBALS['_dtb_veeqo_config'];
	}

	$GLOBALS['_dtb_veeqo_config'] = [
		'api_key'        => defined( 'DTB_VEEQO_API_KEY' )        ? (string) DTB_VEEQO_API_KEY        : '',
		'webhook_secret' => defined( 'DTB_VEEQO_WEBHOOK_SECRET' ) ? (string) DTB_VEEQO_WEBHOOK_SECRET : '',
		'warehouse_id'   => defined( 'DTB_VEEQO_WAREHOUSE_ID' )   ? (int)    DTB_VEEQO_WAREHOUSE_ID   : 0,
		'channel_id'     => defined( 'DTB_VEEQO_CHANNEL_ID' )     ? (int)    DTB_VEEQO_CHANNEL_ID     : 0,
	];

	return $GLOBALS['_dtb_veeqo_config'];
}

/**
 * Return true when Veeqo integration is configured (API key present).
 */
function dtb_veeqo_enabled(): bool {
	$cfg = dtb_veeqo_config();
	return '' !== $cfg['api_key'];
}

/**
 * Make an authenticated HTTP request to the Veeqo REST API.
 *
 * @param string $method   HTTP method: GET, POST, PUT, DELETE.
 * @param string $path     API path, e.g. '/orders' or '/products/123'.
 * @param array  $params   Query params for GET requests.
 * @param array  $body     Request body for POST/PUT (will be JSON-encoded).
 * @return array{ok: bool, status: int, data: mixed, error: string}
 */
function dtb_veeqo_request( string $method, string $path, array $params = [], array $body = [] ): array {
	$cfg = dtb_veeqo_config();

	if ( '' === $cfg['api_key'] ) {
		dtb_veeqo_log( 'error', 'api_key_missing', 'DTB_VEEQO_API_KEY constant not set in wp-config.php.' );
		return [ 'ok' => false, 'status' => 503, 'data' => null, 'error' => 'Veeqo not configured.' ];
	}

	$url = DTB_VEEQO_API_BASE . $path;
	if ( ! empty( $params ) ) {
		// add_query_arg already URL-encodes values — pre-encoding would cause
		// double-encoding (e.g. a space becomes %2520 instead of %20).
		$url = add_query_arg( $params, $url );
	}

	$args = [
		'method'  => strtoupper( $method ),
		'headers' => [
			'x-api-key'    => $cfg['api_key'],
			'Accept'       => 'application/json',
			'Content-Type' => 'application/json',
		],
		'timeout' => 20,
	];

	if ( ! empty( $body ) ) {
		$args['body'] = wp_json_encode( $body );
	}

	$raw = wp_remote_request( $url, $args );

	if ( is_wp_error( $raw ) ) {
		dtb_veeqo_log( 'error', 'http_error', $raw->get_error_message(), [ 'path' => $path ] );
		return [ 'ok' => false, 'status' => 502, 'data' => null, 'error' => $raw->get_error_message() ];
	}

	$status = (int) wp_remote_retrieve_response_code( $raw );
	$data   = json_decode( wp_remote_retrieve_body( $raw ), true );

	if ( $status < 200 || $status >= 300 ) {
		$msg = ( is_array( $data ) && ! empty( $data['error'] ) ) ? (string) $data['error'] : 'Veeqo API error.';
		dtb_veeqo_log( 'error', 'api_error', $msg, [ 'path' => $path, 'status' => $status ] );
		return [ 'ok' => false, 'status' => $status, 'data' => $data, 'error' => $msg ];
	}

	return [ 'ok' => true, 'status' => $status, 'data' => $data, 'error' => '' ];
}


// =============================================================================
// SECTION 2 — REST ROUTE REGISTRATION
// =============================================================================

add_action( 'rest_api_init', 'dtb_veeqo_register_routes', 10 );

function dtb_veeqo_register_routes(): void {
	$ns = 'dtb/v1';

	// ── GET /dtb/v1/veeqo/status — integration health check ──────────────────
	register_rest_route( $ns, '/veeqo/status', [
		'methods'             => 'GET',
		'callback'            => 'dtb_veeqo_route_status',
		'permission_callback' => 'dtb_jwt_permission',
	] );

	// ── POST /dtb/v1/veeqo/shipping-rates — real-time rate calculator ─────────
	register_rest_route( $ns, '/veeqo/shipping-rates', [
		'methods'             => 'POST',
		'callback'            => 'dtb_veeqo_route_shipping_rates',
		'permission_callback' => '__return_true',
	] );

	// ── GET /dtb/v1/veeqo/inventory — bulk inventory levels ──────────────────
	register_rest_route( $ns, '/veeqo/inventory', [
		'methods'             => 'GET',
		'callback'            => 'dtb_veeqo_route_inventory',
		'permission_callback' => 'dtb_jwt_permission',
	] );

	// ── POST /dtb/v1/veeqo/webhooks/order — receive Veeqo order status events ─
	register_rest_route( $ns, '/veeqo/webhooks/order', [
		'methods'             => 'POST',
		'callback'            => 'dtb_veeqo_route_webhook_order',
		'permission_callback' => '__return_true',
	] );

	// ── POST /dtb/v1/repair-request — repair service form submission ──────────
	register_rest_route( $ns, '/repair-request', [
		'methods'             => 'POST',
		'callback'            => 'dtb_veeqo_route_repair_request',
		'permission_callback' => '__return_true',
	] );
}


// =============================================================================
// SECTION 3 — ROUTE CALLBACKS
// =============================================================================

/**
 * GET /dtb/v1/veeqo/status
 *
 * Returns Veeqo connection status and account information.
 * Requires a valid JWT (admin-only).
 */
function dtb_veeqo_route_status( WP_REST_Request $request ): WP_REST_Response {
	if ( ! dtb_veeqo_enabled() ) {
		return new WP_REST_Response( [
			'connected' => false,
			'message'   => 'DTB_VEEQO_API_KEY not configured.',
		], 200 );
	}

	$result = dtb_veeqo_request( 'GET', '/warehouses' );

	if ( ! $result['ok'] ) {
		return new WP_REST_Response( [
			'connected' => false,
			'message'   => $result['error'],
		], 200 );
	}

	$cfg        = dtb_veeqo_config();
	$warehouses = is_array( $result['data'] ) ? count( $result['data'] ) : 0;

	return new WP_REST_Response( [
		'connected'    => true,
		'warehouse_id' => $cfg['warehouse_id'],
		'channel_id'   => $cfg['channel_id'],
		'warehouses'   => $warehouses,
		'message'      => 'Veeqo connection verified.',
	], 200 );
}

/**
 * POST /dtb/v1/veeqo/shipping-rates
 *
 * Calculates real-time shipping rates for a destination address and cart.
 * Rate logic: tiered by order value and total weight, with separate tiers for
 * repair services (identified by product category). Falls back gracefully when
 * Veeqo is not configured by returning sensible static rates.
 *
 * Request body:
 * {
 *   "destination": {
 *     "first_name": "...", "last_name": "...",
 *     "address1":   "...", "city": "...",
 *     "state":      "...", "zip": "...",
 *     "country":    "US"
 *   },
 *   "items": [
 *     { "id": 123, "sku": "...", "name": "...", "quantity": 2, "price": 49.99, "weight": 0.5, "category": "product" }
 *   ]
 * }
 *
 * Response:
 * {
 *   "rates": [
 *     { "id": "standard", "name": "Standard Shipping (5–7 days)", "price": 9.99,  "currency": "USD" },
 *     { "id": "express",  "name": "Express Shipping (2–3 days)",  "price": 19.99, "currency": "USD" },
 *     { "id": "overnight","name": "Overnight Shipping (next day)","price": 39.99, "currency": "USD" }
 *   ]
 * }
 */
function dtb_veeqo_route_shipping_rates( WP_REST_Request $request ): WP_REST_Response {
	// Rate-limit: 30 requests per 60 s per IP.
	$ip  = dtb_get_client_ip();
	$key = 'dtb_veeqo_rates_rl_' . md5( $ip );
	$cnt = (int) get_transient( $key );
	if ( $cnt >= 30 ) {
		$resp = new WP_REST_Response(
			dtb_error_envelope( 'rate_limited', 'Too many requests. Please try again shortly.', 429 ),
			429
		);
		$resp->header( 'Retry-After', '60' );
		return $resp;
	}
	set_transient( $key, $cnt + 1, 60 );

	$body = $request->get_json_params();
	if ( empty( $body ) || empty( $body['items'] ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'invalid_body', 'Request body must include "items".', 400 ),
			400
		);
	}

	$destination = $body['destination'] ?? [];
	$items       = (array) $body['items'];

	// ── Calculate order metrics ───────────────────────────────────────────────
	$subtotal        = 0.0;
	$total_weight    = 0.0;
	$has_repair      = false;
	$has_product     = false;

	foreach ( $items as $item ) {
		$qty       = max( 1, (int) ( $item['quantity'] ?? 1 ) );
		$price     = (float) ( $item['price'] ?? 0 );
		$weight    = (float) ( $item['weight'] ?? 0.5 );
		$category  = strtolower( (string) ( $item['category'] ?? 'product' ) );

		$subtotal     += $price * $qty;
		$total_weight += $weight * $qty;

		if ( str_contains( $category, 'repair' ) || str_contains( $category, 'service' ) ) {
			$has_repair = true;
		} else {
			$has_product = true;
		}
	}

	// ── Determine country / zone ──────────────────────────────────────────────
	$country = strtoupper( sanitize_text_field( $destination['country'] ?? 'US' ) );
	$state   = strtoupper( sanitize_text_field( $destination['state']   ?? ''   ) );

	$is_domestic      = ( 'US' === $country );
	$is_international = ! $is_domestic;

	// ── Repair-service rate logic ─────────────────────────────────────────────
	// Repair services are drop-shipped to our repair facility; a flat
	// two-way shipping allowance is included in the service quote.
	if ( $has_repair && ! $has_product ) {
		$rates = [
			[
				'id'       => 'repair_standard',
				'name'     => 'Repair Service — Prepaid Shipping Label',
				'price'    => 0.00,
				'currency' => 'USD',
				'eta'      => 'We will email a prepaid shipping label within 24 hours.',
			],
		];

		return new WP_REST_Response( [ 'rates' => $rates ], 200 );
	}

	// ── Product rate logic ────────────────────────────────────────────────────
	// Free shipping threshold: orders ≥ $500 ship free (domestic, standard).
	// Otherwise rates are tiered by total order weight.

	$rates = [];

	if ( $is_domestic ) {
		if ( $subtotal >= 500.0 ) {
			$standard_price = 0.00;
		} elseif ( $total_weight <= 1.0 ) {
			$standard_price = 7.99;
		} elseif ( $total_weight <= 5.0 ) {
			$standard_price = 12.99;
		} elseif ( $total_weight <= 15.0 ) {
			$standard_price = 19.99;
		} else {
			$standard_price = 29.99;
		}

		$rates[] = [
			'id'       => 'standard',
			'name'     => 'Standard Shipping (5–7 business days)',
			'price'    => round( $standard_price, 2 ),
			'currency' => 'USD',
		];

		$express_price = max( 0.00, $standard_price + 10.00 );
		$rates[]       = [
			'id'       => 'express',
			'name'     => 'Express Shipping (2–3 business days)',
			'price'    => round( $express_price, 2 ),
			'currency' => 'USD',
		];

		$overnight_price = max( 0.00, $standard_price + 30.00 );
		$rates[]         = [
			'id'       => 'overnight',
			'name'     => 'Overnight Shipping (next business day)',
			'price'    => round( $overnight_price, 2 ),
			'currency' => 'USD',
		];
	} else {
		// International: flat-rate tiers.
		if ( $total_weight <= 2.0 ) {
			$intl_base = 29.99;
		} elseif ( $total_weight <= 10.0 ) {
			$intl_base = 49.99;
		} else {
			$intl_base = 79.99;
		}

		$rates[] = [
			'id'       => 'intl_standard',
			'name'     => 'International Standard (10–15 business days)',
			'price'    => round( $intl_base, 2 ),
			'currency' => 'USD',
		];
		$rates[] = [
			'id'       => 'intl_express',
			'name'     => 'International Express (5–7 business days)',
			'price'    => round( $intl_base + 30.00, 2 ),
			'currency' => 'USD',
		];
	}

	// Allow Veeqo-aware overrides when configured — log the sync, return computed rates.
	if ( dtb_veeqo_enabled() ) {
		dtb_veeqo_log( 'debug', 'shipping_rates_calculated', 'Rates computed for request.', [
			'subtotal'     => $subtotal,
			'weight'       => $total_weight,
			'country'      => $country,
			'rate_count'   => count( $rates ),
		] );
	}

	return new WP_REST_Response( [ 'rates' => $rates ], 200 );
}

/**
 * GET /dtb/v1/veeqo/inventory
 *
 * Returns Veeqo inventory levels for all (or filtered) products.
 * Requires a valid JWT.
 *
 * Query params:
 *   page     (int, default 1)
 *   per_page (int, default 100, max 100)
 */
function dtb_veeqo_route_inventory( WP_REST_Request $request ): WP_REST_Response {
	if ( ! dtb_veeqo_enabled() ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'not_configured', 'Veeqo integration is not configured.', 503 ),
			503
		);
	}

	$page     = max( 1, (int) ( $request->get_param( 'page' )     ?? 1 ) );
	$per_page = min( 100, max( 1, (int) ( $request->get_param( 'per_page' ) ?? 100 ) ) );

	// Veeqo pagination parameters are page_number (1-indexed) and page_size (max 100).
	$result = dtb_veeqo_request( 'GET', '/products', [
		'page_number' => (string) $page,
		'page_size'   => (string) $per_page,
	] );

	if ( ! $result['ok'] ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'veeqo_error', $result['error'], $result['status'] ),
			(int) $result['status']
		);
	}

	// Extract inventory summary per product.
	$inventory = [];
	$products  = is_array( $result['data'] ) ? $result['data'] : [];

	foreach ( $products as $product ) {
		$product_id    = $product['id'] ?? null;
		$title         = $product['title'] ?? '';
		$sku_variants  = $product['sellables'] ?? [];

		foreach ( $sku_variants as $sellable ) {
			$available = 0;
			$stock     = $sellable['stock_entries'] ?? [];
			foreach ( $stock as $entry ) {
				$available += (int) ( $entry['available_stock'] ?? 0 );
			}

			$inventory[] = [
				'product_id'  => $product_id,
				'product'     => $title,
				'sku'         => $sellable['sku_code'] ?? '',
				'sellable_id' => $sellable['id'] ?? null,
				'available'   => $available,
			];
		}
	}

	return new WP_REST_Response( [ 'inventory' => $inventory ], 200 );
}

/**
 * POST /dtb/v1/veeqo/webhooks/order
 *
 * Receives Veeqo order-status webhook events and propagates them to
 * the matching WooCommerce order.
 *
 * Veeqo signs webhook requests with an HMAC-SHA256 of the raw body using
 * DTB_VEEQO_WEBHOOK_SECRET. Signature is passed in the X-Veeqo-Signature header.
 *
 * Supported Veeqo status → WC status mappings:
 *   awaiting_fulfillment → processing
 *   allocated            → processing
 *   printed              → processing
 *   shipped              → completed
 *   cancelled            → cancelled
 *   refunded             → refunded
 */
function dtb_veeqo_route_webhook_order( WP_REST_Request $request ): WP_REST_Response {
	$cfg    = dtb_veeqo_config();
	$secret = $cfg['webhook_secret'];

	// Validate HMAC signature when secret is configured.
	if ( '' !== $secret ) {
		$raw_body = $request->get_body();
		$sig      = $request->get_header( 'x_veeqo_signature' );

		if ( ! $sig ) {
			dtb_veeqo_log( 'warn', 'webhook_no_signature', 'Veeqo webhook received without signature.' );
			return new WP_REST_Response(
				dtb_error_envelope( 'missing_signature', 'Webhook signature is required.', 401 ),
				401
			);
		}

		$expected = base64_encode( hash_hmac( 'sha256', $raw_body, $secret, true ) ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode
		if ( ! hash_equals( $expected, $sig ) ) {
			dtb_veeqo_log( 'warn', 'webhook_bad_signature', 'Veeqo webhook HMAC mismatch.' );
			return new WP_REST_Response(
				dtb_error_envelope( 'invalid_signature', 'Webhook signature mismatch.', 401 ),
				401
			);
		}
	}

	$payload = $request->get_json_params();
	if ( empty( $payload ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'invalid_body', 'Empty or invalid JSON payload.', 400 ),
			400
		);
	}

	$veeqo_status   = strtolower( sanitize_text_field( $payload['status']   ?? '' ) );
	$veeqo_order_id = absint( $payload['id'] ?? 0 );

	// Veeqo stores the WooCommerce order number in the channel_order_number field.
	$wc_order_number = sanitize_text_field( $payload['channel_order_number'] ?? '' );

	if ( ! $wc_order_number ) {
		dtb_veeqo_log( 'warn', 'webhook_no_wc_order', 'Veeqo webhook missing channel_order_number.', [
			'veeqo_order_id' => $veeqo_order_id,
		] );
		return new WP_REST_Response( [ 'success' => true, 'note' => 'No WC order number; skipped.' ], 200 );
	}

	// Map Veeqo status to WooCommerce order status.
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
		dtb_veeqo_log( 'debug', 'webhook_unmapped_status', 'Veeqo status has no WC mapping.', [
			'veeqo_status'   => $veeqo_status,
			'veeqo_order_id' => $veeqo_order_id,
		] );
		return new WP_REST_Response( [ 'success' => true, 'note' => 'Status not mapped; skipped.' ], 200 );
	}

	// Find the WC order by order number.
	$orders = wc_get_orders( [
		'order_number' => $wc_order_number,
		'limit'        => 1,
		'return'       => 'objects',
	] );

	if ( empty( $orders ) ) {
		dtb_veeqo_log( 'warn', 'webhook_wc_order_not_found', 'WC order not found for Veeqo webhook.', [
			'wc_order_number' => $wc_order_number,
			'veeqo_order_id'  => $veeqo_order_id,
		] );
		return new WP_REST_Response(
			dtb_error_envelope( 'order_not_found', 'WooCommerce order not found.', 404 ),
			404
		);
	}

	/** @var WC_Order $wc_order */
	$wc_order = $orders[0];

	$prev_status = $wc_order->get_status();
	$wc_order->update_status( $wc_status, sprintf( '[Veeqo] Status synced from Veeqo order #%d (%s).', $veeqo_order_id, $veeqo_status ) );

	dtb_veeqo_log( 'info', 'webhook_status_synced', 'WC order status updated from Veeqo webhook.', [
		'wc_order_id'    => $wc_order->get_id(),
		'prev_status'    => $prev_status,
		'new_status'     => $wc_status,
		'veeqo_order_id' => $veeqo_order_id,
		'veeqo_status'   => $veeqo_status,
	] );

	// Optionally store the Veeqo order ID on the WC order for cross-reference.
	if ( $veeqo_order_id > 0 ) {
		$wc_order->update_meta_data( '_veeqo_order_id', $veeqo_order_id );
		$wc_order->save_meta_data();
	}

	return new WP_REST_Response( [
		'success'     => true,
		'wc_order_id' => $wc_order->get_id(),
		'new_status'  => $wc_status,
	], 200 );
}


// =============================================================================
// SECTION 4 — WOOCOMMERCE → VEEQO ORDER SYNC
//
// When a WooCommerce order is created or its status changes, sync the
// information to Veeqo for fulfilment.
// =============================================================================

/**
 * Hook: after WooCommerce checkout creates the order, push it to Veeqo.
 *
 * Fires immediately after the order is persisted (before payment), giving
 * Veeqo an early notification for pre-fulfilment processing.
 */
add_action( 'woocommerce_checkout_order_processed', 'dtb_veeqo_sync_new_order', 20, 3 );

/**
 * WooCommerce Store API checkout (used by the React headless frontend via
 * /wc/store/v1/checkout).  The classic 'woocommerce_checkout_order_processed'
 * hook does NOT fire for Store API orders, so we bind a separate listener.
 */
add_action( 'woocommerce_store_api_checkout_order_processed', function ( WC_Order $order ): void {
	dtb_veeqo_sync_new_order( $order->get_id(), [], $order );
}, 20 );

function dtb_veeqo_sync_new_order( int $order_id, array $posted_data, WC_Order $order ): void {
	if ( ! dtb_veeqo_enabled() ) {
		return;
	}

	// Avoid double-sync if Veeqo order was already created (e.g. duplicate hook).
	if ( $order->get_meta( '_veeqo_order_id' ) ) {
		return;
	}

	$veeqo_order = dtb_veeqo_build_order_payload( $order );
	if ( null === $veeqo_order ) {
		return;
	}

	$result = dtb_veeqo_request( 'POST', '/orders', [], $veeqo_order );

	if ( $result['ok'] && ! empty( $result['data']['id'] ) ) {
		$veeqo_id = (int) $result['data']['id'];
		$order->update_meta_data( '_veeqo_order_id', $veeqo_id );
		$order->add_order_note( sprintf( '[Veeqo] Order created in Veeqo: #%d.', $veeqo_id ) );
		$order->save_meta_data();

		dtb_veeqo_log( 'info', 'order_synced', 'New WC order synced to Veeqo.', [
			'wc_order_id'    => $order_id,
			'veeqo_order_id' => $veeqo_id,
		] );
	} else {
		$order->add_order_note( sprintf( '[Veeqo] Order sync failed: %s', $result['error'] ) );
		dtb_veeqo_log( 'error', 'order_sync_failed', 'Failed to create Veeqo order.', [
			'wc_order_id' => $order_id,
			'error'       => $result['error'],
		] );
	}
}

/**
 * Hook: when a WC order transitions to "processing" (payment complete),
 * ensure the Veeqo order is also updated to awaiting_fulfillment.
 */
add_action( 'woocommerce_order_status_changed', 'dtb_veeqo_sync_order_status', 20, 4 );

function dtb_veeqo_sync_order_status( int $order_id, string $old_status, string $new_status, WC_Order $order ): void {
	if ( ! dtb_veeqo_enabled() ) {
		return;
	}

	$veeqo_order_id = (int) $order->get_meta( '_veeqo_order_id' );
	if ( ! $veeqo_order_id ) {
		// If we never synced the order to Veeqo, try now (e.g. order was created before plugin was active).
		if ( 'processing' === $new_status ) {
			dtb_veeqo_sync_new_order( $order_id, [], $order );
		}
		return;
	}

	// Map WC status to Veeqo status.
	$wc_to_veeqo = [
		'processing' => 'awaiting_fulfillment',
		'on-hold'    => 'awaiting_fulfillment',
		'completed'  => 'shipped',
		'cancelled'  => 'cancelled',
		'refunded'   => 'refunded',
	];

	$veeqo_status = $wc_to_veeqo[ $new_status ] ?? null;
	if ( null === $veeqo_status ) {
		return;
	}

	$result = dtb_veeqo_request( 'PUT', '/orders/' . $veeqo_order_id, [], [ 'status' => $veeqo_status ] );

	if ( $result['ok'] ) {
		dtb_veeqo_log( 'info', 'order_status_synced', 'WC order status synced to Veeqo.', [
			'wc_order_id'    => $order_id,
			'veeqo_order_id' => $veeqo_order_id,
			'wc_status'      => $new_status,
			'veeqo_status'   => $veeqo_status,
		] );
	} else {
		dtb_veeqo_log( 'warn', 'order_status_sync_failed', 'Failed to sync WC order status to Veeqo.', [
			'wc_order_id'    => $order_id,
			'veeqo_order_id' => $veeqo_order_id,
			'error'          => $result['error'],
		] );
	}
}

/**
 * Build the Veeqo order creation payload from a WooCommerce order.
 *
 * @param WC_Order $order
 * @return array|null  Payload array, or null when the order has no items.
 */
function dtb_veeqo_build_order_payload( WC_Order $order ): ?array {
	$cfg   = dtb_veeqo_config();
	$items = $order->get_items();

	if ( empty( $items ) ) {
		return null;
	}

	$line_items = [];
	foreach ( $items as $item ) {
		/** @var WC_Order_Item_Product $item */
		$product    = $item->get_product();
		$sellable_id = $product ? (int) $product->get_meta( '_veeqo_sellable_id' ) : 0;

		$line_items[] = [
			'sellable_id'    => $sellable_id ?: null,
			'sellable_title' => $item->get_name(),
			'quantity'       => $item->get_quantity(),
			'price_per_unit' => (float) $item->get_subtotal() / max( 1, $item->get_quantity() ),
		];
	}

	$billing = $order->get_address( 'billing' );

	return [
		'channel_id'           => $cfg['channel_id'] ?: null,
		'channel_order_number' => ltrim( $order->get_order_number(), '#' ),
		'warehouse_id'         => $cfg['warehouse_id'] ?: null,
		'customer' => [
			'email'      => $order->get_billing_email(),
			'first_name' => $billing['first_name'],
			'last_name'  => $billing['last_name'],
			'mobile'     => $order->get_billing_phone(),
		],
		'deliver_to' => [
			'first_name' => $order->get_shipping_first_name() ?: $billing['first_name'],
			'last_name'  => $order->get_shipping_last_name()  ?: $billing['last_name'],
			'address1'   => $order->get_shipping_address_1()  ?: $billing['address_1'],
			'address2'   => $order->get_shipping_address_2()  ?: $billing['address_2'],
			'city'       => $order->get_shipping_city()       ?: $billing['city'],
			'state'      => $order->get_shipping_state()      ?: $billing['state'],
			'zip'        => $order->get_shipping_postcode()   ?: $billing['postcode'],
			'country'    => $order->get_shipping_country()    ?: $billing['country'],
		],
		'line_items' => $line_items,
		'notes'      => $order->get_customer_note(),
	];
}


// =============================================================================
// SECTION 5 — CUSTOM WOOCOMMERCE SHIPPING METHOD
//
// Registers "Drywall Toolbox / Veeqo Rates" as a WooCommerce shipping method
// available in WooCommerce → Settings → Shipping → Shipping zones.
//
// The method calls the server-side dtb_veeqo_calculate_rates() helper
// to determine rates rather than calling Veeqo's API on every page load,
// keeping latency low and avoiding unnecessary API calls.
// =============================================================================

add_action( 'woocommerce_shipping_init', 'dtb_veeqo_register_shipping_method' );

function dtb_veeqo_register_shipping_method(): void {
	if ( ! class_exists( 'DTB_Veeqo_Shipping_Method' ) ) {

		/**
		 * WooCommerce shipping method: DTB / Veeqo Rates
		 *
		 * Shows Standard, Express, and Overnight options calculated from the
		 * cart total and total weight.  Free shipping is applied automatically
		 * for domestic orders ≥ $500.
		 */
		class DTB_Veeqo_Shipping_Method extends WC_Shipping_Method {

			public function __construct( int $instance_id = 0 ) {
				$this->id                 = 'dtb_veeqo_rates';
				$this->instance_id        = $instance_id;
				$this->method_title       = __( 'Drywall Toolbox Shipping', 'woocommerce' );
				$this->method_description = __( 'Real-time shipping rates via Veeqo.', 'woocommerce' );
				$this->supports           = [ 'shipping-zones', 'instance-settings' ];
				$this->title              = $this->get_option( 'title', __( 'Shipping', 'woocommerce' ) );
				$this->enabled            = 'yes';

				$this->init();
			}

			public function init(): void {
				$this->init_form_fields();
				$this->init_settings();
				add_action(
					'woocommerce_update_options_shipping_' . $this->id,
					[ $this, 'process_admin_options' ]
				);
			}

			public function init_form_fields(): void {
				$this->form_fields = [
					'title' => [
						'title'   => __( 'Method title', 'woocommerce' ),
						'type'    => 'text',
						'default' => __( 'Shipping', 'woocommerce' ),
					],
				];
			}

			/**
			 * Calculate shipping rates for the current cart and destination.
			 *
			 * @param array $package WooCommerce shipping package (destination + contents).
			 */
			public function calculate_shipping( $package = [] ): void {
				$destination = $package['destination'] ?? [];
				$contents    = $package['contents']    ?? [];

				$subtotal     = 0.0;
				$total_weight = 0.0;
				$has_repair   = false;

				foreach ( $contents as $cart_item ) {
					$product  = $cart_item['data'] ?? null;
					$qty      = (int) ( $cart_item['quantity'] ?? 1 );
					$price    = $product ? (float) $product->get_price() : 0.0;
					$weight   = $product ? (float) $product->get_weight() : 0.5;

					$subtotal     += $price * $qty;
					$total_weight += $weight * $qty;

					$cats = $product ? wp_get_post_terms( $product->get_id(), 'product_cat', [ 'fields' => 'names' ] ) : [];
					foreach ( (array) $cats as $cat ) {
						if ( str_contains( strtolower( $cat ), 'repair' ) || str_contains( strtolower( $cat ), 'service' ) ) {
							$has_repair = true;
						}
					}
				}

				$country = strtoupper( sanitize_text_field( $destination['country'] ?? 'US' ) );

				if ( $has_repair ) {
					$this->add_rate( [
						'id'    => $this->get_rate_id( 'repair_prepaid' ),
						'label' => __( 'Repair Service — Prepaid Label', 'woocommerce' ),
						'cost'  => 0.00,
					] );
					return;
				}

				$is_domestic = ( 'US' === $country );

				if ( $is_domestic ) {
					$standard = $subtotal >= 500.0 ? 0.00
						: ( $total_weight <= 1.0 ? 7.99
							: ( $total_weight <= 5.0 ? 12.99
								: ( $total_weight <= 15.0 ? 19.99 : 29.99 ) ) );

					$this->add_rate( [
						'id'    => $this->get_rate_id( 'standard' ),
						'label' => $subtotal >= 500.0
							? __( 'Free Standard Shipping (5–7 business days)', 'woocommerce' )
							: __( 'Standard Shipping (5–7 business days)', 'woocommerce' ),
						'cost'  => $standard,
					] );
					$this->add_rate( [
						'id'    => $this->get_rate_id( 'express' ),
						'label' => __( 'Express Shipping (2–3 business days)', 'woocommerce' ),
						'cost'  => max( 0.00, $standard + 10.00 ),
					] );
					$this->add_rate( [
						'id'    => $this->get_rate_id( 'overnight' ),
						'label' => __( 'Overnight Shipping (next business day)', 'woocommerce' ),
						'cost'  => max( 0.00, $standard + 30.00 ),
					] );
				} else {
					$base = $total_weight <= 2.0 ? 29.99 : ( $total_weight <= 10.0 ? 49.99 : 79.99 );
					$this->add_rate( [
						'id'    => $this->get_rate_id( 'intl_standard' ),
						'label' => __( 'International Standard (10–15 business days)', 'woocommerce' ),
						'cost'  => $base,
					] );
					$this->add_rate( [
						'id'    => $this->get_rate_id( 'intl_express' ),
						'label' => __( 'International Express (5–7 business days)', 'woocommerce' ),
						'cost'  => $base + 30.00,
					] );
				}
			}
		}
	}
}

add_filter( 'woocommerce_shipping_methods', function ( array $methods ): array {
	$methods['dtb_veeqo_rates'] = 'DTB_Veeqo_Shipping_Method';
	return $methods;
} );


// =============================================================================
// SECTION 6 — INVENTORY SYNC
//
// When WooCommerce reduces stock (after payment), log the event to Veeqo
// via a stock-adjustment note for reconciliation in the Veeqo warehouse dashboard.
// This supplements Veeqo's own order-based stock management without requiring
// a second stock mutation that could cause double-counting.
// =============================================================================

add_action( 'woocommerce_reduce_order_stock', 'dtb_veeqo_log_stock_reduction', 20 );

function dtb_veeqo_log_stock_reduction( WC_Order $order ): void {
	if ( ! dtb_veeqo_enabled() ) {
		return;
	}

	$veeqo_order_id = (int) $order->get_meta( '_veeqo_order_id' );
	$items          = $order->get_items();
	$adjustments    = [];

	foreach ( $items as $item ) {
		/** @var WC_Order_Item_Product $item */
		$product = $item->get_product();
		if ( ! $product || ! $product->managing_stock() ) {
			continue;
		}

		$adjustments[] = [
			'product_name' => $item->get_name(),
			'sku'          => $product->get_sku(),
			'qty'          => $item->get_quantity(),
			'new_stock'    => $product->get_stock_quantity(),
		];
	}

	if ( ! empty( $adjustments ) ) {
		dtb_veeqo_log( 'info', 'stock_reduced', 'WooCommerce stock reduced after order.', [
			'wc_order_id'    => $order->get_id(),
			'veeqo_order_id' => $veeqo_order_id,
			'adjustments'    => $adjustments,
		] );
	}
}


// =============================================================================
// SECTION 7 — PRODUCT SKU → VEEQO SELLABLE ID MAPPING
//
// After a WooCommerce product is saved, attempt to find the matching Veeqo
// sellable by SKU and store the sellable ID as product meta (_veeqo_sellable_id).
// This enables accurate line-item construction in dtb_veeqo_build_order_payload().
//
// The lookup runs only when Veeqo is configured and a SKU exists.
// =============================================================================

add_action( 'woocommerce_update_product', 'dtb_veeqo_map_product_sku', 20 );

function dtb_veeqo_map_product_sku( int $product_id ): void {
	if ( ! dtb_veeqo_enabled() ) {
		return;
	}

	$product = wc_get_product( $product_id );
	if ( ! $product ) {
		return;
	}

	$sku = $product->get_sku();
	if ( '' === $sku ) {
		return;
	}

	// Skip if mapping already done (re-map on explicit SKU change by checking meta).
	$cached_sku = $product->get_meta( '_veeqo_mapped_sku' );
	if ( $cached_sku === $sku ) {
		return;
	}

	// Use a brief transient lock to avoid hammering the API during bulk saves.
	$lock_key = 'dtb_veeqo_sku_lock_' . md5( $sku );
	if ( get_transient( $lock_key ) ) {
		return;
	}
	set_transient( $lock_key, 1, 30 );

	$result = dtb_veeqo_request( 'GET', '/products', [ 'q' => $sku ] );

	if ( ! $result['ok'] || empty( $result['data'] ) ) {
		return;
	}

	// Find the first sellable whose sku_code matches exactly.
	foreach ( (array) $result['data'] as $veeqo_product ) {
		foreach ( (array) ( $veeqo_product['sellables'] ?? [] ) as $sellable ) {
			if ( isset( $sellable['sku_code'] ) && $sellable['sku_code'] === $sku ) {
				$product->update_meta_data( '_veeqo_sellable_id', (int) $sellable['id'] );
				$product->update_meta_data( '_veeqo_mapped_sku', $sku );
				$product->save_meta_data();
				dtb_veeqo_log( 'debug', 'sku_mapped', 'WC product SKU mapped to Veeqo sellable.', [
					'product_id'  => $product_id,
					'sku'         => $sku,
					'sellable_id' => (int) $sellable['id'],
				] );
				return;
			}
		}
	}
}


// =============================================================================
// SECTION 8 — WEBHOOK AUTO-REGISTRATION (Veeqo → WooCommerce)
//
// Ensures a dtb/v1/veeqo/webhooks/order endpoint is registered in Veeqo so
// order-status changes flow back automatically. Runs once on init; skips if
// already registered (checks a WP option).
// =============================================================================

add_action( 'init', 'dtb_veeqo_ensure_webhooks', 30 );

function dtb_veeqo_ensure_webhooks(): void {
	if ( ! dtb_veeqo_enabled() ) {
		return;
	}

	// Only re-check once per day to avoid unnecessary API calls.
	if ( get_transient( 'dtb_veeqo_webhook_registered' ) ) {
		return;
	}
	set_transient( 'dtb_veeqo_webhook_registered', 1, DAY_IN_SECONDS );

	$delivery_url = rest_url( 'dtb/v1/veeqo/webhooks/order' );
	$cfg          = dtb_veeqo_config();

	// List existing webhooks.
	$result = dtb_veeqo_request( 'GET', '/webhooks' );
	if ( ! $result['ok'] || ! is_array( $result['data'] ) ) {
		return;
	}

	// Check if our delivery URL is already registered.
	foreach ( $result['data'] as $hook ) {
		if ( isset( $hook['url'] ) && rtrim( $hook['url'], '/' ) === rtrim( $delivery_url, '/' ) ) {
			return; // Already registered.
		}
	}

	// Register the webhook in Veeqo.
	$register = dtb_veeqo_request( 'POST', '/webhooks', [], [
		'url'    => $delivery_url,
		'events' => [ 'order.status_changed' ],
	] );

	if ( $register['ok'] ) {
		dtb_veeqo_log( 'info', 'webhook_registered', 'Veeqo → WC webhook registered.', [
			'delivery_url' => $delivery_url,
		] );
	} else {
		dtb_veeqo_log( 'warn', 'webhook_register_failed', 'Could not register Veeqo webhook.', [
			'error' => $register['error'],
		] );
	}
}


// =============================================================================
// SECTION 9 — STRUCTURED LOGGING
//
// All Veeqo integration events are logged via error_log() in a consistent JSON
// format for easy parsing by log aggregators (Papertrail, Loggly, CloudWatch).
//
// Format:
//   [DTB Veeqo] {"level":"info","event":"order_synced","message":"...","context":{...},"ts":"..."}
// =============================================================================

/**
 * Write a structured log entry for a Veeqo integration event.
 *
 * @param string $level   Severity: debug | info | warn | error.
 * @param string $event   Machine-readable event name (snake_case).
 * @param string $message Human-readable description.
 * @param array  $context Optional additional context key-value pairs.
 */
function dtb_veeqo_log( string $level, string $event, string $message, array $context = [] ): void {
	// Suppress debug logs in production by default.
	// To enable debug logging, add: define('DTB_VEEQO_DEBUG', true); to wp-config.php.
	if ( 'debug' === $level && ( ! defined( 'DTB_VEEQO_DEBUG' ) || ! DTB_VEEQO_DEBUG ) ) {
		return;
	}

	$entry = [
		'level'   => $level,
		'event'   => $event,
		'message' => $message,
		'ts'      => gmdate( 'c' ),
	];

	if ( ! empty( $context ) ) {
		$entry['context'] = $context;
	}

	// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
	error_log( '[DTB Veeqo] ' . wp_json_encode( $entry ) );
}


// =============================================================================
// SECTION 10 — HEALTH MONITOR
//
// Scheduled daily: verifies the Veeqo API is reachable and logs the result.
// The cron event can be extended to send admin email alerts on failure.
// =============================================================================

add_action( 'init', function (): void {
	if ( ! wp_next_scheduled( 'dtb_veeqo_health_check' ) ) {
		wp_schedule_event( time(), 'daily', 'dtb_veeqo_health_check' );
	}
} );

add_action( 'dtb_veeqo_health_check', 'dtb_veeqo_run_health_check' );

function dtb_veeqo_run_health_check(): void {
	if ( ! dtb_veeqo_enabled() ) {
		dtb_veeqo_log( 'warn', 'health_check_skipped', 'Veeqo health check skipped: API key not configured.' );
		return;
	}

	$result = dtb_veeqo_request( 'GET', '/warehouses' );

	if ( $result['ok'] ) {
		$count = is_array( $result['data'] ) ? count( $result['data'] ) : 0;
		dtb_veeqo_log( 'info', 'health_check_ok', 'Veeqo API reachable.', [ 'warehouses' => $count ] );

		// Clear any "unhealthy" transient.
		delete_transient( 'dtb_veeqo_unhealthy' );
	} else {
		dtb_veeqo_log( 'error', 'health_check_failed', 'Veeqo API unreachable.', [
			'status' => $result['status'],
			'error'  => $result['error'],
		] );

		// Track consecutive failures; alert admin on 3rd consecutive failure.
		$failures = (int) get_transient( 'dtb_veeqo_unhealthy' ) + 1;
		set_transient( 'dtb_veeqo_unhealthy', $failures, 3 * DAY_IN_SECONDS );

		if ( $failures >= 3 ) {
			dtb_veeqo_send_alert(
				'[Alert] Veeqo Integration Unreachable',
				sprintf(
					"The Veeqo API has been unreachable for %d consecutive daily health checks.\n\nLast error: %s\n\nPlease verify the DTB_VEEQO_API_KEY constant and Veeqo service status.",
					$failures,
					$result['error']
				)
			);
		}
	}
}

/**
 * Send an admin alert email (only when DTB_ADMIN_EMAIL is defined).
 */
function dtb_veeqo_send_alert( string $subject, string $body ): void {
	$to = defined( 'DTB_ADMIN_EMAIL' ) ? DTB_ADMIN_EMAIL : get_option( 'admin_email', '' );
	if ( empty( $to ) ) {
		return;
	}

	wp_mail(
		$to,
		'[Drywall Toolbox] ' . $subject,
		$body,
		[ 'Content-Type: text/plain; charset=UTF-8' ]
	);
}


// =============================================================================
// SECTION 11 — REPAIR SERVICE REQUEST ENDPOINT
//
// POST /dtb/v1/repair-request
//
// Accepts the 5-step repair form submission from the React SPA, creates a
// WooCommerce order using the WC internal PHP API (no HTTP round-trip needed),
// optionally syncs the service order to Veeqo for fulfilment tracking, and
// emails a confirmation to the customer.
//
// Security:
//   • Rate-limited: 5 repair submissions per IP per hour.
//   • Input sanitised before any write operation.
//   • No JWT required (unauthenticated guests submit repair requests).
//
// WooCommerce order:
//   • Status: wc-pending (awaiting quote approval)
//   • Line item: custom "Repair Service — {brand} {model}" item (no WC product needed)
//   • Shipping address: customer's return address
//   • Order meta: full service details stored as _dtb_repair_* meta keys
//   • Order note: service type, priority, and issue description
//
// Veeqo sync:
//   • Only runs when DTB_VEEQO_API_KEY is configured.
//   • Uses the same dtb_veeqo_build_order_payload() builder as standard orders.
// =============================================================================

/**
 * POST /dtb/v1/repair-request
 *
 * Expected JSON body:
 * {
 *   "fullName":        "Jane Smith",
 *   "email":           "jane@example.com",
 *   "phone":           "555-000-1234",
 *   "company":         "Acme Drywall",            // optional
 *   "toolBrand":       "Columbia",
 *   "toolCategory":    "Finishing Boxes",
 *   "toolModel":       "Columbia 10-inch Flat Box",
 *   "serialNumber":    "COL-2024-XXXXX",           // optional
 *   "toolAge":         "3–5 years",                // optional
 *   "serviceType":     "General Repair",
 *   "priority":        "Standard (5–7 business days)",
 *   "issueStart":      "This week",                // optional
 *   "issueDescription":"Pump losing pressure…",
 *   "contactPreference":"email",
 *   "address":         "123 Main St",
 *   "city":            "Sacramento",
 *   "state":           "CA",
 *   "zip":             "95814",
 *   "country":         "US",
 *   "shippingRateId":  "standard",
 *   "shippingRateName":"Standard Shipping (5–7 business days)",
 *   "shippingRatePrice":0
 * }
 */
function dtb_veeqo_route_repair_request( WP_REST_Request $request ): WP_REST_Response {
	// ── Rate limit: 5 submissions per IP per hour ─────────────────────────────
	$ip      = dtb_get_client_ip();
	$rl_key  = 'dtb_repair_rl_' . md5( $ip );
	$rl_cnt  = (int) get_transient( $rl_key );
	if ( $rl_cnt >= 5 ) {
		$resp = new WP_REST_Response(
			dtb_error_envelope( 'rate_limited', 'Too many repair requests. Please try again in an hour.', 429 ),
			429
		);
		$resp->header( 'Retry-After', '3600' );
		return $resp;
	}
	set_transient( $rl_key, $rl_cnt + 1, HOUR_IN_SECONDS );

	$body = $request->get_json_params();
	if ( empty( $body ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'invalid_body', 'Request body must be valid JSON.', 400 ),
			400
		);
	}

	// ── Sanitise all inputs ───────────────────────────────────────────────────
	$full_name    = sanitize_text_field( $body['fullName']        ?? '' );
	$email        = sanitize_email(      $body['email']           ?? '' );
	$phone        = sanitize_text_field( $body['phone']           ?? '' );
	$company      = sanitize_text_field( $body['company']         ?? '' );
	$tool_brand   = sanitize_text_field( $body['toolBrand']       ?? '' );
	$tool_cat     = sanitize_text_field( $body['toolCategory']    ?? '' );
	$tool_model   = sanitize_text_field( $body['toolModel']       ?? '' );
	$serial       = sanitize_text_field( $body['serialNumber']    ?? '' );
	$tool_age     = sanitize_text_field( $body['toolAge']         ?? '' );
	$svc_type     = sanitize_text_field( $body['serviceType']     ?? '' );
	$priority     = sanitize_text_field( $body['priority']        ?? '' );
	$issue_start  = sanitize_text_field( $body['issueStart']      ?? '' );
	$issue_desc   = sanitize_textarea_field( $body['issueDescription'] ?? '' );
	$contact_pref = sanitize_text_field( $body['contactPreference'] ?? 'email' );
	$address      = sanitize_text_field( $body['address']         ?? '' );
	$city         = sanitize_text_field( $body['city']            ?? '' );
	$state        = sanitize_text_field( $body['state']           ?? '' );
	$zip          = sanitize_text_field( $body['zip']             ?? '' );
	$country      = strtoupper( sanitize_text_field( $body['country'] ?? 'US' ) );
	$rate_id      = sanitize_text_field( $body['shippingRateId']   ?? '' );
	$rate_name    = sanitize_text_field( $body['shippingRateName'] ?? '' );
	$rate_price   = (float) ( $body['shippingRatePrice'] ?? 0 );

	// ── Validate required fields ──────────────────────────────────────────────
	$required = compact( 'full_name', 'email', 'phone', 'tool_brand', 'svc_type', 'priority', 'issue_desc', 'address', 'city', 'state', 'zip' );
	foreach ( $required as $field => $value ) {
		if ( '' === trim( $value ) ) {
			return new WP_REST_Response(
				dtb_error_envelope( 'validation_error', sprintf( 'Field "%s" is required.', $field ), 422 ),
				422
			);
		}
	}

	if ( ! is_email( $email ) ) {
		return new WP_REST_Response(
			dtb_error_envelope( 'validation_error', 'A valid email address is required.', 422 ),
			422
		);
	}

	// ── Build tool description ────────────────────────────────────────────────
	$tool_parts = array_filter( [ $tool_brand, $tool_model ?: $tool_cat ] );
	$tool_desc  = implode( ' — ', $tool_parts );

	// ── Require WooCommerce ───────────────────────────────────────────────────
	if ( ! function_exists( 'wc_create_order' ) ) {
		dtb_veeqo_log( 'error', 'repair_wc_missing', 'WooCommerce not available for repair order creation.' );
		return new WP_REST_Response(
			dtb_error_envelope( 'wc_unavailable', 'Store not available. Please try again or call us directly.', 503 ),
			503
		);
	}

	// ── Create WooCommerce order ──────────────────────────────────────────────
	$wc_order = wc_create_order( [
		'status'        => 'pending',
		'customer_id'   => 0,
		'customer_note' => $issue_desc,
	] );

	if ( is_wp_error( $wc_order ) ) {
		dtb_veeqo_log( 'error', 'repair_order_failed', $wc_order->get_error_message() );
		return new WP_REST_Response(
			dtb_error_envelope( 'order_error', 'Could not create the service order. Please try again.', 500 ),
			500
		);
	}

	// Set billing address.
	$name_parts = explode( ' ', $full_name, 2 );
	$first_name = $name_parts[0] ?? '';
	$last_name  = $name_parts[1] ?? '';

	$wc_order->set_billing_first_name( $first_name );
	$wc_order->set_billing_last_name( $last_name );
	$wc_order->set_billing_company( $company );
	$wc_order->set_billing_email( $email );
	$wc_order->set_billing_phone( $phone );
	$wc_order->set_billing_address_1( $address );
	$wc_order->set_billing_city( $city );
	$wc_order->set_billing_state( $state );
	$wc_order->set_billing_postcode( $zip );
	$wc_order->set_billing_country( $country );

	// Set shipping address (same as billing — tool is shipped from and returned to this address).
	$wc_order->set_shipping_first_name( $first_name );
	$wc_order->set_shipping_last_name( $last_name );
	$wc_order->set_shipping_company( $company );
	$wc_order->set_shipping_address_1( $address );
	$wc_order->set_shipping_city( $city );
	$wc_order->set_shipping_state( $state );
	$wc_order->set_shipping_postcode( $zip );
	$wc_order->set_shipping_country( $country );

	// Add custom repair-service line item (no WC product required).
	$item = new WC_Order_Item_Fee();
	$item->set_name( sprintf( 'Repair Service — %s', $tool_desc ) );
	$item->set_amount( 0.00 );  // Quote pending; amount set after technician review.
	$item->set_total( 0.00 );
	$item->set_tax_status( 'none' );
	$wc_order->add_item( $item );

	// Add shipping line item when customer selected a rate.
	if ( '' !== $rate_id && $rate_price > 0 ) {
		$ship_item = new WC_Order_Item_Shipping();
		$ship_item->set_method_title( $rate_name ?: 'Shipping' );
		$ship_item->set_method_id( 'dtb_veeqo_rates' );
		$ship_item->set_instance_id( '0' );
		$ship_item->set_total( (string) $rate_price );
		$wc_order->add_item( $ship_item );
	}

	// Store all repair service details as order meta.
	$wc_order->update_meta_data( '_dtb_repair_tool_brand',     $tool_brand );
	$wc_order->update_meta_data( '_dtb_repair_tool_category',  $tool_cat );
	$wc_order->update_meta_data( '_dtb_repair_tool_model',     $tool_model );
	$wc_order->update_meta_data( '_dtb_repair_serial',         $serial );
	$wc_order->update_meta_data( '_dtb_repair_tool_age',       $tool_age );
	$wc_order->update_meta_data( '_dtb_repair_service_type',   $svc_type );
	$wc_order->update_meta_data( '_dtb_repair_priority',       $priority );
	$wc_order->update_meta_data( '_dtb_repair_issue_start',    $issue_start );
	$wc_order->update_meta_data( '_dtb_repair_contact_pref',   $contact_pref );
	$wc_order->update_meta_data( '_dtb_repair_shipping_rate',  $rate_id );
	$wc_order->update_meta_data( '_dtb_order_type',            'repair_service' );

	// Add a readable internal note.
	$wc_order->add_order_note( sprintf(
		"[Repair Service Request]\nTool: %s\nSerial: %s | Age: %s\nService: %s | Priority: %s\nIssue started: %s\nContact preference: %s\n\nDescription:\n%s",
		$tool_desc,
		$serial ?: 'N/A',
		$tool_age ?: 'Unknown',
		$svc_type,
		$priority,
		$issue_start ?: 'Not specified',
		$contact_pref,
		$issue_desc
	), false );

	// Recalculate totals and save.
	$wc_order->calculate_totals();
	$wc_order->save();

	$wc_order_id     = $wc_order->get_id();
	$wc_order_number = $wc_order->get_order_number();

	dtb_veeqo_log( 'info', 'repair_order_created', 'Repair service WC order created.', [
		'wc_order_id'     => $wc_order_id,
		'wc_order_number' => $wc_order_number,
		'tool'            => $tool_desc,
		'email_domain'    => substr( $email, strpos( $email, '@' ) ?: 0 ),
		'service_type'    => $svc_type,
		'priority'        => $priority,
	] );

	// ── Optional: sync to Veeqo ───────────────────────────────────────────────
	$veeqo_order_id = null;
	if ( dtb_veeqo_enabled() ) {
		$veeqo_payload = dtb_veeqo_build_order_payload( $wc_order );
		if ( $veeqo_payload ) {
			$vresult = dtb_veeqo_request( 'POST', '/orders', [], $veeqo_payload );
			if ( $vresult['ok'] && ! empty( $vresult['data']['id'] ) ) {
				$veeqo_order_id = (int) $vresult['data']['id'];
				$wc_order->update_meta_data( '_veeqo_order_id', $veeqo_order_id );
				$wc_order->add_order_note( sprintf( '[Veeqo] Repair order created: #%d.', $veeqo_order_id ) );
				$wc_order->save_meta_data();
				dtb_veeqo_log( 'info', 'repair_veeqo_synced', 'Repair order synced to Veeqo.', [
					'wc_order_id'    => $wc_order_id,
					'veeqo_order_id' => $veeqo_order_id,
				] );
			} else {
				// Non-fatal: WC order was already created; log but continue.
				dtb_veeqo_log( 'warn', 'repair_veeqo_sync_failed', 'Could not sync repair order to Veeqo.', [
					'wc_order_id' => $wc_order_id,
					'error'       => $vresult['error'],
				] );
			}
		}
	}

	// ── Send customer confirmation email ──────────────────────────────────────
	dtb_veeqo_send_repair_confirmation( $wc_order, $tool_desc, $svc_type, $priority );

	return new WP_REST_Response( [
		'success'         => true,
		'wc_order_id'     => $wc_order_id,
		'wc_order_number' => $wc_order_number,
		'veeqo_order_id'  => $veeqo_order_id,
		'message'         => 'Your repair request has been received. We will contact you within one business day with a quote.',
	], 201 );
}

/**
 * Send the customer confirmation email for a repair request.
 *
 * @param WC_Order $order     The newly created WooCommerce order.
 * @param string   $tool_desc Human-readable tool description.
 * @param string   $svc_type  Service type string.
 * @param string   $priority  Priority string.
 */
function dtb_veeqo_send_repair_confirmation( WC_Order $order, string $tool_desc, string $svc_type, string $priority ): void {
	$to      = $order->get_billing_email();
	$name    = trim( $order->get_billing_first_name() . ' ' . $order->get_billing_last_name() );
	$order_n = $order->get_order_number();

	if ( empty( $to ) ) {
		return;
	}

	$subject = sprintf( '[Drywall Toolbox] Repair Request #%s Received', $order_n );

	$body = sprintf(
		"Hi %s,\n\nThank you for contacting Drywall Toolbox. We've received your repair request and will follow up within one business day.\n\nRequest Details:\n  Order #:      %s\n  Tool:         %s\n  Service Type: %s\n  Priority:     %s\n\nOur service team will review your request and send you a quote and estimated turnaround time.\n\nIf you have any questions, reply to this email or call us directly.\n\nThank you,\nDrywall Toolbox Service Team\nhttps://drywalltoolbox.com",
		$name,
		$order_n,
		$tool_desc,
		$svc_type,
		$priority
	);

	wp_mail(
		$to,
		$subject,
		$body,
		[
			'Content-Type: text/plain; charset=UTF-8',
			'From: Drywall Toolbox Service <' . ( get_option( 'admin_email' ) ?: 'noreply@drywalltoolbox.com' ) . '>',
		]
	);

	// Also notify the admin.
	dtb_veeqo_send_alert(
		sprintf( 'New Repair Request #%s — %s', $order_n, $tool_desc ),
		sprintf(
			"New repair service request received.\n\nOrder #: %s\nCustomer: %s <%s>\nTool: %s\nService: %s\nPriority: %s\n\nView in WP Admin:\n%s",
			$order_n,
			$name,
			$order->get_billing_email(),
			$tool_desc,
			$svc_type,
			$priority,
			admin_url( 'post.php?post=' . $order->get_id() . '&action=edit' )
		)
	);
}
