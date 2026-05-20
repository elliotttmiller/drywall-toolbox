<?php
defined( 'ABSPATH' ) || exit;

function dtb_marketing_save_subscriber( string $email, string $ip ) {
	return function_exists( 'dtb_save_subscriber' ) ? dtb_save_subscriber( $email, $ip ) : false;
}
