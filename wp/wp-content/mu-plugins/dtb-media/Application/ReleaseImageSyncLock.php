<?php
defined( 'ABSPATH' ) || exit;

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

	if ( get_transient( DTB_SYNC_LOCK_KEY ) ) {
		return new WP_Error(
			'sync_locked',
			'A sync is already in progress. Use /release-lock if the previous run crashed.',
			[ 'status' => 423 ]
		);
	}

	// Early-exit when renaming is globally disabled via constant.
	if ( defined( 'DTB_IMAGE_SYNC_DISABLE_RENAME' ) && DTB_IMAGE_SYNC_DISABLE_RENAME ) {
		return rest_ensure_response( [
			'status'    => 'disabled',
			'directory' => "wp-content/uploads/$year/$month",
			'dry_run'   => $dry_run,
			'renamed'   => 0,
			'skipped'   => 0,
			'preview'   => [],
			'errors'    => [],
		] );
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

