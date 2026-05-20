<?php
/**
 * Tracking — RepairCustomerTimeline: build a customer-safe timeline from events.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Return the customer-visible timeline for a repair.
 *
 * @param int $repair_id
 * @return array
 */
function dtb_repair_get_customer_timeline( int $repair_id ): array {
if ( ! function_exists( 'dtb_repair_get_events' ) ) {
return [];
}

$events    = dtb_repair_get_events( $repair_id );
$timeline  = [];

foreach ( $events as $event ) {
$payload = is_string( $event->payload ) ? json_decode( $event->payload, true ) : (array) $event->payload;

if ( ! in_array( (string) ( $payload['visibility'] ?? 'customer' ), [ 'customer', 'public' ], true ) ) {
continue;
}

$timeline[] = [
'event_type' => $event->event_type,
'created_at' => $event->created_at,
'label'      => dtb_repair_event_label( $event->event_type ),
];
}

return $timeline;
}

/**
 * Return a human-readable label for an event type.
 *
 * @param string $event_type
 * @return string
 */
function dtb_repair_event_label( string $event_type ): string {
$map = [
'repair.submitted'       => __( 'Request submitted', 'drywall-toolbox' ),
'repair.reviewed'        => __( 'Under review', 'drywall-toolbox' ),
'repair.approved'        => __( 'Approved for repair', 'drywall-toolbox' ),
'repair.quoted'          => __( 'Quote ready', 'drywall-toolbox' ),
'repair.quote_accepted'  => __( 'Quote accepted', 'drywall-toolbox' ),
'repair.quote_declined'  => __( 'Quote declined', 'drywall-toolbox' ),
'repair.parts_allocated' => __( 'Parts allocated', 'drywall-toolbox' ),
'repair.in_progress'     => __( 'Repair in progress', 'drywall-toolbox' ),
'repair.ready_to_ship'   => __( 'Ready to ship', 'drywall-toolbox' ),
'repair.completed'       => __( 'Repair completed', 'drywall-toolbox' ),
'repair.closed'          => __( 'Closed', 'drywall-toolbox' ),
'repair.cancelled'       => __( 'Cancelled', 'drywall-toolbox' ),
];

return $map[ $event_type ] ?? ucwords( str_replace( [ 'repair.', '_' ], [ '', ' ' ], $event_type ) );
}
