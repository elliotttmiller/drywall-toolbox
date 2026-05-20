<?php
/**
 * Validation — RepairSubmitValidator: validate repair submission request body.
 *
 * @package drywall-toolbox
 */

defined( 'ABSPATH' ) || exit;

/**
 * Validate a repair submission payload.
 *
 * @param array $data Raw (unsanitized) input data.
 * @return true|WP_Error True on success, WP_Error on validation failure.
 */
function dtb_validate_repair_submit( array $data ): bool|WP_Error {
$errors = new WP_Error();

$required = [
'customer_name'  => __( 'Customer name', 'drywall-toolbox' ),
'customer_email' => __( 'Email address', 'drywall-toolbox' ),
'description'    => __( 'Repair description', 'drywall-toolbox' ),
'item_type'      => __( 'Item type', 'drywall-toolbox' ),
];

foreach ( $required as $field => $label ) {
if ( empty( $data[ $field ] ) ) {
$errors->add(
'dtb_repair_missing_' . $field,
sprintf(
/* translators: %s: field label */
__( '%s is required.', 'drywall-toolbox' ),
$label
)
);
}
}

if ( ! empty( $data['customer_email'] ) && ! is_email( (string) $data['customer_email'] ) ) {
$errors->add(
'dtb_repair_invalid_email',
__( 'A valid email address is required.', 'drywall-toolbox' )
);
}

if ( ! empty( $data['customer_name'] ) && mb_strlen( (string) $data['customer_name'] ) > 100 ) {
$errors->add(
'dtb_repair_name_too_long',
__( 'Customer name must be 100 characters or fewer.', 'drywall-toolbox' )
);
}

if ( ! empty( $data['description'] ) && mb_strlen( (string) $data['description'] ) > 3000 ) {
$errors->add(
'dtb_repair_description_too_long',
__( 'Repair description must be 3000 characters or fewer.', 'drywall-toolbox' )
);
}

if ( $errors->has_errors() ) {
return $errors;
}

return true;
}
