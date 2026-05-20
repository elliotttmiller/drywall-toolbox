<?php
/**
 * DTB Order List Controller — REST handler for order list endpoint.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_order_rest_list_orders( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$user_id  = get_current_user_id();
	$page     = (int) $request->get_param( 'page' );
	$per_page = (int) $request->get_param( 'per_page' );

	$query = new WC_Order_Query( [
		'customer_id' => $user_id,
		'limit'       => $per_page,
		'paged'       => $page,
		'orderby'     => 'date',
		'order'       => 'DESC',
		'return'      => 'objects',
	] );

	$orders  = $query->get_orders();
	$results = [];

	foreach ( $orders as $order ) {
		$results[] = dtb_order_format_summary( $order );
	}

	$total = (int) $query->get_total();

	$response = new WP_REST_Response( $results, 200 );
	$response->header( 'X-WP-Total',      (string) $total );
	$response->header( 'X-WP-TotalPages', (string) ceil( $total / $per_page ) );
	return $response;
}
