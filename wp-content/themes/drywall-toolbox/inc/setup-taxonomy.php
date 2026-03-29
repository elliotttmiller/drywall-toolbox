<?php
/**
 * WooCommerce Taxonomy & Global Attribute Setup
 *
 * Bulk-creates product categories (hierarchical) and global product attributes
 * for the Drywall Toolbox store.
 *
 * HOW TO USE
 * ----------
 * Option A – One-time admin hook (runs once, then self-deactivates):
 *   Visit  /wp-admin/?drywall_setup_taxonomy=1  while logged in as admin.
 *   The hook fires, creates all terms and attributes, then sets a flag so it
 *   does not run again.  Remove the URL parameter after the first run.
 *
 * Option B – WP-CLI (recommended for production):
 *   wp eval-file wp-content/themes/drywall-toolbox/inc/setup-taxonomy.php
 *
 * Option C – Functions.php (development only):
 *   add_action( 'init', 'dtb_setup_taxonomy' );
 *   (Remove the action after the first run.)
 *
 * @package Drywall_Toolbox
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ---------------------------------------------------------------------------
// 1. PRODUCT CATEGORY TAXONOMY STRUCTURE
// ---------------------------------------------------------------------------

/**
 * Hierarchical category tree.
 * Format: 'Parent Term' => [ 'child1', 'child2', ... ]
 * A term listed with an empty array is created as a top-level parent only.
 */
$dtb_category_tree = [
    'Drywall Tools' => [
        'Automatic Tapers',
        'Flat Boxes',
        'Corner Tools',
        'Handles',
        'Smoothing Blades',
        'Pumps & Fillers',
        'Nail Spotters',
        'Mud Pans',
        'Sanders',
        'Putty Knives',
        'Tool Sets',
    ],
    'Accessories'   => [
        'Replacement Parts',
        'Cases & Storage',
    ],
    'Other Brands'  => [
        'TapeTech',
        'Graco',
        'SurPro',
        'Ames',
        'Asgard',
    ],
];

// ---------------------------------------------------------------------------
// 2. GLOBAL PRODUCT ATTRIBUTES
// ---------------------------------------------------------------------------

/**
 * Global attribute definitions.
 *
 * Each entry:
 *   'attribute_label' => [
 *       'slug'        => pa_* slug (max 28 chars, lowercase, hyphens only),
 *       'orderby'     => 'menu_order' | 'name' | 'name_num' | 'id',
 *       'has_archives'=> bool,
 *       'terms'       => [ 'Value 1', 'Value 2', ... ],
 *   ]
 */
$dtb_attributes = [
    'Material' => [
        'slug'         => 'material',
        'orderby'      => 'menu_order',
        'has_archives' => false,
        'terms'        => [
            'Billet Aluminum',
            'Carbon Fiber',
            'Stainless Steel',
            'Aluminum',
            'Fiberglass',
            'Polypropylene',
            'Steel',
        ],
    ],
    'Size/Width' => [
        'slug'         => 'size-width',
        'orderby'      => 'name_num',
        'has_archives' => false,
        'terms'        => [
            '1.5"', '2"', '3"', '6"', '7"', '8"',
            '10"', '11"', '12"', '14"', '16"', '18"',
            '24"', '32"', '40"', '48"',
        ],
    ],
    'Weight Class' => [
        'slug'         => 'weight-class',
        'orderby'      => 'menu_order',
        'has_archives' => false,
        'terms'        => [
            'Lightweight',
            'Standard',
            'Heavy',
        ],
    ],
    'Warranty' => [
        'slug'         => 'warranty',
        'orderby'      => 'menu_order',
        'has_archives' => false,
        'terms'        => [
            '5-Year',
            '1-Year',
            '90-Day',
        ],
    ],
    'Brand' => [
        'slug'         => 'brand',
        'orderby'      => 'name',
        'has_archives' => true,
        'terms'        => [
            'Columbia Taping Tools',
            'TapeTech',
            'Asgard',
            'Graco',
            'SurPro',
            'Ames',
        ],
    ],
];

// ---------------------------------------------------------------------------
// 3. HELPER FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * Create a single product category term if it does not already exist.
 *
 * @param string $name      Human-readable term name.
 * @param int    $parent_id Parent term ID (0 for top-level).
 * @return int              Term ID of the created or existing term.
 */
function dtb_create_product_cat( string $name, int $parent_id = 0 ): int {
    $existing = get_term_by( 'name', $name, 'product_cat' );
    if ( $existing instanceof WP_Term ) {
        return (int) $existing->term_id;
    }

    $result = wp_insert_term(
        $name,
        'product_cat',
        [
            'slug'   => sanitize_title( $name ),
            'parent' => $parent_id,
        ]
    );

    if ( is_wp_error( $result ) ) {
        // Term may already exist under a different parent — try to recover.
        $term = get_term_by( 'slug', sanitize_title( $name ), 'product_cat' );
        return $term instanceof WP_Term ? (int) $term->term_id : 0;
    }

    return (int) $result['term_id'];
}

