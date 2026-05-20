<?php
/**
 * DTB Order Tracking — Must-Use Plugin
 *
 * Customer-safe order tracking projection and REST endpoints.
 *
 * REST Routes (under /wp-json/dtb/v1/):
 *   GET  /orders                          — authenticated customer's order list
 *   GET  /orders/{id}                     — order detail (owner or admin)
 *   GET  /orders/{id}/tracking            — customer-safe tracking projection
 *   GET  /orders/{id}/events/stream       — SSE live status updates
 *   GET  /orders/health                   — ordering subsystem health check
 *
 * Provides:
 *   dtb_order_build_tracking_projection()  — Build the customer-safe projection
 *   dtb_order_get_tracking_projection()    — Read (with transient cache)
 *
 * Depends on (loaded before this):
 *   dtb-order-events.php    → dtb_order_get_customer_timeline()
 *   dtb-order-workflows.php → dtb_order_build_status_projection(), dtb_order_get_fulfillment_substate()
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// =============================================================================
// SECTION 1 — TRACKING PROJECTION BUILDER
// =============================================================================

/**
 * Build the customer-safe tracking projection for an order.
 *
 * Never exposes raw payment payloads, gateway internals, Veeqo errors,
 * QuickBooks IDs, admin notes, fraud metadata, or raw exceptions.
 *
 * @param int $order_id  WooCommerce order ID.
 * @return array{
 *   order_id:int, status:string, label:string,
 *   placed_at:string, last_updated_at:string,
 *   tracking_number:string|null, carrier:string|null,
 *   tracking_url:string|null, estimated_delivery:string|null,
 *   items:array, timeline:array
 * }|null  Null when order not found.
 */
function dtb_order_build_tracking_projection( int $order_id ): ?array {
	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return null;
	}

	$status_proj = dtb_order_build_status_projection( $order_id );
	$timeline    = dtb_order_get_customer_timeline( $order_id );
	$int_state   = dtb_order_get_integration_state( $order_id );

	// Tracking data from integration state (set by Veeqo sync).
	$veeqo = $int_state['veeqo'] ?? [];
	$tracking_number   = ( ! empty( $veeqo['tracking'] ) && is_string( $veeqo['tracking'] ) )
		? sanitize_text_field( $veeqo['tracking'] ) : null;
	$carrier           = ( ! empty( $veeqo['carrier'] ) && is_string( $veeqo['carrier'] ) )
		? sanitize_text_field( $veeqo['carrier'] ) : null;
	$estimated_delivery = get_post_meta( $order_id, '_dtb_estimated_delivery', true ) ?: null;

	// Build tracking URL safely.
	$tracking_url = null;
	if ( $tracking_number && $carrier ) {
		$tracking_url = dtb_order_build_tracking_url( $carrier, $tracking_number );
	}

	// Build safe line-item summary.
	$items = [];
	foreach ( $order->get_items() as $item ) {
		/** @var WC_Order_Item_Product $item */
		$items[] = [
			'name'     => wp_strip_all_tags( $item->get_name() ),
			'quantity' => (int) $item->get_quantity(),
			'status'   => $status_proj['fulfillment_substate'],
		];
	}

	return [
		'order_id'           => $order_id,
		'status'             => $status_proj['status'],
		'label'              => $status_proj['label'],
		'placed_at'          => $order->get_date_created() ? $order->get_date_created()->format( 'c' ) : null,
		'last_updated_at'    => $order->get_date_modified() ? $order->get_date_modified()->format( 'c' ) : null,
		'tracking_number'    => $tracking_number,
		'carrier'            => $carrier,
		'tracking_url'       => $tracking_url,
		'estimated_delivery' => $estimated_delivery ? sanitize_text_field( (string) $estimated_delivery ) : null,
		'items'              => $items,
		'timeline'           => $timeline,
	];
}

/**
 * Read the tracking projection, using a short transient cache.
 *
 * @param int $order_id
 * @return array|null
 */
function dtb_order_get_tracking_projection( int $order_id ): ?array {
	$cache_key = 'dtb_order_tracking_' . $order_id;
	$cached    = get_transient( $cache_key );

	if ( is_array( $cached ) ) {
		return $cached;
	}

	$projection = dtb_order_build_tracking_projection( $order_id );

	if ( is_array( $projection ) ) {
		set_transient( $cache_key, $projection, 2 * MINUTE_IN_SECONDS );
	}

	return $projection;
}

/**
 * Build a carrier tracking URL from a carrier name and tracking number.
 *
 * @param string $carrier         Carrier name (e.g. 'UPS', 'FedEx', 'USPS').
 * @param string $tracking_number
 * @return string|null
 */
