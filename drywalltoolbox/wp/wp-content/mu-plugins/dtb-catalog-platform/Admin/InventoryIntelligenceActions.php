<?php
/**
 * Inventory Intelligence admin AJAX actions.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

if ( ! dtb_is_admin_or_ajax_request() ) {
	return;
}

add_action( 'wp_ajax_dtb_inventory_health', 'dtb_ajax_inventory_health' );
add_action( 'wp_ajax_dtb_inventory_sync_stock', 'dtb_ajax_inventory_sync_stock' );
add_action( 'wp_ajax_dtb_inventory_recompute_rollups', 'dtb_ajax_inventory_recompute_rollups' );
add_action( 'wp_ajax_dtb_inventory_list_rollups', 'dtb_ajax_inventory_list_rollups' );
add_action( 'wp_ajax_dtb_inventory_true_stockouts', 'dtb_ajax_inventory_true_stockouts' );
add_action( 'wp_ajax_dtb_inventory_substitute_preview', 'dtb_ajax_inventory_substitute_preview' );

/**
 * Validate Inventory Intelligence admin AJAX requests.
 */
function dtb_inventory_validate_ajax_request(): void {
	check_ajax_referer( 'dtb_inventory_intelligence_nonce', 'nonce' );
	if ( ! current_user_can( 'dtb_manage_inventory_intelligence' ) ) {
		wp_send_json_error( [ 'message' => 'Unauthorized.' ], 403 );
	}
}

/**
 * AJAX: inventory health summary.
 */
function dtb_ajax_inventory_health(): void {
	dtb_inventory_validate_ajax_request();
	$service = new DTB_InventoryIntelligenceService();
	wp_send_json_success( $service->health() );
}

/**
 * AJAX: sync local stock cache from WooCommerce projection.
 */
function dtb_ajax_inventory_sync_stock(): void {
	dtb_inventory_validate_ajax_request();
	$sync_service = new DTB_VeeqoStockSyncService();
	$result       = $sync_service->sync_from_woocommerce( true );
	wp_send_json_success(
		array_merge(
			$result,
			[ 'message' => sprintf( 'Stock cache synced from WooCommerce projection. %d SKUs updated.', (int) ( $result['updated'] ?? 0 ) ) ]
		)
	);
}

/**
 * AJAX: recompute universal stock rollups.
 */
function dtb_ajax_inventory_recompute_rollups(): void {
	dtb_inventory_validate_ajax_request();
	$rollup_service = new DTB_InventoryRollupService();
	$result         = $rollup_service->recompute_all();
	wp_send_json_success(
		array_merge(
			$result,
			[ 'message' => sprintf( 'Inventory rollups recomputed. %d universal groups updated.', (int) ( $result['updated'] ?? 0 ) ) ]
		)
	);
}

/**
 * AJAX: paginated universal stock rollups.
 */
function dtb_ajax_inventory_list_rollups(): void {
	dtb_inventory_validate_ajax_request();
	$page   = max( 1, absint( $_POST['page'] ?? 1 ) );
	$signal = sanitize_key( $_POST['signal'] ?? '' );
	$search = sanitize_text_field( $_POST['search'] ?? '' );

	if ( ! in_array( $signal, [ '', 'none', 'watch', 'reorder', 'critical' ], true ) ) {
		$signal = '';
	}

	$service = new DTB_InventoryIntelligenceService();
	wp_send_json_success( $service->list_universal_stock( $page, $signal, $search ) );
}

/**
 * AJAX: true universal stockouts.
 */
function dtb_ajax_inventory_true_stockouts(): void {
	dtb_inventory_validate_ajax_request();
	$service = new DTB_InventoryIntelligenceService();
	wp_send_json_success( [ 'items' => $service->true_stockouts() ] );
}

/**
 * AJAX: SKU substitution preview.
 */
function dtb_ajax_inventory_substitute_preview(): void {
	dtb_inventory_validate_ajax_request();
	$sku = sanitize_text_field( $_POST['sku'] ?? '' );
	if ( '' === trim( $sku ) ) {
		wp_send_json_error( [ 'message' => 'SKU is required.' ], 400 );
	}

	$service = new DTB_InventoryIntelligenceService();
	wp_send_json_success( $service->substitute_preview( $sku ) );
}
