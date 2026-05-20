<?php
/**
 * DTB Product Mapping
 *
 * Three-tab admin tool:
 *   1. Variable Products — manage variable/variation parent-child relationships,
 *      product attributes, and create/link variation children.
 *   2. Parts Compatibility — map part products to the tool products they service.
 *   3. Upsells & Cross-sells — manage WooCommerce product relationships.
 *
 * @package DrywallToolbox
 */

defined( 'ABSPATH' ) || exit;

// Only load this admin UI tool when inside wp-admin or AJAX requests.
if ( ! dtb_is_admin_or_ajax_request() ) {
	return;
}

// ── Shared top-level DTB admin menu ──────────────────────────────────────────

if ( ! function_exists( 'dtb_register_top_level_menu' ) ) {
	function dtb_register_top_level_menu() {
		add_menu_page(
			__( 'Drywall Toolbox', 'dtb' ),
			__( 'DTB Tools', 'dtb' ),
			'manage_options',
			'dtb-toolbox',
			'dtb_toolbox_dashboard_page',
			'dashicons-hammer',
			30
		);
	}
	add_action( 'admin_menu', 'dtb_register_top_level_menu', 5 );
}

if ( ! function_exists( 'dtb_toolbox_dashboard_page' ) ) {
	function dtb_toolbox_dashboard_page() {
		echo '<div class="wrap"><h1>' . esc_html__( 'DTB Tools', 'dtb' ) . '</h1>';
		echo '<p>' . esc_html__( 'Select a tool from the menu on the left.', 'dtb' ) . '</p></div>';
	}
}

// ── Submenu ───────────────────────────────────────────────────────────────────

add_action( 'admin_menu', function () {
	add_submenu_page(
		'dtb-toolbox',
		__( 'Product Mapping', 'dtb' ),
		__( 'Product Mapping', 'dtb' ),
		'manage_woocommerce',
		'dtb-product-mapping',
		'dtb_product_mapping_render_page'
	);
} );

// ── AJAX: Search products ─────────────────────────────────────────────────────

