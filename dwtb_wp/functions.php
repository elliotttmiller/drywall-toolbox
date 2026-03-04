<?php
/**
 * Drywall Toolbox Theme Functions
 *
 * @package drywall-toolbox
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// ─── Include Theme Files ───────────────────────────────────────────────────────

require_once get_template_directory() . '/inc/template-functions.php';
require_once get_template_directory() . '/inc/customizer.php';
if ( class_exists( 'WooCommerce' ) ) {
    require_once get_template_directory() . '/inc/woocommerce.php';
}

// ─── Theme Setup ───────────────────────────────────────────────────────────────

function dwtb_setup() {
    add_theme_support( 'title-tag' );
    add_theme_support( 'post-thumbnails' );
    add_theme_support( 'woocommerce' );
    add_theme_support( 'wc-product-gallery-zoom' );
    add_theme_support( 'wc-product-gallery-lightbox' );
    add_theme_support( 'wc-product-gallery-slider' );

    add_theme_support( 'custom-logo', array(
        'min-width'  => 180,
        'min-height' => 60,
        'max-width'  => 260,
        'max-height' => 136,
    ) );

    register_nav_menus( array(
        'primary'     => __( 'Primary Navigation', 'drywall-toolbox' ),
        'footer-menu' => __( 'Footer Menu', 'drywall-toolbox' ),
    ) );

    add_theme_support( 'html5', array(
        'search-form',
        'comment-form',
        'comment-list',
        'gallery',
        'caption',
        'style',
        'script',
    ) );
}
add_action( 'after_setup_theme', 'dwtb_setup' );

// ─── Scripts & Styles ──────────────────────────────────────────────────────────

function dwtb_scripts() {
    // Google Fonts
    $fonts_url = add_query_arg( array(
        'family'  => 'Inter:wght@300;400;500;600;700;800|JetBrains+Mono:wght@400;700',
        'display' => 'swap',
    ), 'https://fonts.googleapis.com/css2' );

    wp_enqueue_style( 'dwtb-google-fonts', $fonts_url, array(), null );

    // Machined design system CSS
    wp_enqueue_style(
        'dwtb-machined',
        get_template_directory_uri() . '/assets/css/machined-design.css',
        array( 'dwtb-google-fonts' ),
        wp_get_theme()->get( 'Version' )
    );

    // Main theme stylesheet
    wp_enqueue_style(
        'dwtb-style',
        get_stylesheet_uri(),
        array( 'dwtb-machined' ),
        wp_get_theme()->get( 'Version' )
    );

    // WooCommerce styles – only on WC pages
    if ( function_exists( 'is_woocommerce' ) && ( is_woocommerce() || is_cart() || is_checkout() ) ) {
        wp_enqueue_style(
            'dwtb-woocommerce',
            get_template_directory_uri() . '/assets/css/woocommerce.css',
            array( 'dwtb-style' ),
            wp_get_theme()->get( 'Version' )
        );
    }

    // Main JS
    wp_enqueue_script(
        'dwtb-main',
        get_template_directory_uri() . '/assets/js/main.js',
        array( 'jquery' ),
        wp_get_theme()->get( 'Version' ),
        true
    );

    // Cart JS
    wp_enqueue_script(
        'dwtb-cart',
        get_template_directory_uri() . '/assets/js/cart.js',
        array( 'jquery' ),
        wp_get_theme()->get( 'Version' ),
        true
    );

    // Localize cart script
    $shop_url     = function_exists( 'wc_get_page_id' ) ? get_permalink( wc_get_page_id( 'shop' ) ) : home_url( '/shop/' );
    $checkout_url = function_exists( 'wc_get_checkout_url' ) ? wc_get_checkout_url() : home_url( '/checkout/' );

    wp_localize_script( 'dwtb-cart', 'dwtb_ajax', array(
        'ajaxurl'     => admin_url( 'admin-ajax.php' ),
        'nonce'       => wp_create_nonce( 'dwtb_cart_nonce' ),
        'cartCount'   => dwtb_cart_count(),
        'shopUrl'     => esc_url( $shop_url ),
        'checkoutUrl' => esc_url( $checkout_url ),
    ) );
}
add_action( 'wp_enqueue_scripts', 'dwtb_scripts' );

// ─── Cart Helpers ───────────────────────────────────────────────────────────────

function dwtb_cart_count() {
    if ( function_exists( 'WC' ) && WC()->cart ) {
        return (int) WC()->cart->get_cart_contents_count();
    }
    return 0;
}

// ─── Body Classes ───────────────────────────────────────────────────────────────

function dwtb_body_classes( $classes ) {
    if ( is_front_page() ) {
        $classes[] = 'page-home';
    }
    if ( function_exists( 'is_shop' ) && is_shop() ) {
        $classes[] = 'page-shop';
    }
    if ( is_page( 'about' ) ) {
        $classes[] = 'page-about';
    }
    if ( is_page( 'contact' ) ) {
        $classes[] = 'page-contact';
    }
    if ( is_page( 'parts' ) ) {
        $classes[] = 'page-parts';
    }
    if ( class_exists( 'WooCommerce' ) ) {
        $classes[] = 'has-woocommerce';
    }
    return $classes;
}
add_filter( 'body_class', 'dwtb_body_classes' );

// ─── Widget Areas ───────────────────────────────────────────────────────────────

function dwtb_widgets_init() {
    register_sidebar( array(
        'name'          => __( 'Shop Sidebar', 'drywall-toolbox' ),
        'id'            => 'shop-sidebar',
        'before_widget' => '<div id="%1$s" class="widget %2$s">',
        'after_widget'  => '</div>',
        'before_title'  => '<h4 class="widget-title">',
        'after_title'   => '</h4>',
    ) );

    register_sidebar( array(
        'name'          => __( 'Footer Column 1', 'drywall-toolbox' ),
        'id'            => 'footer-1',
        'before_widget' => '<div id="%1$s" class="widget %2$s">',
        'after_widget'  => '</div>',
        'before_title'  => '<h4 class="widget-title">',
        'after_title'   => '</h4>',
    ) );

    register_sidebar( array(
        'name'          => __( 'Footer Column 2', 'drywall-toolbox' ),
        'id'            => 'footer-2',
        'before_widget' => '<div id="%1$s" class="widget %2$s">',
        'after_widget'  => '</div>',
        'before_title'  => '<h4 class="widget-title">',
        'after_title'   => '</h4>',
    ) );

    register_sidebar( array(
        'name'          => __( 'Footer Column 3', 'drywall-toolbox' ),
        'id'            => 'footer-3',
        'before_widget' => '<div id="%1$s" class="widget %2$s">',
        'after_widget'  => '</div>',
        'before_title'  => '<h4 class="widget-title">',
        'after_title'   => '</h4>',
    ) );
}
add_action( 'widgets_init', 'dwtb_widgets_init' );

// ─── AJAX: Add to Cart ─────────────────────────────────────────────────────────

function dwtb_ajax_add_to_cart() {
    check_ajax_referer( 'dwtb_cart_nonce', 'nonce' );

    $product_id = isset( $_POST['product_id'] ) ? absint( $_POST['product_id'] ) : 0;
    $quantity   = isset( $_POST['quantity'] ) ? absint( $_POST['quantity'] ) : 1;

    if ( ! $product_id ) {
        wp_send_json_error( array( 'message' => __( 'Invalid product.', 'drywall-toolbox' ) ) );
    }

    if ( function_exists( 'WC' ) && WC()->cart ) {
        $added = WC()->cart->add_to_cart( $product_id, $quantity );
        if ( $added ) {
            wp_send_json_success( array(
                'cart_count' => dwtb_cart_count(),
                'message'    => __( 'Added to cart.', 'drywall-toolbox' ),
            ) );
        }
    }

    wp_send_json_error( array( 'message' => __( 'Could not add to cart.', 'drywall-toolbox' ) ) );
}
add_action( 'wp_ajax_dwtb_add_to_cart', 'dwtb_ajax_add_to_cart' );
add_action( 'wp_ajax_nopriv_dwtb_add_to_cart', 'dwtb_ajax_add_to_cart' );

// ─── AJAX: Cart Fragments ──────────────────────────────────────────────────────

function dwtb_ajax_cart_fragments() {
    check_ajax_referer( 'dwtb_cart_nonce', 'nonce' );
    wp_send_json_success( array( 'cart_count' => dwtb_cart_count() ) );
}
add_action( 'wp_ajax_dwtb_cart_fragments', 'dwtb_ajax_cart_fragments' );
add_action( 'wp_ajax_nopriv_dwtb_cart_fragments', 'dwtb_ajax_cart_fragments' );

// ─── WooCommerce Integration ───────────────────────────────────────────────────

function dwtb_woocommerce_setup() {
    // Remove default WC wrappers
    remove_action( 'woocommerce_before_main_content', 'woocommerce_output_content_wrapper', 10 );
    remove_action( 'woocommerce_after_main_content', 'woocommerce_output_content_wrapper_end', 10 );
    remove_action( 'woocommerce_before_main_content', 'woocommerce_breadcrumb', 20 );

    // Add custom wrappers
    add_action( 'woocommerce_before_main_content', 'dwtb_woocommerce_wrapper_before', 10 );
    add_action( 'woocommerce_after_main_content', 'dwtb_woocommerce_wrapper_after', 10 );
}
add_action( 'after_setup_theme', 'dwtb_woocommerce_setup' );

function dwtb_woocommerce_wrapper_before() {
    echo '<div class="woocommerce-wrapper">';
}

function dwtb_woocommerce_wrapper_after() {
    echo '</div>';
}

// ─── WooCommerce HPOS Compatibility ───────────────────────────────────────────

add_action( 'before_woocommerce_init', function () {
    if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
            'custom_order_tables',
            __FILE__,
            true
        );
    }
} );

// ─── Helper: Page URL ─────────────────────────────────────────────────────────

function dwtb_get_page_url( $slug ) {
    $page = get_page_by_path( $slug );
    if ( $page ) {
        return esc_url( get_permalink( $page->ID ) );
    }
    return esc_url( home_url( '/' . $slug . '/' ) );
}

// ─── Helper: Active Nav ───────────────────────────────────────────────────────

function dwtb_active_nav( $path ) {
    $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '';
    if ( $path && strpos( $request_uri, $path ) !== false ) {
        return 'active';
    }
    return '';
}