/**
 * Register a WooCommerce global product attribute and populate its terms.
 *
 * @param string $label      Human-readable label (e.g. "Size/Width").
 * @param array  $definition Attribute definition array (see $dtb_attributes above).
 */
function dtb_register_global_attribute( string $label, array $definition ): void {
    if ( ! function_exists( 'wc_create_attribute' ) ) {
        // WooCommerce not active — skip silently.
        return;
    }

    $slug = sanitize_title( $definition['slug'] );
    $taxonomy = 'pa_' . $slug;

    // Check if attribute already registered.
    $existing_attributes = wc_get_attribute_taxonomies();
    foreach ( $existing_attributes as $att ) {
        if ( $att->attribute_name === $slug ) {
            // Attribute exists — just ensure all terms are present.
            dtb_ensure_attribute_terms( $taxonomy, $definition['terms'] );
            return;
        }
    }

    // Create the attribute.
    $attribute_id = wc_create_attribute( [
        'name'         => $label,
        'slug'         => $slug,
        'type'         => 'select',
        'order_by'     => $definition['orderby'],
        'has_archives' => (bool) $definition['has_archives'],
    ] );

    if ( is_wp_error( $attribute_id ) ) {
        error_log( 'DTB: Failed to create attribute "' . $label . '": ' . $attribute_id->get_error_message() );
        return;
    }

    // Register the taxonomy immediately so wp_insert_term works in the same request.
    if ( ! taxonomy_exists( $taxonomy ) ) {
        register_taxonomy( $taxonomy, 'product' );
    }

    dtb_ensure_attribute_terms( $taxonomy, $definition['terms'] );
}

/**
 * Insert attribute terms if they don't already exist.
 *
 * @param string   $taxonomy Taxonomy slug (e.g. "pa_material").
 * @param string[] $terms    Array of term names.
 */
function dtb_ensure_attribute_terms( string $taxonomy, array $terms ): void {
    foreach ( $terms as $i => $term_name ) {
        if ( ! get_term_by( 'name', $term_name, $taxonomy ) ) {
            wp_insert_term(
                $term_name,
                $taxonomy,
                [
                    'slug'        => sanitize_title( $term_name ),
                    'description' => '',
                ]
            );
        }
    }
}

// ---------------------------------------------------------------------------
// 4. MAIN SETUP ROUTINE
// ---------------------------------------------------------------------------

/**
 * Run the full taxonomy and attribute setup.
 *
 * Safe to call multiple times — all operations are idempotent.
 */
function dtb_setup_taxonomy(): void {
    global $dtb_category_tree, $dtb_attributes;

    if ( ! is_admin() && ! ( defined( 'WP_CLI' ) && WP_CLI ) ) {
        return;
    }

    // --- 4a. Product categories ---
    foreach ( $dtb_category_tree as $parent_name => $children ) {
        $parent_id = dtb_create_product_cat( $parent_name, 0 );

        foreach ( $children as $child_name ) {
            dtb_create_product_cat( $child_name, $parent_id );
        }
    }

    // --- 4b. Global attributes ---
    foreach ( $dtb_attributes as $label => $definition ) {
        dtb_register_global_attribute( $label, $definition );
    }

    // Flush rewrite rules once all taxonomies are registered.
    flush_rewrite_rules( false );

    if ( defined( 'WP_CLI' ) && WP_CLI ) {
        WP_CLI::success( 'Drywall Toolbox: product categories and global attributes created.' );
    }
}

// ---------------------------------------------------------------------------
// 5. TRIGGER
// ---------------------------------------------------------------------------

// One-time admin URL trigger: /wp-admin/?drywall_setup_taxonomy=1
add_action( 'admin_init', function () {
    if (
        isset( $_GET['drywall_setup_taxonomy'] ) // phpcs:ignore WordPress.Security.NonceVerification
        && current_user_can( 'manage_woocommerce' )
        && ! get_option( 'dtb_taxonomy_setup_done' )
    ) {
        dtb_setup_taxonomy();
        update_option( 'dtb_taxonomy_setup_done', true );
        wp_safe_redirect( admin_url( 'edit-tags.php?taxonomy=product_cat&post_type=product' ) );
        exit;
    }
} );

// WP-CLI: when this file is evaluated directly, run immediately.
if ( defined( 'WP_CLI' ) && WP_CLI ) {
    dtb_setup_taxonomy();
}
