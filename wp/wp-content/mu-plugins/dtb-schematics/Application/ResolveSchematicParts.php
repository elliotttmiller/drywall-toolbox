<?php
defined( 'ABSPATH' ) || exit;

/**
 * Resolve product IDs mapped to a schematic identifier.
 */
function dtb_schematics_resolve_product_ids_for_schematic( string $schematic_id ): array {
	if ( '' === trim( $schematic_id ) ) {
		return [];
	}

	$ids = get_posts(
		[
			'post_type'      => 'product',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'fields'         => 'ids',
			'meta_query'     => [
				[
					'key'     => '_dtb_schematic_id',
					'value'   => sanitize_text_field( $schematic_id ),
					'compare' => '=',
				],
			],
		]
	);

	return array_values( array_map( 'intval', (array) $ids ) );
}
