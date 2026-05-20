<?php
defined( 'ABSPATH' ) || exit;

add_action( 'save_post_attachment', 'dtb_schematics_invalidate_manifest_cache' );
add_action( 'delete_attachment',    'dtb_schematics_invalidate_manifest_cache' );

function dtb_schematics_invalidate_manifest_cache(): void {
	delete_transient( 'dtb_schematics_manifest' );
}

/**
 * Build and return the schematic image manifest.
 *
 * Result is cached for 1 hour. Cache is invalidated on attachment save/delete.
 * Returns an empty manifest with 200 when no attachments are found.
 *
 * @param WP_REST_Request $request Incoming request (unused but required for consistency).
 * @return WP_REST_Response
 */

