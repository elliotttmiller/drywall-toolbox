<?php
/**
 * Headless Base Theme — functions.php
 *
 * Minimal WordPress theme for the Drywall Toolbox headless architecture.
 * This theme produces zero frontend output — the React SPA at the domain root
 * owns all rendering.  WordPress and WooCommerce serve as the REST API backend.
 *
 * @package headless-base
 */

defined( 'ABSPATH' ) || exit;

// ─── Theme Setup ─────────────────────────────────────────────────────────────

add_action( 'after_setup_theme', 'hb_theme_setup' );
function hb_theme_setup() {
	load_theme_textdomain( 'headless-base', get_template_directory() . '/languages' );
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'woocommerce' );

	// Register navigation menus so React can fetch them via REST API.
	register_nav_menus(
		[
			'primary'   => __( 'Primary Navigation', 'headless-base' ),
			'footer'    => __( 'Footer Navigation', 'headless-base' ),
			'secondary' => __( 'Secondary Navigation', 'headless-base' ),
		]
	);
}

// ─── Disable All Frontend Output ─────────────────────────────────────────────
// This theme never renders PHP templates — React owns the frontend.
// Redirect any direct template request to the React SPA (served by .htaccess).

add_filter( 'template_include', 'hb_block_frontend_templates', 99 );
function hb_block_frontend_templates( $template ) {
	if ( is_admin() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
		return $template;
	}
	// Return the minimal index.php so WordPress doesn't crash.
	return get_template_directory() . '/index.php';
}

// ─── Remove Unnecessary WordPress Head Output ─────────────────────────────────

add_action( 'init', 'hb_clean_head' );
function hb_clean_head() {
	remove_action( 'wp_head', 'wp_generator' );
	remove_action( 'wp_head', 'rsd_link' );
	remove_action( 'wp_head', 'wlwmanifest_link' );
	remove_action( 'wp_head', 'wp_shortlink_wp_head', 10 );
	remove_action( 'wp_head', 'adjacent_posts_rel_link_wp_head', 10 );
	remove_action( 'wp_head', 'feed_links', 2 );
	remove_action( 'wp_head', 'feed_links_extra', 3 );
	remove_action( 'wp_head', 'wp_resource_hints', 2 );
	remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
	remove_action( 'wp_print_styles', 'print_emoji_styles' );
	add_filter( 'emoji_svg_url', '__return_false' );
	remove_action( 'wp_head', 'wp_oembed_add_discovery_links' );
	remove_action( 'wp_head', 'wp_oembed_add_host_js' );
}

// ─── Miscellaneous Security ───────────────────────────────────────────────────

add_filter( 'the_generator', '__return_empty_string' );
add_filter( 'xmlrpc_enabled', '__return_false' );
add_filter( 'xmlrpc_methods', function() { return []; } );
add_filter( 'show_admin_bar', '__return_false' );

// Prevent author enumeration
add_action( 'template_redirect', 'hb_block_author_enumeration' );
function hb_block_author_enumeration() {
	if ( is_author() ) {
		wp_redirect( home_url( '/' ), 301 );
		exit;
	}
}

// ─── REST API: Navigation Menu Endpoint ──────────────────────────────────────
// Expose registered menus via /wp-json/headless/v1/menus/<location>
// so the React SPA can render dynamic navigation.

add_action( 'rest_api_init', 'hb_register_menu_endpoint' );
function hb_register_menu_endpoint() {
	register_rest_route(
		'headless/v1',
		'/menus/(?P<location>[a-zA-Z0-9_-]+)',
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'hb_get_menu_by_location',
			'permission_callback' => '__return_true',
			'args'                => [
				'location' => [
					'required'          => true,
					'validate_callback' => function( $param ) {
						return is_string( $param ) && strlen( $param ) > 0;
					},
				],
			],
		]
	);
}

/**
 * Return menu items for a registered menu location.
 *
 * @param WP_REST_Request $request
 * @return WP_REST_Response|WP_Error
 */
function hb_get_menu_by_location( WP_REST_Request $request ) {
	$location = sanitize_key( $request->get_param( 'location' ) );
	$locations = get_nav_menu_locations();

	if ( ! isset( $locations[ $location ] ) ) {
		return new WP_Error(
			'menu_not_found',
			sprintf( 'No menu assigned to location "%s".', $location ),
			[ 'status' => 404 ]
		);
	}

	$menu  = wp_get_nav_menu_object( $locations[ $location ] );
	$items = wp_get_nav_menu_items( $menu->term_id );

	if ( ! $items ) {
		return rest_ensure_response( [] );
	}

	$output = array_map(
		function ( $item ) {
			return [
				'id'         => (int) $item->ID,
				'title'      => $item->title,
				'url'        => $item->url,
				'target'     => $item->target,
				'parent'     => (int) $item->menu_item_parent,
				'order'      => (int) $item->menu_order,
				'object'     => $item->object,
				'object_id'  => (int) $item->object_id,
				'type'       => $item->type,
			];
		},
		$items
	);

	return rest_ensure_response( $output );
}

// ─── WooCommerce: Public Read for Products ────────────────────────────────────
// Allow unauthenticated GET requests to product/category/tag endpoints.

add_filter( 'woocommerce_rest_check_permissions', 'hb_wc_rest_public_read', 10, 4 );
function hb_wc_rest_public_read( $permission, $context, $object_id, $post_type ) {
	$public_types = [ 'product', 'product_cat', 'product_tag', 'product_attribute' ];
	if ( 'read' === $context && in_array( $post_type, $public_types, true ) ) {
		return true;
	}
	return $permission;
}
