<?php
/**
 * DTB Product Order Dashboard Panel — product-order metabox on product screens.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'add_meta_boxes', 'dtb_product_order_admin_register_metabox' );

function dtb_product_order_admin_register_metabox(): void {
	add_meta_box(
		'dtb-product-orders',
		__( 'DTB Orders for this Product', 'drywall-toolbox' ),
		'dtb_product_order_admin_metabox_render',
		'product',
		'normal',
		'default'
	);
}

function dtb_product_order_admin_metabox_render( $post ): void {
	$product_id = (int) $post->ID;

	$orders = wc_get_orders( [
		'limit'      => 20,
		'orderby'    => 'date',
		'order'      => 'DESC',
		'return'     => 'objects',
		'meta_query' => [
			[
				'key'     => '_product_id',
				'value'   => $product_id,
				'compare' => '=',
				'type'    => 'NUMERIC',
			],
		],
	] );

	if ( empty( $orders ) ) {
		echo '<p>' . esc_html__( 'No orders found for this product.', 'drywall-toolbox' ) . '</p>';
		return;
	}

	echo '<table style="width:100%;font-size:12px;border-collapse:collapse;">';
	echo '<thead><tr>'
		. '<th style="text-align:left;padding:3px 5px;">' . esc_html__( 'Order', 'drywall-toolbox' ) . '</th>'
		. '<th style="text-align:left;padding:3px 5px;">' . esc_html__( 'Status', 'drywall-toolbox' ) . '</th>'
		. '<th style="text-align:left;padding:3px 5px;">' . esc_html__( 'Date', 'drywall-toolbox' ) . '</th>'
		. '</tr></thead><tbody>';

	foreach ( $orders as $order ) {
		$edit_url = get_edit_post_link( $order->get_id() );
		echo '<tr style="border-top:1px solid #f0f0f0;">'
			. '<td style="padding:3px 5px;"><a href="' . esc_url( (string) $edit_url ) . '">#' . esc_html( (string) $order->get_id() ) . '</a></td>'
			. '<td style="padding:3px 5px;">' . esc_html( $order->get_status() ) . '</td>'
			. '<td style="padding:3px 5px;">' . esc_html( $order->get_date_created() ? $order->get_date_created()->format( 'Y-m-d' ) : '—' ) . '</td>'
			. '</tr>';
	}

	echo '</tbody></table>';
}
