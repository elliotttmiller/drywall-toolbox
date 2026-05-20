<?php
/**
 * DTB Order Event Stream — SSE frame builder helper.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_order_build_sse_frame( int $order_id ): ?array {
	$projection  = dtb_order_get_tracking_projection( $order_id );
	$status_proj = $projection ? dtb_order_build_status_projection( $order_id ) : null;

	if ( ! $projection || ! $status_proj ) {
		return null;
	}

	return [
		'status'      => $status_proj['status'],
		'label'       => $status_proj['label'],
		'occurred_at' => current_time( 'c', true ),
		'is_terminal' => $status_proj['is_terminal'],
		'timeline'    => $projection['timeline'],
	];
}
