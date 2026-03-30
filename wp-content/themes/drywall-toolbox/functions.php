<?php
/**
 * Drywall Toolbox — Headless WordPress Theme
 *
 * This theme serves a React SPA (built with Webpack) as the entire frontend.
 * WordPress and WooCommerce run as the headless CMS / REST API backend only.
 *
 * Responsibilities of this file:
 *  1. Enqueue React build assets from dist/asset-manifest.json (content-hashed filenames).
 *  2. Override all frontend templates to serve the React SPA shell (index.php).
 *  3. Strip unnecessary WordPress output (emoji, oEmbed, feeds, etc.).
 *  4. Add security headers and CORS support for the WooCommerce REST API.
 *  5. Protect against author enumeration.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// ─── Theme Setup ─────────────────────────────────────────────────────────────

add_action( 'after_setup_theme', 'dtb_theme_setup' );
function dtb_theme_setup() {
    // Headless theme: only minimal WordPress support needed.
    load_theme_textdomain( 'drywall-toolbox', get_template_directory() . '/languages' );
    add_theme_support( 'title-tag' );
}

// ─── Enqueue React SPA Assets ────────────────────────────────────────────────

add_action( 'wp_enqueue_scripts', 'dtb_enqueue_react_app' );
function dtb_enqueue_react_app() {
    $dist_path = get_template_directory() . '/dist';
    $dist_uri  = get_template_directory_uri() . '/dist';
    $manifest  = $dist_path . '/asset-manifest.json';

    if ( ! file_exists( $manifest ) ) {
        // dist/ hasn't been built yet — fail gracefully rather than crash.
        return;
    }

    $data = json_decode( file_get_contents( $manifest ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
    if ( ! $data || empty( $data['files'] ) ) {
        return;
    }

    $files = $data['files'];

    // ── CSS ──────────────────────────────────────────────────────────────────
    // Enqueue in <head> (no defer). Using null version disables the ?ver= cache-
    // buster since the filename already contains a content hash.
    foreach ( $files as $key => $src ) {
        if ( preg_match( '/^main.*\.css$/', $key ) ) {
            wp_enqueue_style( 'dtb-app', dtb_resolve_asset_url( $src, $dist_uri ), [], null );
            break;
        }
    }

    // ── JavaScript ───────────────────────────────────────────────────────────
    // Load order: runtime → vendor-react → vendor → common → main.
    // Each chunk is marked with its correct dependency chain so WordPress
    // outputs <script> tags in the right order.
    $enqueued = [];

    $enqueue = function ( $handle, $pattern, $deps ) use ( $files, $dist_uri, &$enqueued ) {
        foreach ( $files as $key => $src ) {
            if ( preg_match( $pattern, $key ) ) {
                wp_enqueue_script( $handle, dtb_resolve_asset_url( $src, $dist_uri ), $deps, null, true );
                $enqueued[] = $handle;
                break;
            }
        }
    };

    $enqueue( 'dtb-runtime',      '/^runtime.*\.js$/',      [] );
    $enqueue( 'dtb-vendor-react', '/^vendor-react.*\.js$/', dtb_filter_deps( [ 'dtb-runtime' ], $enqueued ) );
    // Match the manifest key "vendor.js" exactly — the webpack chunk is named "vendor"
    // by the splitChunks cacheGroup, distinct from "vendor-react".
    $enqueue( 'dtb-vendor',       '/^vendor\.js$/',         dtb_filter_deps( [ 'dtb-runtime' ], $enqueued ) );
    $enqueue( 'dtb-common',       '/^common.*\.js$/',        dtb_filter_deps( [ 'dtb-runtime', 'dtb-vendor-react', 'dtb-vendor' ], $enqueued ) );
    $enqueue( 'dtb-main',         '/^main.*\.js$/',          dtb_filter_deps( [ 'dtb-runtime', 'dtb-vendor-react', 'dtb-vendor', 'dtb-common' ], $enqueued ) );

    // ── Runtime Config ───────────────────────────────────────────────────────
    // Expose site URLs and a REST nonce so the React app can read them from
    // window.DTB_CONFIG without hard-coding values at build time.
    if ( in_array( 'dtb-main', $enqueued, true ) ) {
        wp_add_inline_script(
            'dtb-main',
            'window.DTB_CONFIG = ' . wp_json_encode(
                [
                    'wpBaseUrl' => home_url(),
                    'wcBaseUrl' => home_url( '/wp-json/wc/v3' ),
                    'nonce'     => wp_create_nonce( 'wp_rest' ),
                    'siteUrl'   => get_site_url(),
                ]
            ) . ';',
            'before'
        );
    }
}

/**
 * Resolve an asset URL from the manifest.
 *
 * The manifest stores values as absolute paths from the domain root
 * (e.g. "/wp-content/themes/drywall-toolbox/dist/assets/js/main.hash.js").
 * On multi-site or non-root installs we recompute the URL from the actual
 * theme directory URI so paths are always correct.
 *
 * @param  string $manifest_src Value from asset-manifest.json.
 * @param  string $dist_uri     Full URI to the theme's dist/ directory.
 * @return string               Absolute URL ready for wp_enqueue_*.
 */
function dtb_resolve_asset_url( $manifest_src, $dist_uri ) {
    // If the value already looks like a full URL, use it directly.
    if ( str_starts_with( $manifest_src, 'http' ) ) {
        return esc_url_raw( $manifest_src );
    }

    // Extract the path component after /dist/ and rebuild with the real URI.
    // e.g. "/wp-content/themes/drywall-toolbox/dist/assets/js/main.hash.js"
    //   → "assets/js/main.hash.js"
    $relative = ltrim( preg_replace( '#^.*?/dist/#', '', $manifest_src ), '/' );

    return esc_url_raw( $dist_uri . '/' . $relative );
}

