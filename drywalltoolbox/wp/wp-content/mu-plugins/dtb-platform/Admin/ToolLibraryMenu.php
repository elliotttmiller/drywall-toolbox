<?php
/**
 * DTB Admin — ToolLibraryMenu
 *
 * Registers all DTB Tool Library pages.
 * Pages are registered via dtb_register_admin_page() — the AdminMenuRegistry
 * consumes this at admin_menu time.
 *
 * Library: 'tools'
 * Menus:
 *   DTB Tool Library
 *     ├─ Schematics              (position 10)
 *     ├─ Image Sync              (position 20)
 *     ├─ Product Mapping         (position 30)
 *     ├─ Catalog Health          (position 40)
 *     ├─ Parts Manager           (position 45)
 *     ├─ Inventory Intelligence  (position 47)
 *     ├─ Cache Tools             (position 50)
 *     ├─ API Health              (position 55)
 *     ├─ SEO Tools               (position 60)
 *     ├─ Import / Export         (position 65)
 *     └─ Config Reference        (position 70)
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'init', 'dtb_tool_library_menu_register_pages', 10 );

function dtb_tool_library_menu_register_pages(): void {

	// Schematics.
	dtb_register_admin_page( [
		'library'    => 'tools',
		'slug'       => 'dtb-schematics',
		'title'      => __( 'Schematics', 'drywall-toolbox' ),
		'menu_title' => __( 'Schematics', 'drywall-toolbox' ),
		'capability' => 'dtb_manage_schematics',
		'callback'   => 'dtb_schematics_render_page',
		'position'   => 10,
		'template'   => 'tool',
		'section'    => 'Catalog Maintenance',
	] );

	// Image Sync.
	dtb_register_admin_page( [
		'library'    => 'tools',
		'slug'       => 'dtb-image-sync',
		'title'      => __( 'Image Sync', 'drywall-toolbox' ),
		'menu_title' => __( 'Image Sync', 'drywall-toolbox' ),
		'capability' => 'dtb_manage_image_sync',
		'callback'   => 'dtb_image_sync_render_page',
		'position'   => 20,
		'template'   => 'tool',
		'section'    => 'Catalog Maintenance',
	] );

	// Product Mapping.
	dtb_register_admin_page( [
		'library'    => 'tools',
		'slug'       => 'dtb-product-mapping',
		'title'      => __( 'Product Mapping', 'drywall-toolbox' ),
		'menu_title' => __( 'Product Mapping', 'drywall-toolbox' ),
		'capability' => 'dtb_manage_product_mapping',
		'callback'   => 'dtb_product_mapping_render_page',
		'position'   => 30,
		'template'   => 'tool',
		'section'    => 'Catalog Maintenance',
	] );

	// Catalog Health.
	dtb_register_admin_page( [
		'library'    => 'tools',
		'slug'       => 'dtb-catalog-health',
		'title'      => __( 'Catalog Health', 'drywall-toolbox' ),
		'menu_title' => __( 'Catalog Health', 'drywall-toolbox' ),
		'capability' => 'dtb_manage_catalog_health',
		'callback'   => 'dtb_catalog_health_render_page',
		'position'   => 40,
		'template'   => 'tool',
		'section'    => 'Catalog Maintenance',
	] );

	// Parts Manager.
	dtb_register_admin_page( [
		'library'    => 'tools',
		'slug'       => 'dtb-parts-manager',
		'title'      => __( 'Parts Manager', 'drywall-toolbox' ),
		'menu_title' => __( 'Parts Manager', 'drywall-toolbox' ),
		'capability' => 'dtb_manage_parts',
		'callback'   => 'dtb_parts_manager_render_page',
		'position'   => 45,
		'template'   => 'tool',
		'section'    => 'Catalog Maintenance',
	] );

	// Inventory Intelligence.
	dtb_register_admin_page( [
		'library'    => 'tools',
		'slug'       => 'dtb-inventory-intelligence',
		'title'      => __( 'Inventory Intelligence', 'drywall-toolbox' ),
		'menu_title' => __( 'Inventory Intelligence', 'drywall-toolbox' ),
		'capability' => 'dtb_manage_inventory_intelligence',
		'callback'   => 'dtb_inventory_intelligence_render_page',
		'position'   => 47,
		'template'   => 'tool',
		'section'    => 'Catalog Maintenance',
	] );

	// Cache Tools.
	dtb_register_admin_page( [
		'library'    => 'tools',
		'slug'       => 'dtb-cache-tools',
		'title'      => __( 'Cache Tools', 'drywall-toolbox' ),
		'menu_title' => __( 'Cache Tools', 'drywall-toolbox' ),
		'capability' => 'dtb_manage_cache_tools',
		'callback'   => 'dtb_cache_tools_render_page',
		'position'   => 50,
		'template'   => 'tool',
		'section'    => 'Platform',
	] );

	// API Health.
	dtb_register_admin_page( [
		'library'    => 'tools',
		'slug'       => 'dtb-api-health',
		'title'      => __( 'API Health', 'drywall-toolbox' ),
		'menu_title' => __( 'API Health', 'drywall-toolbox' ),
		'capability' => 'dtb_view_api_health',
		'callback'   => 'dtb_api_health_render_page',
		'position'   => 55,
		'template'   => 'tool',
		'section'    => 'Platform',
	] );

	// SEO Tools.
	dtb_register_admin_page( [
		'library'    => 'tools',
		'slug'       => 'dtb-seo-tools',
		'title'      => __( 'SEO Tools', 'drywall-toolbox' ),
		'menu_title' => __( 'SEO Tools', 'drywall-toolbox' ),
		'capability' => 'dtb_manage_seo_tools',
		'callback'   => 'dtb_seo_tools_render_page',
		'position'   => 60,
		'template'   => 'tool',
		'section'    => 'Catalog Maintenance',
	] );

	// Import / Export.
	dtb_register_admin_page( [
		'library'    => 'tools',
		'slug'       => 'dtb-import-export',
		'title'      => __( 'Import / Export', 'drywall-toolbox' ),
		'menu_title' => __( 'Import / Export', 'drywall-toolbox' ),
		'capability' => 'dtb_manage_import_export',
		'callback'   => 'dtb_import_export_render_page',
		'position'   => 65,
		'template'   => 'tool',
		'section'    => 'Data',
	] );

	// Config Reference.
	dtb_register_admin_page( [
		'library'    => 'tools',
		'slug'       => 'dtb-config-reference',
		'title'      => __( 'Config Reference', 'drywall-toolbox' ),
		'menu_title' => __( 'Config Reference', 'drywall-toolbox' ),
		'capability' => 'dtb_view_config_reference',
		'callback'   => 'dtb_config_reference_render_page',
		'position'   => 70,
		'template'   => 'tool',
		'section'    => 'Data',
	] );
}
