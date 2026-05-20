<?php
defined( 'ABSPATH' ) || exit;

function dtb_integrations_qbo_auth_url(): string {
	return function_exists( 'dtb_qbo_get_auth_url' ) ? (string) dtb_qbo_get_auth_url() : '';
}