/**
 * Return only the deps that are already in the $enqueued list.
 * Prevents wp_enqueue_script() warnings about unknown dependency handles.
 *
 * @param  string[] $wanted   Desired dependency handles.
 * @param  string[] $enqueued Handles that were actually registered.
 * @return string[]
 */
function dtb_filter_deps( array $wanted, array $enqueued ) {
    return array_values( array_intersect( $wanted, $enqueued ) );
}

// ─── Template Override ───────────────────────────────────────────────────────
// Force every public-facing request to use the React SPA shell (index.php).
// WordPress admin, REST API, and wp-login.php are unaffected.

add_filter( 'template_include', 'dtb_force_react_template', 99 );
function dtb_force_react_template( $template ) {
    if ( is_admin() ) {
        return $template;
    }
    return get_template_directory() . '/index.php';
}

// ─── Clean Up WordPress Head ─────────────────────────────────────────────────
// Remove WordPress cruft that serves no purpose in a headless React SPA.

add_action( 'init', 'dtb_clean_head' );
function dtb_clean_head() {
    remove_action( 'wp_head', 'wp_generator' );
    remove_action( 'wp_head', 'rsd_link' );
    remove_action( 'wp_head', 'wlwmanifest_link' );
    remove_action( 'wp_head', 'wp_shortlink_wp_head', 10 );
    remove_action( 'wp_head', 'adjacent_posts_rel_link_wp_head', 10 );
    remove_action( 'wp_head', 'feed_links', 2 );
    remove_action( 'wp_head', 'feed_links_extra', 3 );
    remove_action( 'wp_head', 'wp_resource_hints', 2 );

    // Disable WordPress emoji scripts — unused in React SPA.
    remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
    remove_action( 'wp_print_styles', 'print_emoji_styles' );
    add_filter( 'emoji_svg_url', '__return_false' );

    // Disable oEmbed link tags.
    remove_action( 'wp_head', 'wp_oembed_add_discovery_links' );
    remove_action( 'wp_head', 'wp_oembed_add_host_js' );
}

// ─── Hide WordPress Version ──────────────────────────────────────────────────
add_filter( 'the_generator', '__return_empty_string' );

// ─── Disable XML-RPC ─────────────────────────────────────────────────────────
add_filter( 'xmlrpc_enabled', '__return_false' );
add_filter( 'xmlrpc_methods', function() { return []; } );

// ─── Disable Admin Bar on Frontend ───────────────────────────────────────────
add_filter( 'show_admin_bar', '__return_false' );

// ─── Prevent Author Enumeration ──────────────────────────────────────────────
add_action( 'template_redirect', 'dtb_block_author_enumeration' );
function dtb_block_author_enumeration() {
    if ( is_author() ) {
        wp_redirect( home_url( '/' ), 301 );
        exit;
    }
}

// ─── Security Headers ────────────────────────────────────────────────────────
add_action( 'send_headers', 'dtb_security_headers' );
function dtb_security_headers() {
    if ( is_admin() ) {
        return;
    }
    header( 'X-Content-Type-Options: nosniff' );
    header( 'X-Frame-Options: SAMEORIGIN' );
    header( 'X-XSS-Protection: 1; mode=block' );
    header( 'Referrer-Policy: strict-origin-when-cross-origin' );
    header( 'Permissions-Policy: camera=(), microphone=(), geolocation=()' );
}

// ─── CORS for WooCommerce REST API ───────────────────────────────────────────
// Allows the React SPA (served at the same origin) and local dev server to
// call /wp-json/wc/v3/* endpoints.

add_action( 'rest_api_init', 'dtb_rest_cors', 15 );
function dtb_rest_cors() {
    remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
    add_filter( 'rest_pre_serve_request', 'dtb_send_cors_headers' );
}

function dtb_send_cors_headers( $value ) {
    $allowed = [
        home_url(),                        // production origin
        'http://localhost:5173',           // webpack dev server
        'http://127.0.0.1:5173',
    ];

    // Validate the raw Origin header against the explicit allowlist BEFORE
    // any sanitization, so the comparison is not affected by URL normalisation.
    $raw_origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? wp_unslash( $_SERVER['HTTP_ORIGIN'] ) : '';

    if ( $raw_origin && in_array( rtrim( $raw_origin, '/' ), $allowed, true ) ) {
        // Origin is in the allowlist — safe to echo back after escaping.
        header( 'Access-Control-Allow-Origin: ' . esc_url_raw( $raw_origin ) );
    } else {
        // Unknown origin — fall back to the production origin (same-origin requests
        // from browsers without an Origin header are unaffected).
        header( 'Access-Control-Allow-Origin: ' . esc_url_raw( home_url() ) );
    }

    header( 'Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS' );
    header( 'Access-Control-Allow-Credentials: true' );
    header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce' );
    header( 'Vary: Origin' );

    return $value;
}

// ─── WooCommerce REST API Authentication ─────────────────────────────────────
// Ensure unauthenticated product/category listing requests succeed while still
// requiring authentication for order-related endpoints.

add_filter( 'woocommerce_rest_check_permissions', 'dtb_wc_rest_public_read', 10, 4 );
function dtb_wc_rest_public_read( $permission, $context, $object_id, $post_type ) {
    // Allow public read access to products, product categories, and tags.
    $public_types = [ 'product', 'product_cat', 'product_tag', 'product_attribute' ];
    if ( 'read' === $context && in_array( $post_type, $public_types, true ) ) {
        return true;
    }
    return $permission;
}
