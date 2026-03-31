<?php
/**
 * Plugin Name: DTB Disable WooCommerce Admin
 * Description: Disables the WooCommerce Admin React app (core-profiler, analytics
 *              dashboard, onboarding wizard) for this headless installation.
 *              This is the authoritative fix for the "Cannot read properties of
 *              undefined (reading 'title')" TypeError thrown by core-profiler.js
 *              on the public frontend.
 *
 *              Root cause: WooCommerce 7+ ships a React-based admin app that is
 *              webpack-bundled into chunk files (core-profiler.js, etc.). Because
 *              all scripts share a single bundle, standard wp_dequeue_script() and
 *              feature-flag filters cannot prevent them from being enqueued. When
 *              the bundle runs it tries to access an onboarding profile object that
 *              may be undefined, crashing with a TypeError that pollutes both the
 *              wp-admin pages AND — depending on URL routing — any page where
 *              WooCommerce Admin assets are injected.
 *
 *              Fix: Return true from the `woocommerce_admin_disabled` filter.
 *              This is WooCommerce's own supported opt-out mechanism. It prevents
 *              the WooCommerce Admin package from registering any assets, REST
 *              routes, or page hooks — including core-profiler.js. All product and
 *              order management continues to work via the standard WooCommerce REST
 *              API at /wp-json/wc/v3/.
 *
 * Version: 1.0.0
 * Author: Drywall Toolbox
 *
 * Must-use plugin: Place in wp/wp-content/mu-plugins/
 * Last Updated: 2026-03-31
 */

defined( 'ABSPATH' ) || exit;

// ---------------------------------------------------------------------------
// PRIMARY FIX: Disable the WooCommerce Admin package entirely.
//
// This is WooCommerce's official supported hook for opting out of the new
// React-based admin app (introduced in WooCommerce 4.0, expanded in 7.0).
// Setting this to true prevents the package from loading ANY of its assets,
// including the core-profiler bundle that causes the TypeError.
//
// What remains available after disabling:
//   ✅ WooCommerce REST API (/wp-json/wc/v3/)
//   ✅ Classic WooCommerce admin pages (Products, Orders, Settings)
//   ✅ All WooCommerce hooks, filters, and backend logic
//   ✅ Checkout and cart functionality
//
// What is disabled:
//   ❌ WooCommerce Analytics React dashboard
//   ❌ Core-profiler / onboarding wizard JavaScript
//   ❌ WooCommerce Home React page
// ---------------------------------------------------------------------------
add_filter( 'woocommerce_admin_disabled', '__return_true' );

// ---------------------------------------------------------------------------
// SECONDARY GUARD: Remove any WooCommerce Admin page registrations that may
// have already been queued before our filter fires. This covers edge cases
// where WooCommerce Admin has already partially initialised.
// ---------------------------------------------------------------------------
add_action( 'admin_menu', function () {
	// Remove the WooCommerce Admin top-level menu page if it was registered.
	// The classic WooCommerce submenu items (Products, Orders, etc.) are
	// registered separately and are NOT affected by this remove_menu_page call.
	remove_menu_page( 'woocommerce-admin' );
}, 999 );

// ---------------------------------------------------------------------------
// TERTIARY GUARD: Block direct browser navigation to the core-profiler URL.
// Prevents a hard page reload from landing on the setup wizard, which would
// cause a redirect loop to the front page.
// ---------------------------------------------------------------------------
add_action( 'load-admin.php', function () {
	if ( ! isset( $_GET['page'] ) ) {
		return;
	}
	$page = sanitize_text_field( wp_unslash( $_GET['page'] ) );
	$path = isset( $_GET['path'] ) ? sanitize_text_field( wp_unslash( $_GET['path'] ) ) : '';

	// Redirect /wp-admin/admin.php?page=wc-admin&path=/setup-wizard and
	// /wp-admin/admin.php?page=wc-admin&path=/profiler to the WP dashboard.
	if ( 'wc-admin' === $page && (
		false !== strpos( $path, 'setup-wizard' ) ||
		false !== strpos( $path, 'profiler' ) ||
		false !== strpos( $path, 'core-profiler' )
	) ) {
		wp_safe_redirect( admin_url() );
		exit;
	}
}, 5 );
