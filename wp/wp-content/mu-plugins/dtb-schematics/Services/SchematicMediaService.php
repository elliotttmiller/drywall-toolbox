<?php
defined( 'ABSPATH' ) || exit;

// ── Helpers ───────────────────────────────────────────────────────────────────

function dtb_get_schematics( $brand = '', $search = '', $paged = 1, $per_page = 20 ) {
	$meta_query = [
		[ 'key' => '_dtb_is_schematic', 'value' => '1', 'compare' => '=' ],
	];

	if ( $brand ) {
		$meta_query[] = [ 'key' => '_dtb_schematic_brand', 'value' => sanitize_text_field( $brand ), 'compare' => '=' ];
	}

	$args = [
		'post_type'      => 'attachment',
		'post_status'    => 'inherit',
		'posts_per_page' => (int) $per_page,
		'paged'          => (int) $paged,
		'meta_query'     => $meta_query,
		'orderby'        => 'meta_value',
		'meta_key'       => '_dtb_schematic_brand',
		'order'          => 'ASC',
	];

	if ( $search ) {
		$args['s'] = sanitize_text_field( $search );
	}

	$query = new WP_Query( $args );

	$items = [];
	foreach ( $query->posts as $post ) {
		$items[] = dtb_format_schematic( $post->ID );
	}

	return [
		'items' => $items,
		'total' => $query->found_posts,
		'pages' => $query->max_num_pages,
	];
}

function dtb_format_schematic( $attachment_id ) {
	$thumb      = wp_get_attachment_image_url( $attachment_id, 'thumbnail' );
	$full       = wp_get_attachment_url( $attachment_id );
	$product_ids = get_post_meta( $attachment_id, '_dtb_schematic_product_ids', true );
	$product_ids = is_array( $product_ids ) ? $product_ids : [];

	$linked_products = [];
	foreach ( $product_ids as $pid ) {
		$p = wc_get_product( (int) $pid );
		if ( $p ) {
			$linked_products[] = [ 'id' => $p->get_id(), 'name' => $p->get_name(), 'sku' => $p->get_sku() ];
		}
	}

	return [
		'id'           => $attachment_id,
		'brand'        => get_post_meta( $attachment_id, '_dtb_schematic_brand', true ),
		'model_number' => get_post_meta( $attachment_id, '_dtb_schematic_model_number', true ),
		'model_name'   => get_post_meta( $attachment_id, '_dtb_schematic_model_name', true ),
		'part_count'   => (int) get_post_meta( $attachment_id, '_dtb_schematic_part_count', true ),
		'notes'        => get_post_meta( $attachment_id, '_dtb_schematic_notes', true ),
		'thumb'        => $thumb ?: '',
		'url'          => $full ?: '',
		'filename'     => basename( $full ?: '' ),
		'products'     => $linked_products,
	];
}

function dtb_save_schematic_meta( $attachment_id, $data ) {
	update_post_meta( $attachment_id, '_dtb_is_schematic', '1' );
	update_post_meta( $attachment_id, '_dtb_schematic_brand', sanitize_text_field( $data['brand'] ?? '' ) );
	update_post_meta( $attachment_id, '_dtb_schematic_model_number', sanitize_text_field( $data['model_number'] ?? '' ) );
	update_post_meta( $attachment_id, '_dtb_schematic_model_name', sanitize_text_field( $data['model_name'] ?? '' ) );
	update_post_meta( $attachment_id, '_dtb_schematic_part_count', absint( $data['part_count'] ?? 0 ) );
	update_post_meta( $attachment_id, '_dtb_schematic_notes', sanitize_textarea_field( $data['notes'] ?? '' ) );

	$product_ids = array_map( 'absint', (array) ( $data['product_ids'] ?? [] ) );
	$product_ids = array_filter( $product_ids );
	update_post_meta( $attachment_id, '_dtb_schematic_product_ids', $product_ids );
}

// ── AJAX: Get schematics list ─────────────────────────────────────────────────

add_action( 'wp_ajax_dtb_schematics_list', 'dtb_ajax_schematics_list' );

