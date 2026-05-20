<?php
/**
 * Services — RepairProjectionService: customer-safe status projection builder.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Build the full customer-safe status projection for a repair.
 *
 * @param int $repair_id
 * @return array
 */
function dtb_build_repair_status_projection( int $repair_id ): array {
$status       = dtb_get_repair_status( $repair_id );
$label        = dtb_get_repair_status_label( $status );
$submitted_at = (string) get_post_meta( $repair_id, '_repair_submitted_at', true );

$last_event   = null;
$last_updated = '';

if ( function_exists( 'dtb_repair_get_last_event' ) ) {
$last_event   = dtb_repair_get_last_event( $repair_id );
$last_updated = $last_event ? (string) $last_event->created_at : $submitted_at;
}

$timeline = [];
if ( function_exists( 'dtb_repair_get_customer_timeline' ) ) {
$timeline = dtb_repair_get_customer_timeline( $repair_id );
}

$tracking_number = null;
$expose_tracking = in_array( $status, [ 'ready_to_ship', 'completed', 'closed' ], true );
if ( $expose_tracking ) {
$tracking_number = (string) get_post_meta( $repair_id, '_repair_veeqo_tracking', true ) ?: null;
}

return [
'repair_id'            => $repair_id,
'status'               => $status,
'label'                => $label,
'submitted_at'         => $submitted_at,
'last_updated_at'      => $last_updated,
'estimated_completion' => null,
'tracking_number'      => $tracking_number,
'timeline'             => $timeline,
];
}
