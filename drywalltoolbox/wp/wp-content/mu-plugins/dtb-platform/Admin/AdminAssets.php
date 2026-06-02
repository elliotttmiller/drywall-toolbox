<?php
/**
 * DTB Admin — AdminAssets
 *
 * Responsible for:
 *  - Detecting current DTB admin page via AdminPageRegistry.
 *  - Enqueuing dtb-admin.css and dtb-admin.js only on DTB pages.
 *  - Conditionally loading ApexCharts on dashboard-template pages.
 *  - Localizing the dtbAdminConfig JS object.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'admin_enqueue_scripts', 'dtb_admin_assets_enqueue' );
add_filter( 'admin_body_class', 'dtb_admin_assets_body_class' );

function dtb_admin_assets_enqueue(): void {
	$page_meta = dtb_current_page_meta();
	$page_slug = sanitize_key( (string) ( $_GET['page'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$is_dtb_slug = '' !== $page_slug && str_starts_with( $page_slug, 'dtb-' );

	if ( ! $page_meta && ! $is_dtb_slug ) {
		return;
	}

	// Fallback runtime metadata for migrated pages if registry lookup failed.
	if ( ! is_array( $page_meta ) ) {
		$page_meta = [
			'slug'     => $page_slug,
			'template' => in_array( $page_slug, [ 'dtb-command-center', 'dtb-system-manager' ], true ) ? 'dashboard' : 'tool',
		];
	}

	$assets_dir = __DIR__ . '/assets/';
	$assets_url = plugin_dir_url( __FILE__ ) . 'assets/';

	// ── Web Fonts (Inter + Plus Jakarta Sans via Bunny Fonts — privacy-respecting CDN) ──
	wp_enqueue_style(
		'dtb-fonts',
		'https://fonts.bunny.net/css?family=inter:400,500,600,700|plus-jakarta-sans:400,500,600,700&display=swap',
		[],
		null
	);

	// ── Shared CSS ──
	$css_file = $assets_dir . 'dtb-admin.css';
	$css_ver  = file_exists( $css_file ) ? (string) filemtime( $css_file ) : '2.0.0';

	wp_enqueue_style(
		'dtb-admin',
		$assets_url . 'dtb-admin.css',
		[ 'dtb-fonts' ],
		$css_ver
	);

	// ── Workbench shared CSS (loads after dtb-admin) ──
	$wb_css_file = $assets_dir . 'dtb-admin-workbench.css';
	if ( file_exists( $wb_css_file ) ) {
		wp_enqueue_style(
			'dtb-admin-workbench',
			$assets_url . 'dtb-admin-workbench.css',
			[ 'dtb-admin' ],
			(string) filemtime( $wb_css_file )
		);
	}

	// ── Shared JS ──
	$js_file = $assets_dir . 'dtb-admin.js';
	$js_ver  = file_exists( $js_file ) ? (string) filemtime( $js_file ) : '2.0.0';

	wp_enqueue_script(
		'dtb-admin',
		$assets_url . 'dtb-admin.js',
		[],
		$js_ver,
		true
	);

	// ── Workbench shared JS (loads after dtb-admin, before module scripts) ──
	$wb_js_file = $assets_dir . 'dtb-admin-workbench.js';
	if ( file_exists( $wb_js_file ) ) {
		wp_enqueue_script(
			'dtb-admin-workbench',
			$assets_url . 'dtb-admin-workbench.js',
			[ 'dtb-admin' ],
			(string) filemtime( $wb_js_file ),
			true
		);
	}

	$current_user = wp_get_current_user();

	// ── Module-specific CSS (keyed by page slug) ──
	$page_slug = $page_meta['slug'] ?? '';

	$module_css_map = [
		'dtb-repairs' => [
			'id'  => 'dtb-repairs-page',
			'dir' => WP_CONTENT_DIR . '/mu-plugins/dtb-repair-service/Admin/assets/',
			'url' => content_url( '/mu-plugins/dtb-repair-service/Admin/assets/' ),
			'file' => 'dtb-repairs-page.css',
		],
		'dtb-support' => [
			'id'  => 'dtb-support-page',
			'dir' => WP_CONTENT_DIR . '/mu-plugins/dtb-support/Admin/assets/',
			'url' => content_url( '/mu-plugins/dtb-support/Admin/assets/' ),
			'file' => 'dtb-support-page.css',
		],
		'dtb-returns' => [
			'id'  => 'dtb-returns-page',
			'dir' => WP_CONTENT_DIR . '/mu-plugins/dtb-returns/Admin/assets/',
			'url' => content_url( '/mu-plugins/dtb-returns/Admin/assets/' ),
			'file' => 'dtb-returns-page.css',
		],
		'dtb-orders' => [
			'id'  => 'dtb-orders-page',
			'dir' => WP_CONTENT_DIR . '/mu-plugins/dtb-commerce/Admin/assets/',
			'url' => content_url( '/mu-plugins/dtb-commerce/Admin/assets/' ),
			'file' => 'dtb-orders-page.css',
		],
	];

	if ( isset( $module_css_map[ $page_slug ] ) ) {
		$mod      = $module_css_map[ $page_slug ];
		$mod_file = $mod['dir'] . $mod['file'];
		$mod_ver  = file_exists( $mod_file ) ? (string) filemtime( $mod_file ) : '1.0.0';

		// Build CSS deps: always dtb-admin; add workbench if file exists.
		$css_deps = [ 'dtb-admin' ];
		if ( file_exists( $assets_dir . 'dtb-admin-workbench.css' ) ) {
			$css_deps[] = 'dtb-admin-workbench';
		}

		wp_enqueue_style(
			$mod['id'],
			$mod['url'] . $mod['file'],
			$css_deps,
			$mod_ver
		);
	}

	// ── Module-specific JS (keyed by page slug) ──
	$module_js_map = [
		'dtb-support' => [
			'id'   => 'dtb-support-page-script',
			'dir'  => WP_CONTENT_DIR . '/mu-plugins/dtb-support/Admin/assets/',
			'url'  => content_url( '/mu-plugins/dtb-support/Admin/assets/' ),
			'file' => 'dtb-support-page.js',
		],
		'dtb-returns' => [
			'id'   => 'dtb-returns-page-script',
			'dir'  => WP_CONTENT_DIR . '/mu-plugins/dtb-returns/Admin/assets/',
			'url'  => content_url( '/mu-plugins/dtb-returns/Admin/assets/' ),
			'file' => 'dtb-returns-page.js',
		],
		'dtb-repairs' => [
			'id'   => 'dtb-repairs-page-script',
			'dir'  => WP_CONTENT_DIR . '/mu-plugins/dtb-repair-service/Admin/assets/',
			'url'  => content_url( '/mu-plugins/dtb-repair-service/Admin/assets/' ),
			'file' => 'dtb-repairs-page.js',
		],
	];

	if ( isset( $module_js_map[ $page_slug ] ) ) {
		$mod_js      = $module_js_map[ $page_slug ];
		$mod_js_file = $mod_js['dir'] . $mod_js['file'];
		$mod_js_ver  = file_exists( $mod_js_file ) ? (string) filemtime( $mod_js_file ) : '1.0.0';

		if ( file_exists( $mod_js_file ) ) {
			// Build deps: always include dtb-admin; add workbench if it was enqueued.
			$js_deps = [ 'dtb-admin' ];
			if ( wp_script_is( 'dtb-admin-workbench', 'enqueued' ) ) {
				$js_deps[] = 'dtb-admin-workbench';
			}

			wp_enqueue_script(
				$mod_js['id'],
				$mod_js['url'] . $mod_js['file'],
				$js_deps,
				$mod_js_ver,
				true
			);
		}
	}

	// ── Shared hardening stylesheet for inline-legacy Tool Library pages ──
	$legacy_tool_pages = [
		'dtb-parts-manager',
		'dtb-product-mapping',
		'dtb-schematics',
	];
	if ( in_array( $page_slug, $legacy_tool_pages, true ) ) {
		$tools_file = $assets_dir . 'dtb-tool-library-modern.css';
		if ( file_exists( $tools_file ) ) {
			wp_enqueue_style(
				'dtb-tool-library-modern',
				$assets_url . 'dtb-tool-library-modern.css',
				[ 'dtb-admin' ],
				(string) filemtime( $tools_file )
			);
		}
	}

	// ── ApexCharts (dashboard pages only) ──
	if ( in_array( $page_meta['template'] ?? '', [ 'dashboard' ], true ) ) {
		$apex_file = $assets_dir . 'vendor/apexcharts.min.js';
		$apex_ver  = file_exists( $apex_file ) ? (string) filemtime( $apex_file ) : '3.44.0';

		if ( file_exists( $apex_file ) ) {
			wp_enqueue_script(
				'dtb-apexcharts',
				$assets_url . 'vendor/apexcharts.min.js',
				[],
				$apex_ver,
				true
			);
		}
	}

	// ── Localized config ──
	wp_localize_script(
		'dtb-admin',
		'dtbAdminConfig',
		[
			'restUrl'         => esc_url_raw( rest_url() ),
			'ajaxUrl'         => admin_url( 'admin-ajax.php' ),
			'nonce'           => wp_create_nonce( 'wp_rest' ),
			'adminUrl'        => admin_url( 'admin.php' ),
			'currentUserId'   => get_current_user_id(),
			'currentUserName' => $current_user->display_name,
			'currencySymbol'  => get_woocommerce_currency_symbol(),
			'siteName'        => get_bloginfo( 'name' ),
			'page'            => $page_meta,
			'capabilities'    => dtb_admin_assets_cap_map(),
			'featureFlags'    => dtb_admin_assets_feature_flags(),
		]
	);
}

/**
 * Add a stable body class while rendering DTB admin pages.
 *
 * This lets the shared stylesheet modernize the surrounding wp-admin chrome
 * without leaking those overrides into unrelated WordPress screens.
 *
 * @param string $classes Existing admin body class string.
 * @return string
 */
