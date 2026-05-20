<?php
defined( 'ABSPATH' ) || exit;

/**
 * Admin-AJAX handler for the DTB Image Sync admin page.
 *
 * Serves as a reliable fallback for environments where WordPress REST API
 * cookie-based nonce authentication is broken (e.g. HostGator shared hosting
 * where the server strips session cookies on /wp-json/ requests).
 *
 * Authentication: check_ajax_referer() verifies the form nonce against the
 * current WP session — this is immune to the REST API "Cookie check failed"
 * issue because admin-ajax.php uses the standard PHP session, not the REST
 * nonce system.
 *
 * @return never — always terminates via wp_send_json_*().
 */
function dtb_ajax_image_sync_handler(): void {
	// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
	check_ajax_referer( 'dtb_image_sync_admin', 'nonce' );

	if ( ! dtb_image_sync_can_manage() ) {
		wp_send_json_error( [ 'message' => 'Unauthorized' ], 403 );
	}

	// phpcs:ignore WordPress.Security.NonceVerification.Missing
	$sync_action = sanitize_key( wp_unslash( $_POST['sync_action'] ?? '' ) );

	$request = new WP_REST_Request();
	// phpcs:disable WordPress.Security.NonceVerification.Missing
	$_ajax_default_path = defined( 'DTB_IMAGE_SYNC_DEFAULT_UPLOAD_RELATIVE_PATH' ) ? DTB_IMAGE_SYNC_DEFAULT_UPLOAD_RELATIVE_PATH : '2026/media';
	$request->set_param( 'upload_path',   sanitize_text_field( wp_unslash( $_POST['upload_path'] ?? $_ajax_default_path ) ) );
	$request->set_param( 'dry_run',       rest_sanitize_boolean( wp_unslash( $_POST['dry_run']     ?? false ) ) );
	$request->set_param( 'force',         rest_sanitize_boolean( wp_unslash( $_POST['force']       ?? false ) ) );
	$request->set_param( 'register_only', rest_sanitize_boolean( wp_unslash( $_POST['register_only'] ?? false ) ) );
	$request->set_param( 'limit',         max( 1, absint( $_POST['limit']  ?? 25 ) ) );
	$request->set_param( 'offset',        max( 0, absint( $_POST['offset'] ?? 0 ) ) );
	// phpcs:enable WordPress.Security.NonceVerification.Missing

	if ( 'progress' === $sync_action ) {
		$result = dtb_route_sync_images_progress();
	} elseif ( 'status' === $sync_action || 'status_snapshot' === $sync_action ) {
		$result = dtb_route_sync_images_status( $request );
	} elseif ( 'link_only' === $sync_action ) {
		$result = dtb_route_link_registered_images( $request );
	} elseif ( 'fix_renamed' === $sync_action ) {
		$result = dtb_route_fix_renamed_files( $request );
	} else {
		// Default: register (+ link unless register_only).
		$result = dtb_route_sync_images( $request );
	}

	if ( is_wp_error( $result ) ) {
		wp_send_json_error( [ 'message' => $result->get_error_message() ], 400 );
	}

	wp_send_json_success( $result->get_data() );
}

/**
 * Register DTB Image Sync page under the DTB Tools admin menu.
 */

