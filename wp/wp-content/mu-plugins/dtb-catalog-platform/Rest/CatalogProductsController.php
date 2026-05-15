<?php
/**
 * DTB_CatalogProductsController
 *
 * Handles:
 *   GET /wp-json/dtb/v1/catalog/products
 *
 * Returns a paginated list of normalized DTB catalog product DTOs.
 * Supports server-side filtering by brand, category, display_category,
 * tool_family, product_kind, builder_eligible, builder_slot, workflow_scope,
 * search, page, per_page, and sort.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_CatalogProductsController {

	public static function register_routes(): void {
		register_rest_route( 'dtb/v1', '/catalog/products', [
			'methods'             => 'GET',
			'callback'            => [ self::class, 'handle' ],
			'permission_callback' => '__return_true',
			'args'                => self::route_args(),
		] );
	}

	public static function handle( WP_REST_Request $request ): WP_REST_Response {
		if ( ! dtb_check_origin() ) {
			return new WP_REST_Response( dtb_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
		}

		$rl = dtb_rate_limit_get( 'wc/v3/products' );
		if ( $rl ) {
			return $rl;
		}

		$brand            = (string) ( $request->get_param( 'brand' )            ?? '' );
		$category         = (string) ( $request->get_param( 'category' )         ?? '' );
		$display_category = (string) ( $request->get_param( 'display_category' ) ?? '' );
		$tool_family      = (string) ( $request->get_param( 'tool_family' )      ?? '' );
		$product_kind     = (string) ( $request->get_param( 'product_kind' )     ?? '' );
		$builder_slot     = (string) ( $request->get_param( 'builder_slot' )     ?? '' );
		$workflow_scope   = (string) ( $request->get_param( 'workflow_scope' )   ?? '' );
		$search           = (string) ( $request->get_param( 'search' )           ?? '' );
		$page             = max( 1, absint( $request->get_param( 'page' )    ?? 1 ) );
		$per_page         = min( 100, max( 1, absint( $request->get_param( 'per_page' ) ?? 24 ) ) );
		$sort             = (string) ( $request->get_param( 'sort' ) ?? 'popular' );

		// Filters that can be resolved natively by WC REST API.
		$wc_params = [
			'status'   => 'publish',
			'per_page' => $per_page,
			'page'     => $page,
		];

		if ( '' !== $search ) {
			$wc_params['search'] = $search;
		}

		// Map DTB sort to WC orderby.
		switch ( $sort ) {
			case 'price-low':
				$wc_params['orderby'] = 'price';
				$wc_params['order']   = 'asc';
				break;
			case 'price-high':
				$wc_params['orderby'] = 'price';
				$wc_params['order']   = 'desc';
				break;
			case 'newest':
				$wc_params['orderby'] = 'date';
				$wc_params['order']   = 'desc';
				break;
			case 'az':
				$wc_params['orderby'] = 'title';
				$wc_params['order']   = 'asc';
				break;
			default:
				$wc_params['orderby'] = 'menu_order';
				$wc_params['order']   = 'asc';
				break;
		}

		$response = dtb_cached_wc_get( 'wc/v3/products', $wc_params );
		if ( $response->get_status() !== 200 ) {
			return $response;
		}

		$raw_products = $response->get_data();
		if ( ! is_array( $raw_products ) ) {
			return new WP_REST_Response(
				dtb_error_envelope( 'upstream_error', 'Unexpected response from product catalog.', 502 ),
				502
			);
		}

		// Normalize every product.
		$items = array_map( [ DTB_CatalogProductNormalizer::class, 'normalize' ], $raw_products );

		// Post-normalize filters (WC REST does not support these natively).
		if ( '' !== $brand ) {
			$items = array_values( array_filter( $items, static fn( $p ) =>
				$p['brand']['slug'] === $brand || $p['brand']['key'] === $brand
			) );
		}
		if ( '' !== $category ) {
			$items = array_values( array_filter( $items, static fn( $p ) =>
				$p['category']['key'] === $category
			) );
		}
		if ( '' !== $display_category ) {
			$items = array_values( array_filter( $items, static fn( $p ) =>
				$p['displayCategory']['key'] === $display_category ||
				$p['displayCategory']['slug'] === $display_category
			) );
		}
		if ( '' !== $tool_family ) {
			$items = array_values( array_filter( $items, static fn( $p ) =>
				$p['toolFamily'] === $tool_family
			) );
		}
		if ( '' !== $product_kind ) {
			$items = array_values( array_filter( $items, static fn( $p ) =>
				$p['productKind'] === $product_kind
			) );
		}
		if ( '' !== $builder_slot ) {
			$items = array_values( array_filter( $items, static fn( $p ) =>
				in_array( $builder_slot, $p['builder']['slots'], true )
			) );
		}
		if ( '' !== $workflow_scope ) {
			$items = array_values( array_filter( $items, static fn( $p ) =>
				in_array( $workflow_scope, $p['builder']['workflowScopes'], true )
			) );
		}

		// Read WC pagination headers.
		$headers     = $response->get_headers();
		$total       = (int) ( $headers['X-WP-Total'] ?? count( $items ) );
		$total_pages = (int) ( $headers['X-WP-TotalPages'] ?? 1 );

		return new WP_REST_Response( [
			'items'      => $items,
			'pagination' => [
				'page'       => $page,
				'perPage'    => $per_page,
				'total'      => $total,
				'totalPages' => $total_pages,
			],
		], 200 );
	}

	private static function route_args(): array {
		return [
			'brand'            => [ 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
			'category'         => [ 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
			'display_category' => [ 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
			'tool_family'      => [ 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
			'product_kind'     => [ 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
			'builder_eligible' => [ 'type' => 'integer', 'default' => 0 ],
			'builder_slot'     => [ 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
			'workflow_scope'   => [ 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
			'is_parts'         => [ 'type' => 'integer', 'default' => -1 ],
			'search'           => [ 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field' ],
			'page'             => [ 'type' => 'integer', 'default' => 1, 'minimum' => 1 ],
			'per_page'         => [ 'type' => 'integer', 'default' => 24, 'minimum' => 1, 'maximum' => 100 ],
			'sort'             => [ 'type' => 'string', 'default' => 'popular', 'sanitize_callback' => 'sanitize_text_field' ],
		];
	}
}
