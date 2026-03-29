<?php
/**
 * Plugin Name:  DTB Custom Functionality
 * Plugin URI:   https://drywalltoolbox.com
 * Description:  Site-specific functionality for Drywall Toolbox — custom post types,
 *               shortcodes, and lightweight helpers. Kept separate from the theme
 *               so functionality survives a theme change.
 * Version:      1.0.0
 * Author:       Drywall Toolbox
 * Author URI:   https://drywalltoolbox.com
 * License:      GPL-2.0-or-later
 * License URI:  https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:  dtb-custom-functionality
 * Domain Path:  /languages
 */

defined( 'ABSPATH' ) || exit;

// ---------------------------------------------------------------------------
// CONSTANTS
// ---------------------------------------------------------------------------

define( 'DTB_VERSION',     '1.0.0' );
define( 'DTB_PLUGIN_DIR',  plugin_dir_path( __FILE__ ) );
define( 'DTB_PLUGIN_URL',  plugin_dir_url( __FILE__ ) );

// ---------------------------------------------------------------------------
// 1. CUSTOM POST TYPE — PRODUCT (drywall tool listing)
// ---------------------------------------------------------------------------

/**
 * Register a "Tool" custom post type for drywall product listings.
 */
function dtb_register_post_types() {
    $labels = array(
        'name'               => __( 'Tools',             'dtb-custom-functionality' ),
        'singular_name'      => __( 'Tool',              'dtb-custom-functionality' ),
        'add_new'            => __( 'Add New Tool',      'dtb-custom-functionality' ),
        'add_new_item'       => __( 'Add New Tool',      'dtb-custom-functionality' ),
        'edit_item'          => __( 'Edit Tool',         'dtb-custom-functionality' ),
        'new_item'           => __( 'New Tool',          'dtb-custom-functionality' ),
        'view_item'          => __( 'View Tool',         'dtb-custom-functionality' ),
        'search_items'       => __( 'Search Tools',      'dtb-custom-functionality' ),
        'not_found'          => __( 'No tools found.',   'dtb-custom-functionality' ),
        'not_found_in_trash' => __( 'No tools in trash.','dtb-custom-functionality' ),
        'menu_name'          => __( 'Tools Catalog',     'dtb-custom-functionality' ),
    );

    register_post_type( 'dtb_tool', array(
        'labels'             => $labels,
        'public'             => true,
        'has_archive'        => true,
        'rewrite'            => array( 'slug' => 'tools' ),
        'supports'           => array( 'title', 'editor', 'thumbnail', 'excerpt', 'custom-fields' ),
        'show_in_rest'       => true,   // Enable Gutenberg editor
        'menu_icon'          => 'dashicons-hammer',
        'menu_position'      => 5,
    ) );
}
add_action( 'init', 'dtb_register_post_types' );

// ---------------------------------------------------------------------------
// 2. CUSTOM TAXONOMY — BRAND
// ---------------------------------------------------------------------------

/**
 * Register a "Brand" taxonomy for filtering tools by manufacturer.
 */
function dtb_register_taxonomies() {
    $labels = array(
        'name'          => __( 'Brands',       'dtb-custom-functionality' ),
        'singular_name' => __( 'Brand',        'dtb-custom-functionality' ),
        'search_items'  => __( 'Search Brands','dtb-custom-functionality' ),
        'all_items'     => __( 'All Brands',   'dtb-custom-functionality' ),
        'edit_item'     => __( 'Edit Brand',   'dtb-custom-functionality' ),
        'add_new_item'  => __( 'Add New Brand','dtb-custom-functionality' ),
        'menu_name'     => __( 'Brands',       'dtb-custom-functionality' ),
    );

    register_taxonomy( 'dtb_brand', array( 'dtb_tool' ), array(
        'labels'       => $labels,
        'hierarchical' => true,
        'rewrite'      => array( 'slug' => 'brand' ),
        'show_in_rest' => true,
    ) );
}
add_action( 'init', 'dtb_register_taxonomies' );

// ---------------------------------------------------------------------------
// 3. SHORTCODE — [dtb_tool_list]
// ---------------------------------------------------------------------------

/**
 * Shortcode: [dtb_tool_list brand="tapetech" limit="6"]
 * Outputs a simple <ul> list of tools. Keep it lightweight — no JS dependency.
 *
 * @param array $atts Shortcode attributes.
 * @return string     HTML output.
 */
function dtb_tool_list_shortcode( $atts ) {
    $atts = shortcode_atts( array(
        'brand' => '',
        'limit' => 6,
    ), $atts, 'dtb_tool_list' );

    $args = array(
        'post_type'      => 'dtb_tool',
        'posts_per_page' => intval( $atts['limit'] ),
        'post_status'    => 'publish',
        'orderby'        => 'title',
        'order'          => 'ASC',
    );

    if ( ! empty( $atts['brand'] ) ) {
        $args['tax_query'] = array( // phpcs:ignore WordPress.DB.SlowDBQuery
            array(
                'taxonomy' => 'dtb_brand',
                'field'    => 'slug',
                'terms'    => sanitize_title( $atts['brand'] ),
            ),
        );
    }

    $query = new WP_Query( $args );

    if ( ! $query->have_posts() ) {
        return '<p class="dtb-no-tools">' . esc_html__( 'No tools found.', 'dtb-custom-functionality' ) . '</p>';
    }

    $output  = '<ul class="dtb-tool-list">';
    while ( $query->have_posts() ) {
        $query->the_post();
        $output .= '<li class="dtb-tool-item">';
        $output .= '<a href="' . esc_url( get_permalink() ) . '">' . esc_html( get_the_title() ) . '</a>';
        $output .= '</li>';
    }
    $output .= '</ul>';

    wp_reset_postdata();

    return $output;
}
add_shortcode( 'dtb_tool_list', 'dtb_tool_list_shortcode' );

// ---------------------------------------------------------------------------
// 4. ADMIN NOTICE — Permalink reminder on activation
// ---------------------------------------------------------------------------

/**
 * On plugin activation, schedule a flush_rewrite_rules call.
 */
function dtb_activate() {
    dtb_register_post_types();
    dtb_register_taxonomies();
    flush_rewrite_rules();
}
register_activation_hook( __FILE__, 'dtb_activate' );

/**
 * On deactivation, flush rewrites so the 'tools' slug is released.
 */
function dtb_deactivate() {
    flush_rewrite_rules();
}
register_deactivation_hook( __FILE__, 'dtb_deactivate' );
