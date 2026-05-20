<?php
/**
 * DTB Product Order Timeline Drawer — hidden drawer HTML for product order timelines.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_product_order_timeline_drawer_html( int $order_id ): void {
	$drawer_id = 'dtb-timeline-drawer-' . $order_id;
	echo '<div id="' . esc_attr( $drawer_id ) . '" class="dtb-timeline-drawer" style="display:none;position:fixed;top:0;right:0;width:420px;height:100vh;background:#fff;border-left:1px solid #ddd;overflow-y:auto;z-index:9999;padding:20px;">';
	echo '<button type="button" class="dtb-drawer-close" style="float:right;cursor:pointer;" aria-label="' . esc_attr__( 'Close', 'drywall-toolbox' ) . '">&times;</button>';
	echo '<h3>' . esc_html__( 'Order Timeline', 'drywall-toolbox' ) . ' #' . esc_html( (string) $order_id ) . '</h3>';
	echo '<div class="dtb-timeline-content"></div>';
	echo '</div>';
}
