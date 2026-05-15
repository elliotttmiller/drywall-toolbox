<?php
/**
 * DTB_CatalogFacetService
 *
 * Aggregates catalog facets (brands, categories, display categories) from all
 * published products and caches the result.  Provides the data behind
 * GET /wp-json/dtb/v1/catalog/facets.
 *
 * Cache is stored as a WP transient ('dtb_catalog_facets_v1') and invalidated
 * via the existing dtb_invalidate_product_cache() webhook path in dtb-cache.php.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_CatalogFacetService {

	const CACHE_KEY = 'dtb_catalog_facets_v1';
	const CACHE_TTL = 600; // 10 minutes

	/**
	 * Return cached facets or rebuild from WC.
	 *
	 * @return array{ brands: array[], categories: array[], displayCategoriesByBrand: array }
	 */
	public static function get(): array {
		$cached = get_transient( self::CACHE_KEY );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		$facets = self::build();
		set_transient( self::CACHE_KEY, $facets, self::CACHE_TTL );
		return $facets;
	}

	/** Invalidate the facets cache. Called by the product webhook handler. */
	public static function invalidate(): void {
		delete_transient( self::CACHE_KEY );
	}

	// ── Private ────────────────────────────────────────────────────────────────

	private static function build(): array {
		$brands              = [];
		$categories          = [];
		$display_by_brand    = [];

		$page     = 1;
		$per_page = 100;

		do {
			$response = dtb_cached_wc_get( 'wc/v3/products', [
				'status'   => 'publish',
				'per_page' => $per_page,
				'page'     => $page,
				'_fields'  => 'id,type,categories,meta_data,attributes,brands,name',
			] );

			if ( $response->get_status() !== 200 ) {
				break;
			}

			$batch = $response->get_data();
			if ( ! is_array( $batch ) || empty( $batch ) ) {
				break;
			}

			foreach ( $batch as $wc ) {
				$dto     = DTB_CatalogProductNormalizer::normalize( $wc );
				$brand   = $dto['brand'];
				$cat     = $dto['category'];
				$dis_cat = $dto['displayCategory'];

				if ( '' !== $brand['key'] ) {
					if ( ! isset( $brands[ $brand['key'] ] ) ) {
						$brands[ $brand['key'] ] = [
							'key'          => $brand['key'],
							'label'        => $brand['label'],
							'slug'         => $brand['slug'],
							'productCount' => 0,
						];
					}
					$brands[ $brand['key'] ]['productCount']++;
				}

				if ( '' !== $cat['key'] ) {
					if ( ! isset( $categories[ $cat['key'] ] ) ) {
						$categories[ $cat['key'] ] = [
							'key'          => $cat['key'],
							'label'        => $cat['label'],
							'slug'         => $cat['slug'],
							'productCount' => 0,
						];
					}
					$categories[ $cat['key'] ]['productCount']++;
				}

				if ( '' !== $brand['key'] && '' !== $dis_cat['key'] ) {
					if ( ! isset( $display_by_brand[ $brand['key'] ] ) ) {
						$display_by_brand[ $brand['key'] ] = [];
					}
					$dk = $dis_cat['key'];
					if ( ! isset( $display_by_brand[ $brand['key'] ][ $dk ] ) ) {
						$display_by_brand[ $brand['key'] ][ $dk ] = [
							'key'          => $dk,
							'label'        => $dis_cat['label'],
							'slug'         => $dis_cat['slug'],
							'productCount' => 0,
						];
					}
					$display_by_brand[ $brand['key'] ][ $dk ]['productCount']++;
				}
			}

			$page++;
		} while ( count( $batch ) === $per_page );

		$brands_arr = array_values( $brands );
		usort( $brands_arr, static fn( $a, $b ) => strcmp( $a['label'], $b['label'] ) );

		$cats_arr = array_values( $categories );
		usort( $cats_arr, static fn( $a, $b ) => strcmp( $a['label'], $b['label'] ) );

		$display_arr = [];
		foreach ( $display_by_brand as $bk => $dcs ) {
			$display_arr[ $bk ] = array_values( $dcs );
		}

		return [
			'brands'                   => $brands_arr,
			'categories'               => $cats_arr,
			'displayCategoriesByBrand' => $display_arr,
		];
	}
}
