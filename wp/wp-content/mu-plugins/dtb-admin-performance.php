<?php
/**
 * DTB Admin Performance helpers (must-use)
 *
 * - Throttle Heartbeat on admin pages to reduce repeated AJAX churn.
 * - Dequeue known heavy admin scripts on pages that don't need them.
 * - Provide a simple toggle via constant for quick disabling.
 *
 * Place in mu-plugins/ so it always loads early and can't be accidentally
 * disabled via the WP admin UI.
 */

defined( 'ABSPATH' ) || exit;

// Quick disable for development or if it causes issues.
if ( defined( 'DTB_ADMIN_PERF_DISABLE' ) && DTB_ADMIN_PERF_DISABLE ) {
    return;
}

// ====== Throttle Heartbeat on admin pages ======
// Heartbeat is useful, but can cause frequent admin-ajax requests.
add_filter( 'heartbeat_send', function ( $response, $screen_id, $screen_base ) {
    // Keep the default response but ensure we don't trigger on every tick.
    return $response;
}, 10, 3 );

// Reduce Heartbeat tick frequency for non-post-edit screens.
add_filter( 'heartbeat_settings', function ( $settings ) {
    if ( is_admin() ) {
        // 'interval' is seconds between heartbeats. Default is usually 15.
        // Increase to 60s for admin screens to reduce AJAX frequency.
        $settings['interval'] = 60;
    }
    return $settings;
} );

// Disable Heartbeat on admin screens that don't need post edit autosave or real-time locks.
add_action( 'admin_enqueue_scripts', function ( $hook ) {
    $allowed_hook_prefixes = [ 'post.php', 'post-new.php' ];
    $allowed = false;
    foreach ( $allowed_hook_prefixes as $prefix ) {
        if ( strpos( $hook, $prefix ) === 0 ) {
            $allowed = true;
            break;
        }
    }

    // Also allow heartbeat on DTB Ops dashboard pages for polling support.
    if ( ! $allowed && false !== strpos( $hook, 'dtb-ops' ) ) {
        $allowed = true;
    }

    if ( ! $allowed ) {
        wp_deregister_script( 'heartbeat' );
        wp_dequeue_script( 'heartbeat' );
    }
} );

// ====== Dequeue heavy admin scripts selectively ======
add_action( 'admin_enqueue_scripts', function ( $hook ) {
    // Prevent dequeueing on WooCommerce product importer page where it's needed.
    // WooCommerce product importer script often has handle 'wc-product-import'.
    $skip_handles = [ 'wc-product-import', 'wc-admin-imports' ];

    $is_product_importer_page = false;
    if ( isset( $_GET['page'] ) && 'product_importer' === $_GET['page'] ) {
        $is_product_importer_page = true;
    }
    if ( false !== strpos( $hook, 'product_importer' ) || false !== strpos( $hook, 'woocommerce_page_wc-product-importer' ) ) {
        $is_product_importer_page = true;
    }

    if ( $is_product_importer_page ) {
        if ( wp_script_is( 'wc-status-widget-async', 'registered' ) || wp_script_is( 'wc-status-widget-async', 'enqueued' ) ) {
            wp_dequeue_script( 'wc-status-widget-async' );
            wp_deregister_script( 'wc-status-widget-async' );
        }
        return;
    }

    // If not the importer page, attempt to dequeue known heavy handles.
    if ( strpos( $hook, 'product_importer' ) === false ) {
        foreach ( $skip_handles as $h ) {
            if ( wp_script_is( $h, 'registered' ) || wp_script_is( $h, 'enqueued' ) ) {
                wp_dequeue_script( $h );
                wp_deregister_script( $h );
            }
        }
    }
} );

// ====== Helpful server-side headers for admin AJAX responses ======
// Add a short header to help debug slow responses (X-DTB-Took-ms) when possible.
add_action( 'rest_api_init', function () {
    add_filter( 'rest_post_dispatch', function ( $result, $server, $request ) {
        if ( defined( 'DTB_REQUEST_START_MS' ) ) {
            $took = (int) round( ( microtime( true ) - DTB_REQUEST_START_MS ) * 1000 );
            if ( is_array( $result ) && isset( $result['headers'] ) && is_array( $result['headers'] ) ) {
                $result['headers']['X-DTB-Took-ms'] = $took;
            }
        }
        return $result;
    }, 10, 3 );
} );

// Record a request start time for header calculation earlier in the stack.
if ( ! defined( 'DTB_REQUEST_START_MS' ) ) {
    define( 'DTB_REQUEST_START_MS', microtime( true ) );
}

// End of mu-plugin
