<?php
/**
 * WooCommerce integration for Drywall Toolbox theme.
 *
 * @package Drywall_Toolbox
 */

defined( 'ABSPATH' ) || exit;

// Remove default WooCommerce stylesheet enqueueing.
add_filter( 'woocommerce_enqueue_styles', '__return_empty_array' );

// Remove default WooCommerce page title on archives.
add_filter( 'woocommerce_show_page_title', '__return_false' );

// Remove default WooCommerce breadcrumbs.
add_action(
	'init',
	function () {
		remove_action( 'woocommerce_before_main_content', 'woocommerce_breadcrumb', 20 );
	}
);

// Remove sidebar from WooCommerce pages.
add_action( 'woocommerce_sidebar', '__return_false', 999 );

// =========================================================
// Cart fragments – AJAX cart badge count update
// =========================================================

/**
 * Update cart badge fragments on AJAX add-to-cart.
 *
 * @param array $fragments Existing fragment data.
 * @return array Updated fragments.
 */
function dwtb_cart_fragments( $fragments ) {
	$count = WC()->cart->get_cart_contents_count();

	$fragments['#cart-count-desktop'] = '<span class="cart-badge" id="cart-count-desktop">' . esc_html( $count ) . '</span>';
	$fragments['#cart-count-mobile']  = '<span class="cart-badge" id="cart-count-mobile">' . esc_html( $count ) . '</span>';

	return $fragments;
}
add_filter( 'woocommerce_add_to_cart_fragments', 'dwtb_cart_fragments' );

// =========================================================
// Product loop wrappers
// =========================================================

/**
 * Replace the default product loop opening tag.
 *
 * @param string $html Default opening HTML.
 * @return string Custom opening HTML.
 */
function dwtb_product_loop_start( $html ) {
	return '<ul class="products dwtb-product-grid">';
}
add_filter( 'woocommerce_product_loop_start', 'dwtb_product_loop_start' );

/**
 * Replace the default product loop closing tag.
 *
 * @param string $html Default closing HTML.
 * @return string Custom closing HTML.
 */
function dwtb_product_loop_end( $html ) {
	return '</ul>';
}
add_filter( 'woocommerce_product_loop_end', 'dwtb_product_loop_end' );

// Set product columns to 3.
add_filter( 'loop_shop_columns', function () { return 3; } );

// =========================================================
// Body classes
// =========================================================

/**
 * Add custom body classes for WooCommerce pages.
 *
 * @param array $classes Existing body classes.
 * @return array Modified body classes.
 */
function dwtb_wc_body_classes( $classes ) {
	if ( function_exists( 'is_woocommerce' ) && is_woocommerce() ) {
		$classes[] = 'woocommerce-active';
	}
	if ( function_exists( 'is_cart' ) && is_cart() ) {
		$classes[] = 'page-cart';
	}
	if ( function_exists( 'is_checkout' ) && is_checkout() ) {
		$classes[] = 'page-checkout';
	}
	return $classes;
}
add_filter( 'body_class', 'dwtb_wc_body_classes' );

// =========================================================
// Declare WooCommerce feature compatibility
// =========================================================

add_action(
	'before_woocommerce_init',
	function () {
		if ( class_exists( '\Automattic\WooCommerce\Utilities\FeaturesUtil' ) ) {
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
				'custom_order_tables',
				get_template_directory() . '/functions.php',
				true
			);
			\Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility(
				'product_block_editor',
				get_template_directory() . '/functions.php',
				true
			);
		}
	}
);

// =========================================================
// Single product title override
// =========================================================

remove_action( 'woocommerce_single_product_summary', 'woocommerce_template_single_title', 5 );
add_action( 'woocommerce_single_product_summary', 'dwtb_single_product_title', 5 );

/**
 * Output a custom styled single-product title.
 */
function dwtb_single_product_title() {
	echo '<h1 class="product-title entry-title" style="font-size:clamp(1.5rem,4vw,2.5rem);font-weight:800;letter-spacing:-0.03em;color:#0f172a;margin-bottom:16px;">'
		. esc_html( get_the_title() )
		. '</h1>';
}

// =========================================================
// AJAX handlers
// =========================================================

/**
 * Build a normalised array of cart item data for the sidebar.
 *
 * @return array{items: array, total: string, count: int}
 */
function dwtb_build_cart_data() {
	$items = array();
	foreach ( WC()->cart->get_cart() as $key => $cart_item ) {
		/** @var WC_Product $product */
		$product = $cart_item['data'];
		$image   = wp_get_attachment_image_url( $product->get_image_id(), 'thumbnail' );
		if ( ! $image ) {
			$image = wc_placeholder_img_src( 'thumbnail' );
		}
		$items[] = array(
			'key'      => $key,
			'name'     => $product->get_name(),
			'price'    => wp_strip_all_tags( $product->get_price_html() ),
			'quantity' => $cart_item['quantity'],
			'image'    => $image,
		);
	}

	return array(
		'items' => $items,
		'total' => wp_strip_all_tags( WC()->cart->get_cart_total() ),
		'count' => WC()->cart->get_cart_contents_count(),
	);
}

/**
 * AJAX: Return current cart contents.
 */
function dwtb_ajax_get_cart() {
	check_ajax_referer( 'dwtb_cart_nonce', 'nonce' );
	wp_send_json_success( dwtb_build_cart_data() );
}
add_action( 'wp_ajax_dwtb_get_cart', 'dwtb_ajax_get_cart' );
add_action( 'wp_ajax_nopriv_dwtb_get_cart', 'dwtb_ajax_get_cart' );

/**
 * AJAX: Add a product to the cart.
 */
function dwtb_ajax_add_to_cart() {
	check_ajax_referer( 'dwtb_cart_nonce', 'nonce' );
	$product_id = isset( $_POST['product_id'] ) ? absint( $_POST['product_id'] ) : 0;
	$quantity   = isset( $_POST['quantity'] ) ? absint( $_POST['quantity'] ) : 1;

	if ( ! $product_id ) {
		wp_send_json_error( array( 'message' => __( 'Invalid product.', 'drywall-toolbox' ) ) );
	}

	$added = WC()->cart->add_to_cart( $product_id, $quantity );

	if ( $added ) {
		$data               = dwtb_build_cart_data();
		$data['cart_count'] = $data['count'];
		wp_send_json_success( $data );
	} else {
		wp_send_json_error( array( 'message' => __( 'Could not add to cart.', 'drywall-toolbox' ) ) );
	}
}
add_action( 'wp_ajax_dwtb_add_to_cart', 'dwtb_ajax_add_to_cart' );
add_action( 'wp_ajax_nopriv_dwtb_add_to_cart', 'dwtb_ajax_add_to_cart' );

/**
 * AJAX: Remove a cart item by its cart item key.
 */
function dwtb_ajax_remove_cart_item() {
	check_ajax_referer( 'dwtb_cart_nonce', 'nonce' );

	$item_key = isset( $_POST['item_key'] ) ? sanitize_text_field( wp_unslash( $_POST['item_key'] ) ) : '';

	if ( ! $item_key ) {
		wp_send_json_error( array( 'message' => __( 'Invalid item key.', 'drywall-toolbox' ) ) );
	}

	WC()->cart->remove_cart_item( $item_key );
	wp_send_json_success( dwtb_build_cart_data() );
}
add_action( 'wp_ajax_dwtb_remove_cart_item', 'dwtb_ajax_remove_cart_item' );
add_action( 'wp_ajax_nopriv_dwtb_remove_cart_item', 'dwtb_ajax_remove_cart_item' );