function dtb_order_build_tracking_url( string $carrier, string $tracking_number ): ?string {
	$tn = rawurlencode( $tracking_number );

	$map = [
		'ups'     => "https://www.ups.com/track?tracknum={$tn}",
		'fedex'   => "https://www.fedex.com/fedextrack/?tracknumbers={$tn}",
		'usps'    => "https://tools.usps.com/go/TrackConfirmAction?tLabels={$tn}",
		'dhl'     => "https://www.dhl.com/us-en/home/tracking/tracking-global-forwarding.html?submit=1&tracking-id={$tn}",
		'ontrac'  => "https://www.ontrac.com/trackingres.asp?tracking_number={$tn}",
	];

	$key = strtolower( $carrier );
	return $map[ $key ] ?? null;
}

// =============================================================================
// SECTION 2 — REST ROUTES REGISTRATION
// =============================================================================

add_action( 'rest_api_init', 'dtb_order_register_rest_routes' );

/**
 * Register DTB order REST endpoints.
 */
function dtb_order_register_rest_routes(): void {
	$ns = 'dtb/v1';

	// GET /orders — customer's own order list.
	register_rest_route( $ns, '/orders', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_order_rest_list_orders',
		'permission_callback' => 'dtb_order_rest_require_auth',
		'args'                => [
			'page'     => [ 'type' => 'integer', 'default' => 1, 'minimum' => 1 ],
			'per_page' => [ 'type' => 'integer', 'default' => 20, 'minimum' => 1, 'maximum' => 100 ],
		],
	] );

	// GET /orders/health — subsystem health check (no auth required for ops tooling).
	register_rest_route( $ns, '/orders/health', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_order_rest_health',
		'permission_callback' => '__return_true',
	] );

	// GET /orders/{id} — order detail.
	register_rest_route( $ns, '/orders/(?P<id>[0-9]+)', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_order_rest_get_order',
		'permission_callback' => 'dtb_order_rest_require_auth',
		'args'                => [
			'id' => [ 'type' => 'integer', 'required' => true, 'minimum' => 1 ],
		],
	] );

	// GET /orders/{id}/tracking — customer-safe tracking projection.
	register_rest_route( $ns, '/orders/(?P<id>[0-9]+)/tracking', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_order_rest_get_tracking',
		'permission_callback' => 'dtb_order_rest_check_order_access',
		'args'                => [
			'id'        => [ 'type' => 'integer', 'required' => true, 'minimum' => 1 ],
			'order_key' => [ 'type' => 'string', 'default' => '' ],
		],
	] );

	// GET /orders/{id}/events/stream — SSE live updates.
	register_rest_route( $ns, '/orders/(?P<id>[0-9]+)/events/stream', [
		'methods'             => WP_REST_Server::READABLE,
		'callback'            => 'dtb_order_rest_event_stream',
		'permission_callback' => 'dtb_order_rest_check_order_access',
		'args'                => [
			'id'        => [ 'type' => 'integer', 'required' => true, 'minimum' => 1 ],
			'order_key' => [ 'type' => 'string', 'default' => '' ],
		],
	] );
}

// =============================================================================
// SECTION 3 — PERMISSION CALLBACKS
// =============================================================================

/**
 * Require authenticated user (JWT via dtb-auth.php).
 */
function dtb_order_rest_require_auth( WP_REST_Request $request ): bool|WP_Error {
	if ( ! is_user_logged_in() ) {
		return new WP_Error( 'dtb_unauthorized', 'Authentication required.', [ 'status' => 401 ] );
	}
	return true;
}

/**
 * Allow access if the user owns the order, is an admin, or provides a valid order_key.
 */
function dtb_order_rest_check_order_access( WP_REST_Request $request ): bool|WP_Error {
	$order_id  = (int) $request->get_param( 'id' );
	$order_key = sanitize_text_field( (string) $request->get_param( 'order_key' ) );
	$user_id   = get_current_user_id();

	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return new WP_Error( 'dtb_not_found', 'Order not found.', [ 'status' => 404 ] );
	}

	// Admins can always access.
	if ( current_user_can( 'manage_woocommerce' ) ) {
		return true;
	}

	// Authenticated owner.
	if ( $user_id && (int) $order->get_customer_id() === $user_id ) {
		return true;
	}

	// Guest with order key.
	if ( $order_key && hash_equals( $order->get_order_key(), $order_key ) ) {
		return true;
	}

	return new WP_Error( 'dtb_forbidden', 'You do not have access to this order.', [ 'status' => 403 ] );
}

