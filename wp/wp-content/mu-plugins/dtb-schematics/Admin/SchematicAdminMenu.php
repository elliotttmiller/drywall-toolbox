<?php
defined( 'ABSPATH' ) || exit;

/**
 * DTB Schematics Manager
 *
 * Admin UI for managing schematic diagram images, brand/model metadata,
 * product mappings, and manifest cache. Works alongside dtb-schematics-api.php
 * which serves the REST manifest endpoint the React SPA consumes.
 *
 * Data model: Schematics are WP Media Library attachments flagged with
 * _dtb_is_schematic = '1' and extended with DTB-specific meta fields.
 *
 * @package DrywallToolbox
 */

defined( 'ABSPATH' ) || exit;

// Only load this admin UI tool when inside wp-admin or AJAX requests.
if ( ! dtb_is_admin_or_ajax_request() ) {
	return;
}

// ── Shared top-level DTB admin menu ──────────────────────────────────────────

if ( ! function_exists( 'dtb_register_top_level_menu' ) ) {
	function dtb_register_top_level_menu() {
		add_menu_page(
			__( 'Drywall Toolbox', 'dtb' ),
			__( 'DTB Tools', 'dtb' ),
			'manage_options',
			'dtb-toolbox',
			'dtb_toolbox_dashboard_page',
			'dashicons-hammer',
			30
		);
	}
	add_action( 'admin_menu', 'dtb_register_top_level_menu', 5 );
}

if ( ! function_exists( 'dtb_toolbox_dashboard_page' ) ) {
	function dtb_toolbox_dashboard_page() {
		echo '<div class="wrap"><h1>' . esc_html__( 'DTB Tools', 'dtb' ) . '</h1>';
		echo '<p>' . esc_html__( 'Select a tool from the menu on the left.', 'dtb' ) . '</p></div>';
	}
}

// ── Submenu ───────────────────────────────────────────────────────────────────

add_action( 'admin_menu', function () {
	add_submenu_page(
		'dtb-toolbox',
		__( 'Schematics Manager', 'dtb' ),
		__( 'Schematics', 'dtb' ),
		'manage_options',
		'dtb-schematics',
		'dtb_schematics_render_page'
	);
} );

// ── Enqueue WP media uploader on our page ────────────────────────────────────

add_action( 'admin_enqueue_scripts', function ( $hook ) {
	if ( strpos( $hook, 'dtb-schematics' ) === false ) {
		return;
	}
	wp_enqueue_media();
} );

// ── Constants ─────────────────────────────────────────────────────────────────

define( 'DTB_BRANDS', [ 'Asgard', 'Columbia Taping Tools', 'Platinum Drywall Tools', 'SurPro', 'TapeTech' ] );
define( 'DTB_MANIFEST_TRANSIENT', 'dtb_schematics_manifest' );

// ── Helpers ───────────────────────────────────────────────────────────────────


