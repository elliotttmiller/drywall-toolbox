<?php
/**
 * Plugin Name: DTB Disable WooCommerce Admin
 * Description: Comprehensively prevents the WooCommerce core-profiler / Setup
 *              Wizard React app from loading and crashing on this headless
 *              installation. Uses seven independent guard layers so that if any
 *              one layer is bypassed the others still protect the site.
 *
 *              Root cause of "Cannot read properties of undefined (reading
 *              'title')" at core-profiler.js:
 *
 *              WooCommerce 7+ ships core-profiler.js as a React-based onboarding
 *              wizard. In WooCommerce 9.9+ the component fetches the store's
 *              default country via the WooCommerce REST API and then looks it up
 *              in wcSettings.countryData using the raw stored value as the key.
 *              When woocommerce_default_country is stored as "US:CA" (country with
 *              state suffix), the lookup countryData["US:CA"] returns undefined
 *              (keys in countryData are bare "US"), and the subsequent .title
 *              access on undefined throws the TypeError.
 *
 *              Additionally, from WooCommerce 9.9 onward the core-profiler runs
 *              as part of WooCommerce core — not the separate WooCommerce Admin
 *              analytics package — so the woocommerce_admin_disabled filter alone
 *              is no longer sufficient to prevent it from loading.
 *
 *              This plugin uses seven complementary layers:
 *                Layer 1  PHP opt-out filters (woocommerce_admin_disabled, features)
 *                Layer 2  Database flags — mark all onboarding as complete
 *                Layer 3  Hard HTTP redirect away from setup-wizard / profiler URLs
 *                Layer 4  Dequeue the WooCommerce Admin webpack bundle at run-time
 *                Layer 5A JS guard via admin_head (early intercept via defineProperty)
 *                Layer 5B JS guard via wp_add_inline_script after wc-settings
 *                Layer 6  PHP filter on woocommerce_shared_settings data
 *                Layer 7  Remove WooCommerce Admin admin-menu page
 *
 * Version: 2.0.0
 * Author: Drywall Toolbox
 *
 * Must-use plugin: Place in wp/wp-content/mu-plugins/
 * Last Updated: 2026-03-31
 */

defined( 'ABSPATH' ) || exit;

// ════════════════════════════════════════════════════════════════════════════
// LAYER 1 — Official WooCommerce PHP opt-out filters
// ════════════════════════════════════════════════════════════════════════════

/**
 * woocommerce_admin_disabled — officially supported since WooCommerce 4.0.
 * Prevents the WooCommerce Admin analytics/onboarding package from registering
 * any assets, REST routes, or page hooks.  Registered at PHP_INT_MAX so that
 * no subsequent filter can override it.
 *
 * NOTE: In WooCommerce 9.9+ the core-profiler was moved into WooCommerce core
 * and is no longer controlled solely by this filter.  Layers 2–7 cover that.
 */
add_filter( 'woocommerce_admin_disabled', '__return_true', PHP_INT_MAX );

/**
 * Disable specific WooCommerce admin features including core-profiler (WooCommerce 7+).
 * Registered at plugins_loaded priority 1 so the filter is in place before
 * WooCommerce's Features system initialises at priority 10.
 */
function dtb_disable_wc_admin_features( $features ) {
	return array_values(
		array_diff(
			(array) $features,
			array( 'core-profiler', 'onboarding', 'customize-store' )
		)
	);
}

add_action( 'plugins_loaded', function () {
	add_filter( 'woocommerce_admin_features', 'dtb_disable_wc_admin_features', PHP_INT_MAX );
	add_filter( 'woocommerce_admin_should_load_offline_onboarding', '__return_false', PHP_INT_MAX );
}, 1 );

// ════════════════════════════════════════════════════════════════════════════
// LAYER 2 — Mark all onboarding as complete in the database
// ════════════════════════════════════════════════════════════════════════════

/**
 * Ensure WooCommerce never redirects to the setup wizard by keeping all
 * "wizard complete" flags set.  Runs at admin_init priority 0 so we act
 * before WooCommerce's own redirect hook (priority 10).
 */
