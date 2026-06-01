<?php
defined( 'ABSPATH' ) || exit;

if ( class_exists( 'DTB_CatalogProductRepository' ) ) {
	return;
}

/**
 * DTB_CatalogProductRepository
 *
 * Query layer for the DTB catalog listing endpoint.
 *
 * Applies all supported filters in WP_Query before pagination so totals and
 * page counts remain correct for filtered catalog views.
 *
 * Important catalog rule:
 * - The canonical `/products` surface may include tools and parts.
 * - Customer-facing tool display categories must not include replacement parts.
 * - Replacement parts are exposed through the dedicated `parts` display bucket.
 *
 * @package drywall-toolbox
 */
final class DTB_CatalogProductRepository {

	/**
	 * Return a paginated set of product IDs and totals for the current filter set.
	 *
	 * @param  array $filters
	 * @return array{ ids: int[], page: int, perPage: int, total: int, totalPages: int }
	 */
	public static function find_ids( array $filters ): array {
		$page     = max( 1, absint( $filters['page'] ?? 1 ) );
		$per_page = min( 100, max( 1, absint( $filters['per_page'] ?? 24 ) ) );
		$sort     = (string) ( $filters['sort'] ?? 'popular' );
		$search   = (string) ( $filters['search'] ?? '' );

		$args = [
			'post_type'           => 'product',
			'post_status'         => 'publish',
			'ignore_sticky_posts' => true,
			'fields'              => 'ids',
			'posts_per_page'      => $per_page,
			'paged'               => $page,
			'no_found_rows'       => false,
		];

		if ( '' !== $search ) {
			$args['s'] = $search;
		}

		$args = array_merge( $args, self::sort_args( $sort ) );

		$meta_query = [ 'relation' => 'AND' ];

		$brand = (string) ( $filters['brand'] ?? '' );
		if ( '' !== $brand ) {
			$label = DTB_BrandNormalizer::label_from_slug( $brand );
			if ( '' !== $label ) {
				$meta_query[] = [
					'relation' => 'OR',
					[
						'key'     => DTB_ProductMeta::BRAND_KEY,
						'value'   => $brand,
						'compare' => '=',
					],
					[
						'key'     => DTB_ProductMeta::BRAND_LABEL,
						'value'   => $label,
						'compare' => '=',
					],
				];
			} else {
				$meta_query[] = [
					'key'     => DTB_ProductMeta::BRAND_KEY,
					'value'   => $brand,
					'compare' => '=',
				];
			}
		}

		$category = (string) ( $filters['category'] ?? '' );
		if ( '' !== $category ) {
			$meta_query[] = [
				'key'     => DTB_ProductMeta::CATEGORY_KEY,
				'value'   => $category,
				'compare' => '=',
			];
		}

		$is_parts_constrained  = false;
		$display_category_slug = sanitize_title( (string) ( $filters['display_category'] ?? '' ) );
		$display_category_key  = str_replace( '-', '_', $display_category_slug );
		if ( '' !== $display_category_slug ) {
			if ( self::is_parts_display_category( $display_category_slug ) ) {
				$meta_query[] = [
					'key'     => DTB_ProductMeta::IS_PARTS,
					'value'   => '1',
					'compare' => '=',
				];
				$is_parts_constrained = true;
			} else {
				// Build all normalised forms of the display-category key so products
				// imported with hyphens, underscores, spaces, or title-case are matched.
				$space_form   = str_replace( '_', ' ', $display_category_key );
				$title_form   = ucwords( $space_form );
				$meta_query[] = [
					'key'     => DTB_ProductMeta::DISPLAY_CATEGORY_KEY,
					'value'   => array_values( array_unique( array_filter( [
						$display_category_key,
						$display_category_slug,
						$space_form,
						$title_form,
					] ) ) ),
					'compare' => 'IN',
				];

				// Tool/category filters must not leak schematic replacement parts.
				// Use NOT EXISTS OR != '1' so products whose meta is absent are
				// treated as non-parts (handles legacy imports without this key).
				if ( ! array_key_exists( 'is_parts', $filters ) || null === $filters['is_parts'] ) {
					$meta_query[] = [
						'relation' => 'OR',
						[
							'key'     => DTB_ProductMeta::IS_PARTS,
							'value'   => '1',
							'compare' => '!=',
						],
						[
							'key'     => DTB_ProductMeta::IS_PARTS,
							'compare' => 'NOT EXISTS',
						],
					];
					$is_parts_constrained = true;
				}
			}
		}

		$tool_family = (string) ( $filters['tool_family'] ?? '' );
		if ( '' !== $tool_family ) {
			$meta_query[] = [
				'key'     => DTB_ProductMeta::TOOL_FAMILY,
				'value'   => $tool_family,
				'compare' => '=',
			];
		}

		$product_kind = (string) ( $filters['product_kind'] ?? '' );
		if ( '' !== $product_kind ) {
			$meta_query[] = [
				'key'     => DTB_ProductMeta::PRODUCT_KIND,
				'value'   => $product_kind,
				'compare' => '=',
			];
		}

		if ( isset( $filters['builder_eligible'] ) && null !== $filters['builder_eligible'] ) {
			$meta_query[] = [
				'key'     => DTB_ProductMeta::BUILDER_ELIGIBLE,
				'value'   => (int) $filters['builder_eligible'] ? '1' : '0',
				'compare' => '=',
			];
		}

		if ( ! $is_parts_constrained && isset( $filters['is_parts'] ) && null !== $filters['is_parts'] ) {
			if ( (int) $filters['is_parts'] ) {
				// Requesting parts: require the flag to be explicitly set to '1'.
				$meta_query[] = [
					'key'     => DTB_ProductMeta::IS_PARTS,
					'value'   => '1',
					'compare' => '=',
				];
			} else {
				// Requesting non-parts: include products whose meta is absent
				// (legacy imports) as well as those explicitly set to a non-'1' value.
				$meta_query[] = [
					'relation' => 'OR',
					[
						'key'     => DTB_ProductMeta::IS_PARTS,
						'value'   => '1',
						'compare' => '!=',
					],
					[
						'key'     => DTB_ProductMeta::IS_PARTS,
						'compare' => 'NOT EXISTS',
					],
				];
			}
		}

		$builder_slot = (string) ( $filters['builder_slot'] ?? '' );
		if ( '' !== $builder_slot ) {
			$meta_query[] = self::meta_token_query( DTB_ProductMeta::BUILDER_SLOTS, $builder_slot );
		}

		$workflow_scope = (string) ( $filters['workflow_scope'] ?? '' );
		if ( '' !== $workflow_scope ) {
			$meta_query[] = self::meta_token_query( DTB_ProductMeta::WORKFLOW_SCOPES, $workflow_scope );
		}

		if ( count( $meta_query ) > 1 ) {
			$args['meta_query'] = $meta_query;
		}

		$query = new WP_Query( $args );

		$ids         = array_values( array_map( 'absint', $query->posts ?? [] ) );
		$total       = absint( $query->found_posts );
		$total_pages = max( 1, absint( $query->max_num_pages ) );

		return [
			'ids'        => $ids,
			'page'       => $page,
			'perPage'    => $per_page,
			'total'      => $total,
			'totalPages' => $total_pages,
		];
	}

