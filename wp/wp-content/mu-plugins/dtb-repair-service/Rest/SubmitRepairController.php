<?php
/**
 * Rest — SubmitRepairController: POST /wp-json/dtb/v1/repairs/submit
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

add_action( 'rest_api_init', 'dtb_repair_register_submit_route' );

function dtb_repair_register_submit_route(): void {
register_rest_route(
'dtb/v1',
'/repairs/submit',
[
'methods'             => WP_REST_Server::CREATABLE,
'callback'            => 'dtb_repair_rest_submit',
'permission_callback' => '__return_true',
]
);
}

function dtb_repair_rest_submit( WP_REST_Request $request ): WP_REST_Response|WP_Error {
$data = $request->get_json_params() ?: $request->get_body_params();

$valid = dtb_validate_repair_submit( $data );
if ( is_wp_error( $valid ) ) {
return new WP_REST_Response(
[ 'success' => false, 'errors' => $valid->get_error_messages() ],
422
);
}

$result = dtb_submit_repair_request( $data );
if ( is_wp_error( $result ) ) {
return $result;
}

return new WP_REST_Response(
[
'success'   => true,
'repair_id' => $result,
'message'   => __( 'Your repair request has been submitted.', 'drywall-toolbox' ),
],
201
);
}
