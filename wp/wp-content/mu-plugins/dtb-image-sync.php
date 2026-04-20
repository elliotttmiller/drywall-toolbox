<?php
/**
 * Plugin Name: DTB Image Sync
 * Description: Registers pre-placed product images into the WordPress Media
 *              Library and links them to WooCommerce products by SKU.
 *              Uses only public WP/WC APIs. Safe for HostGator shared hosting.
 * Version: 2.0.0
 * Author: Drywall Toolbox
 *
 * Must-use plugin: wp/wp-content/mu-plugins/dtb-image-sync.php
 * Loaded by: 00-dtb-loader.php (after dtb-utils.php and dtb-auth.php)
 *
 * ── DESIGN DECISIONS ────────────────────────────────────────────────────────
 *
 * Attachment lookup: attachment_url_to_postid() [official WP API, WP 4.0+]
 *   Uses the indexed _wp_attached_file meta column for lookups.
 *   Faster and more reliable than a guid LIKE query on large catalogs.
 *
 * Sub-size generation: _wp_make_subsizes() via wp_update_image_subsizes()
 *   wp_update_image_subsizes() [WP 5.3+] is the public API that calls
 *   _wp_make_subsizes() internally. It skips sizes already generated
 *   (fully idempotent), does NOT call wp_unique_filename() on the source
 *   file under any code path, and saves metadata after each crop.
 *   Using this over wp_generate_attachment_metadata() avoids the known
 *   Trac #44095 bug where WP renames the source file on disk.
 *
 * Product image linking: WC_Product API
 *   Uses WC_Product->set_image_id() and WC_Product->set_gallery_image_ids()
 *   instead of raw set_post_thumbnail() / update_post_meta(). This fires
 *   all WooCommerce action hooks (woocommerce_product_set_image etc.) and
 *   ensures WC object caches are properly updated.
 *
 * Attachment parent: set to the product post ID
 *   Sets post_parent on each attachment record so WP Admin Media Library
 *   shows "Attached to: [Product Name]" rather than "Unattached".
 *
 * Sync lock: transient-based mutex (dtb_image_sync_lock)
 *   Prevents concurrent sync runs which corrupt gallery meta on shared
 *   hosting where multiple PHP processes can be in flight simultaneously.
 *
 * SKU normalisation: lower-case + hyphen/underscore equivalence
 *   Checks sku, UPPER(sku), and a hyphen↔underscore swap variant to
 *   tolerate common filename→SKU mismatches (e.g. "tc-01_tt" vs "TC-01TT").
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// ============================================================================
// CONSTANTS
// ============================================================================

/** Transient key used as a mutex to prevent concurrent sync runs. */
define( 'DTB_SYNC_LOCK_KEY',    'dtb_image_sync_lock' );

/** Transient key that stores the running sync progress for resumable batches. */
define( 'DTB_SYNC_PROGRESS_KEY', 'dtb_image_sync_progress' );

/** Lock TTL in seconds — auto-expires to prevent a dead lock on crashes. */
define( 'DTB_SYNC_LOCK_TTL', 600 );

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

add_action( 'rest_api_init', 'dtb_image_sync_register_routes', 10 );

function dtb_image_sync_register_routes(): void {
	$ns = defined( 'DTB_API_NAMESPACE' ) ? DTB_API_NAMESPACE : 'dtb/v1';

	// Shared year/month args used across multiple routes.
	$dir_args = [
		'year'  => [
			'required'          => false,
			'default'           => gmdate( 'Y' ),
			'sanitize_callback' => 'sanitize_text_field',
			'validate_callback' => fn( $v ) => ctype_digit( ltrim( (string) $v, '/' ) ),
			'description'       => 'Year folder in wp-content/uploads/. Defaults to current year.',
		],
		'month' => [
			'required'          => false,
			'default'           => gmdate( 'm' ),
			'sanitize_callback' => 'sanitize_text_field',
			'validate_callback' => fn( $v ) => ctype_digit( ltrim( (string) $v, '/' ) ),
			'description'       => 'Zero-padded month folder. Defaults to current month.',
		],
	];

	// POST /dtb/v1/sync-images
	register_rest_route( $ns, '/sync-images', [
		'methods'             => 'POST',
		'callback'            => 'dtb_route_sync_images',
		'permission_callback' => 'dtb_image_sync_permission',
		'args'                => array_merge( $dir_args, [
			'dry_run' => [
				'required'          => false,
				'default'           => false,
				'sanitize_callback' => 'rest_sanitize_boolean',
				'description'       => 'When true, scan and report without writing to the database.',
			],
			'limit'   => [
				'required'          => false,
				'default'           => 0,
				'sanitize_callback' => 'absint',
				'description'       => 'Max SKUs to process. 0 = all. Use with offset for batching.',
			],
			'offset'  => [
				'required'          => false,
				'default'           => 0,
				'sanitize_callback' => 'absint',
				'description'       => 'Number of SKUs to skip. Use with limit for batching.',
			],
			'force'   => [
				'required'          => false,
				'default'           => false,
				'sanitize_callback' => 'rest_sanitize_boolean',
				'description'       => 'When true, re-register and re-link already-synced images.',
			],
		] ),
	] );

	// GET /dtb/v1/sync-images/status
	register_rest_route( $ns, '/sync-images/status', [
		'methods'             => 'GET',
		'callback'            => 'dtb_route_sync_images_status',
		'permission_callback' => 'dtb_image_sync_permission',
		'args'                => $dir_args,
	] );

	// GET /dtb/v1/sync-images/progress
	register_rest_route( $ns, '/sync-images/progress', [
		'methods'             => 'GET',
		'callback'            => 'dtb_route_sync_images_progress',
		'permission_callback' => 'dtb_image_sync_permission',
	] );

	// POST /dtb/v1/sync-images/reset — DESTRUCTIVE, dry_run=true by default
	register_rest_route( $ns, '/sync-images/reset', [
		'methods'             => 'POST',
		'callback'            => 'dtb_route_reset_images',
		'permission_callback' => 'dtb_image_sync_permission',
		'args'                => array_merge( $dir_args, [
			'dry_run' => [
				'required'          => false,
				'default'           => true,
				'sanitize_callback' => 'rest_sanitize_boolean',
				'description'       => 'Default TRUE. Pass false to actually execute.',
			],
		] ),
	] );

	// POST /dtb/v1/sync-images/purge-unlinked — DESTRUCTIVE, dry_run=true by default
	register_rest_route( $ns, '/sync-images/purge-unlinked', [
		'methods'             => 'POST',
		'callback'            => 'dtb_route_purge_unlinked_attachments',
		'permission_callback' => 'dtb_image_sync_permission',
		'args'                => array_merge( $dir_args, [
			'dry_run' => [
				'required'          => false,
				'default'           => true,
				'sanitize_callback' => 'rest_sanitize_boolean',
				'description'       => 'Default TRUE. Pass false to actually delete.',
			],
			'limit'  => [
				'required'          => false,
				'default'           => 500,
				'sanitize_callback' => 'absint',
			],
			'offset' => [
				'required'          => false,
				'default'           => 0,
				'sanitize_callback' => 'absint',
			],
		] ),
	] );

	// POST /dtb/v1/sync-images/fix-renamed
	register_rest_route( $ns, '/sync-images/fix-renamed', [
		'methods'             => 'POST',
		'callback'            => 'dtb_route_fix_renamed_files',
		'permission_callback' => 'dtb_image_sync_permission',
		'args'                => array_merge( $dir_args, [
			'dry_run' => [
				'required'          => false,
				'default'           => true,
				'sanitize_callback' => 'rest_sanitize_boolean',
				'description'       => 'Default TRUE. Pass false to actually rename.',
			],
		] ),
	] );

	// POST /dtb/v1/sync-images/release-lock
	// Emergency endpoint to clear a stuck sync lock without waiting for TTL.
	register_rest_route( $ns, '/sync-images/release-lock', [
		'methods'             => 'POST',
		'callback'            => function () {
			delete_transient( DTB_SYNC_LOCK_KEY );
			delete_transient( DTB_SYNC_PROGRESS_KEY );
			return rest_ensure_response( [ 'released' => true ] );
		},
		'permission_callback' => 'dtb_image_sync_permission',
	] );
}

// ============================================================================
// PERMISSION CALLBACK
// ============================================================================

