<?php
/**
 * DTB Schematics Media API — Must-Use Plugin
 *
 * Registers custom attachment meta fields for schematic images and exposes a
 * single REST endpoint that returns the complete schematic image manifest.
 * The React SPA fetches this manifest once at runtime instead of referencing
 * hardcoded static file paths — making the images fully manageable from the
 * WordPress admin Media Library.
 *
 * REST endpoint:
 *   GET /wp-json/dtb/v1/schematics/media
 *   Returns: { "<schematic-id>": { "pages": { "1": { "url": "…", "width": n, "height": n }, … }, "preview": "…" }, … }
 *
 * Upload workflow:
 *   1. Run  scripts/convert_schematics_to_webp.py  to convert PNG/JPG → WebP.
 *   2. Run  scripts/upload_schematics_to_wp.py      to batch-upload to WP Media Library.
 *      The script sets the three meta fields below on every uploaded attachment.
 *   3. Once you confirm the manifest endpoint returns all expected images, you
 *      may delete the PNG/JPG originals from public/brands/*/Schematics/.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

// ─── Meta field registration ──────────────────────────────────────────────────

add_action( 'init', 'dtb_register_schematic_meta' );

function dtb_register_schematic_meta() {
	$shared = [
		'type'         => 'string',
		'single'       => true,
		'show_in_rest' => true,
	];

	// The schematic identifier (e.g. "columbia-matrix", "tapetech-extendable-support-handle").
	register_post_meta( 'attachment', '_dtb_schematic_id', $shared );

	// Diagram page number as a string ("1", "2", …).  "0" is reserved for preview images.
	register_post_meta( 'attachment', '_dtb_schematic_page', $shared );

	// "diagram" or "preview".
	register_post_meta( 'attachment', '_dtb_schematic_type', $shared );
}

// ─── REST endpoint ────────────────────────────────────────────────────────────

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

/**
 * Build and return the schematic image manifest.
 *
 * Queries all attachments that have a non-empty `_dtb_schematic_id` meta field,
 * then groups them into { id → { pages → { n → {url, width, height} }, preview } }.
 *
 * Response is cache-friendly (no user-specific data) — set a long Cache-Control
 * header so the CDN / browser can cache it.
 *
 * @return WP_REST_Response
 */
function dtb_get_schematic_media_manifest() {
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

	foreach ( $attachments as $attachment ) {
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
		$meta = wp_get_attachment_metadata( $attachment->ID );

		$entry = [
			'url'    => $url,
			'width'  => isset( $meta['width'] )  ? (int) $meta['width']  : null,
			'height' => isset( $meta['height'] ) ? (int) $meta['height'] : null,
		];

		if ( 'preview' === $type ) {
			$manifest[ $id ]['preview'] = $url;
		} else {
			// Normalise page to string key so JS object access is consistent.
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

	// Sort the manifest keys alphabetically for stable JSON output.
	ksort( $manifest );

	$response = new WP_REST_Response( $manifest, 200 );

	// Cache aggressively — content only changes when new media is uploaded.
	$response->header( 'Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400' );
	$response->header( 'Vary', 'Accept-Encoding' );

	return $response;
}
