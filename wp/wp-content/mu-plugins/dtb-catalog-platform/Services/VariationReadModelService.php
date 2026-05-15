<?php
/**
 * DTB_VariationReadModelService
 *
 * Fetches and normalizes all child variations for a variable product.
 * Returns an array of DTB Catalog Variation DTOs sorted by _dtb_variation_sort,
 * then by variation ID as a stable tie-breaker.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_VariationReadModelService {

	/** Fields requested from WC REST API for variations. */
	const VARIATION_FIELDS = 'id,sku,slug,name,type,status,price,regular_price,sale_price,on_sale,purchasable,stock_status,manage_stock,stock_quantity,images,attributes,meta_data,parent_id,description,short_description,backorders_allowed,backordered';

	/**
	 * Fetch and normalize all variations for a WC variable product.
	 *
	 * @param  int   $parent_id  WC product ID.
	 * @param  array $parent_wc  Raw parent WC product array (for image/meta fallback).
	 * @return array[]           Array of DTB variation DTOs.
	 */
	public static function get_normalized( int $parent_id, array $parent_wc ): array {
		if ( $parent_id <= 0 ) {
			return [];
		}

		$response = dtb_cached_wc_get(
			'wc/v3/products/' . $parent_id . '/variations',
			[
				'per_page' => 100,
				'_fields'  => self::VARIATION_FIELDS,
			]
		);

		if ( $response->get_status() !== 200 ) {
			return [];
		}

		$raw_vars = $response->get_data();
		if ( ! is_array( $raw_vars ) ) {
			return [];
		}

		$variations = [];
		foreach ( $raw_vars as $raw ) {
			// Stamp the type so the normalizer knows it's a variation.
			$raw['type'] = 'variation';
			$variations[] = DTB_CatalogProductNormalizer::normalize( $raw, $parent_wc );
		}

		// Sort by explicit sort weight, then by ID (stable ascending).
		usort( $variations, static function ( array $a, array $b ): int {
			$rank_a = $a['variation']['sort'] ?? 0;
			$rank_b = $b['variation']['sort'] ?? 0;
			if ( $rank_a !== $rank_b ) {
				return $rank_a <=> $rank_b;
			}
			return ( $a['id'] ?? 0 ) <=> ( $b['id'] ?? 0 );
		} );

		return $variations;
	}
}
