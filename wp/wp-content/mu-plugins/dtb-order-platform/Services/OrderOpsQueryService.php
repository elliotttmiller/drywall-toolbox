<?php
/**
 * DTB Order Ops Query Service — operator-facing WC_Order_Query wrapper.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_order_ops_query_orders( array $args = [] ): array {
	$defaults = [
		'limit'   => 20,
		'paged'   => 1,
		'orderby' => 'date',
		'order'   => 'DESC',
		'return'  => 'objects',
	];

	$query_args = array_merge( $defaults, $args );

	// Operator query — no customer scoping.
	unset( $query_args['customer_id'] );

	if ( isset( $query_args['status'] ) ) {
		$query_args['status'] = sanitize_key( $query_args['status'] );
	}

	$query = new WC_Order_Query( $query_args );
	return $query->get_orders();
}