add_action( 'admin_init', function () {
	$flags = array(
		'woocommerce_setup_wizard_complete'            => 'yes',
		'woocommerce_task_list_complete'               => 'yes',
		'woocommerce_core_profiler_onboarding_status' => 'completed',
	);
	foreach ( $flags as $option => $value ) {
		if ( get_option( $option ) !== $value ) {
			update_option( $option, $value, false );
		}
	}

	// The install timestamp is what triggers the first-run wizard redirect.
	delete_option( 'woocommerce_admin_install_timestamp' );

	// Remove the classic setup-wizard redirect action.
	remove_action( 'admin_init', array( 'WC_Admin_Setup_Wizard', 'setup_wizard_redirect' ) );

	// Remove the core-profiler redirect action (WooCommerce 7+).
	remove_all_actions( 'woocommerce_admin_onboarding_wizard_redirect' );
}, 0 );

// ════════════════════════════════════════════════════════════════════════════
// LAYER 3 — Hard redirect away from the setup-wizard / profiler pages
// ════════════════════════════════════════════════════════════════════════════

add_action( 'load-admin.php', function () {
	if ( ! isset( $_GET['page'] ) ) {
		return;
	}
	$page = sanitize_text_field( wp_unslash( $_GET['page'] ) );
	$path = isset( $_GET['path'] ) ? sanitize_text_field( wp_unslash( $_GET['path'] ) ) : '';

	if ( 'wc-admin' !== $page ) {
		return;
	}

	foreach ( array( 'setup-wizard', 'profiler', 'core-profiler' ) as $blocked ) {
		if ( false !== strpos( $path, $blocked ) ) {
			wp_safe_redirect( admin_url() );
			exit;
		}
	}
}, 1 );

// ════════════════════════════════════════════════════════════════════════════
// LAYER 4 — Dequeue the WooCommerce Admin webpack bundle at run-time
// ════════════════════════════════════════════════════════════════════════════

add_action( 'admin_enqueue_scripts', function () {
	// Handles used by WooCommerce Admin across different versions.
	$handles = array(
		'wc-admin-app',
		'woocommerce-admin-app',
		'wc-admin',
		'woocommerce-admin',
	);
	foreach ( $handles as $h ) {
		if ( wp_script_is( $h, 'registered' ) || wp_script_is( $h, 'enqueued' ) ) {
			wp_dequeue_script( $h );
			wp_deregister_script( $h );
		}
	}
}, PHP_INT_MAX );

// ════════════════════════════════════════════════════════════════════════════
// LAYERS 5A + 5B — JavaScript safety guard in wp-admin
//
// Problem
//   core-profiler.js fetches woocommerce_default_country from the REST API,
//   then looks it up in wcSettings.countryData using the raw value as the
//   hash key.  If the stored value is "US:CA", countryData["US:CA"] is
//   undefined (keys are bare "US"), and the subsequent .title access throws:
//     TypeError: Cannot read properties of undefined (reading 'title')
//
// Fix strategy — two complementary injections:
//   5A (admin_head, priority 1): Uses Object.defineProperty to intercept the
//      window.wcSettings assignment BEFORE WooCommerce sets it.  Our setter
//      wraps countryData in a Proxy so that "US:CA" silently resolves to "US".
//   5B (admin_enqueue_scripts, PHP_INT_MAX-1): Re-applies the same guard as
//      an inline script immediately after the wc-settings script block.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Returns the shared JS guard IIFE (without a trailing semicolon so it is safe
 * to append as both a standalone <script> and via wp_add_inline_script).
 *
 * @return string
 */
