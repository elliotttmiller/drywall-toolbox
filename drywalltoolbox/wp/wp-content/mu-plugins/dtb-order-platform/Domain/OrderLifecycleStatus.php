<?php
/**
 * Domain: Order Lifecycle Status — WC status map, labels, fulfillment substates.
 *
 * @package drywall-toolbox
 */
defined( 'ABSPATH' ) || exit;

function dtb_order_get_status_map(): array {
return [
'pending'    => [ 'label' => __( 'Order Received',       'drywall-toolbox' ), 'description' => __( 'Order started, payment not confirmed', 'drywall-toolbox' ), 'is_terminal' => false ],
'on-hold'    => [ 'label' => __( 'Payment Under Review',  'drywall-toolbox' ), 'description' => __( 'Awaiting confirmation or manual review', 'drywall-toolbox' ), 'is_terminal' => false ],
'processing' => [ 'label' => __( 'Processing',            'drywall-toolbox' ), 'description' => __( 'Paid and preparing for fulfillment', 'drywall-toolbox' ), 'is_terminal' => false ],
'completed'  => [ 'label' => __( 'Delivered / Completed', 'drywall-toolbox' ), 'description' => __( 'Fulfillment complete', 'drywall-toolbox' ), 'is_terminal' => true ],
'cancelled'  => [ 'label' => __( 'Cancelled',             'drywall-toolbox' ), 'description' => __( 'Order cancelled', 'drywall-toolbox' ), 'is_terminal' => true ],
'refunded'   => [ 'label' => __( 'Refunded',              'drywall-toolbox' ), 'description' => __( 'Full or partial refund processed', 'drywall-toolbox' ), 'is_terminal' => true ],
'failed'     => [ 'label' => __( 'Payment Failed',        'drywall-toolbox' ), 'description' => __( 'Payment did not complete', 'drywall-toolbox' ), 'is_terminal' => true ],
];
}

function dtb_order_terminal_statuses(): array {
return array_keys( array_filter( dtb_order_get_status_map(), static fn( $v ) => $v['is_terminal'] ) );
}

function dtb_order_get_status_label( string $wc_status ): string {
$map = dtb_order_get_status_map();
return $map[ $wc_status ]['label'] ?? ucwords( str_replace( '-', ' ', $wc_status ) );
}

function dtb_order_get_allowed_transitions( string $status ): array {
	static $map = null;

	if ( null === $map ) {
		$map = [
			'pending'    => [ 'on-hold', 'processing', 'cancelled', 'failed' ],
			'on-hold'    => [ 'processing', 'cancelled' ],
			'processing' => [ 'completed', 'on-hold', 'cancelled', 'refunded' ],
			'completed'  => [],
			'cancelled'  => [],
			'refunded'   => [],
			'failed'     => [],
		];
	}

	return $map[ $status ] ?? [];
}

function dtb_order_fulfillment_substates(): array {
return [
'pending'            => __( 'Preparing', 'drywall-toolbox' ),
'inventory_reserved' => __( 'Inventory Reserved', 'drywall-toolbox' ),
'picked'             => __( 'Picking', 'drywall-toolbox' ),
'packed'             => __( 'Packed', 'drywall-toolbox' ),
'shipped'            => __( 'Shipped', 'drywall-toolbox' ),
'delivered'          => __( 'Delivered', 'drywall-toolbox' ),
'exception'          => __( 'Processing Delay', 'drywall-toolbox' ),
];
}