	/**
	 * True when a customer-facing display-category selection is the dedicated
	 * replacement parts bucket.
	 */
	private static function is_parts_display_category( string $display_category ): bool {
		return in_array( sanitize_title( $display_category ), [ 'parts', 'repair-parts', 'replacement-parts' ], true );
	}

	/**
	 * Build a token-aware meta query for CSV or serialized-array values.
	 *
	 * @param  string $meta_key
	 * @param  string $token
	 * @return array
	 */
	private static function meta_token_query( string $meta_key, string $token ): array {
		$token = sanitize_text_field( $token );

		return [
			'relation' => 'OR',
			[
				'key'     => $meta_key,
				'value'   => $token,
				'compare' => '=',
			],
			[
				'key'     => $meta_key,
				'value'   => '"' . $token . '"',
				'compare' => 'LIKE',
			],
			[
				'key'     => $meta_key,
				'value'   => $token,
				'compare' => 'LIKE',
			],
		];
	}

	/**
	 * Map API sort keys to WP_Query order args.
	 *
	 * @param  string $sort
	 * @return array
	 */
	private static function sort_args( string $sort ): array {
		switch ( $sort ) {
			case 'price-low':
				return [
					'meta_key' => '_price',
					'orderby'  => 'meta_value_num',
					'order'    => 'ASC',
				];
			case 'price-high':
				return [
					'meta_key' => '_price',
					'orderby'  => 'meta_value_num',
					'order'    => 'DESC',
				];
			case 'newest':
				return [
					'orderby' => 'date',
					'order'   => 'DESC',
				];
			case 'az':
				return [
					'orderby' => 'title',
					'order'   => 'ASC',
				];
			case 'popular':
			default:
				return [
					'orderby' => [
						'menu_order' => 'ASC',
						'title'      => 'ASC',
					],
					'order'   => 'ASC',
				];
		}
	}
}
