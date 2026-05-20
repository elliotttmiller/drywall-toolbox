<?php
/**
 * Application — SubmitRepairRequest: orchestrates submission, idempotency, event append, job dispatch.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Submit a new repair request.
 *
 * @param array $data Validated and sanitized field data.
 * @return int|WP_Error Post ID of newly created repair, or WP_Error on failure.
 */
function dtb_submit_repair_request( array $data ): int|WP_Error {
$idempotency_key = sanitize_text_field( (string) ( $data['idempotency_key'] ?? '' ) );

if ( '' !== $idempotency_key ) {
$existing_id = dtb_repair_find_by_idempotency_key( $idempotency_key );
if ( null !== $existing_id ) {
return $existing_id;
}
}

$customer_name  = sanitize_text_field( (string) ( $data['customer_name'] ?? '' ) );
$customer_email = sanitize_email( (string) ( $data['customer_email'] ?? '' ) );
$customer_phone = sanitize_text_field( (string) ( $data['customer_phone'] ?? '' ) );
$description    = sanitize_textarea_field( (string) ( $data['description'] ?? '' ) );
$item_type      = sanitize_text_field( (string) ( $data['item_type'] ?? '' ) );
$item_brand     = sanitize_text_field( (string) ( $data['item_brand'] ?? '' ) );
$item_model     = sanitize_text_field( (string) ( $data['item_model'] ?? '' ) );
$source         = sanitize_text_field( (string) ( $data['source'] ?? 'api' ) );

$title = sprintf(
/* translators: 1: customer name, 2: item type */
__( 'Repair Request — %1$s (%2$s)', 'drywall-toolbox' ),
$customer_name,
$item_type
);

$post_id = wp_insert_post(
[
'post_type'   => 'dtb_repair_request',
'post_title'  => $title,
'post_status' => 'publish',
],
true
);

if ( is_wp_error( $post_id ) ) {
return $post_id;
}

$meta = [
'_repair_customer_name'    => $customer_name,
'_repair_customer_email'   => $customer_email,
'_repair_customer_phone'   => $customer_phone,
'_repair_description'      => $description,
'_repair_item_type'        => $item_type,
'_repair_item_brand'       => $item_brand,
'_repair_item_model'       => $item_model,
'_repair_status'           => 'submitted',
'_repair_submitted_at'     => gmdate( 'Y-m-d\TH:i:s\Z' ),
'_repair_source'           => $source,
'_repair_idempotency_key'  => $idempotency_key,
'_repair_submission_ip'    => dtb_repair_get_client_ip(),
];

foreach ( $meta as $key => $value ) {
update_post_meta( $post_id, $key, $value );
}

if ( function_exists( 'dtb_repair_append_event' ) ) {
dtb_repair_append_event(
$post_id,
'repair.submitted',
[
'actor_type' => 'customer',
'actor_id'   => null,
'source'     => $source,
'payload'    => [
'customer_name'  => $customer_name,
'customer_email' => $customer_email,
'item_type'      => $item_type,
],
]
);
}

if ( function_exists( 'dtb_repair_enqueue_job' ) ) {
dtb_repair_enqueue_job(
'dtb_repair_send_notification',
$post_id,
[ 'template' => 'repair-submitted' ]
);
dtb_repair_enqueue_job( 'dtb_repair_refresh_projection', $post_id );
}

/**
 * Fires after a new repair request has been successfully submitted.
 *
 * @param int   $post_id
 * @param array $data
 */
do_action( 'dtb_repair_submitted', $post_id, $data );

return $post_id;
}