/**
 * Accepts either:
 *   A) A WP Application Password session with manage_woocommerce capability.
 *   B) A valid DTB JWT cookie/header via dtb_jwt_permission() (dtb-auth.php).
 *
 * WP REST passes the current WP_REST_Request object as the first argument to
 * every permission_callback automatically — we forward it to dtb_jwt_permission().
 */
function dtb_image_sync_permission( WP_REST_Request $request ): bool {
	// Fast path: WP session already authenticated (e.g. wp-admin browser request).
	if ( is_user_logged_in() && current_user_can( 'manage_woocommerce' ) ) {
		return true;
	}

	// JWT path: validate the token, then check roles embedded in the payload.
	// We do NOT rely on current_user_can() here because wp_set_current_user()
	// is never called for JWT-only requests — the WP session remains anonymous.
	// dtb_verify_jwt() returns the decoded payload object (with ->roles) on
	// success, so we read the role directly from the token claims.
	if ( function_exists( 'dtb_verify_jwt' ) ) {
		// Re-extract the raw token the same way dtb_jwt_permission does.
		$token = null;

		if ( ! empty( $_COOKIE['dtb_auth'] ) ) {
			$token = sanitize_text_field( wp_unslash( $_COOKIE['dtb_auth'] ) );
		}

		if ( ! $token ) {
			$auth = $request->get_header( 'authorization' );

			if ( ! $auth && ! empty( $_SERVER['HTTP_AUTHORIZATION'] ) ) {
				$auth = sanitize_text_field( wp_unslash( $_SERVER['HTTP_AUTHORIZATION'] ) );
			}
			if ( ! $auth && ! empty( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) ) {
				$auth = sanitize_text_field( wp_unslash( $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ) );
			}

			if ( $auth && preg_match( '/^Bearer\s+(\S+)$/i', $auth, $m ) ) {
				$token = $m[1];
			}
		}

		if ( $token ) {
			$payload = dtb_verify_jwt( $token );
			if ( ! is_wp_error( $payload ) ) {
				$roles = isset( $payload->roles ) ? (array) $payload->roles : [];
				// Allowed roles: administrator, shop_manager, or any role with manage_woocommerce.
				$allowed = [ 'administrator', 'shop_manager' ];
				if ( array_intersect( $allowed, $roles ) ) {
					return true;
				}
			}
		}
	}

	return false;
}

// ============================================================================
// POST /dtb/v1/sync-images
// ============================================================================

/**
 * Main sync route. Scans uploads/<year>/<month>/, registers image files as WP
 * attachments, and links each to its WooCommerce product by SKU.
 *
 * Sync strategy (SKU-first):
 *   1. Load all product SKUs from the DB in one indexed query.
 *   2. For each SKU, probe for {sku}.{ext} (primary) and
 *      {sku}_01.{ext} … {sku}_20.{ext} (gallery) on disk.
 *   3. Register any unregistered files via dtb_register_image_attachment().
 *   4. Link thumbnail + gallery to each product via the WC_Product API.
 *   5. Flush WC product transients so REST responses reflect new images.
 */
function dtb_route_sync_images( WP_REST_Request $request ): WP_REST_Response|WP_Error {

	// ── Acquire sync lock ────────────────────────────────────────────────────
	if ( get_transient( DTB_SYNC_LOCK_KEY ) ) {
		return new WP_Error(
			'sync_locked',
			'A sync is already in progress. Use /release-lock if the previous run crashed.',
			[ 'status' => 423 ]
		);
	}
	set_transient( DTB_SYNC_LOCK_KEY, true, DTB_SYNC_LOCK_TTL );

	// ── Raise execution limits (best-effort on shared hosting) ──────────────
	if ( function_exists( 'ini_set' ) ) {
		ini_set( 'memory_limit', '512M' ); // phpcs:ignore
	}
	if ( function_exists( 'set_time_limit' ) ) {
		set_time_limit( 300 ); // phpcs:ignore
	}

	$year    = ltrim( (string) $request->get_param( 'year' ),  '/' );
	$month   = ltrim( (string) $request->get_param( 'month' ), '/' );
	$dry_run = (bool) $request->get_param( 'dry_run' );
	$force   = (bool) $request->get_param( 'force' );
	$offset  = (int) $request->get_param( 'offset' );
	$limit   = (int) $request->get_param( 'limit' );

	$upload_dir = wp_upload_dir();
	$scan_dir   = trailingslashit( $upload_dir['basedir'] ) . "$year/$month";
	$scan_url   = trailingslashit( $upload_dir['baseurl'] ) . "$year/$month";

	// ── Validate path (prevent directory traversal) ─────────────────────────
	$real_scan = realpath( $scan_dir );
	$real_base = realpath( $upload_dir['basedir'] );
	if ( ! $real_scan || ! $real_base || strncmp( $real_scan, $real_base, strlen( $real_base ) ) !== 0 ) {
		delete_transient( DTB_SYNC_LOCK_KEY );
		return new WP_Error( 'invalid_path', 'Resolved path is outside the uploads directory.', [ 'status' => 400 ] );
	}

	if ( ! is_dir( $scan_dir ) ) {
		delete_transient( DTB_SYNC_LOCK_KEY );
		return new WP_Error( 'dir_not_found', "Directory not found: wp-content/uploads/$year/$month", [ 'status' => 404 ] );
	}

	// ── Load WP admin image functions ────────────────────────────────────────
	if ( ! function_exists( 'wp_update_image_subsizes' ) ) {
		require_once ABSPATH . 'wp-admin/includes/image.php';
	}
	if ( ! function_exists( 'wp_read_image_metadata' ) ) {
		require_once ABSPATH . 'wp-admin/includes/media.php';
	}

	// ── Fetch all product SKUs in one query ──────────────────────────────────
	global $wpdb;
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$sku_rows = $wpdb->get_results(
		"SELECT p.ID AS product_id, pm.meta_value AS sku
		 FROM {$wpdb->posts} p
		 INNER JOIN {$wpdb->postmeta} pm
		         ON pm.post_id  = p.ID
		        AND pm.meta_key = '_sku'
		 WHERE p.post_type   = 'product'
		   AND p.post_status != 'trash'
		   AND pm.meta_value != ''
		 ORDER BY p.ID ASC",
		ARRAY_A
	);

	$sku_map = [];
	foreach ( $sku_rows as $row ) {
		$sku_map[ strtolower( trim( $row['sku'] ) ) ] = (int) $row['product_id'];
	}

	$total    = count( $sku_map );
	$sku_keys = array_keys( $sku_map );
	$batch    = ( $limit > 0 )
		? array_slice( $sku_keys, $offset, $limit )
		: array_slice( $sku_keys, $offset );

	$extensions = [ 'webp', 'jpg', 'jpeg', 'png', 'avif', 'gif' ];

	$registered     = 0;
	$linked         = 0;
	$skipped        = 0;
	$no_file        = 0;
	$gallery_images = 0;
	$errors         = [];

	foreach ( $batch as $sku_lower ) {
		$product_id = $sku_map[ $sku_lower ];

		// ── Probe for primary image: {sku}.{ext} ────────────────────────────
		[ $primary_path, $primary_url ] = dtb_probe_image( $scan_dir, $scan_url, $sku_lower, $extensions );

		// ── Probe for gallery images: {sku}_01.{ext} … {sku}_20.{ext} ───────
		$gallery_pairs = [];
		for ( $i = 1; $i <= 20; $i++ ) {
			$suffix = '_' . str_pad( (string) $i, 2, '0', STR_PAD_LEFT );
			[ $gpath, $gurl ] = dtb_probe_image( $scan_dir, $scan_url, $sku_lower . $suffix, $extensions );
			if ( $gpath ) {
				$gallery_pairs[] = [ 'path' => $gpath, 'url' => $gurl ];
			}
		}

		// ── Fallback: glob for {sku}_{hash}.{ext} (e.g. Platinum pt-10fb_7316520b.webp) ──
		// If neither an exact primary nor numeric gallery were found, scan the
		// directory for any file whose stem matches /^{sku}_[0-9a-f]{6,}$/i.
		// The first sorted match becomes primary; the rest become gallery images.
		if ( ! $primary_path && empty( $gallery_pairs ) ) {
			$hash_matches = dtb_probe_image_hash_variants( $scan_dir, $scan_url, $sku_lower, $extensions );
			if ( ! empty( $hash_matches ) ) {
				$first         = array_shift( $hash_matches );
				$primary_path  = $first['path'];
				$primary_url   = $first['url'];
				$gallery_pairs = $hash_matches; // remaining = gallery
			}
		}

		if ( ! $primary_path ) {
			++$no_file;
			continue;
		}

		if ( $dry_run ) {
			$exists = attachment_url_to_postid( $primary_url );
			$exists ? ++$skipped : ++$registered;
			++$linked;
			$gallery_images += count( $gallery_pairs );
			continue;
		}

		// ── Register primary attachment ──────────────────────────────────────
		$primary_att = attachment_url_to_postid( $primary_url );
		if ( ! $primary_att || $force ) {
			$primary_att = dtb_register_image_attachment( $primary_path, $primary_url, $product_id );
			if ( is_wp_error( $primary_att ) ) {
				$errors[] = "[{$sku_lower}] primary: " . $primary_att->get_error_message();
				dtb_image_sync_log( "image_sync primary error [{$sku_lower}]: " . $primary_att->get_error_message() );
				continue;
			}
			++$registered;
		} else {
			// Update post_parent in case it was registered without a parent before.
			wp_update_post( [ 'ID' => $primary_att, 'post_parent' => $product_id ] );
			++$skipped;
		}

		// ── Register gallery attachments ─────────────────────────────────────
		$gallery_att_ids = [];
		foreach ( $gallery_pairs as $pair ) {
			$gatt = attachment_url_to_postid( $pair['url'] );
			if ( ! $gatt || $force ) {
				$gatt = dtb_register_image_attachment( $pair['path'], $pair['url'], $product_id );
				if ( is_wp_error( $gatt ) ) {
					$errors[] = "[{$sku_lower}] gallery: " . $gatt->get_error_message();
					dtb_image_sync_log( "image_sync gallery error [{$sku_lower}]: " . $gatt->get_error_message() );
					continue;
				}
				++$registered;
				++$gallery_images;
			} else {
				wp_update_post( [ 'ID' => $gatt, 'post_parent' => $product_id ] );
			}
			$gallery_att_ids[] = (int) $gatt;
		}

		// ── Link images to product via WC_Product API ────────────────────────
		$result = dtb_link_images_to_product( $product_id, (int) $primary_att, $gallery_att_ids );
		if ( is_wp_error( $result ) ) {
			$errors[] = "[{$sku_lower}] link: " . $result->get_error_message();
			dtb_image_sync_log( "image_sync link error [{$sku_lower}]: " . $result->get_error_message() );
			continue;
		}
		++$linked;

		// ── Update progress for resumable batches ────────────────────────────
		set_transient( DTB_SYNC_PROGRESS_KEY, [
			'last_sku'       => $sku_lower,
			'last_product'   => $product_id,
			'registered'     => $registered,
			'linked'         => $linked,
			'no_file'        => $no_file,
			'errors'         => count( $errors ),
			'updated_at'     => gmdate( 'c' ),
		], DTB_SYNC_LOCK_TTL );
	}

	// ── Bump WC product cache version so REST responses reflect new images ──
	if ( ! $dry_run && class_exists( 'WC_Cache_Helper' ) ) {
		WC_Cache_Helper::get_transient_version( 'product', true );
	}

	delete_transient( DTB_SYNC_LOCK_KEY );
	delete_transient( DTB_SYNC_PROGRESS_KEY );

	return rest_ensure_response( [
		'status'         => $dry_run ? 'dry_run' : 'completed',
		'directory'      => "wp-content/uploads/$year/$month",
		'total_skus'     => $total,
		'offset'         => $offset,
		'limit'          => $limit,
		'scanned'        => count( $batch ),
		'registered'     => $registered,
		'linked'         => $linked,
		'skipped'        => $skipped,
		'no_file'        => $no_file,
		'gallery_images' => $gallery_images,
		'errors'         => $errors,
		'dry_run'        => $dry_run,
		'next_offset'    => ( $limit > 0 && ( $offset + $limit ) < $total )
			? $offset + $limit
			: null,
	] );
}

