<?php
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

add_action( 'rest_api_init', 'dtb_register_schematics_endpoint' );

function dtb_register_schematics_endpoint() {
	register_rest_route(
		'dtb/v1',
		'/schematics/media',
		[
			'methods'             => WP_REST_Server::READABLE,
			'callback'            => 'dtb_get_schematic_media_manifest',
			'permission_callback' => '__return_true',
		]
	);
}

// Invalidate schematics manifest cache when attachments are saved or deleted.
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
function dtb_get_schematic_media_manifest( WP_REST_Request $request ): WP_REST_Response {
	$cached = get_transient( 'dtb_schematics_manifest' );
	if ( false !== $cached && is_array( $cached ) ) {
		$response = new WP_REST_Response( $cached, 200 );
		$response->header( 'Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400' );
		$response->header( 'Vary', 'Accept-Encoding' );
		return $response;
	}

	$attachments = get_posts(
		[
			'post_type'      => 'attachment',
			'post_status'    => 'inherit',
			'posts_per_page' => -1,
			'meta_query'     => [
				[
					'key'     => '_dtb_schematic_id',
					'compare' => 'EXISTS',
				],
				[
					'key'     => '_dtb_schematic_id',
					'value'   => '',
					'compare' => '!=',
				],
			],
		]
	);

	$manifest = [];

	/** @var WP_Post[] $attachments */
	foreach ( $attachments as $attachment ) {
		/** @var WP_Post $attachment */
		$id   = get_post_meta( $attachment->ID, '_dtb_schematic_id', true );
		$page = get_post_meta( $attachment->ID, '_dtb_schematic_page', true );
		$type = get_post_meta( $attachment->ID, '_dtb_schematic_type', true );

		if ( ! $id ) {
			continue;
		}

		if ( ! isset( $manifest[ $id ] ) ) {
			$manifest[ $id ] = [
				'pages'   => [],
				'preview' => null,
			];
		}

		$url  = wp_get_attachment_url( $attachment->ID );
		/** @var array|false $meta */
		$meta = wp_get_attachment_metadata( $attachment->ID );

		$entry = [
			'url'    => $url,
			'width'  => isset( $meta['width'] )  ? (int) $meta['width']  : null,
			'height' => isset( $meta['height'] ) ? (int) $meta['height'] : null,
		];

		if ( 'preview' === $type ) {
			$manifest[ $id ]['preview'] = $url;
		} else {
			$page_key = (string) ( $page ?: '1' );
			$manifest[ $id ]['pages'][ $page_key ] = $entry;
		}
	}

	// Sort pages within each schematic numerically.
	foreach ( $manifest as $id => &$data ) {
		uksort(
			$data['pages'],
			fn( $a, $b ) => (int) $a - (int) $b
		);
	}
	unset( $data );

	ksort( $manifest );

	// Cache for 1 hour — invalidated on attachment save/delete.
	set_transient( 'dtb_schematics_manifest', $manifest, HOUR_IN_SECONDS );

	$response = new WP_REST_Response( $manifest, 200 );
	$response->header( 'Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400' );
	$response->header( 'Vary', 'Accept-Encoding' );

	return $response;
}
