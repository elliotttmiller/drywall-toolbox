<?php
defined( 'ABSPATH' ) || exit;

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


