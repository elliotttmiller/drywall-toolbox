<?php
/**
 * Drywall Toolbox Theme Functions
 *
 * @package DrywallToolbox
 */

// Prevent direct access
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Guard constants so this theme can coexist with the DTB plugin (which also
// defines DTB_VERSION). The theme-specific constants use unique names to avoid
// any collision regardless of load order.
defined( 'DTB_THEME_VERSION' ) || define( 'DTB_THEME_VERSION', '1.0.0' );
defined( 'DTB_THEME_DIR' )     || define( 'DTB_THEME_DIR', get_template_directory() );
defined( 'DTB_THEME_URI' )     || define( 'DTB_THEME_URI', get_template_directory_uri() );

// ─── THEME SETUP ────────────────────────────────────────────────────────────
function dtb_setup() {
    load_theme_textdomain( 'drywall-toolbox', DTB_THEME_DIR . '/languages' );

    add_theme_support( 'title-tag' );
    add_theme_support( 'post-thumbnails' );
    add_theme_support( 'html5', [
        'search-form', 'comment-form', 'comment-list', 'gallery', 'caption', 'style', 'script',
    ] );
    add_theme_support( 'custom-logo', [
        'height'      => 80,
        'width'       => 250,
        'flex-height' => true,
        'flex-width'  => true,
    ] );
    add_theme_support( 'woocommerce' );
    add_theme_support( 'wc-product-gallery-zoom' );
    add_theme_support( 'wc-product-gallery-lightbox' );
    add_theme_support( 'wc-product-gallery-slider' );

    register_nav_menus( [
        'primary' => __( 'Primary Navigation', 'drywall-toolbox' ),
        'footer'  => __( 'Footer Navigation', 'drywall-toolbox' ),
    ] );

    $GLOBALS['content_width'] = 1400;
}
add_action( 'after_setup_theme', 'dtb_setup' );

// ─── ENQUEUE SCRIPTS & STYLES ───────────────────────────────────────────────
function dtb_enqueue_assets() {
    // Main stylesheet
    wp_enqueue_style(
        'drywall-toolbox-style',
        get_stylesheet_uri(),
        [],
        DTB_THEME_VERSION
    );

    // Google Fonts
    wp_enqueue_style(
        'dtb-google-fonts',
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap',
        [],
        null
    );

    // Core JS
    wp_enqueue_script(
        'dtb-main',
        DTB_THEME_URI . '/js/main.js',
        [],
        DTB_THEME_VERSION,
        true
    );

    // Cart JS
    wp_enqueue_script(
        'dtb-cart',
        DTB_THEME_URI . '/js/cart.js',
        [ 'dtb-main' ],
        DTB_THEME_VERSION,
        true
    );

    // Products JS (only on products page)
    if ( is_page( 'products' ) || is_page( 'all-products' ) ) {
        wp_enqueue_script(
            'dtb-products',
            DTB_THEME_URI . '/js/products.js',
            [ 'dtb-main', 'dtb-cart' ],
            DTB_THEME_VERSION,
            true
        );
    }

    // Parts JS (only on parts page)
    if ( is_page( 'parts' ) ) {
        wp_enqueue_script(
            'dtb-parts',
            DTB_THEME_URI . '/js/parts.js',
            [ 'dtb-main' ],
            DTB_THEME_VERSION,
            true
        );
    }

    // Repairs JS (only on repairs page)
    if ( is_page( 'repairs' ) ) {
        wp_enqueue_script(
            'dtb-repairs',
            DTB_THEME_URI . '/js/repairs.js',
            [ 'dtb-main' ],
            DTB_THEME_VERSION,
            true
        );
    }

    // Pass data to JavaScript
    $dtb_data = [
        'themeUri'  => DTB_THEME_URI,
        'ajaxUrl'   => admin_url( 'admin-ajax.php' ),
        'siteUrl'   => home_url(),
        'nonce'     => wp_create_nonce( 'dtb_nonce' ),
        'assetsUri' => DTB_THEME_URI . '/assets',
    ];
    wp_localize_script( 'dtb-main', 'DTB', $dtb_data );
}
add_action( 'wp_enqueue_scripts', 'dtb_enqueue_assets' );

// NOTE: Custom post types (dtb_tool, dtb_product, dtb_schematic) and the
// dtb_brand taxonomy are registered by the DTB Custom Functionality plugin.
// Post-type registration belongs in a plugin so that content is not lost if
// the theme is ever switched.  Do NOT add register_post_type() calls here.

// ─── AJAX: CONTACT FORM ─────────────────────────────────────────────────────
function dtb_handle_contact_form() {
    check_ajax_referer( 'dtb_nonce', 'nonce' );

    $name         = sanitize_text_field( $_POST['name'] ?? '' );
    $inquiry_type = sanitize_text_field( $_POST['inquiryType'] ?? '' );
    $message      = sanitize_textarea_field( $_POST['message'] ?? '' );

    if ( empty( $name ) || empty( $message ) ) {
        wp_send_json_error( [ 'message' => 'Please fill in all required fields.' ] );
    }

    $to      = get_option( 'admin_email' );
    $subject = sprintf( '[Drywall Toolbox] New Inquiry: %s — %s', $inquiry_type, $name );
    $body    = "Name: $name\nInquiry Type: $inquiry_type\n\nMessage:\n$message";
    $headers = [ 'Content-Type: text/plain; charset=UTF-8' ];

    wp_mail( $to, $subject, $body, $headers );
    wp_send_json_success( [ 'message' => 'Message sent! Our engineers will contact you within 1 business day.' ] );
}
add_action( 'wp_ajax_dtb_contact_form', 'dtb_handle_contact_form' );
add_action( 'wp_ajax_nopriv_dtb_contact_form', 'dtb_handle_contact_form' );

// ─── AJAX: REPAIR REQUEST ───────────────────────────────────────────────────
function dtb_handle_repair_request() {
    check_ajax_referer( 'dtb_nonce', 'nonce' );

    $data = [];
    $fields = [
        'fullName', 'email', 'phone', 'company',
        'toolCategory', 'toolModel', 'serialNumber', 'toolAge',
        'serviceType', 'priority', 'issueStart', 'issueDescription',
        'contactPreference', 'additionalNotes',
    ];
    foreach ( $fields as $field ) {
        $data[ $field ] = sanitize_text_field( $_POST[ $field ] ?? '' );
    }
    $data['issueDescription'] = sanitize_textarea_field( $_POST['issueDescription'] ?? '' );
    $data['additionalNotes']  = sanitize_textarea_field( $_POST['additionalNotes'] ?? '' );

    if ( empty( $data['fullName'] ) || empty( $data['email'] ) ) {
        wp_send_json_error( [ 'message' => 'Please fill in all required fields.' ] );
    }

    $to      = get_option( 'admin_email' );
    $subject = sprintf( '[Drywall Toolbox] Repair Request: %s — %s %s', $data['serviceType'], $data['toolCategory'], $data['toolModel'] );
    $body    = "REPAIR REQUEST\n\nContact Information:\n";
    foreach ( $data as $key => $val ) {
        $body .= "$key: $val\n";
    }

    wp_mail( $to, $subject, $body );
    wp_send_json_success( [ 'message' => 'Repair request submitted! Our service team will contact you within 24 hours.' ] );
}
add_action( 'wp_ajax_dtb_repair_request', 'dtb_handle_repair_request' );
add_action( 'wp_ajax_nopriv_dtb_repair_request', 'dtb_handle_repair_request' );

// ─── WIDGET AREAS ───────────────────────────────────────────────────────────
function dtb_widgets_init() {
    register_sidebar( [
        'name'          => __( 'Sidebar', 'drywall-toolbox' ),
        'id'            => 'sidebar-1',
        'description'   => __( 'Add widgets here.', 'drywall-toolbox' ),
        'before_widget' => '<section id="%1$s" class="widget %2$s">',
        'after_widget'  => '</section>',
        'before_title'  => '<h2 class="widget-title">',
        'after_title'   => '</h2>',
    ] );
    register_sidebar( [
        'name'          => __( 'Footer', 'drywall-toolbox' ),
        'id'            => 'footer-1',
        'description'   => __( 'Footer widget area.', 'drywall-toolbox' ),
        'before_widget' => '<section id="%1$s" class="widget %2$s">',
        'after_widget'  => '</section>',
        'before_title'  => '<h2 class="widget-title">',
        'after_title'   => '</h2>',
    ] );
}
add_action( 'widgets_init', 'dtb_widgets_init' );

// ─── REWRITE FLUSH ON THEME SWITCH ──────────────────────────────────────────
// register_activation_hook() has no effect inside a theme's functions.php.
// The correct hook for themes is after_switch_theme, which fires once when
// this theme is activated and ensures custom post-type rewrite rules are
// flushed so their archive/single URLs resolve correctly.
function dtb_theme_activation_flush() {
    flush_rewrite_rules();
}
add_action( 'after_switch_theme', 'dtb_theme_activation_flush' );
