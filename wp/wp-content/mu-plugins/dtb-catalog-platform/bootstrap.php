<?php
/**
 * DTB Catalog Platform — Bootstrap
 *
 * Loads the catalog-platform class files and wires them into WordPress.
 *
 * - Registers all DTB product meta fields for WP admin and WC REST API.
 * - Exposes DTB meta in WC REST product/variation responses as `dtb_meta`.
 * - Seeds toolset templates on first activation (idempotent).
 * - Hooks REST route registration for all catalog and toolset endpoints.
 * - Invalidates the facets cache whenever the product cache is flushed.
 *
 * Depends on (loaded before this file via 00-dtb-loader.php):
 *   dtb-utils.php    — dtb_error_envelope(), dtb_check_origin()
 *   dtb-auth.php     — dtb_jwt_permission()
 *   dtb-cache.php    — dtb_cached_proxy(), dtb_invalidate_product_cache()
 *   dtb-rest-api.php — dtb_cached_wc_get(), dtb_wc_url(), dtb_rate_limit_get(),
 *                      DTB_PRODUCT_DETAIL_FIELDS
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// Respect the DTB_CATALOG_PLATFORM_ENABLED constant for staged rollouts.
// Default: true (enabled unless explicitly disabled via wp-config.php).
if ( defined( 'DTB_CATALOG_PLATFORM_ENABLED' ) && ! DTB_CATALOG_PLATFORM_ENABLED ) {
	return;
}

// Only run on admin/REST requests or WP-CLI context.
if (
	! dtb_is_admin_or_rest_request()
	&& ! ( defined( 'WP_CLI' ) && WP_CLI )
) {
	return;
}

$_dtb_cp = __DIR__;

// ── Domain ────────────────────────────────────────────────────────────────────
require_once $_dtb_cp . '/Domain/ProductMeta.php';
require_once $_dtb_cp . '/Domain/ToolFamilies.php';
require_once $_dtb_cp . '/Domain/ToolsetData.php';

// ── Services ──────────────────────────────────────────────────────────────────
require_once $_dtb_cp . '/Services/BrandNormalizer.php';
require_once $_dtb_cp . '/Services/CategoryNormalizer.php';
require_once $_dtb_cp . '/Services/ToolFamilyResolver.php';
require_once $_dtb_cp . '/Services/CatalogProductNormalizer.php';
require_once $_dtb_cp . '/Infrastructure/CatalogProductRepository.php';
require_once $_dtb_cp . '/Services/VariationReadModelService.php';
require_once $_dtb_cp . '/Services/DefaultVariationResolver.php';
require_once $_dtb_cp . '/Services/CatalogFacetService.php';
require_once $_dtb_cp . '/Services/ToolsetEligibilityService.php';
require_once $_dtb_cp . '/Services/ToolsetValidationService.php';

// ── REST Controllers ──────────────────────────────────────────────────────────
require_once $_dtb_cp . '/Rest/CatalogFacetsController.php';
require_once $_dtb_cp . '/Rest/CatalogProductsController.php';
require_once $_dtb_cp . '/Rest/ProductDetailController.php';
require_once $_dtb_cp . '/Rest/CompatiblePartsController.php';
require_once $_dtb_cp . '/Rest/ToolsetTemplatesController.php';
require_once $_dtb_cp . '/Rest/ToolsetOptionsController.php';
require_once $_dtb_cp . '/Rest/ToolsetValidationController.php';

// ── Validation ────────────────────────────────────────────────────────────────
require_once $_dtb_cp . '/Validation/CatalogValidationService.php';
require_once $_dtb_cp . '/Validation/ProductMetaValidator.php';
require_once $_dtb_cp . '/Validation/VariationValidator.php';
require_once $_dtb_cp . '/Validation/ToolsetEligibilityValidator.php';
require_once $_dtb_cp . '/Validation/PricingValidator.php';
require_once $_dtb_cp . '/Validation/ImageValidator.php';
require_once $_dtb_cp . '/Validation/SeoValidator.php';

// ── Admin / CLI tools ─────────────────────────────────────────────────────────
if ( is_admin() || ( defined( 'WP_CLI' ) && WP_CLI ) ) {
	require_once $_dtb_cp . '/Admin/MetaBackfillTool.php';
}

// Transitional legacy bridge for existing catalog health diagnostics.
dtb_module_require( 'dtb-catalog-platform/Admin/CatalogHealthPage.php' );

unset( $_dtb_cp );

// ── Seed toolset templates (idempotent) ───────────────────────────────────────
add_action( 'init', static function (): void {
	DTB_ToolsetData::maybe_seed();
}, 5 );

// ── Register DTB product meta fields ─────────────────────────────────────────
add_action( 'init', 'dtb_catalog_register_meta', 20 );

/**
 * Register all canonical DTB product meta fields with WordPress.
 *
 * Fields are declared for the 'product' post type and exposed via the
 * WP REST API with proper type schemas.  The auth_callback restricts
 * writes to users with the edit_products capability.
 */