function dtb_wc_admin_guard_js() {
	return <<<'GUARDJS'
(function () {
    "use strict";

    /**
     * Apply all safety patches to a wcSettings object in-place and return it.
     *
     * @param {object} s  The wcSettings value.
     * @returns {object}
     */
    function applyGuard( s ) {
        if ( ! s || typeof s !== "object" ) { return s; }

        /* ── countryData: make lookups tolerant of "CC:State" keys ─────── */
        if ( s.countryData && typeof Proxy !== "undefined" ) {
            var _cd = s.countryData;
            s.countryData = new Proxy( _cd, {
                get: function ( target, prop ) {
                    if ( typeof prop !== "string" ) { return target[ prop ]; }
                    /* Exact match — return immediately. */
                    if ( Object.prototype.hasOwnProperty.call( target, prop ) ) {
                        return target[ prop ];
                    }
                    /* Strip ":State" suffix and retry (e.g. "US:CA" → "US"). */
                    var bare = prop.split( ":" )[ 0 ];
                    if ( Object.prototype.hasOwnProperty.call( target, bare ) ) {
                        return target[ bare ];
                    }
                    /* Return a safe stub so .title / .label never throw. */
                    return { title: bare, label: bare, currency_pos: "left" };
                }
            } );
        }

        /* ── onboarding.profile: ensure all expected fields are present ── */
        if ( ! s.onboarding )          { s.onboarding = {}; }
        if ( ! s.onboarding.profile )  { s.onboarding.profile = {}; }
        var prof = s.onboarding.profile;
        if ( prof.completed  === undefined ) { prof.completed  = true; }
        if ( prof.skipped    === undefined ) { prof.skipped    = true; }
        if ( ! prof.industries )             { prof.industries  = []; }
        if ( ! prof.products )               { prof.products    = []; }
        if ( ! prof.business_extensions )    { prof.business_extensions = []; }

        return s;
    }

    /* ── Intercept future window.wcSettings assignments ─────────────────── */
    var _current = window.wcSettings || null;
    try {
        Object.defineProperty( window, "wcSettings", {
            configurable: true,
            enumerable:   true,
            get: function () { return _current; },
            set: function ( val ) { _current = applyGuard( val ); }
        } );
        /* Patch any value that was already assigned before this script ran. */
        if ( _current ) { applyGuard( _current ); }
    } catch ( defineErr ) {
        /* Fallback: defineProperty blocked (e.g. non-configurable property).
           Apply the guard directly to whatever is currently assigned. */
        if ( window.wcSettings ) { applyGuard( window.wcSettings ); }
    }
})()
GUARDJS;
}

/**
 * Layer 5A — Inject the guard in admin_head BEFORE WooCommerce sets wcSettings.
 *
 * Because we use Object.defineProperty to intercept the assignment, it does not
 * matter that wcSettings is not yet set at this point.  When WooCommerce later
 * runs its inline script ( window.wcSettings = { … } ) our setter fires and
 * wraps countryData automatically.
 */
add_action( 'admin_head', function () {
	echo '<script id="dtb-wc-admin-guard">' . "\n"
		. dtb_wc_admin_guard_js() . "\n"
		. '</script>' . "\n";
}, 1 );

/**
 * Layer 5B — Also attach as an inline script immediately after the wc-settings
 * script block.  Belt-and-suspenders: covers edge-cases where wcSettings is
 * replaced after the admin_head guard ran.
 */
add_action( 'admin_enqueue_scripts', function () {
	if ( wp_script_is( 'wc-settings', 'enqueued' ) ) {
		wp_add_inline_script( 'wc-settings', dtb_wc_admin_guard_js(), 'after' );
	}
}, PHP_INT_MAX - 1 );

// ════════════════════════════════════════════════════════════════════════════
// LAYER 6 — Filter woocommerce_shared_settings (PHP-side data provision)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Sanitise the PHP data array that WooCommerce serialises into window.wcSettings
 * before the page is sent to the browser.  This catches the problem at the
 * source: if the onboarding profile is properly pre-populated here, the JS
 * guard in Layer 5 becomes a pure safety net rather than the primary fix.
 */
add_filter( 'woocommerce_shared_settings', function ( $settings ) {
	if ( ! is_array( $settings ) ) {
		return $settings;
	}

	/* Ensure the onboarding profile is marked complete. */
	if ( empty( $settings['onboarding'] ) ) {
		$settings['onboarding'] = array();
	}
	$default_profile = array(
		'completed'           => true,
		'skipped'             => true,
		'industries'          => array(),
		'products'            => array(),
		'business_extensions' => array(),
	);
	$existing_profile = isset( $settings['onboarding']['profile'] )
		? (array) $settings['onboarding']['profile']
		: array();
	$settings['onboarding']['profile'] = array_merge( $default_profile, $existing_profile );

	/* Strip ":State" suffix from the stored default country so the JS lookup
	   always uses bare country codes that match countryData keys. */
	$raw_country = get_option( 'woocommerce_default_country', 'US' );
	if ( false !== strpos( $raw_country, ':' ) ) {
		$bare_country             = strstr( $raw_country, ':', true );
		$settings['storeCountry'] = $bare_country;
	}

	return $settings;
}, PHP_INT_MAX );

// ════════════════════════════════════════════════════════════════════════════
// LAYER 7 — Remove WooCommerce Admin admin-menu page
// ════════════════════════════════════════════════════════════════════════════

add_action( 'admin_menu', function () {
	// Remove WooCommerce Admin top-level menu (the "WooCommerce Home" React page).
	// Classic sub-menu items (Products, Orders, Settings) are registered
	// separately and are NOT affected by this call.
	remove_menu_page( 'woocommerce-admin' );
}, 999 );