// =============================================================================
// SECTION 4 — REST HANDLERS
// =============================================================================

/**
 * GET /dtb/v1/orders — return the authenticated customer's order list.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_order_rest_list_orders( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$user_id  = get_current_user_id();
	$page     = (int) $request->get_param( 'page' );
	$per_page = (int) $request->get_param( 'per_page' );

	$query = new WC_Order_Query( [
		'customer_id' => $user_id,
		'limit'       => $per_page,
		'paged'       => $page,
		'orderby'     => 'date',
		'order'       => 'DESC',
		'return'      => 'objects',
	] );

	$orders  = $query->get_orders();
	$results = [];

	foreach ( $orders as $order ) {
		$results[] = dtb_order_format_summary( $order );
	}

	$total = (int) $query->get_total();

	$response = new WP_REST_Response( $results, 200 );
	$response->header( 'X-WP-Total',      (string) $total );
	$response->header( 'X-WP-TotalPages', (string) ceil( $total / $per_page ) );
	return $response;
}

/**
 * GET /dtb/v1/orders/{id} — return customer-safe order detail.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_order_rest_get_order( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$order_id = (int) $request->get_param( 'id' );
	$user_id  = get_current_user_id();
	$order    = wc_get_order( $order_id );

	if ( ! $order ) {
		return new WP_Error( 'dtb_not_found', 'Order not found.', [ 'status' => 404 ] );
	}

	// Ownership check.
	if ( ! current_user_can( 'manage_woocommerce' ) && (int) $order->get_customer_id() !== $user_id ) {
		return new WP_Error( 'dtb_forbidden', 'You do not have access to this order.', [ 'status' => 403 ] );
	}

	return new WP_REST_Response( dtb_order_format_detail( $order ), 200 );
}

/**
 * GET /dtb/v1/orders/{id}/tracking — customer-safe tracking projection.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function dtb_order_rest_get_tracking( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$order_id   = (int) $request->get_param( 'id' );
	$projection = dtb_order_get_tracking_projection( $order_id );

	if ( null === $projection ) {
		return new WP_Error( 'dtb_not_found', 'Order not found.', [ 'status' => 404 ] );
	}

	return new WP_REST_Response( $projection, 200 );
}

/**
 * GET /dtb/v1/orders/{id}/events/stream — Server-Sent Events.
 *
 * Streams customer-visible events for the order. Exits after sending the
 * current snapshot and closing — the client should reconnect on its own
 * schedule. Uses PHP output buffering to flush each event frame immediately.
 *
 * @param WP_REST_Request $request
 * @return void  Never returns normally (calls wp_die() after streaming).
 */
function dtb_order_rest_event_stream( WP_REST_Request $request ): void {
	$order_id = (int) $request->get_param( 'id' );

	// Send SSE headers.
	header( 'Content-Type: text/event-stream; charset=UTF-8' );
	header( 'Cache-Control: no-cache' );
	header( 'X-Accel-Buffering: no' );

	$projection  = dtb_order_get_tracking_projection( $order_id );
	$status_proj = $projection ? dtb_order_build_status_projection( $order_id ) : null;

	if ( $projection && $status_proj ) {
		$frame = wp_json_encode( [
			'status'      => $status_proj['status'],
			'label'       => $status_proj['label'],
			'occurred_at' => current_time( 'c', true ),
			'is_terminal' => $status_proj['is_terminal'],
			'timeline'    => $projection['timeline'],
		] );

		// phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped
		echo "event: order.status_changed\n";
		echo "data: {$frame}\n\n";
		// phpcs:enable

		if ( ob_get_level() ) {
			ob_flush();
		}
		flush();
	} else {
		// phpcs:disable WordPress.Security.EscapeOutput.OutputNotEscaped
		echo "event: error\n";
		echo "data: {\"message\":\"Order not found\"}\n\n";
		// phpcs:enable
		flush();
	}

	wp_die( '', '', [ 'response' => 200 ] );
}

/**
 * GET /dtb/v1/orders/health — subsystem health check.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response
 */
