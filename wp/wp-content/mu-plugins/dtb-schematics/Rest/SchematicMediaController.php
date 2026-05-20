<?php
defined( 'ABSPATH' ) || exit;

/**
 * DTB Schematics Media API - Must-Use Plugin
 *
 * Registers custom attachment meta fields for schematic images and exposes a
 * single REST endpoint that returns the complete schematic image manifest.
 * The React SPA fetches this manifest once at runtime instead of referencing
 * hardcoded static file paths - making the images fully manageable from the
 * WordPress admin Media Library.
 *
 * REST endpoint:
 *   GET /wp-json/dtb/v1/schematics/media
 *   Returns: JSON manifest mapping schematic IDs to pages and preview URLs.
 *
 * Upload workflow:
 *   1. Convert source PNG/JPG schematic images to WebP using
 *      scripts/convert_schematics_to_webp.py.
 *   2. Batch-upload converted WebP files with
 *      scripts/upload_schematics_to_wp.py (the script sets the attachment meta
 *      fields used by this endpoint).
 *   3. After verifying the manifest contains the uploaded images, you may
 *      remove original PNG/JPG files from the corresponding
 *      public/brands/<brand>/Schematics/ directories (replace <brand> as needed).
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// Only load this REST endpoint on admin or REST API requests.
if ( ! dtb_is_admin_or_rest_request() ) {
	return;
}

// --- Meta field registration -----------------------------------------------

add_action( 'init', 'dtb_register_schematic_meta' );

function dtb_register_schematic_meta() {
	$shared = [
		'type'         => 'string',
		'single'       => true,
		'show_in_rest' => true,
	];

	// The schematic identifier (e.g. "columbia-matrix", "tapetech-extendable-support-handle").
	register_post_meta( 'attachment', '_dtb_schematic_id', $shared );

	// Diagram page number as a string ("1", "2", ...).  "0" is reserved for preview images.
	register_post_meta( 'attachment', '_dtb_schematic_page', $shared );

	// "diagram" or "preview".
	register_post_meta( 'attachment', '_dtb_schematic_type', $shared );
}

// --- REST endpoint ---------------------------------------------------------


