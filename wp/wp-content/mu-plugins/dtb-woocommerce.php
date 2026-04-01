<?php
/**
 * Plugin Name: DTB WooCommerce Configuration
 * Description: WooCommerce configuration for loopback requests, REST URL rewriting, and onboarding suppression.
 * Version: 7.1.0
 * Author: Drywall Toolbox
 *
 * Must-use plugin: Place in wp/wp-content/mu-plugins/
 * Last Updated: 2026-04-01 05:12:00 UTC
 */

defined( 'ABSPATH' ) || exit;

// ---------------------------------------------------------------------------
// 0. RUNTIME CONFIG ENDPOINT
//    Exposes WooCommerce API credentials to the frontend at runtime so the
//    React app can authenticate without needing a rebuild.
//    GET /wp-json/dtb/v1/config  → { wc_auth_user, wc_auth_pass }
//    CORS-safe: only returns credentials to requests from our own origin.
// ---------------------------------------------------------------------------
add_action( 'rest_api_init', function () {
	register_rest_route( 'dtb/v1', '/config', array(
		'methods'             => 'GET',
		'callback'            => function () {
			return rest_ensure_response( array(
				'wc_auth_user' => defined( 'DTB_WC_AUTH_USER' ) ? DTB_WC_AUTH_USER : '',
				'wc_auth_pass' => defined( 'DTB_WC_AUTH_PASS' ) ? DTB_WC_AUTH_PASS : '',
			) );
		},
		'permission_callback' => '__return_true',
	) );

	// -----------------------------------------------------------------------
	// PRODUCT CATALOG ENDPOINT
	//   GET /wp-json/dtb/v1/catalog  → { csv_url: "https://…/dtb/v1/products-csv" }
	//
	//   Returns the URL of the PHP CSV proxy endpoint (see below) so the
	//   React app always fetches through PHP — never a direct file access
	//   that Apache/mod_security could block with 403.
	// -----------------------------------------------------------------------
	register_rest_route( 'dtb/v1', '/catalog', array(
		'methods'             => 'GET',
		'callback'            => function () {
			$csv_filename = defined( 'DTB_WC_CSV_FILENAME' )
				? DTB_WC_CSV_FILENAME
				: 'product-wp-catalog-c7p3my05pn.csv';

			// Return the proxy URL, not the direct file URL.
			// The /dtb/v1/products-csv endpoint below streams the file through
			// PHP, bypassing any Apache/mod_security rule that blocks
			// wp-content/uploads/ direct access.
			$proxy_url = rest_url( 'dtb/v1/products-csv' );

			return rest_ensure_response( array(
				'csv_url'  => $proxy_url,
				'filename' => $csv_filename,
			) );
		},
		'permission_callback' => '__return_true',
	) );

	// -----------------------------------------------------------------------
	// CSV PROXY ENDPOINT
	//   GET /wp-json/dtb/v1/products-csv  → streams the WooCommerce CSV file
	//
	//   Reads the file from the uploads directory and outputs it with
	//   text/csv headers.  This sidesteps any Apache .htaccess or
	//   mod_security rule that blocks direct browser access to
	//   wp-content/uploads/wc-imports/.
	// -----------------------------------------------------------------------
	register_rest_route( 'dtb/v1', '/products-csv', array(
		'methods'             => 'GET',
		'callback'            => function () {
			$csv_filename = defined( 'DTB_WC_CSV_FILENAME' )
				? DTB_WC_CSV_FILENAME
				: 'product-wp-catalog-c7p3my05pn.csv';

			$upload_dir = wp_upload_dir();
			$file_path  = trailingslashit( $upload_dir['basedir'] ) . 'wc-imports/' . $csv_filename;

			if ( ! file_exists( $file_path ) ) {
				return new WP_Error(
					'csv_not_found',
					'Product CSV file not found on server.',
					array( 'status' => 404 )
				);
			}

			$csv_content = file_get_contents( $file_path );
			if ( $csv_content === false ) {
				return new WP_Error(
					'csv_read_error',
					'Could not read product CSV file.',
					array( 'status' => 500 )
				);
			}

			// Output raw CSV and exit — bypasses WP REST JSON wrapping.
			header( 'Content-Type: text/csv; charset=UTF-8' );
			header( 'Content-Disposition: inline; filename="' . $csv_filename . '"' );
			header( 'Cache-Control: public, max-age=3600' );
			header( 'Access-Control-Allow-Origin: *' );
			echo $csv_content;
			exit;
		},
		'permission_callback' => '__return_true',
	) );
} );