function dtb_admin_assets_body_class( string $classes ): string {
	$page_meta = dtb_current_page_meta();
	$page_slug = sanitize_key( (string) ( $_GET['page'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	$is_dtb_slug = '' !== $page_slug && str_starts_with( $page_slug, 'dtb-' );

	if ( $page_meta || $is_dtb_slug ) {
		$classes .= ' dtb-admin-screen';
	}

	return $classes;
}

/**
 * Build a capability map for JavaScript UI toggle decisions.
 *
 * @return array<string, bool>
 */
function dtb_admin_assets_cap_map(): array {
	$caps = dtb_admin_all_capabilities();
	$map  = [];

	foreach ( $caps as $cap ) {
		$map[ $cap ] = current_user_can( $cap );
	}

	return $map;
}

/**
 * Expose feature flags to JavaScript.
 *
 * @return array<string, bool>
 */
function dtb_admin_assets_feature_flags(): array {
	return [
		'adminV2'        => (bool) dtb_feature_enabled( 'DTB_ADMIN_V2_ENABLED', true ),
		'commandCenter'  => (bool) dtb_feature_enabled( 'DTB_COMMAND_CENTER_ENABLED', true ),
		'systemManager'  => (bool) dtb_feature_enabled( 'DTB_SYSTEM_MANAGER_ENABLED', true ),
		'returns'        => (bool) dtb_feature_enabled( 'DTB_RETURNS_ENABLED', true ),
		'modernizedUi'   => (bool) dtb_feature_enabled( 'DTB_MODERNIZED_UI_ENABLED', true ),
	];
}