add_action( 'wp_ajax_dtb_pm_search_products', 'dtb_ajax_pm_search_products' );
function dtb_ajax_pm_search_products() {
	check_ajax_referer( 'dtb_mapping_nonce', 'nonce' );
	if ( ! current_user_can( 'manage_woocommerce' ) ) wp_send_json_error( [], 403 );

	$q    = sanitize_text_field( $_POST['q'] ?? '' );
	$type = sanitize_text_field( $_POST['product_type'] ?? '' );

	$args = [
		'limit'  => 25,
		's'      => $q,
		'status' => 'publish',
		'return' => 'objects',
	];
	if ( $type ) {
		$args['type'] = explode( ',', $type );
	}

	$products = wc_get_products( $args );
	$results  = [];
	foreach ( $products as $p ) {
		$results[] = [
			'id'   => $p->get_id(),
			'name' => $p->get_name(),
			'sku'  => $p->get_sku(),
			'type' => $p->get_type(),
		];
	}

	wp_send_json_success( $results );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB 1: VARIABLE PRODUCTS
// ────────────────────────────────────────────────────────────────────────────

// Get all variable products with their variation children
add_action( 'wp_ajax_dtb_pm_get_variables', 'dtb_ajax_pm_get_variables' );
function dtb_ajax_pm_get_variables() {
	check_ajax_referer( 'dtb_mapping_nonce', 'nonce' );
	if ( ! current_user_can( 'manage_woocommerce' ) ) wp_send_json_error( [], 403 );

	$brand  = sanitize_text_field( $_POST['brand'] ?? '' );
	$search = sanitize_text_field( $_POST['search'] ?? '' );

	$tax_query = [];
	if ( $brand ) {
		$tax_query[] = [
			'taxonomy' => 'product_cat',
			'field'    => 'name',
			'terms'    => $brand,
			'operator' => 'LIKE',
		];
	}

	$variables = wc_get_products( [
		'type'      => 'variable',
		'limit'     => -1,
		'status'    => [ 'publish', 'draft' ],
		's'         => $search,
		'return'    => 'objects',
	] );

	$results = [];
	foreach ( $variables as $parent ) {
		if ( $brand ) {
			$product_brands = wp_get_post_terms( $parent->get_id(), 'product_brand', [ 'fields' => 'names' ] );
			// Try product attribute too
			$brand_attr = $parent->get_attribute( 'brand' );
			if ( ! in_array( $brand, (array) $product_brands ) && stripos( $brand_attr, $brand ) === false ) {
				// Filter by brand in product meta or tag instead
				$pa_brand = get_post_meta( $parent->get_id(), '_dtb_brand', true );
				if ( $pa_brand && stripos( $pa_brand, $brand ) === false ) {
					continue;
				}
			}
		}

		$variation_ids = $parent->get_children();
		$variations    = [];
		foreach ( $variation_ids as $vid ) {
			$v = wc_get_product( $vid );
			if ( ! $v ) continue;
			$attr_values = [];
			foreach ( $v->get_variation_attributes() as $key => $val ) {
				$attr_values[ wc_attribute_label( str_replace( 'attribute_pa_', '', $key ) ) ] = $val;
			}
			$variations[] = [
				'id'         => $v->get_id(),
				'sku'        => $v->get_sku(),
				'price'      => $v->get_regular_price(),
				'sale_price' => $v->get_sale_price(),
				'stock'      => $v->get_stock_quantity(),
				'in_stock'   => $v->is_in_stock(),
				'attributes' => $attr_values,
				'status'     => $v->get_status(),
			];
		}

		$attributes = [];
		foreach ( $parent->get_variation_attributes() as $attr_name => $attr_values ) {
			$attributes[] = [
				'name'   => wc_attribute_label( $attr_name ),
				'values' => is_array( $attr_values ) ? $attr_values : explode( '|', $attr_values ),
			];
		}

		$results[] = [
			'id'         => $parent->get_id(),
			'name'       => $parent->get_name(),
			'sku'        => $parent->get_sku(),
			'permalink'  => get_permalink( $parent->get_id() ),
			'attributes' => $attributes,
			'variations' => $variations,
		];
	}

	wp_send_json_success( $results );
}

// Save variation (create new or update existing)
add_action( 'wp_ajax_dtb_pm_save_variation', 'dtb_ajax_pm_save_variation' );
function dtb_ajax_pm_save_variation() {
	check_ajax_referer( 'dtb_mapping_nonce', 'nonce' );
	if ( ! current_user_can( 'manage_woocommerce' ) ) wp_send_json_error( [], 403 );

	$parent_id   = absint( $_POST['parent_id'] ?? 0 );
	$variation_id = absint( $_POST['variation_id'] ?? 0 );
	$sku          = sanitize_text_field( $_POST['sku'] ?? '' );
	$price        = wc_format_decimal( sanitize_text_field( $_POST['price'] ?? '' ) );
	$sale_price   = wc_format_decimal( sanitize_text_field( $_POST['sale_price'] ?? '' ) );
	$stock        = sanitize_text_field( $_POST['stock'] ?? '' );
	$attributes   = $_POST['attributes'] ?? [];

	if ( ! $parent_id ) wp_send_json_error( [ 'message' => 'Invalid parent product ID.' ] );

	$parent = wc_get_product( $parent_id );
	if ( ! $parent || $parent->get_type() !== 'variable' ) {
		wp_send_json_error( [ 'message' => 'Parent is not a variable product.' ] );
	}

	if ( $variation_id ) {
		$variation = wc_get_product( $variation_id );
		if ( ! $variation ) wp_send_json_error( [ 'message' => 'Variation not found.' ] );
	} else {
		$variation = new WC_Product_Variation();
		$variation->set_parent_id( $parent_id );
		$variation->set_status( 'publish' );
	}

	if ( $sku ) $variation->set_sku( $sku );
	if ( $price !== '' ) $variation->set_regular_price( $price );
	if ( $sale_price !== '' ) $variation->set_sale_price( $sale_price );
	if ( $stock !== '' ) {
		$variation->set_manage_stock( true );
		$variation->set_stock_quantity( (int) $stock );
	}

	// Set attributes
	$clean_attrs = [];
	foreach ( (array) $attributes as $attr_name => $attr_value ) {
		$taxonomy               = 'pa_' . sanitize_title( $attr_name );
		$clean_attrs[ $taxonomy ] = sanitize_text_field( $attr_value );
	}
	if ( $clean_attrs ) {
		$variation->set_attributes( $clean_attrs );
	}

	$saved_id = $variation->save();

	// Ensure parent gets attribute data synced
	WC_Product_Variable::sync( $parent_id );

	wp_send_json_success( [
		'variation_id' => $saved_id,
		'sku'          => $variation->get_sku(),
		'message'      => $variation_id ? 'Variation updated.' : 'Variation created.',
	] );
}

// Delete a variation
add_action( 'wp_ajax_dtb_pm_delete_variation', 'dtb_ajax_pm_delete_variation' );
function dtb_ajax_pm_delete_variation() {
	check_ajax_referer( 'dtb_mapping_nonce', 'nonce' );
	if ( ! current_user_can( 'manage_woocommerce' ) ) wp_send_json_error( [], 403 );

	$id = absint( $_POST['variation_id'] ?? 0 );
	$v  = wc_get_product( $id );
	if ( ! $v || $v->get_type() !== 'variation' ) {
		wp_send_json_error( [ 'message' => 'Variation not found.' ] );
	}
	$parent_id = $v->get_parent_id();
	wp_delete_post( $id, true );
	WC_Product_Variable::sync( $parent_id );
	wp_send_json_success( [ 'message' => 'Variation deleted.' ] );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB 2: PARTS COMPATIBILITY
// ────────────────────────────────────────────────────────────────────────────

// Get compatible tools for a part product (or compatible parts for a tool)
add_action( 'wp_ajax_dtb_pm_get_compatibility', 'dtb_ajax_pm_get_compatibility' );
function dtb_ajax_pm_get_compatibility() {
	check_ajax_referer( 'dtb_mapping_nonce', 'nonce' );
	if ( ! current_user_can( 'manage_woocommerce' ) ) wp_send_json_error( [], 403 );

	$product_id = absint( $_POST['product_id'] ?? 0 );
	$mode       = sanitize_text_field( $_POST['mode'] ?? 'part' ); // 'part' or 'tool'

	if ( ! $product_id ) wp_send_json_error( [ 'message' => 'No product ID.' ] );

	$meta_key = ( $mode === 'part' ) ? '_dtb_compatible_tools' : '_dtb_compatible_parts';
	$ids      = get_post_meta( $product_id, $meta_key, true );
	$ids      = is_array( $ids ) ? array_filter( array_map( 'absint', $ids ) ) : [];

	$related = [];
	foreach ( $ids as $rid ) {
		$p = wc_get_product( $rid );
		if ( $p ) {
			$related[] = [ 'id' => $p->get_id(), 'name' => $p->get_name(), 'sku' => $p->get_sku(), 'type' => $p->get_type() ];
		}
	}

	wp_send_json_success( [ 'product_id' => $product_id, 'mode' => $mode, 'related' => $related ] );
}

// Save compatibility mapping (bidirectional)
add_action( 'wp_ajax_dtb_pm_save_compatibility', 'dtb_ajax_pm_save_compatibility' );
function dtb_ajax_pm_save_compatibility() {
	check_ajax_referer( 'dtb_mapping_nonce', 'nonce' );
	if ( ! current_user_can( 'manage_woocommerce' ) ) wp_send_json_error( [], 403 );

	$part_id = absint( $_POST['part_id'] ?? 0 );
	$tool_id = absint( $_POST['tool_id'] ?? 0 );
	$action  = sanitize_text_field( $_POST['mapping_action'] ?? 'add' ); // 'add' or 'remove'

	if ( ! $part_id || ! $tool_id ) wp_send_json_error( [ 'message' => 'Both part ID and tool ID are required.' ] );

	// Part side: _dtb_compatible_tools
	$part_tools = get_post_meta( $part_id, '_dtb_compatible_tools', true );
	$part_tools = is_array( $part_tools ) ? $part_tools : [];

	// Tool side: _dtb_compatible_parts
	$tool_parts = get_post_meta( $tool_id, '_dtb_compatible_parts', true );
	$tool_parts = is_array( $tool_parts ) ? $tool_parts : [];

	if ( $action === 'add' ) {
		if ( ! in_array( $tool_id, $part_tools ) ) $part_tools[] = $tool_id;
		if ( ! in_array( $part_id, $tool_parts ) ) $tool_parts[] = $part_id;
	} else {
		$part_tools = array_values( array_filter( $part_tools, fn($id) => (int) $id !== $tool_id ) );
		$tool_parts = array_values( array_filter( $tool_parts, fn($id) => (int) $id !== $part_id ) );
	}

	update_post_meta( $part_id, '_dtb_compatible_tools', $part_tools );
	update_post_meta( $tool_id, '_dtb_compatible_parts', $tool_parts );

	wp_send_json_success( [ 'message' => $action === 'add' ? 'Compatibility added.' : 'Compatibility removed.' ] );
}

// Get parts list (products in Repair Kits & Parts categories)
add_action( 'wp_ajax_dtb_pm_get_parts', 'dtb_ajax_pm_get_parts' );
function dtb_ajax_pm_get_parts() {
	check_ajax_referer( 'dtb_mapping_nonce', 'nonce' );
	if ( ! current_user_can( 'manage_woocommerce' ) ) wp_send_json_error( [], 403 );

	$brand  = sanitize_text_field( $_POST['brand'] ?? '' );
	$search = sanitize_text_field( $_POST['search'] ?? '' );
	$paged  = absint( $_POST['paged'] ?? 1 );

	// Get part categories (containing "Repair Kits" or "Parts" in name)
	$part_cats = get_terms( [
		'taxonomy'   => 'product_cat',
		'hide_empty' => true,
		'name__like' => 'Parts',
	] );
	$part_cat2 = get_terms( [
		'taxonomy'   => 'product_cat',
		'hide_empty' => true,
		'name__like' => 'Repair Kits',
	] );

	$cat_ids = array_unique( array_merge(
		wp_list_pluck( is_array( $part_cats ) ? $part_cats : [], 'term_id' ),
		wp_list_pluck( is_array( $part_cat2 ) ? $part_cat2 : [], 'term_id' )
	) );

	$tax_q = [];
	if ( $cat_ids ) {
		$tax_q[] = [ 'taxonomy' => 'product_cat', 'field' => 'term_id', 'terms' => $cat_ids, 'operator' => 'IN' ];
	}

	$args = [
		'post_type'      => 'product',
		'post_status'    => 'publish',
		'posts_per_page' => 30,
		'paged'          => $paged,
		's'              => $search,
		'tax_query'      => $tax_q ?: [],
	];

	$query  = new WP_Query( $args );
	$items  = [];

	foreach ( $query->posts as $post ) {
		$p      = wc_get_product( $post->ID );
		$tools  = get_post_meta( $post->ID, '_dtb_compatible_tools', true );
		$tools  = is_array( $tools ) ? $tools : [];
		$linked = [];
		foreach ( $tools as $tid ) {
			$t = wc_get_product( $tid );
			if ( $t ) $linked[] = [ 'id' => $t->get_id(), 'name' => $t->get_name(), 'sku' => $t->get_sku() ];
		}
		$items[] = [
			'id'      => $post->ID,
			'name'    => $p->get_name(),
			'sku'     => $p->get_sku(),
			'linked'  => $linked,
		];
	}

	wp_send_json_success( [
		'items' => $items,
		'total' => $query->found_posts,
		'pages' => $query->max_num_pages,
	] );
}

// ────────────────────────────────────────────────────────────────────────────
// TAB 3: UPSELLS & CROSS-SELLS
// ────────────────────────────────────────────────────────────────────────────

add_action( 'wp_ajax_dtb_pm_get_relationships', 'dtb_ajax_pm_get_relationships' );
function dtb_ajax_pm_get_relationships() {
	check_ajax_referer( 'dtb_mapping_nonce', 'nonce' );
	if ( ! current_user_can( 'manage_woocommerce' ) ) wp_send_json_error( [], 403 );

	$product_id = absint( $_POST['product_id'] ?? 0 );
	if ( ! $product_id ) wp_send_json_error( [ 'message' => 'No product ID.' ] );

	$p = wc_get_product( $product_id );
	if ( ! $p ) wp_send_json_error( [ 'message' => 'Product not found.' ] );

	$format = function( $ids ) {
		$out = [];
		foreach ( $ids as $id ) {
			$r = wc_get_product( $id );
			if ( $r ) $out[] = [ 'id' => $r->get_id(), 'name' => $r->get_name(), 'sku' => $r->get_sku() ];
		}
		return $out;
	};

	wp_send_json_success( [
		'product_id'  => $product_id,
		'name'        => $p->get_name(),
		'sku'         => $p->get_sku(),
		'upsells'     => $format( $p->get_upsell_ids() ),
		'crosssells'  => $format( $p->get_cross_sell_ids() ),
	] );
}

add_action( 'wp_ajax_dtb_pm_save_relationships', 'dtb_ajax_pm_save_relationships' );
function dtb_ajax_pm_save_relationships() {
	check_ajax_referer( 'dtb_mapping_nonce', 'nonce' );
	if ( ! current_user_can( 'manage_woocommerce' ) ) wp_send_json_error( [], 403 );

	$product_id  = absint( $_POST['product_id'] ?? 0 );
	$upsell_raw  = $_POST['upsell_ids'] ?? '';
	$cross_raw   = $_POST['crosssell_ids'] ?? '';

	if ( ! $product_id ) wp_send_json_error( [ 'message' => 'No product ID.' ] );

	$p = wc_get_product( $product_id );
	if ( ! $p ) wp_send_json_error( [ 'message' => 'Product not found.' ] );

	$parse_ids = function( $raw ) {
		if ( is_array( $raw ) ) return array_filter( array_map( 'absint', $raw ) );
		if ( is_string( $raw ) && $raw !== '' ) return array_filter( array_map( 'absint', explode( ',', $raw ) ) );
		return [];
	};

	$p->set_upsell_ids( $parse_ids( $upsell_raw ) );
	$p->set_cross_sell_ids( $parse_ids( $cross_raw ) );
	$p->save();

	wp_send_json_success( [ 'message' => 'Relationships saved.' ] );
}

// ── Page Render ───────────────────────────────────────────────────────────────

function dtb_product_mapping_render_page() {
	$nonce  = wp_create_nonce( 'dtb_mapping_nonce' );
	$brands = [ 'Asgard', 'Columbia Taping Tools', 'Platinum Drywall Tools', 'SurPro', 'TapeTech' ];
	?>
	<div class="wrap dtb-mapping">
		<h1 class="wp-heading-inline">Product Mapping</h1>
		<hr class="wp-header-end">

		<style>
			.dtb-mapping { max-width:1200px; }
			.dtb-tabs { display:flex; gap:0; border-bottom:2px solid #dcdcde; margin:16px 0 0; }
			.dtb-tab { padding:10px 18px; cursor:pointer; font-size:13px; font-weight:600; color:#787c82; border:2px solid transparent; border-bottom:none; margin-bottom:-2px; border-radius:3px 3px 0 0; background:transparent; }
			.dtb-tab.active { color:#1d2327; border-color:#dcdcde; border-bottom-color:#fff; background:#fff; }
			.dtb-tab-panel { display:none; }
			.dtb-tab-panel.active { display:block; }
			.dtb-card { background:#fff; border:1px solid #dcdcde; border-radius:0 4px 4px 4px; padding:20px 24px; margin-bottom:16px; }
			.dtb-toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom:16px; }
			.dtb-btn { display:inline-flex; align-items:center; gap:5px; padding:7px 14px; border-radius:3px; font-size:13px; font-weight:600; cursor:pointer; border:1px solid transparent; }
			.dtb-btn-primary { background:#2271b1; color:#fff; border-color:#2271b1; }
			.dtb-btn-primary:hover { background:#135e96; color:#fff; }
			.dtb-btn-secondary { background:#f6f7f7; color:#2c3338; border-color:#c3c4c7; }
			.dtb-btn-secondary:hover { background:#f0f0f1; }
			.dtb-btn-danger { background:#fff; color:#d63638; border-color:#d63638; }
			.dtb-btn-danger:hover { background:#d63638; color:#fff; }
			.dtb-btn-sm { padding:3px 10px; font-size:12px; }
			.dtb-btn:disabled { opacity:.5; cursor:not-allowed; }
			.dtb-input,.dtb-select { padding:5px 9px; border:1px solid #c3c4c7; border-radius:3px; font-size:13px; }
			.dtb-tbl { width:100%; border-collapse:collapse; font-size:13px; }
			.dtb-tbl th { text-align:left; padding:9px 12px; border-bottom:2px solid #dcdcde; background:#f6f7f7; font-weight:600; }
			.dtb-tbl td { padding:9px 12px; border-bottom:1px solid #f0f0f1; vertical-align:top; }
			.dtb-tbl tr:last-child td { border-bottom:0; }
			.dtb-tbl tr:hover td { background:#fafafa; }
			.dtb-expand-btn { background:none; border:none; cursor:pointer; font-size:13px; color:#2271b1; font-weight:600; padding:0; }
			.dtb-var-table { width:100%; border-collapse:collapse; font-size:12px; margin-top:8px; }
			.dtb-var-table th { padding:6px 10px; border-bottom:1px solid #e5e5e5; background:#fafafa; font-weight:600; }
			.dtb-var-table td { padding:6px 10px; border-bottom:1px solid #f5f5f5; }
			.dtb-var-row:hover td { background:#f6f7f7; }
			.dtb-badge { display:inline-block; padding:2px 7px; border-radius:20px; font-size:11px; font-weight:600; }
			.dtb-badge-var { background:#e8f4fd; color:#1d6fa4; }
			.dtb-badge-part { background:#fdf3e8; color:#a05a00; }
			.dtb-badge-count { background:#f0f0f1; color:#3c434a; }
			.dtb-chip { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; background:#f0f0f1; border-radius:20px; font-size:11px; margin:2px; }
			.dtb-chip-remove { cursor:pointer; color:#d63638; font-weight:700; background:none; border:none; padding:0 0 0 2px; font-size:13px; line-height:1; }
			.dtb-chips-wrap { display:flex; flex-wrap:wrap; }
			.dtb-product-search-wrap { position:relative; }
			.dtb-product-dropdown { position:absolute; top:100%; left:0; right:0; background:#fff; border:1px solid #c3c4c7; border-top:0; border-radius:0 0 3px 3px; z-index:200; max-height:200px; overflow-y:auto; display:none; box-shadow:0 4px 8px rgba(0,0,0,.1); }
			.dtb-product-dropdown li { padding:7px 12px; cursor:pointer; font-size:12px; list-style:none; border-bottom:1px solid #f5f5f5; }
			.dtb-product-dropdown li:hover { background:#f0f0f1; }
			.dtb-product-dropdown ul { margin:0; padding:0; }
			.dtb-inline-form { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
			.dtb-inline-form input[type=text], .dtb-inline-form input[type=number] { padding:5px 8px; border:1px solid #c3c4c7; border-radius:3px; font-size:12px; }
			.dtb-modal-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.55); z-index:100000; align-items:center; justify-content:center; }
			.dtb-modal-overlay.open { display:flex; }
			.dtb-modal { background:#fff; border-radius:6px; padding:28px 32px; max-width:680px; width:92%; max-height:90vh; overflow-y:auto; position:relative; box-shadow:0 8px 32px rgba(0,0,0,.22); }
			.dtb-modal h3 { margin:0 0 14px; }
			.dtb-modal-close { position:absolute; top:14px; right:16px; font-size:22px; cursor:pointer; background:none; border:none; color:#787c82; }
			.dtb-form-row { margin-bottom:12px; }
			.dtb-form-row label { font-size:12px; font-weight:600; display:block; margin-bottom:3px; color:#3c434a; }
			.dtb-form-row input[type=text],.dtb-form-row input[type=number] { width:100%; padding:6px 9px; border:1px solid #c3c4c7; border-radius:3px; font-size:13px; box-sizing:border-box; }
			.dtb-pair-layout { display:grid; grid-template-columns:1fr 1fr; gap:20px; }
			.dtb-pair-col h4 { margin:0 0 10px; font-size:13px; color:#787c82; text-transform:uppercase; letter-spacing:.5px; font-weight:600; }
			.dtb-var-attr-tag { display:inline-block; background:#e8f4fd; color:#1d6fa4; font-size:11px; padding:1px 7px; border-radius:3px; margin:1px; font-family:monospace; }
			.dtb-empty { color:#787c82; font-size:13px; padding:16px 0; }
			.dtb-saved-msg { font-size:12px; padding:4px 0; }
			.dtb-saved-ok  { color:#1a7f37; }
			.dtb-saved-err { color:#d63638; }
			.dtb-section-note { font-size:12px; color:#787c82; margin-bottom:14px; }
		</style>

		<!-- Tabs -->
		<div class="dtb-tabs">
			<button class="dtb-tab active" data-tab="variables">Variable Products</button>
			<button class="dtb-tab" data-tab="parts">Parts Compatibility</button>
			<button class="dtb-tab" data-tab="relationships">Upsells &amp; Cross-sells</button>
		</div>

		<!-- ── TAB 1: Variable Products ──────────────────────────────────── -->
		<div id="dtb-tab-variables" class="dtb-tab-panel active">
			<div class="dtb-card">
				<p class="dtb-section-note">
					Manage variable products and their variation children. Each row expands to show existing variations (SKU, price, attributes) and lets you add or edit individual variations.
				</p>
				<div class="dtb-toolbar">
					<select id="dtb-var-brand" class="dtb-select">
						<option value="">All Brands</option>
						<?php foreach ( $brands as $b ) : ?>
							<option value="<?php echo esc_attr( $b ); ?>"><?php echo esc_html( $b ); ?></option>
						<?php endforeach; ?>
					</select>
					<input type="text" id="dtb-var-search" class="dtb-input" placeholder="Search by name or SKU…" style="min-width:220px;">
					<button id="dtb-btn-var-load" class="dtb-btn dtb-btn-secondary">
						<span class="dashicons dashicons-search" style="font-size:15px;"></span> Load
					</button>
					<span id="dtb-var-count" style="color:#787c82;font-size:13px;margin-left:auto;"></span>
				</div>
				<div id="dtb-var-loading" class="dtb-empty" style="display:none;">Loading…</div>
				<div id="dtb-var-container" style="display:none;">
					<table class="dtb-tbl">
						<thead><tr>
							<th style="width:32px;"></th>
							<th>SKU</th>
							<th>Product Name</th>
							<th>Attributes</th>
							<th>Variations</th>
							<th>Actions</th>
						</tr></thead>
						<tbody id="dtb-var-body"></tbody>
					</table>
				</div>
				<div id="dtb-var-empty" class="dtb-empty" style="display:none;">No variable products found.</div>
			</div>
		</div>

		<!-- ── TAB 2: Parts Compatibility ─────────────────────────────────── -->
		<div id="dtb-tab-parts" class="dtb-tab-panel">
			<div class="dtb-card">
				<p class="dtb-section-note">
					Map part products to the tool products they service. Relationships are bidirectional — linking a part to a tool also links the tool back to the part.
					The React SPA uses these mappings for the parts lookup and repairs page.
				</p>
				<div class="dtb-toolbar">
					<select id="dtb-parts-brand" class="dtb-select">
						<option value="">All Brands</option>
						<?php foreach ( $brands as $b ) : ?>
							<option value="<?php echo esc_attr( $b ); ?>"><?php echo esc_html( $b ); ?></option>
						<?php endforeach; ?>
					</select>
					<input type="text" id="dtb-parts-search" class="dtb-input" placeholder="Search parts…" style="min-width:220px;">
					<button id="dtb-btn-parts-load" class="dtb-btn dtb-btn-secondary">
						<span class="dashicons dashicons-search" style="font-size:15px;"></span> Load Parts
					</button>
				</div>
				<div id="dtb-parts-loading" class="dtb-empty" style="display:none;">Loading…</div>
				<div id="dtb-parts-container" style="display:none;">
					<table class="dtb-tbl">
						<thead><tr>
							<th>Part SKU</th>
							<th>Part Name</th>
							<th>Compatible With</th>
							<th>Add Tool</th>
						</tr></thead>
						<tbody id="dtb-parts-body"></tbody>
					</table>
					<div id="dtb-parts-pagination" class="dtb-toolbar" style="margin-top:12px;"></div>
				</div>
				<div id="dtb-parts-empty" class="dtb-empty" style="display:none;">No parts found.</div>
			</div>
		</div>

		<!-- ── TAB 3: Upsells & Cross-sells ──────────────────────────────── -->
		<div id="dtb-tab-relationships" class="dtb-tab-panel">
			<div class="dtb-card">
				<p class="dtb-section-note">
					Manage upsells (shown on product pages as premium alternatives) and cross-sells (shown in cart).
					Search for a product to view and edit its relationships.
				</p>
				<div class="dtb-toolbar">
					<div class="dtb-product-search-wrap" style="flex:1;max-width:380px;">
						<input type="text" id="dtb-rel-product-search" class="dtb-input" placeholder="Search for a product to manage…" style="width:100%;">
						<div class="dtb-product-dropdown" id="dtb-rel-product-dropdown"><ul></ul></div>
					</div>
					<span id="dtb-rel-selected-name" style="color:#787c82;font-size:13px;"></span>
					<input type="hidden" id="dtb-rel-product-id">
				</div>
				<div id="dtb-rel-editor" style="display:none;">
					<div class="dtb-pair-layout">
						<div class="dtb-pair-col">
							<h4>Upsells</h4>
							<p style="font-size:12px;color:#787c82;margin-top:0;">Shown on the product page as recommended upgrades.</p>
							<div class="dtb-product-search-wrap">
								<input type="text" id="dtb-upsell-search" class="dtb-input" placeholder="Add upsell product…" style="width:100%;">
								<div class="dtb-product-dropdown" id="dtb-upsell-dropdown"><ul></ul></div>
							</div>
							<div class="dtb-chips-wrap" id="dtb-upsell-chips" style="margin-top:8px;"></div>
							<input type="hidden" id="dtb-upsell-ids">
						</div>
						<div class="dtb-pair-col">
							<h4>Cross-sells</h4>
							<p style="font-size:12px;color:#787c82;margin-top:0;">Shown in the cart as complementary items.</p>
							<div class="dtb-product-search-wrap">
								<input type="text" id="dtb-cross-search" class="dtb-input" placeholder="Add cross-sell product…" style="width:100%;">
								<div class="dtb-product-dropdown" id="dtb-cross-dropdown"><ul></ul></div>
							</div>
							<div class="dtb-chips-wrap" id="dtb-cross-chips" style="margin-top:8px;"></div>
							<input type="hidden" id="dtb-crosssell-ids">
						</div>
					</div>
					<div style="margin-top:16px;display:flex;align-items:center;gap:10px;">
						<button id="dtb-btn-save-rel" class="dtb-btn dtb-btn-primary">Save Relationships</button>
						<span id="dtb-rel-spinner" style="display:none;"><span class="spinner is-active" style="float:none;margin:0;"></span></span>
						<span id="dtb-rel-msg" class="dtb-saved-msg"></span>
					</div>
				</div>
				<div id="dtb-rel-empty" class="dtb-empty">Search for a product above to get started.</div>
			</div>
		</div>

	</div>

	<!-- Variation Edit Modal -->
	<div class="dtb-modal-overlay" id="dtb-var-modal">
		<div class="dtb-modal">
			<button class="dtb-modal-close" id="dtb-var-modal-close">✕</button>
			<h3 id="dtb-var-modal-title">Add Variation</h3>
			<input type="hidden" id="dtb-var-modal-parent-id">
			<input type="hidden" id="dtb-var-modal-variation-id">
			<div class="dtb-form-row">
				<label>SKU</label>
				<input type="text" id="dtb-vmod-sku" placeholder="e.g. EZ07-AD">
			</div>
			<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
				<div class="dtb-form-row">
					<label>Regular Price ($)</label>
					<input type="number" id="dtb-vmod-price" placeholder="0.00" min="0" step="0.01">
				</div>
				<div class="dtb-form-row">
					<label>Sale Price ($)</label>
					<input type="number" id="dtb-vmod-sale" placeholder="0.00" min="0" step="0.01">
				</div>
			</div>
			<div class="dtb-form-row">
				<label>Stock Quantity</label>
				<input type="number" id="dtb-vmod-stock" placeholder="Leave blank to not manage" min="0">
			</div>
			<div id="dtb-vmod-attrs-wrap">
				<p style="font-size:12px;color:#787c82;margin-bottom:8px;">Attribute values for this variation:</p>
				<div id="dtb-vmod-attrs"></div>
			</div>
			<div style="display:flex;gap:10px;align-items:center;margin-top:16px;">
				<button id="dtb-vmod-save" class="dtb-btn dtb-btn-primary">Save Variation</button>
				<span id="dtb-vmod-spinner" style="display:none;"><span class="spinner is-active" style="float:none;margin:0;"></span></span>
				<button id="dtb-vmod-delete" class="dtb-btn dtb-btn-danger" style="margin-left:auto;display:none;">Delete Variation</button>
			</div>
			<div id="dtb-vmod-msg" style="margin-top:10px;font-size:13px;"></div>
		</div>
	</div>

	<script>
	(function($){
		var nonce      = <?php echo wp_json_encode( $nonce ); ?>;
		var partsPaged = 1;
		var partsTotal = 1;
		var currentVariables = [];
		var expandedRows = {};

		// ── Tabs ──────────────────────────────────────────────────────────────

		$('.dtb-tab').on('click', function(){
			$('.dtb-tab').removeClass('active');
			$('.dtb-tab-panel').removeClass('active');
			$(this).addClass('active');
			$('#dtb-tab-' + $(this).data('tab')).addClass('active');
		});

		// ── Generic product search factory ────────────────────────────────────

		function makeProductSearch(inputId, dropdownId, typeFilter, onSelect) {
			var timer;
			$('#' + inputId).on('input', function(){
				clearTimeout(timer);
				var q = $(this).val().trim();
				if (!q) { $('#' + dropdownId).hide(); return; }
				timer = setTimeout(function(){
					$.post(ajaxurl, {
						action: 'dtb_pm_search_products',
						nonce: nonce,
						q: q,
						product_type: typeFilter || ''
					}, function(res){
						if (!res.success || !res.data.length) { $('#' + dropdownId).hide(); return; }
						var html = '';
						$.each(res.data, function(i, p){
							html += '<li data-id="' + p.id + '" data-name="' + $('<div>').text(p.name).html() + '" data-sku="' + $('<div>').text(p.sku).html() + '">'
								+ $('<div>').text(p.name).html()
								+ ' <small style="color:#787c82">(' + $('<div>').text(p.sku).html() + ')</small></li>';
						});
						$('#' + dropdownId + ' ul').html(html);
						$('#' + dropdownId).show();
					});
				}, 250);
			});
			$(document).on('click', '#' + dropdownId + ' li', function(){
				var data = { id: $(this).data('id'), name: $(this).data('name'), sku: $(this).data('sku') };
				$('#' + dropdownId).hide();
				$('#' + inputId).val('');
				onSelect(data);
			});
		}

		$(document).on('click', function(e){
			if (!$(e.target).closest('.dtb-product-search-wrap').length) {
				$('.dtb-product-dropdown').hide();
			}
		});

		// ════════════════════════════════════════════════════════════════════
		// TAB 1: VARIABLE PRODUCTS
		// ════════════════════════════════════════════════════════════════════

		function renderAttrTags(attrs) {
			var html = '';
			$.each(attrs, function(i, a){
				html += '<span>' + $('<div>').text(a.name).html() + ': ';
				$.each(a.values, function(j, v){
					html += '<span class="dtb-var-attr-tag">' + $('<div>').text(v).html() + '</span>';
				});
				html += '</span> ';
			});
			return html || '—';
		}

		function renderVariationsTable(vars, parentId, attributes) {
			if (!vars || !vars.length) {
				return '<div class="dtb-empty" style="padding:8px 0;">No variations yet. <button class="dtb-btn dtb-btn-secondary dtb-btn-sm dtb-add-var-btn" data-parent="' + parentId + '" data-attrs=\'' + JSON.stringify(attributes) + '\'>+ Add First Variation</button></div>';
			}
			var html = '<table class="dtb-var-table"><thead><tr><th>SKU</th><th>Attributes</th><th>Price</th><th>Stock</th><th>Status</th><th></th></tr></thead><tbody>';
			$.each(vars, function(i, v){
				var attrStr = '';
				$.each(v.attributes, function(k, val){ attrStr += k + ': ' + val + ' '; });
				var stockStr = v.in_stock ? (v.stock !== null && v.stock !== undefined ? v.stock : '✓') : '✗';
				html += '<tr class="dtb-var-row">';
				html += '<td><code style="font-size:11px;">' + $('<div>').text(v.sku).html() + '</code></td>';
				html += '<td style="font-size:11px;">' + $('<div>').text(attrStr.trim()).html() + '</td>';
				html += '<td style="font-size:12px;">$' + (v.price || '—') + (v.sale_price ? ' <strike style="color:#c3c4c7;font-size:10px;">$' + v.sale_price + '</strike>' : '') + '</td>';
				html += '<td style="font-size:12px;">' + stockStr + '</td>';
				html += '<td style="font-size:11px;">' + v.status + '</td>';
				html += '<td><button class="dtb-btn dtb-btn-secondary dtb-btn-sm dtb-edit-var-btn" data-parent="' + parentId + '" data-varid="' + v.id + '" data-sku="' + $('<div>').text(v.sku).html() + '" data-price="' + v.price + '" data-sale="' + v.sale_price + '" data-stock="' + (v.stock !== null ? v.stock : '') + '" data-attrs=\'' + JSON.stringify(v.attributes) + '\' data-parent-attrs=\'' + JSON.stringify(attributes) + '\'>Edit</button></td>';
				html += '</tr>';
			});
			html += '</tbody></table>';
			html += '<button class="dtb-btn dtb-btn-secondary dtb-btn-sm dtb-add-var-btn" style="margin-top:8px;" data-parent="' + parentId + '" data-attrs=\'' + JSON.stringify(attributes) + '\'>+ Add Variation</button>';
			return html;
		}

		function loadVariables() {
			$('#dtb-var-loading').show();
			$('#dtb-var-container').hide();
			$('#dtb-var-empty').hide();
			$.post(ajaxurl, {
				action: 'dtb_pm_get_variables',
				nonce:  nonce,
				brand:  $('#dtb-var-brand').val(),
				search: $('#dtb-var-search').val()
			}, function(res){
				$('#dtb-var-loading').hide();
				if (!res.success || !res.data.length) { $('#dtb-var-empty').show(); return; }
				currentVariables = res.data;
				$('#dtb-var-count').text(res.data.length + ' variable product' + (res.data.length !== 1 ? 's' : ''));
				var rows = '';
				$.each(res.data, function(i, p){
					rows += '<tr id="dtb-var-row-' + p.id + '">';
					rows += '<td><button class="dtb-expand-btn" data-id="' + p.id + '">▶</button></td>';
					rows += '<td><code>' + $('<div>').text(p.sku).html() + '</code></td>';
					rows += '<td><a href="' + p.permalink + '" target="_blank">' + $('<div>').text(p.name).html() + '</a></td>';
					rows += '<td>' + renderAttrTags(p.attributes) + '</td>';
					rows += '<td><span class="dtb-badge dtb-badge-count">' + p.variations.length + ' variation' + (p.variations.length !== 1 ? 's' : '') + '</span></td>';
					rows += '<td></td>';
					rows += '</tr>';
					rows += '<tr id="dtb-var-detail-' + p.id + '" style="display:none;"><td colspan="6" style="background:#fafafa;padding:12px 20px;">' + renderVariationsTable(p.variations, p.id, p.attributes) + '</td></tr>';
				});
				$('#dtb-var-body').html(rows);
				$('#dtb-var-container').show();
			});
		}

		$('#dtb-btn-var-load').on('click', loadVariables);
		$('#dtb-var-search').on('keydown', function(e){ if(e.key==='Enter') loadVariables(); });

		// Expand row
		$(document).on('click', '.dtb-expand-btn', function(){
			var id = $(this).data('id');
			var $detail = $('#dtb-var-detail-' + id);
			var visible = $detail.is(':visible');
			$detail.toggle();
			$(this).text(visible ? '▶' : '▼');
		});

		// ── Variation modal ───────────────────────────────────────────────────

		function openVarModal(parentId, parentAttrs, varId, varData) {
			$('#dtb-var-modal-parent-id').val(parentId);
			$('#dtb-var-modal-variation-id').val(varId || '');
			$('#dtb-vmod-sku').val(varData ? varData.sku : '');
			$('#dtb-vmod-price').val(varData ? varData.price : '');
			$('#dtb-vmod-sale').val(varData ? varData.sale : '');
			$('#dtb-vmod-stock').val(varData ? varData.stock : '');
			$('#dtb-vmod-msg').text('');
			$('#dtb-vmod-delete').toggle(!!varId);
			$('#dtb-var-modal-title').text(varId ? 'Edit Variation' : 'Add Variation');

			// Build attribute fields
			var attrsHtml = '';
			if (Array.isArray(parentAttrs)) {
				$.each(parentAttrs, function(i, attr){
					var curVal = (varData && varData.attrs) ? (varData.attrs[attr.name] || '') : '';
					attrsHtml += '<div style="margin-bottom:8px;">';
					attrsHtml += '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px;">' + $('<div>').text(attr.name).html() + '</label>';
					if (Array.isArray(attr.values) && attr.values.length) {
						attrsHtml += '<select class="dtb-select dtb-vmod-attr-select" style="width:100%;" data-attr="' + $('<div>').text(attr.name).html() + '">';
						attrsHtml += '<option value="">— Select —</option>';
						$.each(attr.values, function(j, v){
							attrsHtml += '<option value="' + $('<div>').text(v).html() + '"' + (curVal === v ? ' selected' : '') + '>' + $('<div>').text(v).html() + '</option>';
						});
						attrsHtml += '</select>';
					} else {
						attrsHtml += '<input type="text" class="dtb-input dtb-vmod-attr-input" style="width:100%;" data-attr="' + $('<div>').text(attr.name).html() + '" value="' + $('<div>').text(curVal).html() + '">';
					}
					attrsHtml += '</div>';
				});
			} else if (varData && varData.attrs) {
				$.each(varData.attrs, function(k, v){
					attrsHtml += '<div style="margin-bottom:8px;">';
					attrsHtml += '<label style="font-size:12px;font-weight:600;display:block;margin-bottom:3px;">' + $('<div>').text(k).html() + '</label>';
					attrsHtml += '<input type="text" class="dtb-input dtb-vmod-attr-input" style="width:100%;" data-attr="' + $('<div>').text(k).html() + '" value="' + $('<div>').text(v).html() + '">';
					attrsHtml += '</div>';
				});
			}
			$('#dtb-vmod-attrs').html(attrsHtml || '<p style="color:#787c82;font-size:12px;">No attributes defined on parent product.</p>');
			$('#dtb-var-modal').addClass('open');
		}

		$(document).on('click', '.dtb-add-var-btn', function(){
			var parentId = $(this).data('parent');
			var attrs    = $(this).data('attrs');
			openVarModal(parentId, attrs, null, null);
		});

		$(document).on('click', '.dtb-edit-var-btn', function(){
			var $btn = $(this);
			openVarModal(
				$btn.data('parent'),
				$btn.data('parent-attrs'),
				$btn.data('varid'),
				{
					sku:   $btn.data('sku'),
					price: $btn.data('price'),
					sale:  $btn.data('sale'),
					stock: $btn.data('stock'),
					attrs: $btn.data('attrs')
				}
			);
		});

		$('#dtb-var-modal-close').on('click', function(){ $('#dtb-var-modal').removeClass('open'); });

		$('#dtb-vmod-save').on('click', function(){
			var $btn = $(this);
			var attrs = {};
			$('.dtb-vmod-attr-select, .dtb-vmod-attr-input').each(function(){
				attrs[$(this).data('attr')] = $(this).val();
			});
			$btn.prop('disabled', true);
			$('#dtb-vmod-spinner').show();
			$.post(ajaxurl, {
				action:       'dtb_pm_save_variation',
				nonce:        nonce,
				parent_id:    $('#dtb-var-modal-parent-id').val(),
				variation_id: $('#dtb-var-modal-variation-id').val(),
				sku:          $('#dtb-vmod-sku').val(),
				price:        $('#dtb-vmod-price').val(),
				sale_price:   $('#dtb-vmod-sale').val(),
				stock:        $('#dtb-vmod-stock').val(),
				attributes:   attrs
			}, function(res){
				$btn.prop('disabled', false);
				$('#dtb-vmod-spinner').hide();
				if (res.success) {
					$('#dtb-vmod-msg').text('✓ ' + res.data.message).css('color','#1a7f37');
					setTimeout(function(){ $('#dtb-var-modal').removeClass('open'); loadVariables(); }, 700);
				} else {
					$('#dtb-vmod-msg').text('✗ ' + (res.data && res.data.message ? res.data.message : 'Save failed.')).css('color','#d63638');
				}
			});
		});

		$('#dtb-vmod-delete').on('click', function(){
			if (!confirm('Delete this variation? This cannot be undone.')) return;
			$.post(ajaxurl, {
				action:       'dtb_pm_delete_variation',
				nonce:        nonce,
				variation_id: $('#dtb-var-modal-variation-id').val()
			}, function(res){
				if (res.success) { $('#dtb-var-modal').removeClass('open'); loadVariables(); }
			});
		});

		// ════════════════════════════════════════════════════════════════════
		// TAB 2: PARTS COMPATIBILITY
		// ════════════════════════════════════════════════════════════════════

		function loadParts(p) {
			partsPaged = p || 1;
			$('#dtb-parts-loading').show();
			$('#dtb-parts-container,#dtb-parts-empty').hide();
			$.post(ajaxurl, {
				action: 'dtb_pm_get_parts',
				nonce:  nonce,
				brand:  $('#dtb-parts-brand').val(),
				search: $('#dtb-parts-search').val(),
				paged:  partsPaged
			}, function(res){
				$('#dtb-parts-loading').hide();
				if (!res.success || !res.data.items.length) { $('#dtb-parts-empty').show(); return; }
				partsTotal = res.data.pages;
				var rows = '';
				$.each(res.data.items, function(i, part){
					var chips = '';
					$.each(part.linked, function(j, t){
						chips += '<span class="dtb-chip">' + $('<div>').text(t.sku || t.name).html() + '<button class="dtb-chip-remove dtb-parts-unlink" type="button" data-part="' + part.id + '" data-tool="' + t.id + '">×</button></span>';
					});
					rows += '<tr>';
					rows += '<td><code style="font-size:11px;">' + $('<div>').text(part.sku).html() + '</code></td>';
					rows += '<td style="font-size:12px;">' + $('<div>').text(part.name).html() + '</td>';
					rows += '<td><div class="dtb-chips-wrap" id="dtb-parts-chips-' + part.id + '">' + (chips || '<span style="color:#c3c4c7;font-size:11px;">none</span>') + '</div></td>';
					rows += '<td><div class="dtb-product-search-wrap" style="min-width:180px;">';
					rows += '<input type="text" class="dtb-input dtb-parts-tool-search" placeholder="Add tool…" style="width:100%;font-size:12px;" data-part="' + part.id + '">';
					rows += '<div class="dtb-product-dropdown dtb-parts-tool-dropdown" id="dtb-tool-dd-' + part.id + '"><ul></ul></div>';
					rows += '</div></td>';
					rows += '</tr>';
				});
				$('#dtb-parts-body').html(rows);

				var pg = '';
				if (partsTotal > 1) {
					pg += '<button class="dtb-btn dtb-btn-secondary dtb-btn-sm" id="dtb-parts-prev"' + (partsPaged<=1?' disabled':'') + '>‹</button>';
					pg += '<span style="font-size:13px;">Page ' + partsPaged + ' / ' + partsTotal + '</span>';
					pg += '<button class="dtb-btn dtb-btn-secondary dtb-btn-sm" id="dtb-parts-next"' + (partsPaged>=partsTotal?' disabled':'') + '>›</button>';
				}
				$('#dtb-parts-pagination').html(pg);
				$('#dtb-parts-container').show();

				initPartsToolSearches();
			});
		}

		$('#dtb-btn-parts-load').on('click', function(){ loadParts(1); });
		$('#dtb-parts-search').on('keydown', function(e){ if(e.key==='Enter') loadParts(1); });
		$(document).on('click','#dtb-parts-prev',function(){ if(partsPaged>1) loadParts(partsPaged-1); });
		$(document).on('click','#dtb-parts-next',function(){ if(partsPaged<partsTotal) loadParts(partsPaged+1); });

		function initPartsToolSearches() {
			var timer;
			$(document).off('input','.dtb-parts-tool-search').on('input', '.dtb-parts-tool-search', function(){
				clearTimeout(timer);
				var $input  = $(this);
				var partId  = $input.data('part');
				var q       = $input.val().trim();
				var $dd     = $('#dtb-tool-dd-' + partId);
				if (!q) { $dd.hide(); return; }
				timer = setTimeout(function(){
					$.post(ajaxurl, {
						action: 'dtb_pm_search_products',
						nonce:  nonce,
						q:      q,
						product_type: 'simple,variable'
					}, function(res){
						if (!res.success || !res.data.length) { $dd.hide(); return; }
						var items = '';
						$.each(res.data, function(i, p){
							items += '<li data-id="' + p.id + '" data-sku="' + $('<div>').text(p.sku).html() + '" data-name="' + $('<div>').text(p.name).html() + '">'
								+ $('<div>').text(p.name).html()
								+ ' <small style="color:#787c82">(' + $('<div>').text(p.sku).html() + ')</small></li>';
						});
						$dd.find('ul').html(items);
						$dd.show();
					});
				}, 250);
			});
		}

		$(document).on('click', '.dtb-parts-tool-dropdown li', function(){
			var $li     = $(this);
			var $dd     = $li.closest('.dtb-product-dropdown');
			var $row    = $li.closest('td').closest('tr');
			var partId  = $row.find('.dtb-parts-tool-search').data('part');
			var toolId  = $li.data('id');
			var toolSku = $li.data('sku');
			$dd.hide();
			$dd.prev('input').val('');

			$.post(ajaxurl, {
				action:         'dtb_pm_save_compatibility',
				nonce:          nonce,
				part_id:        partId,
				tool_id:        toolId,
				mapping_action: 'add'
			}, function(res){
				if (res.success) {
					var chip = '<span class="dtb-chip">' + $('<div>').text(toolSku).html() + '<button class="dtb-chip-remove dtb-parts-unlink" type="button" data-part="' + partId + '" data-tool="' + toolId + '">×</button></span>';
					var $chips = $('#dtb-parts-chips-' + partId);
					$chips.find('span[style*="color"]').remove();
					$chips.append(chip);
				}
			});
		});

		$(document).on('click', '.dtb-parts-unlink', function(){
			var $btn   = $(this);
			var partId = $btn.data('part');
			var toolId = $btn.data('tool');
			$.post(ajaxurl, {
				action:         'dtb_pm_save_compatibility',
				nonce:          nonce,
				part_id:        partId,
				tool_id:        toolId,
				mapping_action: 'remove'
			}, function(res){
				if (res.success) {
					$btn.closest('.dtb-chip').remove();
				}
			});
		});

		// ════════════════════════════════════════════════════════════════════
		// TAB 3: UPSELLS & CROSS-SELLS
		// ════════════════════════════════════════════════════════════════════

		function chipHtml(id, name, sku, type) {
			return '<span class="dtb-chip">' + $('<div>').text(sku || name).html() + '<button class="dtb-chip-remove dtb-rel-chip-remove" type="button" data-id="' + id + '" data-type="' + type + '">×</button></span>';
		}

		function addRelChip(type, p) {
			var idsInput = type === 'upsell' ? '#dtb-upsell-ids' : '#dtb-crosssell-ids';
			var chipsWrap = type === 'upsell' ? '#dtb-upsell-chips' : '#dtb-cross-chips';
			var cur  = $(idsInput).val();
			var ids  = cur ? cur.split(',').map(Number) : [];
			if (ids.indexOf(p.id) !== -1) return;
			ids.push(p.id);
			$(idsInput).val(ids.join(','));
			$(chipsWrap).append(chipHtml(p.id, p.name, p.sku, type));
		}

		makeProductSearch('dtb-rel-product-search', 'dtb-rel-product-dropdown', 'simple,variable', function(p){
			$('#dtb-rel-product-id').val(p.id);
			$('#dtb-rel-selected-name').text('Editing: ' + p.name + ' (' + p.sku + ')');
			$('#dtb-rel-msg').text('');
			$('#dtb-upsell-ids,#dtb-crosssell-ids').val('');
			$('#dtb-upsell-chips,#dtb-cross-chips').empty();
			$('#dtb-rel-empty').hide();
			$('#dtb-rel-editor').hide();

			$.post(ajaxurl, {
				action:     'dtb_pm_get_relationships',
				nonce:      nonce,
				product_id: p.id
			}, function(res){
				if (!res.success) return;
				var d = res.data;
				var uIds = [], cIds = [];
				$.each(d.upsells, function(i, u){ uIds.push(u.id); $('#dtb-upsell-chips').append(chipHtml(u.id, u.name, u.sku, 'upsell')); });
				$.each(d.crosssells, function(i, c){ cIds.push(c.id); $('#dtb-cross-chips').append(chipHtml(c.id, c.name, c.sku, 'cross')); });
				$('#dtb-upsell-ids').val(uIds.join(','));
				$('#dtb-crosssell-ids').val(cIds.join(','));
				$('#dtb-rel-editor').show();
			});
		});

		makeProductSearch('dtb-upsell-search', 'dtb-upsell-dropdown', '', function(p){ addRelChip('upsell', p); });
		makeProductSearch('dtb-cross-search', 'dtb-cross-dropdown', '', function(p){ addRelChip('cross', p); });

		$(document).on('click', '.dtb-rel-chip-remove', function(){
			var id   = $(this).data('id');
			var type = $(this).data('type');
			var idsInput = type === 'upsell' ? '#dtb-upsell-ids' : '#dtb-crosssell-ids';
			var cur  = $(idsInput).val();
			var ids  = cur ? cur.split(',').map(Number).filter(function(x){ return x !== id; }) : [];
			$(idsInput).val(ids.join(','));
			$(this).closest('.dtb-chip').remove();
		});

		$('#dtb-btn-save-rel').on('click', function(){
			var $btn = $(this);
			var pid  = $('#dtb-rel-product-id').val();
			if (!pid) return;
			$btn.prop('disabled', true);
			$('#dtb-rel-spinner').show();
			$.post(ajaxurl, {
				action:        'dtb_pm_save_relationships',
				nonce:         nonce,
				product_id:    pid,
				upsell_ids:    $('#dtb-upsell-ids').val(),
				crosssell_ids: $('#dtb-crosssell-ids').val()
			}, function(res){
				$btn.prop('disabled', false);
				$('#dtb-rel-spinner').hide();
				$('#dtb-rel-msg')
					.text(res.success ? '✓ Saved.' : '✗ Save failed.')
					.removeClass('dtb-saved-ok dtb-saved-err')
					.addClass(res.success ? 'dtb-saved-ok' : 'dtb-saved-err');
			});
		});

	})(jQuery);
	</script>
	<?php
}