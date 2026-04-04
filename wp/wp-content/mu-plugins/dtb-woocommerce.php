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

// ---------------------------------------------------------------------------
// 7. WEBHOOK AUTO-CREATION  (merged from drywall-webhooks.php)
//
//    On WordPress init, checks the WooCommerce webhooks table for the four
//    product lifecycle webhooks (created / updated / deleted / restored).
//    Any missing webhook is auto-created using WC_Webhook with:
//      - status:       active
//      - delivery URL: DTB_WEBHOOK_DELIVERY_URL (or the production default)
//      - secret:       WC_WEBHOOK_SECRET constant from wp-config.php
// ---------------------------------------------------------------------------
add_action( 'init', 'drywall_ensure_webhooks', 20 );

function drywall_ensure_webhooks(): void {
	if ( ! function_exists( 'wc_get_webhooks' ) || ! class_exists( 'WC_Webhook' ) ) {
		return;
	}

	$config = dtb_get_config();
	$secret = $config['webhook_secret'];

	if ( '' === $secret ) {
		return; // Cannot create functional webhooks without a secret — bail silently.
	}

	$delivery_url    = $config['webhook_delivery'];
	$required_topics = [
		'product.created',
		'product.updated',
		'product.deleted',
		'product.restored',
	];

	$existing_hooks = wc_get_webhooks( [
		'delivery_url' => $delivery_url,
		'return'       => 'ids',
		'limit'        => -1,
	] );

	$registered_topics = [];
	foreach ( $existing_hooks as $hook_id ) {
		$webhook = new WC_Webhook( $hook_id );
		$registered_topics[ $webhook->get_topic() ] = true;
	}

	foreach ( $required_topics as $topic ) {
		if ( isset( $registered_topics[ $topic ] ) ) {
			continue;
		}

		$webhook = new WC_Webhook();
		$webhook->set_name( 'Drywall Cache Invalidation — ' . $topic );
		$webhook->set_topic( $topic );
		$webhook->set_delivery_url( $delivery_url );
		$webhook->set_secret( $secret );
		$webhook->set_status( 'active' );
		$webhook->save();

		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log( '[DryWall Toolbox] Webhook created: ' . $topic );
	}
}

// ---------------------------------------------------------------------------
// 6. CHECKOUT FIELD CUSTOMISATION
//    Strip fields that are not needed by this storefront (Company name and
//    Address Line 2) from both the billing and shipping sections to keep the
//    checkout form lean and match the headless React UI.
// ---------------------------------------------------------------------------
add_filter( 'woocommerce_checkout_fields', function ( $fields ) {
	unset( $fields['billing']['billing_company'] );
	unset( $fields['billing']['billing_address_2'] );
	unset( $fields['shipping']['shipping_company'] );
	unset( $fields['shipping']['shipping_address_2'] );
	return $fields;
} );

// ---------------------------------------------------------------------------
// 7. STRIPE UPE APPEARANCE
//    Pass a custom `appearance` object to the Stripe Elements API so the card
//    UI matches the storefront: Inter font, 12 px border radius, and the site's
//    primary blue (#2563eb / --color-primary-600).
//    Requires the WooCommerce Stripe Gateway plugin ≥ 7.x (UPE mode).
// ---------------------------------------------------------------------------
add_filter( 'wc_stripe_upe_params', function ( $params ) {
	$params['appearance'] = [
		'theme'     => 'flat',
		'variables' => [
			'fontFamily'      => "'Inter', system-ui, sans-serif",
			'fontSizeBase'    => '16px',
			'borderRadius'    => '12px',
			'colorPrimary'    => '#2563eb',  // --color-primary-600
			'colorBackground' => '#ffffff',
			'colorText'       => '#111827',  // gray-900
			'colorDanger'     => '#dc2626',  // red-600
			'spacingUnit'     => '4px',
		],
		'rules'     => [
			'.Input'        => [
				'border'    => '1px solid #e5e7eb',  // gray-200
				'boxShadow' => 'none',
				'padding'   => '12px 16px',
				'fontSize'  => '16px',               // prevent iOS Safari zoom
			],
			'.Input:focus'  => [
				'border'    => '2px solid #2563eb',
				'boxShadow' => '0 0 0 3px rgba(37,99,235,0.12)',
			],
			'.Label'        => [
				'color'         => '#6b7280',  // gray-500
				'fontSize'      => '12px',
				'fontWeight'    => '600',
				'letterSpacing' => '0.05em',
				'textTransform' => 'uppercase',
			],
		],
	];

	return $params;
} );

// ---------------------------------------------------------------------------
// 8. PAYPAL EXPRESS BUTTON PLACEMENT
//    Move the PayPal Payments Express Checkout buttons (Apple Pay / Google
//    Pay / PayPal) above the standard checkout form fields so they are
//    presented first — matching the headless React layout.
//    Requires the WooCommerce PayPal Payments plugin.
// ---------------------------------------------------------------------------
add_action( 'woocommerce_before_checkout_form', function () {
	/**
	 * The PayPal Payments plugin fires its own action to render the Express
	 * Checkout container.  Calling do_action() here re-fires it at priority 5
	 * (before the default checkout form at priority 10), placing the buttons
	 * at the very top of the checkout page.
	 */
	do_action( 'woocommerce_paypal_payments_checkout_button_renderer_hook' );
}, 5 );

// Customise Express button style to match the storefront brand.
add_filter( 'woocommerce_paypal_payments_button_style', function ( $style ) {
	return array_merge( $style, [
		'layout' => 'vertical',
		'shape'  => 'rect',
		'color'  => 'black',
		'label'  => 'pay',
	] );
} );

// ---------------------------------------------------------------------------
// 9. SERVER-SIDE CHECKOUT VALIDATION
//    Additional server-side checks run after WooCommerce's own validation.
//    These complement the client-side checks in the React frontend.
// ---------------------------------------------------------------------------
add_action( 'woocommerce_after_checkout_validation', function ( $data, $errors ) {
	// Require a valid US phone number (10+ digits after stripping non-numeric).
	$phone = preg_replace( '/\D/', '', $data['billing_phone'] ?? '' );
	if ( ! empty( $data['billing_phone'] ) && strlen( $phone ) < 10 ) {
		$errors->add(
			'billing_phone_invalid',
			__( 'Please enter a valid phone number (10 or more digits).', 'woocommerce' )
		);
	}

	// Block orders from known disposable-email domains.
	$blocked_domains = [ 'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwam.com' ];
	$email_parts     = explode( '@', strtolower( $data['billing_email'] ?? '' ) );
	$email_domain    = end( $email_parts );
	if ( in_array( $email_domain, $blocked_domains, true ) ) {
		$errors->add(
			'billing_email_disposable',
			__( 'Please use a permanent email address to place your order.', 'woocommerce' )
		);
	}
}, 10, 2 );
