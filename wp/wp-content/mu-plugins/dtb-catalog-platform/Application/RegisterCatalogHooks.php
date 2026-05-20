<?php
/**
 * Catalog hook wiring.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', static function (): void {
	DTB_ToolsetData::maybe_seed();
}, 5 );

add_action( 'dtb_product_cache_invalidated', static function (): void {
	DTB_CatalogFacetService::invalidate();
} );

/**
 * Invalidate all catalog caches affected by product changes.
 *
 * @param int|WC_Product|object $subject Post ID, WC product object, or source object.
 */
function dtb_catalog_invalidate_all_caches( object|int $subject = 0 ): void {
	DTB_CatalogFacetService::invalidate();
	DTB_ToolsetEligibilityService::invalidate_slot_options_cache();
	do_action( 'dtb_catalog_caches_invalidated', $subject );
}

add_action( 'save_post_product', 'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'save_post_product_variation', 'dtb_catalog_invalidate_all_caches', 20 );

add_action( 'deleted_post', static function ( int $post_id ): void {
	$post_type = get_post_type( $post_id );
	if ( 'product' === $post_type || 'product_variation' === $post_type ) {
		dtb_catalog_invalidate_all_caches( $post_id );
	}
}, 20 );

add_action( 'woocommerce_new_product', 'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_update_product', 'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_delete_product', 'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_new_product_variation', 'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_update_product_variation', 'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_delete_product_variation', 'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_product_import_inserted_product_object', 'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_product_import_updated_product_object', 'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_trash_product', 'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_untrash_product', 'dtb_catalog_invalidate_all_caches', 20 );