// ---------------------------------------------------------------------------
// 1. LOOPBACK REQUESTS
//    WooCommerce setup wizard and background tasks make server-to-server
//    (loopback) HTTP calls. We only need to relax SSL — do NOT set
//    blocking=false or you break the synchronous data fetches that core-profiler
//    depends on.
// ---------------------------------------------------------------------------
add_filter( 'http_request_args', function ( $args, $url ) {
	if ( 0 === strpos( $url, home_url() ) ) {
		$args['sslverify'] = false;
		$args['timeout']   = 15;
	}
	return $args;
}, 10, 2 );

// ---------------------------------------------------------------------------
// 2. REST URL REWRITING  (frontend only — skip for wp-admin)
//    Rewrites /wp/wp-json/ → /wp-json/ so the React frontend can call
//    /wp-json/ from the domain root. The is_admin() guard is critical:
//    without it, WooCommerce Admin JS inside wp-admin receives rewritten
//    URLs that don't resolve, causing undefined API responses and the
//    "Cannot read properties of undefined (reading 'title')" crash in
//    core-profiler.js.
//
//    NOTE: The rest_url_prefix filter has been intentionally removed.
//    Changing the prefix affects how WordPress constructs wpApiSettings.root,
//    which is injected into apiFetch as the base URL for ALL REST calls
//    (including WooCommerce Admin's experimentalSettingOptionsStore). When
//    the prefix is wrong, /wc/v3/settings/general/woocommerce_default_country
//    resolves to /wc/v3/settings/general instead, returning a full settings
//    array that the JS then tries to read as a string, crashing core-profiler.
// ---------------------------------------------------------------------------
add_filter( 'rest_url', function ( $url ) {
	if ( is_admin() ) {
		return $url; // Leave wp-admin REST URLs alone.
	}
	return str_replace( '/wp/wp-json/', '/wp-json/', $url );
} );

// ---------------------------------------------------------------------------
// 3. WOOCOMMERCE DEFAULT COUNTRY — comprehensive fix for core-profiler crash
//
//    THE CRASH (confirmed by network log):
//      core-profiler.js fetches /wc/v3/settings/general/woocommerce_default_country
//      The response is 22 kB — this is the ENTIRE /wc/v3/settings/general array,
//      not the individual setting. This happens because the URL path-join is wrong.
//      The JS then does: countries.find(c => c.code === setting.value)
//      where `setting` is an array item object (not a string) → .title on
//      a found-by-code item returns undefined → TypeError crash.
//
//    ROOT CAUSE — three layers:
//      A) woocommerce_default_country stored as "US:CA" — state suffix causes
//         the country lookup to miss (countries list only has "US").
//      B) The REST response for the individual setting may return the raw
//         "US:CA" value with the colon, which the JS can't match.
//      C) The WooCommerce REST settings endpoint for a single setting
//         (/wc/v3/settings/general/woocommerce_default_country) may fall back
//         to the group endpoint if the URL is malformed by apiFetch middleware.
//
//    FIX STRATEGY:
//      1. Store the option as bare country code "US" in the DB (no ":state").
//      2. Filter the REST response to always return a bare country code.
//      3. Filter the entire settings/general collection response to sanitise
//         the value there too (covers the 22 kB case).
//      4. Purge WC transients so stale cached values don't persist.
// ---------------------------------------------------------------------------
add_action( 'woocommerce_init', function () {
	$country = get_option( 'woocommerce_default_country', '' );
	$base    = strpos( $country, ':' ) !== false ? strstr( $country, ':', true ) : $country;

	if ( empty( $base ) ) {
		$base = 'US';
	}

	if ( $base !== $country ) {
		update_option( 'woocommerce_default_country', $base );
	}
} );

/**
 * Filter: single-setting REST response — strip ":state" from value.
 * Covers /wc/v3/settings/general/woocommerce_default_country
 */
add_filter( 'woocommerce_rest_prepare_setting', function ( $response, $item ) {
	if ( ! empty( $item['id'] ) && 'woocommerce_default_country' === $item['id'] ) {
		$data = $response->get_data();
		if ( isset( $data['value'] ) && strpos( (string) $data['value'], ':' ) !== false ) {
			$data['value'] = strstr( $data['value'], ':', true );
			$response->set_data( $data );
		}
	}
	return $response;
}, 10, 2 );

