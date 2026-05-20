<?php
/**
 * DTB Order Ops Projection Service — operator-level order projection builder.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

function dtb_order_ops_build_projection( int $order_id ): ?array {
	$order = wc_get_order( $order_id );
	if ( ! $order ) {
		return null;
	}

	$wc_status  = $order->get_status();
	$substate   = dtb_order_get_fulfillment_substate( $order_id );
	$int_state  = dtb_order_get_integration_state( $order_id );
	$last_event = dtb_order_get_last_event( $order_id );

	return [
		'order_id'             => $order_id,
		'wc_status'            => $wc_status,
		'fulfillment_substate' => $substate,
		'integration_state'    => $int_state,
		'last_event'           => $last_event ? [
			'type'        => (string) $last_event->event_type,
			'occurred_at' => (string) $last_event->created_at,
			'actor_type'  => (string) $last_event->actor_type,
			'source'      => (string) $last_event->source,
		] : null,
	];
}
