<?php
defined( 'ABSPATH' ) || exit;

function dtb_marketing_is_valid_email( string $email ): bool {
	return (bool) is_email( $email );
}