// ============================================================================
// GET /dtb/v1/sync-images/progress
// ============================================================================

function dtb_route_sync_images_progress(): WP_REST_Response {
	$lock     = (bool) get_transient( DTB_SYNC_LOCK_KEY );
	$progress = get_transient( DTB_SYNC_PROGRESS_KEY );
	return rest_ensure_response( [
		'locked'   => $lock,
		'progress' => $progress ?: null,
	] );
}

// ============================================================================
// GET /dtb/v1/sync-images/status
// ============================================================================

function dtb_route_sync_images_status( WP_REST_Request $request ): WP_REST_Response {
	$year  = ltrim( sanitize_text_field( (string) ( $request->get_param( 'year' )  ?? gmdate( 'Y' ) ) ), '/' );
	$month = ltrim( sanitize_text_field( (string) ( $request->get_param( 'month' ) ?? gmdate( 'm' ) ) ), '/' );

	$upload_dir = wp_upload_dir();
	$scan_dir   = trailingslashit( $upload_dir['basedir'] ) . "$year/$month";
	$base_url   = trailingslashit( $upload_dir['baseurl'] ) . "$year/$month/";

	$dir_exists     = is_dir( $scan_dir );
	$image_exts     = [ 'webp', 'jpg', 'jpeg', 'png', 'avif', 'gif', 'svg' ];
	$files_on_disk  = $dir_exists ? dtb_list_images_in_dir( $scan_dir, $image_exts ) : [];

	global $wpdb;

	// Attachments registered from this directory (indexed _wp_attached_file path).
	$relative_prefix = $wpdb->esc_like( "$year/$month/" );
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$registered_count = (int) $wpdb->get_var( $wpdb->prepare(
		"SELECT COUNT(*) FROM {$wpdb->postmeta}
		 WHERE meta_key = '_wp_attached_file'
		   AND meta_value LIKE %s",
		$relative_prefix . '%'
	) );

	// Products with a thumbnail from this directory.
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$linked_count = (int) $wpdb->get_var( $wpdb->prepare(
		"SELECT COUNT(DISTINCT p.ID)
		 FROM {$wpdb->posts} p
		 INNER JOIN {$wpdb->postmeta} thumb ON thumb.post_id  = p.ID
		                                   AND thumb.meta_key  = '_thumbnail_id'
		 INNER JOIN {$wpdb->postmeta} af    ON af.post_id      = CAST(thumb.meta_value AS UNSIGNED)
		                                   AND af.meta_key     = '_wp_attached_file'
		 WHERE p.post_type = 'product'
		   AND af.meta_value LIKE %s",
		$relative_prefix . '%'
	) );

	// Products with gallery images from this directory.
	// Uses a JOIN on a normalised gallery table to avoid slow FIND_IN_SET.
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$gallery_product_count = (int) $wpdb->get_var( $wpdb->prepare(
		"SELECT COUNT(DISTINCT p.ID)
		 FROM {$wpdb->posts} p
		 INNER JOIN {$wpdb->postmeta} gm ON gm.post_id = p.ID
		                                AND gm.meta_key = '_product_image_gallery'
		 INNER JOIN {$wpdb->posts} ga     ON FIND_IN_SET(ga.ID, gm.meta_value) > 0
		                                AND ga.post_type = 'attachment'
		 INNER JOIN {$wpdb->postmeta} af  ON af.post_id  = ga.ID
		                                AND af.meta_key  = '_wp_attached_file'
		 WHERE p.post_type    = 'product'
		   AND gm.meta_value != ''
		   AND af.meta_value LIKE %s",
		$relative_prefix . '%'
	) );

	return rest_ensure_response( [
		'directory'           => "wp-content/uploads/$year/$month",
		'dir_exists'          => $dir_exists,
		'files_on_disk'       => count( $files_on_disk ),
		'registered_in_db'    => $registered_count,
		'linked_products'     => $linked_count,
		'gallery_products'    => $gallery_product_count,
		'sync_locked'         => (bool) get_transient( DTB_SYNC_LOCK_KEY ),
	] );
}

// ============================================================================
// POST /dtb/v1/sync-images/reset — DESTRUCTIVE
// ============================================================================

/**
 * Full clean-slate reset.
 *   1. Delete every attachment whose _wp_attached_file points to uploads/<year>/<month>/.
 *      wp_delete_attachment(force=true) also removes generated sub-size files from disk.
 *   2. Clear _thumbnail_id and _product_image_gallery from every product.
 *   3. Bump WC product cache version.
 *
 * dry_run=true (default) — reports what would be done without executing.
 */