function dtb_order_rest_health( WP_REST_Request $request ): WP_REST_Response {
	global $wpdb;

	$table = $wpdb->prefix . 'dtb_order_events';

	// phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.InterpolatedNotPrepared
	$table_exists = (bool) $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" );

	$wc_ok        = class_exists( 'WooCommerce' );
	$queue_ok     = function_exists( 'as_schedule_single_action' );
	$veeqo_ok     = function_exists( 'dtb_veeqo_sync_order' ) || defined( 'DTB_VEEQO_API_KEY' ) || get_option( 'dtb_veeqo_api_key' );
	$quickbooks_ok = function_exists( 'dtb_quickbooks_sync_order' ) || get_option( 'dtb_qbo_client_id' );
	$rewards_ok   = function_exists( 'dtb_rewards_issue_for_order' );

	$health = [
		'ok'           => $wc_ok && $table_exists,
		'woocommerce'  => $wc_ok,
		'payments'     => $wc_ok && (bool) get_option( 'woocommerce_default_gateway' ),
		'queue'        => $queue_ok,
		'veeqo'        => (bool) $veeqo_ok,
		'quickbooks'   => (bool) $quickbooks_ok,
		'rewards'      => (bool) $rewards_ok,
		'events_table' => $table_exists,
	];

	return new WP_REST_Response( $health, $health['ok'] ? 200 : 503 );
}

// =============================================================================
// SECTION 5 — ORDER FORMATTING HELPERS
// =============================================================================

/**
 * Format a WC_Order as a customer-safe summary (for list view).
 *
 * @param WC_Order $order
 * @return array
 */
function dtb_order_format_summary( WC_Order $order ): array {
	$status_proj = dtb_order_build_status_projection( (int) $order->get_id() );

	return [
		'id'                 => (int) $order->get_id(),
		'status'             => $status_proj['status'],
		'status_label'       => $status_proj['label'],
		'total'              => $order->get_total(),
		'currency'           => $order->get_currency(),
		'date_created'       => $order->get_date_created() ? $order->get_date_created()->format( 'c' ) : null,
		'date_modified'      => $order->get_date_modified() ? $order->get_date_modified()->format( 'c' ) : null,
		'items_count'        => count( $order->get_items() ),
		'payment_method'     => $order->get_payment_method(),
		'payment_method_title' => $order->get_payment_method_title(),
		'fulfillment_substate' => dtb_order_get_fulfillment_substate( (int) $order->get_id() ),
	];
}

/**
 * Format a WC_Order as full customer-safe detail.
 *
 * Excludes raw payment internals, admin notes, fraud metadata.
 *
 * @param WC_Order $order
 * @return array
 */
function dtb_order_format_detail( WC_Order $order ): array {
	$order_id    = (int) $order->get_id();
	$summary     = dtb_order_format_summary( $order );
	$tracking    = dtb_order_get_tracking_projection( $order_id );

	// Line items.
	$items = [];
	foreach ( $order->get_items() as $item ) {
		/** @var WC_Order_Item_Product $item */
		$items[] = [
			'id'          => (int) $item->get_id(),
			'name'        => wp_strip_all_tags( $item->get_name() ),
			'quantity'    => (int) $item->get_quantity(),
			'total'       => $item->get_total(),
			'product_id'  => (int) $item->get_product_id(),
			'variation_id'=> (int) $item->get_variation_id(),
		];
	}

	// Billing (email truncated for security).
	$billing = [
		'first_name' => $order->get_billing_first_name(),
		'last_name'  => $order->get_billing_last_name(),
		'address_1'  => $order->get_billing_address_1(),
		'address_2'  => $order->get_billing_address_2(),
		'city'       => $order->get_billing_city(),
		'state'      => $order->get_billing_state(),
		'postcode'   => $order->get_billing_postcode(),
		'country'    => $order->get_billing_country(),
		'email'      => $order->get_billing_email(),
		'phone'      => $order->get_billing_phone(),
	];

	// Shipping.
	$shipping = [
		'first_name' => $order->get_shipping_first_name(),
		'last_name'  => $order->get_shipping_last_name(),
		'address_1'  => $order->get_shipping_address_1(),
		'address_2'  => $order->get_shipping_address_2(),
		'city'       => $order->get_shipping_city(),
		'state'      => $order->get_shipping_state(),
		'postcode'   => $order->get_shipping_postcode(),
		'country'    => $order->get_shipping_country(),
	];

	return array_merge( $summary, [
		'line_items'          => $items,
		'billing'             => $billing,
		'shipping'            => $shipping,
		'subtotal'            => $order->get_subtotal(),
		'shipping_total'      => $order->get_shipping_total(),
		'total_tax'           => $order->get_total_tax(),
		'discount_total'      => $order->get_discount_total(),
		'customer_note'       => wp_strip_all_tags( $order->get_customer_note() ),
		'tracking'            => $tracking,
		'timeline'            => $tracking['timeline'] ?? [],
	] );
}