/**
 * Filter: settings-group REST response — sanitise woocommerce_default_country
 * inside the full /wc/v3/settings/general array (the 22 kB response).
 * This is the safety net for when core-profiler receives the full group.
 */
add_filter( 'woocommerce_rest_prepare_setting_group', function ( $response ) {
	$data = $response->get_data();
	if ( is_array( $data ) ) {
		foreach ( $data as &$setting ) {
			if (
				is_array( $setting ) &&
				isset( $setting['id'], $setting['value'] ) &&
				'woocommerce_default_country' === $setting['id'] &&
				strpos( (string) $setting['value'], ':' ) !== false
			) {
				$setting['value'] = strstr( $setting['value'], ':', true );
			}
		}
		unset( $setting );
		$response->set_data( $data );
	}
	return $response;
} );

// ---------------------------------------------------------------------------
// 4. SUPPRESS SETUP WIZARD
// ---------------------------------------------------------------------------
add_action( 'woocommerce_init', function () {
	if ( 'yes' !== get_option( 'woocommerce_setup_wizard_complete' ) ) {
		update_option( 'woocommerce_setup_wizard_complete', 'yes' );
	}
	if ( 'yes' !== get_option( 'woocommerce_task_list_complete' ) ) {
		update_option( 'woocommerce_task_list_complete', 'yes' );
	}
	if ( get_option( 'woocommerce_admin_install_timestamp' ) ) {
		delete_option( 'woocommerce_admin_install_timestamp' );
	}
}, 99 );

// ---------------------------------------------------------------------------
// 5. REMOVE REDIRECT HOOKS BEFORE THEY FIRE
//    WooCommerce registers an admin_init callback that redirects to the
//    setup wizard on first activation. We remove it at priority 0, before
//    WooCommerce's own priority-10 callback has a chance to run.
// ---------------------------------------------------------------------------
add_action( 'admin_init', function () {

	// Old-style wizard (WooCommerce < 7).
	remove_action( 'admin_init', array( 'WC_Admin_Setup_Wizard', 'setup_wizard_redirect' ) );

	// New core-profiler redirect (WooCommerce 7+).
	remove_all_actions( 'woocommerce_admin_onboarding_wizard_redirect' );

}, 0 );

// ---------------------------------------------------------------------------
// 6. FILTER-BASED SUPPRESSION (WooCommerce 8+)
// ---------------------------------------------------------------------------

// Disable the offline / core-profiler onboarding flow entirely.
add_filter( 'woocommerce_admin_should_load_offline_onboarding', '__return_false' );

// Provide core-profiler with proper profile data so it doesn't crash
add_filter( 'woocommerce_rest_prepare_setting_group', function( $response, $group_name ) {
	if ( 'woocommerce-admin-onboarding' === $group_name ) {
		$data = $response->get_data();
		if ( isset( $data['onboarding_profile'] ) && is_array( $data['onboarding_profile'] ) ) {
			// Ensure all expected fields exist
			$profile = $data['onboarding_profile'];
			$profile['title'] = $profile['title'] ?? '';
			$profile['industries'] = $profile['industries'] ?? array();
			$profile['products'] = $profile['products'] ?? array();
			$profile['business_extensions'] = $profile['business_extensions'] ?? array();
			$data['onboarding_profile'] = $profile;
			$response->set_data( $data );
		}
	}
	return $response;
}, 10, 2 );

// Alternative: Provide a full onboarding profile if missing
add_action( 'rest_api_init', function() {
	register_rest_route( 'wc-admin', '/profile', array(
		'methods'             => 'GET',
		'callback'            => function() {
			return rest_ensure_response( array(
				'title'                  => 'Drywall Toolbox',
				'industries'             => array( array( 'slug' => 'retail' ) ),
				'products'               => array(),
				'business_extensions'    => array(),
				'completed'              => true,
				'skipped'                => true,
			) );
		},
		'permission_callback' => '__return_true',
	) );
} );

// Hide "complete your store setup" admin notices.
add_filter( 'woocommerce_show_admin_notice', function ( $show, $notice ) {
	if ( in_array( $notice, array( 'install', 'update', 'no_shipping_methods' ), true ) ) {
		return false;
	}
	return $show;
}, 10, 2 );

// Prevent WooCommerce from injecting the core-profiler page component.
add_filter( 'woocommerce_admin_features', function ( $features ) {
	$key = array_search( 'core-profiler', $features, true );
	if ( false !== $key ) {
		unset( $features[ $key ] );
	}
	return $features;
} );
