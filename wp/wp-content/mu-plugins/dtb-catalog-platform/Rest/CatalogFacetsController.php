<?php
/**
 * DTB_CatalogFacetsController
 *
 * Handles GET /wp-json/dtb/v1/catalog/facets
 *
 * Returns canonical brand, category, and display-category facets for the
 * Products page filter UI.  Response is cached via DTB_CatalogFacetService.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

final class DTB_CatalogFacetsController {

	public static function register_routes(): void {
		register_rest_route( 'dtb/v1', '/catalog/facets', [
			'methods'             => 'GET',
			'callback'            => [ self::class, 'handle' ],
			'permission_callback' => '__return_true',
		] );
	}

	public static function handle( WP_REST_Request $request ): WP_REST_Response {
		if ( ! dtb_check_origin() ) {
			return new WP_REST_Response( dtb_error_envelope( 'forbidden_origin', 'Origin not allowed.', 403 ), 403 );
		}

		return new WP_REST_Response( DTB_CatalogFacetService::get(), 200 );
	}
}