function dtb_route_reset_images( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	if ( function_exists( 'ini_set' ) ) {
		ini_set( 'memory_limit', '512M' ); // phpcs:ignore
	}
	if ( function_exists( 'set_time_limit' ) ) {
		set_time_limit( 300 ); // phpcs:ignore
	}

	$year    = ltrim( sanitize_text_field( (string) $request->get_param( 'year' ) ),  '/' );
	$month   = ltrim( sanitize_text_field( (string) $request->get_param( 'month' ) ), '/' );
	$dry_run = (bool) $request->get_param( 'dry_run' );

	if ( ! ctype_digit( $year ) || ! ctype_digit( $month ) ) {
		return new WP_Error( 'invalid_params', 'year and month must be numeric.', [ 'status' => 400 ] );
	}

	global $wpdb;
	$relative_prefix = $wpdb->esc_like( "$year/$month/" );

	// Find ALL attachments from this directory via indexed _wp_attached_file meta.
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$attachment_ids = $wpdb->get_col( $wpdb->prepare(
		"SELECT DISTINCT post_id
		 FROM {$wpdb->postmeta}
		 WHERE meta_key = '_wp_attached_file'
		   AND meta_value LIKE %s
		 ORDER BY post_id ASC",
		$relative_prefix . '%'
	) );

	$total_attachments = count( $attachment_ids );
	$deleted_atts      = 0;
	$errors            = [];

	if ( ! $dry_run ) {
		foreach ( $attachment_ids as $att_id ) {
			$result = wp_delete_attachment( (int) $att_id, true );
			if ( false !== $result ) {
				++$deleted_atts;
			} else {
				$errors[] = "Failed to delete attachment ID {$att_id}";
			}
		}

		// Clear _thumbnail_id and _product_image_gallery from all products.
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
		$product_ids = $wpdb->get_col(
			"SELECT DISTINCT ID FROM {$wpdb->posts}
			 WHERE post_type = 'product' AND post_status != 'trash'"
		);

		foreach ( $product_ids as $pid ) {
			delete_post_meta( (int) $pid, '_thumbnail_id' );
			delete_post_meta( (int) $pid, '_product_image_gallery' );
			clean_post_cache( (int) $pid );
			if ( function_exists( 'wc_delete_product_transients' ) ) {
				wc_delete_product_transients( (int) $pid );
			}
		}

		if ( class_exists( 'WC_Cache_Helper' ) ) {
			WC_Cache_Helper::get_transient_version( 'product', true );
		}

		dtb_image_sync_log( "image_sync reset: deleted {$deleted_atts} attachments from uploads/{$year}/{$month}" );
	}

	return rest_ensure_response( [
		'status'            => $dry_run ? 'dry_run' : 'completed',
		'directory'         => "wp-content/uploads/$year/$month",
		'dry_run'           => $dry_run,
		'total_attachments' => $total_attachments,
		'deleted_atts'      => $dry_run ? 0 : $deleted_atts,
		'errors'            => $errors,
	] );
}

// ============================================================================
// POST /dtb/v1/sync-images/purge-unlinked — DESTRUCTIVE
// ============================================================================

/**
 * Delete attachment records from uploads/<year>/<month>/ that are not set as
 * the _thumbnail_id or in _product_image_gallery of any product.
 *
 * Uses a JOIN-based query instead of FIND_IN_SET for better performance on
 * large catalogs. dry_run=true by default.
 */
function dtb_route_purge_unlinked_attachments( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	if ( function_exists( 'ini_set' ) ) {
		ini_set( 'memory_limit', '512M' ); // phpcs:ignore
	}
	if ( function_exists( 'set_time_limit' ) ) {
		set_time_limit( 120 ); // phpcs:ignore
	}

	$year    = ltrim( sanitize_text_field( (string) $request->get_param( 'year' ) ),  '/' );
	$month   = ltrim( sanitize_text_field( (string) $request->get_param( 'month' ) ), '/' );
	$dry_run = (bool) $request->get_param( 'dry_run' );
	$limit   = max( 1, (int) $request->get_param( 'limit' ) );
	$offset  = (int) $request->get_param( 'offset' );

	if ( ! ctype_digit( $year ) || ! ctype_digit( $month ) ) {
		return new WP_Error( 'invalid_params', 'year and month must be numeric.', [ 'status' => 400 ] );
	}

	global $wpdb;
	$relative_prefix = $wpdb->esc_like( "$year/$month/" );

	// All attachments from this directory.
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$all_ids = $wpdb->get_col( $wpdb->prepare(
		"SELECT DISTINCT post_id
		 FROM {$wpdb->postmeta}
		 WHERE meta_key = '_wp_attached_file'
		   AND meta_value LIKE %s
		 ORDER BY post_id ASC",
		$relative_prefix . '%'
	) );

	if ( empty( $all_ids ) ) {
		return rest_ensure_response( [
			'status'         => 'completed',
			'total_unlinked' => 0,
			'deleted'        => 0,
			'dry_run'        => $dry_run,
		] );
	}

	// Thumbnails in use.
	$id_list = implode( ',', array_map( 'intval', $all_ids ) );
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$thumbnail_ids = $wpdb->get_col(
		"SELECT DISTINCT CAST(meta_value AS UNSIGNED)
		 FROM {$wpdb->postmeta}
		 WHERE meta_key   = '_thumbnail_id'
		   AND CAST(meta_value AS UNSIGNED) IN ({$id_list})" // phpcs:ignore
	);

	// Gallery IDs in use.
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$gallery_raw = $wpdb->get_col(
		"SELECT meta_value
		 FROM {$wpdb->postmeta}
		 WHERE meta_key   = '_product_image_gallery'
		   AND meta_value != ''"
	);
	$gallery_ids = [];
	foreach ( $gallery_raw as $csv ) {
		foreach ( explode( ',', $csv ) as $gid ) {
			$gid = (int) $gid;
			if ( $gid > 0 ) {
				$gallery_ids[ $gid ] = true;
			}
		}
	}

	$in_use      = array_flip( array_map( 'intval', $thumbnail_ids ) );
	$in_use      = array_merge( $in_use, $gallery_ids );
	$unlinked    = array_filter( $all_ids, fn( $id ) => ! isset( $in_use[ (int) $id ] ) );
	$unlinked    = array_values( $unlinked );
	$total       = count( $unlinked );
	$batch       = array_slice( $unlinked, $offset, $limit );

	$deleted = 0;
	$errors  = [];

	if ( ! $dry_run ) {
		foreach ( $batch as $id ) {
			$result = wp_delete_attachment( (int) $id, true );
			if ( false !== $result ) {
				++$deleted;
			} else {
				$errors[] = "Failed to delete attachment ID {$id}";
			}
		}
	}

	return rest_ensure_response( [
		'status'       => $dry_run ? 'dry_run' : 'completed',
		'directory'    => "wp-content/uploads/$year/$month",
		'total_unlinked' => $total,
		'batch_size'   => count( $batch ),
		'deleted'      => $dry_run ? 0 : $deleted,
		'offset'       => $offset,
		'limit'        => $limit,
		'dry_run'      => $dry_run,
		'errors'       => $errors,
		'next_offset'  => ( count( $batch ) === $limit && $total > $offset + $limit )
			? $offset + $limit
			: null,
	] );
}

// ============================================================================
// POST /dtb/v1/sync-images/fix-renamed
// ============================================================================

/**
 * Repair files that wp_unique_filename() renamed during a failed sync run.
 *
 * When WP encounters an attachment record pointing to {sku}.webp it can rename
 * the physical file to {sku}-1.webp. This handler finds {stem}-{n}.{ext} files
 * where no un-suffixed {stem}.{ext} exists and renames them back. Also updates
 * the _wp_attached_file meta to match the renamed file.
 *
 * dry_run=true by default.
 */