function dtb_catalog_register_meta(): void {
	foreach ( DTB_ProductMeta::FIELDS as $meta_key => $definition ) {
		$type   = $definition['type'];
		$single = 'array' !== $type;

		$rest_schema = match ( $type ) {
			'boolean' => [ 'type' => 'boolean' ],
			'integer' => [ 'type' => 'integer' ],
			'array'   => [ 'type' => 'array', 'items' => [ 'type' => 'string' ] ],
			default   => [ 'type' => 'string' ],
		};

		register_post_meta( 'product', $meta_key, [
			'single'        => $single,
			'type'          => $single ? $type : 'string',
			'description'   => $definition['description'],
			'show_in_rest'  => [ 'schema' => $rest_schema ],
			'auth_callback' => static fn() => current_user_can( 'edit_products' ),
		] );
	}
}

// ── Inject DTB meta into WC REST product/variation responses ──────────────────
add_filter( 'woocommerce_rest_prepare_product_object',           'dtb_catalog_inject_meta_rest', 10, 2 );
add_filter( 'woocommerce_rest_prepare_product_variation_object', 'dtb_catalog_inject_meta_rest', 10, 2 );

/**
 * Append a dtb_meta object to WC REST product and variation responses.
 * All DTB meta keys are included; empty/missing values are returned as null.
 *
 * @param WP_REST_Response    $response
 * @param WC_Product|WC_Data  $product
 * @return WP_REST_Response
 */
function dtb_catalog_inject_meta_rest( WP_REST_Response $response, object $product ): WP_REST_Response {
	$id = method_exists( $product, 'get_id' ) ? $product->get_id() : 0;
	if ( ! $id ) {
		return $response;
	}

	$data = $response->get_data();
	if ( ! isset( $data['dtb_meta'] ) ) {
		$data['dtb_meta'] = [];
	}

	foreach ( array_keys( DTB_ProductMeta::FIELDS ) as $key ) {
		$raw = get_post_meta( $id, $key, true );
		// Expose without leading underscore to avoid JSON key confusion.
		$data['dtb_meta'][ ltrim( $key, '_' ) ] = ( '' === $raw ) ? null : $raw;
	}

	$response->set_data( $data );
	return $response;
}

// ── Register REST routes ───────────────────────────────────────────────────────
add_action( 'rest_api_init', 'dtb_catalog_platform_register_routes', 15 );

function dtb_catalog_platform_register_routes(): void {
	DTB_CatalogFacetsController::register_routes();
	DTB_CatalogProductsController::register_routes();
	DTB_ProductDetailController::register_routes();
	DTB_CompatiblePartsController::register_routes();
	DTB_ToolsetTemplatesController::register_routes();
	DTB_ToolsetOptionsController::register_routes();
	DTB_ToolsetValidationController::register_routes();
}

// ── Invalidate facets cache alongside product cache ───────────────────────────
add_action( 'dtb_product_cache_invalidated', static function (): void {
	DTB_CatalogFacetService::invalidate();
} );

// ── Catalog cache invalidation on WooCommerce product events ─────────────────
// These hooks fire on every product save, delete, or import event that could
// change the facets or toolset options results.  All run at priority 20 to let
// WooCommerce finish its own saves first.

/**
 * Helper: invalidate facets + toolset slot option caches.
 * Accepts a post ID, WC product ID, or WC_Product object.
 *
 * @param  int|WC_Product|object $subject
 */
function dtb_catalog_invalidate_all_caches( object|int $subject = 0 ): void {
	DTB_CatalogFacetService::invalidate();
	DTB_ToolsetEligibilityService::invalidate_slot_options_cache();
	do_action( 'dtb_catalog_caches_invalidated', $subject );
}

// save_post — fires on every product publish/update (includes variation saves).
add_action( 'save_post_product', 'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'save_post_product_variation', 'dtb_catalog_invalidate_all_caches', 20 );

// deleted_post — fires when any product post is permanently deleted.
add_action( 'deleted_post', static function ( int $post_id ): void {
	$post_type = get_post_type( $post_id );
	if ( 'product' === $post_type || 'product_variation' === $post_type ) {
		dtb_catalog_invalidate_all_caches( $post_id );
	}
}, 20 );

// WooCommerce-specific product hooks (cover programmatic creates/updates that
// may not trigger save_post in all contexts).
add_action( 'woocommerce_new_product',              'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_update_product',           'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_delete_product',           'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_new_product_variation',    'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_update_product_variation', 'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_delete_product_variation', 'dtb_catalog_invalidate_all_caches', 20 );

// Product CSV import hooks.
add_action( 'woocommerce_product_import_inserted_product_object', 'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_product_import_updated_product_object',  'dtb_catalog_invalidate_all_caches', 20 );

// Product trash/untrash.
add_action( 'woocommerce_trash_product',   'dtb_catalog_invalidate_all_caches', 20 );
add_action( 'woocommerce_untrash_product', 'dtb_catalog_invalidate_all_caches', 20 );
