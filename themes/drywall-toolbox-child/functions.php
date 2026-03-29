<?php
/**
 * Drywall Toolbox Child Theme — functions.php
 *
 * Responsibilities:
 *  - Enqueue parent (Twenty Twenty-Four) and child stylesheets.
 *  - Apply WordPress security hardening that can be done via PHP.
 *  - Add security-related HTTP headers where PHP is the appropriate layer.
 *
 * NOTE: Additional security rules (HTTPS redirect, HSTS, X-Frame-Options, etc.)
 * must be applied via .htaccess in cPanel — see README.md for the exact snippet.
 */

defined( 'ABSPATH' ) || exit;

// ---------------------------------------------------------------------------
// 1. ENQUEUE PARENT + CHILD STYLESHEETS
// ---------------------------------------------------------------------------

/**
 * Load parent theme stylesheet first, then child theme overrides.
 */
function dtb_child_enqueue_styles() {
    $parent_style = 'twentytwentyfour-style';

    wp_enqueue_style(
        $parent_style,
        get_template_directory_uri() . '/style.css',
        array(),
        wp_get_theme( get_template() )->get( 'Version' )
    );

    wp_enqueue_style(
        'dtb-child-style',
        get_stylesheet_directory_uri() . '/style.css',
        array( $parent_style ),
        wp_get_theme()->get( 'Version' )
    );
}
add_action( 'wp_enqueue_scripts', 'dtb_child_enqueue_styles' );

// ---------------------------------------------------------------------------
// 2. SECURITY HARDENING
// ---------------------------------------------------------------------------

/**
 * Disable XML-RPC — not needed and a common attack vector.
 */
add_filter( 'xmlrpc_enabled', '__return_false' );

/**
 * Remove the X-Pingback header that leaks XML-RPC endpoint.
 */
function dtb_remove_x_pingback( $headers ) {
    unset( $headers['X-Pingback'] );
    return $headers;
}
add_filter( 'wp_headers', 'dtb_remove_x_pingback' );

/**
 * Hide the WordPress version number from the HTML <head> and feeds.
 */
function dtb_remove_wp_version() {
    return '';
}
add_filter( 'the_generator', 'dtb_remove_wp_version' );
remove_action( 'wp_head', 'wp_generator' );

/**
 * Remove version query strings from enqueued assets (reduces fingerprinting).
 */
function dtb_remove_asset_versions( $src ) {
    if ( strpos( $src, 'ver=' ) ) {
        $src = remove_query_arg( 'ver', $src );
    }
    return $src;
}
add_filter( 'style_loader_src',  'dtb_remove_asset_versions', 9999 );
add_filter( 'script_loader_src', 'dtb_remove_asset_versions', 9999 );

/**
 * Disable file editing via wp-admin (defense-in-depth).
 * This can also be set in wp-config.php; defined() guard prevents conflicts.
 */
if ( ! defined( 'DISALLOW_FILE_EDIT' ) ) {
    define( 'DISALLOW_FILE_EDIT', true );
}

/**
 * Prevent user enumeration via author archive URLs.
 */
function dtb_block_author_scan() {
    if ( ! is_admin() && isset( $_GET['author'] ) ) {
        wp_redirect( home_url(), 301 );
        exit;
    }
}
add_action( 'template_redirect', 'dtb_block_author_scan' );

/**
 * Send security-related HTTP response headers via PHP.
 *
 * NOTE: HTTPS-only headers (HSTS, upgrade-insecure-requests) are intentionally
 * handled in .htaccess, not here, so they are only sent over TLS.
 * See README.md → "Step 4: .htaccess Configuration" for the full ruleset.
 */
function dtb_security_headers() {
    if ( headers_sent() ) {
        return;
    }
    header( 'X-Content-Type-Options: nosniff' );
    header( 'Referrer-Policy: strict-origin-when-cross-origin' );
    header( 'Permissions-Policy: geolocation=(), microphone=(), camera=()' );
}
add_action( 'send_headers', 'dtb_security_headers' );

// ---------------------------------------------------------------------------
// 3. THEME SETUP
// ---------------------------------------------------------------------------

/**
 * Register theme supports and menus.
 */
function dtb_child_theme_setup() {
    add_theme_support( 'title-tag' );
    add_theme_support( 'post-thumbnails' );
    add_theme_support( 'html5', array(
        'search-form',
        'comment-form',
        'comment-list',
        'gallery',
        'caption',
        'style',
        'script',
    ) );

    register_nav_menus( array(
        'primary' => __( 'Primary Navigation', 'drywall-toolbox-child' ),
        'footer'  => __( 'Footer Navigation',  'drywall-toolbox-child' ),
    ) );
}
add_action( 'after_setup_theme', 'dtb_child_theme_setup' );
