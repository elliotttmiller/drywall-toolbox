<?php
defined( 'ABSPATH' ) || exit;

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

	// Cache for 1 hour - invalidated on attachment save/delete.
	set_transient( 'dtb_schematics_manifest', $manifest, HOUR_IN_SECONDS );

	$response = new WP_REST_Response( $manifest, 200 );
	$response->header( 'Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400' );
	$response->header( 'Vary', 'Accept-Encoding' );

	return $response;
}