function dtb_route_fix_renamed_files( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	if ( function_exists( 'ini_set' ) ) {
		ini_set( 'memory_limit', '256M' ); // phpcs:ignore
	}
	if ( function_exists( 'set_time_limit' ) ) {
		set_time_limit( 120 ); // phpcs:ignore
	}

	$year    = ltrim( sanitize_text_field( (string) $request->get_param( 'year' ) ),  '/' );
	$month   = ltrim( sanitize_text_field( (string) $request->get_param( 'month' ) ), '/' );
	$dry_run = (bool) $request->get_param( 'dry_run' );

	if ( ! ctype_digit( $year ) || ! ctype_digit( $month ) ) {
		return new WP_Error( 'invalid_params', 'year and month must be numeric.', [ 'status' => 400 ] );
	}

	$upload_dir = wp_upload_dir();
	$scan_dir   = trailingslashit( $upload_dir['basedir'] ) . "$year/$month";

	if ( ! is_dir( $scan_dir ) ) {
		return new WP_Error( 'dir_not_found', "Directory not found: wp-content/uploads/$year/$month", [ 'status' => 404 ] );
	}

	$extensions = [ 'webp', 'jpg', 'jpeg', 'png', 'avif', 'gif' ];
	$renamed    = 0;
	$skipped    = 0;
	$preview    = [];
	$errors     = [];

	$it = new DirectoryIterator( $scan_dir );
	foreach ( $it as $file ) {
		if ( $file->isDot() || ! $file->isFile() ) {
			continue;
		}

		$ext = strtolower( $file->getExtension() );
		if ( ! in_array( $ext, $extensions, true ) ) {
			continue;
		}

		$stem = $file->getBasename( '.' . $ext );

		// Match filenames ending in -{n} where n ≥ 1.
		if ( ! preg_match( '/^(.+)-(\d+)$/', $stem, $m ) ) {
			continue;
		}

		$canonical_stem = $m[1];
		$canonical_file = $canonical_stem . '.' . $ext;
		$canonical_path = $scan_dir . '/' . $canonical_file;
		$current_path   = $file->getPathname();

		if ( file_exists( $canonical_path ) ) {
			++$skipped;
			continue;
		}

		$preview[] = $file->getFilename() . ' → ' . $canonical_file;

		if ( ! $dry_run ) {
			if ( rename( $current_path, $canonical_path ) ) {
				// Update _wp_attached_file meta so existing attachment records
				// point to the corrected filename.
				global $wpdb;
				$relative_old = "$year/$month/" . $file->getFilename();
				$relative_new = "$year/$month/" . $canonical_file;
				// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
				$wpdb->query( $wpdb->prepare(
					"UPDATE {$wpdb->postmeta}
					 SET meta_value = %s
					 WHERE meta_key  = '_wp_attached_file'
					   AND meta_value = %s",
					$relative_new,
					$relative_old
				) );
				dtb_image_sync_log( "image_sync fix-renamed: {$file->getFilename()} → {$canonical_file}" );
				++$renamed;
			} else {
				$errors[] = 'Failed to rename: ' . $file->getFilename();
			}
		} else {
			++$renamed;
		}
	}

	return rest_ensure_response( [
		'status'    => $dry_run ? 'dry_run' : 'completed',
		'directory' => "wp-content/uploads/$year/$month",
		'dry_run'   => $dry_run,
		'renamed'   => $renamed,
		'skipped'   => $skipped,
		'preview'   => $dry_run ? $preview : [],
		'errors'    => $errors,
	] );
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Probe for an image file on disk, checking all supported extensions.
 *
 * @param string   $dir        Absolute path to the upload directory.
 * @param string   $url        Public base URL for the directory.
 * @param string   $stem       Filename without extension (lower-cased).
 * @param string[] $extensions Ordered list of extensions to try.
 * @return array{0: string|null, 1: string|null} [absolute_path, public_url] or [null, null].
 */
function dtb_probe_image( string $dir, string $url, string $stem, array $extensions ): array {
	foreach ( $extensions as $ext ) {
		$path = trailingslashit( $dir ) . $stem . '.' . $ext;
		if ( file_exists( $path ) ) {
			return [ $path, trailingslashit( $url ) . $stem . '.' . $ext ];
		}
	}
	return [ null, null ];
}

/**
 * Find all files matching {sku}_{hash}.{ext} in a directory.
 *
 * Handles the Platinum Drywall Tools naming convention where images are stored
 * as {sku}_{8-char-hex}.{ext} (e.g. pt-10fb_7316520b.webp). Unlike the numeric
 * _01/_02 gallery suffix convention used by most brands, Platinum images have an
 * opaque hash suffix. This function scans the directory for any file whose stem
 * begins with "{sku}_" and whose suffix is hex-only ([0-9a-f]{6,16}).
 *
 * Returns an array of [ 'path' => ..., 'url' => ... ] sorted by filename so the
 * ordering is deterministic across runs. Caller should treat index 0 as primary.
 *
 * @param string   $dir        Absolute path to the upload year/month directory.
 * @param string   $url        Public base URL for the same directory.
 * @param string   $sku_lower  Lower-case SKU (e.g. 'pt-10fb').
 * @param string[] $extensions Allowed image extensions.
 * @return array<int, array{path: string, url: string}>
 */
function dtb_probe_image_hash_variants( string $dir, string $url, string $sku_lower, array $extensions ): array {
	$matches = [];
	$prefix  = $sku_lower . '_';

	if ( ! is_dir( $dir ) ) {
		return $matches;
	}

	$it = new DirectoryIterator( $dir );
	foreach ( $it as $file ) {
		if ( $file->isDot() || ! $file->isFile() ) {
			continue;
		}
		$ext = strtolower( $file->getExtension() );
		if ( ! in_array( $ext, $extensions, true ) ) {
			continue;
		}
		$stem = strtolower( $file->getBasename( '.' . $ext ) );

		// Must start with "{sku}_" and the suffix must look like a hex hash (6–16 chars).
		if ( str_starts_with( $stem, $prefix ) ) {
			$hash = substr( $stem, strlen( $prefix ) );
			if ( preg_match( '/^[0-9a-f]{6,16}$/', $hash ) ) {
				$matches[] = [
					'path' => $file->getPathname(),
					'url'  => trailingslashit( $url ) . $file->getFilename(),
				];
			}
		}
	}

	// Sort deterministically by filename so primary image is consistent.
	usort( $matches, static fn( $a, $b ) => strcmp( $a['path'], $b['path'] ) );

	return $matches;
}

/**
 * Register a file that already exists on disk as a WordPress media attachment.
 *
 * Does NOT move or copy the file. The file must be at $file_path before calling.
 *
 * APPROACH:
 *   1. wp_insert_attachment($args, $file_path) — official WP attachment creation.
 *      The $file_path second argument causes WP to write _wp_attached_file meta
 *      with the correct relative path automatically. This is the indexed path used
 *      by attachment_url_to_postid() for future lookups.
 *
 *   2. guid written directly via $wpdb->update() — wp_insert_post() passes any
 *      'guid' value in $args through wp_unique_post_slug() which corrupts the URL
 *      into a permalink slug. Writing directly to the column bypasses that.
 *
 *   3. wp_read_image_metadata($file_path) — extracts EXIF/IPTC data (camera,
 *      copyright, caption, keywords) and stores it in the 'image_meta' key of
 *      the attachment metadata. This is the same data WP Admin populates when
 *      images are uploaded via the UI.
 *
 *   4. wp_update_image_subsizes($attachment_id) [WP 5.3+] — the public API wrapper
 *      around _wp_make_subsizes(). Generates only the four WC-required sub-sizes
 *      (thumbnail, woocommerce_thumbnail, woocommerce_single,
 *      woocommerce_gallery_thumbnail), skips any already generated (idempotent),
 *      and does NOT call wp_unique_filename() on the source file.
 *
 *   5. post_parent set to $product_id — makes WP Admin Media Library show
 *      "Attached to: [Product Name]" instead of "Unattached" for each image.
 *
 * @param string $file_path  Absolute server path to the existing image.
 * @param string $file_url   Full public URL for the image.
 * @param int    $product_id WooCommerce product post ID (used as post_parent).
 * @return int|WP_Error      New attachment post ID on success; WP_Error on failure.
 */
function dtb_register_image_attachment( string $file_path, string $file_url, int $product_id = 0 ): int|WP_Error {
	if ( ! file_exists( $file_path ) ) {
		return new WP_Error( 'file_not_found', "File not found: {$file_path}" );
	}

	if ( ! function_exists( 'wp_update_image_subsizes' ) ) {
		require_once ABSPATH . 'wp-admin/includes/image.php';
	}

	$filename = basename( $file_path );
	$filetype = wp_check_filetype( $filename );

	if ( empty( $filetype['type'] ) ) {
		return new WP_Error( 'invalid_filetype', "Unrecognised file type: {$filename}" );
	}

	$title = sanitize_text_field(
		preg_replace( '/[_\-]+/', ' ', pathinfo( $filename, PATHINFO_FILENAME ) ) ?? $filename
	);

	// ── 1. Create the attachment post record ─────────────────────────────────
	$attachment_id = wp_insert_attachment(
		[
			'post_mime_type' => $filetype['type'],
			'post_title'     => $title,
			'post_content'   => '',
			'post_status'    => 'inherit',
			'post_parent'    => $product_id,
		],
		$file_path,  // Triggers automatic _wp_attached_file meta write.
		$product_id, // Sets post_parent — "Attached to: [Product]" in Media Library.
		true         // Return WP_Error on failure.
	);

	if ( is_wp_error( $attachment_id ) ) {
		return $attachment_id;
	}

	// ── 2. Write guid directly, bypassing WP's permalink rewriter ────────────
	global $wpdb;
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$wpdb->update(
		$wpdb->posts,
		[ 'guid' => $file_url ],
		[ 'ID'   => $attachment_id ],
		[ '%s' ],
		[ '%d' ]
	);
	clean_post_cache( $attachment_id );

	// ── 3. Build base metadata with dimensions and EXIF/IPTC data ────────────
	$imagesize = function_exists( 'wp_getimagesize' )
		? wp_getimagesize( $file_path )
		: @getimagesize( $file_path ); // phpcs:ignore WordPress.PHP.NoSilencedErrors

	$upload_dir = wp_upload_dir();
	$relative   = ltrim( str_replace( $upload_dir['basedir'], '', $file_path ), '/\\' );

	$image_meta = [];
	if ( function_exists( 'wp_read_image_metadata' ) ) {
		$image_meta = wp_read_image_metadata( $file_path ) ?: [];
	}

	$meta = [
		'width'      => isset( $imagesize[0] ) ? (int) $imagesize[0] : 0,
		'height'     => isset( $imagesize[1] ) ? (int) $imagesize[1] : 0,
		'file'       => $relative,
		'filesize'   => (int) filesize( $file_path ),
		'sizes'      => [],
		'image_meta' => $image_meta,
	];

	// Persist base metadata before generating sub-sizes. If sub-size generation
	// fails or times out the attachment record is still valid.
	wp_update_attachment_metadata( $attachment_id, $meta );

	// ── 4. Generate WC-required sub-sizes via the public API ─────────────────
	// wp_update_image_subsizes() checks which sizes are already generated and
	// only creates the missing ones. It is safe to call repeatedly.
	wp_update_image_subsizes( $attachment_id );

	// ── 5. Clear attachment cache ─────────────────────────────────────────────
	clean_attachment_cache( $attachment_id );

	return (int) $attachment_id;
}

/**
 * Link a primary image and optional gallery to a WooCommerce product.
 *
 * Uses the WC_Product API (set_image_id / set_gallery_image_ids / save) instead
 * of raw set_post_thumbnail() / update_post_meta(). This fires WooCommerce action
 * hooks (woocommerce_product_set_image, etc.) and updates WC object caches.
 *
 * @param int   $product_id     WooCommerce product post ID.
 * @param int   $attachment_id  Attachment post ID for the featured image.
 * @param int[] $gallery_ids    Ordered array of attachment IDs for the gallery.
 * @return true|WP_Error
 */
function dtb_link_images_to_product( int $product_id, int $attachment_id, array $gallery_ids = [] ): bool|WP_Error {
	if ( ! function_exists( 'wc_get_product' ) ) {
		// WooCommerce not active — fall back to raw meta.
		set_post_thumbnail( $product_id, $attachment_id );
		if ( ! empty( $gallery_ids ) ) {
			update_post_meta( $product_id, '_product_image_gallery', implode( ',', $gallery_ids ) );
		} else {
			delete_post_meta( $product_id, '_product_image_gallery' );
		}
		return true;
	}

	$product = wc_get_product( $product_id );
	if ( ! $product ) {
		return new WP_Error( 'product_not_found', "No WC product found for post ID {$product_id}" );
	}

	$product->set_image_id( $attachment_id );
	$product->set_gallery_image_ids( $gallery_ids );
	$product->save();

	// Flush product transients so REST API reflects the new images immediately.
	wc_delete_product_transients( $product_id );

	return true;
}

/**
 * Find a WooCommerce product whose SKU matches the filename stem.
 *
 * Checks three variants in order:
 *   1. Direct lower-case match (wc_get_product_id_by_sku — indexed lookup).
 *   2. Upper-case match (e.g. file "ez10-ad" → SKU "EZ10-AD").
 *   3. Hyphen↔underscore normalisation (e.g. "tc_01tt" → "tc-01tt").
 *   4. Case-insensitive meta query fallback.
 *
 * @param string $stem Filename without extension, lower-cased.
 * @return int|null    Product post ID, or null if not found.
 */
function dtb_find_product_by_sku_stem( string $stem ): ?int {
	if ( function_exists( 'wc_get_product_id_by_sku' ) ) {
		foreach ( [
			$stem,
			strtoupper( $stem ),
			str_replace( '_', '-', $stem ),
			str_replace( '-', '_', $stem ),
		] as $candidate ) {
			$id = (int) wc_get_product_id_by_sku( $candidate );
			if ( $id ) {
				return $id;
			}
		}
	}

	// Fallback: case-insensitive meta query.
	global $wpdb;
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery,WordPress.DB.DirectDatabaseQuery.NoCaching
	$id = $wpdb->get_var( $wpdb->prepare(
		"SELECT post_id FROM {$wpdb->postmeta}
		 WHERE meta_key = '_sku'
		   AND LOWER(meta_value) = %s
		 LIMIT 1",
		$stem
	) );

	return $id ? (int) $id : null;
}

/**
 * Return all image file paths in a directory.
 *
 * @param string   $dir        Absolute path.
 * @param string[] $extensions Allowed extensions without dot.
 * @return string[]
 */
function dtb_list_images_in_dir( string $dir, array $extensions ): array {
	$files = [];
	$it    = new DirectoryIterator( $dir );
	foreach ( $it as $file ) {
		if ( $file->isDot() || ! $file->isFile() ) {
			continue;
		}
		if ( ! in_array( strtolower( $file->getExtension() ), $extensions, true ) ) {
			continue;
		}
		// Exclude WordPress-generated sub-size variants (e.g. image-480x480.webp).
		// Sub-sizes always end with a -WxH suffix before the extension.
		if ( preg_match( '/-\d+x\d+$/', $file->getBasename( '.' . $file->getExtension() ) ) ) {
			continue;
		}
		$files[] = $file->getPathname();
	}
	sort( $files );
	return $files;
}

/**
 * Log a message via dtb_log() if available, otherwise via error_log.
 *
 * @param string $message Log message.
 */
function dtb_image_sync_log( string $message ): void {
	if ( function_exists( 'dtb_log' ) ) {
		dtb_log( $message );
	} else {
		// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
		error_log( '[DTB Image Sync] ' . $message );
	}
}

// ============================================================================
// WP-ADMIN TOOLING
// ============================================================================

if ( is_admin() ) {
	add_action( 'admin_menu', 'dtb_image_sync_add_management_page' );
}

/**
 * Register DTB Image Sync page under wp-admin Tools.
 */
function dtb_image_sync_add_management_page(): void {
	add_management_page(
		'Drywall Toolbox Image Sync',
		'DTB Image Sync',
		'manage_woocommerce',
		'dtb-image-sync',
		'dtb_render_image_sync_admin_page'
	);
}

/**
 * Render the wp-admin Tools → DTB Image Sync page.
 */
function dtb_render_image_sync_admin_page(): void {
	if ( ! current_user_can( 'manage_woocommerce' ) ) {
		wp_die( esc_html__( 'Unauthorized', 'drywall-toolbox' ) );
	}

	$nonce_value = isset( $_POST['dtb_image_sync_nonce'] ) // phpcs:ignore WordPress.Security.NonceVerification.Missing
		? sanitize_text_field( wp_unslash( (string) $_POST['dtb_image_sync_nonce'] ) ) // phpcs:ignore WordPress.Security.NonceVerification.Missing
		: '';
	$request_method  = isset( $_SERVER['REQUEST_METHOD'] ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		? strtoupper( sanitize_text_field( wp_unslash( (string) $_SERVER['REQUEST_METHOD'] ) ) ) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
		: 'GET';
	$has_valid_nonce = ( 'POST' === $request_method )
		&& ( '' !== $nonce_value )
		&& wp_verify_nonce( $nonce_value, 'dtb_image_sync_admin' );

	$get_post_field = static function ( string $key, string $default = '' ) use ( $has_valid_nonce ): string {
		if ( ! $has_valid_nonce || ! isset( $_POST[ $key ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			return $default;
		}
		return sanitize_text_field( wp_unslash( (string) $_POST[ $key ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
	};

	$get_post_bool = static function ( string $key, bool $default = false ) use ( $has_valid_nonce ): bool {
		if ( ! $has_valid_nonce || ! isset( $_POST[ $key ] ) ) { // phpcs:ignore WordPress.Security.NonceVerification.Missing
			return $default;
		}
		return rest_sanitize_boolean( wp_unslash( (string) $_POST[ $key ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
	};

	$year_digits  = preg_replace( '/\D+/', '', $get_post_field( 'dtb_year', gmdate( 'Y' ) ) );
	$month_digits = preg_replace( '/\D+/', '', $get_post_field( 'dtb_month', gmdate( 'm' ) ) );
	$year_digits  = is_string( $year_digits ) ? $year_digits : '';
	$month_digits = is_string( $month_digits ) ? $month_digits : '';
	$year         = '' !== $year_digits ? $year_digits : gmdate( 'Y' );
	$month_candidate = '' !== $month_digits ? absint( $month_digits ) : (int) gmdate( 'm' );
	$month_int       = ( $month_candidate >= 1 && $month_candidate <= 12 ) ? $month_candidate : (int) gmdate( 'm' );
	$month     = str_pad( (string) $month_int, 2, '0', STR_PAD_LEFT );
	$limit     = max( 1, absint( $get_post_field( 'dtb_limit', '100' ) ) );
	$offset    = absint( $get_post_field( 'dtb_offset', '0' ) );
	$dry_run   = $get_post_bool( 'dtb_dry_run', false );
	$force     = $get_post_bool( 'dtb_force', false );

	// Which action was submitted (null = no form post yet, show status only).
	$action         = null;
	$action_result  = null;

	if (
		$has_valid_nonce
		&& isset( $_POST['dtb_image_sync_action'] ) // phpcs:ignore WordPress.Security.NonceVerification.Missing
	) {
		$action = sanitize_key( wp_unslash( (string) $_POST['dtb_image_sync_action'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing

		$request = new WP_REST_Request();
		$request->set_param( 'year', $year );
		$request->set_param( 'month', $month );

		if ( in_array( $action, [ 'sync', 'pipeline', 'reset', 'fix_renamed' ], true ) ) {
			$request->set_param( 'dry_run', $dry_run );
		}

		if ( 'sync' === $action ) {
			$request->set_param( 'limit', $limit );
			$request->set_param( 'offset', $offset );
			$request->set_param( 'force', $force );
			$action_result = dtb_route_sync_images( $request );

		} elseif ( 'pipeline' === $action ) {
			// Phase 1 — fix any WP-renamed files (idempotent, non-destructive).
			$fix_request = new WP_REST_Request();
			$fix_request->set_param( 'year',    $year );
			$fix_request->set_param( 'month',   $month );
			$fix_request->set_param( 'dry_run', $dry_run );
			$fix_result = dtb_route_fix_renamed_files( $fix_request );

			$fix_data = is_wp_error( $fix_result ) ? [] : (array) $fix_result->get_data();

			// Phase 2 — sync this batch.
			$sync_request = new WP_REST_Request();
			$sync_request->set_param( 'year',    $year );
			$sync_request->set_param( 'month',   $month );
			$sync_request->set_param( 'dry_run', $dry_run );
			$sync_request->set_param( 'force',   $force );
			$sync_request->set_param( 'limit',   $limit );
			$sync_request->set_param( 'offset',  $offset );
			$sync_result = dtb_route_sync_images( $sync_request );

			if ( is_wp_error( $sync_result ) ) {
				$action_result = $sync_result;
			} else {
				$sync_data     = (array) $sync_result->get_data();
				$action_result = rest_ensure_response( array_merge(
					$sync_data,
					[
						'pipeline'          => true,
						'fix_renamed_count' => $fix_data['renamed'] ?? 0,
						'fix_errors'        => $fix_data['errors'] ?? [],
					]
				) );
			}

		} elseif ( 'release_lock' === $action ) {
			delete_transient( DTB_SYNC_LOCK_KEY );
			delete_transient( DTB_SYNC_PROGRESS_KEY );
			$action_result = rest_ensure_response( [ 'released' => true, 'message' => 'Sync lock released.' ] );

		} elseif ( 'status' === $action ) {
			$action_result = dtb_route_sync_images_status( $request );

		} elseif ( 'fix_renamed' === $action ) {
			$action_result = dtb_route_fix_renamed_files( $request );

		} elseif ( 'reset' === $action ) {
			$confirm_reset = $get_post_bool( 'dtb_confirm_reset', false );
			if ( ! $confirm_reset ) {
				$action_result = new WP_Error(
					'dtb_reset_confirmation_required',
					'Check "I understand reset is destructive" before running reset.',
					[ 'status' => 400 ]
				);
			} else {
				$action_result = dtb_route_reset_images( $request );
			}
		}
	}

	// Initial page load (no action submitted) — show live status for context.
	$status_data = null;
	$status_request = new WP_REST_Request();
	$status_request->set_param( 'year', $year );
	$status_request->set_param( 'month', $month );
	$status_result = dtb_route_sync_images_status( $status_request );
	if ( ! is_wp_error( $status_result ) ) {
		$status_data = $status_result->get_data();
	}

	$is_error    = is_wp_error( $action_result );
	$result_data = null === $action_result
		? null
		: (
			$is_error
			? [
				'code'    => $action_result->get_error_code(),
				'message' => $action_result->get_error_message(),
				'data'    => $action_result->get_error_data(),
			]
			: $action_result->get_data()
		);

	// Convenience: next-batch offset from a sync/pipeline result.
	$next_offset = is_array( $result_data ) ? ( $result_data['next_offset'] ?? null ) : null;

	?>
	<div class="wrap">
		<h1>🖼️ DTB Image Sync</h1>
		<p>Register, link, and optimize product images in <code>wp-content/uploads/<?php echo esc_html( $year . '/' . $month ); ?>/</code> for WooCommerce import readiness.</p>

		<?php
		// ── Live status bar ────────────────────────────────────────────────────
		if ( is_array( $status_data ) ) :
			$files_on_disk       = (int) ( $status_data['files_on_disk']    ?? 0 );
			$registered_in_db    = (int) ( $status_data['registered_in_db'] ?? 0 );
			$linked_products     = (int) ( $status_data['linked_products']  ?? 0 );
			$gallery_products    = (int) ( $status_data['gallery_products'] ?? 0 );
			$sync_locked         = ! empty( $status_data['sync_locked'] );
			$reg_pct             = $files_on_disk > 0 ? round( ( $registered_in_db / $files_on_disk ) * 100 ) : 0;
			?>
			<div class="card" style="max-width:100%;margin:0 0 20px;padding:20px 20px 12px;">
				<h2 style="margin-top:0;">📊 Directory Status — <code><?php echo esc_html( "uploads/{$year}/{$month}" ); ?></code></h2>
				<table class="widefat fixed" style="width:auto;min-width:400px;">
					<tbody>
						<tr><td><strong>Files on disk</strong></td><td><?php echo esc_html( (string) $files_on_disk ); ?></td></tr>
						<tr><td><strong>Registered in Media Library</strong></td><td><?php echo esc_html( "{$registered_in_db} ({$reg_pct}%)" ); ?></td></tr>
						<tr><td><strong>Products with featured image</strong></td><td><?php echo esc_html( (string) $linked_products ); ?></td></tr>
						<tr><td><strong>Products with gallery images</strong></td><td><?php echo esc_html( (string) $gallery_products ); ?></td></tr>
						<tr>
							<td><strong>Sync lock</strong></td>
							<td><?php echo $sync_locked ? '<span style="color:#d63638;">🔒 Locked</span>' : '<span style="color:#00a32a;">✔ Free</span>'; ?></td>
						</tr>
					</tbody>
				</table>
				<?php if ( $sync_locked ) : ?>
					<form method="post" action="" style="margin-top:10px;">
						<?php wp_nonce_field( 'dtb_image_sync_admin', 'dtb_image_sync_nonce' ); ?>
						<button type="submit" class="button" name="dtb_image_sync_action" value="release_lock">🔓 Release Stuck Lock</button>
					</form>
				<?php endif; ?>
			</div>
		<?php endif; ?>

		<?php
		// ── Action notice (only shown when a form was submitted) ──────────────
		if ( null !== $action_result ) :
			if ( $is_error ) : ?>
				<div class="notice notice-error is-dismissible"><p>
					<strong>Action failed:</strong> <?php echo esc_html( (string) ( $result_data['message'] ?? '' ) ); ?>
				</p></div>
			<?php else : ?>
				<div class="notice notice-success is-dismissible"><p>
					<?php
					$msg_parts = [];
					if ( ! empty( $result_data['pipeline'] ) ) {
						$msg_parts[] = 'Pipeline complete';
						if ( ! empty( $result_data['fix_renamed_count'] ) ) {
							$msg_parts[] = esc_html( (string) $result_data['fix_renamed_count'] ) . ' file(s) renamed';
						}
					}
					if ( isset( $result_data['registered'] ) ) {
						$msg_parts[] = esc_html( (string) $result_data['registered'] ) . ' registered';
					}
					if ( isset( $result_data['linked'] ) ) {
						$msg_parts[] = esc_html( (string) $result_data['linked'] ) . ' linked';
					}
					if ( isset( $result_data['renamed'] ) && ! isset( $result_data['registered'] ) ) {
						$msg_parts[] = esc_html( (string) $result_data['renamed'] ) . ' renamed';
					}
					if ( ! empty( $result_data['dry_run'] ) ) {
						$msg_parts[] = '(dry run)';
					}
					echo implode( ' · ', $msg_parts ) ?: 'Action completed.'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- each part already escaped above
					?>
				</p></div>
			<?php endif;
		endif;
		?>

		<?php
		// ── Next-batch shortcut ───────────────────────────────────────────────
		if ( null !== $next_offset ) :
			$next_action = ! empty( $result_data['pipeline'] ) ? 'pipeline' : 'sync';
			?>
			<div class="notice notice-info" style="display:flex;align-items:center;gap:16px;">
				<p style="margin:0;">More batches remaining. Next offset: <strong><?php echo esc_html( (string) $next_offset ); ?></strong></p>
				<form method="post" action="" style="margin:0;">
					<?php wp_nonce_field( 'dtb_image_sync_admin', 'dtb_image_sync_nonce' ); ?>
					<input type="hidden" name="dtb_year"   value="<?php echo esc_attr( $year ); ?>" />
					<input type="hidden" name="dtb_month"  value="<?php echo esc_attr( $month ); ?>" />
					<input type="hidden" name="dtb_limit"  value="<?php echo esc_attr( (string) $limit ); ?>" />
					<input type="hidden" name="dtb_offset" value="<?php echo esc_attr( (string) $next_offset ); ?>" />
					<?php if ( $dry_run ) : ?><input type="hidden" name="dtb_dry_run" value="1" /><?php endif; ?>
					<?php if ( $force )   : ?><input type="hidden" name="dtb_force"   value="1" /><?php endif; ?>
					<button type="submit" class="button button-primary" name="dtb_image_sync_action" value="<?php echo esc_attr( $next_action ); ?>">
						Continue Next Batch (offset <?php echo esc_html( (string) $next_offset ); ?>) →
					</button>
				</form>
			</div>
		<?php endif; ?>

		<div class="card" style="max-width:100%;margin:20px 0;padding:20px;">
			<h2 style="margin-top:0;">⚙️ Run Image Sync</h2>
			<form method="post" action="">
				<?php wp_nonce_field( 'dtb_image_sync_admin', 'dtb_image_sync_nonce' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="dtb_year">Year</label></th>
						<td>
							<input id="dtb_year" name="dtb_year" type="text" class="small-text" value="<?php echo esc_attr( $year ); ?>" maxlength="4" />
							<p class="description">Upload year folder (e.g. 2026)</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="dtb_month">Month</label></th>
						<td>
							<input id="dtb_month" name="dtb_month" type="text" class="small-text" value="<?php echo esc_attr( $month ); ?>" maxlength="2" />
							<p class="description">Zero-padded month (01–12)</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="dtb_limit">Batch limit</label></th>
						<td>
							<input id="dtb_limit" name="dtb_limit" type="number" min="1" max="1000" class="small-text" value="<?php echo esc_attr( (string) $limit ); ?>" />
							<p class="description">Products per batch. Lower values are safer on shared hosting.</p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="dtb_offset">Offset</label></th>
						<td>
							<input id="dtb_offset" name="dtb_offset" type="number" min="0" class="small-text" value="<?php echo esc_attr( (string) $offset ); ?>" />
							<p class="description">Skip this many SKUs (for resuming a previous run).</p>
						</td>
					</tr>
				</table>

				<fieldset style="margin:12px 0;border:1px solid #c3c4c7;padding:12px 16px;border-radius:4px;">
					<legend style="font-weight:600;padding:0 6px;">Options</legend>
					<label style="display:block;margin-bottom:8px;">
						<input type="checkbox" name="dtb_dry_run" value="1" <?php checked( $dry_run ); ?> />
						<strong>Dry run</strong> — scan and report without writing to the database
					</label>
					<label style="display:block;margin-bottom:8px;">
						<input type="checkbox" name="dtb_force" value="1" <?php checked( $force ); ?> />
						<strong>Force</strong> — re-register and re-link images even if already synced
					</label>
					<label style="display:block;color:#b32d2e;">
						<input type="checkbox" name="dtb_confirm_reset" value="1" />
						<strong>I understand reset is destructive</strong> — required to run the Reset action
					</label>
				</fieldset>

				<p class="submit" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
					<button type="submit" class="button button-hero button-primary" name="dtb_image_sync_action" value="pipeline"
						title="Runs Fix Renamed → Sync batch in one click">
						🚀 Run Full Pipeline
					</button>
					<span style="color:#646970;padding:0 4px;">or individually:</span>
					<button type="submit" class="button" name="dtb_image_sync_action" value="status">Check Status</button>
					<button type="submit" class="button" name="dtb_image_sync_action" value="fix_renamed">Fix Renamed Files</button>
					<button type="submit" class="button button-primary" name="dtb_image_sync_action" value="sync">Run Sync Batch</button>
					<button type="submit" class="button button-link-delete" name="dtb_image_sync_action" value="reset"
						style="margin-left:auto;">⚠️ Run Reset</button>
				</p>
			</form>
		</div>

		<?php if ( null !== $result_data ) : ?>
			<div class="card" style="max-width:100%;margin:20px 0;padding:20px;">
				<h2 style="margin-top:0;">
					📋 Result
					<?php if ( null !== $action ) : ?>
						— <code><?php echo esc_html( $action ); ?></code>
					<?php endif; ?>
				</h2>
				<pre style="white-space:pre-wrap;margin:0;background:#f0f0f1;padding:12px;border-radius:4px;font-size:12px;"><?php
					echo esc_html( wp_json_encode( $result_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ) ?: '{}' );
				?></pre>
			</div>
		<?php endif; ?>

		<div class="card" style="max-width:100%;margin:20px 0;background:#f6f7f7;padding:16px 20px;">
			<h3 style="margin-top:0;">📖 Quick Guide</h3>
			<ol style="margin-left:20px;margin-bottom:0;">
				<li>Set <strong>Year</strong> / <strong>Month</strong> to match your image upload folder (e.g. 2026 / 04).</li>
				<li>Click <strong>🚀 Run Full Pipeline</strong> — it fixes any WP-renamed files, then registers and links images for this batch.</li>
				<li>If a <em>Continue Next Batch</em> button appears, click it to advance until all SKUs are processed.</li>
				<li>Run <strong>Check Status</strong> any time to see how many files are registered and linked.</li>
				<li>After syncing, import <code>wp-catalog.csv</code> via <a href="<?php echo esc_url( admin_url( 'edit.php?post_type=product&page=product_importer' ) ); ?>">WooCommerce → Products → Import</a>.</li>
			</ol>
		</div>
	</div>
	<?php
}
